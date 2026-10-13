/* =============================================================
   StudentLife Insights — script.js
   Handles: data loading, filter building, KPI computation,
            and all Chart.js visualizations.
   Architecture:
     1. Constants & colour palettes
     2. State management
     3. Data loading (fetch)
     4. Filter building (dynamic)
     5. Data filtering
     6. KPI rendering
     7. Chart helpers
     8. Individual chart render functions
     9. Master update function
     10. Sidebar toggle
     11. Error display
     12. Theme management
     13. Initialization
   ============================================================= */

/* ── 1. CONSTANTS & COLOUR PALETTES ─────────────────────────── */

const COLORS = {
  blue:   ['#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#1d4ed8','#2563eb'],
  purple: ['#8b5cf6','#a78bfa','#c4b5fd','#ddd6fe','#6d28d9','#7c3aed'],
  orange: ['#f97316','#fb923c','#fdba74','#fed7aa','#c2410c','#ea580c'],
  green:  ['#22c55e','#4ade80','#86efac','#bbf7d0','#15803d','#16a34a'],
  mixed:  ['#3b82f6','#8b5cf6','#f97316','#22c55e','#ef4444','#14b8a6','#f59e0b','#ec4899','#6366f1','#84cc16'],
  soft:   ['#6366f1','#8b5cf6','#ec4899','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#ef4444','#64748b'],
};

const CHART_FONT = { family: '-apple-system, "Segoe UI", system-ui, sans-serif', size: 11 };

const KPI_DEFS = [
  { id: 'kpiStudents',    label: 'Total Students',         icon: '👥', theme: 'kpi-blue',   sub: 'in filtered dataset' },
  { id: 'kpiCgpa',        label: 'Average CGPA',           icon: '🎓', theme: 'kpi-blue',   sub: 'on 4.0 scale' },
  { id: 'kpiSleep',       label: 'Avg Sleep Duration',     icon: '🌙', theme: 'kpi-purple', sub: 'hours/weekday' },
  { id: 'kpiScreen',      label: 'Avg Daily Screen Time',  icon: '📱', theme: 'kpi-orange', sub: 'hours/day' },
  { id: 'kpiSleepQ',      label: 'Avg Sleep Quality',      icon: '✨', theme: 'kpi-teal',   sub: 'score out of 10' },
  { id: 'kpiAttendance',  label: 'Avg Class Attendance',   icon: '🏫', theme: 'kpi-green',  sub: 'percent' },
];

/* ── 2. STATE ────────────────────────────────────────────────── */

let allData = [];            // raw full dataset
let filteredData = [];       // current filtered slice
const chartInstances = {};   // registry to prevent duplicates

/* ── 3. DATA LOADING ─────────────────────────────────────────── */

/**
 * Load student_data.json via fetch, initialise the dashboard.
 */
async function loadData() {
  try {
    const resp = await fetch('student_data.json');
    if (!resp.ok) throw new Error(`HTTP ${resp.status} — ${resp.statusText}`);
    const json = await resp.json();
    allData = json;
    filteredData = [...allData];
    buildFilters();
    buildKPICards();
    updateDashboard();
  } catch (err) {
    showError(err);
  }
}

/* ── 4. FILTER BUILDING ──────────────────────────────────────── */

/**
 * Definitions for each filter: { id, label, field }.
 * Options are derived dynamically from the dataset.
 */
const FILTER_DEFS = [
  { id: 'fGender',    label: 'Gender',          field: 'gender' },
  { id: 'fMajor',     label: 'Major Category',  field: 'major_category' },
  { id: 'fYear',      label: 'Year of Study',   field: 'year_of_study' },
  { id: 'fResidence', label: 'Residence Type',  field: 'residence_type' },
  { id: 'fChronotype',label: 'Chronotype',      field: 'chronotype' },
  { id: 'fSemester',  label: 'Semester Type',   field: 'semester_type' },
  { id: 'fDevice',    label: 'Primary Device',  field: 'primary_device' },
];

/**
 * Build dynamic filter <select> elements from dataset values.
 */
function buildFilters() {
  const container = document.getElementById('filterContainer');
  container.innerHTML = '';

  FILTER_DEFS.forEach(def => {
    // Collect unique non-null values, sort them
    const values = [...new Set(
      allData.map(d => d[def.field]).filter(v => v !== null && v !== undefined && v !== '')
    )].sort((a, b) => {
      // Numeric sort for year_of_study
      if (typeof a === 'number') return a - b;
      return String(a).localeCompare(String(b));
    });

    const wrap = document.createElement('div');
    wrap.className = 'filter-group';

    const label = document.createElement('label');
    label.setAttribute('for', def.id);
    label.textContent = def.label;

    const select = document.createElement('select');
    select.id = def.id;
    select.innerHTML = `<option value="">All</option>` +
      values.map(v => `<option value="${v}">${v}</option>`).join('');

    select.addEventListener('change', () => {
      if (select.value) select.classList.add('active');
      else              select.classList.remove('active');
      applyFilters();
    });

    wrap.appendChild(label);
    wrap.appendChild(select);
    container.appendChild(wrap);
  });
}

/* ── 5. DATA FILTERING ───────────────────────────────────────── */

/**
 * Read all filter values and narrow filteredData, then re-render.
 */
function applyFilters() {
  filteredData = allData.filter(d => {
    return FILTER_DEFS.every(def => {
      const el = document.getElementById(def.id);
      if (!el || !el.value) return true;
      return String(d[def.field]) === String(el.value);
    });
  });

  // Update filter status indicator
  const activeCount = FILTER_DEFS.filter(def => {
    const el = document.getElementById(def.id);
    return el && el.value;
  }).length;

  const statusEl = document.getElementById('filterStatus');
  if (activeCount > 0) {
    statusEl.textContent = `${activeCount} filter${activeCount > 1 ? 's' : ''} active · ${filteredData.length} students`;
  } else {
    statusEl.textContent = '';
  }

  updateDashboard();
}

/**
 * Reset all filters and re-render.
 */
function resetFilters() {
  FILTER_DEFS.forEach(def => {
    const el = document.getElementById(def.id);
    if (el) { el.value = ''; el.classList.remove('active'); }
  });
  document.getElementById('filterStatus').textContent = '';
  filteredData = [...allData];
  updateDashboard();
}

/* ── 6. KPI RENDERING ───────────────────────────────────────── */

/**
 * Create KPI card DOM structure on first load.
 */
function buildKPICards() {
  const grid = document.getElementById('kpiGrid');
  grid.innerHTML = '';
  KPI_DEFS.forEach(kpi => {
    grid.innerHTML += `
      <div class="kpi-card ${kpi.theme}" id="${kpi.id}">
        <span class="kpi-icon">${kpi.icon}</span>
        <span class="kpi-label">${kpi.label}</span>
        <span class="kpi-value" id="${kpi.id}Val">—</span>
        <span class="kpi-sub">${kpi.sub}</span>
      </div>`;
  });
}

/**
 * Compute and display KPI values from filteredData.
 */
function renderKPIs(data) {
  const n = data.length;

  const avg = (arr, field) => {
    const vals = arr.map(d => d[field]).filter(v => v !== null && v !== undefined);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  const set = (id, val, fmt) => {
    const el = document.getElementById(id + 'Val');
    if (el) el.textContent = val !== null ? fmt(val) : '—';
  };

  set('kpiStudents',   n,                          v => v.toLocaleString());
  set('kpiCgpa',       avg(data, 'cgpa'),           v => v.toFixed(2));
  set('kpiSleep',      avg(data, 'avg_sleep_hours_weekday'), v => v.toFixed(1) + ' h');
  set('kpiScreen',     avg(data, 'daily_screen_time_hours'), v => v.toFixed(1) + ' h');
  set('kpiSleepQ',     avg(data, 'sleep_quality_score'),     v => v.toFixed(1) + ' / 10');
  set('kpiAttendance', avg(data, 'class_attendance_percent'),v => v.toFixed(1) + '%');

  // Update header badge
  const badge = document.getElementById('dataCount');
  if (badge) badge.textContent = `${n.toLocaleString()} student${n !== 1 ? 's' : ''} shown`;
}

/* ── 7. CHART HELPERS ───────────────────────────────────────── */

/**
 * Destroy an existing chart instance if it exists, then create new.
 */
function makeChart(id, config) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
  const canvas = document.getElementById(id);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const instance = new Chart(ctx, config);
  chartInstances[id] = instance;
  return instance;
}

/**
 * Read a CSS custom property value from :root / html element.
 * Returns the trimmed string value.
 */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Return a default tooltip + interaction config (theme-aware) */
function defaultPlugins(title) {
  return {
    legend: { display: false },
    tooltip: {
      backgroundColor: cssVar('--tooltip-bg')  || '#1f2328',
      titleColor:  '#e2e8f0',
      bodyColor:   cssVar('--tooltip-body') || '#d1d5db',
      padding: 10,
      cornerRadius: 6,
    },
    title: { display: false, text: title },
  };
}

/** Compute mean of a field for grouped data */
function groupMean(data, groupField, valueField) {
  const groups = {};
  data.forEach(d => {
    const key = d[groupField];
    if (key === null || key === undefined || key === '') return;
    const val = d[valueField];
    if (val === null || val === undefined) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(val);
  });
  return Object.entries(groups).map(([k, vals]) => ({
    label: k,
    mean: vals.reduce((s, v) => s + v, 0) / vals.length,
    count: vals.length,
  }));
}

/** Count occurrences of each unique value of a field */
function countByField(data, field) {
  const counts = {};
  data.forEach(d => {
    const v = d[field];
    if (v === null || v === undefined || v === '') return;
    counts[v] = (counts[v] || 0) + 1;
  });
  return counts;
}

/** Scatter data: pick two numeric fields, return [{x,y}] */
function scatterXY(data, xField, yField) {
  return data
    .filter(d => d[xField] !== null && d[xField] !== undefined && d[yField] !== null && d[yField] !== undefined)
    .map(d => ({ x: d[xField], y: d[yField] }));
}

/**
 * Returns axis style object reading live CSS tokens.
 * Must be called as a function (not stored as a const) so it
 * picks up the current theme at chart-render time.
 */
function axisStyle() {
  const grid  = cssVar('--grid-line') || '#f3f4f6';
  const ticks = cssVar('--tick-color') || '#9ca3af';
  return {
    grid:  { color: grid },
    ticks: { font: CHART_FONT, color: ticks },
  };
}

/** Convenience alias so existing spread syntax still works */
function AS() { return axisStyle(); }

/* ── 8. INDIVIDUAL CHART RENDER FUNCTIONS ────────────────────── */

/* ─── ACADEMIC ─── */

function renderCgpaDistChart(data) {
  const cgpaVals = data.map(d => d.cgpa).filter(v => v !== null && v !== undefined);

  // Build histogram bins at 0.25-unit width from 1.5 to 4.0
  const binData = [];
  const step = 0.25;
  for (let b = 1.5; b < 4.1; b = Math.round((b + step) * 100) / 100) {
    const lo = b, hi = Math.round((b + step) * 100) / 100;
    binData.push({ label: lo.toFixed(2) + '–' + hi.toFixed(2), count: cgpaVals.filter(v => v >= lo && v < hi).length });
  }

  makeChart('cgpaDistChart', {
    type: 'bar',
    data: {
      labels: binData.map(b => b.label),
      datasets: [{ data: binData.map(b => b.count), backgroundColor: COLORS.blue[0], borderRadius: 4, borderSkipped: false }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins('CGPA Distribution'), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'CGPA Range', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'Count', font: CHART_FONT, color: '#6b7280' }, beginAtZero: true },
      },
    },
  });
}

function renderCgpaByYearChart(data) {
  const grouped = groupMean(data, 'year_of_study', 'cgpa').sort((a, b) => a.label - b.label);
  makeChart('cgpaByYearChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => `Year ${g.label}`),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(3)), backgroundColor: COLORS.blue, borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg CGPA: ${ctx.raw}  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: AS(),
        y: { ...AS(), min: 2, max: 4, title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderCgpaByMajorChart(data) {
  const grouped = groupMean(data, 'major_category', 'cgpa').sort((a, b) => b.mean - a.mean);
  makeChart('cgpaByMajorChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => g.label),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(3)), backgroundColor: COLORS.mixed, borderRadius: 5 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg CGPA: ${ctx.raw}  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: { ...AS(), min: 2, max: 4, title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), ticks: { font: { ...CHART_FONT, size: 10 }, color: cssVar('--tick-color') || '#9ca3af' } },
      },
    },
  });
}

function renderStudyVsCgpaChart(data) {
  const pts = scatterXY(data, 'weekly_study_hours', 'cgpa');
  makeChart('studyVsCgpaChart', {
    type: 'scatter',
    data: { datasets: [{ data: pts, backgroundColor: COLORS.blue[0] + '99', pointRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Study: ${ctx.raw.x}h/wk · CGPA: ${ctx.raw.y}` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Weekly Study Hours', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderAttendanceVsCgpaChart(data) {
  const pts = scatterXY(data, 'class_attendance_percent', 'cgpa');
  makeChart('attendanceVsCgpaChart', {
    type: 'scatter',
    data: { datasets: [{ data: pts, backgroundColor: COLORS.blue[2] + 'cc', pointRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Attendance: ${ctx.raw.x}% · CGPA: ${ctx.raw.y}` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Attendance %', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderCgpaByChronotypeChart(data) {
  const grouped = groupMean(data, 'chronotype', 'cgpa').sort((a, b) => b.mean - a.mean);
  const colors = { 'Early Bird': COLORS.orange[0], 'Intermediate': COLORS.blue[0], 'Night Owl': COLORS.purple[0] };
  makeChart('cgpaByChronotypeChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => g.label),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(3)), backgroundColor: grouped.map(g => colors[g.label] || COLORS.mixed[4]), borderRadius: 6 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), legend: { display: false }, tooltip: { callbacks: { label: ctx => `Avg CGPA: ${ctx.raw}  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: AS(),
        y: { ...AS(), min: 2, max: 4, title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

/* ─── SLEEP ─── */

function renderSleepByYearChart(data) {
  const grouped = groupMean(data, 'year_of_study', 'avg_sleep_hours_weekday').sort((a, b) => a.label - b.label);
  makeChart('sleepByYearChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => `Year ${g.label}`),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(2)), backgroundColor: COLORS.purple, borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg Sleep: ${ctx.raw}h  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: AS(),
        y: { ...AS(), beginAtZero: false, min: 4, title: { display: true, text: 'Hours', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderSleepQualityDistChart(data) {
  const counts = {};
  for (let i = 1; i <= 10; i++) counts[i] = 0;
  data.forEach(d => { if (d.sleep_quality_score !== null) counts[Math.round(d.sleep_quality_score)]++; });
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  makeChart('sleepQualityDistChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLORS.purple[0], borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Sleep Quality Score', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderBedtimeDistChart(data) {
  // avg_bedtime_hour is a decimal hour (e.g. 22.3 = 22:18, 1.6 = 01:36)
  // Group into hour buckets 19–3
  const ORDER = [19, 20, 21, 22, 23, 0, 1, 2, 3];
  const counts = {};
  ORDER.forEach(h => counts[h] = 0);
  data.forEach(d => {
    if (d.avg_bedtime_hour === null) return;
    const h = Math.floor(d.avg_bedtime_hour) % 24;
    if (counts[h] !== undefined) counts[h]++;
  });
  const labels = ORDER.map(h => h === 0 ? '00:00' : h < 10 ? `0${h}:00` : `${h}:00`);
  makeChart('bedtimeDistChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: ORDER.map(h => counts[h]), backgroundColor: COLORS.purple[1], borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Bedtime (hour)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderSleepVsCgpaChart(data) {
  const pts = scatterXY(data, 'avg_sleep_hours_weekday', 'cgpa');
  makeChart('sleepVsCgpaChart', {
    type: 'scatter',
    data: { datasets: [{ data: pts, backgroundColor: COLORS.purple[0] + '99', pointRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Sleep: ${ctx.raw.x}h · CGPA: ${ctx.raw.y}` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Sleep Hours / Weekday', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderWeekendDeltaChart(data) {
  // Histogram of weekend_sleep_delta_hours in 0.5-h bins from -2 to 5
  const step = 0.5;
  const binData = [];
  for (let b = -2; b < 5; b = Math.round((b + step) * 10) / 10) {
    const lo = b, hi = Math.round((b + step) * 10) / 10;
    const count = data.filter(d => d.weekend_sleep_delta_hours !== null && d.weekend_sleep_delta_hours >= lo && d.weekend_sleep_delta_hours < hi).length;
    binData.push({ label: `${lo >= 0 ? '+' : ''}${lo.toFixed(1)}`, count });
  }
  makeChart('weekendDeltaChart', {
    type: 'bar',
    data: {
      labels: binData.map(b => b.label),
      datasets: [{ data: binData.map(b => b.count), backgroundColor: COLORS.purple[2], borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Weekend Δ Sleep (hours)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderCaffeineVsSleepChart(data) {
  const grouped = groupMean(data, 'caffeine_drinks_per_day', 'avg_sleep_hours_weekday')
    .sort((a, b) => a.label - b.label);
  makeChart('caffeineVsSleepChart', {
    type: 'line',
    data: {
      labels: grouped.map(g => `${g.label} drinks`),
      datasets: [{
        data: grouped.map(g => +g.mean.toFixed(2)),
        borderColor: COLORS.purple[0], backgroundColor: COLORS.purple[0] + '20',
        tension: 0.4, fill: true, pointRadius: 4, pointBackgroundColor: COLORS.purple[0],
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg sleep: ${ctx.raw}h  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Caffeine Drinks / Day', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'Avg Sleep Hours', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

/* ─── SCREEN TIME ─── */

function renderScreenByDeviceChart(data) {
  const grouped = groupMean(data, 'primary_device', 'daily_screen_time_hours').sort((a, b) => b.mean - a.mean);
  makeChart('screenByDeviceChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => g.label),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(2)), backgroundColor: COLORS.orange, borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg screen time: ${ctx.raw}h  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: AS(),
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Hours / Day', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderPreSleepVsQualityChart(data) {
  // Bin pre_sleep_screen_time_min into buckets, show avg sleep_quality_score
  const step = 15;
  const buckets = [0, 15, 30, 45, 60, 75, 90, 105];
  const result = buckets.map(lo => {
    const hi = lo + step;
    const subset = data.filter(d => d.pre_sleep_screen_time_min !== null && d.pre_sleep_screen_time_min >= lo && d.pre_sleep_screen_time_min < hi && d.sleep_quality_score !== null);
    const mean = subset.length ? subset.reduce((s, d) => s + d.sleep_quality_score, 0) / subset.length : null;
    return { label: `${lo}–${hi}`, mean, count: subset.length };
  });
  makeChart('preSleepVsQualityChart', {
    type: 'bar',
    data: {
      labels: result.map(r => r.label + ' min'),
      datasets: [{ data: result.map(r => r.mean !== null ? +r.mean.toFixed(2) : null), backgroundColor: COLORS.orange[1], borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg quality: ${ctx.raw}  (n=${result[ctx.dataIndex]?.count})` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Pre-Sleep Screen Time', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), min: 3, max: 10, title: { display: true, text: 'Avg Sleep Quality', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderScreenVsCgpaChart(data) {
  const pts = scatterXY(data, 'daily_screen_time_hours', 'cgpa');
  makeChart('screenVsCgpaChart', {
    type: 'scatter',
    data: { datasets: [{ data: pts, backgroundColor: COLORS.orange[0] + '99', pointRadius: 3 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Screen: ${ctx.raw.x}h · CGPA: ${ctx.raw.y}` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Screen Time (hours/day)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), title: { display: true, text: 'CGPA', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderDeviceFreeChart(data) {
  const counts = countByField(data, 'device_free_before_bed');
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  makeChart('deviceFreeChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: [COLORS.green[0], COLORS.orange[0]], hoverOffset: 8, borderWidth: 2, borderColor: () => cssVar('--bg-surface') || '#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: CHART_FONT, boxWidth: 12, padding: 14, color: () => cssVar('--text-secondary') || '#374151' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} students (${(ctx.raw / vals.reduce((a,b)=>a+b,0)*100).toFixed(1)}%)` } },
      },
      cutout: '62%',
    },
  });
}

function renderScreenByMajorChart(data) {
  const grouped = groupMean(data, 'major_category', 'daily_screen_time_hours').sort((a, b) => b.mean - a.mean);
  makeChart('screenByMajorChart', {
    type: 'bar',
    data: {
      labels: grouped.map(g => g.label),
      datasets: [{ data: grouped.map(g => +g.mean.toFixed(2)), backgroundColor: COLORS.orange, borderRadius: 5 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `Avg: ${ctx.raw}h/day  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Hours / Day', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), ticks: { font: { ...CHART_FONT, size: 10 }, color: cssVar('--tick-color') || '#9ca3af' } },
      },
    },
  });
}

function renderScreenDistChart(data) {
  const step = 1;
  const binData = [];
  for (let b = 0; b < 13; b += step) {
    const count = data.filter(d => d.daily_screen_time_hours !== null && d.daily_screen_time_hours >= b && d.daily_screen_time_hours < b + step).length;
    binData.push({ label: `${b}–${b + step}`, count });
  }
  makeChart('screenDistChart', {
    type: 'bar',
    data: {
      labels: binData.map(b => b.label + 'h'),
      datasets: [{ data: binData.map(b => b.count), backgroundColor: COLORS.orange[2], borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Screen Time (hours/day)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

/* ─── LIFESTYLE ─── */

function renderExerciseVsEnergyChart(data) {
  const grouped = groupMean(data, 'exercise_days_per_week', 'energy_level').sort((a, b) => a.label - b.label);
  makeChart('exerciseVsEnergyChart', {
    type: 'line',
    data: {
      labels: grouped.map(g => `${g.label} day${g.label != 1 ? 's' : ''}`),
      datasets: [{
        label: 'Avg Energy Level',
        data: grouped.map(g => +g.mean.toFixed(2)),
        borderColor: COLORS.green[0], backgroundColor: COLORS.green[0] + '25',
        tension: 0.35, fill: true, pointRadius: 5, pointBackgroundColor: COLORS.green[0],
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { font: CHART_FONT, boxWidth: 12, color: () => cssVar('--text-secondary') || '#374151' } }, tooltip: { callbacks: { label: ctx => `Avg energy: ${ctx.raw}  (n=${grouped[ctx.dataIndex]?.count})` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Exercise Days / Week', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), min: 0, max: 10, title: { display: true, text: 'Energy Level (0–10)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderConcentrationChart(data) {
  const counts = {};
  for (let i = 1; i <= 10; i++) counts[i] = 0;
  data.forEach(d => { if (d.concentration_difficulty !== null) counts[Math.round(d.concentration_difficulty)]++; });
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  // Color gradient from green (low = easy to concentrate) to red (high = hard)
  const bgColors = labels.map(l => {
    const t = (+l - 1) / 9;
    const r = Math.round(34 + t * (239 - 34));
    const g = Math.round(197 + t * (68 - 197));
    const b = Math.round(94 + t * (68 - 94));
    return `rgba(${r},${g},${b},0.8)`;
  });
  makeChart('concentrationChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: bgColors, borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: { ...AS(), title: { display: true, text: 'Concentration Difficulty (1=easy, 10=hard)', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

function renderPartTimeChart(data) {
  const counts = countByField(data, 'has_part_time_job');
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  const total  = vals.reduce((a, b) => a + b, 0);
  makeChart('partTimeChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: [COLORS.green[0], COLORS.soft[3]], hoverOffset: 8, borderWidth: 2, borderColor: () => cssVar('--bg-surface') || '#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: CHART_FONT, boxWidth: 12, padding: 14, color: () => cssVar('--text-secondary') || '#374151' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${(ctx.raw / total * 100).toFixed(1)}%)` } },
      },
      cutout: '62%',
    },
  });
}

/* ─── DEMOGRAPHICS ─── */

function renderGenderChart(data) {
  const counts = countByField(data, 'gender');
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  const total  = vals.reduce((a, b) => a + b, 0);
  makeChart('genderChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLORS.mixed, hoverOffset: 8, borderWidth: 2, borderColor: () => cssVar('--bg-surface') || '#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: CHART_FONT, boxWidth: 12, padding: 10, color: () => cssVar('--text-secondary') || '#374151' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${(ctx.raw / total * 100).toFixed(1)}%)` } },
      },
      cutout: '58%',
    },
  });
}

function renderResidenceChart(data) {
  const counts = countByField(data, 'residence_type');
  const labels = Object.keys(counts);
  const vals   = Object.values(counts);
  const total  = vals.reduce((a, b) => a + b, 0);
  makeChart('residenceChart', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLORS.soft, hoverOffset: 8, borderWidth: 2, borderColor: () => cssVar('--bg-surface') || '#fff' }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: CHART_FONT, boxWidth: 10, padding: 8, color: () => cssVar('--text-secondary') || '#374151' } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw} (${(ctx.raw / total * 100).toFixed(1)}%)` } },
      },
      cutout: '55%',
    },
  });
}

function renderYearChart(data) {
  const counts = {};
  [1,2,3,4,5].forEach(y => counts[y] = 0);
  data.forEach(d => { if (d.year_of_study !== null) counts[d.year_of_study]++; });
  const labels = Object.keys(counts).map(y => `Year ${y}`);
  const vals   = Object.values(counts);
  makeChart('yearChart', {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: vals, backgroundColor: COLORS.blue, borderRadius: 5 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { ...defaultPlugins(), tooltip: { callbacks: { label: ctx => `${ctx.raw} students` } } },
      scales: {
        x: AS(),
        y: { ...AS(), beginAtZero: true, title: { display: true, text: 'Count', font: CHART_FONT, color: cssVar('--text-muted') || '#6b7280' } },
      },
    },
  });
}

/* ── 9. MASTER UPDATE ────────────────────────────────────────── */

/**
 * Re-render every KPI and chart using the current filteredData.
 * Toggles the empty state overlay when no data matches filters.
 */
function updateDashboard() {
  const data  = filteredData;
  const isEmpty = data.length === 0;

  document.getElementById('emptyState').classList.toggle('hidden', !isEmpty);

  // Hide/show all sections when empty
  ['section-overview','section-academic','section-sleep','section-screen','section-lifestyle','section-demo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isEmpty ? 'none' : '';
  });

  if (isEmpty) return;

  // KPIs
  renderKPIs(data);

  // Academic
  renderCgpaDistChart(data);
  renderCgpaByYearChart(data);
  renderCgpaByMajorChart(data);
  renderStudyVsCgpaChart(data);
  renderAttendanceVsCgpaChart(data);
  renderCgpaByChronotypeChart(data);

  // Sleep
  renderSleepByYearChart(data);
  renderSleepQualityDistChart(data);
  renderBedtimeDistChart(data);
  renderSleepVsCgpaChart(data);
  renderWeekendDeltaChart(data);
  renderCaffeineVsSleepChart(data);

  // Screen
  renderScreenByDeviceChart(data);
  renderPreSleepVsQualityChart(data);
  renderScreenVsCgpaChart(data);
  renderDeviceFreeChart(data);
  renderScreenByMajorChart(data);
  renderScreenDistChart(data);

  // Lifestyle
  renderExerciseVsEnergyChart(data);
  renderConcentrationChart(data);
  renderPartTimeChart(data);

  // Demographics
  renderGenderChart(data);
  renderResidenceChart(data);
  renderYearChart(data);
}

/* ── 10. SIDEBAR TOGGLE ─────────────────────────────────────── */

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const overlay  = document.getElementById('sidebarOverlay');
  const isOpen   = !sidebar.classList.contains('-translate-x-full');
  if (isOpen) {
    sidebar.classList.add('-translate-x-full');
    overlay.classList.add('hidden');
  } else {
    sidebar.classList.remove('-translate-x-full');
    overlay.classList.remove('hidden');
  }
}

/* ── 11. ERROR DISPLAY ──────────────────────────────────────── */

function showError(err) {
  const main = document.querySelector('main');
  if (!main) return;
  main.innerHTML = `
    <div class="error-banner">
      <span style="font-size:1.5rem">⚠️</span>
      <div>
        <p class="font-semibold mb-1">Failed to load student_data.json</p>
        <p class="text-sm opacity-80">${err.message}</p>
        <p class="text-xs mt-2 opacity-60">
          Make sure you are running the project through a local server (e.g. VS Code Live Server) and that
          <code>student_data.json</code> is in the same directory as <code>index.html</code>.
        </p>
      </div>
    </div>`;
  const badge = document.getElementById('dataCount');
  if (badge) { badge.textContent = 'Error'; badge.className = 'text-xs bg-red-50 text-red-700 font-medium px-2.5 py-1 rounded-full border border-red-100'; }
}

/* ── 12. THEME MANAGEMENT ───────────────────────────────────── */

/**
 * Initialise theme from localStorage or system preference.
 * Must run before DOMContentLoaded to avoid flash of wrong theme.
 */
function initTheme() {
  const saved = localStorage.getItem('dashboardTheme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}

/**
 * Toggle between light and dark, persist to localStorage, re-render charts.
 */
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  applyTheme(isDark ? 'light' : 'dark');
  // Re-render all charts so axis/grid/legend/tooltip colours update immediately
  if (filteredData.length > 0) updateDashboard();
}

/**
 * Apply a theme ('light' | 'dark') to the document and update the toggle icon.
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('dashboardTheme', theme);

  const sun  = document.getElementById('iconSun');
  const moon = document.getElementById('iconMoon');
  if (sun && moon) {
    if (theme === 'dark') {
      sun.classList.remove('hidden');   // show sun  → "switch to light"
      moon.classList.add('hidden');
    } else {
      sun.classList.add('hidden');
      moon.classList.remove('hidden'); // show moon → "switch to dark"
    }
  }
}

/* ── 13. INIT ────────────────────────────────────────────────── */
// Apply theme immediately (before DOM content loads) to avoid flash
initTheme();
document.addEventListener('DOMContentLoaded', loadData);
