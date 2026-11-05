const concerts = [
  { id: 'kzn', city: 'Казань', date: '2027-03-19', day: '19', month: 'марта', venue: 'Зал «Маяк»', time: '20:00', price: 1800 },
  { id: 'nn', city: 'Нижний Новгород', date: '2027-03-27', day: '27', month: 'марта', venue: 'Клуб «Порт»', time: '20:00', price: 1900 },
  { id: 'ekb', city: 'Екатеринбург', date: '2027-04-03', day: '03', month: 'апреля', venue: 'Зал «Сигнал»', time: '19:30', price: 2100 },
  { id: 'spb', city: 'Санкт-Петербург', date: '2027-04-09', day: '09', month: 'апреля', venue: 'Клуб «Волна»', time: '20:00', price: 2400 }
];
const money = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
const city = document.querySelector('[data-city]');
const list = document.querySelector('[data-concerts]');
const count = document.querySelector('[data-concert-count]');
const dialog = document.querySelector('[data-tickets]');
const zone = dialog.querySelector('[data-zone]');
const quantity = dialog.querySelector('[data-quantity]');
const total = dialog.querySelector('[data-ticket-total]');
let selected;

function render() {
  const matches = concerts.filter(concert => !city.value || concert.id === city.value);
  list.innerHTML = matches.map(concert => `
    <article class="tour-row">
      <time datetime="${concert.date}"><strong>${concert.day}</strong><span>${concert.month}</span></time>
      <div><h3>${concert.city}</h3><p>${concert.venue} · ${concert.time}</p></div>
      <div class="tour-row-action"><span>от ${money.format(concert.price)}</span><button type="button" data-concert="${concert.id}">Выбрать билеты</button></div>
    </article>`).join('');
  count.textContent = matches.length === 1 ? '1 концерт' : `${matches.length} концерта`;
}

function priceTickets() {
  const price = selected.price + (zone.value === 'balcony' ? 600 : 0);
  total.textContent = money.format(price * Number(quantity.value));
}

for (const concert of concerts) city.add(new Option(concert.city, concert.id));
city.addEventListener('change', render);
list.addEventListener('click', event => {
  const button = event.target.closest('[data-concert]');
  if (!button) return;
  selected = concerts.find(concert => concert.id === button.dataset.concert);
  dialog.querySelector('[data-ticket-date]').textContent = `${selected.day} ${selected.month} 2027 · ${selected.time}`;
  dialog.querySelector('#ticket-title').textContent = selected.city;
  dialog.querySelector('[data-ticket-venue]').textContent = selected.venue;
  zone.value = 'floor';
  quantity.value = '1';
  priceTickets();
  dialog.showModal();
});
zone.addEventListener('change', priceTickets);
quantity.addEventListener('change', priceTickets);
render();
