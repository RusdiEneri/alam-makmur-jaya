/**
 * js/animations.js
 * UD. Alam Makmur Jaya — Animation Engine
 *
 * Responsibilities:
 *  1. Add `loaded` class to <body> to trigger entrance animations.
 *  2. IntersectionObserver for `.animate-on-scroll` and `.stagger-children`.
 *  3. `animateCounter(el, from, to, duration)` — animated number counters.
 *  4. Page-transition helpers: `pageEnter(el)` and `pageExit(el, cb)`.
 *  5. Respects `prefers-reduced-motion`.
 *
 * Usage (HTML):
 *   <link rel="stylesheet" href="css/design-system.css">
 *   <link rel="stylesheet" href="css/animations.css">
 *   <script src="js/animations.js"></script>
 *
 * Usage (JS):
 *   // Counter:
 *   const el = document.querySelector('.stat-num');
 *   Animations.animateCounter(el, 0, 500, 1200);
 *
 *   // Page transition:
 *   Animations.pageExit(document.querySelector('main'), () => {
 *     window.location.href = 'next-page.html';
 *   });
 */

/* ─────────────────────────────────────────────────────────────
   UTILITY: detect user preference for reduced motion
   ───────────────────────────────────────────────────────────── */
const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;


/* ─────────────────────────────────────────────────────────────
   1. BODY "LOADED" CLASS
   Adds `.loaded` to <body> once the DOM is ready, which:
     - Fades the page in (removes opacity:0 set in animations.css)
     - Triggers stagger-children transitions for above-the-fold content
   ───────────────────────────────────────────────────────────── */
function initBodyLoaded() {
  const markLoaded = () => {
    document.body.classList.add('loaded');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markLoaded);
  } else {
    // Already parsed (script is deferred or at bottom of body)
    // Use a rAF so paint has a chance to commit first
    requestAnimationFrame(markLoaded);
  }
}


/* ─────────────────────────────────────────────────────────────
   2. INTERSECTION OBSERVER — Scroll-triggered animations
   Targets:
     - `.animate-on-scroll`  → adds `.is-visible`
     - `.stagger-children`   → adds `.is-visible`
   ───────────────────────────────────────────────────────────── */
function initScrollAnimations() {
  if (!('IntersectionObserver' in window)) {
    // Fallback: make everything visible immediately
    document.querySelectorAll('.animate-on-scroll, .stagger-children')
      .forEach(el => el.classList.add('is-visible'));
    return;
  }

  // If user prefers reduced motion, show everything immediately
  if (prefersReducedMotion()) {
    document.querySelectorAll('.animate-on-scroll, .stagger-children')
      .forEach(el => el.classList.add('is-visible'));
    return;
  }

  const observerOptions = {
    root: null,              // viewport
    rootMargin: '0px 0px -60px 0px',  // trigger slightly before bottom edge
    threshold: 0.1,
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');

        // Stop observing once revealed (one-shot animation)
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  // Observe all scroll-animated elements
  document
    .querySelectorAll('.animate-on-scroll, .stagger-children')
    .forEach(el => observer.observe(el));

  // Re-observe elements added dynamically (e.g. after API calls)
  // Call `Animations.observeNew(container)` to pick up new nodes
  return observer;
}


/* ─────────────────────────────────────────────────────────────
   3. ANIMATE COUNTER
   Smoothly counts a number element from `from` to `to`
   over `duration` milliseconds using requestAnimationFrame.

   @param {HTMLElement} element   - the element whose textContent to update
   @param {number}      from      - starting number
   @param {number}      to        - ending number
   @param {number}      duration  - animation duration in ms (default 1200)
   @param {object}      [opts]
   @param {string}      [opts.prefix='']    - prepend string (e.g. 'Rp ')
   @param {string}      [opts.suffix='']    - append string (e.g. '+', '%')
   @param {number}      [opts.decimals=0]   - decimal places
   @param {Function}    [opts.formatter]    - custom number formatter
   ───────────────────────────────────────────────────────────── */
function animateCounter(element, from, to, duration = 1200, opts = {}) {
  if (!element) return;

  const {
    prefix = '',
    suffix = '',
    decimals = 0,
    formatter = null,
  } = opts;

  // Skip animation if reduced motion is preferred
  if (prefersReducedMotion()) {
    const finalText = formatter
      ? formatter(to)
      : `${prefix}${to.toFixed(decimals)}${suffix}`;
    element.textContent = finalText;
    element.classList.add('counter-animated');
    return;
  }

  const startTime = performance.now();
  const range = to - from;

  // Easing function: ease-out-quart
  const easeOutQuart = t => 1 - Math.pow(1 - t, 4);

  const tick = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuart(progress);
    const current = from + range * easedProgress;

    const displayValue = formatter
      ? formatter(current)
      : `${prefix}${current.toFixed(decimals)}${suffix}`;

    element.textContent = displayValue;

    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      // Ensure exact final value
      const finalText = formatter
        ? formatter(to)
        : `${prefix}${to.toFixed(decimals)}${suffix}`;
      element.textContent = finalText;
      element.classList.add('counter-animated');
    }
  };

  requestAnimationFrame(tick);
}


/* ─────────────────────────────────────────────────────────────
   ANIMATE COUNTERS ON SCROLL
   Automatically hooks up `[data-counter]` elements.
   HTML usage:
     <span data-counter data-from="0" data-to="500"
           data-duration="1200" data-suffix="+"
           data-prefix="" data-decimals="0">500+</span>
   ───────────────────────────────────────────────────────────── */
function initCounterObserver() {
  if (!('IntersectionObserver' in window) || prefersReducedMotion()) return;

  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const el = entry.target;
      const from     = parseFloat(el.dataset.from  ?? 0);
      const to       = parseFloat(el.dataset.to    ?? 0);
      const duration = parseInt(el.dataset.duration ?? 1200, 10);
      const prefix   = el.dataset.prefix ?? '';
      const suffix   = el.dataset.suffix ?? '';
      const decimals = parseInt(el.dataset.decimals ?? 0, 10);

      animateCounter(el, from, to, duration, { prefix, suffix, decimals });
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('[data-counter]')
    .forEach(el => counterObserver.observe(el));
}


/* ─────────────────────────────────────────────────────────────
   4. PAGE TRANSITIONS
   ───────────────────────────────────────────────────────────── */

/**
 * pageEnter(element)
 * Adds `.page-enter` to `element`, then removes it after the
 * animation completes.
 * @param {HTMLElement} element
 */
function pageEnter(element) {
  if (!element) return;
  if (prefersReducedMotion()) return;

  element.classList.add('page-enter');
  const onEnd = () => {
    element.classList.remove('page-enter');
    element.removeEventListener('animationend', onEnd);
  };
  element.addEventListener('animationend', onEnd);
}

/**
 * pageExit(element, callback)
 * Adds `.page-exit` to `element`, waits for the animation to
 * finish, then invokes `callback` (usually navigation).
 * @param {HTMLElement} element
 * @param {Function}    callback   - called after animation
 */
function pageExit(element, callback) {
  if (!element || typeof callback !== 'function') {
    if (typeof callback === 'function') callback();
    return;
  }

  if (prefersReducedMotion()) {
    callback();
    return;
  }

  element.classList.add('page-exit');
  const onEnd = () => {
    element.classList.remove('page-exit');
    element.removeEventListener('animationend', onEnd);
    callback();
  };
  element.addEventListener('animationend', onEnd);
}


/* ─────────────────────────────────────────────────────────────
   5. OBSERVE NEW ELEMENTS (dynamic content)
   Call after injecting new HTML (e.g. product cards from API).
   @param {HTMLElement} [container=document]
   ───────────────────────────────────────────────────────────── */
let _scrollObserver = null; // stored after init

function observeNew(container = document) {
  if (!_scrollObserver || prefersReducedMotion()) return;
  container
    .querySelectorAll('.animate-on-scroll:not(.is-visible), .stagger-children:not(.is-visible)')
    .forEach(el => _scrollObserver.observe(el));
}


/* ─────────────────────────────────────────────────────────────
   INIT — auto-runs when the script is loaded
   ───────────────────────────────────────────────────────────── */
(function init() {
  initBodyLoaded();

  // Defer scroll observers until DOMContentLoaded
  const startObservers = () => {
    _scrollObserver = initScrollAnimations();
    initCounterObserver();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObservers);
  } else {
    startObservers();
  }
})();


/* ─────────────────────────────────────────────────────────────
   PUBLIC API
   Expose on `window.Animations` for use from inline scripts
   and other JS files.
   ───────────────────────────────────────────────────────────── */
window.Animations = {
  animateCounter,
  pageEnter,
  pageExit,
  observeNew,
  prefersReducedMotion,
};
