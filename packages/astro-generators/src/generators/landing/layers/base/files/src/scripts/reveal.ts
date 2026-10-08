/*
 * Reveal animation — IntersectionObserver wrapper
 * ===============================================
 * Adds `.is-revealed` to any element with `data-reveal` when it enters
 * the viewport. CSS does the rest (see base/reveal.scss).
 *
 * Optional per-element stagger:
 *   <div data-reveal style="--reveal-delay: 120ms">
 */

const REVEAL_SELECTOR = '[data-reveal]:not(.is-revealed)';
const REVEAL_OBSERVED = new WeakSet<Element>();

function reveal(target: Element) {
  target.classList.add('is-revealed');
}

function init() {
  const candidates = Array.from(document.querySelectorAll(REVEAL_SELECTOR));
  if (candidates.length === 0) return;

  if (typeof IntersectionObserver === 'undefined') {
    // No IO support — reveal everything immediately.
    candidates.forEach(reveal);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // Reveal when entering the viewport — or when already scrolled past
        // (instant jumps / anchors would otherwise leave content invisible).
        if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
          reveal(entry.target);
          io.unobserve(entry.target);
        }
      }
    },
    {
      root: null,
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.1,
    },
  );

  for (const el of candidates) {
    if (REVEAL_OBSERVED.has(el)) continue;
    REVEAL_OBSERVED.add(el);
    io.observe(el);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

export {};
