import { drawFurniture, formatSize, sofaSize, unitLabel } from './furniture-drawings.js';

const form = document.querySelector('.configuration');
const size = document.querySelector('[data-size]');
const bedSize = document.querySelector('[data-bed-size]');
const bedSpec = document.querySelector('[data-bed-spec]');
const sizeUnits = document.querySelectorAll('[data-unit-label]');
const drawingNote = document.querySelector('[data-drawing-note]');
const stage = document.querySelector('[data-model-stage]');
const canvas = stage.querySelector('canvas');
const plan = stage.querySelector('[data-plan]');
const viewToolbar = stage.querySelector('[data-view-toolbar]');
const drawingToolbar = stage.querySelector('[data-drawing-toolbar]');
const modeButtons = [...stage.querySelectorAll('[data-mode]')];
const modelButton = stage.querySelector('[data-mode="model"]');
let state;
let model;
let modelReady = false;
let mode = 'model';
let projection = 'top';
let unit = 'cm';

function press(buttons, selected) {
  for (const button of buttons) button.setAttribute('aria-pressed', String(button === selected));
}

function showDimensions() {
  const dimensions = values => values.map(cm => formatSize(cm, unit)).join(' × ');
  size.textContent = dimensions([sofaSize.width, state.depth, state.height]);
  bedSize.textContent = dimensions([sofaSize.bedWidth, sofaSize.bedDepth]);
  bedSpec.hidden = !state.open;
  sizeUnits.forEach(element => { element.textContent = unitLabel(unit); });
}

function showStage() {
  const drawing = mode === 'drawing' || !modelReady;
  stage.dataset.mode = drawing ? 'drawing' : 'model';
  modelButton.disabled = !modelReady;
  press(modeButtons, drawing ? modeButtons[1] : modelButton);
  canvas.hidden = drawing;
  plan.toggleAttribute('hidden', !drawing);
  viewToolbar.hidden = drawing;
  drawingToolbar.hidden = !drawing;
  drawingNote.hidden = !drawing;
  if (drawing) drawFurniture(plan, state, projection, unit);
}

function update() {
  const { layout, mode: position, back } = Object.fromEntries(new FormData(form));
  const chaise = layout === 'left' ? 0 : layout === 'right' ? 2 : -1;
  const open = position === 'open';
  const height = back === 'high' ? 99 : 78;
  const depth = sofaSize.depth + (open || chaise >= 0 ? sofaSize.extension : 0);
  state = { chaise, open, height, depth };
  showDimensions();
  if (!plan.hasAttribute('hidden')) drawFurniture(plan, state, projection, unit);
  model?.update(state);
}

form.addEventListener('change', update);
form.addEventListener('submit', event => event.preventDefault());
window.addEventListener('pageshow', update);

stage.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  const { mode: nextMode, view, projection: nextProjection, unit: nextUnit } = button.dataset;
  if (nextMode) {
    mode = nextMode;
    showStage();
  } else if (view) {
    press(viewToolbar.querySelectorAll('[data-view]'), button);
    model.view(view);
  } else if (nextProjection) {
    projection = nextProjection;
    press(drawingToolbar.querySelectorAll('[data-projection]'), button);
    drawFurniture(plan, state, projection, unit);
  } else if (nextUnit) {
    unit = nextUnit;
    press(stage.querySelectorAll('[data-unit]'), button);
    showDimensions();
    if (!plan.hasAttribute('hidden')) drawFurniture(plan, state, projection, unit);
  }
});

update();
showStage();
import('./furniture-model.js').then(({ createModel }) => {
  model = createModel(canvas, state, ready => {
    modelReady = ready;
    showStage();
  });
  modelReady = true;
  showStage();
}).catch(() => showStage());
