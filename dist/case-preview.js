(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const cards = Array.from(document.querySelectorAll('[data-case-preview]'));
  document.documentElement.classList.toggle('case-preview-motion', !reduced.matches);
  reduced.addEventListener('change', () => document.documentElement.classList.toggle('case-preview-motion', !reduced.matches));
  cards.forEach(card => {
    const stage = card.querySelector('.preview-stage'), button = card.querySelector('.preview-pause');
    let paused = false, frame = 0, panel = 0;
    const update = () => { frame = 0; card.style.setProperty('--preview-panel', String(panel)); };
    stage.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches || paused) return;
      const rect = stage.getBoundingClientRect();
      panel = Math.max(0, Math.min(2, Math.floor((event.clientX - rect.left) / rect.width * 3)));
      card.classList.add('is-interacting');
      if (!frame) frame = requestAnimationFrame(update);
    });
    stage.addEventListener('pointerleave', () => card.classList.remove('is-interacting'));
    button.addEventListener('click', () => {
      paused = !paused;
      card.classList.toggle('is-paused', paused);
      card.classList.remove('is-interacting');
      button.setAttribute('aria-pressed', String(paused));
      button.setAttribute('aria-label', paused ? 'Продолжить анимацию карточки' : 'Приостановить анимацию карточки');
      button.textContent = paused ? 'Продолжить' : 'Пауза';
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => card.classList.toggle('is-inview', entry.isIntersecting)), { threshold: .1 });
      observer.observe(card);
    } else card.classList.add('is-inview');
  });
})();
