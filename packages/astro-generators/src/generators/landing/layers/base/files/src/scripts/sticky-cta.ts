/*
 * Sticky CTA — show after 30% scroll, hide near footer.
 */

function init() {
  const cta = document.querySelector<HTMLElement>('[data-sticky-cta]');
  if (!cta) return;

  let ticking = false;
  const apply = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) {
      cta.dataset.visible = 'false';
      cta.setAttribute('aria-hidden', 'true');
      cta.setAttribute('tabindex', '-1');
      ticking = false;
      return;
    }
    const ratio = window.scrollY / max;
    const visible = ratio > 0.3 && ratio < 0.93;
    cta.dataset.visible = visible ? 'true' : 'false';
    cta.setAttribute('aria-hidden', visible ? 'false' : 'true');
    cta.setAttribute('tabindex', visible ? '0' : '-1');
    ticking = false;
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  };
  apply();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

export {};
