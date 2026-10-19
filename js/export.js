import { zipSync, strToU8 } from '../vendor/fflate/fflate.js';
import { DEFAULT_PARAMS, normalizeParams } from './params.js';

export function meshData(manifold) {
  const mesh = manifold.getMesh();
  const positions = new Float32Array(mesh.vertProperties.length / mesh.numProp * 3);
  for (let i = 0; i < positions.length / 3; i++) {
    positions.set(mesh.vertProperties.subarray(i * mesh.numProp, i * mesh.numProp + 3), i * 3);
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) };
}

export function toSTL(parts) {
  const meshes = parts.map(p => meshData(p.manifold));
  const tris = meshes.reduce((n, m) => n + m.indices.length / 3, 0);
  const bytes = new Uint8Array(84 + 50 * tris), view = new DataView(bytes.buffer);
  bytes.set(strToU8('Keycap Generator binary STL'));
  view.setUint32(80, tris, true);
  let offset = 84;
  for (const { positions: v, indices } of meshes) {
    for (let i = 0; i < indices.length; i += 3) {
      const [a, b, c] = [...indices.subarray(i, i + 3)].map(k => [...v.subarray(k * 3, k * 3 + 3)]);
      const u = b.map((n, k) => n - a[k]), w = c.map((n, k) => n - a[k]);
      const normal = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
      const length = Math.hypot(...normal) || 1;
      for (const value of [...normal.map(n => n / length), ...a, ...b, ...c]) {
        view.setFloat32(offset, value, true); offset += 4;
      }
      offset += 2;
    }
  }
  return bytes;
}

const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const decimal = n => String(Number(n.toFixed(4)));
function color(hex) {
  if (/^#[\da-f]{3}$/i.test(hex)) hex = '#' + [...hex.slice(1)].map(c => c + c).join('');
  if (!/^#[\da-f]{6}([\da-f]{2})?$/i.test(hex)) throw new Error('err.exportColor');
  return hex.toUpperCase() + (hex.length === 7 ? 'FF' : '');
}

export function to3MF(parts) {
  const bases = parts.map(p => `<base name="${xml(p.name)}" displaycolor="${color(p.color)}"/>`).join('');
  const objects = parts.map((p, i) => {
    const { positions: v, indices: t } = meshData(p.manifold);
    let vertices = '', triangles = '';
    for (let j = 0; j < v.length; j += 3) vertices += `<vertex x="${decimal(v[j])}" y="${decimal(v[j + 1])}" z="${decimal(v[j + 2])}"/>`;
    for (let j = 0; j < t.length; j += 3) triangles += `<triangle v1="${t[j]}" v2="${t[j + 1]}" v3="${t[j + 2]}"/>`;
    return `<object id="${i + 2}" type="model" name="${xml(p.name)}" pid="1" pindex="${i}"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object>`;
  }).join('');
  const parent = parts.length + 2;
  const model = `<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><basematerials id="1">${bases}</basematerials>${objects}<object id="${parent}" type="model" name="Keycap"><components>${parts.map((_, i) => `<component objectid="${i + 2}"/>`).join('')}</components></object></resources><build><item objectid="${parent}"/></build></model>`;
  return zipSync({
    '[Content_Types].xml': strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
    '3D/3dmodel.model': strToU8(model),
  });
}

function source(input = {}) {
  const string = key => typeof input[key] === 'string' ? input[key] : '';
  if (input.kind === 'svg') {
    const result = { kind: 'svg', name: string('name'), svgText: string('svgText') };
    if (input.partModes && typeof input.partModes === 'object' && !Array.isArray(input.partModes)) {
      result.partModes = Object.fromEntries(Object.entries(input.partModes).filter(([, mode]) => ['fill', 'outline', 'cut', 'off'].includes(mode)));
    }
    if (input.svgOptions && typeof input.svgOptions === 'object' && !Array.isArray(input.svgOptions)) {
      result.svgOptions = {};
      if (typeof input.svgOptions.outlineWidth === 'number' && Number.isFinite(input.svgOptions.outlineWidth)) result.svgOptions.outlineWidth = input.svgOptions.outlineWidth;
      if (typeof input.svgOptions.invert === 'boolean') result.svgOptions.invert = input.svgOptions.invert;
    }
    return result;
  }
  if (input.kind !== 'text') return { kind: 'none' };
  const result = { kind: 'text', text: string('text'), fontId: string('fontId') || 'inter-bold' };
  for (const key of ['fontBase64', 'fontData', 'fontName']) if (typeof input[key] === 'string') result[key] = input[key];
  return result;
}
function project(state) {
  const known = Object.fromEntries(Object.keys(DEFAULT_PARAMS).filter(k => Object.hasOwn(state.params || {}, k)).map(k => [k, state.params[k]]));
  const result = { app: 'keycap-generator', version: 1, params: normalizeParams(known).params, legendSource: source(state.legendSource) };
  if (Array.isArray(state.customFonts)) result.customFonts = state.customFonts.map(f => ({ id: String(f.id || ''), name: String(f.name || ''), data: String(f.data || '') }));
  return result;
}
export function projectToJSON(state) { return JSON.stringify(project(state), null, 2); }
export function projectFromJSON(text) {
  const state = JSON.parse(text);
  if (!state || state.app !== 'keycap-generator' || state.version !== 1) throw new Error('err.projectLoad');
  return project(state);
}
export function safeFileName(text) {
  const name = String(text).normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').replace(/[. ]+$/g, '').slice(0, 100);
  return !name ? 'legend' : /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name) ? `_${name}` : name;
}
