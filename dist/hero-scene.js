/* Curved, double-sided project display. Text is drawn at 1024px, not captured from the viewport. */
(() => {
  'use strict';
  window.createStudioScene = function (host) {
    const canvas = host.querySelector('canvas'), hint = host.querySelector('#scene-hint');
    const buttons = Array.from(host.querySelectorAll('[data-scene-view]'));
    const counter = host.querySelector('[data-scene-counter]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)'), fine = matchMedia('(pointer:fine)');
    let gl;
    try { gl = canvas.getContext('webgl', { alpha:true, antialias:true, preserveDrawingBuffer:true, powerPreference:'low-power' }); } catch (_) {}
    if (!gl) { hint.textContent = 'Миниатюра страницы'; buttons.forEach(b => b.disabled = true); return; }
    const vertexSource = [
      'attribute vec3 a_position; attribute vec3 a_normal; attribute vec2 a_uv;',
      'uniform mat4 u_model; uniform mat4 u_projection;',
      'varying vec3 v_normal; varying vec3 v_position; varying vec2 v_uv;',
      'void main(){ vec4 world=u_model*vec4(a_position,1.0);',
      'v_position=world.xyz; v_normal=mat3(u_model)*a_normal; v_uv=a_uv;',
      'gl_Position=u_projection*vec4(world.xyz-vec3(0.0,0.0,6.6),1.0); }'
    ].join('\n');
    const fragmentSource = [
      'precision mediump float; uniform sampler2D u_texture; uniform bool u_textured;',
      'uniform vec3 u_frame; varying vec3 v_normal; varying vec3 v_position; varying vec2 v_uv;',
      'void main(){ vec3 n=normalize(v_normal);',
      'vec3 light=normalize(vec3(-2.0,4.0,7.0));',
      'vec3 view=normalize(vec3(0.0,0.0,6.6)-v_position);',
      'float diffuse=max(dot(n,light),0.0);',
      'float spec=pow(max(dot(n,normalize(light+view)),0.0),68.0);',
      'vec3 color=u_frame;',
      'if(u_textured){color=texture2D(u_texture,v_uv).rgb;',
      'float edge=min(min(v_uv.x,1.0-v_uv.x),min(v_uv.y,1.0-v_uv.y));',
      'color=mix(u_frame,color,smoothstep(0.010,0.013,edge));}',
      'color*=0.86+0.14*diffuse; color+=spec*0.055;',
      'gl_FragColor=vec4(color,1.0); }'
    ].join('\n');
    function compile(type,source) {
      const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error('Unable to compile display shader');
      return s;
    }
    let program;
    try {
      program=gl.createProgram();
      const vs=compile(gl.VERTEX_SHADER,vertexSource),fs=compile(gl.FRAGMENT_SHADER,fragmentSource);
      gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
      gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error('Unable to link display shader');
    } catch (_) { hint.textContent='Миниатюра страницы';buttons.forEach(b=>b.disabled=true);return; }
    const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    function multiply(a,b) {
      const out=new Float32Array(16);
      for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
      return out;
    }
    function model(x,y,z,bob) {
      const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
      const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,bob,0,1]);
      const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
      const rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
      return multiply(multiply(rx,ry),rz);
    }
    function projection(aspect) {
      const f=1/Math.tan(34*Math.PI/360),near=.1,far=25;
      return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    }
    const radius=3.0,bend=1.02,height=2.85,thickness=.065,segments=72;
    function surface(u,v,back=false) {
      const a=(u-.5)*bend;
      return [Math.sin(a)*radius,(.5-v)*height,(1-Math.cos(a))*radius+(back?-thickness:thickness)];
    }
    function createMesh(vertices,indices) {
      const vb=gl.createBuffer(),ib=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
      return {vb,ib,count:indices.length};
    }
    function face(back) {
      const vertices=[],indices=[];
      for(let i=0;i<=segments;i++) for(let j=0;j<2;j++) {
        const u=i/segments,a=(u-.5)*bend,p=surface(u,j,back);
        vertices.push(...p,Math.sin(a)*(back?1:-1),0,Math.cos(a)*(back?-1:1),back?1-u:u,1-j);
        if(i<segments&&j===0){const n=i*2;if(back)indices.push(n,n+2,n+1,n+2,n+3,n+1);else indices.push(n,n+1,n+2,n+2,n+1,n+3);}
      }
      return createMesh(vertices,indices);
    }
    const frontMesh=face(false),backMesh=face(true);
    const edgeVertices=[],edgeIndices=[];
    function quad(points,normal) {
      const n=edgeVertices.length/8;
      points.forEach(p=>edgeVertices.push(...p,...normal,0,0));
      edgeIndices.push(n,n+1,n+2,n,n+2,n+3);
    }
    for(let i=0;i<segments;i++){
      const a=i/segments,b=(i+1)/segments;
      quad([surface(a,0),surface(b,0),surface(b,0,true),surface(a,0,true)],[0,1,0]);
      quad([surface(a,1,true),surface(b,1,true),surface(b,1),surface(a,1)],[0,-1,0]);
    }
    quad([surface(0,0,true),surface(0,1,true),surface(0,1),surface(0,0)],[-1,0,0]);
    quad([surface(1,0),surface(1,1),surface(1,1,true),surface(1,0,true)],[1,0,0]);
    const edgeMesh=createMesh(edgeVertices,edgeIndices);
    const position=gl.getAttribLocation(program,'a_position'),normal=gl.getAttribLocation(program,'a_normal'),uv=gl.getAttribLocation(program,'a_uv');
    const uniforms={model:gl.getUniformLocation(program,'u_model'),projection:gl.getUniformLocation(program,'u_projection'),texture:gl.getUniformLocation(program,'u_texture'),textured:gl.getUniformLocation(program,'u_textured'),frame:gl.getUniformLocation(program,'u_frame')};
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
    function bind(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ib);
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,32,0);
      gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,32,12);
      gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,32,24);
    }
    function rounded(c,x,y,w,h,r,fill,stroke) {
      c.beginPath();c.roundRect(x,y,w,h,r);
      if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=2;c.stroke();}
    }
    const views=buttons.map(b=>({title:b.dataset.sceneTitle||b.textContent.trim(),kind:b.dataset.sceneKind||'studio'}));
    if(views.length<2)views.push({title:'SINDARIS',kind:'sindaris'});
    const screenshot=new Image();
    screenshot.src='./assets/sindaris/home.png';
    function drawPage(view) {
      const page=document.createElement('canvas');page.width=page.height=1024;
      const c=page.getContext('2d'),dark=view.kind==='sindaris';
      c.fillStyle=dark?'#0b110c':'#f7f5ed';c.fillRect(0,0,1024,1024);
      c.fillStyle=dark?'#1c281c':'#e5e5da';c.fillRect(0,0,1024,65);
      ['#929b84','#a9b19d','#bdc3b5'].forEach((color,i)=>{c.fillStyle=color;c.beginPath();c.arc(43+i*22,33,5,0,Math.PI*2);c.fill();});
      c.font='15px Consolas,monospace';c.fillStyle=dark?'#8fa07e':'#8d9282';c.textAlign='center';c.fillText(dark?'sindaris / terminal':'studio / web',530,39);c.textAlign='left';
      if(dark){
        c.fillStyle='#e1ebd5';c.font='bold 31px Arial';c.fillText('SINDARIS',56,134);
        c.font='18px Consolas,monospace';c.fillStyle='#91a177';c.fillText('Terminal',57,165);
        c.font='15px Arial';c.fillText('Логистика / Foxhole',760,137);
        c.font='bold 63px Arial';c.fillStyle='#edf1e5';c.fillText('Логистика',56,268);
        c.font='italic 66px Georgia';c.fillStyle='#b5dc68';c.fillText('в одном окне.',56,342);
        rounded(c,41,402,942,458,10,'#121a12','#33462b');
        if(screenshot.complete&&screenshot.naturalWidth)c.drawImage(screenshot,48,410,928,444);
        c.fillStyle='#a8b995';c.font='17px Consolas,monospace';c.fillText('Заказы  /  Снабжение  /  Планирование',56,930);
        c.fillStyle='#5f7651';c.fillRect(56,967,910,1);
      }else{
        c.fillStyle='#ed5038';c.fillRect(56,108,10,30);c.fillRect(73,115,10,23);c.fillRect(90,122,10,16);
        c.fillStyle='#202421';c.font='bold 26px Arial';c.fillText('Веб-студия',119,134);
        c.font='15px Arial';c.fillStyle='#767d6c';c.fillText('Услуги     Проекты     Контакты',680,132);
        c.fillStyle='#d1d6c7';c.fillRect(56,170,912,1);
        c.fillStyle='#8b9381';c.font='13px Consolas,monospace';c.fillText('ДИЗАЙН И ВЕБ-РАЗРАБОТКА',56,220);
        c.fillStyle='#202421';c.font='76px Arial';c.fillText('Сайты',56,326);c.fillText('и веб-сервисы',56,410);
        c.fillStyle='#ed5038';c.font='italic 83px Georgia';c.fillText('под ключ.',56,506);
        c.fillStyle='#7b8273';c.font='20px Arial';c.fillText('От первой схемы до работающего продукта.',56,565);
        c.fillText('Интерфейс, серверная часть и интеграции.',56,597);
        rounded(c,56,637,260,66,2,'#202421');
        c.fillStyle='#f7f5ed';c.font='19px Arial';c.fillText('Обсудить проект',85,678);
        c.fillStyle='#ced4c3';c.fillRect(56,756,912,1);
        const labels=['Интерфейс','Разработка','Интеграции'];
        for(let i=0;i<3;i++){
          const x=56+i*311;rounded(c,x,790,288,172,7,i===1?'#e4e9d9':'#eeeee3','#d2d7c7');
          c.fillStyle=i===1?'#ed5038':'#9da98d';c.font='14px Consolas,monospace';c.fillText('0'+(i+1),x+21,827);
          c.fillStyle='#30392a';c.font='24px Arial';c.fillText(labels[i],x+21,875);
          c.fillStyle='#bac5ac';c.fillRect(x+21,910,165,4);c.fillRect(x+21,926,111,4);
        }
      }
      return page;
    }
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    function texture(view) {
      const t=gl.createTexture();upload(t,view);return t;
    }
    function upload(t,view){
      gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,drawPage(view));
      gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(8,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    }
    const faces=[{view:0,texture:texture(views[0])},{view:1,texture:texture(views[1])}];
    screenshot.addEventListener('load',()=>{faces.forEach(face=>{if(views[face.view].kind==='sindaris')upload(face.texture,views[face.view]);});schedule();});
    let raf=0,visible=true,paused=document.documentElement.classList.contains('ambient-paused'),lost=false;
    let matrix=identity(),index=0,parity=0,stable=-.28,angle=-.28,turn=null,dwell=0,clock=0,last=0;
    let hoverX=0,hoverY=0,currentX=.13,currentY=0,drag=false,dragStart=0,dragPointer=0;
    function setFace(slot,viewIndex){if(faces[slot].view===viewIndex)return;faces[slot].view=viewIndex;upload(faces[slot].texture,views[viewIndex]);}
    function sync(){
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
      counter.textContent=String(index+1).padStart(2,'0')+' / '+String(views.length).padStart(2,'0');
      canvas.setAttribute('aria-label','Изогнутая 3D-страница: '+views[index].title+'. Перетаскивайте для поворота; клавиши влево и вправо переключают вид.');
    }
    function prepare(direction){const next=(index+direction+views.length)%views.length;setFace(1-parity,next);return next;}
    function go(viewIndex,direction=1,manual=false) {
      if(turn){
        if(!manual)return;
        if(viewIndex===index){turn.manual=true;schedule();return;}
        direction=turn.to>turn.from?-1:1;
        turn=null;
      }
      if(viewIndex===index)return;
      const nextParity=1-parity;setFace(nextParity,viewIndex);
      index=viewIndex;parity=nextParity;stable+=Math.PI*direction;dwell=0;
      turn={from:angle,to:stable,elapsed:0,manual};sync();
      if(reduced.matches){angle=stable;turn=null;}schedule();
    }
    function schedule(){if(!raf&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
    function draw(){
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);gl.uniformMatrix4fv(uniforms.projection,false,matrix);
      const bob=reduced.matches?0:Math.sin(clock*.65)*.035;
      gl.uniformMatrix4fv(uniforms.model,false,model(currentX,angle+currentY,-.055,bob));
      gl.uniform1i(uniforms.texture,0);gl.activeTexture(gl.TEXTURE0);gl.uniform1i(uniforms.textured,1);
      gl.bindTexture(gl.TEXTURE_2D,faces[0].texture);gl.uniform3f(uniforms.frame,.78,.79,.73);bind(frontMesh);gl.drawElements(gl.TRIANGLES,frontMesh.count,gl.UNSIGNED_SHORT,0);
      gl.bindTexture(gl.TEXTURE_2D,faces[1].texture);gl.uniform3f(uniforms.frame,.16,.21,.14);bind(backMesh);gl.drawElements(gl.TRIANGLES,backMesh.count,gl.UNSIGNED_SHORT,0);
      gl.uniform1i(uniforms.textured,0);gl.uniform3f(uniforms.frame,.37,.41,.32);bind(edgeMesh);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,edgeMesh.count,gl.UNSIGNED_SHORT,0);gl.enable(gl.CULL_FACE);
    }
    function frame(time){
      raf=0;if(lost||!visible||document.hidden)return;
      const dt=Math.min((time-last)/1000,.045);last=time;
      if(!paused&&!reduced.matches){clock+=dt;if(!drag&&!turn){dwell+=dt;if(dwell>6.5)go((index+1)%views.length,1,false);}}
      if(turn&&(!paused||turn.manual)){
        turn.elapsed+=dt;const t=Math.min(1,turn.elapsed/1.65),ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
        angle=turn.from+(turn.to-turn.from)*ease;
        if(t>=1){angle=turn.to;turn=null;}
      }
      currentX+=(.13+hoverX-currentX)*.09;currentY+=(hoverY-currentY)*.09;
      draw();
      if((!paused&&!reduced.matches)||drag||(turn&&(!paused||turn.manual))||Math.abs(.13+hoverX-currentX)+Math.abs(hoverY-currentY)>.0005)schedule();
    }
    function resize(){
      const box=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,box.width<500?1.5:2);
      canvas.width=Math.round(Math.max(1,box.width*dpr));canvas.height=Math.round(Math.max(1,box.height*dpr));matrix=projection(box.width/Math.max(1,box.height));schedule();
    }
    buttons.forEach((b,i)=>b.addEventListener('click',()=>go(i,1,true)));
    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'||turn)return;
      drag=true;dragPointer=e.clientX;dragStart=stable;dwell=0;canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging');schedule();
    });
    canvas.addEventListener('pointermove',e=>{
      if(drag){const delta=Math.max(-Math.PI,Math.min(Math.PI,(e.clientX-dragPointer)*.012));angle=dragStart+delta;if(Math.abs(delta)>.08)prepare(delta>0?1:-1);schedule();}
      else if(fine.matches&&!reduced.matches){const r=canvas.getBoundingClientRect();hoverX=-(e.clientY-r.top-r.height/2)/r.height*.12;hoverY=(e.clientX-r.left-r.width/2)/r.width*.10;schedule();}
    });
    function release(){
      if(!drag)return;drag=false;canvas.classList.remove('is-dragging');
      const direction=Math.round((angle-dragStart)/Math.PI);
      if(direction){index=prepare(direction);parity=1-parity;stable=dragStart+direction*Math.PI;sync();}
      turn={from:angle,to:stable,elapsed:0,manual:true};dwell=0;schedule();
    }
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('pointerleave',()=>{if(!drag){hoverX=hoverY=0;schedule();}});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const d=e.key==='ArrowRight'?1:-1;go((index+d+views.length)%views.length,d,true);}
      if(e.key==='Home'){e.preventDefault();go(0,-1,true);}
    });
    window.addEventListener('studio-motion-change',e=>{paused=e.detail.paused;if(turn&&paused)turn.manual=false;schedule();});
    reduced.addEventListener('change',()=>{if(reduced.matches&&turn){angle=stable;turn=null;}schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();schedule();}});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'60px'});
    observer.observe(host);const ro=new ResizeObserver(resize);ro.observe(host);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);host.classList.remove('is-rendered');hint.textContent='Миниатюра страницы';buttons.forEach(b=>b.disabled=true);});
    if(!fine.matches)hint.textContent='Выберите страницу ниже';
    sync();resize();host.classList.add('is-rendered');schedule();
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);observer.disconnect();ro.disconnect();[frontMesh,backMesh,edgeMesh].forEach(m=>{gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);});faces.forEach(f=>gl.deleteTexture(f.texture));gl.deleteProgram(program);},{once:true});
  };
})();
