/**
 * PrepWays – shared interactions for every page.
 * Theme switching, loader, nav, scroll reveals, 3D tilt, counters,
 * typewriter, page transitions, forms and the lazy-loaded Three.js scene.
 * Styles are linked directly in each page's <head> so they load before first paint.
 */
import { initInstall } from './install.js';

const THEME_KEY = 'prepways-theme';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ------------------------------------------------------------- theme */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage may be disabled – theme still applies for this page */
  }
  $$('[data-theme-toggle]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(theme === 'light'));
    btn.setAttribute('aria-label', theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  });
  window.dispatchEvent(new CustomEvent('prepways:themechange', { detail: { theme } }));
}

function initTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

  $$('[data-theme-toggle]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      if (!document.startViewTransition || reduceMotion) {
        applyTheme(next);
        return;
      }
      // Circular reveal from the toggle button
      const x = e.clientX || window.innerWidth - 60;
      const y = e.clientY || 40;
      const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      const transition = document.startViewTransition(() => applyTheme(next));
      transition.ready.then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
          { duration: 750, easing: 'cubic-bezier(0.7, 0, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
        );
      });
    }),
  );
}

/* ------------------------------------------------------------ loader */
function initLoader() {
  // Arrived from another PrepWays page: skip the loader and start the intro
  // animations right after the first frame, while the page is fading in.
  if (document.documentElement.classList.contains('is-nav')) {
    requestAnimationFrame(() => setTimeout(() => document.body.classList.add('is-loaded'), 120));
    return;
  }
  const start = performance.now();
  const done = () => {
    const wait = Math.max(0, 700 - (performance.now() - start));
    setTimeout(() => document.body.classList.add('is-loaded'), reduceMotion ? 0 : wait);
  };
  if (document.readyState === 'complete') done();
  else window.addEventListener('load', done, { once: true });
  // Safety net in case a slow asset blocks the load event
  setTimeout(() => document.body.classList.add('is-loaded'), 3500);
}

/* ---------------------------------------------------------- nav etc. */
function initNav() {
  const nav = $('.nav');
  const toggle = $('.nav__toggle');
  const progress = $('.scroll-progress');
  const toTop = $('.to-top');

  const onScroll = () => {
    const y = window.scrollY;
    nav?.classList.toggle('is-scrolled', y > 20);
    toTop?.classList.toggle('is-shown', y > 700);
    const max = document.documentElement.scrollHeight - innerHeight;
    progress?.style.setProperty('--progress', max > 0 ? (y / max).toFixed(4) : 0);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const menu = $('.nav__links');
  const isOpen = () => nav?.classList.contains('is-open');
  const setMenu = (open) => {
    nav?.classList.toggle('is-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    toggle?.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };

  toggle?.addEventListener('click', () => setMenu(!isOpen()));
  $$('.nav__links a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // Tapping anywhere outside the menu card (and its ☰ button) closes it
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (isOpen() && !menu?.contains(e.target) && !toggle?.contains(e.target)) setMenu(false);
    },
    { passive: true },
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      setMenu(false);
      toggle?.focus();
    }
  });

  toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
}

/* ------------------------------------------------------ scroll reveal */
function initReveal() {
  const els = $$('[data-reveal], .step, [data-reveal-group]');
  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  );
  els.forEach((el) => io.observe(el));
}

/* ------------------------------------------------- journey line draw */
function initJourney() {
  const journeys = $$('.journey');
  if (!journeys.length) return;
  const update = () => {
    journeys.forEach((j) => {
      const r = j.getBoundingClientRect();
      const p = (innerHeight * 0.85 - r.top) / (r.height + innerHeight * 0.3);
      j.style.setProperty('--line', Math.min(1, Math.max(0, p)).toFixed(3));
    });
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* ----------------------------------------------------------- 3D tilt */
function initTilt() {
  if (!finePointer || reduceMotion) return;
  $$('[data-tilt]').forEach((card) => {
    const max = Number(card.dataset.tilt) || 10;
    let frame = 0;
    card.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        card.classList.add('is-tilting');
        card.style.setProperty('--ry', `${(px - 0.5) * max * 2}deg`);
        card.style.setProperty('--rx', `${(0.5 - py) * max * 2}deg`);
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
      });
    });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      card.classList.remove('is-tilting');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

/* --------------------------------------------------- magnetic buttons */
function initMagnetic() {
  if (!finePointer || reduceMotion) return;
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    });
    el.addEventListener('pointerleave', () => (el.style.transform = ''));
  });
}

/* --------------------------------------------------------- cursor glow */
function initCursorGlow() {
  const glow = $('.cursor-glow');
  if (!glow || !finePointer || reduceMotion) return;
  let x = innerWidth / 2;
  let y = innerHeight / 2;
  let cx = x;
  let cy = y;
  window.addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX;
      y = e.clientY;
      document.body.classList.add('has-pointer');
    },
    { passive: true },
  );
  const tick = () => {
    cx += (x - cx) * 0.12;
    cy += (y - cy) * 0.12;
    glow.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
    requestAnimationFrame(tick);
  };
  tick();
}

/* ------------------------------------------------------------ counters */
function initCounters() {
  const els = $$('[data-count]');
  if (!els.length) return;
  const fmt = new Intl.NumberFormat('en-IN');
  const run = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix ?? '';
    if (reduceMotion) {
      el.textContent = fmt.format(target) + suffix;
      return;
    }
    const duration = 2000;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = fmt.format(Math.round(target * eased)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (e.isIntersecting) {
          run(e.target);
          io.unobserve(e.target);
        }
      }),
    { threshold: 0.6 },
  );
  els.forEach((el) => io.observe(el));
}

/* ---------------------------------------------------------- typewriter */
function initRotator() {
  $$('[data-rotate]').forEach((el) => {
    const words = el.dataset.rotate.split('|');
    // Optional per-word ending shown in another element, e.g. "college." / "school."
    const tails = el.dataset.rotateTail?.split('|');
    const tailEl = el.dataset.rotateTailTarget && $(el.dataset.rotateTailTarget);
    const setTail = (i) => {
      if (tailEl && tails?.[i] !== undefined) tailEl.textContent = tails[i];
    };
    if (reduceMotion || words.length < 2) return;
    let w = 0; // current word index
    let c = words[0].length; // visible characters
    let deleting = true;
    el.textContent = words[0];
    setTail(0);
    const tick = () => {
      c += deleting ? -1 : 1;
      el.textContent = words[w].slice(0, c);
      let delay = deleting ? 45 : 90;
      if (deleting && c === 0) {
        // fully erased → start typing the next word
        deleting = false;
        w = (w + 1) % words.length;
        setTail(w);
        delay = 300;
      } else if (!deleting && c === words[w].length) {
        // fully typed → hold, then erase
        deleting = true;
        delay = 2200;
      }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 2600);
  });
}

/* ------------------------------------------------- page transitions */
const NAV_KEY = 'prepways-nav';

function initPageTransitions() {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if ((a.target && a.target !== '_self') || a.hasAttribute('download')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin) return;
    if (url.pathname === location.pathname && url.search === location.search && url.hash) return; // in-page anchor

    // Tells the next page to skip the loader (read by the inline <head> script)
    try {
      sessionStorage.setItem(NAV_KEY, '1');
    } catch {
      /* storage disabled – the next page simply shows its loader */
    }
    if (reduceMotion) return;

    e.preventDefault();
    document.body.classList.add('is-leaving');
    setTimeout(() => (location.href = url.href), 380);
  });
  // Restore when coming back through the back/forward cache
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) document.body.classList.remove('is-leaving');
  });
}

/* --------------------------------------------------------------- forms */
function showToast(message) {
  let toast = $('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML =
      '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg><span></span>';
    document.body.append(toast);
  }
  toast.querySelector('span').textContent = message;
  toast.classList.add('is-shown');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('is-shown'), 4200);
}

function fieldMessage(input) {
  const v = input.validity;
  if (v.valueMissing) return input.type === 'checkbox' ? 'Please select at least one option.' : 'This field is required.';
  if (v.typeMismatch && input.type === 'email') return 'Please enter a valid email address.';
  if (v.patternMismatch) return input.dataset.patternMsg || 'Please match the requested format.';
  if (v.tooShort) return `Please enter at least ${input.minLength} characters.`;
  return '';
}

function initForms() {
  $$('form[data-form]').forEach((form) => {
    const setError = (input) => {
      const msg = fieldMessage(input);
      const errId = input.getAttribute('aria-describedby');
      const errEl = errId && document.getElementById(errId);
      input.setAttribute('aria-invalid', String(Boolean(msg)));
      if (errEl) errEl.textContent = msg;
      return !msg;
    };

    // Checkbox groups: at least one required
    const groups = $$('[data-required-group]', form);
    const groupValid = (g) => {
      const ok = $$('input[type="checkbox"]', g).some((c) => c.checked);
      const err = $('.field-error', g);
      if (err) err.textContent = ok ? '' : 'Please select at least one option.';
      return ok;
    };

    $$('input, select, textarea', form).forEach((input) => {
      if (input.type === 'checkbox') return;
      input.addEventListener('blur', () => setError(input));
      input.addEventListener('input', () => input.getAttribute('aria-invalid') === 'true' && setError(input));
    });
    groups.forEach((g) => g.addEventListener('change', () => groupValid(g)));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = $$('input:not([type="checkbox"]):not([type="hidden"]), select, textarea', form);
      const results = inputs.map(setError);
      const groupResults = groups.map(groupValid);
      const firstBad = inputs.find((_, i) => !results[i]);
      if (firstBad || groupResults.includes(false)) {
        (firstBad || $('input', groups[groupResults.indexOf(false)]))?.focus();
        return;
      }
      // No backend is wired up yet – hook your API call in here.
      const name = (new FormData(form).get('name') || '').toString().trim().split(' ')[0];
      showToast(form.dataset.success?.replace('{name}', name || 'there') || 'Thanks! We will reach out shortly.');
      form.reset();
      inputs.forEach((i) => i.removeAttribute('aria-invalid'));
    });
  });
}

/* ------------------------------------------------------------ flip cards */
function initFlipCards() {
  // Keyboard / touch support for flip cards (hover handles mouse users)
  $$('.flip').forEach((card) => {
    card.addEventListener('click', () => card.classList.toggle('is-flipped'));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.classList.toggle('is-flipped');
      }
    });
  });
}

/* ------------------------------------------------------------- 3D scene */
function initScene() {
  const canvas = $('canvas[data-scene]');
  if (!canvas) return;
  import('./scene.js')
    .then(({ initScene: start }) => start(canvas, canvas.dataset.scene))
    .catch((err) => console.warn('[PrepWays] 3D scene failed to load', err));
}

/* ------------------------------------------- plan buttons → form select */
function initPlanLinks() {
  $$('[data-select-plan]').forEach((link) =>
    link.addEventListener('click', () => {
      const select = $('select[name="plan"]');
      if (!select) return;
      select.value = link.dataset.selectPlan;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }),
  );
}

/* ------------------------------------------------------ rank predictor */
function initPredictorCard() {
  const root = $('[data-predictor]');
  if (!root) return;
  import('./predictor.js')
    .then(({ initPredictor }) => initPredictor(root))
    .catch((err) => console.warn('[PrepWays] rank predictor failed to load', err));
}

/* ------------------------------------------------- hero card showcase */
// Cards slide one by one on a timer. Swiping, the arrows and the dots work
// too, and the timer pauses while the visitor is interacting with it.
function initShowcase() {
  const root = $('[data-showcase]');
  if (!root) return;
  const viewport = $('.showcase__viewport', root);
  const slides = $$('.scard', root);
  const dots = $$('.showcase__dots button', root);
  const INTERVAL = 4500;
  let index = 0;
  let resumeAt = 0;
  let hovering = false;
  let onScreen = true;

  const hold = (ms = 7000) => {
    resumeAt = performance.now() + ms;
  };

  const setActive = (i) => {
    index = i;
    slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
    dots.forEach((d, n) => {
      d.classList.toggle('is-active', n === i);
      d.setAttribute('aria-current', String(n === i));
    });
  };

  const go = (i, smooth = true) => {
    const n = (i + slides.length) % slides.length;
    const s = slides[n];
    const left = s.offsetLeft - (viewport.clientWidth - s.offsetWidth) / 2;
    viewport.scrollTo({ left, behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
    setActive(n);
  };

  // Keep the highlighted card in sync while the user swipes
  let frame = 0;
  viewport.addEventListener(
    'scroll',
    () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const centre = viewport.scrollLeft + viewport.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        slides.forEach((s, n) => {
          const dist = Math.abs(s.offsetLeft + s.offsetWidth / 2 - centre);
          if (dist < bestDist) {
            bestDist = dist;
            best = n;
          }
        });
        if (best !== index) setActive(best);
      });
    },
    { passive: true },
  );

  dots.forEach((d, n) =>
    d.addEventListener('click', () => {
      hold();
      go(n);
    }),
  );
  $('[data-showcase-prev]', root)?.addEventListener('click', () => {
    hold();
    go(index - 1);
  });
  $('[data-showcase-next]', root)?.addEventListener('click', () => {
    hold();
    go(index + 1);
  });
  viewport.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      hold();
      go(index + (e.key === 'ArrowRight' ? 1 : -1));
    }
  });

  // Pause while touching, hovering or focused
  viewport.addEventListener('pointerdown', () => hold(9000), { passive: true });
  root.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && (hovering = true));
  root.addEventListener('pointerleave', () => (hovering = false));
  root.addEventListener('focusin', () => (hovering = true));
  root.addEventListener('focusout', () => (hovering = false));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => (onScreen = entry.isIntersecting), { threshold: 0.3 }).observe(root);
  }

  setActive(0);
  go(0, false);
  window.addEventListener('resize', () => go(index, false));

  if (reduceMotion) return; // swipe/arrows still work, but nothing moves by itself
  setInterval(() => {
    if (document.hidden || hovering || !onScreen || performance.now() < resumeAt) return;
    go(index + 1);
  }, INTERVAL);
}

/* ----------------------------------------------------------------- boot */
initTheme();
initLoader();
initNav();
initReveal();
initJourney();
initTilt();
initMagnetic();
initCursorGlow();
initCounters();
initRotator();
initPageTransitions();
initForms();
initFlipCards();
initPlanLinks();
initPredictorCard();
initShowcase();
initInstall();
initScene();
$$('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()));
