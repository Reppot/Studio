(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const header = $('.site-header'), menu = $('.menu-toggle'), nav = $('.main-nav');
  if('ResizeObserver' in window)new ResizeObserver(()=>document.documentElement.style.setProperty('--site-header-height',header.getBoundingClientRect().height+'px')).observe(header);
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

  function syncMotionPreference() {
    document.documentElement.classList.toggle('motion-ready', !reduced.matches && 'IntersectionObserver' in window);
    document.documentElement.classList.toggle('ambient-paused', reduced.matches);
  }
  reduced.addEventListener('change', syncMotionPreference);
  syncMotionPreference();

  function setMenu(open) {
    nav.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    $('span', menu).textContent = open ? 'Закрыть' : 'Меню';
  }
  menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  $$('a', nav).forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', event => {
    if (menu.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') { setMenu(false); menu.focus(); }
    if (event.key === 'Tab') {
      const links = $$('a', nav), first = menu, last = links[links.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
  matchMedia('(max-width: 700px)').addEventListener('change', event => { if (!event.matches) setMenu(false); });

  if ('IntersectionObserver' in window) {
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        reveals.unobserve(entry.target);
      });
    }, { threshold: .08, rootMargin: '0px 0px -30px 0px' });
    $$('[data-reveal]').forEach(element => reveals.observe(element));
  }

  $$('details').forEach(details => {
    const summary = $('summary', details), body = $('.disclosure-body', details);
    let animation = null, desiredOpen = details.open;
    summary.addEventListener('click', event => {
      event.preventDefault();
      const start = details.getBoundingClientRect().height;
      desiredOpen = animation ? !desiredOpen : !details.open;
      if (animation) animation.cancel();
      if (reduced.matches || !details.animate) {
        details.open = desiredOpen; details.style.height = ''; animation = null; return;
      }
      details.open = true;
      const end = desiredOpen ? summary.offsetHeight + body.offsetHeight + 1 : summary.offsetHeight + 1;
      details.style.height = start + 'px';
      animation = details.animate({ height: [start + 'px', end + 'px'] }, { duration: 420, easing: 'cubic-bezier(.2,.75,.25,1)' });
      const current = animation;
      animation.onfinish = () => {
        if (animation !== current) return;
        details.open = desiredOpen; details.style.height = ''; animation = null; requestUpdate();
      };
    });
  });

  const steps = $$('.process-step'), process = $('.process-steps'), counter = $('.counter-current');
  const ink = $('[data-ink]'), stack = $('.stack-scene'), about = $('.about'), contact = $('.contact');
  const stackControls = $('.stack-controls', about);
  const stackButtons = $$('[data-stack-select]', stackControls);
  const stackCases = $$('[data-stack-case]', stack);
  const stackDescription = $('[data-stack-description-text]', about);
  const stackLink = $('[data-stack-link]', about);
  stackButtons.forEach(button => button.addEventListener('click', () => {
    const { stackSelect, stackDescription: description, stackHref } = button.dataset;
    stackButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
    stackCases.forEach(panel => { panel.hidden = panel.dataset.stackCase !== stackSelect; });
    stackDescription.textContent = description;
    stackLink.href = stackHref;
  }));
  stackControls.hidden = false;
  const progress = $('.reading-progress'), sections = $$('section[id]'), navLinks = $$('a[href^="#"]', nav);
  let scheduled = false, currentStep = -1, height = innerHeight;
  function requestUpdate() {
    if (!scheduled) { scheduled = true; requestAnimationFrame(update); }
  }
  function update() {
    scheduled = false;
    const y = scrollY, maxScroll = document.documentElement.scrollHeight - height;
    header.classList.toggle('is-scrolled', y > 30);
    progress.style.transform = 'scaleX(' + clamp(y / Math.max(1, maxScroll)) + ')';
    let selected = 0;
    steps.forEach((step, index) => { if (step.getBoundingClientRect().top < height * .52) selected = index; });
    steps.forEach((step, index) => { step.classList.toggle('is-active', index === selected); step.classList.toggle('is-past', index < selected); });
    if (currentStep !== selected) {
      currentStep = selected; counter.textContent = String(selected + 1).padStart(2, '0');
      if (!reduced.matches) counter.animate([{ opacity: .25, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 400, easing: 'ease-out' });
    }
    const pr = process.getBoundingClientRect();
    process.style.setProperty('--process-progress', clamp((height * .52 - pr.top) / Math.max(1, pr.height - 100)).toFixed(4));
    const ar = about.getBoundingClientRect(), amount = clamp((height * .8 - ar.top) / Math.max(1, ar.height * .62));
    ink.style.setProperty('--ink-position', (reduced.matches ? 100 : amount * 110) + '%');
    stack.style.setProperty('--spread', reduced.matches ? .7 : amount.toFixed(3));
    if (!reduced.matches) {
      const cr = contact.getBoundingClientRect();
      contact.style.setProperty('--contact-y', clamp((height - cr.top) * -.04, -55, 0) + 'px');
    }
    let activeId = '';
    sections.forEach(section => { if (section.getBoundingClientRect().top <= height * .4) activeId = section.id; });
    navLinks.forEach(link => link.classList.toggle('is-active', link.hash === '#' + activeId));
  }
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', () => { height = innerHeight; requestUpdate(); }, { passive: true });
  reduced.addEventListener('change', () => requestUpdate());
  requestUpdate();

  $$('[data-magnetic]').forEach(button => {
    button.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches) return;
      const box = button.getBoundingClientRect();
      button.style.transform = 'translate(' + ((event.clientX - box.left - box.width / 2) * .065).toFixed(1) + 'px,' + ((event.clientY - box.top - box.height / 2) * .065).toFixed(1) + 'px)';
    });
    button.addEventListener('pointerleave', () => { button.style.transform = ''; });
    button.addEventListener('blur', () => { button.style.transform = ''; });
  });

  $$('[data-tilt]').forEach(card => {
    card.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches) return;
      const box = card.getBoundingClientRect(), x = (event.clientX - box.left) / box.width, y = (event.clientY - box.top) / box.height;
      card.style.setProperty('--tilt-x', ((.5 - y) * 7).toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', ((x - .5) * 9).toFixed(2) + 'deg');
      card.style.setProperty('--pointer-x', x * 100 + '%'); card.style.setProperty('--pointer-y', y * 100 + '%');
    });
    card.addEventListener('pointerleave', () => { card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg'); });
  });

  const siteDemo = $('[data-site-demo]');
  const deviceOptions = $('[data-device-options]', siteDemo);
  const deviceButtons = $$('[data-device-option]', deviceOptions);
  deviceButtons.forEach(button => button.addEventListener('click', () => {
    siteDemo.dataset.device = button.dataset.deviceOption;
    deviceButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
  }));
  deviceOptions.hidden = false;

  const serviceNetwork = $('[data-service-network]');
  const networkToggle = $('[data-network-toggle]', serviceNetwork);
  networkToggle.addEventListener('click', () => {
    const connected = serviceNetwork.toggleAttribute('data-linked');
    networkToggle.setAttribute('aria-pressed', String(connected));
  });
  $('[data-network-controls]', serviceNetwork).hidden = false;

  const comparison = $('[data-service-compare]');
  const compareFrame = $('.compare-frame', comparison);
  const compareRange = $('input[type="range"]', comparison);
  function updateComparison() {
    const value = Number(compareRange.value);
    comparison.style.setProperty('--comparison', value + '%');
    compareRange.setAttribute('aria-valuetext', (100 - value) + '% обновлённого макета');
  }
  function moveComparison(event) {
    const frame = compareFrame.getBoundingClientRect();
    compareRange.value = String(Math.round(clamp((event.clientX - frame.left) / frame.width) * 100));
    updateComparison();
  }
  compareFrame.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    compareFrame.setPointerCapture(event.pointerId);
    moveComparison(event);
  });
  compareFrame.addEventListener('pointermove', event => {
    if (compareFrame.hasPointerCapture(event.pointerId)) moveComparison(event);
  });
  compareRange.addEventListener('input', updateComparison);
  updateComparison();
  comparison.setAttribute('data-interactive', '');
  $('[data-compare-controls]', comparison).hidden = false;

  $$('[data-service]').forEach(link => link.addEventListener('click', () => {
    const field = $('textarea[name="project"]');
    if (!field.value.trim()) field.value = 'Интересует: ' + link.dataset.service + '. ';
  }));
  $('#contact-form').addEventListener('submit', event => {
    event.preventDefault();
    const result = $('.form-result');
    result.hidden = false;
    result.textContent = 'Это демонстрационная форма. Заявка не отправилась: отправка будет подключена после добавления контактов.';
  });

  try { if (window.createStudioScene) window.createStudioScene($('[data-scene]')); }
  catch (_) { $('#scene-hint').textContent = 'Миниатюра страницы'; }
})();
