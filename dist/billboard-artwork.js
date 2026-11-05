/* Textures for the furniture configurator and the SINDARIS order flow. */
(() => {
  'use strict';
  window.createBillboardArtwork = function (width, onReady) {
    const scale=width/2048,items=[
      {name:'7.62-мм',file:'RifleAmmo',have:50,target:80},
      {name:'Бинты',file:'Bandages',have:25,target:40},
      {name:'Солдатское снаряжение',file:'SoldierSupplies',have:20,target:30}
    ];
    let pending=items.length;
    const settled=()=>{if(--pending===0)onReady('sindaris');};
    items.forEach(item=>{
      item.image=new Image();
      item.image.addEventListener('load',settled,{once:true});
      item.image.addEventListener('error',settled,{once:true});
      item.image.src='./assets/sindaris/items/'+item.file+'.png';
    });
    const interiors={};
    for(const [kind,file] of [['furniture','straight'],['furniture-corner','corner']]){
      const image=new Image();
      image.addEventListener('load',()=>onReady(kind),{once:true});
      image.src='./assets/furniture/'+file+'.jpg';
      interiors[kind]=image;
    }
    function box(c,x,y,w,h,r,fill,stroke){
      c.beginPath();c.roundRect(x,y,w,h,r);
      if(fill){c.fillStyle=fill;c.fill();}
      if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}
    }
    function text(c,value,x,y,size=24,color='#f0f2ee',weight='400',align='left'){
      c.font=weight+' '+size+'px Arial';c.fillStyle=color;c.textAlign=align;c.fillText(value,x,y);c.textAlign='left';
    }
    function line(c,x,y,w,color='#2b312c'){c.fillStyle=color;c.fillRect(x,y,w,1.5);}
    function check(c,x,y,color='#a3e635'){
      c.strokeStyle=color;c.lineWidth=3;c.lineCap='round';c.lineJoin='round';
      c.beginPath();c.moveTo(x,y+7);c.lineTo(x+6,y+13);c.lineTo(x+18,y);c.stroke();
    }
    function icon(c,item,x,y,size=42){
      box(c,x-7,y-7,size+14,size+14,10,'#22291e');
      if(item.image.complete&&item.image.naturalWidth)c.drawImage(item.image,x,y,size,size);
    }
    function sindaris(c){
      c.fillStyle='#0d0f0e';c.fillRect(0,0,2048,1024);
      text(c,'SINDARIS',180,126,39,'#f0f2ee','900');
      text(c,'Terminal',411,126,24,'#858d87');
      text(c,'Foxhole / Логистика сообщества',1868,124,20,'#858d87','400','right');
      line(c,180,159,1688);
      text(c,'От склада к готовому заказу.',212,254,65,'#f0f2ee','600');
      text(c,'Сверка наличия и подготовка снабжения.',216,303,25,'#b0b7b1');
      box(c,212,340,1624,488,19,'#111312','#30372f');
      line(c,212,405,1624);
      text(c,'Пирамида снабжения',242,381,28,'#f0f2ee','600');
      text(c,'Конструктор заказа',1058,381,28,'#f0f2ee','600');
      text(c,'Уровень 1 / Основа',242,443,20,'#858d87');
      text(c,'Есть',704,443,19,'#858d87','400','right');
      text(c,'Нужно',817,443,19,'#858d87','400','right');
      text(c,'Не хватает',980,443,19,'#858d87','400','right');
      text(c,'Предмет',1080,443,20,'#858d87');
      text(c,'Ящики',1780,443,20,'#858d87','400','right');
      items.forEach((item,i)=>{
        const y=474+i*80,missing=item.target-item.have;
        box(c,232,y,770,70,10,'#161917');
        icon(c,item,251,y+14,36);
        text(c,item.name,316,y+33,item.name.length>18?22:28);
        text(c,item.have,704,y+35,28,'#b0b7b1','400','right');
        text(c,item.target,817,y+35,28,'#b0b7b1','400','right');
        text(c,missing,980,y+35,29,'#fbbf24','600','right');
        box(c,316,y+49,265,4,2,'#30382c');
        box(c,316,y+49,265*item.have/item.target,4,2,'#a3e635');
        box(c,1056,y,752,70,10,'#1d201d');
        icon(c,item,1076,y+14,36);
        text(c,item.name,1141,y+36,item.name.length>18?24:29);
        text(c,missing,1778,y+36,31,'#f0f2ee','600','right');
      });
      box(c,242,748,374,56,11,'#a3e635');
      text(c,'Всё недостающее',278,785,24,'#0b1006','600');
      text(c,'55 ящ. / 3 позиции',975,784,22,'#858d87','400','right');
      text(c,'Итого',1078,776,21,'#858d87');
      text(c,'55 ящ.',1078,804,27,'#f0f2ee','600');
      box(c,1368,748,440,56,11,'#a3e635');
      text(c,'Отправить заказ клану',1412,785,24,'#0b1006','600');
      check(c,1766,767,'#0b1006');
      text(c,'Демонстрационный состав заказа',212,896,20,'#858d87');
      text(c,'Next.js / FastAPI / PostgreSQL',1836,896,20,'#858d87','400','right');
    }
    function furniture(c,kind){
      const corner=kind==='furniture-corner',image=interiors[kind];
      c.fillStyle='#77624c';c.fillRect(0,0,2048,1024);
      if(image.naturalWidth)c.drawImage(image,0,0,2048,1024);
      const shade=c.createLinearGradient(0,0,0,1024);
      shade.addColorStop(0,'rgba(26,20,15,.65)');
      shade.addColorStop(.38,'rgba(26,20,15,0)');
      shade.addColorStop(.82,'rgba(26,20,15,0)');
      shade.addColorStop(1,'rgba(26,20,15,.76)');
      c.fillStyle=shade;c.fillRect(0,0,2048,1024);
      c.fillStyle='#fff4e4';c.font='bold 114px Georgia';c.fillText('слой.',260,221);
      text(c,'Диван М01',268,278,42,'#fff4e4');
      text(c,corner?'Угловая компоновка':'Прямая компоновка',268,952,37,'#fff4e4','600');
      text(c,corner?'280 × 170 см':'280 × 100 см',1780,952,37,'#fff4e4','400','right');
    }
    function render(kind){
      const page=document.createElement('canvas');page.width=width;page.height=width/2;
      const c=page.getContext('2d');c.scale(scale,scale);c.imageSmoothingQuality='high';
      if(kind==='sindaris')sindaris(c);else furniture(c,kind);
      return page;
    }
    function empty(){
      const page=document.createElement('canvas');page.width=1536;page.height=256;
      const c=page.getContext('2d');c.scale(2,2);
      text(c,'Состав заказа',384,47,28,'#b0b7b1','600','center');
      text(c,'Перенесите недостающее из пирамиды',384,89,21,'#858d87','400','center');
      return page;
    }
    return {render,empty};
  };
})();
