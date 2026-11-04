/* A convex media facade. Projects move across the same front-facing surface. */
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
      'precision mediump float; uniform sampler2D u_texture; uniform sampler2D u_next; uniform bool u_textured;',
      'uniform float u_progress; uniform float u_direction;',
      'uniform vec3 u_frame; varying vec3 v_normal; varying vec3 v_position; varying vec2 v_uv;',
      'void main(){ vec3 n=normalize(v_normal);',
      'vec3 light=normalize(vec3(-2.0,4.0,7.0));',
      'vec3 view=normalize(vec3(0.0,0.0,6.6)-v_position);',
      'float diffuse=max(dot(n,light),0.0);',
      'float spec=pow(max(dot(n,normalize(light+view)),0.0),68.0);',
      'vec3 color=u_frame;',
      'if(u_textured){float offset=v_uv.x+u_progress*u_direction;',
      'if(offset<0.0||offset>1.0){color=texture2D(u_next,vec2(offset-u_direction,v_uv.y)).rgb;}',
      'else{color=texture2D(u_texture,vec2(offset,v_uv.y)).rgb;}',
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
      const f=Math.min(4.0,aspect*3.15),near=.1,far=25;
      return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    }
    const radius=2.8,bend=1.65,height=2.3,thickness=.045,segments=96;
    function surface(u,v,back=false) {
      const a=(u-.5)*bend;
      return [Math.sin(a)*radius,(.5-v)*height,(Math.cos(a)-1)*radius+(back?-thickness:thickness)];
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
        vertices.push(...p,Math.sin(a)*(back?-1:1),0,Math.cos(a)*(back?-1:1),back?1-u:u,1-j);
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
    const uniforms={model:gl.getUniformLocation(program,'u_model'),projection:gl.getUniformLocation(program,'u_projection'),texture:gl.getUniformLocation(program,'u_texture'),next:gl.getUniformLocation(program,'u_next'),progress:gl.getUniformLocation(program,'u_progress'),direction:gl.getUniformLocation(program,'u_direction'),textured:gl.getUniformLocation(program,'u_textured'),frame:gl.getUniformLocation(program,'u_frame')};
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
      const page=document.createElement('canvas');page.width=2048;page.height=1024;
      const c=page.getContext('2d'),dark=view.kind==='sindaris';
      c.fillStyle=dark?'#0b110c':'#f7f5ed';c.fillRect(0,0,2048,1024);
      if(dark){
        c.fillStyle='#e1ebd5';c.font='bold 40px Arial';c.fillText('SINDARIS',72,108);
        c.font='22px Consolas,monospace';c.fillStyle='#91a177';c.fillText('Terminal',310,107);
        c.font='23px Arial';c.fillText('Логистика / Foxhole',1650,107);
        c.fillStyle='#33462b';c.fillRect(72,155,1904,2);
        c.font='bold 86px Arial';c.fillStyle='#edf1e5';c.fillText('Логистика',72,335);
        c.font='italic 86px Georgia';c.fillStyle='#b5dc68';c.fillText('в одном окне.',72,442);
        c.fillStyle='#a8b995';c.font='29px Arial';c.fillText('Заказы, снабжение',76,560);c.fillText('и карта планирования.',76,604);
        rounded(c,914,250,1034,512,12,'#121a12','#33462b');
        if(screenshot.complete&&screenshot.naturalWidth)c.drawImage(screenshot,930,266,1002,480);
        c.fillStyle='#a8b995';c.font='22px Consolas,monospace';c.fillText('Заказы  /  Снабжение  /  Планирование',940,832);
        c.fillStyle='#91a177';c.font='20px Consolas,monospace';c.fillText('Next.js  /  FastAPI  /  PostgreSQL',76,906);
        c.fillStyle='#33462b';c.fillRect(72,958,1904,2);
      }else{
        c.fillStyle='#ed5038';c.fillRect(76,75,13,39);c.fillRect(99,84,13,30);c.fillRect(122,94,13,20);
        c.fillStyle='#202421';c.font='bold 33px Arial';c.fillText('Веб-студия',164,109);
        c.font='22px Arial';c.fillStyle='#767d6c';c.fillText('Услуги       Проекты       Контакты',1480,108);
        c.fillStyle='#d1d6c7';c.fillRect(72,155,1904,2);
        c.fillStyle='#8b9381';c.font='18px Consolas,monospace';c.fillText('ДИЗАЙН И ВЕБ-РАЗРАБОТКА',80,238);
        c.fillStyle='#202421';c.font='94px Arial';c.fillText('Сайты и',76,370);c.fillText('веб-сервисы',76,478);
        c.fillStyle='#ed5038';c.font='italic 108px Georgia';c.fillText('под ключ.',76,600);
        c.fillStyle='#7b8273';c.font='26px Arial';c.fillText('От первой схемы до работающего продукта.',80,696);
        c.fillText('Интерфейс, серверная часть и интеграции.',80,738);
        rounded(c,80,804,330,86,3,'#202421');
        c.fillStyle='#f7f5ed';c.font='25px Arial';c.fillText('Обсудить проект',116,856);
        const labels=['Интерфейс','Разработка','Интеграции'];
        for(let i=0;i<3;i++){
          const x=1120,y=236+i*225;rounded(c,x,y,836,190,8,i===1?'#e4e9d9':'#eeeee3','#d2d7c7');
          c.fillStyle=i===1?'#ed5038':'#9da98d';c.font='22px Consolas,monospace';c.fillText('0'+(i+1),x+33,y+49);
          c.fillStyle='#30392a';c.font='41px Arial';c.fillText(labels[i],x+33,y+111);
          c.fillStyle='#bac5ac';c.fillRect(x+33,y+147,510,4);c.fillRect(x+33,y+163,340,4);
        }
        c.fillStyle='#ced4c3';c.fillRect(72,958,1904,2);
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
    const textures=views.map(texture);
    screenshot.addEventListener('load',()=>{views.forEach((view,i)=>{if(view.kind==='sindaris')upload(textures[i],view);});schedule();});
    let raf=0,visible=true,paused=document.documentElement.classList.contains('ambient-paused'),lost=false;
    let matrix=identity(),index=0,transition=null,dwell=0,clock=0,last=0;
    let hoverX=0,hoverY=0,currentX=.08,currentY=-.12,drag=false,dragYaw=0,dragStart=0,dragPointer=0;
    const duration=1.25,clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
    function sync(){
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
      counter.textContent=String(index+1).padStart(2,'0')+' / '+String(views.length).padStart(2,'0');
      canvas.setAttribute('aria-label','Изогнутый 3D-экран: '+views[index].title+'. Перетаскивайте для лёгкого наклона; клавиши влево и вправо переключают проект.');
    }
    function go(viewIndex,direction=1,manual=false) {
      if(viewIndex===index){
        if(transition&&manual){transition.manual=true;schedule();}
        return;
      }
      if(transition&&!manual)return;
      if(transition&&viewIndex===transition.from){
        transition={from:transition.to,to:transition.from,elapsed:duration-transition.elapsed,direction:-transition.direction,manual};
      }else transition={from:index,to:viewIndex,elapsed:0,direction,manual};
      index=viewIndex;dwell=0;sync();
      if(reduced.matches)transition=null;
      schedule();
    }
    function schedule(){if(!raf&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
    function draw(){
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);gl.uniformMatrix4fv(uniforms.projection,false,matrix);
      const bob=reduced.matches?0:Math.sin(clock*.65)*.035;
      gl.uniformMatrix4fv(uniforms.model,false,model(currentX,currentY,-.025,bob));
      const t=transition?clamp(transition.elapsed/duration,0,1):0,ease=t*t*(3-2*t);
      gl.uniform1f(uniforms.progress,ease);gl.uniform1f(uniforms.direction,transition?transition.direction:1);
      gl.uniform1i(uniforms.texture,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[transition?transition.from:index]);
      gl.uniform1i(uniforms.next,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[transition?transition.to:index]);
      gl.uniform1i(uniforms.textured,1);gl.uniform3f(uniforms.frame,.55,.59,.50);bind(frontMesh);gl.drawElements(gl.TRIANGLES,frontMesh.count,gl.UNSIGNED_SHORT,0);
      gl.uniform1i(uniforms.textured,0);gl.uniform3f(uniforms.frame,.16,.21,.14);bind(backMesh);gl.drawElements(gl.TRIANGLES,backMesh.count,gl.UNSIGNED_SHORT,0);
      gl.uniform1i(uniforms.textured,0);gl.uniform3f(uniforms.frame,.37,.41,.32);bind(edgeMesh);gl.disable(gl.CULL_FACE);gl.drawElements(gl.TRIANGLES,edgeMesh.count,gl.UNSIGNED_SHORT,0);gl.enable(gl.CULL_FACE);
    }
    function frame(time){
      raf=0;if(lost||!visible||document.hidden)return;
      const dt=Math.min((time-last)/1000,.045);last=time;
      if(!paused&&!reduced.matches){clock+=dt;if(!drag&&!transition){dwell+=dt;if(dwell>6.5)go((index+1)%views.length,1,false);}}
      if(transition&&(!paused||transition.manual)){
        transition.elapsed+=dt;
        if(transition.elapsed>=duration)transition=null;
      }
      const targetX=.08+hoverX,targetY=-.12+(reduced.matches?0:Math.sin(clock*.3)*.055)+hoverY+dragYaw;
      currentX+=(targetX-currentX)*.09;currentY+=(clamp(targetY,-.38,.26)-currentY)*.09;
      draw();
      if((!paused&&!reduced.matches)||drag||(transition&&(!paused||transition.manual))||Math.abs(targetX-currentX)+Math.abs(clamp(targetY,-.38,.26)-currentY)>.0005)schedule();
    }
    function resize(){
      const box=host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,box.width<500?1.5:2);
      canvas.width=Math.round(Math.max(1,box.width*dpr));canvas.height=Math.round(Math.max(1,box.height*dpr));matrix=projection(box.width/Math.max(1,box.height));schedule();
    }
    buttons.forEach((b,i)=>b.addEventListener('click',()=>go(i,1,true)));
    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch'||reduced.matches)return;
      drag=true;dragPointer=e.clientX;dragStart=dragYaw;dwell=0;canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging');schedule();
    });
    canvas.addEventListener('pointermove',e=>{
      if(drag){dragYaw=clamp(dragStart+(e.clientX-dragPointer)*.003,-.22,.22);schedule();}
      else if(fine.matches&&!reduced.matches){const r=canvas.getBoundingClientRect();hoverX=-(e.clientY-r.top-r.height/2)/r.height*.08;hoverY=(e.clientX-r.left-r.width/2)/r.width*.07;schedule();}
    });
    function release(){
      if(!drag)return;drag=false;dragYaw=0;canvas.classList.remove('is-dragging');dwell=0;schedule();
    }
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('pointerleave',()=>{if(!drag){hoverX=hoverY=0;schedule();}});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const d=e.key==='ArrowRight'?1:-1;go((index+d+views.length)%views.length,d,true);}
      if(e.key==='Home'){e.preventDefault();go(0,-1,true);}
    });
    window.addEventListener('studio-motion-change',e=>{paused=e.detail.paused;if(transition&&paused)transition.manual=false;schedule();});
    reduced.addEventListener('change',()=>{if(reduced.matches){transition=null;hoverX=hoverY=dragYaw=0;}schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();schedule();}});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'60px'});
    observer.observe(host);const ro=new ResizeObserver(resize);ro.observe(host);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);host.classList.remove('is-rendered');hint.textContent='Миниатюра страницы';buttons.forEach(b=>b.disabled=true);});
    if(!fine.matches||reduced.matches)hint.textContent='Выберите проект ниже';
    sync();resize();host.classList.add('is-rendered');schedule();
    window.addEventListener('pagehide',e=>{if(e.persisted)return;cancelAnimationFrame(raf);observer.disconnect();ro.disconnect();[frontMesh,backMesh,edgeMesh].forEach(m=>{gl.deleteBuffer(m.vb);gl.deleteBuffer(m.ib);});textures.forEach(t=>gl.deleteTexture(t));gl.deleteProgram(program);},{once:true});
  };
})();
