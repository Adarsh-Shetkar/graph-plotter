const $ = id => document.getElementById(id);
const cv = $('cv'), ctx = cv.getContext('2d');
const tooltip = $('tooltip'), chartWrap = $('chart-wrap');
const COLOR = '#2563eb', GRID = '#e8ebf0', TEXT = '#1c2330', MUTED = '#6b7585';

let headers = [], rows = [], fileName = '';
// Cached plot points & transforms for responsive interaction/hover
let cachedPlot = { pts: [], sx: null, sy: null, xi: 0, yi: 0, x0: 0, x1: 0, y0: 0, y1: 0 };

// ---------- clear canvas ----------
// Clears canvas display when state resets or error occurs
function clearChart(msg = '') {
  const dpr = window.devicePixelRatio || 1;
  const W = cv.clientWidth || 800, H = cv.clientHeight || 480;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  if (msg) {
    ctx.fillStyle = MUTED;
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, W / 2, H / 2);
  }
}

// ---------- load data ----------
function load(text, name) {
  $('err').textContent = '';
  const all = parseCSV(text);
  if (all.length < 2) {
    clearChart('No data rows found.');
    return ($('err').textContent = 'No data rows found.');
  }
  headers = all[0].map((h, i) => h.trim() || 'col' + (i + 1));
  rows = all.slice(1);
  fileName = name;

  // keep only columns where most values are numbers
  const numeric = headers.map((_, j) => j).filter(j => {
    const sample = rows.slice(0, 500).filter(r => r[j] && r[j].trim() !== '');
    return sample.length > 0 && sample.filter(r => !isNaN(Number(r[j]))).length / sample.length >= 0.8;
  });
  if (numeric.length < 2) {
    clearChart('Need at least two numeric columns.');
    return ($('err').textContent = 'Need at least two numeric columns.');
  }

  const options = numeric.map(j => `<option value="${j}">${headers[j]}</option>`).join('');
  $('xs').innerHTML = options;
  $('ys').innerHTML = options;
  $('xs').value = numeric[0];
  $('ys').value = numeric[1];
  draw();
}

// ---------- helpers ----------
function niceTicks(min, max, count = 6) {
  const raw = (max - min) / count;
  if (!isFinite(raw) || raw <= 0) return [min];
  const p = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3 ? 2 : m < 7 ? 5 : 10) * p;
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(+v.toFixed(10));
  return ticks;
}
const fmt = v => String(+v.toPrecision(5));

// ---------- draw ----------
function draw() {
  if (!rows.length) return;
  const xi = +$('xs').value, yi = +$('ys').value, type = $('type').value;

  let pts = [];
  for (const r of rows) {
    const x = Number(r[xi]), y = Number(r[yi]);
    if (r[xi] !== '' && r[yi] !== '' && isFinite(x) && isFinite(y)) pts.push([x, y]);
  }
  if (!pts.length) {
    clearChart('No valid numeric points found in selected columns.');
    return ($('err').textContent = 'No valid numbers in those columns.');
  }
  $('err').textContent = '';
  if (type === 'line') pts.sort((a, b) => a[0] - b[0]);

  // size canvas for sharp rendering on retina screens
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Avoid call stack overflow for large datasets by iterating instead of spreading Math.min(...pts)
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0], py = pts[i][1];
    if (px < x0) x0 = px;
    if (px > x1) x1 = px;
    if (py < y0) y0 = py;
    if (py > y1) y1 = py;
  }
  if (x0 === x1) { x0 -= 1; x1 += 1; }
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const padX = (x1 - x0) * 0.04, padY = (y1 - y0) * 0.06;
  x0 -= padX; x1 += padX; y0 -= padY; y1 += padY;

  // Calculate dynamic left margin based on Y-axis tick string width to prevent clipping
  ctx.font = '12px system-ui, sans-serif';
  const yTicks = niceTicks(y0, y1);
  let maxYTextWidth = 30;
  for (const t of yTicks) {
    const w = ctx.measureText(fmt(t)).width;
    if (w > maxYTextWidth) maxYTextWidth = w;
  }
  const L = Math.max(50, Math.ceil(maxYTextWidth + 24));
  const R = 24, T = $('title').value ? 40 : 20, B = 50;
  const pw = W - L - R, ph = H - T - B;

  const sx = x => L + (x - x0) / (x1 - x0) * pw;       // data -> pixel
  const sy = y => T + ph - (y - y0) / (y1 - y0) * ph;

  // Cache plot geometry for hover tooltip lookups
  cachedPlot = { pts, sx, sy, xi, yi, L, T, pw, ph, W, H };

  // grid + tick labels
  ctx.strokeStyle = GRID; ctx.fillStyle = MUTED;
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  for (const t of niceTicks(x0, x1)) {
    ctx.beginPath(); ctx.moveTo(sx(t), T); ctx.lineTo(sx(t), T + ph); ctx.stroke();
    ctx.fillText(fmt(t), sx(t), T + ph + 6);
  }
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  for (const t of yTicks) {
    ctx.beginPath(); ctx.moveTo(L, sy(t)); ctx.lineTo(L + pw, sy(t)); ctx.stroke();
    ctx.fillText(fmt(t), L - 8, sy(t));
  }

  // axis labels and title
  ctx.fillStyle = TEXT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(headers[xi], L + pw / 2, H - 10);
  ctx.save(); ctx.translate(14, T + ph / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText(headers[yi], 0, 0); ctx.restore();
  if ($('title').value) { ctx.font = 'bold 15px system-ui, sans-serif'; ctx.fillText($('title').value, L + pw / 2, 24); }

  // data
  ctx.fillStyle = COLOR; ctx.strokeStyle = COLOR;
  if (type === 'line') {
    ctx.lineWidth = 2; ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(sx(x), sy(y)) : ctx.moveTo(sx(x), sy(y))));
    ctx.stroke();
  } else {
    ctx.globalAlpha = pts.length > 1000 ? 0.45 : 0.75;
    const r = pts.length > 5000 ? 2 : 4;
    for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(sx(x), sy(y), r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
  }

  $('status').textContent = `${fileName}: ${rows.length} rows, ${pts.length} points plotted.`;
}

// ---------- hover tooltip ----------
cv.addEventListener('mousemove', e => {
  if (!cachedPlot.pts.length || !cachedPlot.sx) {
    tooltip.style.display = 'none';
    return;
  }
  const rect = cv.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  // Search for the closest point within 10px radius
  let closest = null, minD2 = 100;
  for (let i = 0; i < cachedPlot.pts.length; i++) {
    const p = cachedPlot.pts[i];
    const px = cachedPlot.sx(p[0]), py = cachedPlot.sy(p[1]);
    const d2 = (mx - px) ** 2 + (my - py) ** 2;
    if (d2 < minD2) {
      minD2 = d2;
      closest = { x: p[0], y: p[1], px, py };
    }
  }

  if (closest) {
    tooltip.style.display = 'block';
    tooltip.style.left = `${closest.px}px`;
    tooltip.style.top = `${closest.py}px`;
    tooltip.textContent = `${headers[cachedPlot.xi]}: ${fmt(closest.x)}, ${headers[cachedPlot.yi]}: ${fmt(closest.y)}`;
  } else {
    tooltip.style.display = 'none';
  }
});

cv.addEventListener('mouseleave', () => {
  tooltip.style.display = 'none';
});

// ---------- drag and drop file upload ----------
// Enable dragging CSV files directly onto the chart area
['dragenter', 'dragover'].forEach(evt => {
  chartWrap.addEventListener(evt, e => {
    e.preventDefault();
    chartWrap.classList.add('drag-over');
  });
});

['dragleave', 'drop'].forEach(evt => {
  chartWrap.addEventListener(evt, e => {
    e.preventDefault();
    chartWrap.classList.remove('drag-over');
  });
});

chartWrap.addEventListener('drop', e => {
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => load(reader.result, f.name);
  reader.readAsText(f);
});

// ---------- events ----------
$('file').onchange = e => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    load(reader.result, f.name);
    e.target.value = ''; // Reset input value so re-selecting same file works
  };
  reader.readAsText(f);
};

$('sample').onclick = () => {
  let csv = 'day,temperature,sales\n';
  for (let i = 0; i < 200; i++) {
    const t = 10 + 12 * Math.sin(i / 30) + Math.random() * 4;
    csv += `${i},${t.toFixed(2)},${(50 + t * 6 + Math.random() * 40).toFixed(1)}\n`;
  }
  load(csv, 'sample.csv');
};

['xs', 'ys', 'type'].forEach(id => ($(id).onchange = draw));
$('title').oninput = draw;
window.addEventListener('resize', draw);

$('dl').onclick = () => {
  if (!rows.length) return;
  const c = document.createElement('canvas');
  c.width = cv.width; c.height = cv.height;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(cv, 0, 0);
  const a = document.createElement('a');
  a.download = 'chart.png'; a.href = c.toDataURL('image/png'); a.click();
};

$('sample').click(); // start with sample data

