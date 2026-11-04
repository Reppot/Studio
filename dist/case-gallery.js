(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const items = Array.from(document.querySelectorAll('[data-case-reveal], .screen-collage, .screenshot-showcase'));
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        entry.target.classList.toggle('is-inview', entry.isIntersecting);
        if (entry.isIntersecting) entry.target.classList.add('is-visible');
      });
    }, { threshold: .12, rootMargin: '0px 0px -20px 0px' });
    items.forEach(item => observer.observe(item));
    if (!reduced.matches) root.classList.add('case-motion');
  }
  reduced.addEventListener('change', () => root.classList.toggle('case-motion', !reduced.matches));
  document.querySelectorAll('[data-screen-tilt]').forEach(surface => {
    let frame = 0, x = 0, y = 0;
    const render = () => {
      frame = 0;
      surface.style.setProperty('--screen-rx', y.toFixed(2) + 'deg');
      surface.style.setProperty('--screen-ry', x.toFixed(2) + 'deg');
    };
    surface.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches) return;
      const box = surface.getBoundingClientRect();
      x = ((event.clientX - box.left) / box.width - .5) * 5;
      y = (.5 - (event.clientY - box.top) / box.height) * 4;
      if (!frame) frame = requestAnimationFrame(render);
    });
    surface.addEventListener('pointerleave', () => { x = y = 0; if (!frame) frame = requestAnimationFrame(render); });
  });

  const gallery = document.querySelector('[data-gallery]');
  if (!gallery) return;
  const tabs = Array.from(gallery.querySelectorAll('[data-shot]'));
  const stage = gallery.querySelector('[data-shot-stage]');
  const image = gallery.querySelector('[data-active-shot]');
  const caption = gallery.querySelector('[data-shot-caption]');
  const count = gallery.querySelector('[data-shot-count]');
  const dialog = document.querySelector('.shot-lightbox');
  const largeImage = dialog.querySelector('[data-lightbox-image]');
  const zoomButton = dialog.querySelector('[data-shot-zoom]');
  const largeFrame = dialog.querySelector('.lightbox-image');
  let active = 0, sequence = 0, lastFocus = null, imageAnimation = null;
  const number = index => String(index + 1).padStart(2, '0') + ' / ' + String(tabs.length).padStart(2, '0');
  function updateDialog() {
    largeImage.src = tabs[active].dataset.shot;
    largeImage.alt = tabs[active].dataset.alt;
    dialog.querySelector('[data-lightbox-title]').textContent = tabs[active].textContent.trim();
    dialog.querySelector('[data-lightbox-count]').textContent = number(active);
  }
  async function select(index, focus = false) {
    const ticket = ++sequence;
    active = (index + tabs.length) % tabs.length;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === active)); tab.tabIndex = i === active ? 0 : -1; });
    if (focus) tabs[active].focus();
    const tab = tabs[active], preload = new Image();
    preload.src = tab.dataset.shot;
    try { await preload.decode(); } catch (_) {}
    if (ticket !== sequence) return;
    image.src = tab.dataset.shot;
    image.alt = tab.dataset.alt;
    stage.setAttribute('aria-labelledby', tab.id);
    caption.textContent = tab.dataset.caption;
    count.textContent = number(active);
    if (imageAnimation) imageAnimation.cancel();
    if (!reduced.matches) imageAnimation = image.animate(
      [{ opacity: .25, transform: 'translateY(16px) scale(1.015)' }, { opacity: 1, transform: 'none' }],
      { duration: 550, easing: 'cubic-bezier(.2,.75,.25,1)' }
    );
    if (dialog.open) updateDialog();
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = index + 1;
      if (event.key === 'ArrowLeft') next = index - 1;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next === undefined) return;
      event.preventDefault(); select(next, true);
    });
  });
  function open() {
    if (!dialog.showModal) return;
    lastFocus = document.activeElement;
    largeFrame.classList.remove('is-zoomed'); zoomButton.textContent = 'Масштаб 100%'; zoomButton.setAttribute('aria-pressed', 'false');
    updateDialog(); dialog.showModal(); document.body.classList.add('shot-open');
    if (!reduced.matches) largeImage.animate([{ opacity: 0, transform: 'scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'ease-out' });
  }
  gallery.querySelector('[data-open-shot]').addEventListener('click', open);
  function zoom() {
    const active = largeFrame.classList.toggle('is-zoomed');
    zoomButton.textContent = active ? 'Вписать в экран' : 'Масштаб 100%';
    zoomButton.setAttribute('aria-pressed', String(active));
  }
  zoomButton.addEventListener('click', zoom);
  largeImage.addEventListener('click', zoom);
  stage.addEventListener('click', open);
  stage.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); }
    if (event.key === 'ArrowRight') { event.preventDefault(); select(active + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); select(active - 1); }
  });
  dialog.querySelector('[data-close-shot]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-shot-prev]').addEventListener('click', () => select(active - 1));
  dialog.querySelector('[data-shot-next]').addEventListener('click', () => select(active + 1));
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowRight') { event.preventDefault(); select(active + 1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); select(active - 1); }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.classList.remove('shot-open'); if (lastFocus) lastFocus.focus({ preventScroll: true }); });
})();
