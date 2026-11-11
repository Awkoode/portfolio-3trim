/* =====================================================================
   ads.js · página A.D.S. (terminal)
   Mantém: digitação do título, rede de partículas e o mapa do hero.
   Popups, abas, galeria e campos de link agora vêm do engine.js.
   ===================================================================== */

/* ---------- 1. Digitação do título ---------- */
(function typing() {
  const el = document.getElementById('typed');
  if (!el) return;
  const phrases = [
    'Console.log(’aprendizado’);',
    'building > coding > shipping.',
    'da sala de aula ao terminal.',
  ];
  let p = 0, i = 0, deleting = false;

  function tick() {
    const full = phrases[p];
    if (!deleting) {
      el.textContent = full.slice(0, i++);
      if (i > full.length) { deleting = true; setTimeout(tick, 1600); return; }
    } else {
      el.textContent = full.slice(0, i--);
      if (i < 0) { deleting = false; p = (p + 1) % phrases.length; }
    }
    setTimeout(tick, deleting ? 35 : 70);
  }
  tick();
})();

/* ---------- 2. Rede de partículas (fundo) ---------- */
(function particles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let w, h, dots;

  const mouse = { x: -9999, y: -9999 };

  function resize() {
    w = canvas.width = innerWidth * DPR;
    h = canvas.height = innerHeight * DPR;
    canvas.style.width = innerWidth + 'px';
    canvas.style.height = innerHeight + 'px';
    const count = Math.min(90, Math.floor((innerWidth * innerHeight) / 18000));
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3 * DPR,
      vy: (Math.random() - 0.5) * 0.3 * DPR,
    }));
  }

  addEventListener('pointermove', (e) => { mouse.x = e.clientX * DPR; mouse.y = e.clientY * DPR; }, { passive: true });
  addEventListener('pointerleave', () => { mouse.x = -9999; mouse.y = -9999; });
  addEventListener('resize', resize);
  resize();

  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0 || d.x > w) d.vx *= -1;
      if (d.y < 0 || d.y > h) d.vy *= -1;
    }

    const max = 130 * DPR;
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) {
        const a = dots[i], b = dots[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < max) {
          const o = 1 - dist / max;
          ctx.strokeStyle = `rgba(167,139,250,${(o * 0.35).toFixed(3)})`;
          ctx.lineWidth = DPR;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // ligação com o cursor
      const dm = Math.hypot(dots[i].x - mouse.x, dots[i].y - mouse.y);
      if (dm < max * 1.4) {
        const o = 1 - dm / (max * 1.4);
        ctx.strokeStyle = `rgba(34,211,238,${(o * 0.6).toFixed(3)})`;
        ctx.lineWidth = DPR;
        ctx.beginPath();
        ctx.moveTo(dots[i].x, dots[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(245,245,245,0.7)';
    for (const d of dots) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, 1.4 * DPR, 0, Math.PI * 2);
      ctx.fill();
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  frame();
})();

/* ---------- 3. Mapa do hero (pan + pin sincronizados com as ocorrências) ---------- */
(function heroMap() {
  const SCENES = [
    { place: 'Centro',               pan: { x: 0,   y: 0  }, pin: { x: 46, y: 50 }, duration: 5200 },
    { place: 'Trindade',             pan: { x: -24, y: -16 }, pin: { x: 64, y: 44 }, duration: 5200 },
    { place: 'Lagoa da Conceição',   pan: { x: -14, y: 20 }, pin: { x: 40, y: 62 }, duration: 5200 },
    { place: 'Ingleses',             pan: { x: -30, y: 10 }, pin: { x: 70, y: 40 }, duration: 5200 },
  ];
  const TRANSITION_MS = 1100;
  let sceneIndex = 0;
  let timerId = null;

  function setScene(index) {
    const i = index % SCENES.length;
    const scene = SCENES[i];
    const demo = document.querySelector('.hero-map-demo');
    if (!demo) return;

    const surface = document.getElementById('hero-map-surface');
    const pin = document.getElementById('hero-map-pin');
    const placeEl = document.getElementById('hero-map-place');

    if (surface) surface.style.transform = `translate(${scene.pan.x}%, ${scene.pan.y}%)`;
    if (pin) { pin.style.left = `${scene.pin.x}%`; pin.style.top = `${scene.pin.y}%`; }

    if (placeEl) {
      placeEl.style.opacity = '0';
      setTimeout(() => {
        placeEl.textContent = scene.place;
        placeEl.style.opacity = '1';
      }, TRANSITION_MS * 0.35);
    }

    demo.querySelectorAll('.hero-map-card').forEach((card) => {
      card.classList.toggle('is-active', Number(card.dataset.scene) === i);
    });
  }

  function scheduleNext() {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      sceneIndex = (sceneIndex + 1) % SCENES.length;
      setScene(sceneIndex);
      scheduleNext();
    }, SCENES[sceneIndex].duration);
  }

  function init() {
    const surface = document.getElementById('hero-map-surface');
    const pin = document.getElementById('hero-map-pin');
    const placeEl = document.getElementById('hero-map-place');

    if (surface) surface.style.transition = `transform ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`;
    if (pin) pin.style.transition = `left ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1), top ${TRANSITION_MS}ms cubic-bezier(0.4,0,0.2,1)`;
    if (placeEl) placeEl.style.transition = 'opacity .4s ease';

    setScene(0);
    scheduleNext();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
