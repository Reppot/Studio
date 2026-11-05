/* A convex media facade. Projects move across the same front-facing surface. */
(() => {
  'use strict';
  window.createStudioScene = function (host) {
    const root=host.closest('.scene-shell')||host;
    const canvas = host.querySelector('canvas'), hint = root.querySelector('#scene-hint');
    const buttons = Array.from(root.querySelectorAll('[data-scene-view]'));
    const link=root.querySelector('[data-scene-link]');
    const status=root.querySelector('[data-story-status]'),replay=root.querySelector('[data-story-replay]');
    const focus=root.querySelector('[data-story-focus]');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let gl;
    try { gl = canvas.getContext('webgl', { alpha:true, antialias:false, preserveDrawingBuffer:true, powerPreference:'high-performance' }); } catch (_) {}
    if (!gl) { hint.textContent = 'Статичная миниатюра проекта'; replay.hidden=true;buttons.forEach(b => b.disabled = true); return; }
    const vertexSource = [
      'attribute vec3 a_position; attribute vec3 a_normal; attribute vec2 a_uv;',
      'uniform mat4 u_projection; uniform float u_span;',
      'varying vec3 v_normal; varying vec3 v_position; varying vec2 v_uv;',
      'void main(){ vec4 world=vec4(a_position,1.0);',
      'v_position=world.xyz; v_normal=a_normal; v_uv=a_uv;',
      'gl_Position=u_projection*vec4(world.xyz-vec3(0.0,0.0,6.6),1.0);',
      // Lock both UV boundaries to the page edges while depth keeps the vertical curve.
      'gl_Position.x=(a_uv.x*2.0-1.0)*u_span*gl_Position.w; }'
    ].join('\n');
    const fragmentSource = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif',
      'uniform sampler2D u_texture; uniform sampler2D u_next; uniform sampler2D u_empty; uniform sampler2D u_corner; uniform bool u_textured;',
      'uniform vec2 u_storyTime; uniform float u_progress; uniform float u_direction; uniform float u_fromStory; uniform float u_toStory; uniform float u_mobile;',
      'uniform vec3 u_frame; varying vec3 v_normal; varying vec3 v_position; varying vec2 v_uv;',
      'bool inside(vec2 p,vec4 r){return p.x>=r.x&&p.x<=r.x+r.z&&p.y>=r.y&&p.y<=r.y+r.w;}',
      'vec3 page(sampler2D tex,vec2 uv,float story,float u_storyTime){',
      'if(story>1.5){if(u_mobile>0.5)uv.x=mix(0.08,0.92,uv.x);return mix(texture2D(tex,uv).rgb,texture2D(u_corner,uv).rgb,smoothstep(3.0,4.0,u_storyTime));}',
      'if(story<0.5)return texture2D(tex,uv).rgb;',
      'if(u_mobile>0.5){float pan=smoothstep(3.8,5.3,u_storyTime);float x=mix(212.0,1026.0,pan)+uv.x*810.0;float y=340.0+(1.0-uv.y)*498.0;uv=vec2(x/2048.0,1.0-y/1024.0);}',
      'vec3 c=texture2D(tex,uv).rgb;',
      'vec2 p=vec2(uv.x*2048.0,(1.0-uv.y)*1024.0);vec3 bg=vec3(0.0863,0.0980,0.0902);',
      'if(inside(p,vec4(232.0,474.0,770.0,230.0))){',
      'float row=clamp(floor((p.y-474.0)/80.0),0.0,2.0);',
      'float scan=max(0.0,1.0-abs(u_storyTime/0.85-0.5-row))*(1.0-smoothstep(2.3,2.9,u_storyTime));',
      'c+=vec3(0.08,0.15,0.025)*scan;',
      'if(p.x>855.0){c=mix(bg,c,smoothstep(row*0.7+0.4,row*0.7+1.0,u_storyTime));}}',
      'if(inside(p,vec4(1056.0,464.0,752.0,260.0))){',
      'float row=clamp(floor((p.y-474.0)/80.0),0.0,2.0);',
      'float show=smoothstep(4.8+row*0.65,5.5+row*0.65,u_storyTime);',
      'vec3 content=texture2D(tex,uv+vec2(0.0,(1.0-show)*12.0/1024.0)).rgb;',
      'c=mix(bg,content,show);}',
      'if(inside(p,vec4(1056.0,520.0,752.0,128.0))){',
      'vec2 label=vec2((p.x-1056.0)/752.0,1.0-(p.y-520.0)/128.0);vec4 empty=texture2D(u_empty,label);',
      'c=mix(c,empty.rgb,empty.a*(1.0-smoothstep(4.3,4.9,u_storyTime)));}',
      'if(inside(p,vec4(1056.0,742.0,752.0,70.0)))c=mix(vec3(0.0667,0.0745,0.0706),c,smoothstep(7.1,7.8,u_storyTime));',
      'if(inside(p,vec4(630.0,750.0,370.0,54.0)))c=mix(vec3(0.0667,0.0745,0.0706),c,smoothstep(2.2,2.8,u_storyTime));',
      'if(inside(p,vec4(242.0,748.0,374.0,56.0)))c*=1.0-0.15*max(0.0,1.0-abs(u_storyTime-4.5)*3.5);',
      'return c;}',
      'void main(){ vec3 n=normalize(v_normal);',
      'vec3 light=normalize(vec3(0.0,4.0,7.0));',
      'vec3 view=normalize(vec3(0.0,0.0,6.6)-v_position);',
      'float diffuse=max(dot(n,light),0.0);',
      'float spec=pow(max(dot(n,normalize(light+view)),0.0),68.0);',
      'vec3 color=u_frame;',
      'if(u_textured){float offset=v_uv.x+u_progress*u_direction;',
      'if(offset<0.0||offset>1.0){color=page(u_next,vec2(offset-u_direction,v_uv.y),u_toStory,u_storyTime.y);}',
      'else{color=page(u_texture,vec2(offset,v_uv.y),u_fromStory,u_storyTime.x);}',
      'float edge=min(min(v_uv.x,1.0-v_uv.x),min(v_uv.y,1.0-v_uv.y));',
      'color=mix(u_frame,color,smoothstep(0.0025,0.0035,edge));}',
      'color*=0.975+0.025*diffuse; color+=spec*0.006;',
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
    } catch (error) { console.warn('Screen shader unavailable:',error.message);hint.textContent='Статичная миниатюра проекта';replay.hidden=true;buttons.forEach(b=>b.disabled=true);return; }
    const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    function projection(aspect) {
      const f=Math.min(4.0,aspect*3.15),near=.1,far=25;
      return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    }
    const radius=2.8,bend=1.65,height=2.3,segments=160,rows=80;
    function surface(u,v) {
      const a=(u-.5)*bend,y=(.5-v)*height,ring=Math.sqrt(radius*radius-y*y);
      return [Math.sin(a)*ring,y,Math.cos(a)*ring-radius];
    }
    function createMesh(vertices,indices) {
      const vb=gl.createBuffer(),ib=gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
      return {vb,ib,count:indices.length};
    }
    function face() {
      const vertices=[],indices=[];
      const stride=rows+1;
      for(let i=0;i<=segments;i++) for(let j=0;j<=rows;j++) {
        const u=i/segments,v=j/rows,p=surface(u,v);
        vertices.push(...p,p[0]/radius,p[1]/radius,(p[2]+radius)/radius,u,1-v);
        if(i<segments&&j<rows){const n=i*stride+j;indices.push(n,n+1,n+stride,n+stride,n+1,n+stride+1);}
      }
      return createMesh(vertices,indices);
    }
    const frontMesh=face();
    const position=gl.getAttribLocation(program,'a_position'),normal=gl.getAttribLocation(program,'a_normal'),uv=gl.getAttribLocation(program,'a_uv');
    const uniforms={span:gl.getUniformLocation(program,'u_span'),projection:gl.getUniformLocation(program,'u_projection'),texture:gl.getUniformLocation(program,'u_texture'),next:gl.getUniformLocation(program,'u_next'),empty:gl.getUniformLocation(program,'u_empty'),storyTime:gl.getUniformLocation(program,'u_storyTime'),fromStory:gl.getUniformLocation(program,'u_fromStory'),toStory:gl.getUniformLocation(program,'u_toStory'),mobile:gl.getUniformLocation(program,'u_mobile'),progress:gl.getUniformLocation(program,'u_progress'),direction:gl.getUniformLocation(program,'u_direction'),textured:gl.getUniformLocation(program,'u_textured'),frame:gl.getUniformLocation(program,'u_frame')};
    const cornerUniform=gl.getUniformLocation(program,'u_corner');
    gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
    function bind(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ib);
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,32,0);
      gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,32,12);
      gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,32,24);
    }
    const views=buttons.map(b=>({title:b.dataset.sceneTitle,kind:b.dataset.sceneKind,url:b.dataset.sceneUrl}));
    const textureWidth=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const artwork=window.createBillboardArtwork(textureWidth,refreshArtwork);
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    function texture(view) {
      const t=gl.createTexture();upload(t,view);return t;
    }
    function upload(t,view){
      gl.bindTexture(gl.TEXTURE_2D,t);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,artwork.render(view.kind));
      gl.generateMipmap(gl.TEXTURE_2D);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    }
    const textures=views.map(texture);
    const cornerView={kind:'furniture-corner'};
    const cornerTexture=texture(cornerView);
    function refreshArtwork(kind){
      if(kind===cornerView.kind)upload(cornerTexture,cornerView);
      else{
        const i=views.findIndex(view=>view.kind===kind);
        upload(textures[i],views[i]);
      }
      needsDraw=true;schedule();
    }
    const emptyTexture=gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D,emptyTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,artwork.empty());
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    let raf=0,visible=true,playable=false,paused=document.documentElement.classList.contains('ambient-paused'),lost=false,needsDraw=true;
    let matrix=identity(),span=1,index=0,transition=null,dwell=0,last=0,storyTime=0,outgoingStoryTime=0,lastDraw=0,lastStep='',hold=false,mobileView=false;
    const duration=1.25,clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
    const isSindaris=(i=index)=>views[i].kind==='sindaris';
    const dwellLimit=()=>isSindaris()?14:10;
    function sync(){
      buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===index)));
      canvas.setAttribute('aria-label','Сферический экран: '+views[index].title+'. Клавиши влево и вправо переключают проект.');
      const view=views[index],isCase=view.kind==='sindaris';
      root.dataset.sceneKind=view.kind;
      link.href=view.url;
      link.textContent=isCase?'Открыть проект':'Попробовать';
      link.setAttribute('aria-label',isCase?'Открыть проект '+view.title:'Попробовать конфигуратор дивана');
      if(isCase){link.target='_blank';link.rel='noopener noreferrer';}else{link.removeAttribute('target');link.removeAttribute('rel');}
      replay.hidden=reduced.matches;
      replay.setAttribute('aria-label',isCase?'Повторить демонстрацию проекта '+view.title:'Повторить демонстрацию конфигуратора дивана');
      const description=isCase?'Демонстрация сверки склада и переноса ресурсов в заказ.':'Демонстрация двух компоновок модульного дивана.';
      hint.textContent=description+' Кнопки управления находятся в правом верхнем углу экрана.';
      lastStep='';syncStory();
    }
    function syncStory(){
      const isCase=isSindaris();
      const step=isCase?(storyTime<2.5?0:storyTime<4.8?1:storyTime<7.8?2:3):(storyTime<3.5?0:1);
      if(String(step)!==lastStep){
        lastStep=String(step);root.dataset.storyStep=lastStep;
        status.textContent=isCase?'Пример работы · '+['Сверяем склад','Не хватает 55 ящиков','Переносим нехватку в заказ','Состав заказа готов'][step]:['Прямая компоновка','Угловая компоновка'][step];
      }
    }
    function go(viewIndex,direction=1,manual=false) {
      if(manual)hold=true;
      if(!raf)last=performance.now();
      if(viewIndex===index){
        if(transition&&manual){transition.manual=true;schedule();}
        return;
      }
      if(transition&&!manual)return;
      if(transition&&viewIndex===transition.from){
        transition={from:transition.to,to:transition.from,elapsed:duration-transition.elapsed,direction:-transition.direction,manual};
        [storyTime,outgoingStoryTime]=[outgoingStoryTime,storyTime];
      }else{
        transition={from:index,to:viewIndex,elapsed:0,direction,manual};
        outgoingStoryTime=storyTime;
        storyTime=isSindaris(viewIndex)&&(reduced.matches||paused)?9:0;
      }
      index=viewIndex;dwell=0;needsDraw=true;sync();
      if(reduced.matches)transition=null;
      schedule();
    }
    function schedule(){if(!raf&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
    function draw(){
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.useProgram(program);gl.uniformMatrix4fv(uniforms.projection,false,matrix);
      gl.uniform1f(uniforms.span,span);
      const t=transition?clamp(transition.elapsed/duration,0,1):0,ease=t*t*(3-2*t);
      gl.uniform1f(uniforms.progress,ease);gl.uniform1f(uniforms.direction,transition?transition.direction:1);
      gl.uniform2f(uniforms.storyTime,transition?outgoingStoryTime:storyTime,storyTime);
      gl.uniform1f(uniforms.mobile,mobileView?1:0);
      gl.uniform1f(uniforms.fromStory,isSindaris(transition?transition.from:index)?1:2);
      gl.uniform1f(uniforms.toStory,isSindaris(transition?transition.to:index)?1:2);
      gl.uniform1i(uniforms.texture,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,textures[transition?transition.from:index]);
      gl.uniform1i(uniforms.next,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures[transition?transition.to:index]);
      gl.uniform1i(uniforms.empty,2);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,emptyTexture);
      gl.uniform1i(cornerUniform,3);gl.activeTexture(gl.TEXTURE3);gl.bindTexture(gl.TEXTURE_2D,cornerTexture);
      gl.uniform1i(uniforms.textured,1);gl.uniform3f(uniforms.frame,.32,.36,.30);bind(frontMesh);gl.drawElements(gl.TRIANGLES,frontMesh.count,gl.UNSIGNED_SHORT,0);
    }
    function frame(time){
      raf=0;if(lost||!visible||document.hidden)return;
      const dt=Math.min((time-last)/1000,1),wasTransition=!!transition;last=time;
      let storyMoving=false;
      if(!paused&&!reduced.matches&&playable&&!transition){
        dwell+=dt;
        if(storyTime<9){storyTime=Math.min(9,storyTime+dt);storyMoving=true;}
        if(!hold&&dwell>dwellLimit())go((index+1)%views.length,1,false);
      }
      if(transition&&(!paused||transition.manual)){
        transition.elapsed+=dt;
        if(transition.elapsed>=duration)transition=null;
      }
      syncStory();
      if(needsDraw||transition||wasTransition||(storyMoving&&time-lastDraw>=1000/30)){draw();needsDraw=false;lastDraw=time;}
      if((!paused&&!reduced.matches&&playable)||(transition&&(!paused||transition.manual)))schedule();
    }
    function resize(){
      const box=host.getBoundingClientRect(),mobile=innerWidth<=700;
      mobileView=mobile;
      // Three times the previous hero canvas, in both dimensions. The full-width stage frames it.
      const baselineWidth=Math.min(1440,box.width*.89)*.98/2.03;
      const displayWidth=mobile?box.width*1.15:Math.max(box.width,baselineWidth*3);
      const baselineHeight=innerWidth<=1000?480:Math.max(450,Math.min(640,innerWidth*.42));
      const displayHeight=mobile?box.width*1.15:baselineHeight*3;
      canvas.style.width=displayWidth+'px';canvas.style.height=displayHeight+'px';
      canvas.style.left=(box.width-displayWidth)/2+'px';canvas.style.top=(box.height-displayHeight)/2+'px';
      const limit=Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0]);
      const desired=mobile?Math.min(2048,Math.ceil(displayWidth*Math.max(2,devicePixelRatio||1))):4096;
      const renderWidth=Math.min(limit,desired,limit*displayWidth/displayHeight);
      canvas.width=Math.round(renderWidth);canvas.height=Math.round(Math.min(4096,renderWidth*displayHeight/displayWidth));
      canvas.dataset.textureWidth=String(textureWidth);canvas.dataset.textureHeight=String(textureWidth/2);
      span=box.width/displayWidth;matrix=projection(displayWidth/displayHeight);
      const [,edgeY,edgeZ]=surface(1,0);
      const edgeTop=box.height/2-displayHeight*matrix[5]*edgeY/(2*(6.6-edgeZ));
      root.style.setProperty('--scene-edge-top',Math.max(0,Math.ceil(edgeTop))+'px');
      draw();gl.flush();schedule();
      const resizeError=gl.getError();
      if(resizeError!==gl.NO_ERROR)console.warn('Screen resize error:',resizeError);
    }
    buttons.forEach((b,i)=>b.addEventListener('click',()=>go(i,i<index?-1:1,true)));
    replay.addEventListener('click',()=>{
      if(reduced.matches)return;
      hold=true;
      storyTime=dwell=0;needsDraw=true;last=performance.now();syncStory();
      const blocked=document.querySelector('.site-header').getBoundingClientRect().height;
      window.scrollTo({top:Math.max(0,scrollY+focus.getBoundingClientRect().top-(innerHeight+blocked)/2),behavior:'smooth'});
      window.dispatchEvent(new CustomEvent('studio-motion-play'));schedule();
    });
    root.querySelector('.scene-toolbar').addEventListener('focusin',()=>{hold=true;});
    canvas.addEventListener('keydown',e=>{
      if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const d=e.key==='ArrowRight'?1:-1;go((index+d+views.length)%views.length,d,true);}
      if(e.key==='Home'){e.preventDefault();go(0,-1,true);}
    });
    window.addEventListener('studio-motion-change',e=>{paused=e.detail.paused;last=performance.now();if(transition&&paused)transition.manual=false;schedule();});
    reduced.addEventListener('change',()=>{if(reduced.matches){transition=null;storyTime=isSindaris()?9:0;}needsDraw=true;sync();schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{last=performance.now();schedule();}});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){last=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'60px'});
    let playbackObserver;
    function observePlayback(){
      if(playbackObserver)playbackObserver.disconnect();
      const cut=Math.round(innerHeight*.25);
      playbackObserver=new IntersectionObserver(entries=>{playable=entries[0].isIntersecting;if(playable){last=performance.now();schedule();}},{rootMargin:'-'+cut+'px 0px -'+cut+'px 0px'});
      playbackObserver.observe(focus);
    }
    observePlayback();window.addEventListener('resize',observePlayback);
    observer.observe(host);const ro=new ResizeObserver(resize);ro.observe(host);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);host.classList.remove('is-rendered');hint.textContent='Статичная миниатюра проекта';replay.hidden=true;buttons.forEach(b=>b.disabled=true);});
    sync();resize();host.classList.add('is-rendered');schedule();
    window.addEventListener('pagehide',e=>{if(e.persisted)return;cancelAnimationFrame(raf);observer.disconnect();playbackObserver.disconnect();window.removeEventListener('resize',observePlayback);ro.disconnect();gl.deleteBuffer(frontMesh.vb);gl.deleteBuffer(frontMesh.ib);textures.forEach(t=>gl.deleteTexture(t));gl.deleteTexture(cornerTexture);gl.deleteTexture(emptyTexture);gl.deleteProgram(program);},{once:true});
  };
})();
