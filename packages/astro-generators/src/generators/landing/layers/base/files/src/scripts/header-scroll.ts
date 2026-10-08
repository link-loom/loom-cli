/*
 * Header scroll state
 * ===================
 * Toggles `data-scrolled` on [data-header] after 8px of vertical scroll.
 */

function init() {
  const header = document.querySelector<HTMLElement>('[data-header]');
  if (!header) return;

  let ticking = false;
  const apply = () => {
    const scrolled = window.scrollY > 8;
    header.dataset.scrolled = scrolled ? 'true' : 'false';
    ticking = false;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(apply);
  };

  apply();
  window.addEventListener('scroll', onScroll, { passive: true });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

export {};
