const state = {
    data: [],
    currentView: null,
    charts: {}
};

const ROUTES = {
    '': 'dashboard',
    '#': 'dashboard',
    '#dashboard': 'dashboard',
    '#inventory': 'inventory',
    '#analytics': 'analytics',
    '#ml': 'ml'
};

const el = (id) => document.getElementById(id);

// --- Initialization ---
async function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
    await fetchData();
    // Refresh data every 10 seconds
    setInterval(() => fetchData(), 10000);
}

// --- Routing ---
function handleRoute() {
    const hash = window.location.hash;
    const view = ROUTES[hash] || 'dashboard';
    if (state.currentView === view) return;
    
    state.currentView = view;
    
    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.dataset.view === view) {
            if (link.closest('#mobile-nav')) {
                link.classList.add('text-emerald-600', 'border-emerald-600');
                link.classList.remove('text-slate-500', 'border-transparent');
                link.querySelector('.material-symbols-outlined').setAttribute('data-weight', 'fill');
            } else {
                link.classList.add('bg-emerald-600', 'text-white', 'shadow-[4px_4px_0px_0px_rgba(17,24,39,1)]', 'border-slate-900');
                link.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100');
            }
        } else {
            if (link.closest('#mobile-nav')) {
                link.classList.remove('text-emerald-600', 'border-emerald-600');
                link.classList.add('text-slate-500', 'border-transparent');
                link.querySelector('.material-symbols-outlined').removeAttribute('data-weight');
            } else {
                link.classList.remove('bg-emerald-600', 'text-white', 'shadow-[4px_4px_0px_0px_rgba(17,24,39,1)]', 'border-slate-900');
                link.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:bg-slate-100');
            }
        }
    });

    // Cleanup charts
    Object.values(state.charts).forEach(c => c?.destroy());
    state.charts = {};

    // Render view template
    const root = el('app-root');
    const tmpl = el(`tmpl-${view}`);
    if (tmpl) {
        root.innerHTML = '';
        root.appendChild(tmpl.content.cloneNode(true));
        renderCurrentView();
    }
}

// --- Data Fetching ---
async function fetchData(manualSync = false) {
    if (manualSync) {
        const btn = el('db-status-icon');
        if(btn) btn.classList.add('animate-spin');
    }
    
    try {
        const res = await fetch('/api/sensor_data');
        const json = await res.json();
        if (json.data && Array.isArray(json.data)) {
            state.data = json.data;
            updateConnectionStatus('ok', 'ONLINE');
        } else {
            throw new Error('Invalid data format');
        }
    } catch (e) {
        console.error(e);
        updateConnectionStatus('error', 'OFFLINE');
    }
    
    if (manualSync) {
        const btn = el('db-status-icon');
        if(btn) btn.classList.remove('animate-spin');
    }

    renderCurrentView();
}

function updateConnectionStatus(status, text) {
    const icon = el('db-status-icon');
    const textEl = el('db-status-text');
    if (!icon || !textEl) return;
    
    textEl.textContent = text;
    if (status === 'ok') {
        icon.className = 'material-symbols-outlined text-[18px] text-emerald-400';
        icon.textContent = 'wifi';
    } else {
        icon.className = 'material-symbols-outlined text-[18px] text-error';
        icon.textContent = 'wifi_off';
    }
}

// --- View Rendering ---
function renderCurrentView() {
    if (state.currentView === 'dashboard') renderDashboard();
    else if (state.currentView === 'inventory') renderInventory();
    else if (state.currentView === 'analytics') renderAnalytics();
    else if (state.currentView === 'ml') renderML();
}

function renderDashboard() {
    if (!state.data.length) return;
    
    const latest = state.data[state.data.length - 1];
    
    // KPIs
    if (el('kpi-temp')) {
        el('kpi-temp').textContent = `${Number(latest.suhu).toFixed(1)}°C`;
        const diff = (Number(latest.suhu) - 24).toFixed(1); // Assuming 24 is baseline
        const trend = diff >= 0 ? 'arrow_upward' : 'arrow_downward';
        el('kpi-temp-sub').innerHTML = `<span class="material-symbols-outlined text-[16px]">${trend}</span> ${diff > 0 ? '+' : ''}${diff}°C from baseline`;
    }
    
    if (el('kpi-rh')) {
        el('kpi-rh').textContent = `${Number(latest.kelembaban).toFixed(0)}%`;
        const isOptimal = latest.kelembaban >= 40 && latest.kelembaban <= 60;
        el('kpi-rh-sub').innerHTML = isOptimal ? 
            `<span class="material-symbols-outlined text-[16px]">check_circle</span> Optimal Range` : 
            `<span class="material-symbols-outlined text-[16px] text-amber-500">warning</span> Suboptimal`;
        el('kpi-rh-sub').className = isOptimal ? "font-body-md text-body-md text-emerald-600 mt-1 flex items-center gap-1 font-bold" : "font-body-md text-body-md text-amber-600 mt-1 flex items-center gap-1 font-bold";
    }
    
    if (el('kpi-ci')) {
        const ci = Number(latest.comfort_index || 0).toFixed(0);
        el('kpi-ci').textContent = `${ci}%`;
        const color = ci >= 70 ? 'text-emerald-400' : ci >= 40 ? 'text-amber-400' : 'text-error';
        const label = ci >= 70 ? 'Optimal Comfort' : ci >= 40 ? 'Marginal' : 'Critical';
        el('kpi-ci-sub').innerHTML = `<span class="material-symbols-outlined text-[16px] ${color}">psychiatry</span> <span class="${color}">${label}</span>`;
    }
    
    // Anomalies
    const list = el('anomalies-list');
    if (list) {
        // Find recent anomalies (CI < 60)
        const recent = [...state.data].reverse().slice(0, 50);
        const anomalies = recent.filter(r => Number(r.comfort_index) < 60).slice(0, 3);
        
        if (anomalies.length) {
            list.innerHTML = anomalies.map(a => `
                <li class="border-b-2 border-slate-900 py-3 flex items-start gap-3 last:border-b-0">
                    <div class="bg-amber-500 text-slate-900 p-1 shrink-0 mt-1">
                        <span class="material-symbols-outlined text-[16px] block">warning</span>
                    </div>
                    <div class="flex-1">
                        <div class="font-button text-button text-slate-900 uppercase">Suboptimal Comfort - Primary Node</div>
                        <div class="font-body-md text-body-md text-secondary text-sm">CI dropped to ${Number(a.comfort_index).toFixed(0)}% (Temp: ${Number(a.suhu).toFixed(1)}°C)</div>
                    </div>
                    <span class="font-label-caps text-label-caps text-secondary shrink-0">${a.waktu}</span>
                </li>
            `).join('');
        } else {
            list.innerHTML = `<li class="py-3 flex items-start gap-3 text-secondary text-sm">No recent anomalies detected.</li>`;
        }
    }
    
    // Chart
    const canvas = el('dashboardChart');
    if (canvas && !state.charts.dash) {
        const ctx = canvas.getContext('2d');
        const slice = state.data.slice(-40);
        
        Chart.defaults.font.family = "'Space Grotesk', sans-serif";
        Chart.defaults.color = "#3d4a42";
        
        state.charts.dash = new Chart(ctx, {
            type: 'line',
            data: {
                labels: slice.map(d => d.waktu),
                datasets: [
                    {
                        label: 'Temperature (°C)',
                        data: slice.map(d => Number(d.suhu)),
                        borderColor: '#00855d',
                        backgroundColor: '#00855d22',
                        borderWidth: 2,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Humidity (%)',
                        data: slice.map(d => Number(d.kelembaban)),
                        borderColor: '#111827',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        tension: 0.3,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { 
                        type: 'linear', display: true, position: 'left',
                        grid: { display: false }
                    },
                    y1: {
                        type: 'linear', display: true, position: 'right',
                        grid: { display: false }
                    }
                }
            }
        });
    } else if (state.charts.dash) {
        // Update existing chart
        const slice = state.data.slice(-40);
        state.charts.dash.data.labels = slice.map(d => d.waktu);
        state.charts.dash.data.datasets[0].data = slice.map(d => Number(d.suhu));
        state.charts.dash.data.datasets[1].data = slice.map(d => Number(d.kelembaban));
        state.charts.dash.update('none');
    }
}

function renderInventory() {
    if (!state.data.length) return;
    const latest = state.data[state.data.length - 1];
    
    const tbody = el('inventory-tbody');
    if (!tbody) return;
    
    // Primary Node (Real Data)
    const ci = Number(latest.comfort_index || 0);
    const statusBg = ci >= 70 ? 'bg-primary-fixed text-on-primary-fixed-variant' : ci >= 40 ? 'bg-amber-200 text-amber-900' : 'bg-error text-on-error';
    const statusDot = ci >= 70 ? '<span class="w-[6px] h-[6px] bg-primary rounded-full"></span>' : ci < 40 ? '<span class="w-[6px] h-[6px] bg-white rounded-full animate-pulse"></span>' : '';
    const statusText = ci >= 70 ? 'Active' : ci >= 40 ? 'Warning' : 'Fault';
    
    let html = `
        <tr class="border-b-[1px] border-on-surface hover:bg-surface-container-low transition-colors group">
            <td class="p-md font-bold tracking-tight">ND-MAIN-01</td>
            <td class="p-md text-on-surface-variant flex items-center gap-sm"><span class="material-symbols-outlined text-[18px]">factory</span> Server Room</td>
            <td class="p-md">T: ${Number(latest.suhu).toFixed(1)}°C | H: ${Number(latest.kelembaban).toFixed(0)}%</td>
            <td class="p-md font-mono text-sm text-outline">${latest.tanggal} ${latest.waktu}</td>
            <td class="p-md text-right">
                <span class="inline-flex items-center gap-xs ${statusBg} font-label-caps text-label-caps px-sm py-[6px] uppercase tracking-widest font-bold">
                    ${statusDot} ${statusText}
                </span>
            </td>
        </tr>
    `;
    
    // Mock Nodes
    const mockNodes = [
        { id: 'ND-AUX-02', loc: 'Storage Bay', type: 'Ambient Temp', status: 'Standby', classes: 'bg-secondary-container text-on-secondary-container border-[1px] border-on-surface' },
        { id: 'ND-AUX-03', loc: 'Lobby', type: 'Thermal', status: 'Active', classes: 'bg-primary-fixed text-on-primary-fixed-variant', dot: true },
        { id: 'ND-EXT-04', loc: 'Outdoor Unit', type: 'Environment', status: 'Active', classes: 'bg-primary-fixed text-on-primary-fixed-variant', dot: true },
    ];
    
    mockNodes.forEach(m => {
        html += `
            <tr class="border-b-[1px] border-on-surface hover:bg-surface-container-low transition-colors group ${m.status === 'Standby' ? 'bg-surface-container-high/30' : ''}">
                <td class="p-md font-bold tracking-tight">${m.id}</td>
                <td class="p-md text-on-surface-variant flex items-center gap-sm"><span class="material-symbols-outlined text-[18px]">domain</span> ${m.loc}</td>
                <td class="p-md">${m.type}</td>
                <td class="p-md font-mono text-sm text-outline">-</td>
                <td class="p-md text-right">
                    <span class="inline-flex items-center gap-xs ${m.classes} font-label-caps text-label-caps px-sm py-[6px] uppercase tracking-widest font-bold">
                        ${m.dot ? '<span class="w-[6px] h-[6px] bg-primary rounded-full"></span>' : ''} ${m.status}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function renderAnalytics() {
    if (!state.data.length) return;
    
    // Calc averages for last 100
    const slice = state.data.slice(-100);
    const avgTemp = slice.reduce((sum, d) => sum + Number(d.suhu), 0) / slice.length;
    const avgRh = slice.reduce((sum, d) => sum + Number(d.kelembaban), 0) / slice.length;
    const avgCi = slice.reduce((sum, d) => sum + Number(d.comfort_index), 0) / slice.length;
    
    if (el('an-avg-temp')) el('an-avg-temp').textContent = `${avgTemp.toFixed(1)}°C`;
    if (el('an-avg-rh')) el('an-avg-rh').textContent = `${avgRh.toFixed(1)}%`;
    if (el('an-avg-ci')) el('an-avg-ci').textContent = `${avgCi.toFixed(0)}%`;
    
    Chart.defaults.font.family = "'Space Grotesk', sans-serif";
    Chart.defaults.color = "#3d4a42";

    // Correlation Chart
    const corrCanvas = el('correlationChart');
    if (corrCanvas && !state.charts.corr) {
        state.charts.corr = new Chart(corrCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels: slice.map(d => d.waktu),
                datasets: [
                    {
                        label: 'Temperature',
                        data: slice.map(d => Number(d.suhu)),
                        borderColor: '#006948',
                        borderWidth: 2,
                        tension: 0.4,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Humidity',
                        data: slice.map(d => Number(d.kelembaban)),
                        borderColor: '#68dba9',
                        borderWidth: 2,
                        borderDash: [4, 4],
                        tension: 0.4,
                        yAxisID: 'y1'
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { display: false },
                    y: { type: 'linear', position: 'left', grid: { color: 'rgba(17,24,39,0.1)' } },
                    y1: { type: 'linear', position: 'right', grid: { display: false } }
                }
            }
        });
    }
    
    // Distribution Chart (Comfort Index Bins)
    const distCanvas = el('distributionChart');
    if (distCanvas && !state.charts.dist) {
        const bins = { '0-40 (Critical)': 0, '41-70 (Marginal)': 0, '71-100 (Optimal)': 0 };
        slice.forEach(d => {
            const ci = Number(d.comfort_index);
            if (ci <= 40) bins['0-40 (Critical)']++;
            else if (ci <= 70) bins['41-70 (Marginal)']++;
            else bins['71-100 (Optimal)']++;
        });
        
        state.charts.dist = new Chart(distCanvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: Object.keys(bins),
                datasets: [{
                    label: 'Count',
                    data: Object.values(bins),
                    backgroundColor: ['#ba1a1a', '#f5b84b', '#00855d'],
                    borderColor: '#111827',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(17,24,39,0.1)' } }
                }
            }
        });
    }
}

window.exportCSV = function() {
    if (!state.data.length) return alert("No data to export");
    const headers = ["Tanggal", "Waktu", "Suhu", "Kelembaban", "Comfort Index", "Status"];
    const rows = state.data.map(d => [d.tanggal, d.waktu, d.suhu, d.kelembaban, d.comfort_index, d.status].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sensor_export_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

window.fetchData = fetchData;

async function renderML() {
    try {
        const res = await fetch('/ml-results.json?v=' + Date.now());
        if (!res.ok) throw new Error('ML results file not found');
        const ml = await res.json();

        // KPIs
        if (el('ml-best-model')) el('ml-best-model').textContent = ml.model_name || 'Random Forest';
        if (el('ml-r2-score')) el('ml-r2-score').textContent = `${(Number(ml.r2_score || 0) * 100).toFixed(2)}%`;
        if (el('ml-mae')) el('ml-mae').textContent = `${Number(ml.mae || 0).toFixed(3)}°C`;
        if (el('ml-rmse')) el('ml-rmse').textContent = `${Number(ml.rmse || 0).toFixed(3)}°C`;

        // Global Feature Importance Bars
        const barsContainer = el('ml-importance-bars');
        if (barsContainer && ml.feature_importances) {
            const maxVal = Math.max(...ml.feature_importances.map(f => f.importance));
            barsContainer.innerHTML = ml.feature_importances.map(f => {
                const percent = maxVal > 0 ? (f.importance / maxVal) * 100 : 0;
                return `
                    <div class="flex flex-col gap-1">
                        <div class="flex justify-between font-bold text-sm text-slate-700">
                            <span class="uppercase font-space-grotesk">${f.feature}</span>
                            <span>${f.importance.toFixed(4)}</span>
                        </div>
                        <div class="w-full bg-slate-100 border-2 border-slate-900 h-6">
                            <div class="bg-emerald-600 h-full border-r-2 border-slate-900 transition-all duration-500" style="width: ${percent}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Latest Local explanation
        const latest = ml.latest_telemetry;
        if (latest) {
            if (el('ml-actual-temp')) el('ml-actual-temp').textContent = `${latest.actual_suhu.toFixed(1)}°C`;
            if (el('ml-pred-temp')) el('ml-pred-temp').textContent = `${latest.predicted_suhu.toFixed(2)}°C`;
            if (el('ml-base-temp')) el('ml-base-temp').textContent = `${latest.base_value.toFixed(2)}°C`;

            const waterfallList = el('ml-waterfall-list');
            if (waterfallList) {
                const sortedShap = Object.entries(latest.shap_values)
                    .map(([feat, val]) => ({ feat, val, raw: latest.features[feat] }))
                    .sort((a, b) => Math.abs(b.val) - Math.abs(a.val));

                waterfallList.innerHTML = sortedShap.map(s => {
                    const isPositive = s.val >= 0;
                    const sign = isPositive ? '+' : '';
                    const color = isPositive ? 'text-rose-600 font-bold' : 'text-blue-600 font-bold';
                    const bg = isPositive ? 'bg-rose-50 border-rose-300' : 'bg-blue-50 border-blue-300';
                    const icon = isPositive ? 'arrow_upward' : 'arrow_downward';
                    const directionText = isPositive ? 'pushed temp UP' : 'pulled temp DOWN';
                    
                    return `
                        <div class="flex items-center justify-between p-3 border-2 border-slate-900 ${bg} rounded-DEFAULT">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[18px] font-bold ${color}">${icon}</span>
                                <div>
                                    <span class="font-bold text-slate-800 uppercase font-space-grotesk">${s.feat}</span>
                                    <span class="text-xs text-slate-500 block">Current value: ${s.raw}</span>
                                </div>
                            </div>
                            <div class="text-right">
                                <span class="font-black ${color} text-lg">${sign}${s.val.toFixed(2)}°C</span>
                                <span class="text-[10px] text-slate-500 block uppercase font-bold tracking-tight">${directionText}</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Regression Models Comparison Table
        const tbody = el('ml-models-tbody');
        if (tbody && ml.all_models_results) {
            tbody.innerHTML = Object.entries(ml.all_models_results).map(([modelName, metrics]) => {
                const isBest = modelName === ml.model_name;
                const statusBg = isBest ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700';
                const statusText = isBest ? 'Selected' : 'Alternative';
                return `
                    <tr class="border-b-2 border-slate-900 hover:bg-slate-50 transition-colors ${isBest ? 'font-bold bg-emerald-50/30' : ''}">
                        <td class="p-md text-slate-900 font-space-grotesk uppercase">${modelName}</td>
                        <td class="p-md font-mono">${metrics.MAE.toFixed(4)}°C</td>
                        <td class="p-md font-mono">${metrics.RMSE.toFixed(4)}°C</td>
                        <td class="p-md font-mono">${(metrics.R2 * 100).toFixed(2)}%</td>
                        <td class="p-md text-right">
                            <span class="inline-block px-2 py-1 ${statusBg} text-xs font-bold uppercase tracking-wider border border-slate-900">
                                ${statusText}
                            </span>
                        </td>
                    </tr>
                `;
            }).join('');
        }

    } catch (e) {
        console.error(e);
        const container = el('app-root');
        if (container && state.currentView === 'ml') {
            container.innerHTML = `
                <div class="p-8 text-center bg-white border-2 border-slate-900 m-6 hard-shadow">
                    <span class="material-symbols-outlined text-[64px] text-red-600 mb-4 animate-bounce">warning</span>
                    <h2 class="text-2xl font-black uppercase text-slate-900 mb-2">No ML Pipeline Results Found</h2>
                    <p class="text-secondary mb-6 max-w-md mx-auto">The ML pipeline results file (ml-results.json) could not be loaded. You must run the ML pipeline training script first.</p>
                    <button onclick="window.retrainML()" class="bg-emerald-600 text-white border-2 border-slate-900 px-6 py-3 font-button text-button uppercase hover:shadow-[4px_4px_0px_0px_rgba(17,24,39,1)] active:translate-y-0.5 active:translate-x-0.5 transition-all inline-flex items-center gap-2" id="btn-retrain">
                        <span class="material-symbols-outlined">build</span> Run ML Pipeline & Retrain
                    </button>
                </div>
            `;
        }
    }
}

async function retrainML() {
    const btn = el('btn-retrain');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-[18px]">sync</span> RETRAINING...`;
    }
    
    try {
        const res = await fetch('/api/retrain', { method: 'POST' });
        const json = await res.json();
        if (json.success) {
            alert('Model retraining complete! Reloading results...');
            await renderML();
        } else {
            throw new Error(json.error || 'Retraining failed');
        }
    } catch (e) {
        console.error(e);
        alert('Error retraining model: ' + e.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml || `<span class="material-symbols-outlined text-[18px]">build</span> RETRAIN MODEL`;
        }
    }
}

window.renderML = renderML;
window.retrainML = retrainML;

// Bootstrap
init();
