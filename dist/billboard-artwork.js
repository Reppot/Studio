/* Artwork is rendered at the scene's texture resolution, including all type. */
(() => {
  'use strict';
  window.createBillboardArtwork = function (width, onReady) {
    const sources = {
      furniture: './assets/furniture/straight.jpg',
      'furniture-corner': './assets/furniture/corner.jpg',
      concert: './assets/cases/concert.jpg',
      hotel: './assets/cases/hotel.jpg'
    };
    const images = {};
    for (const [kind, source] of Object.entries(sources)) {
      const image = new Image();
      image.addEventListener('load', () => onReady(kind), { once: true });
      images[kind] = image;
      image.src = source;
    }
    function fill(c, color, x, y, w, h) {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    }
    function type(c, value, x, y, font, color, align = 'left') {
      c.font = font;
      c.fillStyle = color;
      c.textAlign = align;
      c.fillText(value, x, y);
      c.textAlign = 'left';
    }
    function photo(c, kind, height) {
      const img = images[kind];
      if (!img.naturalWidth) return;
      const srcHeight = img.naturalWidth * height / 2048;
      c.drawImage(img, 0, (img.naturalHeight - srcHeight) / 2, img.naturalWidth, srcHeight, 0, 0, 2048, height);
    }
    function furniture(c, kind) {
      const corner = kind === 'furniture-corner';
      fill(c, '#77624c', 0, 0, 2048, 1024);
      photo(c, kind, 1024);
      const shade = c.createLinearGradient(0, 0, 0, 1024);
      shade.addColorStop(0, 'rgba(26,20,15,.65)');
      shade.addColorStop(.38, 'rgba(26,20,15,0)');
      shade.addColorStop(.82, 'rgba(26,20,15,0)');
      shade.addColorStop(1, 'rgba(26,20,15,.76)');
      fill(c, shade, 0, 0, 2048, 1024);
      type(c, 'Конфигуратор', 260, 221, 'bold 92px Georgia', '#fff4e4');
      type(c, corner ? 'Угловая компоновка' : 'Прямая компоновка', 268, 904, '600 37px Arial', '#fff4e4');
      type(c, corner ? '280 × 170 см' : '280 × 100 см', 268, 953, '32px Arial', '#fff4e4');
    }
    function concert(c) {
      const green = '#e1f66d';
      const paper = '#f2f0e1';
      fill(c, '#181a13', 0, 0, 2048, 1024);
      photo(c, 'concert', 700);
      const shade = c.createLinearGradient(0, 0, 0, 700);
      shade.addColorStop(0, '#10120914');
      shade.addColorStop(1, '#101209bb');
      fill(c, shade, 0, 0, 2048, 700);
      type(c, 'КОНЦЕРТНЫЙ ТУР / ВЕСНА 2027', 1024, 232, 'bold 34px Consolas', paper, 'center');
      type(c, 'ПОСЛЕ ШУМА.', 1024, 454, '900 156px Arial', green, 'center');
      fill(c, green, 894, 514, 260, 68);
      type(c, 'АФИША ТУРА', 1024, 558, 'bold 29px Arial', '#181a13', 'center');
      [['19 марта', 'Казань'], ['27 марта', 'Нижний Новгород'], ['03 апреля', 'Екатеринбург']].forEach(([date, city], i) => {
        const x = 212 + 403 * i;
        fill(c, '#53573e', x, 760, 365, 2);
        type(c, date, x, 822, '36px Consolas', green);
        type(c, city, x, 890, 'bold 38px Arial', paper);
      });
    }
    function hotel(c) {
      const cream = '#f2ead6';
      fill(c, '#e8e8dc', 0, 0, 2048, 1024);
      fill(c, '#22352b', 0, 0, 2048, 700);
      photo(c, 'hotel', 700);
      const shade = c.createLinearGradient(0, 0, 1440, 0);
      shade.addColorStop(0, '#14241ae6');
      shade.addColorStop(1, '#14241a00');
      fill(c, shade, 0, 0, 2048, 700);
      type(c, 'ЗАГОРОДНЫЙ ОТЕЛЬ', 252, 212, 'bold 32px Consolas', cream);
      type(c, 'Тихая вода.', 244, 404, 'italic 146px Georgia', cream);
      type(c, 'Домики у озера, среди сосен', 254, 486, '36px Arial', cream);
      type(c, 'ТРИ НОЧИ / ДВА ГОСТЯ', 222, 766, '29px Consolas', '#44564a');
      [['У воды', '20 400 ₽'], ['Сосновый', '26 700 ₽'], ['На поляне', '35 700 ₽']].forEach(([name, price], i) => {
        const x = 222 + i * 396;
        fill(c, '#b4c0b0', x, 802, 363, 2);
        type(c, name, x, 868, '44px Georgia', '#273d2f');
        type(c, price, x, 926, '35px Arial', '#44564a');
      });
    }
    const painters = { furniture, 'furniture-corner': furniture, concert, hotel };
    return {
      render(kind) {
        const page = document.createElement('canvas');
        page.width = width;
        page.height = width / 2;
        const ctx = page.getContext('2d');
        ctx.scale(width / 2048, width / 2048);
        ctx.imageSmoothingQuality = 'high';
        painters[kind](ctx, kind);
        return page;
      }
    };
  };
})();
