/* A convex media facade. Projects move across the same front-facing surface. */
(() => {
  'use strict';
  window.createStudioScene = function (host) {
    const root=host.closest('.scene-shell');
    const canvas=host.querySelector('canvas'),hint=root.querySelector('#scene-hint');
    const status=root.querySelector('[data-story-status]'),link=root.querySelector('[data-scene-link]');
    const poster=host.querySelector('.scene-image-fallback img');
    const buttons=[...root.querySelectorAll('[data-scene-view]')];
    const views=buttons.map(({dataset})=>({
      kind:dataset.sceneKind,title:dataset.sceneTitle,
      url:dataset.sceneUrl,poster:dataset.scenePoster
    }));
    const descriptions=['Две компоновки дивана','Даты и города концертного тура','Подбор домика и стоимость заезда'];
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let index=0;
    function sync(){
      const view=views[index];
      buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
      canvas.setAttribute('aria-label','Сферический экран: '+view.title+'. Клавиши влево и вправо переключают проект.');
      root.dataset.sceneKind=view.kind;
      link.href=view.url;
      link.setAttribute('aria-label','Посмотреть — '+view.title);
      if(poster.getAttribute('src')!==view.poster)poster.src=view.poster;
      status.textContent=descriptions[index];
    }
    let select=next=>{index=next;sync();};
    buttons.forEach((button,i)=>button.addEventListener('click',()=>select(i,i<index?-1:1)));
    canvas.addEventListener('keydown',event=>{
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
        event.preventDefault();
        const direction=event.key==='ArrowRight'?1:-1;
        select((index+direction+views.length)%views.length,direction);
      }else if(event.key==='Home'){event.preventDefault();select(0,-1);}
    });
    sync();
    let gl;
    try{gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});}catch(_){}
    if(!gl){hint.textContent='Статичная витрина. Выбор кейса справа вверху, ссылка на кейс справа внизу.';return;}
    const vertexSource = [
      'attribute vec3 a_position; attribute vec3 a_normal; attribute vec2 a_uv;',
      'uniform mat4 u_projection; uniform float u_verticalScale;',
      'varying vec2 v_uv; varying float v_lighting; varying float v_glint;',
      'void main(){ vec4 world=vec4(a_position,1.0);',
      'vec3 light=normalize(vec3(0.0,4.0,7.0));',
      'vec3 view=normalize(vec3(0.0,0.0,6.6)-a_position);',
      'v_lighting=0.975+0.025*max(dot(a_normal,light),0.0);',
      'v_glint=0.006*pow(max(dot(a_normal,normalize(light+view)),0.0),68.0);',
      'v_uv=a_uv;',
      'gl_Position=u_projection*vec4(world.xyz-vec3(0.0,0.0,6.6),1.0);',
      // Project the original curve into the visible canvas without allocating its cropped margins.
      'gl_Position.x=(a_uv.x*2.0-1.0)*gl_Position.w;',
      'gl_Position.y*=u_verticalScale; }'
    ].join('\n');
    const fragmentSource = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif',
      'uniform sampler2D u_texture; uniform sampler2D u_next; uniform sampler2D u_corner;',
      'uniform vec2 u_storyTime; uniform float u_progress; uniform float u_direction; uniform float u_fromStory; uniform float u_toStory; uniform float u_mobile;',
      'uniform vec3 u_frame; varying vec2 v_uv; varying float v_lighting; varying float v_glint;',
      'vec3 page(sampler2D tex,vec2 uv,float kind,float time){',
      'if(u_mobile>0.5)uv.x=mix(0.08,0.92,uv.x);',
      'if(kind<0.5)return mix(texture2D(tex,uv).rgb,texture2D(u_corner,uv).rgb,smoothstep(1.8,3.0,time));',
      'float y=1.0-uv.y; float panel=700.0/1024.0;',
      'if(y<panel)return texture2D(tex,uv).rgb;',
      'float reveal=smoothstep(0.35,1.85,time);',
      'vec3 matte=kind<1.5?vec3(0.094,0.102,0.0745):vec3(0.910,0.910,0.863);',
      'float offset=(1.0-reveal)*0.014;',
      'float blend=reveal*smoothstep(panel,panel+0.012,y-offset);',
      'vec2 sampleUv=vec2(uv.x,min(1.0-panel,uv.y+offset));',
      'return mix(matte,texture2D(tex,sampleUv).rgb,blend);}',
      'void main(){',
      'float offset=v_uv.x+u_progress*u_direction;',
      'vec3 color;',
      'if(offset<0.0||offset>1.0){color=page(u_next,vec2(offset-u_direction,v_uv.y),u_toStory,u_storyTime.y);}',
      'else{color=page(u_texture,vec2(offset,v_uv.y),u_fromStory,u_storyTime.x);}',
      'float edge=min(min(v_uv.x,1.0-v_uv.x),min(v_uv.y,1.0-v_uv.y));',
      'color=mix(u_frame,color,smoothstep(0.0025,0.0035,edge));',
      'color=color*v_lighting+v_glint;',
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
    } catch(error){console.warn('Screen shader unavailable:',error.message);hint.textContent='Статичная витрина. Выбор кейса справа вверху, ссылка на кейс справа внизу.';return;}
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
    const uniforms=Object.fromEntries([
      'verticalScale','projection','texture','next','corner','storyTime','fromStory','toStory','mobile','progress','direction','frame'
    ].map(name=>[name,gl.getUniformLocation(program,'u_'+name)]));
    gl.useProgram(program);gl.enable(gl.CULL_FACE);gl.clearColor(0,0,0,0);
    function bind(mesh) {
      gl.bindBuffer(gl.ARRAY_BUFFER,mesh.vb);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,mesh.ib);
      gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,32,0);
      gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,32,12);
      gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,32,24);
    }
    const textureWidth=Math.min(4096,gl.getParameter(gl.MAX_TEXTURE_SIZE));
    const artwork=window.createBillboardArtwork(textureWidth,refreshArtwork);
    const anisotropy=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    function upload(texture,kind){
      gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,artwork.render(kind));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      if(anisotropy)gl.texParameterf(gl.TEXTURE_2D,anisotropy.TEXTURE_MAX_ANISOTROPY_EXT,gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT));
    }
    const textures=new Map();
    function refreshArtwork(kind){
      if(lost)return;
      const texture=gl.createTexture();
      upload(texture,kind);
      textures.set(kind,texture);
      if(kind===views[index].kind)host.classList.add('is-rendered');
      needsDraw=true;
      schedule();
    }
    let raf=0,visible=false,playable=false,lost=false,needsDraw=true;
    let matrix=identity(),verticalScale=1,transition=null,last=0,mobileView=false;
    const storyEnd=3.2,transitionDuration=.85;
    let storyTime=reduced.matches?storyEnd:0,outgoingStoryTime=0;
    const storyDuration=()=>index===0?3:1.85;
    const canPlay=()=>playable&&!reduced.matches&&storyTime<storyDuration()
      &&textures.has(views[index].kind)&&(index!==0||textures.has('furniture-corner'));

    select=(next,direction)=>{
      if(next===index)return;
      const ready=textures.has(views[next].kind);
      if(!lost&&!reduced.matches&&ready&&textures.has(views[index].kind)){
        if(transition&&next===transition.from){
          transition={from:index,to:next,elapsed:transitionDuration-transition.elapsed,direction:-transition.direction};
          [storyTime,outgoingStoryTime]=[outgoingStoryTime,storyTime];
        }else{
          transition={from:index,to:next,elapsed:0,direction};
          outgoingStoryTime=storyTime;
          storyTime=0;
        }
      }else{
        transition=null;
        storyTime=reduced.matches?storyEnd:0;
      }
      index=next;
      sync();
      host.classList.toggle('is-rendered',ready&&!lost);
      needsDraw=true;
      schedule();
    };
    function schedule(){
      if(!raf&&!lost&&visible&&!document.hidden){
        last=performance.now();
        raf=requestAnimationFrame(frame);
      }
    }
    function draw(){
      const from=transition?.from??index,to=transition?.to??index;
      const fromTexture=textures.get(views[from].kind);
      if(!fromTexture)return;
      gl.viewport(0,0,canvas.width,canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniformMatrix4fv(uniforms.projection,false,matrix);
      gl.uniform1f(uniforms.verticalScale,verticalScale);
      const t=transition?Math.min(1,transition.elapsed/transitionDuration):0;
      gl.uniform1f(uniforms.progress,t*t*(3-2*t));
      gl.uniform1f(uniforms.direction,transition?.direction??1);
      gl.uniform2f(uniforms.storyTime,transition?outgoingStoryTime:storyTime,storyTime);
      gl.uniform1f(uniforms.mobile,mobileView?1:0);
      gl.uniform1f(uniforms.fromStory,from);
      gl.uniform1f(uniforms.toStory,to);
      gl.uniform1i(uniforms.texture,0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,fromTexture);
      gl.uniform1i(uniforms.next,1);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,textures.get(views[to].kind));
      gl.uniform1i(uniforms.corner,2);gl.activeTexture(gl.TEXTURE2);gl.bindTexture(gl.TEXTURE_2D,textures.get('furniture-corner')??fromTexture);
      gl.uniform3f(uniforms.frame,.32,.36,.30);
      bind(frontMesh);
      gl.drawElements(gl.TRIANGLES,frontMesh.count,gl.UNSIGNED_SHORT,0);
    }
    function frame(time){
      raf=0;
      if(lost||!visible||document.hidden)return;
      const dt=Math.max(0,time-last)/1000;
      last=time;
      const changing=!!transition;
      const playing=!changing&&canPlay();
      if(changing){
        transition.elapsed+=dt;
        if(transition.elapsed>=transitionDuration)transition=null;
      }else if(playing)storyTime=Math.min(storyDuration(),storyTime+dt);
      if(needsDraw||changing||playing){
        draw();
        needsDraw=false;
      }
      if(transition||canPlay())raf=requestAnimationFrame(frame);
    }
    function resize(){
      const box=host.getBoundingClientRect(),mobile=innerWidth<=700;
      mobileView=mobile;
      // Keep the original virtual framing while rendering only the pixels inside the stage.
      const baselineWidth=Math.min(1440,box.width*.89)*.98/2.03;
      const displayWidth=mobile?box.width*1.15:Math.max(box.width,baselineWidth*3);
      const baselineHeight=innerWidth<=1000?480:Math.max(450,Math.min(640,innerWidth*.42));
      const displayHeight=mobile?box.width*1.15:baselineHeight*3;
      const [maxWidth,maxHeight]=gl.getParameter(gl.MAX_VIEWPORT_DIMS);
      const pixelRatio=Math.min(devicePixelRatio||1,2,Math.sqrt(2600000/(box.width*box.height)),maxWidth/box.width,maxHeight/box.height);
      const renderWidth=Math.round(box.width*pixelRatio),renderHeight=Math.round(box.height*pixelRatio);
      if(canvas.width!==renderWidth)canvas.width=renderWidth;
      if(canvas.height!==renderHeight)canvas.height=renderHeight;
      canvas.dataset.textureWidth=String(textureWidth);canvas.dataset.textureHeight=String(textureWidth/2);
      verticalScale=displayHeight/box.height;
      matrix=projection(displayWidth/displayHeight);
      const [,edgeY,edgeZ]=surface(1,0);
      const edgeTop=box.height/2-displayHeight*matrix[5]*edgeY/(2*(6.6-edgeZ));
      root.style.setProperty('--scene-edge-top',Math.max(0,Math.ceil(edgeTop))+'px');
      needsDraw=true;
      schedule();
    }
    reduced.addEventListener('change',()=>{
      if(reduced.matches){transition=null;storyTime=storyEnd;}
      needsDraw=true;
      schedule();
    });
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden){cancelAnimationFrame(raf);raf=0;}
      else schedule();
    });
    const observer=new IntersectionObserver(([entry])=>{
      visible=entry.isIntersecting;
      const viewportArea=innerWidth*innerHeight;
      playable=visible&&entry.intersectionRect.width*entry.intersectionRect.height>=viewportArea*.21;
      if(visible)schedule();
      else{cancelAnimationFrame(raf);raf=0;}
    },{threshold:[0,.1,.2,.3,.4,.5],rootMargin:'0px'});
    observer.observe(host);
    const ro=new ResizeObserver(resize);
    ro.observe(host);
    canvas.addEventListener('webglcontextlost',()=>{
      lost=true;cancelAnimationFrame(raf);raf=0;
      host.classList.remove('is-rendered');
      hint.textContent='Статичная витрина. Выбор кейса справа вверху, ссылка на кейс справа внизу.';
    });
    resize();
    window.addEventListener('pagehide',event=>{
      if(event.persisted)return;
      cancelAnimationFrame(raf);
      observer.disconnect();ro.disconnect();
      gl.deleteBuffer(frontMesh.vb);gl.deleteBuffer(frontMesh.ib);
      textures.forEach(texture=>gl.deleteTexture(texture));
      gl.deleteProgram(program);
    },{once:true});
  };
})();
