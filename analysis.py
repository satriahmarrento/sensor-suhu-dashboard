import pandas as pd
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import os
import json

# Output directory
OUT = os.path.join(os.path.dirname(__file__), 'analysis_output')
os.makedirs(OUT, exist_ok=True)

# ============================================================
# 1. DATA LOADING & CLEANING
# ============================================================
print("=" * 60)
print("STEP 1: DATA CLEANING & PREPROCESSING")
print("=" * 60)

df = pd.read_csv(os.path.join(os.path.dirname(__file__), 'sensor_data_rows.csv'))
print(f"\nRaw dataset shape: {df.shape}")
print(f"Columns: {list(df.columns)}")

# --- Identify problematic values ---
invalid_dates = df[df['tanggal'] == '----/--/--']
print(f"\nRows with invalid dates ('----/--/--'): {len(invalid_dates)}")

# Fix time format: some use dots (13.23.29) instead of colons (13:23:29)
df['waktu_clean'] = df['waktu'].str.replace('.', ':', regex=False)

# For invalid dates, extract date from created_at
df['created_at_dt'] = pd.to_datetime(df['created_at'], errors='coerce', utc=True)

# Build datetime column
def build_datetime(row):
    if row['tanggal'] != '----/--/--' and row['waktu'] != '--:--:--':
        try:
            dt_str = f"{row['tanggal']} {row['waktu_clean']}"
            return pd.to_datetime(dt_str, format='%Y-%m-%d %H:%M:%S', errors='coerce')
        except:
            return pd.NaT
    elif row['created_at_dt'] is not pd.NaT:
        return row['created_at_dt'].tz_localize(None) if row['created_at_dt'].tzinfo else row['created_at_dt']
    return pd.NaT

df['datetime'] = df.apply(build_datetime, axis=1)

# For rows where datetime is still NaT but created_at exists, use created_at + 7h (WIB)
mask_nat = df['datetime'].isna() & df['created_at_dt'].notna()
df.loc[mask_nat, 'datetime'] = df.loc[mask_nat, 'created_at_dt'].dt.tz_localize(None) + pd.Timedelta(hours=7)

print(f"Rows with valid datetime after cleaning: {df['datetime'].notna().sum()}/{len(df)}")

# --- Handle kondisi and catatan with comma artifacts ---
df['kondisi_clean'] = df['kondisi'].replace({',': np.nan, '","': np.nan})
df['kondisi_clean'] = df['kondisi_clean'].fillna('Unknown')
# Standardize
df['kondisi_clean'] = df['kondisi_clean'].str.strip()

df['catatan_clean'] = df['catatan'].replace({',': np.nan, '","': np.nan, '-': 'Tidak Ada', '-(manual)': 'Manual Entry', '-(m)': 'Manual Entry', '-(req)': 'Request Entry'})
df['catatan_clean'] = df['catatan_clean'].fillna('Tidak Ada')

# --- Check for missing numerical values ---
num_cols = ['suhu', 'kelembaban', 'heat_index', 'deviasi', 'comfort_index', 'jumlah_orang', 'setting_ac']
print(f"\nMissing values in numerical columns:")
for c in num_cols:
    print(f"  {c}: {df[c].isna().sum()}")

# Summary of cleaning
print(f"\n--- Cleaning Summary ---")
print(f"Total records: {len(df)}")
print(f"Invalid date records fixed via created_at: {len(invalid_dates)}")
print(f"Time format inconsistencies (dots->colons): {(df['waktu'].str.contains(r'[.]', regex=True, na=False)).sum()}")
print(f"Kondisi with comma artifacts cleaned: {(df['kondisi'] == ',').sum() + (df['kondisi'] == '\",\"').sum()}")

# --- Filter by Date (2026-04-12 to 2026-04-16) ---
df = df[df['datetime'].notna()]
start_date = pd.to_datetime('2026-04-12')
end_date = pd.to_datetime('2026-04-16 23:59:59')
df = df[(df['datetime'] >= start_date) & (df['datetime'] <= end_date)]
print(f"\nRecords remaining after filtering for 2026-04-12 to 2026-04-16: {len(df)}")

# ============================================================
# 2. EXPLORATORY DATA ANALYSIS
# ============================================================
print("\n" + "=" * 60)
print("STEP 2: EXPLORATORY DATA ANALYSIS (EDA)")
print("=" * 60)

# --- Summary statistics ---
summary_cols = ['suhu', 'kelembaban', 'comfort_index', 'jumlah_orang']
stats_df = df[summary_cols].describe().T[['count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max']]
stats_df.columns = ['Count', 'Mean', 'Std', 'Min', 'Q1', 'Median', 'Q3', 'Max']
print("\n--- Summary Statistics ---")
print(stats_df.round(2).to_string())

# Additional stats
print(f"\n--- Additional Metrics ---")
print(f"Heat Index: mean={df['heat_index'].mean():.2f}, min={df['heat_index'].min()}, max={df['heat_index'].max()}")
print(f"Deviasi: mean={df['deviasi'].mean():.2f}, min={df['deviasi'].min()}, max={df['deviasi'].max()}")
print(f"Setting AC: mean={df['setting_ac'].mean():.2f}, unique values={sorted(df['setting_ac'].unique())}")

# --- Categorical distributions ---
print(f"\n--- Status Distribution ---")
status_counts = df['status'].value_counts()
for s, c in status_counts.items():
    print(f"  {s}: {c} ({c/len(df)*100:.1f}%)")

print(f"\n--- Kondisi Distribution (cleaned) ---")
kondisi_counts = df['kondisi_clean'].value_counts()
for k, c in kondisi_counts.items():
    print(f"  {k}: {c} ({c/len(df)*100:.1f}%)")

print(f"\n--- Catatan Distribution (cleaned) ---")
cat_counts = df['catatan_clean'].value_counts()
for k, c in cat_counts.items():
    print(f"  {k}: {c} ({c/len(df)*100:.1f}%)")

# ============================================================
# 3. CORRELATION & PATTERN ANALYSIS
# ============================================================
print("\n" + "=" * 60)
print("STEP 3: CORRELATION & PATTERN ANALYSIS")
print("=" * 60)

# --- Impact of jumlah_orang on suhu and kelembaban ---
print("\n--- People Count Impact on Temperature & Humidity ---")
people_groups = df.groupby('jumlah_orang')[['suhu', 'kelembaban', 'comfort_index']].agg(['mean', 'std', 'count'])
# Flatten
people_summary = pd.DataFrame({
    'count': df.groupby('jumlah_orang').size(),
    'suhu_mean': df.groupby('jumlah_orang')['suhu'].mean(),
    'suhu_std': df.groupby('jumlah_orang')['suhu'].std(),
    'kelembaban_mean': df.groupby('jumlah_orang')['kelembaban'].mean(),
    'comfort_mean': df.groupby('jumlah_orang')['comfort_index'].mean(),
})
print(people_summary.round(2).to_string())

# Correlation: jumlah_orang vs suhu
corr_people_suhu, p_people_suhu = stats.pearsonr(df['jumlah_orang'], df['suhu'])
corr_people_kelembaban, p_people_kelembaban = stats.pearsonr(df['jumlah_orang'], df['kelembaban'])
print(f"\nPearson Correlation:")
print(f"  jumlah_orang <-> suhu: r={corr_people_suhu:.4f}, p={p_people_suhu:.4e}")
print(f"  jumlah_orang <-> kelembaban: r={corr_people_kelembaban:.4f}, p={p_people_kelembaban:.4e}")

# --- AC Setting vs Actual Temp vs Comfort ---
print("\n--- AC Setting vs Temperature vs Comfort Status ---")
ac_groups = df.groupby('setting_ac').agg(
    count=('id', 'count'),
    suhu_mean=('suhu', 'mean'),
    suhu_min=('suhu', 'min'),
    suhu_max=('suhu', 'max'),
    temp_gap_mean=('deviasi', 'mean'),
    comfort_mean=('comfort_index', 'mean'),
).round(2)
print(ac_groups.to_string())

# Status breakdown by AC setting
print("\n--- Comfort Status by AC Setting ---")
status_by_ac = pd.crosstab(df['setting_ac'], df['status'], normalize='index') * 100
print(status_by_ac.round(1).to_string())

# --- Full correlation matrix ---
print("\n--- Correlation Matrix (key variables) ---")
corr_cols = ['suhu', 'kelembaban', 'heat_index', 'deviasi', 'comfort_index', 'jumlah_orang', 'setting_ac']
corr_matrix = df[corr_cols].corr()
print(corr_matrix.round(3).to_string())

# ============================================================
# 4. GENERATE VISUALIZATIONS
# ============================================================
print("\n" + "=" * 60)
print("STEP 4: GENERATING VISUALIZATIONS")
print("=" * 60)

sns.set_theme(style="whitegrid", palette="muted", font_scale=1.1)
plt.rcParams['figure.dpi'] = 150

# --- Fig 1: Summary distributions ---
fig, axes = plt.subplots(2, 2, figsize=(14, 10))
fig.suptitle('Distribution of Key Sensor Variables', fontsize=16, fontweight='bold')

for ax, col, title, color in zip(
    axes.flat,
    ['suhu', 'kelembaban', 'comfort_index', 'jumlah_orang'],
    ['Temperature (°C)', 'Humidity (%)', 'Comfort Index', 'People Count'],
    ['#e74c3c', '#3498db', '#2ecc71', '#9b59b6']
):
    ax.hist(df[col], bins=25, color=color, alpha=0.7, edgecolor='white')
    ax.axvline(df[col].mean(), color='black', linestyle='--', linewidth=1.5, label=f'Mean: {df[col].mean():.1f}')
    ax.axvline(df[col].median(), color='gray', linestyle=':', linewidth=1.5, label=f'Median: {df[col].median():.1f}')
    ax.set_title(title, fontweight='bold')
    ax.legend(fontsize=9)

plt.tight_layout()
fig.savefig(os.path.join(OUT, '01_distributions.png'), bbox_inches='tight')
plt.close()
print("  Saved: 01_distributions.png")

# --- Fig 2: Correlation heatmap ---
fig, ax = plt.subplots(figsize=(10, 8))
mask = np.triu(np.ones_like(corr_matrix, dtype=bool), k=1)
sns.heatmap(corr_matrix, annot=True, fmt='.2f', cmap='RdBu_r', center=0,
            mask=mask, square=True, linewidths=0.5, ax=ax,
            xticklabels=['Suhu', 'Kelembaban', 'Heat Index', 'Deviasi', 'Comfort', 'Jumlah Orang', 'Setting AC'],
            yticklabels=['Suhu', 'Kelembaban', 'Heat Index', 'Deviasi', 'Comfort', 'Jumlah Orang', 'Setting AC'])
ax.set_title('Correlation Heatmap - Sensor Variables', fontsize=14, fontweight='bold')
plt.tight_layout()
fig.savefig(os.path.join(OUT, '02_correlation_heatmap.png'), bbox_inches='tight')
plt.close()
print("  Saved: 02_correlation_heatmap.png")

# --- Fig 3: People count vs Temperature & Humidity ---
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle('Impact of People Count on Room Conditions', fontsize=14, fontweight='bold')

# Filter out extreme jumlah_orang for clearer plot (group 3+ together)
df['people_group'] = df['jumlah_orang'].apply(lambda x: str(x) if x <= 2 else '3+')
order = ['0', '1', '2', '3+']
existing = [o for o in order if o in df['people_group'].unique()]

sns.boxplot(data=df, x='people_group', y='suhu', order=existing, palette='Reds', ax=ax1)
ax1.set_xlabel('Number of People')
ax1.set_ylabel('Temperature (°C)')
ax1.set_title('Temperature by People Count')

sns.boxplot(data=df, x='people_group', y='kelembaban', order=existing, palette='Blues', ax=ax2)
ax2.set_xlabel('Number of People')
ax2.set_ylabel('Humidity (%)')
ax2.set_title('Humidity by People Count')

plt.tight_layout()
fig.savefig(os.path.join(OUT, '03_people_impact.png'), bbox_inches='tight')
plt.close()
print("  Saved: 03_people_impact.png")

# --- Fig 4: AC Setting analysis ---
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle('AC Setting vs Room Conditions', fontsize=14, fontweight='bold')

sns.boxplot(data=df, x='setting_ac', y='suhu', palette='coolwarm', ax=ax1)
ax1.set_xlabel('AC Setting (°C)')
ax1.set_ylabel('Actual Temperature (°C)')
ax1.set_title('Actual Temp by AC Setting')

sns.boxplot(data=df, x='setting_ac', y='comfort_index', palette='YlGn', ax=ax2)
ax2.set_xlabel('AC Setting (°C)')
ax2.set_ylabel('Comfort Index')
ax2.set_title('Comfort Index by AC Setting')

plt.tight_layout()
fig.savefig(os.path.join(OUT, '04_ac_setting_analysis.png'), bbox_inches='tight')
plt.close()
print("  Saved: 04_ac_setting_analysis.png")

# --- Fig 5: Status distribution pie ---
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))
colors_status = {'NYAMAN': '#2ecc71', 'HANGAT': '#e74c3c'}
status_counts.plot.pie(ax=ax1, colors=[colors_status.get(s, '#95a5a6') for s in status_counts.index],
                       autopct='%1.1f%%', startangle=90, textprops={'fontsize': 12})
ax1.set_ylabel('')
ax1.set_title('Comfort Status Distribution', fontweight='bold')

kondisi_counts.plot.bar(ax=ax2, color=['#3498db', '#e67e22', '#95a5a6'][:len(kondisi_counts)])
ax2.set_title('AC Condition Distribution', fontweight='bold')
ax2.set_xlabel('Condition')
ax2.set_ylabel('Count')
plt.xticks(rotation=0)

plt.tight_layout()
fig.savefig(os.path.join(OUT, '05_categorical_distributions.png'), bbox_inches='tight')
plt.close()
print("  Saved: 05_categorical_distributions.png")

# --- Fig 6: Time series (only valid datetime rows) ---
df_ts = df[df['datetime'].notna()].sort_values('datetime').copy()
if len(df_ts) > 0:
    fig, axes = plt.subplots(3, 1, figsize=(16, 12), sharex=True)
    fig.suptitle('Time Series - Sensor Readings', fontsize=16, fontweight='bold')
    
    axes[0].plot(df_ts['datetime'], df_ts['suhu'], color='#e74c3c', linewidth=0.8, alpha=0.8)
    axes[0].fill_between(df_ts['datetime'], df_ts['suhu'], alpha=0.2, color='#e74c3c')
    axes[0].set_ylabel('Temperature (°C)')
    axes[0].set_title('Room Temperature Over Time')
    
    axes[1].plot(df_ts['datetime'], df_ts['kelembaban'], color='#3498db', linewidth=0.8, alpha=0.8)
    axes[1].fill_between(df_ts['datetime'], df_ts['kelembaban'], alpha=0.2, color='#3498db')
    axes[1].set_ylabel('Humidity (%)')
    axes[1].set_title('Humidity Over Time')
    
    axes[2].plot(df_ts['datetime'], df_ts['comfort_index'], color='#2ecc71', linewidth=0.8, alpha=0.8)
    axes[2].fill_between(df_ts['datetime'], df_ts['comfort_index'], alpha=0.2, color='#2ecc71')
    axes[2].set_ylabel('Comfort Index')
    axes[2].set_title('Comfort Index Over Time')
    axes[2].set_xlabel('Date/Time')
    
    plt.tight_layout()
    fig.savefig(os.path.join(OUT, '06_time_series.png'), bbox_inches='tight')
    plt.close()
    print("  Saved: 06_time_series.png")

# --- Fig 7: Scatter - Suhu vs Comfort colored by status ---
fig, ax = plt.subplots(figsize=(10, 7))
for status, color in [('NYAMAN', '#2ecc71'), ('HANGAT', '#e74c3c')]:
    mask = df['status'] == status
    ax.scatter(df.loc[mask, 'suhu'], df.loc[mask, 'comfort_index'], 
               c=color, label=status, alpha=0.6, s=40, edgecolors='white', linewidth=0.5)
ax.set_xlabel('Temperature (°C)', fontsize=12)
ax.set_ylabel('Comfort Index', fontsize=12)
ax.set_title('Temperature vs Comfort Index by Status', fontsize=14, fontweight='bold')
ax.legend(fontsize=11)
ax.grid(True, alpha=0.3)
plt.tight_layout()
fig.savefig(os.path.join(OUT, '07_temp_vs_comfort.png'), bbox_inches='tight')
plt.close()
print("  Saved: 07_temp_vs_comfort.png")

print("\n" + "=" * 60)
print("ANALYSIS COMPLETE - All charts saved to analysis_output/")
print("=" * 60)
