import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

const regions = [
  {
    id: 'prefrontal',
    name: 'Префронтальная кора',
    subtitle: 'Планирование, контроль и выбор стратегии',
    description: 'Отвечает за постановку целей, удержание правил, торможение импульсивных реакций и выбор следующего действия. В цифровой архитектуре это будущий слой executive control.',
    tags: ['планирование', 'контроль', 'решения'],
    color: 0xc7a7ff,
    center: [-1.65, 0.45, 0.45],
    scale: [1.25, 1.15, 1.0],
  },
  {
    id: 'motor',
    name: 'Моторная кора',
    subtitle: 'Запуск действий и процедурных паттернов',
    description: 'Переводит намерения в последовательности действий. В проекте ей соответствует процедурная память, инструменты и исполнение выбранной стратегии.',
    tags: ['действие', 'процедуры', 'инструменты'],
    color: 0xffb3c7,
    center: [-0.45, 1.05, 0.55],
    scale: [0.95, 0.7, 0.95],
  },
  {
    id: 'parietal',
    name: 'Теменная кора',
    subtitle: 'Сборка контекста и пространственная модель',
    description: 'Интегрирует разные сигналы в единую картину ситуации. В цифровом мозге это слой, который связывает память, текущий контекст и модель внешнего мира.',
    tags: ['контекст', 'интеграция', 'модель мира'],
    color: 0x9ed8ff,
    center: [0.65, 1.05, 0.35],
    scale: [1.1, 0.8, 1.0],
  },
  {
    id: 'temporal',
    name: 'Височная кора',
    subtitle: 'Семантика, язык и распознавание значений',
    description: 'Связывает слова, объекты, людей и смысловые категории. В проекте это семантическая память и система интерпретации входящего опыта.',
    tags: ['семантика', 'язык', 'распознавание'],
    color: 0x8ce6ce,
    center: [0.15, -0.15, 0.95],
    scale: [1.65, 0.78, 0.82],
  },
  {
    id: 'occipital',
    name: 'Затылочная кора',
    subtitle: 'Восприятие и первичная обработка сигналов',
    description: 'Обрабатывает входящую визуальную информацию. В универсальном контейнере это модуль perception: преобразование сырого сигнала в структурированное событие.',
    tags: ['восприятие', 'сигналы', 'события'],
    color: 0xffd58f,
    center: [1.72, 0.35, 0.05],
    scale: [0.95, 1.05, 0.9],
  },
  {
    id: 'hippocampus',
    name: 'Гиппокамп',
    subtitle: 'Эпизодическая память и консолидация опыта',
    description: 'Быстро записывает события и связывает их с контекстом. В Djbrain это слой episodic memory, temporal indexing и последующей консолидации.',
    tags: ['эпизоды', 'консолидация', 'время'],
    color: 0xf3a6ff,
    center: [0.15, -0.25, 0.0],
    scale: [0.9, 0.34, 0.42],
  },
  {
    id: 'amygdala',
    name: 'Миндалина',
    subtitle: 'Значимость, эмоциональная маркировка и приоритет',
    description: 'Оценивает важность и эмоциональную значимость событий. В цифровой системе это salience engine: что сохранить, чему повысить вес и что считать угрозой или наградой.',
    tags: ['значимость', 'эмоции', 'приоритет'],
    color: 0xff8f8f,
    center: [-0.15, -0.38, 0.22],
    scale: [0.28, 0.24, 0.28],
  },
  {
    id: 'cerebellum',
    name: 'Мозжечок',
    subtitle: 'Автоматизация, точность и коррекция ошибок',
    description: 'Стабилизирует действия и обучается на рассогласовании между намерением и результатом. В проекте это feedback loop, автоматизация навыков и коррекция поведения.',
    tags: ['ошибки', 'обучение', 'автоматизация'],
    color: 0xaeb7ff,
    center: [1.05, -0.85, -0.35],
    scale: [0.85, 0.62, 0.72],
  },
];

document.querySelector('#app').innerHTML = `
  <main class="app-shell">
    <canvas id="brain-canvas" aria-label="Интерактивная трёхмерная модель мозга"></canvas>
    <header class="topbar">
      <div class="brand">
        <p class="brand-kicker">Digital cognitive architecture</p>
        <h1 class="brand-title">Djbrain</h1>
      </div>
      <div class="status-pill"><span class="status-dot"></span> neural runtime online</div>
    </header>
    <div class="legend" aria-hidden="true">
      <div class="legend-row"><span class="legend-node"></span> функциональный регион</div>
      <div class="legend-row"><span class="legend-line"></span> активный импульс</div>
    </div>
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
      <div class="panel-tags" id="panel-tags"></div>
    </section>
    <div class="hint">Вращай мозг · нажимай на зоны · приближай двумя пальцами</div>
    <div class="loading" id="loading"><div class="loading-inner"><div class="loading-ring"></div><span>building neural container</span></div></div>
  </main>
`;

const canvas = document.querySelector('#brain-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x05060a, 0.055);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(0, 1.2, 8.4);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 4.2;
controls.maxDistance = 12;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.55;
controls.target.set(0, 0.15, 0);

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

const clickable = [];
const regionGroups = new Map();
const sphereGeometry = new THREE.IcosahedronGeometry(0.47, 3);

function seededNoise(seed) {
  const x = Math.sin(seed * 999.91) * 43758.5453;
  return x - Math.floor(x);
}

regions.forEach((region, regionIndex) => {
  const group = new THREE.Group();
  group.userData.region = region;
  const material = new THREE.MeshPhysicalMaterial({
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
    const p = new THREE.Vector3(
      Math.cos(a) * Math.cos(b),
      Math.sin(b),
      Math.sin(a) * Math.cos(b),
    );
    p.multiply(new THREE.Vector3(...region.scale)).multiplyScalar(radius * 0.64);
    p.add(new THREE.Vector3(...region.center));

    const mesh = new THREE.Mesh(sphereGeometry, material.clone());
    const size = 0.65 + seededNoise(regionIndex * 100 + i * 17.4) * 0.55;
    mesh.scale.setScalar(size);
    mesh.scale.y *= 0.82 + seededNoise(regionIndex * 100 + i * 4.4) * 0.3;
    mesh.position.copy(p);
    mesh.rotation.set(seededNoise(i + 2), seededNoise(i + 9), seededNoise(i + 15));
    mesh.userData.region = region;
    group.add(mesh);
    clickable.push(mesh);
  }

  brain.add(group);
  regionGroups.set(region.id, group);
});

// Central connective core.
const coreMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xf0e8ff,
  roughness: 0.55,
  transparent: true,
  opacity: 0.18,
  emissive: 0x7d4fa1,
  emissiveIntensity: 0.35,
});
const core = new THREE.Mesh(new THREE.SphereGeometry(1.05, 48, 32), coreMaterial);
core.scale.set(1.7, 1.08, 1.1);
core.position.set(0.15, 0.15, 0.08);
brain.add(core);

// Subtle neural points cloud.
const pointPositions = [];
for (let i = 0; i < 900; i += 1) {
  const t = Math.random() * Math.PI * 2;
  const p = Math.acos(2 * Math.random() - 1);
  const r = 2.45 + (Math.random() - 0.5) * 0.45;
  pointPositions.push(
    Math.sin(p) * Math.cos(t) * r * 1.12,
    Math.cos(p) * r * 0.62 + 0.1,
    Math.sin(p) * Math.sin(t) * r * 0.72,
  );
}
const pointsGeo = new THREE.BufferGeometry();
pointsGeo.setAttribute('position', new THREE.Float32BufferAttribute(pointPositions, 3));
const points = new THREE.Points(pointsGeo, new THREE.PointsMaterial({
  color: 0xd8c9f0,
  size: 0.018,
  transparent: true,
  opacity: 0.24,
  depthWrite: false,
}));
brain.add(points);

const pathways = [];
const impulseGroup = new THREE.Group();
brain.add(impulseGroup);

function makePath(a, b, index) {
  const start = new THREE.Vector3(...a.center);
  const end = new THREE.Vector3(...b.center);
  const mid = start.clone().lerp(end, 0.5);
  mid.y += 0.6 + (index % 3) * 0.18;
  mid.z += (index % 2 ? 0.45 : -0.4);
  const curve = new THREE.CatmullRomCurve3([start, mid, end]);
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({
    color: 0x9fffdc,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  }));
  impulseGroup.add(line);

  const pulseMaterial = new THREE.MeshBasicMaterial({ color: index % 2 ? 0xe8d8ff : 0x9fffdc });
  const pulse = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), pulseMaterial);
  pulse.userData.offset = Math.random();
  pulse.userData.speed = 0.06 + Math.random() * 0.085;
  impulseGroup.add(pulse);
  pathways.push({ curve, pulse, line });
}

const links = [[0,2],[2,4],[0,5],[5,3],[3,6],[6,0],[5,7],[7,2],[1,0],[1,3],[4,7],[2,5]];
links.forEach(([a,b], index) => makePath(regions[a], regions[b], index));

// Outer orbital traces.
for (let i = 0; i < 3; i += 1) {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(3.25 + i * 0.25, 0.006, 6, 160),
    new THREE.MeshBasicMaterial({ color: i === 1 ? 0x84f5d0 : 0xb994e8, transparent: true, opacity: 0.09 }),
  );
  ring.rotation.set(Math.PI / 2.2 + i * 0.28, i * 0.37, i * 0.22);
  brain.add(ring);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hovered = null;
let selected = null;
let impulsesEnabled = true;

function pointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function regionFromEvent(event) {
  pointerFromEvent(event);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(clickable, false)[0];
  return hit?.object?.userData?.region ?? null;
}

function applyRegionVisuals() {
  regions.forEach((region) => {
    const active = selected?.id === region.id || hovered?.id === region.id;
    regionGroups.get(region.id).children.forEach((mesh) => {
      mesh.material.emissiveIntensity = active ? 1.2 : 1;
      mesh.material.opacity = selected && selected.id !== region.id ? 0.34 : (region.id === 'hippocampus' || region.id === 'amygdala' ? 0.92 : 0.83);
      mesh.scale.setScalar(mesh.scale.x * 0 + (active ? 1.05 : 1));
    });
  });
}

const panel = document.querySelector('#info-panel');
function openPanel(region) {
  selected = region;
  document.querySelector('#panel-index').textContent = `module / ${String(regions.indexOf(region) + 1).padStart(2, '0')}`;
  document.querySelector('#panel-title').textContent = region.name;
  document.querySelector('#panel-subtitle').textContent = region.subtitle;
  document.querySelector('#panel-copy').textContent = region.description;
  document.querySelector('#panel-tags').innerHTML = region.tags.map((tag) => `<span class="panel-tag">${tag}</span>`).join('');
  panel.classList.remove('is-hidden');
  controls.autoRotate = false;
}

canvas.addEventListener('pointermove', (event) => {
  hovered = regionFromEvent(event);
  canvas.style.cursor = hovered ? 'pointer' : 'grab';
});
canvas.addEventListener('pointerdown', () => { canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', (event) => {
  canvas.style.cursor = hovered ? 'pointer' : 'grab';
  const region = regionFromEvent(event);
  if (region) openPanel(region);
});

canvas.addEventListener('dblclick', () => {
  selected = null;
  panel.classList.add('is-hidden');
});

document.querySelector('#close-panel').addEventListener('click', () => {
  selected = null;
  panel.classList.add('is-hidden');
});

document.querySelector('#reset-view').addEventListener('click', () => {
  camera.position.set(0, 1.2, 8.4);
  controls.target.set(0, 0.15, 0);
  controls.update();
});

document.querySelector('#toggle-rotation').addEventListener('click', (event) => {
  controls.autoRotate = !controls.autoRotate;
  event.currentTarget.textContent = controls.autoRotate ? 'Ⅱ' : '▶';
});

document.querySelector('#toggle-impulses').addEventListener('click', (event) => {
  impulsesEnabled = !impulsesEnabled;
  impulseGroup.visible = impulsesEnabled;
  event.currentTarget.style.opacity = impulsesEnabled ? '1' : '.45';
});

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (width < 700) camera.position.z = Math.max(camera.position.z, 9.2);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
function animate() {
  const elapsed = clock.getElapsedTime();
  controls.update();
  points.rotation.y = elapsed * 0.012;
  points.material.opacity = 0.2 + Math.sin(elapsed * 0.7) * 0.045;

  pathways.forEach(({ curve, pulse }, index) => {
    const t = (elapsed * pulse.userData.speed + pulse.userData.offset) % 1;
    pulse.position.copy(curve.getPointAt(t));
    const flare = 0.75 + Math.sin(elapsed * 8 + index) * 0.22;
    pulse.scale.setScalar(flare);
  });

  regions.forEach((region, index) => {
    const group = regionGroups.get(region.id);
    const targetScale = selected?.id === region.id ? 1.045 : hovered?.id === region.id ? 1.025 : 1;
    group.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.09);
    group.children.forEach((mesh, meshIndex) => {
      mesh.material.emissiveIntensity = 0.7 + Math.sin(elapsed * 1.2 + index * 0.7 + meshIndex * 0.08) * 0.18 + (selected?.id === region.id ? 0.65 : 0);
    });
  });

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();

setTimeout(() => document.querySelector('#loading').classList.add('is-done'), 650);
