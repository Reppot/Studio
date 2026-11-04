/* A small, self-contained WebGL renderer. No remote scripts or asset requests. */
(() => {
  'use strict';
  window.createStudioScene = function (host) {
    const canvas = host.querySelector('canvas');
    const hint = host.querySelector('#scene-hint');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let gl;
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, powerPreference: 'low-power' }); } catch (_) {}
    if (!gl) { hint.textContent = 'Форма и функция'; return; }

    const vertexSource = [
      'attribute vec3 a_position;',
      'attribute vec3 a_normal;',
      'uniform mat4 u_model;',
      'uniform mat4 u_projection;',
      'varying vec3 v_normal;',
      'varying vec3 v_position;',
      'void main(){',
      '  vec4 world = u_model * vec4(a_position, 1.0);',
      '  v_position = world.xyz;',
      '  v_normal = mat3(u_model) * a_normal;',
      '  gl_Position = u_projection * vec4(world.xyz - vec3(0.0,0.0,7.8),1.0);',
      '}'
    ].join('\n');
    const fragmentSource = [
      'precision mediump float;',
      'uniform vec3 u_color;',
      'varying vec3 v_normal;',
      'varying vec3 v_position;',
      'void main(){',
      '  vec3 n = normalize(v_normal);',
      '  if(!gl_FrontFacing) n = -n;',
      '  vec3 light = normalize(vec3(-3.0,5.0,6.0));',
      '  vec3 view = normalize(vec3(0.0,0.0,7.8)-v_position);',
      '  float diffuse = max(dot(n,light),0.0);',
      '  float fill = max(dot(n,normalize(vec3(3.0,-1.0,2.0))),0.0);',
      '  vec3 halfVector = normalize(light+view);',
      '  float spec = pow(max(dot(n,halfVector),0.0),45.0);',
      '  float edge = pow(1.0-max(dot(n,view),0.0),3.0);',
      '  vec3 col = u_color*(0.34+diffuse*0.66+fill*0.12);',
      '  col += vec3(1.0,0.91,0.76)*(spec*0.42+edge*0.12);',
      '  float grain = fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);',
      '  col += (grain-0.5)*0.009;',
      '  gl_FragColor = vec4(col,1.0);',
      '}'
    ].join('\n');
    function shader(type, source) {
      const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); throw new Error('Shader compilation failed'); }
      return s;
    }
    let program, vs, fs;
    try {
      vs = shader(gl.VERTEX_SHADER, vertexSource); fs = shader(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Shader link failed');
    } catch (_) { hint.textContent = 'Форма и функция'; return; }

    const identity = () => new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    function multiply(a,b) {
      const out = new Float32Array(16);
      for(let c=0;c<4;c++) for(let r=0;r<4;r++) out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
      return out;
    }
    function rotate(x,y,z) {
      const cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
      const rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]);
      const ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]);
      const rz=new Float32Array([cz,sz,0,0,-sz,cz,0,0,0,0,1,0,0,0,0,1]);
      return multiply(multiply(rx,ry),rz);
    }
    function translate(x,y,z) { const m=identity();m[12]=x;m[13]=y;m[14]=z;return m; }
    function perspective(aspect) {
      const f=1/Math.tan(33*Math.PI/360),n=.1,far=30;
      return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+n)/(n-far),-1,0,0,2*far*n/(n-far),0]);
    }
    function point(u,v) {
      const twist=u+.35*Math.sin(2*u),a=.28*Math.cos(v),b=.10*Math.sin(v);
      const radial=a*Math.cos(twist)-b*Math.sin(twist),height=a*Math.sin(twist)+b*Math.cos(twist);
      const radius=1.03+.06*Math.cos(4*u);
      return [(radius+radial)*Math.cos(u),(radius+radial)*Math.sin(u),height+.10*Math.sin(2*u)];
    }
    const vertices=[],indices=[],nu=200,nv=28;
    for(let i=0;i<=nu;i++) for(let j=0;j<=nv;j++) {
      const u=i/nu*Math.PI*2,v=j/nv*Math.PI*2,p=point(u,v),du=point(u+.001,v),dv=point(u,v+.001);
      const a=du.map((q,k)=>q-p[k]),b=dv.map((q,k)=>q-p[k]);
      let normal=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const len=Math.hypot.apply(null,normal)||1;normal=normal.map(q=>q/len);
      vertices.push.apply(vertices,p.concat(normal));
      if(i<nu&&j<nv){const n=i*(nv+1)+j;indices.push(n,n+nv+1,n+1,n+1,n+nv+1,n+nv+2);}
    }
    const vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),gl.STATIC_DRAW);
    gl.useProgram(program);
    const position=gl.getAttribLocation(program,'a_position'),normal=gl.getAttribLocation(program,'a_normal');
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,3,gl.FLOAT,false,24,0);
    gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,24,12);
    const modelUniform=gl.getUniformLocation(program,'u_model'),projectionUniform=gl.getUniformLocation(program,'u_projection'),colorUniform=gl.getUniformLocation(program,'u_color');
    gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);

    let raf=0,visible=true,paused=document.documentElement.classList.contains('ambient-paused'),lost=false,angle=0,lastTime=0;
    let targetX=.23,targetY=-.25,currentX=.23,currentY=-.25,dragging=false,lastX=0,lastY=0;
    const fine=window.matchMedia('(pointer:fine)');
    let projection=identity();
    const localA=multiply(translate(-.42,.18,.08),rotate(.15,.1,-.2));
    const localB=multiply(translate(.42,-.18,0),rotate(.72,1.15,.55));
    function schedule(){if(!raf&&!lost&&visible&&!document.hidden)raf=requestAnimationFrame(frame);}
    function draw() {
      gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(projectionUniform,false,projection);
      const base=rotate(currentX,currentY+angle,-.12);
      gl.uniformMatrix4fv(modelUniform,false,multiply(base,localA));
      gl.uniform3f(colorUniform,.91,.25,.115);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
      gl.uniformMatrix4fv(modelUniform,false,multiply(base,localB));
      gl.uniform3f(colorUniform,.79,.78,.70);gl.drawElements(gl.TRIANGLES,indices.length,gl.UNSIGNED_SHORT,0);
    }
    function frame(time) {
      raf=0;if(lost||!visible||document.hidden)return;
      const dt=Math.min((time-lastTime)/1000,.04);lastTime=time;
      if(!paused&&!dragging)angle+=dt*.105;
      currentX+=(targetX-currentX)*.08;currentY+=(targetY-currentY)*.08;
      draw();
      if(!paused||dragging||Math.abs(targetX-currentX)+Math.abs(targetY-currentY)>.0008)schedule();
    }
    function resize(){
      const box=host.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,box.width<500?1.35:1.7);
      canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));
      projection=perspective(box.width/Math.max(box.height,1));schedule();
    }
    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch')return;
      dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId);canvas.classList.add('is-dragging');schedule();
    });
    canvas.addEventListener('pointermove',e=>{
      if(dragging){targetY+=(e.clientX-lastX)*.009;targetX+=(e.clientY-lastY)*.006;lastX=e.clientX;lastY=e.clientY;schedule();}
      else if(fine.matches&&!reduced.matches){const r=canvas.getBoundingClientRect();targetX=.23+(e.clientY-r.top-r.height/2)/r.height*.3;targetY=-.25+(e.clientX-r.left-r.width/2)/r.width*.5;schedule();}
    });
    const release=()=>{dragging=false;canvas.classList.remove('is-dragging');};
    canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);
    canvas.addEventListener('keydown',e=>{
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
      e.preventDefault();if(e.key==='ArrowLeft')targetY-=.2;if(e.key==='ArrowRight')targetY+=.2;if(e.key==='ArrowUp')targetX-=.2;if(e.key==='ArrowDown')targetX+=.2;schedule();
    });
    window.addEventListener('studio-motion-change',event=>{paused=event.detail.paused;schedule();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else{lastTime=performance.now();schedule();}});
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible){lastTime=performance.now();schedule();}else{cancelAnimationFrame(raf);raf=0;}},{rootMargin:'80px'});
    observer.observe(host);
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;cancelAnimationFrame(raf);host.classList.remove('is-rendered');hint.textContent='Форма и функция';});
    if(!fine.matches)hint.textContent='Форма и функция';
    resize();host.classList.add('is-rendered');schedule();
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);observer.disconnect();resizeObserver.disconnect();gl.deleteBuffer(vertexBuffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);},{once:true});
  };
})();
