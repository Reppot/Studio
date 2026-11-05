const number = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

export const sofaSize = { width: 280, depth: 100, extension: 70, bedWidth: 248, bedDepth: 145, seatHeight: 43, armHeight: 51 };

export function formatSize(cm, unit) {
  return number.format(unit === 'm' ? cm / 100 : cm);
}

export function unitLabel(unit) {
  return unit === 'm' ? 'м' : 'см';
}

function rect(x, y, width, height, kind = '', radius = 5) {
  return `<rect class="${kind}" x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}"/>`;
}

function topView({ chaise, open, depth }, measureX, measureY) {
  const x = 76;
  const y = 58;
  const { width, extension, bedWidth, bedDepth } = sofaSize;
  const end = x + width;
  const seats = [x + 16, x + 99, x + 182].map((start, index) => {
    const lounge = index === chaise;
    const length = lounge ? bedDepth : 75;
    const extensionPanel = open && !lounge ? rect(start, y + 100, 82, extension, 'extension') : '';
    return rect(start, y, 82, 25, 'back') + rect(start, y + 25, 82, length, 'seat') + extensionPanel;
  }).join('');
  const armrests = rect(x, y + 13, 16, 87, 'arm') + rect(end - 16, y + 13, 16, 87, 'arm');
  const activeExtension = open
    ? measureY(y + 25, y + depth, 386, end - 16, 'Спальное место')
    : chaise === 0
      ? measureY(y + 100, y + depth, 39, x + 16, 'Выступ')
      : chaise === 2 ? measureY(y + 100, y + depth, 386, end - 16, 'Выступ') : '';
  return {
    shape: seats + armrests,
    measures: measureX(x, end, 27, y)
      + measureY(y, y + depth, 426, end)
      + measureY(y + 25, y + 100, 55, x, 'Сиденье')
      + measureX(x + 16, x + 98, 247, y + (open || chaise === 0 ? depth : 100), 'Модуль')
      + (open ? measureX(x + 16, x + 16 + bedWidth, 281, y + depth) : '')
      + activeExtension
  };
}

function frontView({ height }, measureX, measureY) {
  const x = 76;
  const floor = 215;
  const { width, seatHeight, armHeight } = sofaSize;
  const top = floor - height;
  const end = x + width;
  const seats = [x + 16, x + 99, x + 182].map(start =>
    rect(start, top, 82, height - 35, 'back', 8)
    + rect(start, floor - 31, 82, 27, 'base')
    + rect(start, floor - seatHeight, 82, 17, 'seat')
  ).join('');
  const armrests = rect(x, floor - armHeight, 16, 47, 'arm') + rect(end - 16, floor - armHeight, 16, 47, 'arm');
  return {
    shape: seats + armrests + `<path class="floor" d="M60 ${floor}H371"/>`,
    measures: measureX(x, end, 258, floor)
      + measureX(x + 16, x + 98, 73, top, 'Модуль')
      + measureX(x, x + 16, 42, floor - armHeight)
      + measureY(top, floor, 40, x)
      + measureY(floor - seatHeight, floor, 385, end, 'Сиденье')
      + measureY(floor - armHeight, floor, 423, end, 'Подлокотник')
  };
}

function sideView({ height, depth, open }, measureX, measureY) {
  const x = 117;
  const floor = 214;
  const { extension, seatHeight, armHeight } = sofaSize;
  const top = floor - height;
  const extended = depth > 100;
  return {
    shape: rect(x, floor - 31, 100, 27, 'base')
      + rect(x, top, 25, height - 35, 'back', 8)
      + rect(x + 25, floor - seatHeight, 75, 17, 'seat')
      + (extended ? rect(x + 100, floor - seatHeight, extension, 39, open ? 'extension' : 'seat') : '')
      + rect(x + 13, floor - armHeight, 87, 47, 'arm outline')
      + `<path class="floor" d="M100 ${floor}H${x + depth + 18}"/>`,
    measures: measureX(x, x + depth, 275, floor)
      + measureX(x, x + 25, 55, top)
      + measureX(x + 25, x + 100, 84, floor - seatHeight, 'Сиденье')
      + (extended ? measureX(x + 100, x + depth, 245, floor, 'Выступ') : '')
      + measureY(top, floor, 76, x, 'Спинка')
      + measureY(floor - seatHeight, floor, 333, x + depth)
      + measureY(floor - armHeight, floor, 382, x + depth, 'Подлокотник')
  };
}

const projections = {
  top: { label: 'сверху', draw: topView },
  front: { label: 'спереди', draw: frontView },
  side: { label: 'сбоку', draw: sideView }
};

export function drawFurniture(svg, configuration, projection, unit) {
  const measure = cm => `${formatSize(cm, unit)} ${unitLabel(unit)}`;
  const label = (prefix, cm) => prefix ? `${prefix} ${measure(cm)}` : measure(cm);
  const measureX = (x1, x2, y, guide, prefix) => `
    <path class="guide" d="M${x1} ${guide}V${y}m${x2 - x1} 0V${guide}"/>
    <path d="M${x1} ${y}H${x2}m-3 3l6 -6M${x1 - 3} ${y + 3}l6 -6"/>
    <text x="${(x1 + x2) / 2}" y="${y - 6}">${label(prefix, x2 - x1)}</text>`;
  const measureY = (y1, y2, x, guide, prefix) => {
    const middle = (y1 + y2) / 2;
    return `
      <path class="guide" d="M${guide} ${y1}H${x}m0 ${y2 - y1}H${guide}"/>
      <path d="M${x} ${y1}V${y2}m-3 3l6 -6M${x - 3} ${y1 + 3}l6 -6"/>
      <text x="${x - 6}" y="${middle}" transform="rotate(-90 ${x - 6} ${middle})">${label(prefix, y2 - y1)}</text>`;
  };
  const view = projections[projection];
  const { shape, measures } = view.draw(configuration, measureX, measureY);
  const { depth, height } = configuration;
  const description = `Чертёж дивана ${view.label}. Ширина ${measure(sofaSize.width)}, глубина ${measure(depth)}, высота ${measure(height)}. Высота сиденья ${measure(sofaSize.seatHeight)}, подлокотника ${measure(sofaSize.armHeight)}.`;
  svg.setAttribute('aria-label', description);
  svg.innerHTML = `<g class="diagram-shape">${shape}</g><g class="diagram-measures">${measures}</g>`;
}
