/* =====================================================================
   field.js · esfera pontilhada em canvas 2D
   Substitui o globo wireframe em three.js: sem dependência externa,
   mais leve, com arcos de "sinal" que viajam pela superfície e um
   leve paralaxe que segue o ponteiro.
   ===================================================================== */
(function () {
  'use strict';

  const host = document.getElementById('globe-container');
  if (!host) return;

  const canvas = host.tagName === 'CANVAS' ? host : document.createElement('canvas');
  if (canvas !== host) host.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const CFG = {
    points: 760,          // pontos da malha (distribuição de Fibonacci)
    speed: 0.0016,        // rotação por quadro
    tilt: 23.5 * Math.PI / 180,
    arcs: 7,              // arcos de sinal simultâneos
    arcLife: 260,         // quadros de vida de cada arco
    arcSamples: 36,
    parallax: 0.22        // intensidade do paralaxe com o ponteiro
  };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let w = 1, h = 1, dpr = 1, cx = 0, cy = 0, R = 1;
  let rot = 0;
  let pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  let colors = { accent: [194, 65, 12], ink: [26, 26, 26] };
  let frameCount = 0;
  let visible = true;
  let arcs = [];
  let dots = [];

  /* ---- util ---- */
  function hexToRgb(hex) {
    const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : null;
  }
  function readColors() {
    const cs = getComputedStyle(document.body);
    const acc = hexToRgb(cs.getPropertyValue('--accent') || '') || colors.accent;
    const dark = document.body.classList.contains('dark');
    colors = { accent: acc, ink: dark ? [241, 237, 228] : [26, 26, 26] };
  }

  /* ---- geometria ---- */
  function fibonacci(n) {
    const out = [];
    const phi = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const t = phi * i;
      out.push([Math.cos(t) * r, y, Math.sin(t) * r]);
    }
    return out;
  }
  function norm(v) {
    const l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function rand(n) { return Math.floor(Math.random() * n); }

  function newArc() {
    const a = dots[rand(dots.length)];
    let b = dots[rand(dots.length)];
    // procura um destino razoavelmente distante para o arco ficar bonito
    for (let k = 0; k < 6; k++) {
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d > 0.9) break;
      b = dots[rand(dots.length)];
    }
    const mid = norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]);
    const lift = 1.28 + Math.random() * 0.22;
    return { a, b, c: [mid[0] * lift, mid[1] * lift, mid[2] * lift], age: -Math.random() * 60, life: CFG.arcLife * (0.8 + Math.random() * 0.4) };
  }

  /* ---- projeção: rotação Y (giro), X (paralaxe), Z (inclinação) ---- */
  function project(p) {
    let x = p[0], y = p[1], z = p[2];

    // giro em torno do eixo Y
    const cr = Math.cos(rot), sr = Math.sin(rot);
    let x1 = x * cr + z * sr;
    let z1 = -x * sr + z * cr;

    // paralaxe em torno do eixo X
    const ax = pointer.y * CFG.parallax;
    const ca = Math.cos(ax), sa = Math.sin(ax);
    let y2 = y * ca - z1 * sa;
    let z2 = y * sa + z1 * ca;

    // inclinação do eixo terrestre em torno de Z
    const ct = Math.cos(CFG.tilt), st = Math.sin(CFG.tilt);
    const x3 = x1 * ct - y2 * st;
    const y3 = x1 * st + y2 * ct;

    const persp = 1 + z2 * 0.12;
    return {
      sx: cx + x3 * R * persp,
      sy: cy - y3 * R * persp,
      depth: (z2 + 1) / 2,
      z: z2
    };
  }

  /* ---- layout ---- */
  function resize() {
    const rect = host.getBoundingClientRect();
    w = Math.max(rect.width, 1);
    h = Math.max(rect.height, 1);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2;
    cy = h / 2;
    R = Math.min(w, h) * 0.4;
  }

  /* ---- desenho ---- */
  function drawHalo() {
    const g = ctx.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 1.25);
    g.addColorStop(0, `rgba(${colors.accent.join(',')},0)`);
    g.addColorStop(0.75, `rgba(${colors.accent.join(',')},0.07)`);
    g.addColorStop(1, `rgba(${colors.accent.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.25, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawDots() {
    const ink = colors.ink;
    const acc = colors.accent;
    for (let i = 0; i < dots.length; i++) {
      const p = project(dots[i]);
      const a = 0.12 + 0.7 * p.depth;
      const r = 0.7 + 1.5 * p.depth;
      const isAccent = i % 41 === 0;
      const c = isAccent ? acc : ink;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${(isAccent ? a + 0.2 : a * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ponto na curva quadrática 3D A → C (controle) → B, projetado na esfera
  function arcPoint(arc, u) {
    const k0 = (1 - u) * (1 - u), k1 = 2 * (1 - u) * u, k2 = u * u;
    return norm([
      arc.a[0] * k0 + arc.c[0] * k1 + arc.b[0] * k2,
      arc.a[1] * k0 + arc.c[1] * k1 + arc.b[1] * k2,
      arc.a[2] * k0 + arc.c[2] * k1 + arc.b[2] * k2
    ]);
  }

  function drawArcs() {
    const acc = colors.accent;
    for (const arc of arcs) {
      arc.age += 1;
      const t = arc.age / arc.life;
      if (t < 0) continue;
      if (t >= 1) { Object.assign(arc, newArc()); continue; }

      const fade = Math.sin(Math.PI * t);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      let started = false;
      for (let s = 0; s <= CFG.arcSamples; s++) {
        const u = s / CFG.arcSamples;
        const p = project(arcPoint(arc, u));
        if (u < t - 0.45 || u > t + 0.02) { started = false; continue; }
        if (!started) { ctx.moveTo(p.sx, p.sy); started = true; } else { ctx.lineTo(p.sx, p.sy); }
      }
      ctx.strokeStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${(0.55 * fade).toFixed(3)})`;
      ctx.stroke();

      // cabeça brilhante do arco
      const head = project(arcPoint(arc, t));
      ctx.fillStyle = `rgba(${acc[0]},${acc[1]},${acc[2]},${(0.9 * fade).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(head.sx, head.sy, 2 + 1.5 * head.depth, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRing() {
    const ink = colors.ink;
    ctx.strokeStyle = `rgba(${ink[0]},${ink[1]},${ink[2]},0.08)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 1.02, 0, Math.PI * 2);
    ctx.stroke();
  }

  function render() {
    ctx.clearRect(0, 0, w, h);
    drawHalo();
    drawRing();
    drawDots();
    drawArcs();
  }

  /* ---- loop ---- */
  function loop() {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) return;

    frameCount++;
    if (frameCount % 45 === 0) readColors();

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    rot += CFG.speed;
    render();
  }

  /* ---- init ---- */
  function init() {
    dots = fibonacci(CFG.points);
    arcs = Array.from({ length: CFG.arcs }, () => newArc());
    resize();
    readColors();

    window.addEventListener('resize', resize);
    window.addEventListener('pw:theme', readColors);
    document.addEventListener('pw:theme', readColors);

    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
    });
    io.observe(host);

    if (!reduce) {
      window.addEventListener('pointermove', (e) => {
        pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
      requestAnimationFrame(loop);
    } else {
      render();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
