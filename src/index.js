const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Globe</title>
<style>
  html,body{margin:0;height:100%;background:#07080e;overflow:hidden;font-family:ui-sans-serif,system-ui,sans-serif}
  canvas{display:block}
  .panel{
    position:fixed;top:18px;left:18px;width:min(260px,calc(100vw - 36px));
    color:#d7dbe4;font-size:13px;letter-spacing:.02em;
    background:rgba(8,10,16,.42);border:1px solid rgba(255,255,255,.08);
    border-radius:14px;padding:14px 14px 10px;backdrop-filter:blur(10px);
  }
  .panel h1{margin:0 0 4px;font-size:15px;font-weight:600;color:#f2f4f8}
  .panel p{margin:0 0 10px;opacity:.65;font-size:12px}
  .panel button{
    display:block;width:100%;text-align:left;margin:0 0 6px;padding:7px 9px;
    color:inherit;background:transparent;border:0;border-radius:8px;font:inherit;cursor:pointer;
  }
  .panel button:hover,.panel button.on{background:rgba(255,255,255,.08)}
  .hint{position:fixed;right:18px;bottom:16px;color:#9aa1ad;font-size:12px;opacity:.55}
</style>
</head>
<body>
<div class="panel">
  <h1>Featured</h1>
  <p>Click a city. Drag the globe to spin.</p>
  <div id="list"></div>
</div>
<div class="hint">auto-rotate pauses while you interact</div>
<script type="importmap">{"imports":{"three":"https://unpkg.com/three@0.160.0/build/three.module.js"}}</script>
<script type="module">
import * as THREE from 'three';

const places = [
  { name: 'Raleigh', lat: 35.78, lon: -78.64 },
  { name: 'New York', lat: 40.71, lon: -74.01 },
  { name: 'Reykjavik', lat: 64.15, lon: -21.94 },
  { name: 'London', lat: 51.51, lon: -0.13 },
  { name: 'Cape Town', lat: -33.92, lon: 18.42 },
  { name: 'Tokyo', lat: 35.68, lon: 139.76 },
  { name: 'Sydney', lat: -33.87, lon: 151.21 },
  { name: 'San Francisco', lat: 37.77, lon: -122.42 }
];

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x07080e, 0.18);
const camera = new THREE.PerspectiveCamera(45, innerWidth/innerHeight, 0.1, 40);
camera.position.set(0, 0.35, 3.15);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x07080e, 1);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.AmbientLight(0x6f7b99, 0.55));
const key = new THREE.DirectionalLight(0xfff2d8, 1.15);
key.position.set(4, 2.2, 3);
scene.add(key);
const rim = new THREE.DirectionalLight(0x6ea8ff, 0.35);
rim.position.set(-3, -1, -2);
scene.add(rim);

function earthTexture() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#163a6b';
  g.fillRect(0,0,1024,512);
  g.fillStyle = '#1c6a4a';
  const blobs = [[180,160,90],[310,200,70],[520,150,80],[700,220,60],[860,280,70],[240,320,50],[600,360,55]];
  for (const [x,y,r] of blobs) {
    g.beginPath(); g.ellipse(x,y,r*1.6,r,0,0,Math.PI*2); g.fill();
  }
  g.fillStyle = '#dfe7ee';
  g.fillRect(0,0,1024,28); g.fillRect(0,484,1024,28);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const globe = new THREE.Mesh(
  new THREE.SphereGeometry(1, 64, 48),
  new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.72, metalness: 0.08 })
);
scene.add(globe);

const atmos = new THREE.Mesh(
  new THREE.SphereGeometry(1.045, 48, 32),
  new THREE.MeshBasicMaterial({ color: 0x6ea8ff, transparent: true, opacity: 0.08, side: THREE.BackSide })
);
scene.add(atmos);

function latLonToVec(lat, lon, r=1.02) {
  const phi = (90 - lat) * Math.PI/180;
  const th = (lon + 180) * Math.PI/180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(th),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(th)
  );
}

const markers = places.map((p) => {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(0.018, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8c27a })
  );
  m.position.copy(latLonToVec(p.lat, p.lon));
  m.userData = p;
  globe.add(m);
  const glow = new THREE.Mesh(
    new THREE.SphereGeometry(0.038, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xe8c27a, transparent: true, opacity: 0.28 })
  );
  glow.position.copy(m.position);
  globe.add(glow);
  return m;
});

const list = document.getElementById('list');
places.forEach((p, i) => {
  const b = document.createElement('button');
  b.textContent = p.name;
  b.addEventListener('click', () => focusPlace(i));
  list.appendChild(b);
});

let rotY = 0.35, rotX = 0.18;
let auto = true, dragging = false, lastX = 0, lastY = 0, idle = 0;
let camGoal = null;

function focusPlace(i) {
  [...list.children].forEach((el, n) => el.classList.toggle('on', n === i));
  const p = places[i];
  const v = latLonToVec(p.lat, p.lon, 1);
  camGoal = v.clone().multiplyScalar(3.05);
  auto = false;
  idle = 0;
}

addEventListener('pointerdown', (e) => {
  if (e.target.closest('.panel')) return;
  dragging = true; auto = false; idle = 0;
  lastX = e.clientX; lastY = e.clientY;
  renderer.domElement.setPointerCapture(e.pointerId);
});
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => {
  if (!dragging) return;
  rotY += (e.clientX - lastX) * 0.005;
  rotX += (e.clientY - lastY) * 0.005;
  rotX = Math.max(-0.9, Math.min(0.9, rotX));
  lastX = e.clientX; lastY = e.clientY;
  idle = 0;
});
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

const ray = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  if (idle < 0.12 && dragging) return;
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  ray.setFromCamera(mouse, camera);
  const hit = ray.intersectObjects(markers)[0];
  if (hit) focusPlace(markers.indexOf(hit.object));
});

function tick() {
  requestAnimationFrame(tick);
  idle += 0.016;
  if (!dragging && idle > 2.4) auto = true;
  if (auto) rotY += 0.0022;
  globe.rotation.set(rotX, rotY, 0);
  if (camGoal) {
    camera.position.lerp(camGoal, 0.06);
    if (camera.position.distanceTo(camGoal) < 0.02) camGoal = null;
  }
  camera.lookAt(0,0,0);
  renderer.render(scene, camera);
}
tick();
</script>
</body>
</html>`;

export default {
  async fetch() {
    return new Response(HTML, {
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  },
};
