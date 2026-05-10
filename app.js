const db = null;

const state = {
  rows: [],
  config: { jumlah_orang: 0, setting_ac: 24, kondisi: "AC Menyala", catatan: "-" },
  currentField: "suhu",
  presentationMode: true,
  demoMode: false,
  charts: { main: null, corr: null },
  counts: new Map()
};

const FIELD_META = {
  suhu: { label: "Suhu", color: "#36d399", unit: "\u00B0C" },
  kelembaban: { label: "RH", color: "#6bb7ff", unit: "%" },
  heat_index: { label: "Heat index", color: "#ff6b6b", unit: "\u00B0C" },
  comfort_index: { label: "Comfort index", color: "#f5b84b", unit: "%" }
};

const el = (id) => document.getElementById(id);
const num = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const avg = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const fmtTime = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleTimeString("id-ID", { hour12: false });
};

function toast(message, type = "info") {
  const node = el("toast");
  if (!node) return;
  node.textContent = message;
  node.className = `toast show ${type}`;
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => { node.className = "toast"; }, 3200);
}

function inlineMsg(id, text) {
  const node = el(id);
  if (!node) return;
  node.textContent = text;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 1400);
}

function animateValue(id, end, options = {}) {
  const node = el(id);
  if (!node) return;
  const duration = options.duration ?? 900;
  const decimals = options.decimals ?? 0;
  const start = state.counts.get(id) ?? num(node.textContent, 0);
  if (Math.abs(start - end) < 0.001) return;
  state.counts.set(id, end);
  let startTime = null;
  const step = (timestamp) => {
    startTime ??= timestamp;
    const progress = Math.min((timestamp - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = (start + (end - start) * eased).toFixed(decimals);
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setConnection(status, message) {
  const dot = el("dot");
  if (dot) dot.className = `status-dot ${status}`;
  if (el("dbStatus")) el("dbStatus").textContent = message;
}

async function init() {
  applyTheme();
  updateClock();
  setInterval(updateClock, 1000);
  bindAmbientMotion();

  await loadConfig();
  await loadData();
  setupRealtime();
}

async function loadConfig() {
  const { data, error } = await apiRequest("/api/admin_config");
  if (error) {
    toast(`Config gagal dimuat: ${error.message}`, "error");
    return;
  }
  if (data) {
    state.config = {
      jumlah_orang: num(data.jumlah_orang, 0),
      setting_ac: num(data.setting_ac, 24),
      kondisi: data.kondisi || "AC Menyala",
      catatan: data.catatan || "-"
    };
  }
  syncConfigUI();
}

async function loadData() {
  setConnection("pending", "Mengambil data");
  const { data, error } = await apiRequest("/api/sensor_data");
  if (error) {
    activateDemoMode(`Supabase gagal: ${error.message}`);
    return;
  }
  state.rows = data || [];
  
  // Always use real data from the database, even if it's old
  setConnection("ok", "Supabase aktif");
  animateValue("totalRec", state.rows.length);
  renderDashboard();
}

function setupRealtime() {
  return;
}

async function apiRequest(path, options = {}) {
  try {
    const response = await fetch(path, {
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { data: null, error: { message: payload.error || `HTTP ${response.status}` } };
    }
    return { data: payload.data ?? null, error: null };
  } catch (error) {
    return { data: null, error: { message: error.message || "API tidak tersedia" } };
  }
}

function activateDemoMode(reason) {
  state.demoMode = true;
  const now = Date.now();
  state.config = { jumlah_orang: 28, setting_ac: 24, kondisi: "AC Menyala", catatan: "Mode demo" };
  state.rows = Array.from({ length: 36 }, (_, index) => {
    const phase = index / 5;
    const suhu = 25.6 + Math.sin(phase) * 0.9 + index * 0.018;
    const kelembaban = 56 + Math.cos(phase * 0.8) * 5;
    const setting_ac = 24;
    const deviasi = suhu - setting_ac;
    const heat_index = suhu + Math.max(0, (kelembaban - 55) * 0.035);
    const comfort_index = Math.max(0, Math.min(100, 88 - Math.abs(deviasi) * 12 - Math.max(0, kelembaban - 60) * 0.9));
    const createdAt = new Date(now - (35 - index) * 60000).toISOString();
    return {
      tanggal: createdAt.slice(0, 10),
      waktu: fmtTime(createdAt),
      created_at: createdAt,
      suhu,
      kelembaban,
      heat_index,
      deviasi,
      comfort_index,
      jumlah_orang: 22 + (index % 9),
      setting_ac,
      kondisi: state.config.kondisi,
      catatan: reason,
      status: comfort_index >= 70 ? "Optimal" : "Marginal"
    };
  });
  setConnection("pending", `Mode demo (${reason})`);
  syncConfigUI();
  animateValue("totalRec", state.rows.length);
  renderDashboard();
}

function syncConfigUI() {
  const { jumlah_orang, setting_ac, kondisi } = state.config;
  if (el("orgDisplay")) el("orgDisplay").textContent = jumlah_orang;
  if (el("acDisplay")) el("acDisplay").textContent = setting_ac;
  if (el("opMode")) el("opMode").textContent = kondisi;
  if (el("peopleNow")) el("peopleNow").textContent = jumlah_orang;
  if (el("targetNow")) el("targetNow").textContent = setting_ac;
  document.querySelectorAll(".segment button").forEach((button) => {
    button.classList.toggle("active", button.textContent.includes(kondisi.includes("Mati") ? "Off" : kondisi.includes("Jendela") ? "Vent" : "On"));
  });
}

function renderEmpty() {
  ["suhu", "lem", "ci", "ringVal", "sMax", "sMin", "sAvg"].forEach((id) => {
    if (el(id)) el(id).textContent = "0";
  });
  if (el("reko")) el("reko").textContent = "Belum ada data sensor untuk dianalisis.";
  if (el("systemHealth")) el("systemHealth").textContent = "Tambahkan data sensor untuk membuka analisis stabilitas.";
  renderLogTable();
  renderCharts();
}

function renderDashboard() {
  if (!state.rows.length) {
    renderEmpty();
    return;
  }
  const latest = state.rows[state.rows.length - 1];
  const suhu = num(latest.suhu);
  const rh = num(latest.kelembaban);
  const comfort = num(latest.comfort_index);
  const target = num(latest.setting_ac, state.config.setting_ac);
  const heatIndex = num(latest.heat_index, suhu);
  const deviation = Number.isFinite(Number(latest.deviasi)) ? num(latest.deviasi) : suhu - target;
  const trend = getTrend(state.rows.map((row) => num(row.suhu)).filter(Number.isFinite));

  animateValue("suhu", suhu, { decimals: 1, duration: 1100 });
  animateValue("lem", rh, { decimals: 0, duration: 1000 });
  animateValue("ci", comfort, { decimals: 0, duration: 1000 });
  animateValue("ringVal", suhu, { decimals: 0, duration: 1000 });
  animateValue("totalRec", state.rows.length);

  el("hi").textContent = heatIndex.toFixed(1);
  el("ac").textContent = target.toFixed(0);
  el("dev").textContent = `${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}\u00B0`;
  el("dev").className = Math.abs(deviation) <= 1 ? "text-good" : deviation > 0 ? "text-bad" : "text-cool";
  el("lastUpdate").textContent = fmtTime(latest.created_at);
  if (el("peopleNow")) el("peopleNow").textContent = num(latest.jumlah_orang, state.config.jumlah_orang);
  if (el("targetNow")) el("targetNow").textContent = target.toFixed(0);
  if (el("opMode")) el("opMode").textContent = latest.kondisi || state.config.kondisi;
  updateMicrocopy({ rh, comfort, deviation, trend });
  if (state.demoMode) setConnection("pending", "Mode demo offline");
  else updateFreshness(latest.created_at);

  updateRing(suhu);
  updateComfort(comfort, latest.status);
  updateHumidityBar(rh);
  updateRecommendation({ suhu, comfort, deviation, target, rh });
  updateStats();
  renderLogTable();
  renderCharts();
}

function updateMicrocopy({ rh, comfort, deviation, trend }) {
  const action = Math.abs(deviation) <= 1
    ? "Setpoint tepat"
    : deviation > 1
      ? "Turunkan AC 1-2\u00B0C"
      : "Naikkan AC 1\u00B0C";
  const rhText = rh < 40 ? "RH rendah" : rh > 60 ? "RH tinggi" : "RH nyaman";
  const trendText = trend > 0.15 ? "Suhu naik" : trend < -0.15 ? "Suhu turun" : "Suhu stabil";
  if (el("priorityAction")) el("priorityAction").textContent = action;
  if (el("rhSignal")) el("rhSignal").textContent = `${rhText} ${rh.toFixed(0)}%`;
  if (el("trendSignal")) el("trendSignal").textContent = trendText;
  if (el("ciState")) {
    el("ciState").textContent = comfort >= 70
      ? "Kondisi nyaman. Pertahankan setpoint dan pantau deviasi."
      : comfort >= 40
        ? "Kondisi marginal. Perlu koreksi kecil sebelum kelas padat."
        : "Kondisi kritis. Prioritaskan pendinginan dan ventilasi.";
  }
  if (el("rhStateCard")) {
    el("rhStateCard").textContent = rh < 40
      ? "Udara cenderung kering. Hindari setpoint terlalu rendah."
      : rh > 60
        ? "RH melewati zona ideal. Cek ventilasi dan drainase AC."
        : "RH berada dalam rentang ideal 40-60%.";
  }
  if (el("chartSummary")) el("chartSummary").textContent = `${trendText} dalam 6 sampel`;
}

function getTrend(values) {
  if (values.length < 6) return 0;
  const recent = values.slice(-6);
  return recent[recent.length - 1] - recent[0];
}

function updateFreshness(createdAt) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return;
  const ageMs = Date.now() - timestamp;
  if (ageMs > 5 * 60 * 1000) {
    setConnection("error", `Data stale ${formatAge(ageMs)}`);
  } else if (ageMs > 2 * 60 * 1000) {
    setConnection("pending", `Data ${formatAge(ageMs)} lalu`);
  } else {
    setConnection("ok", "Live sync aktif");
  }
}

function isStale(createdAt, limitMs) {
  const timestamp = new Date(createdAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp > limitMs;
}

function formatAge(ageMs) {
  const minutes = Math.max(1, Math.round(ageMs / 60000));
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} jam`;
  return `${Math.round(hours / 24)} hari`;
}

function updateRing(value) {
  const min = 16;
  const max = 38;
  const pct = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const offset = 314 - pct * 314;
  const color = value <= 26 ? "#36d399" : value <= 31 ? "#f5b84b" : "#ff6b6b";
  const ring = el("suhuRing");
  if (ring) {
    ring.style.strokeDashoffset = String(offset);
    ring.style.stroke = color;
  }
  const glow = el("ambient-glow");
  if (glow) glow.style.background = `rgba(${hexToRgb(color)}, 0.17)`;
}

function updateComfort(value, status) {
  const color = value >= 70 ? "#36d399" : value >= 40 ? "#f5b84b" : "#ff6b6b";
  const bar = el("ciBar");
  if (bar) {
    bar.style.width = `${Math.max(0, Math.min(100, value))}%`;
    bar.style.background = color;
  }
  const badge = el("sts");
  if (badge) {
    badge.textContent = status || (value >= 70 ? "Optimal" : value >= 40 ? "Marginal" : "Kritis");
    badge.className = `badge ${value >= 70 ? "text-good" : value >= 40 ? "text-warn" : "text-bad"}`;
  }
}

function updateHumidityBar(rh) {
  const color = (rh >= 40 && rh <= 60) ? "#36d399" : ((rh > 30 && rh < 70) ? "#f5b84b" : "#ff6b6b");
  const bar = el("rhBar");
  if (bar) {
    bar.style.width = `${Math.max(0, Math.min(100, rh))}%`;
    bar.style.background = color;
  }
}

function updateRecommendation({ suhu, comfort, deviation, target, rh }) {
  let message;
  if (comfort >= 80 && Math.abs(deviation) <= 1) {
    message = `<strong>Optimal.</strong> Suhu ${suhu.toFixed(1)}\u00B0C dekat target ${target.toFixed(0)}\u00B0C. Pertahankan setelan AC dan pantau stabilitas RH ${rh.toFixed(0)}%.`;
  } else if (deviation > 2 && target <= 16) {
    message = `<strong>Kompensasi pendinginan perlu.</strong> Suhu berada ${deviation.toFixed(1)}\u00B0C di atas target, sementara AC sudah di batas bawah. Kurangi beban penghuni atau cek kapasitas pendinginan.`;
  } else if (deviation > 2) {
    message = `<strong>Kompensasi pendinginan perlu.</strong> Suhu berada ${deviation.toFixed(1)}\u00B0C di atas target. Turunkan setpoint AC 1-2\u00B0C atau kurangi beban penghuni.`;
  } else if (deviation < -2) {
    message = `<strong>Terlalu dingin.</strong> Suhu berada ${Math.abs(deviation).toFixed(1)}\u00B0C di bawah target. Naikkan AC 1\u00B0C untuk efisiensi energi.`;
  } else if (rh < 40 || rh > 70) {
    message = `<strong>Kelembaban perlu dikoreksi.</strong> RH ${rh.toFixed(0)}% keluar dari zona nyaman. Ventilasi dan drainase AC perlu dicek.`;
  } else {
    message = `<strong>Marginal.</strong> Sistem masih terkendali, namun comfort index ${comfort.toFixed(0)}% belum stabil. Lanjutkan observasi 10-15 menit.`;
  }
  el("reko").innerHTML = message;
}

function updateStats() {
  const suhuValues = state.rows.map((row) => Number(row.suhu)).filter(Number.isFinite);
  if (!suhuValues.length) return;
  const min = Math.min(...suhuValues);
  const max = Math.max(...suhuValues);
  const mean = avg(suhuValues);
  animateValue("sMin", min, { decimals: 1 });
  animateValue("sMax", max, { decimals: 1 });
  animateValue("sAvg", mean, { decimals: 1 });

  const grouped = new Map();
  state.rows.forEach((row) => {
    const people = Number(row.jumlah_orang);
    const temp = Number(row.suhu);
    if (!Number.isFinite(people) || !Number.isFinite(temp)) return;
    grouped.set(people, [...(grouped.get(people) || []), temp]);
  });
  const keys = [...grouped.keys()].sort((a, b) => a - b);
  if (keys.length >= 2 && keys[0] !== keys[keys.length - 1]) {
    const delta = (avg(grouped.get(keys[keys.length - 1])) - avg(grouped.get(keys[0]))) / (keys[keys.length - 1] - keys[0]);
    el("deltaT").textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(3)}`;
  } else {
    el("deltaT").textContent = "0";
  }

  const recent = suhuValues.slice(-12);
  const spread = recent.length ? Math.max(...recent) - Math.min(...recent) : 0;
  el("systemHealth").textContent = spread <= 1.2
    ? `Stabil: fluktuasi 12 sampel terakhir ${spread.toFixed(1)}\u00B0C.`
    : `Fluktuatif: rentang 12 sampel terakhir ${spread.toFixed(1)}\u00B0C. Cek siklus AC atau kepadatan ruangan.`;
}

function renderLogTable() {
  const body = el("logTable");
  if (!body) return;
  const rows = state.rows.slice(-35).reverse();
  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9">Belum ada data.</td></tr>`;
    return;
  }
  body.innerHTML = rows.map((row) => {
    const deviation = Number.isFinite(Number(row.deviasi)) ? num(row.deviasi) : num(row.suhu) - num(row.setting_ac, state.config.setting_ac);
    const comfort = num(row.comfort_index);
    return `<tr>
      <td>${fmtTime(row.created_at)}</td>
      <td>${formatCell(row.suhu, 1)}&deg;</td>
      <td>${formatCell(row.kelembaban, 0)}%</td>
      <td>${formatCell(row.heat_index, 1)}&deg;</td>
      <td class="${Math.abs(deviation) <= 1 ? "text-good" : deviation > 0 ? "text-bad" : "text-cool"}">${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)}&deg;</td>
      <td class="${comfort >= 70 ? "text-good" : comfort >= 40 ? "text-warn" : "text-bad"}">${formatCell(comfort, 0)}%</td>
      <td>${row.jumlah_orang ?? "-"}</td>
      <td>${row.setting_ac ?? state.config.setting_ac}&deg;</td>
      <td>${row.status || "-"}</td>
    </tr>`;
  }).join("");
}

function renderCharts() {
  if (!window.Chart) {
    renderCanvasFallbacks();
    return;
  }
  const isLight = document.body.classList.contains("light-mode");
  const textColor = isLight ? "rgba(17,27,22,0.68)" : "rgba(242,255,249,0.68)";
  const gridColor = isLight ? "rgba(17,27,22,0.08)" : "rgba(242,255,249,0.08)";
  Chart.defaults.color = textColor;
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";

  const rows = state.rows.slice(-48);
  const meta = FIELD_META[state.currentField];
  const labels = rows.map((row) => fmtTime(row.created_at));
  const values = rows.map((row) => num(row[state.currentField]));

  state.charts.main?.destroy();
  const mainCanvas = el("mainChart");
  if (mainCanvas) {
    const ctx = mainCanvas.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 0, 320);
    gradient.addColorStop(0, `${meta.color}66`);
    gradient.addColorStop(1, `${meta.color}00`);
    state.charts.main = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: meta.label, data: values, borderColor: meta.color, backgroundColor: gradient, fill: true, tension: 0.38, pointRadius: 0, pointHoverRadius: 5, borderWidth: 3 }] },
      options: chartOptions(gridColor, meta)
    });
  }

  const grouped = new Map();
  state.rows.forEach((row) => {
    const people = Number(row.jumlah_orang);
    const temp = Number(row.suhu);
    if (!Number.isFinite(people) || !Number.isFinite(temp)) return;
    grouped.set(people, [...(grouped.get(people) || []), temp]);
  });
  const keys = [...grouped.keys()].sort((a, b) => a - b);
  state.charts.corr?.destroy();
  const corrCanvas = el("corrChart");
  if (corrCanvas) {
    state.charts.corr = new Chart(corrCanvas.getContext("2d"), {
      type: "line",
      data: { labels: keys, datasets: [{ label: "Suhu rata-rata", data: keys.map((key) => avg(grouped.get(key))), borderColor: "#6bb7ff", backgroundColor: "rgba(107,183,255,0.18)", fill: true, tension: 0.35, pointRadius: 4, borderWidth: 3 }] },
      options: chartOptions(gridColor, { label: "Suhu rata-rata", unit: "\u00B0C" })
    });
  }
}

function chartOptions(gridColor, meta) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { intersect: false, mode: "index" },
    plugins: {
      legend: { display: false },
      tooltip: {
        padding: 12,
        displayColors: false,
        callbacks: { label: (ctx) => `${meta.label}: ${Number(ctx.parsed.y).toFixed(1)}${meta.unit}` }
      }
    },
    scales: {
      x: { ticks: { maxTicksLimit: 7 }, grid: { color: gridColor } },
      y: { grid: { color: gridColor } }
    }
  };
}

async function saveConfig() {
  if (state.demoMode) {
    renderDashboard();
    return true;
  }
  const { error } = await apiRequest("/api/admin_config", {
    method: "POST",
    body: JSON.stringify({ id: 1, ...state.config })
  });
  if (error) {
    toast(`Config gagal disimpan: ${error.message}`, "error");
    return false;
  }
  return true;
}

async function adjOrg(change) {
  state.config.jumlah_orang = Math.max(0, state.config.jumlah_orang + change);
  syncConfigUI();
  if (await saveConfig()) inlineMsg("mOrg", "Tersimpan");
}

async function adjAC(change) {
  state.config.setting_ac = Math.min(30, Math.max(16, state.config.setting_ac + change));
  syncConfigUI();
  if (await saveConfig()) inlineMsg("mAC", "Tersimpan");
}

async function setKon(value, button) {
  state.config.kondisi = value;
  document.querySelectorAll(".segment button").forEach((node) => node.classList.remove("active"));
  button?.classList.add("active");
  if (await saveConfig()) inlineMsg("mKon", "Tersimpan");
}

async function kirimManual() {
  const latest = state.rows[state.rows.length - 1];
  if (!latest) {
    toast("Dataset kosong. Ambil data sensor dulu.", "error");
    return;
  }
  state.config.catatan = el("iCat")?.value || "-";
  await saveConfig();
  const payload = {
    tanggal: latest.tanggal,
    waktu: new Date().toLocaleTimeString("id-ID", { hour12: false }),
    suhu: latest.suhu,
    kelembaban: latest.kelembaban,
    heat_index: latest.heat_index,
    deviasi: num(latest.suhu) - state.config.setting_ac,
    comfort_index: latest.comfort_index,
    jumlah_orang: state.config.jumlah_orang,
    setting_ac: state.config.setting_ac,
    kondisi: state.config.kondisi,
    catatan: `${state.config.catatan} (manual)`,
    status: latest.status
  };
  if (state.demoMode) {
    state.rows.push({ ...payload, created_at: new Date().toISOString() });
    if (el("iCat")) el("iCat").value = "";
    animateValue("totalRec", state.rows.length);
    renderDashboard();
    toast("Telemetri demo ditambahkan", "ok");
    return;
  }
  const { error } = await apiRequest("/api/sensor_data", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  if (error) {
    toast(`Push gagal: ${error.message}`, "error");
    return;
  }
  if (el("iCat")) el("iCat").value = "";
  toast("Telemetri manual terkirim", "ok");
}

function setChart(field, button) {
  state.currentField = field;
  document.querySelectorAll(".tabs button").forEach((node) => node.classList.remove("active"));
  button?.classList.add("active");
  renderCharts();
}

function toggleMode() {
  state.presentationMode = !state.presentationMode;
  document.querySelectorAll(".pres-hide").forEach((node) => {
    node.style.display = state.presentationMode ? "none" : "block";
  });
  el("modeBtn").textContent = state.presentationMode ? "Buka Panel Kendali" : "Tutup Panel Kendali";
}

function toggleTheme() {
  const isLight = document.body.classList.toggle("light-mode");
  localStorage.setItem("theme", isLight ? "light" : "dark");
  el("themeBtn").textContent = isLight ? "Dark mode" : "Light mode";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isLight ? "#f7f1df" : "#07120f");
  renderCharts();
}

function renderCanvasFallbacks() {
  const rows = state.rows.slice(-48);
  const meta = FIELD_META[state.currentField];
  drawFallbackLine(el("mainChart"), rows.map((row) => num(row[state.currentField])), meta.color, meta.unit);

  const grouped = new Map();
  state.rows.forEach((row) => {
    const people = Number(row.jumlah_orang);
    const temp = Number(row.suhu);
    if (!Number.isFinite(people) || !Number.isFinite(temp)) return;
    grouped.set(people, [...(grouped.get(people) || []), temp]);
  });
  const keys = [...grouped.keys()].sort((a, b) => a - b);
  drawFallbackLine(el("corrChart"), keys.map((key) => avg(grouped.get(key))), "#6bb7ff", "\u00B0C");
}

function drawFallbackLine(canvas, values, color, unit) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * scale));
  canvas.height = Math.max(1, Math.floor(rect.height * scale));
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, rect.width, rect.height);
  const pad = 28;
  const width = Math.max(1, rect.width - pad * 2);
  const height = Math.max(1, rect.height - pad * 2);
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) {
    ctx.fillStyle = document.body.classList.contains("light-mode") ? "rgba(19,35,27,0.55)" : "rgba(242,255,249,0.55)";
    ctx.font = "600 13px IBM Plex Mono, monospace";
    ctx.fillText("Menunggu data chart", pad, pad + 10);
    return;
  }
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  const span = max - min || 1;
  ctx.strokeStyle = document.body.classList.contains("light-mode") ? "rgba(19,35,27,0.09)" : "rgba(242,255,249,0.09)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const y = pad + (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(pad + width, y);
    ctx.stroke();
  }
  const gradient = ctx.createLinearGradient(0, pad, 0, pad + height);
  gradient.addColorStop(0, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  ctx.beginPath();
  finite.forEach((value, index) => {
    const x = pad + (width * index) / (finite.length - 1);
    const y = pad + height - ((value - min) / span) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad + width, pad + height);
  ctx.lineTo(pad, pad + height);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  finite.forEach((value, index) => {
    const x = pad + (width * index) / (finite.length - 1);
    const y = pad + height - ((value - min) / span) * height;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.fillStyle = document.body.classList.contains("light-mode") ? "rgba(19,35,27,0.66)" : "rgba(242,255,249,0.66)";
  ctx.font = "700 12px IBM Plex Mono, monospace";
  ctx.fillText(`${max.toFixed(1)}${unit}`, pad, pad - 8);
  ctx.fillText(`${min.toFixed(1)}${unit}`, pad, pad + height + 18);
}

function applyTheme() {
  const savedTheme = localStorage.getItem("theme");
  const isLight = savedTheme ? savedTheme === "light" : true;
  document.body.classList.toggle("light-mode", isLight);
  if (el("themeBtn")) el("themeBtn").textContent = isLight ? "Dark mode" : "Light mode";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isLight ? "#f7f1df" : "#07120f");
}

function toggleHistory() {
  const modal = el("historyModal");
  const active = !modal.classList.contains("active");
  modal.classList.toggle("active", active);
  modal.setAttribute("aria-hidden", String(!active));
}

function exportCSV() {
  if (!state.rows.length) {
    toast("Tidak ada data untuk diekspor.", "error");
    return;
  }
  const header = ["Tanggal", "Waktu", "Suhu", "RH", "HeatIndex", "Deviasi", "CI", "Orang", "Target", "Status"];
  const lines = state.rows.map((row) => [row.tanggal, row.waktu, row.suhu, row.kelembaban, row.heat_index, row.deviasi, row.comfort_index, row.jumlah_orang, row.setting_ac, row.status].map(csvSafe).join(","));
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sensor_suhu_${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function updateClock() {
  const now = new Date();
  el("clk").textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":");
}

function bindAmbientMotion() {
  document.addEventListener("mousemove", (event) => {
    if (window.innerWidth < 900) return;
    const glow = el("ambient-glow");
    if (!glow) return;
    const x = (event.clientX / window.innerWidth - 0.5) * 36;
    const y = (event.clientY / window.innerHeight - 0.5) * 28;
    glow.style.transform = `translate(${x}px, ${y}px)`;
  }, { passive: true });
}

function formatCell(value, decimals) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : "-";
}

function csvSafe(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return `${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}`;
}

window.adjOrg = adjOrg;
window.adjAC = adjAC;
window.setKon = setKon;
window.kirimManual = kirimManual;
window.setChart = setChart;
window.toggleMode = toggleMode;
window.toggleTheme = toggleTheme;
window.toggleHistory = toggleHistory;
window.exportCSV = exportCSV;

init();
