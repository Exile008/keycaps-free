// ============================================================================
// viewer.js — three.js viewport (browser).  See docs/SPEC.md §8.
// Contract: createViewer(container) → { setParts, setColor, setView, frame, dispose }
//   setParts(parts)  parts = [{ name, positions:Float32Array, indices:Uint32Array, color }]
//
// Model space is Z-up (origin = switch centre on the bottom plane). three.js is
// Y-up, so the whole model is parented to a group rotated −90° about X.
// ============================================================================

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { toCreasedNormals } from 'three/addons/BufferGeometryUtils.js';

const CREASE = (30 * Math.PI) / 180;
const UP = new THREE.Vector3(0, 1, 0);

export function createViewer(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 5000);
  camera.position.set(34, 30, 34);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  // ---- lighting: soft hemisphere + key/fill directional ----
  const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x2a2f38, 1.15);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(26, 42, 20);
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x9fb6ff, 0.7);
  fill.position.set(-24, 16, -18);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.45);
  rim.position.set(-8, 10, 30);
  scene.add(rim);

  // ---- root (model Z-up) ----
  const root = new THREE.Group();
  root.rotation.x = -Math.PI / 2;
  scene.add(root);

  // ---- ground grid at model z = 0 (world y = 0) ----
  const grid = new THREE.GridHelper(200, 50, 0x4f8cff, 0x39414d);
  grid.material.transparent = true;
  grid.material.opacity = 0.5;
  grid.position.y = 0;
  scene.add(grid);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4;
  controls.maxDistance = 900;
  controls.target.set(0, 6, 0);

  const partsGroup = new THREE.Group();
  root.add(partsGroup);

  const materials = new Map(); // name → MeshStandardMaterial
  const geometries = [];
  let framedOnce = false;
  const framedSize = new THREE.Vector3();
  const modelBox = new THREE.Box3();
  const modelSphere = new THREE.Sphere();

  function makeMaterial(name, color) {
    let m = materials.get(name);
    if (!m) {
      m = new THREE.MeshStandardMaterial({
        color: new THREE.Color(color || '#cccccc'),
        roughness: 0.62,
        metalness: 0.06,
        envMapIntensity: 0.7,
        polygonOffset: name === 'Legend',
        polygonOffsetFactor: name === 'Legend' ? -1 : 0,
        polygonOffsetUnits: name === 'Legend' ? -1 : 0,
      });
      materials.set(name, m);
    } else if (color) {
      m.color.set(color);
    }
    return m;
  }

  function disposeGeometry() {
    while (geometries.length) {
      const g = geometries.pop();
      if (g) g.dispose();
    }
  }

  /** Rebuild meshes; defer automatic framing while a slider is being dragged. */
  function setParts(parts, { autoFrame = true } = {}) {
    parts = Array.isArray(parts) ? parts : [];
    // clear old meshes
    for (let i = partsGroup.children.length - 1; i >= 0; i--) {
      partsGroup.remove(partsGroup.children[i]);
    }
    disposeGeometry();

    for (const part of parts) {
      if (!part || !part.positions || !part.indices) continue;
      const pos = part.positions instanceof Float32Array
        ? part.positions : new Float32Array(part.positions);
      const idx = part.indices instanceof Uint32Array
        ? part.indices : new Uint32Array(part.indices);
      if (pos.length === 0 || idx.length === 0) continue;

      let geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geom.setIndex(new THREE.BufferAttribute(idx, 1));

      let creased;
      try {
        creased = toCreasedNormals(geom, CREASE);
      } catch (_) {
        geom.computeVertexNormals();
        creased = geom;
      }
      if (creased !== geom) geom.dispose();
      creased.computeBoundingSphere();
      geometries.push(creased);

      const mat = makeMaterial(part.name || 'part', part.color);
      const mesh = new THREE.Mesh(creased, mat);
      mesh.name = part.name || 'part';
      partsGroup.add(mesh);
    }

    updateBounds();
    if (partsGroup.children.length && (!framedOnce || autoFrame)) frameIfNeeded();
  }

  function updateBounds() {
    root.updateMatrixWorld(true);
    modelBox.makeEmpty();
    if (partsGroup.children.length) {
      modelBox.setFromObject(partsGroup, true);
    }
    if (modelBox.isEmpty()) {
      modelBox.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 12, 10));
    }
    modelBox.getBoundingSphere(modelSphere);
  }

  function fitDistance() {
    const radius = Math.max(modelSphere.radius, 6);
    const fov = (camera.fov * Math.PI) / 180;
    const halfFov = Math.atan(Math.tan(fov / 2) * Math.min(1, camera.aspect));
    // A sphere's projected diameter occupies 45% of the smaller viewport axis.
    const angularRadius = Math.atan(0.45 * Math.tan(halfFov));
    return radius / Math.sin(angularRadius);
  }

  const center = new THREE.Vector3(0, 6, 0);

  function applyView(view) {
    updateBounds();
    center.copy(modelSphere.center);
    controls.target.copy(center);

    const dist = fitDistance();
    const dirs = {
      iso: new THREE.Vector3(0.86, 0.72, 0.86),
      top: new THREE.Vector3(0.0001, 1, 0.0001),
      front: new THREE.Vector3(0, 0, 1),
      side: new THREE.Vector3(1, 0, 0),
    };
    const dir = (dirs[view] || dirs.iso).clone().normalize();

    if (view === 'top') {
      camera.up.set(0, 0, -1);
    } else {
      camera.up.copy(UP);
    }
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    controls.minDistance = Math.max(3, dist * 0.15);
    controls.maxDistance = dist * 6;
    controls.update();
  }

  function frame() {
    // Keep an orbit/pan direction chosen by the user instead of snapping to Iso.
    const dir = camera.position.clone().sub(controls.target).normalize();
    updateBounds();
    center.copy(modelSphere.center);
    controls.target.copy(center);
    const dist = fitDistance();
    camera.position.copy(center).addScaledVector(dir, dist);
    camera.lookAt(center);
    controls.minDistance = Math.max(3, dist * 0.15);
    controls.maxDistance = dist * 6;
    controls.update();
    modelBox.getSize(framedSize);
    framedOnce = true;
  }

  function frameIfNeeded() {
    const size = modelBox.getSize(new THREE.Vector3());
    if (!framedOnce || ['x', 'y', 'z'].some((axis) =>
      Math.abs(size[axis] - framedSize[axis]) / Math.max(framedSize[axis], 0.001) > 0.15)) {
      frame();
    }
  }

  function setView(view) {
    applyView(view);
    modelBox.getSize(framedSize);
    framedOnce = true;
  }

  function setColor(name, hex) {
    const m = materials.get(name);
    if (m && hex) m.color.set(hex);
  }

  // ---- resize ----
  const diagram = container.parentElement.querySelector('.topview');
  function updateProjection() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    // Keep the fitted model clear of the expanded diagram, including narrow
    // viewports. A lens shift preserves the 45% scale and the orbit target.
    const reserve = diagram && !diagram.classList.contains('is-collapsed')
      ? diagram.offsetWidth + 24 : 0;
    const shift = Math.min(reserve / 2, Math.max(0, (w - 0.45 * Math.min(w, h)) / 2 - 12));
    camera.setViewOffset(w, h, -shift, 0, w, h);
    camera.updateProjectionMatrix();
  }

  function resize() {
    renderer.setSize(Math.max(1, container.clientWidth), Math.max(1, container.clientHeight), false);
    updateProjection();
    if (framedOnce) frame();
  }

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver((entries) => {
      if (entries.some((entry) => entry.target === container)) resize();
      else updateProjection();
    });
    ro.observe(container);
    if (diagram) ro.observe(diagram);
  }
  window.addEventListener('resize', resize);

  // initial size
  resize();
  // seed a sensible camera before the first model arrives
  controls.target.set(0, 6, 0);
  camera.lookAt(controls.target);

  let running = true;
  function tick() {
    if (!running) return;
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  function dispose() {
    running = false;
    if (ro) ro.disconnect();
    window.removeEventListener('resize', resize);
    controls.dispose();
    disposeGeometry();
    for (const m of materials.values()) m.dispose();
    materials.clear();
    grid.geometry.dispose();
    grid.material.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  }

  return { setParts, setColor, setView, frame, frameIfNeeded, dispose };
}
