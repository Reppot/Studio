import * as THREE from 'three';
import { RoundedBoxGeometry } from './assets/vendor/three/RoundedBoxGeometry.js';

const positions = [-.83, 0, .83];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function weave() {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 71;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const thread = (Math.sin(x * Math.PI / 2) + Math.cos(y * Math.PI / 2)) * 12;
      const shade = 220 + thread - (seed >>> 27);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = shade;
      data[i + 3] = 255;
    }
  }
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 3);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

export function createModel(canvas, initial, onContextChange) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.14;
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 40);
  const stage = canvas.parentElement;
  scene.add(new THREE.HemisphereLight(0xfff8ee, 0x9a8c79, 1.7));
  const key = new THREE.DirectionalLight(0xfff2df, 3.2);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -3;
  key.shadow.camera.right = key.shadow.camera.top = 3;
  key.shadow.normalBias = .018;
  key.shadow.bias = -.00025;
  key.shadow.radius = 3;
  scene.add(key);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: .24 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const bumpMap = weave();
  const cloth = new THREE.MeshStandardMaterial({ color: initial.color, roughness: .94, bumpMap, bumpScale: .013 });
  const baseCloth = cloth.clone();
  const feet = new THREE.MeshStandardMaterial({ color: '#514335', roughness: .82 });

  function cushion(width, height, depth, radius, material, x, y, z) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 4, radius), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  const modules = positions.map(x => ({
    base: cushion(.824, .268, 1, .052, baseCloth, x, .178, 0),
    seat: cushion(.821, .172, .75, .073, cloth, x, .344, .125),
    back: cushion(.821, .43, .25, .089, cloth, x, .565, -.375),
    drawer: cushion(.814, .17, .685, .035, baseCloth, x, .126, .85),
    bed: cushion(.821, .172, .7, .066, cloth, x, .344, .85),
    loungeAmount: 0,
    bedAmount: 0
  }));
  for (const side of [-1, 1]) {
    cushion(.16, .47, .87, .07, cloth, side * 1.32, .279, .065);
    for (const z of [-.37, .37]) cushion(.11, .072, .12, .013, feet, side * 1.16, .036, z);
  }

  let target = initial;
  let elevation = initial.height === 99 ? 1 : 0;
  let frame = 0;
  let previous = 0;
  let lost = false;
  let angle = .49;
  let view = 'perspective';
  let drag = null;
  const targetColor = new THREE.Color(initial.color);
  const focus = new THREE.Vector3();
  const near = (value, wanted) => Math.abs(value - wanted) < .003;
  const animate = (value, wanted, amount) => near(value, wanted) ? wanted : value + (wanted - value) * amount;

  function layoutModel(amount) {
    const tall = target.height === 99 ? 1 : 0;
    elevation = animate(elevation, tall, amount);
    cloth.color.lerp(targetColor, amount);
    baseCloth.color.copy(cloth.color).multiplyScalar(.85);
    let moving = elevation !== tall || Math.abs(cloth.color.r - targetColor.r) + Math.abs(cloth.color.g - targetColor.g) + Math.abs(cloth.color.b - targetColor.b) > .004;
    for (const [i, module] of modules.entries()) {
      const chaise = target.chaise === i ? 1 : 0;
      const unfolded = target.open && !chaise ? 1 : 0;
      module.loungeAmount = animate(module.loungeAmount, chaise, amount);
      module.bedAmount = animate(module.bedAmount, unfolded, amount);
      const reach = .7 * module.loungeAmount;
      module.base.scale.z = 1 + reach;
      module.base.position.z = reach / 2;
      module.seat.scale.z = 1 + reach / .75;
      module.seat.position.z = .125 + reach / 2;
      module.back.scale.y = 1 + elevation * .21 / .43;
      module.back.position.y = .565 + elevation * .105;
      module.drawer.visible = module.bed.visible = module.bedAmount > .01;
      module.drawer.position.z = module.bed.position.z = .15 + module.bedAmount * .7;
      module.bed.position.y = .16 + .184 * THREE.MathUtils.smoothstep(module.bedAmount, .28, 1);
      moving ||= module.loungeAmount !== chaise || module.bedAmount !== unfolded;
    }
    return moving;
  }

  function render() {
    const aspect = stage.clientWidth / Math.max(1, stage.clientHeight);
    const top = view === 'top';
    const side = view === 'side';
    const depth = Math.max(...modules.map(module => module.loungeAmount), ...modules.map(module => module.bedAmount));
    const center = .26 * depth;
    const span = Math.max(top ? 2.62 : 2.35, (top ? 3.33 : 3.65) / aspect);
    camera.left = -span * aspect / 2;
    camera.right = -camera.left;
    camera.top = span / 2;
    camera.bottom = -camera.top;
    camera.up.set(0, top ? 0 : 1, top ? -1 : 0);
    focus.set(0, top ? 0 : .43 + elevation * .04, center);
    if (top) camera.position.set(0, 7, center);
    else if (side) camera.position.set(5.5, focus.y, center);
    else camera.position.set(Math.sin(angle) * 5.5, 2.65, Math.cos(angle) * 5.5 + center);
    camera.lookAt(focus);
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  }

  function tick(now) {
    frame = 0;
    if (lost) return;
    const elapsed = previous ? Math.min(45, now - previous) : 16;
    const amount = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 55);
    previous = now;
    const moving = layoutModel(amount);
    render();
    if (moving) schedule();
    else previous = 0;
  }

  function schedule() {
    if (!lost && !frame) frame = requestAnimationFrame(tick);
  }

  function resize() {
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    schedule();
  }

  canvas.addEventListener('pointerdown', event => {
    if (view !== 'perspective' || event.button !== 0) return;
    drag = { id: event.pointerId, start: event.clientX, angle };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    angle = drag.angle - (event.clientX - drag.start) * .011;
    schedule();
  });
  canvas.addEventListener('lostpointercapture', () => { drag = null; });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    onContextChange(false);
  });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false;
    resize();
    onContextChange(true);
  });

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  layoutModel(1);
  resize();
  render();
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    cancelAnimationFrame(frame);
    observer.disconnect();
    scene.traverse(object => { if (object.isMesh) object.geometry.dispose(); });
    ground.material.dispose();
    cloth.dispose();
    baseCloth.dispose();
    feet.dispose();
    bumpMap.dispose();
    key.shadow.dispose();
    renderer.dispose();
  }, { once: true });

  return {
    update(configuration) {
      target = configuration;
      targetColor.set(configuration.color);
      schedule();
    },
    view(kind) {
      view = kind;
      canvas.toggleAttribute('data-fixed', view !== 'perspective');
      if (view === 'perspective') angle = .49;
      schedule();
    }
  };
}
