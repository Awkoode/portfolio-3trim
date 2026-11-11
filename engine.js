/* =====================================================================
   engine.js · núcleo do portfólio v2
   Substitui shared.js + index.js. Organiza o comportamento em módulos:
   Transitions · Theme · Split · Nav · Reveal · Tabs · Popups · Gallery
   · LinkInputs · Fx (brilho, magnetismo, tilt, progresso)
   ===================================================================== */
(function (global) {
  'use strict';

  /* ---------- Configuração ---------- */
  const CFG = {
    enterMs: 1000,                 // duração da cortina de entrada
    leaveMs: 650,                  // duração da cortina de saída antes de navegar
    stagger: 85,                   // atraso entre elementos em cascata (ms)
    variants: ['up', 'left', 'right', 'scale', 'rise'],
    magnetic: 0.22,                // força do efeito magnético
    tiltMax: 7,                    // inclinação máxima (graus) dos cards
    tabSwapMs: 300,                // tempo de saída antes de trocar de aba
    reduce: window.matchMedia('(prefers-reduced-motion: reduce)').matches
  };

  const $  = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const root = document.documentElement;
  const body = document.body;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignorar */ } }
  };
  const isAdsPage = () => body.classList.contains('ads-dark');

  /* =================================================================
     1. TRANSIÇÕES DE PÁGINA
     Entrada: cortina sai de cima para baixo e o conteúdo sobe.
     Saída: cortina sobe, o conteúdo se dissolve e só então navega.
     ================================================================= */
  const Transitions = {
    init() {
      root.classList.add('is-entering');
      window.setTimeout(() => root.classList.remove('is-entering'), CFG.enterMs + 350);

      // voltar pelo histórico (bfcache) não pode deixar a página "saindo"
      window.addEventListener('pageshow', (e) => {
        if (e.persisted) root.classList.remove('is-leaving');
      });

      document.addEventListener('click', (e) => {
        if (e.defaultPrevented || e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const a = e.target.closest('a[href]');
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return;

        let url;
        try { url = new URL(a.href, location.href); } catch (_) { return; }
        if (url.protocol !== location.protocol || url.host !== location.host) return;
        // âncoras da mesma página seguem o fluxo normal
        if (url.pathname === location.pathname && url.search === location.search) return;

        e.preventDefault();
        if (CFG.reduce || CFG.leaveMs === 0) { location.href = url.href; return; }
        root.classList.add('is-leaving');
        window.setTimeout(() => { location.href = url.href; }, CFG.leaveMs);
      });
    }
  };

  /* =================================================================
     2. TEMA CLARO / ESCURO
     Página A.D.S. tem tema próprio (dark de fábrica) e não recebe botão.
     ================================================================= */
  const SUN = '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const MOON = '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';

  const Theme = {
    init() {
      const header = $('#header');
      if (!header || isAdsPage() || $('#theme-toggle')) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'theme-toggle';
      btn.className = 'theme-toggle';
      btn.setAttribute('aria-label', 'Alternar tema claro/escuro');
      btn.innerHTML = MOON + SUN;

      const wrap = document.createElement('div');
      wrap.className = 'theme-controls';
      wrap.appendChild(btn);
      header.appendChild(wrap);

      this.apply(store.get('pw-theme') === 'dark', false);
      btn.addEventListener('click', () => {
        const dark = !body.classList.contains('dark');
        this.apply(dark, true);
        store.set('pw-theme', dark ? 'dark' : 'light');
      });
    },
    apply(dark, animate) {
      if (animate && !CFG.reduce) {
        root.classList.add('theme-anim');
        window.setTimeout(() => root.classList.remove('theme-anim'), 700);
      }
      body.classList.toggle('dark', dark);
      const t = $('#theme-toggle');
      if (t) t.setAttribute('aria-pressed', String(dark));
      document.dispatchEvent(new CustomEvent('pw:theme', { detail: { dark } }));
    }
  };

  /* =================================================================
     3. TEXTO DIVIDIDO (letras entram em cascata)
     Percorre os nós de texto preservando <em> e <br>.
     ================================================================= */
  const Split = {
    init() {
      $$('.hero h1, .page-banner h1, h1.reveal').forEach((h) => {
        if (h.dataset.split || h.closest('.trimestre') || h.querySelector('#typed')) return;
        h.dataset.split = '1';
        h.classList.add('split-h');
        let i = 0;

        const walk = (node) => {
          Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === Node.TEXT_NODE) {
              const frag = document.createDocumentFragment();
              child.textContent.split(/(\s+)/).forEach((part) => {
                if (!part) return;
                if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(' ')); return; }
                const word = document.createElement('span');
                word.className = 'w';
                for (const ch of part) {
                  const c = document.createElement('span');
                  c.className = 'ch';
                  c.style.setProperty('--i', i++);
                  c.textContent = ch;
                  word.appendChild(c);
                }
                frag.appendChild(word);
              });
              child.replaceWith(frag);
            } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
              walk(child);
            }
          });
        };
        walk(h);
      });
    }
  };

  /* =================================================================
     4. NAVEGAÇÃO, CABEÇALHO E PROGRESSO DE ROLAGEM
     ================================================================= */
  const Nav = {
    init() {
      const header = $('#header');
      const nav = $('#nav');
      const toggle = $('#nav-toggle');
      const bar = $('.scroll-progress');

      if (toggle && nav) {
        toggle.setAttribute('aria-expanded', 'false');
        toggle.addEventListener('click', () => {
          const open = nav.classList.toggle('open');
          toggle.setAttribute('aria-expanded', String(open));
        });
      }

      const onScroll = () => {
        if (header) header.classList.toggle('scrolled', window.scrollY > 12);
        if (bar) {
          const max = root.scrollHeight - window.innerHeight;
          bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll);
      onScroll();

      // marca o link da página atual
      const here = location.pathname.split('/').pop() || 'index.html';
      $$('#nav a').forEach((a) => {
        a.classList.toggle('active', a.getAttribute('href') === here);
      });
    }
  };

  /* =================================================================
     5. REVEAL — cada elemento entra com sua própria direção
     ================================================================= */
  const Reveal = {
    io: null,
    init() {
      const items = $$('.reveal');
      items.forEach((el, i) => {
        if (!el.dataset.v) el.dataset.v = CFG.variants[i % CFG.variants.length];
      });

      this.io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const siblings = el.parentElement
            ? Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'))
            : [el];
          const idx = Math.max(0, siblings.indexOf(el));
          el.style.transitionDelay = Math.min(idx, 8) * CFG.stagger + 'ms';
          el.classList.add('in');
          this.io.unobserve(el);
        });
      }, { threshold: 0.12, rootMargin: '0px 0px -60px 0px' });

      items.forEach((el) => this.io.observe(el));
    },

    // reexecuta a cascata dentro de um contêiner (usado ao trocar de aba)
    replay(container) {
      const items = $$('.reveal', container);
      items.forEach((el) => { el.classList.remove('in'); el.style.transitionDelay = ''; });
      void container.offsetWidth; // força reflow para reiniciar as transições
      items.forEach((el, i) => {
        el.style.transitionDelay = Math.min(i, 10) * CFG.stagger + 'ms';
        requestAnimationFrame(() => el.classList.add('in'));
      });
    }
  };

  /* =================================================================
     6. ABAS (trimestres e áreas) com indicador deslizante
     Saída do painel atual → troca → entrada em cascata do novo.
     ================================================================= */
  const Tabs = {
    init() {
      const btns = $$('.trimester-tab, .area-tab');
      const panels = $$('.trimester-section, .area-section');
      if (!btns.length) return;

      const wrap = btns[0].parentElement;
      const ind = document.createElement('span');
      ind.className = 'tab-indicator';
      ind.setAttribute('aria-hidden', 'true');
      wrap.prepend(ind);
      wrap.setAttribute('role', 'tablist');
      btns.forEach((b) => b.setAttribute('role', 'tab'));

      const keyOf = (el) => el.dataset.trimester ?? el.dataset.area;
      let busy = false;
      let current = btns.find((b) => b.classList.contains('active')) || btns[0];

      const place = (btn, instant = false) => {
        if (instant) ind.style.transition = 'none';
        ind.style.width = btn.offsetWidth + 'px';
        ind.style.transform = `translateX(${btn.offsetLeft}px)`;
        if (instant) { void ind.offsetWidth; ind.style.transition = ''; }
      };

      const enter = (panel) => {
        panel.classList.add('active');
        $$('.activity', panel).forEach((a, i) => a.style.setProperty('--i', i));
        Reveal.replay(panel);
        busy = false;
      };

      const show = (btn) => {
        if (busy || btn === current) return;
        busy = true;
        const k = keyOf(btn);
        const next = panels.find((p) => keyOf(p) === k);
        const prev = panels.find((p) => p.classList.contains('active'));

        btns.forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
        });
        place(btn);
        current = btn;

        if (!next) { busy = false; return; }
        if (prev && prev !== next && !CFG.reduce) {
          prev.classList.add('is-leaving');
          window.setTimeout(() => {
            prev.classList.remove('is-leaving', 'active');
            enter(next);
          }, CFG.tabSwapMs);
        } else {
          if (prev && prev !== next) prev.classList.remove('active');
          enter(next);
        }
      };

      btns.forEach((btn) => {
        btn.addEventListener('click', () => show(btn));
      });

      // posição inicial e recálculo ao redimensionar / carregar fontes
      place(current, true);
      window.addEventListener('resize', () => place(current, true));
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => place(current, true));
      }
    }
  };

  /* =================================================================
     7. POPUPS DE HABILIDADES
     ================================================================= */
  const Popups = {
    init() {
      const acts = $$('.activity');

      const close = (a) => {
        a.classList.remove('show-popup');
        const b = a.querySelector('.open-popup');
        const p = a.querySelector('.popup');
        if (b) b.setAttribute('aria-expanded', 'false');
        if (p) p.setAttribute('aria-hidden', 'true');
      };
      const open = (a) => {
        a.classList.add('show-popup');
        const b = a.querySelector('.open-popup');
        const p = a.querySelector('.popup');
        if (b) b.setAttribute('aria-expanded', 'true');
        if (p) p.setAttribute('aria-hidden', 'false');
      };
      const closeAll = (except) => acts.forEach((a) => { if (a !== except) close(a); });

      document.addEventListener('click', (e) => {
        const openBtn = e.target.closest('.open-popup');
        if (openBtn) {
          const a = openBtn.closest('.activity');
          if (!a) return;
          const was = a.classList.contains('show-popup');
          closeAll(a);
          was ? close(a) : open(a);
          return;
        }
        const closeBtn = e.target.closest('.close-popup');
        if (closeBtn) {
          const a = closeBtn.closest('.activity');
          if (a) close(a);
          return;
        }
        if (!e.target.closest('.activity')) closeAll();
      });

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeAll();
      });
    }
  };

  /* =================================================================
     8. GALERIA LATERAL (troca de mídia com esmaecimento)
     ================================================================= */
  const Gallery = {
    init() {
      $$('.activity--gallery').forEach((card) => {
        const frame = card.querySelector('iframe.gallery-frame');
        const btns = $$('.gallery-btn', card);
        if (!frame || !btns.length) return;

        btns.forEach((btn) => {
          btn.addEventListener('click', () => {
            btns.forEach((b) => b.classList.toggle('active', b === btn));
            frame.classList.add('swap');
            window.setTimeout(() => frame.classList.remove('swap'), 350);
            frame.src = btn.dataset.src;
          });
        });
      });
    }
  };

  /* =================================================================
     9. CAMPOS DE LINK (Enter salva e confirma no cartão)
     ================================================================= */
  const LinkInputs = {
    init() {
      $$('.link-input').forEach((inp) => {
        inp.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          const v = inp.value.trim();
          if (!v) return;
          const act = inp.closest('.activity');
          const dz = act && act.querySelector('[data-label]');
          if (dz) dz.textContent = '↗ link salvo';
          inp.blur();
        });
      });
    }
  };

  /* =================================================================
     10. EFEITOS DE INTERAÇÃO
     brilho que segue o cursor · magnetismo · tilt 3D · cursor glow
     ================================================================= */
  const Fx = {
    init() {
      if (CFG.reduce || !window.matchMedia('(pointer: fine)').matches) return;

      // brilho e tilt nos cartões
      $$('.area-card, .activity, .contact-card').forEach((el) => {
        const tilts = el.classList.contains('area-card') || el.classList.contains('contact-card');
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const x = e.clientX - r.left;
          const y = e.clientY - r.top;
          el.style.setProperty('--mx', x + 'px');
          el.style.setProperty('--my', y + 'px');
          if (tilts) {
            const rx = (y / r.height - 0.5) * -CFG.tiltMax;
            const ry = (x / r.width - 0.5) * CFG.tiltMax;
            el.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-6px)`;
          }
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      });

      // magnetismo em botões pequenos
      $$('.open-popup, .trimester-tab, .area-tab, .theme-toggle, .nav-toggle, .maply-btn, .chip').forEach((el) => {
        el.addEventListener('pointermove', (e) => {
          const r = el.getBoundingClientRect();
          const dx = (e.clientX - (r.left + r.width / 2)) * CFG.magnetic;
          const dy = (e.clientY - (r.top + r.height / 2)) * CFG.magnetic;
          el.style.translate = `${dx}px ${dy}px`;
        });
        el.addEventListener('pointerleave', () => { el.style.translate = ''; });
      });

      // cursor glow que persegue o ponteiro com inércia
      const glow = $('.cursor-glow');
      if (glow) {
        let gx = -999, gy = -999, tx = -999, ty = -999;
        window.addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
        const loop = () => {
          gx += (tx - gx) * 0.12;
          gy += (ty - gy) * 0.12;
          glow.style.transform = `translate3d(${gx}px, ${gy}px, 0)`;
          requestAnimationFrame(loop);
        };
        loop();
      }
    }
  };

  /* =================================================================
     BOOT
     ================================================================= */
  const boot = () => {
    Transitions.init();
    Theme.init();
    Split.init();
    Nav.init();
    Reveal.init();
    Tabs.init();
    Popups.init();
    Gallery.init();
    LinkInputs.init();
    Fx.init();
    global.Portfolio = { CFG, Reveal, Tabs, Theme, version: '2.0.0' };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(window);
