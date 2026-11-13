/* =====================================================================
   shell.js · configuração visual do site + navegação da landing
   · Config: quadrados que alternam cada opção (tema, fundo, destaque,
     cor do texto, grão, globo). Salvo em localStorage e aplicado em
     todas as páginas.
   · Navegação da landing: os itens em volta do globo levam às seções
     da própria página (sem popup). A seção visível fica marcada.
   ===================================================================== */
(function () {
  'use strict';

  const KEY = 'pw-config';
  const body = document.body;

  const DEFAULTS = {
    bg: 'solid',          // solid | gradient | animated
    accent: 'azul',       // azul | laranja | natureza | rosa | custom
    customAccent: '#1d4ed8',
    ink: 'padrao',        // padrao | sepia | azul | verde | roxo
    grain: true,
    globe: true
  };

  // ordem em que cada quadrado percorre os valores
  const CYCLES = {
    bg: ['solid', 'gradient', 'animated'],
    accent: ['azul', 'laranja', 'natureza', 'rosa'],
    ink: ['padrao', 'sepia', 'azul', 'verde', 'roxo']
  };

  const LABELS = {
    bg: { solid: 'sólido', gradient: 'degradê', animated: 'animado' },
    accent: { azul: 'azul', laranja: 'laranja', natureza: 'verde', rosa: 'rosa', custom: 'livre' },
    ink: { padrao: 'padrão', sepia: 'sépia', azul: 'azul', verde: 'verde', roxo: 'roxo' }
  };

  // [cor da luz, cor secundária] — usadas como --accent e --accent-2
  const ACCENTS = {
    laranja:  ['#c2410c', '#f59e0b'],
    natureza: ['#047857', '#84cc16'],
    azul:     ['#1d4ed8', '#06b6d4'],
    rosa:     ['#be185d', '#f472b6']
  };

  // [tinta no claro, tinta no escuro]; "padrao" remove a sobrescrita
  const INKS = {
    padrao: null,
    sepia: ['#3b2a1a', '#f1e2c8'],
    azul:  ['#1e3a8a', '#bfd3ff'],
    verde: ['#14532d', '#c8f0d4'],
    roxo:  ['#4c1d95', '#e4d6ff']
  };

  const store = {
    get() {
      try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
      catch (e) { return Object.assign({}, DEFAULTS); }
    },
    set(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* ignorar */ } }
  };

  let cfg = store.get();
  const isDark = () => body.classList.contains('dark');
  const isAds = () => body.classList.contains('ads-dark');

  /* ---------- camada de fundo ---------- */
  function ensureBgLayer() {
    let layer = document.getElementById('bg-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'bg-layer';
      layer.setAttribute('aria-hidden', 'true');
      body.prepend(layer);
    }
    return layer;
  }

  /* ---------- aplica a configuração no DOM (sem disparar eventos) ---------- */
  function applyVisuals() {
    ensureBgLayer();
    body.classList.remove('bg-gradient', 'bg-animated');
    if (cfg.bg === 'gradient') body.classList.add('bg-gradient');
    if (cfg.bg === 'animated') body.classList.add('bg-animated');
    body.classList.toggle('no-grain', !cfg.grain);
    body.classList.toggle('no-globe', !cfg.globe);

    // A.D.S. mantém a paleta própria de terminal
    if (isAds()) return;

    const pair = cfg.accent === 'custom'
      ? [cfg.customAccent, cfg.customAccent]
      : (ACCENTS[cfg.accent] || ACCENTS.azul);
    body.style.setProperty('--accent', pair[0]);
    body.style.setProperty('--accent-2', pair[1]);

    const ink = INKS[cfg.ink];
    if (ink) body.style.setProperty('--ink', isDark() ? ink[1] : ink[0]);
    else body.style.removeProperty('--ink');
  }

  function notifyGlobe() {
    document.dispatchEvent(new CustomEvent('pw:theme', { detail: { dark: isDark() } }));
  }

  function setTheme(dark) {
    if (window.Portfolio && window.Portfolio.Theme) window.Portfolio.Theme.apply(dark, true);
    else body.classList.toggle('dark', dark);
    try { localStorage.setItem('pw-theme', dark ? 'dark' : 'light'); } catch (e) { /* ignorar */ }
    applyVisuals();
  }

  /* ---------- textos e estados dos quadrados ---------- */
  function syncUI() {
    const set = (k, text) => document.querySelectorAll('[data-val="' + k + '"]').forEach((el) => { el.textContent = text; });
    set('theme', isDark() ? 'escuro' : 'claro');
    set('bg', LABELS.bg[cfg.bg] || cfg.bg);
    set('accent', cfg.accent === 'custom' ? 'livre' : (LABELS.accent[cfg.accent] || cfg.accent));
    set('ink', LABELS.ink[cfg.ink] || cfg.ink);
    set('grain', cfg.grain ? 'ligado' : 'desligado');
    set('globe', cfg.globe ? 'ligado' : 'desligado');
    document.querySelectorAll('[data-toggle]').forEach((el) => {
      el.setAttribute('aria-pressed', String(!!cfg[el.dataset.toggle]));
    });
    const picker = document.querySelector('input[data-set="custom"]');
    if (picker) picker.value = cfg.customAccent;
  }

  /* ---------- eventos da Config ---------- */
  function nextIn(list, current) {
    const i = list.indexOf(current);
    return list[(i + 1) % list.length];
  }

  function onConfigClick(e) {
    const cyc = e.target.closest('[data-cycle]');
    const tog = e.target.closest('[data-toggle]');
    const rst = e.target.closest('[data-reset]');

    if (cyc) {
      const k = cyc.dataset.cycle;
      if (k === 'theme') setTheme(!isDark());
      else cfg[k] = nextIn(CYCLES[k], cfg[k]);
    } else if (tog) {
      const k = tog.dataset.toggle;
      cfg[k] = !cfg[k];
    } else if (rst) {
      cfg = Object.assign({}, DEFAULTS);
      setTheme(false);
    } else {
      return;
    }

    store.set(cfg);
    applyVisuals();
    notifyGlobe();
    syncUI();
  }

  function onCustomColor(e) {
    const el = e.target;
    if (!el.matches || !el.matches('input[data-set="custom"]')) return;
    cfg.accent = 'custom';
    cfg.customAccent = el.value;
    store.set(cfg);
    applyVisuals();
    notifyGlobe();
    syncUI();
  }

  /* =====================================================================
     NAVEGAÇÃO DA LANDING
     ===================================================================== */
  /* uma seção por vez, na mesma tela: sem rolagem */
  function initNav() {
    const ring = Array.from(document.querySelectorAll('.ring-item[data-target]'));
    const links = Array.from(document.querySelectorAll('[data-target]'));
    const sections = Array.from(document.querySelectorAll('.sec'));
    if (!ring.length) return;

    function show(id) {
      if (!id || id === 'inicio' || !document.getElementById(id)) {
        body.classList.remove('view-open');
        sections.forEach((s) => s.classList.remove('is-active'));
        links.forEach((a) => a.classList.remove('on'));
        history.replaceState(null, '', location.pathname + location.search);
        return;
      }
      sections.forEach((s) => s.classList.toggle('is-active', s.id === id));
      body.classList.add('view-open');
      links.forEach((a) => a.classList.toggle('on', a.dataset.target === id));
      const sec = document.getElementById(id);
      if (sec) sec.scrollTop = 0;
      history.replaceState(null, '', '#' + id);
    }

    links.forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      show(a.dataset.target);
    }));

    // teclas 1–6 abrem as seções; Esc volta ao início
    document.addEventListener('keydown', (e) => {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') { show('inicio'); return; }
      const hit = ring.find((a) => a.dataset.key === e.key);
      if (hit) show(hit.dataset.target);
    });

    // abre direto a seção indicada no endereço (#sec-redes, etc.)
    if (location.hash.length > 1) show(location.hash.slice(1));
  }

  /* ---------- boot ---------- */
  function boot() {
    applyVisuals();
    syncUI();
    initNav();

    document.addEventListener('click', onConfigClick);
    document.addEventListener('input', onCustomColor);
    // troca de tema feita pelo botão do cabeçalho (em outras páginas)
    document.addEventListener('pw:theme', () => { applyVisuals(); syncUI(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
