/* ==========================================================================
   NEXUS — charts.js

   Every chart is registered here rather than created ad-hoc, so that a single
   theme change can walk the registry and recolour all of them. Colours are
   never written into chart configs; they are read from CSS custom properties
   at paint time. Switching Purple → Crimson, Light → Dark or Standard → Neon
   therefore updates the charts along with everything else.
   ========================================================================== */

window.NEXUS = window.NEXUS || {};

(function (NX) {
  'use strict';

  const registry = [];      // { chart, kind, recolor(chart) }
  let booted = false;

  /* ------------------------------------------------------------- palette */

  function t(name, fallback) { return NX.theme.token(name, fallback); }

  function primaryRGB() { return t('--primary-rgb', '124, 58, 237'); }
  function alpha(a) { return 'rgba(' + primaryRGB() + ', ' + a + ')'; }

  /* A categorical series palette derived from the active primary. Rotating
     the hue keeps every series distinguishable while staying inside the
     theme, instead of dropping an unrelated rainbow onto the page. */
  function seriesColors(n) {
    const base = t('--primary', '#7C3AED').trim();
    const { h, s, l } = hexToHsl(base);
    const mode = document.documentElement.getAttribute('data-mode');
    const out = [];
    const steps = [0, 42, -38, 84, -76, 126, 168, -118];
    for (let i = 0; i < n; i++) {
      const hh = (h + steps[i % steps.length] + 360) % 360;
      const ll = mode === 'dark'
        ? Math.min(76, l + (i % 3) * 7 + 6)
        : Math.max(26, l - (i % 3) * 6);
      const ss = Math.max(32, Math.min(92, s - (i % 2) * 8));
      out.push(hslToHex(hh, ss, ll));
    }
    return out;
  }

  function hexToHsl(hex) {
    let c = hex.replace('#', '').trim();
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.slice(0, 2), 16) / 255,
          g = parseInt(c.slice(2, 4), 16) / 255,
          b = parseInt(c.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0; const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h, s: s * 100, l: l * 100 };
  }

  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const to = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
    return '#' + to(f(0)) + to(f(8)) + to(f(4));
  }

  /* Gradient fill under a line. Needs the rendered chart area, so it is
     computed lazily per draw rather than stored. */
  function areaFill(ctx, chartArea, color, strength) {
    if (!chartArea) return alpha(0.12);
    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    const s = strength || 0.34;
    g.addColorStop(0, hexToRgba(color, s));
    g.addColorStop(1, hexToRgba(color, 0));
    return g;
  }

  function hexToRgba(hex, a) {
    if (hex.startsWith('rgb')) return hex;
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
  }

  /* -------------------------------------------------------- global defaults */

  function applyDefaults() {
    if (!window.Chart) return;
    const C = window.Chart;
    C.defaults.font.family = t('--font-sans', 'system-ui').replace(/['"]/g, '');
    C.defaults.font.size = 12;
    C.defaults.color = t('--chart-ink', '#5C6675');
    C.defaults.borderColor = t('--chart-grid', '#E7EAF0');
    C.defaults.animation.duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 700;
    C.defaults.maintainAspectRatio = false;
    C.defaults.responsive = true;

    C.defaults.plugins.legend.labels.usePointStyle = true;
    C.defaults.plugins.legend.labels.boxWidth = 8;
    C.defaults.plugins.legend.labels.boxHeight = 8;
    C.defaults.plugins.legend.labels.padding = 16;

    Object.assign(C.defaults.plugins.tooltip, {
      backgroundColor: t('--surface', '#fff'),
      titleColor: t('--text', '#12161C'),
      bodyColor: t('--text-muted', '#5C6675'),
      borderColor: t('--border', '#E2E5EB'),
      borderWidth: 1,
      padding: 10,
      cornerRadius: 8,
      displayColors: true,
      boxPadding: 4,
      titleFont: { weight: '600', size: 12 },
      bodyFont: { family: t('--font-mono', 'monospace').replace(/['"]/g, ''), size: 12 }
    });
  }

  /* ------------------------------------------------------------ neon plugin
     Applies a canvas shadow to line strokes and arcs while neon is active.
     Registered once; it reads the document state on every draw so it costs
     nothing when neon is off. */

  const neonGlow = {
    id: 'nexusNeonGlow',
    beforeDatasetDraw(chart, args) {
      if (document.documentElement.getAttribute('data-style') !== 'neon') return;
      const type = args.meta.type;
      if (type !== 'line' && type !== 'doughnut' && type !== 'pie' && type !== 'radar' && type !== 'polarArea') return;
      const ctx = chart.ctx;
      ctx.save();
      ctx.shadowColor = alpha(0.7);
      ctx.shadowBlur = type === 'line' ? 12 : 16;
    },
    afterDatasetDraw(chart, args) {
      if (document.documentElement.getAttribute('data-style') !== 'neon') return;
      const type = args.meta.type;
      if (type !== 'line' && type !== 'doughnut' && type !== 'pie' && type !== 'radar' && type !== 'polarArea') return;
      chart.ctx.restore();
    }
  };

  /* ------------------------------------------------------------ axis helper */

  function axes(opts) {
    const o = opts || {};
    const grid = { color: t('--chart-grid', '#E7EAF0'), drawTicks: false, lineWidth: 1 };
    return {
      x: {
        grid: Object.assign({}, grid, { display: o.xGrid === true }),
        border: { display: false },
        ticks: { padding: 8, maxRotation: 0, autoSkipPadding: 14, color: t('--chart-ink', '#5C6675') }
      },
      y: {
        beginAtZero: o.beginAtZero !== false,
        grid: Object.assign({}, grid, { display: o.yGrid !== false }),
        border: { display: false },
        ticks: {
          padding: 8, maxTicksLimit: 6, color: t('--chart-ink', '#5C6675'),
          callback: o.tickFormat || function (v) {
            if (Math.abs(v) >= 1000000) return (v / 1000000) + 'M';
            if (Math.abs(v) >= 1000) return (v / 1000) + 'k';
            return v;
          }
        }
      }
    };
  }

  /* ----------------------------------------------------------------- create */

  function create(canvasId, build) {
    const el = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!el || !window.Chart) return null;

    const make = () => {
      const cfg = build({ colors: seriesColors, alpha, axes, areaFill, token: t, hexToRgba });
      cfg.options = cfg.options || {};
      if (cfg.options.plugins && cfg.options.plugins.legend === undefined) cfg.options.plugins.legend = { display: false };
      return new window.Chart(el, cfg);
    };

    let chart = make();
    registry.push({
      el,
      rebuild() {
        const active = chart;
        chart = null;
        active.destroy();
        chart = make();
        return chart;
      }
    });
    return chart;
  }

  /* ---------------------------------------------------------------- sparkline
     Drawn straight to a canvas rather than through Chart.js. A dashboard row
     can carry a dozen of these; instantiating a dozen chart objects for
     forty data points each is a waste of the main thread. */

  function sparkline(canvas, data, opts) {
    const o = Object.assign({ fill: true, width: 2, color: null }, opts || {});
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    function draw() {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = w * dpr; canvas.height = h * dpr;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const color = o.color || t('--primary', '#7C3AED').trim();
      const min = Math.min.apply(null, data), max = Math.max.apply(null, data);
      const span = (max - min) || 1;
      const pad = o.width + 1;
      const px = (i) => (i / (data.length - 1)) * w;
      const py = (v) => h - pad - ((v - min) / span) * (h - pad * 2);

      if (o.fill) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, hexToRgba(color, 0.26));
        g.addColorStop(1, hexToRgba(color, 0));
        ctx.beginPath();
        ctx.moveTo(0, h);
        data.forEach((v, i) => ctx.lineTo(px(i), py(v)));
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = g;
        ctx.fill();
      }

      ctx.beginPath();
      data.forEach((v, i) => { i ? ctx.lineTo(px(i), py(v)) : ctx.moveTo(px(i), py(v)); });
      ctx.strokeStyle = color;
      ctx.lineWidth = o.width;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (document.documentElement.getAttribute('data-style') === 'neon') {
        ctx.shadowColor = hexToRgba(color, 0.85);
        ctx.shadowBlur = 8;
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // terminal dot: marks the current value, which is the one people read
      const lastX = px(data.length - 1), lastY = py(data[data.length - 1]);
      ctx.beginPath();
      ctx.arc(lastX, lastY, o.width + 0.6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }

    registry.push({ el: canvas, rebuild: draw });
    draw();
    return { draw };
  }

  function initSparklines() {
    document.querySelectorAll('canvas[data-spark]').forEach((c) => {
      const raw = c.getAttribute('data-spark');
      const data = raw.split(',').map(Number).filter((n) => !isNaN(n));
      if (data.length < 2) return;
      sparkline(c, data, {
        color: c.getAttribute('data-spark-color') ? t(c.getAttribute('data-spark-color')) : null,
        fill: c.getAttribute('data-spark-fill') !== 'false'
      });
    });
  }

  /* ------------------------------------------------------------------ boot */

  function refreshAll() {
    applyDefaults();
    registry.forEach((entry) => {
      // A canvas removed from the DOM shouldn't keep us rebuilding it.
      if (!entry.el || !entry.el.isConnected) return;
      try { entry.rebuild(); } catch (e) { console.error('chart refresh failed', e); }
    });
  }

  function init() {
    if (!window.Chart) return;
    if (!booted) {
      window.Chart.register(neonGlow);
      booted = true;
    }
    applyDefaults();
    initSparklines();

    let pending = null;
    document.addEventListener('nexus:themechange', () => {
      clearTimeout(pending);
      pending = setTimeout(refreshAll, 60);
    });

    window.addEventListener('resize', NX.util.debounce(() => {
      registry.forEach((e) => {
        if (e.el && e.el.isConnected && e.el.hasAttribute('data-spark')) e.rebuild();
      });
    }, 200));
  }

  NX.charts = { init, create, sparkline, seriesColors, axes, refreshAll, alpha, hexToRgba, areaFill };
})(window.NEXUS);
