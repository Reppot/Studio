const cabins = [
  { id: 'shore', name: 'У воды', area: 38, capacity: 2, rate: 6800, unavailable: 17, layout: 'Студия с двуспальной кроватью и террасой.', rooms: [[9, 9, 34, 40], [45, 9, 23, 23], [45, 34, 23, 15]] },
  { id: 'pine', name: 'Сосновый', area: 52, capacity: 4, rate: 8900, unavailable: 21, layout: 'Спальня, гостиная с диваном и крыльцо.', rooms: [[9, 9, 29, 20], [9, 31, 29, 18], [40, 9, 28, 40]] },
  { id: 'meadow', name: 'На поляне', area: 76, capacity: 6, rate: 11900, unavailable: 24, layout: 'Две спальни, общая гостиная и широкая терраса.', rooms: [[9, 9, 17, 21], [28, 9, 18, 21], [48, 9, 20, 21], [9, 32, 59, 17]] }
];
const DAY = 86400000;
const today = new Date();
const day = (today.getTime() - today.getTimezoneOffset() * 60000) / DAY;
const iso = epoch => new Date(epoch * DAY).toISOString().slice(0, 10);
const fromISO = value => Date.parse(value) / DAY;
const date = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const form = document.querySelector('[data-stay-form]');
const { arrival, departure, guests } = form.elements;
const results = document.querySelector('[data-stays]');
const status = document.querySelector('[data-stay-status]');
const dialog = document.querySelector('[data-stay-dialog]');
let stays = [];
let range;

function selectDates() {
  const start = fromISO(arrival.value);
  if (Number.isFinite(start)) {
    departure.min = iso(start + 1);
    departure.max = iso(start + 14);
    if (!departure.value || fromISO(departure.value) <= start) departure.value = iso(start + 1);
  }
  const end = fromISO(departure.value);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < Math.floor(day) || end <= start || end - start > 14) {
    status.textContent = 'Выберите даты заезда и выезда. Доступен расчёт от 1 до 14 ночей.';
    results.replaceChildren();
    stays = [];
    return;
  }
  const people = Number(guests.value);
  const nights = Array.from({ length: end - start }, (_, index) => start + index);
  range = { start, end, people };
  stays = cabins.map((cabin, index) => {
    const available = cabin.capacity >= people && nights.every(night => (night + index * 5) % cabin.unavailable !== 0);
    const total = nights.reduce((sum, night) => {
      const weekday = new Date(night * DAY).getUTCDay();
      return sum + cabin.rate + (weekday === 5 || weekday === 6 ? 1200 : 0);
    }, 0);
    return { ...cabin, available, total, reason: cabin.capacity < people ? 'Не хватает мест' : 'Занят на эти даты' };
  });
  const count = stays.filter(stay => stay.available).length;
  status.textContent = `${date.format(start * DAY)} — ${date.format(end * DAY)} · ${guests.selectedOptions[0].textContent} · Свободно ${count} из ${cabins.length}`;
  results.innerHTML = stays.map(stay => `
    <article class="stay-card">
      <div class="cabin-photo cabin-photo--${stay.id}" role="img" aria-label="Домик «${stay.name}»"></div>
      <div class="stay-card-body">
        <p class="case-kicker">${stay.area} м² / До ${stay.capacity} гостей</p>
        <h3>${stay.name}</h3>
        <details><summary>Планировка</summary><svg class="cabin-plan" viewBox="0 0 78 58" role="img" aria-label="${stay.layout}"><rect x="5" y="5" width="68" height="48"/>${stay.rooms.map(([x,y,w,h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`).join('')}</svg><p>${stay.layout}</p></details>
        <div class="stay-price">${stay.available ? `<strong>${money.format(stay.total)}</strong><button class="hotel-action" type="button" data-cabin="${stay.id}">Выбрать</button>` : `<span>${stay.reason}</span>`}</div>
      </div>
    </article>`).join('');
}

arrival.min = iso(Math.floor(day));
arrival.value = iso(Math.floor(day) + 7);
departure.value = iso(Math.floor(day) + 10);
form.addEventListener('submit', event => event.preventDefault());
form.addEventListener('change', selectDates);
results.addEventListener('click', event => {
  const button = event.target.closest('[data-cabin]');
  if (!button) return;
  const cabin = stays.find(stay => stay.id === button.dataset.cabin);
  if (!cabin?.available) return;
  dialog.querySelector('#stay-dialog-title').textContent = cabin.name;
  dialog.querySelector('[data-booking-dates]').textContent = `${date.format(range.start * DAY)} — ${date.format(range.end * DAY)}`;
  dialog.querySelector('[data-booking-guests]').textContent = guests.selectedOptions[0].textContent;
  dialog.querySelector('[data-booking-total]').textContent = money.format(cabin.total);
  dialog.showModal();
});
selectDates();
