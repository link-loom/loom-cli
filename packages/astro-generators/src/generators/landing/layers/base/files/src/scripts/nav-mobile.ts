/*
 * Mobile nav drawer
 * =================
 * Toggles [data-mobile-nav] open / closed when the user clicks
 * [data-menu-toggle] / [data-menu-close]. ESC closes too.
 */

function open(nav: HTMLElement, toggle: HTMLElement | null) {
  nav.hidden = false;
  // give the browser one frame to apply hidden=false before the transition
  requestAnimationFrame(() => {
    nav.dataset.open = 'true';
  });
  toggle?.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
}

function close(nav: HTMLElement, toggle: HTMLElement | null) {
  nav.dataset.open = 'false';
  toggle?.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => {
    nav.hidden = true;
  }, 240);
}

function init() {
  const nav = document.querySelector<HTMLElement>('[data-mobile-nav]');
  if (!nav) return;
  const toggle = document.querySelector<HTMLElement>('[data-menu-toggle]');
  const closeBtn = nav.querySelector<HTMLElement>('[data-menu-close]');

  toggle?.addEventListener('click', () => {
    const isOpen = nav.dataset.open === 'true';
    if (isOpen) {
      close(nav, toggle);
    } else {
      open(nav, toggle);
    }
  });

  closeBtn?.addEventListener('click', () => close(nav, toggle));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.dataset.open === 'true') {
      close(nav, toggle);
    }
  });

  // close when a nav link inside is clicked
  nav.querySelectorAll<HTMLAnchorElement>('a').forEach((a) => {
    a.addEventListener('click', () => close(nav, toggle));
  });

  // The search overlay opened from inside the drawer: the drawer steps out of the way.
  document.addEventListener('site:search:open', () => {
    if (nav.dataset.open === 'true') close(nav, toggle);
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}

export {};
