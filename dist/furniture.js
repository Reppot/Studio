const product = document.querySelector('#product');
const size = product.querySelector('[data-size]');
const description = product.querySelector('[data-description]');
const frame = product.querySelector('[data-frame]');
const straightPhoto = product.querySelector('.photo-straight');
const cornerPhoto = product.querySelector('.photo-corner');
const layout = product.querySelector('.choices');

function showLayout() {
  const selected = layout.querySelector('input:checked').value;
  const corner = selected === 'corner';
  product.dataset.layout = selected;
  straightPhoto.setAttribute('aria-hidden', String(corner));
  cornerPhoto.setAttribute('aria-hidden', String(!corner));
  size.textContent = corner ? '280 × 170' : '280 × 100';
  description.textContent = corner ? 'Два сиденья и шезлонг справа.' : 'Три сиденья в один ряд.';
  frame.textContent = corner ? '02 / 02' : '01 / 02';
}

layout.addEventListener('change', showLayout);
window.addEventListener('pageshow', showLayout);
showLayout();
