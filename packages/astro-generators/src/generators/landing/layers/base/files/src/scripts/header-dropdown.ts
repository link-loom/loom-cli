/*
 * Header dropdown — click toggle + outside-click close + ESC close.
 * Hover behavior is CSS-only (see Header.astro styles); this script handles
 * keyboard and touch interactions.
 */

const dropdowns = document.querySelectorAll<HTMLElement>('[data-dropdown]');

dropdowns.forEach((wrap) => {
  const trigger = wrap.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
  if (!trigger) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.toggle('is-open');
    trigger.setAttribute('aria-expanded', String(isOpen));
    // Close other open dropdowns.
    dropdowns.forEach((other) => {
      if (other !== wrap && other.classList.contains('is-open')) {
        other.classList.remove('is-open');
        other.querySelector('[data-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
      }
    });
  });
});

// Close on outside click.
document.addEventListener('click', (e) => {
  dropdowns.forEach((wrap) => {
    if (!wrap.contains(e.target as Node) && wrap.classList.contains('is-open')) {
      wrap.classList.remove('is-open');
      wrap.querySelector('[data-dropdown-trigger]')?.setAttribute('aria-expanded', 'false');
    }
  });
});

// Close on Escape.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  dropdowns.forEach((wrap) => {
    if (wrap.classList.contains('is-open')) {
      wrap.classList.remove('is-open');
      const trigger = wrap.querySelector<HTMLButtonElement>('[data-dropdown-trigger]');
      trigger?.setAttribute('aria-expanded', 'false');
      trigger?.focus();
    }
  });
});

export {};
