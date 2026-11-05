const form = document.querySelector('.configuration');
const size = document.querySelector('[data-size]');
const bedSpec = document.querySelector('[data-bed-spec]');
const plan = document.querySelector('[data-plan]');
const stage = document.querySelector('[data-model-stage]');
const canvas = stage.querySelector('canvas');
const modelLabel = stage.querySelector('[data-model-label]');
const viewToolbar = stage.querySelector('[data-view-toolbar]');
const viewButtons = [...viewToolbar.querySelectorAll('[data-view]')];
const orbitHint = stage.querySelector('[data-orbit-hint]');
const fabrics = {
  oat: '#cbb89d',
  olive: '#758163',
  clay: '#a96048'
};
let state;
let model;

function drawPlan() {
  const { chaise, open, height, depth, color } = state;
  const rect = (x, y, w, h, r = 5) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/>`;
  const seats = [56, 139, 222].map((x, i) => {
    const lounge = chaise === i;
    const seat = rect(x, 55, 82, lounge ? 147 : 77, 8);
    const extension = open && !lounge ? rect(x, 130, 82, 72, 8) : '';
    return extension + seat + rect(x, 33, 82, 24, 6);
  }).join('');
  const bottom = depth === 170 ? 202 : 132;
  plan.setAttribute('aria-label', `Вид сверху. Габариты 280 × ${depth} × ${height} см.`);
  plan.innerHTML = `
    <g stroke="currentColor" fill="${color}" stroke-width="1.2">
      ${seats}${rect(40, 48, 16, 84)}${rect(304, 48, 16, 84)}
    </g>
    <g stroke="currentColor" fill="none" stroke-width="1" opacity=".55">
      <path d="M40 219v8m280-8v8M40 223h280 M326 32h8m-4 0v${depth}m-4 0h8"/>
    </g>
    <g fill="currentColor" font-size="10" font-family="monospace" text-anchor="middle">
      <text x="180" y="243">280 см</text>
      <text x="344" y="${(bottom + 32) / 2}" transform="rotate(-90 344 ${(bottom + 32) / 2})">${depth} см</text>
    </g>`;
}

function update() {
  const { layout, mode, back, fabric } = Object.fromEntries(new FormData(form));
  const chaise = layout === 'left' ? 0 : layout === 'right' ? 2 : -1;
  const open = mode === 'open';
  const height = back === 'high' ? 99 : 78;
  const depth = open || chaise >= 0 ? 170 : 100;
  state = { chaise, open, height, depth, color: fabrics[fabric] };
  const dimensions = `280 × ${depth} × ${height}`;
  if (size.textContent !== dimensions) size.textContent = dimensions;
  bedSpec.hidden = !open;
  drawPlan();
  model?.update(state);
}

function showModel(ready) {
  canvas.hidden = !ready;
  plan.toggleAttribute('hidden', ready);
  viewToolbar.hidden = !ready;
  modelLabel.textContent = ready ? '3D-модель' : 'Вид сверху';
}

form.addEventListener('change', update);
form.addEventListener('submit', event => event.preventDefault());
window.addEventListener('pageshow', update);
update();

import('./furniture-model.js').then(({ createModel }) => {
  model = createModel(canvas, state, showModel);
  showModel(true);
  for (const button of viewButtons) {
    button.addEventListener('click', () => {
      const view = button.dataset.view;
      viewButtons.forEach(option => option.setAttribute('aria-pressed', String(option === button)));
      orbitHint.hidden = view !== 'perspective';
      model.view(view);
    });
  }
}).catch(() => showModel(false));
