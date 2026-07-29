import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { cognitiveModules, runtimeRoute, learningRoute } from './data/cognitive-modules.js';
import './style.css';

const anatomicalRegions = [
  { id: 'prefrontal', title: 'Префронтальная кора', subtitle: 'Планирование и контроль', description: 'Исполнительный контроль, выбор стратегии и торможение импульсивных реакций.', tags: ['планирование', 'контроль', 'решения'], color: 0xc7a7ff, center: [-1.65, 0.45, 0.45], scale: [1.25, 1.15, 1.0] },
  { id: 'motor', title: 'Моторная кора', subtitle: 'Запуск действий', description: 'Переводит намерения в последовательности действий и процедур.', tags: ['действие', 'процедуры'], color: 0xffb3c7, center: [-0.45, 1.05, 0.55], scale: [0.95, 0.7, 0.95] },
  { id: 'parietal', title: 'Теменная кора', subtitle: 'Сборка контекста', description: 'Интегрирует сигналы, память и текущую картину ситуации.', tags: ['контекст', 'интеграция'], color: 0x9ed8ff, center: [0.65, 1.05, 0.35], scale: [1.1, 0.8, 1.0] },
  { id: 'temporal', title: 'Височная кора', subtitle: 'Семантика и язык', description: 'Связывает слова, людей, объекты и смысловые категории.', tags: ['семантика', 'язык'], color: 0x8ce6ce, center: [0.15, -0.15, 0.95], scale: [1.65, 0.78, 0.82] },
  { id: 'occipital', title: 'Затылочная кора', subtitle: 'Восприятие сигналов', description: 'Преобразует входящий сигнал в структурированное представление.', tags: ['восприятие', 'сигналы'], color: 0xffd58f, center: [1.72, 0.35, 0.05], scale: [0.95, 1.05, 0.9] },
  { id: 'hippocampus', title: 'Гиппокамп', subtitle: 'Эпизоды и консолидация', description: 'Быстро записывает события и связывает их со временем и контекстом.', tags: ['эпизоды', 'время'], color: 0xf3a6ff, center: [0.15, -0.25, 0.0], scale: [0.9, 0.34, 0.42] },
  { id: 'amygdala', title: 'Миндалина', subtitle: 'Значимость и приоритет', description: 'Оценивает эмоциональный вес, риск и важность события.', tags: ['значимость', 'приоритет'], color: 0xff8f8f, center: [-0.15, -0.38, 0.22], scale: [0.28, 0.24, 0.28] },
  { id: 'cerebellum', title: 'Мозжечок', subtitle: 'Коррекция ошибок', description: 'Стабилизирует действия и обучается на рассогласовании между намерением и результатом.', tags: ['ошибки', 'обучение'], color: 0xaeb7ff, center: [1.05, -0.85, -0.35], scale: [0.85, 0.62, 0.72] },
];

const moduleColors = [0xbda4ff, 0x8fd9ff, 0xffb7cf, 0x8ff0d2, 0xffd48f, 0xf5a7ff, 0xff9494, 0x9eb8ff, 0xa6ffd8, 0xe8c6ff, 0xffc09f, 0x9df1ff, 0xd9ffa5];
const modulePositions = new Map();
cognitiveModules.forEach((module, index) => {
  const ring = index < 7 ? 2.45 : 1.75;
  const localIndex = index < 7 ? index : index - 7;
  const count = index < 7 ? 7 : cognitiveModules.length - 7;
  const angle = (localIndex / count) * Math.PI * 2 - Math.PI / 2;
  const y = index < 7 ? Math.sin(angle * 2) * 0.55 : Math.sin(angle * 2 + 0.8) * 0.35;
  modulePositions.set(module.id, new THREE.Vector3(Math.cos(angle) * ring, y, Math.sin(angle) * ring * 0.72));
});

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
    <canvas id="brain-canvas" aria-label="Интерактивная трёхмерная модель цифрового мозга"></canvas>

    <header class="topbar">
      <div class="brand">
        <p class="brand-kicker">Digital cognitive architecture</p>
        <h1 class="brand-title">Djbrain</h1>
      </div>
      <div class="status-pill"><span class="status-dot"></span><span id="runtime-status">architecture online</span></div>
    </header>

    <nav class="mode-switcher" aria-label="Режим отображения">
      <button class="mode-button is-active" data-mode="architecture">Architecture</button>
      <button class="mode-button" data-mode="anatomy">Anatomy</button>
    </nav>

    <section class="runtime-card" id="runtime-card">
      <div class="runtime-head">
        <div>
          <p class="runtime-kicker">Live route simulator</p>
          <h2>Когнитивный цикл</h2>
        </div>
        <span class="route-badge" id="route-badge">response</span>
      </div>
      <div class="route-progress" id="route-progress" aria-live="polite">Готов к симуляции</div>
      <div class="runtime-actions">
        <button class="action-button is-primary" id="run-response">▶ Ответ</button>
        <button class="action-button" id="run-learning">↻ Обучение</button>
      </div>
    </section>

    <div class="control-stack">
      <button class="icon-button" id="reset-view" aria-label="Сбросить положение камеры">↺</button>
      <button class="icon-button" id="toggle-rotation" aria-label="Включить или выключить автовращение">Ⅱ</button>
      <button class="icon-button" id="toggle-impulses" aria-label="Включить или выключить импульсы">⚡</button>
    </div>

    <section class="info-panel is-hidden" id="info-panel" aria-live="polite">
      <button class="close-button" id="close-panel" aria-label="Закрыть описание">×</button>
      <div class="panel-index" id="panel-index"></div>
      <h2 class="panel-title" id="panel-title"></h2>
      <p class="panel-subtitle" id="panel-subtitle"></p>
      <p class="panel-copy" id="panel-copy"></p>
      <div class="module-metrics" id="module-metrics"></div>
      <div class="io-grid" id="io-grid"></div>
      <div class="panel-tags" id="panel-tags"></div>
    </section>

    <div class="hint" id="hint">Нажимай на модули · запускай маршрут · вращай двумя пальцами</div>
    <div class="loading" id="loading"><div class="loading-inner"><div class="loading-ring"></div><span>mapping cognitive runtime</span></div></div>
  </main>
`;

const canvas = document.querySelector('#brain-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.05);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 1.2, 8.8);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 4.6;
controls.maxDistance = 12;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.42;
controls.target.set(0, 0.1, 0);

scene.add(new THREE.HemisphereLight(0xd8e4ff, 0x160f1f, 1.55));
const key = new THREE.DirectionalLight(0xffffff, 3.2);
key.position.set(-4, 6, 5);
scene.add(key);
const rim = new THREE.PointLight(0xa76cff, 18, 14, 2);
rim.position.set(4, 1, -3);
scene.add(rim);
const cyan = new THREE.PointLight(0x7dffd9, 10, 11, 2);
cyan.position.set(-3, -2, 3);
scene.add(cyan);

const brain = new THREE.Group();
brain.rotation.z = -0.08;
scene.add(brain);

const anatomyGroup = new THREE.Group();
const architectureGroup = new THREE.Group();
brain.add(anatomyGroup, architectureGroup);

const anatomyClickable = [];
const anatomyGroups = new Map();
const sphereGeometry = new THREE.IcosahedronGeometry(0.47, 3);

function seededNoise(seed) {
  const x = Math.sin(seed * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

anatomicalRegions.forEach((region, regionIndex) => {
  const group = new THREE.Group();
  group.userData.item = { ...region, kind: 'anatomy' };
  const baseMaterial = new THREE.MeshPhysicalMaterial({
    color: region.color,
    roughness: 0.5,
    metalness: 0.02,
    transmission: 0.08,
    thickness: 0.6,
    clearcoat: 0.2,
    clearcoatRoughness: 0.65,
    transparent: true,
    opacity: region.id === 'hippocampus' || region.id === 'amygdala' ? 0.92 : 0.83,
    emissive: new THREE.Color(region.color).multiplyScalar(0.055),
    emissiveIntensity: 1,
  });

  const count = region.id === 'amygdala' ? 4 : region.id === 'hippocampus' ? 10 : 18;
  for (let i = 0; i < count; i += 1) {
    const a = seededNoise(regionIndex * 100 + i * 3.1) * Math.PI * 2;
    const b = seededNoise(regionIndex * 100 + i * 7.7) * Math.PI - Math.PI / 2;
    const radius = 0.55 + seededNoise(regionIndex * 100 + i * 11.3) * 0.5;
    const p = new THREE.Vector3(Math.cos(a) * Math.cos(b), Math.sin(b), Math.sin(a) * Math.cos(b));
    p.multiply(new THREE.Vector3(...region.scale)).multiplyScalar(radius * 0.64);
    p.add(new THREE.Vector3(...region.center));
    const mesh = new THREE.Mesh(sphereGeometry, baseMaterial.clone());
    const size = 0.65 + seededNoise(regionIndex * 100 + i * 17.4) * 0.55;
    mesh.scale.setScalar(size);
    mesh.scale.y *= 0.82 + seededNoise(regionIndex * 100 + i * 4.4) * 0.3;
    mesh.position.copy(p);
    mesh.userData.item = group.userData.item;
    group.add(mesh);
    anatomyClickable.push(mesh);
  }
  anatomyGroup.add(group);
  anatomyGroups.set(region.id, group);
});

const coreMaterial = new THREE.MeshPhysicalMaterial({ color: 0xf0e8ff, roughness: 0.55, transparent: true, opacity: 0.16, emissive: 0x7d4fa1, emissiveIntensity: 0.35 });
const core = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 32), coreMaterial);
core.scale.set(1.7, 1.08, 1.1);
core.position.set(0.15, 0.15, 0.08);
anatomyGroup.add(core);

const moduleClickable = [];
const moduleMeshes = new Map();
const moduleLabels = new Map();
const pathwayGroup = new THREE.Group();
architectureGroup.add(pathwayGroup);

function makeTextSprite(text) {
  const canvasLabel = document.createElement('canvas');
  const context = canvasLabel.getContext('2d');
  canvasLabel.width = 512;
  canvasLabel.height = 128;
  context.clearRect(0, 0, 512, 128);
  context.font = '600 34px Inter, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = '#f4f1f8';
  context.fillText(text, 256, 56);
  const texture = new THREE.CanvasTexture(canvasLabel);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.78 }));
  sprite.scale.set(1.65, 0.42, 1);
  return sprite;
}

cognitiveModules.forEach((module, index) => {
  const color = moduleColors[index % moduleColors.length];
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.25,
    metalness: 0.04,
    transmission: 0.12,
    thickness: 0.8,
    clearcoat: 0.75,
    clearcoatRoughness: 0.22,
    emissive: new THREE.Color(color).multiplyScalar(0.12),
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.88,
  });
  const geometry = index % 3 === 0 ? new THREE.OctahedronGeometry(0.34, 2) : index % 3 === 1 ? new THREE.IcosahedronGeometry(0.34, 2) : new THREE.SphereGeometry(0.34, 28, 20);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(modulePositions.get(module.id));
  mesh.userData.item = { ...module, kind: 'module', color };
  architectureGroup.add(mesh);
  moduleClickable.push(mesh);
  moduleMeshes.set(module.id, mesh);

  const label = makeTextSprite(module.title);
  label.position.copy(mesh.position).add(new THREE.Vector3(0, -0.56, 0));
  architectureGroup.add(label);
  moduleLabels.set(module.id, label);
});

const routeEdges = new Map();
function edgeKey(a, b) { return `${a}->${b}`; }
function createRouteEdge(a, b) {
  const keyName = edgeKey(a, b);
  if (routeEdges.has(keyName)) return routeEdges.get(keyName);
  const start = modulePositions.get(a);
  const end = modulePositions.get(b);
  if (!start || !end) return null;
  const mid = start.clone().lerp(end, 0.5).multiplyScalar(0.78);
  mid.y += 0.28;
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)),
    new THREE.LineBasicMaterial({ color: 0xa9ffe1, transparent: true, opacity: 0.1, depthWrite: false }),
  );
  pathwayGroup.add(line);
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 16), new THREE.MeshBasicMaterial({ color: 0xdfffee }));
  pulse.visible = false;
  pathwayGroup.add(pulse);
  const edge = { curve, line, pulse };
  routeEdges.set(keyName, edge);
  return edge;
}

[runtimeRoute, learningRoute].forEach((route) => {
  route.slice(0, -1).forEach((id, index) => createRouteEdge(id, route[index + 1]));
});

const innerCore = new THREE.Mesh(
  new THREE.IcosahedronGeometry(0.92, 4),
  new THREE.MeshPhysicalMaterial({ color: 0x171524, roughness: 0.26, metalness: 0.1, transparent: true, opacity: 0.74, emissive: 0x5e3f7c, emissiveIntensity: 0.62, wireframe: true }),
);
architectureGroup.add(innerCore);

const pointPositions = [];
for (let i = 0; i < 900; i += 1) {
  const t = Math.random() * Math.PI * 2;
  const p = Math.acos(2 * Math.random() - 1);
  const r = 2.9 + (Math.random() - 0.5) * 0.55;
  pointPositions.push(Math.sin(p) * Math.cos(t) * r * 1.12, Math.cos(p) * r * 0.62 + 0.1, Math.sin(p) * Math.sin(t) * r * 0.72);
}
const pointsGeo = new THREE.BufferGeometry();
pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({ color: 0xd8c9f0, size: 0.018, transparent: true, opacity: 0.2, depthWrite: false }));
brain.add(points);

for (let i = 0; i < 3; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.25 + i * 0.25, 0.006, 6, 160),
    new THREE.MeshBasicMaterial({ color: i === 1 ? 0x84f5d0 : 0xb994e8, transparent: true, opacity: 0.08 }),
  );
  ring.rotation.set(Math.PI / 2.2 + i * 0.28, i * 0.37, i * 0.22);
  brain.add(ring);
}

let currentMode = 'architecture';
let hovered = null;
let selected = null;
let impulsesEnabled = true;
let routeAnimation = null;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setMode(mode) {
  currentMode = mode;
  architectureGroup.visible = mode === 'architecture';
  anatomyGroup.visible = mode === 'anatomy';
  document.querySelectorAll('.mode-button').forEach((button) => button.classList.toggle('is-active', button.dataset.mode === mode));
  document.querySelector('#runtime-card').classList.toggle('is-hidden', mode !== 'architecture');
  document.querySelector('#hint').textContent = mode === 'architecture'
    ? 'Нажимай на модули · запускай маршрут · вращай двумя пальцами'
    : 'Вращай мозг · нажимай на зоны · приближай двумя пальцами';
  selected = null;
  hovered = null;
  document.querySelector('#info-panel').classList.add('is-hidden');
}

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function itemFromEvent(event) {
  pointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const targets = currentMode === 'architecture' ? moduleClickable : anatomyClickable;
  return raycaster.intersectObjects(targets, false)[0]?.object?.userData?.item ?? null;
}

function statusLabel(status) {
  return status === 'schema_ready' ? 'schema ready' : status || 'available';
}

function openPanel(item) {
  selected = item;
  const isModule = item.kind === 'module';
  document.querySelector('#panel-index').textContent = isModule ? `cognitive module / ${item.id}` : `anatomy / ${item.id}`;
  document.querySelector('#panel-title').textContent = isModule ? item.title : item.title;
  document.querySelector('#panel-subtitle').textContent = isModule ? item.name : item.subtitle;
  document.querySelector('#panel-copy').textContent = isModule ? item.role : item.description;
  document.querySelector('#panel-tags').innerHTML = (isModule ? [item.changesAt, item.anatomicalAnchor, ...(item.memoryAccess || [])] : item.tags)
    .map((tag) => `<span class="panel-tag">${tag}</span>`).join('');

  document.querySelector('#module-metrics').innerHTML = isModule ? `
    <div><span>Status</span><strong>${statusLabel(item.status)}</strong></div>
    <div><span>Plasticity</span><strong>${item.changesAt}</strong></div>
    <div><span>Memory</span><strong>${item.memoryAccess?.length || 0} layers</strong></div>
  ` : '';

  document.querySelector('#io-grid').innerHTML = isModule ? `
    <div><span class="io-label">Inputs</span>${item.inputs.map((value) => `<code>${value}</code>`).join('')}</div>
    <div><span class="io-label">Outputs</span>${item.outputs.map((value) => `<code>${value}</code>`).join('')}</div>
  ` : '';

  document.querySelector('#info-panel').classList.remove('is-hidden');
  controls.autoRotate = false;
}

function setModuleActive(id, active) {
  const mesh = moduleMeshes.get(id);
  if (!mesh) return;
  mesh.material.emissiveIntensity = active ? 3.2 : 0.8;
  mesh.scale.setScalar(active ? 1.28 : 1);
}

function resetRouteVisuals() {
  moduleMeshes.forEach((mesh) => {
    mesh.material.emissiveIntensity = 0.8;
    mesh.scale.setScalar(1);
  });
  routeEdges.forEach(({ line, pulse }) => {
    line.material.opacity = 0.1;
    pulse.visible = false;
  });
}

function startRoute(route, type) {
  resetRouteVisuals();
  routeAnimation = { route, type, startedAt: performance.now(), stepDuration: 760, currentStep: -1 };
  document.querySelector('#route-badge').textContent = type;
  document.querySelector('#runtime-status').textContent = type === 'learning' ? 'plasticity cycle active' : 'response cycle active';
  controls.autoRotate = false;
}

document.querySelectorAll('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelector('#run-response').addEventListener('click', () => startRoute(runtimeRoute, 'response'));
document.querySelector('#run-learning').addEventListener('click', () => startRoute(learningRoute, 'learning'));

canvas.addEventListener('pointermove', (event) => {
  hovered = itemFromEvent(event);
  canvas.style.cursor = hovered ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerdown', () => { canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', (event) => {
  canvas.style.cursor = hovered ? 'pointer' : 'grab';
  const item = itemFromEvent(event);
  if (item) openPanel(item);
});

document.querySelector('#close-panel').addEventListener('click', () => {
  selected = null;
  document.querySelector('#info-panel').classList.add('is-hidden');
});

document.querySelector('#reset-view').addEventListener('click', () => {
  camera.position.set(0, 1.2, 8.8);
  controls.target.set(0, 0.1, 0);
  controls.update();
});

document.querySelector('#toggle-rotation').addEventListener('click', (event) => {
  controls.autoRotate = !controls.autoRotate;
  event.currentTarget.textContent = controls.autoRotate ? 'Ⅱ' : '▶';
});

document.querySelector('#toggle-impulses').addEventListener('click', (event) => {
  impulsesEnabled = !impulsesEnabled;
  pathwayGroup.visible = impulsesEnabled;
  event.currentTarget.style.opacity = impulsesEnabled ? '1' : '.45';
});

function updateRoute(now) {
  if (!routeAnimation) return;
  const { route, startedAt, stepDuration, type } = routeAnimation;
  const elapsed = now - startedAt;
  const stepFloat = elapsed / stepDuration;
  const step = Math.floor(stepFloat);
  const progress = stepFloat - step;

  if (step >= route.length) {
    document.querySelector('#route-progress').textContent = type === 'learning' ? 'Опыт консолидирован в модель личности' : 'Ответ проверен и готов к выдаче';
    document.querySelector('#runtime-status').textContent = 'architecture online';
    routeAnimation = null;
    setTimeout(resetRouteVisuals, 900);
    return;
  }

  if (step !== routeAnimation.currentStep) {
    routeAnimation.currentStep = step;
    resetRouteVisuals();
    setModuleActive(route[step], true);
    const module = cognitiveModules.find((entry) => entry.id === route[step]);
    document.querySelector('#route-progress').textContent = `${String(step + 1).padStart(2, '0')} / ${String(route.length).padStart(2, '0')} · ${module?.title || route[step]}`;
  }

  if (step < route.length - 1 && impulsesEnabled) {
    const edge = routeEdges.get(edgeKey(route[step], route[step + 1]));
    if (edge) {
      edge.line.material.opacity = 0.58;
      edge.pulse.visible = true;
      edge.pulse.position.copy(edge.curve.getPointAt(Math.min(progress, 0.999)));
      edge.pulse.scale.setScalar(0.85 + Math.sin(now * 0.018) * 0.18);
    }
  }
}

function updateVisualStates(elapsed) {
  if (currentMode === 'architecture') {
    cognitiveModules.forEach((module, index) => {
      const mesh = moduleMeshes.get(module.id);
      const label = moduleLabels.get(module.id);
      if (!routeAnimation) {
        const active = selected?.id === module.id || hovered?.id === module.id;
        mesh.material.emissiveIntensity = active ? 2.4 : 0.75 + Math.sin(elapsed * 1.1 + index) * 0.16;
        const target = active ? 1.14 : 1;
        mesh.scale.lerp(new THREE.Vector3(target, target, target), 0.12);
      }
      label.material.opacity = selected && selected.id !== module.id ? 0.26 : 0.78;
    });
    innerCore.rotation.x = elapsed * 0.08;
    innerCore.rotation.y = elapsed * 0.12;
  } else {
    anatomicalRegions.forEach((region, index) => {
      const group = anatomyGroups.get(region.id);
      const active = selected?.id === region.id || hovered?.id === region.id;
      const target = active ? 1.04 : 1;
      group.scale.lerp(new THREE.Vector3(target, target, target), 0.09);
      group.children.forEach((mesh, meshIndex) => {
        mesh.material.emissiveIntensity = 0.7 + Math.sin(elapsed * 1.2 + index * 0.7 + meshIndex * 0.08) * 0.18 + (active ? 0.65 : 0);
      });
    });
  }
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (width < 700) camera.position.z = Math.max(camera.position.z, 9.5);
}
window.addEventListener('resize', resize);
resize();
setMode('architecture');

const clock = new THREE.Clock();
function animate(now) {
  const elapsed = clock.getElapsedTime();
  controls.update();
  points.rotation.y = elapsed * 0.012;
  points.material.opacity = 0.18 + Math.sin(elapsed * 0.7) * 0.04;
  updateVisualStates(elapsed);
  updateRoute(now);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
setTimeout(() => document.querySelector('#loading').classList.add('is-done'), 650);
