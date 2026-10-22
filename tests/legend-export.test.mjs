import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getManifold } from '../js/manifold-loader.js';
import { DEFAULT_PARAMS, applyPreset } from '../js/params.js';
import { buildKeycap, buildModel } from '../js/keycap.js';
import { BUNDLED_FONTS, loadFont, textToContours, contoursToCrossSection, fitLegend, applyLegend } from '../js/legend-core.js';
import { meshData, toSTL, to3MF, projectToJSON, projectFromJSON, safeFileName } from '../js/export.js';
import { unzipSync, strFromU8 } from '../vendor/fflate/fflate.js';

const wasm = await getManifold();
let checks = 0;
function ok(condition, label) { checks++; assert.ok(condition, label); }
function dispose(parts, result) {
  const unique = new Set([
    parts.outer, parts.inner, parts.shell, parts.stems, parts.stemSolid,
    parts.crossCut, parts.flare, parts.ribs, parts.stemPart, parts.capBody,
    result?.cap, result?.legend, result?.stem,
  ]);
  for (const m of unique) m?.delete();
}
function disposeModel(res) {
  const unique = new Set([res?.cap, res?.legend, res?.stem]);
  for (const m of unique) m?.delete();
}
function fitted(font, text, size = 8) {
  const polygons = textToContours(font, text);
  const base = contoursToCrossSection(wasm, polygons);
  const cs = fitLegend(base, { size }); base.delete();
  return { cs, polygons };
}
function xmlStructure(text) {
  const stack = [];
  for (const match of text.matchAll(/<([^>]+)>/g)) {
    const tag = match[1];
    if (tag.startsWith('?')) continue;
    if (tag.startsWith('/')) assert.equal(stack.pop(), tag.slice(1));
    else if (!tag.endsWith('/')) stack.push(tag.split(/\s/)[0]);
  }
  assert.equal(stack.length, 0);
}
function exportsCheck(parts) {
  const n = parts.length;
  const meshes = parts.map(p => meshData(p.manifold));
  const tris = meshes.reduce((sum, m) => sum + m.indices.length / 3, 0);
  const stl = toSTL(parts);
  ok(stl.length === 84 + 50 * tris, 'STL exact byte length');
  ok(new DataView(stl.buffer, stl.byteOffset).getUint32(80, true) === tris, 'STL triangle count');
  ok(meshes.every(m => m.positions instanceof Float32Array && m.indices instanceof Uint32Array), 'mesh typed arrays');
  const files = unzipSync(to3MF(parts));
  for (const name of ['[Content_Types].xml', '_rels/.rels', '3D/3dmodel.model']) {
    ok(files[name], `3MF ${name}`); xmlStructure(strFromU8(files[name]));
  }
  const model = strFromU8(files['3D/3dmodel.model']);
  ok(model.includes('xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"'), '3MF namespace');
  ok((model.match(/<vertex /g) || []).length === meshes.reduce((sum, m) => sum + m.positions.length / 3, 0), '3MF vertices');
  ok((model.match(/<triangle /g) || []).length === tris, '3MF triangles');
  ok((model.match(/<base /g) || []).length === n, `${n} materials`);
  ok(model.includes('#1C1C1EFF') && model.includes('#F2F2F2FF'), 'material colors');
  const parent = n + 2;
  ok(new RegExp(`<build><item objectid="${parent}"/></build>`).test(model), 'one parent build item');
  ok((model.match(/<component /g) || []).length === n, `${n} parent components`);
  ok((model.match(/<object /g) || []).length === n + 1, `${n} mesh objects plus parent`);
  ok(!/[xyz]="-?\d+\.\d{5}/.test(model), 'vertices <=4 decimals');
  ok(parts.every(p => model.includes(`name="${p.name}"`)), 'part names');
}

console.log('Text/font × mode × preset matrix');
for (const [id, info] of Object.entries(BUNDLED_FONTS)) {
  const font = loadFont(readFileSync(new URL('../' + info.url, import.meta.url)));
  for (const text of ['A', 'Esc', '⌘']) {
    const { cs, polygons } = fitted(font, text);
    if (text === '⌘') ok(polygons.warnings.includes('warn.glyphMissing') === (font.charToGlyphIndex(text) === 0), `${id}: accurate command glyph warning`);
    ok(cs.area() > 0, `${id}/${text}: nonempty outlines or .notdef`);
    for (const [family, row, unitW] of [['cherry','R3',1], ['sa','R1',2.25]]) {
      for (const mode of ['inlay','recessed','raised','shine']) {
        const p = { ...applyPreset(DEFAULT_PARAMS, family, row), unitW, legendMode: mode };
        const parts = buildKeycap(wasm, p), plainVolume = parts.capBody.volume();
        const result = applyLegend(wasm, parts, cs, parts.layout.params);
        const label = `${id}/${text}/${family}/${mode}`;
        ok(result.cap.status() === 'NoError' && result.cap.volume() > 0, label + ' cap valid');
        if (mode === 'recessed') {
          ok(result.legend === null, label + ' single color');
          ok(result.cap.volume() < plainVolume, label + ' engraves');
        } else {
          ok(result.legend.status() === 'NoError' && result.legend.volume() > 0, label + ' legend valid');
          if (mode === 'inlay') ok(Math.abs(result.legend.volume() / (cs.area() * p.legendDepth) - 1) <= .25, label + ' volume');
          if (mode === 'raised') ok(Math.abs(result.cap.volume() - plainVolume) < 1e-5, label + ' cap unchanged');
          if (mode === 'shine') {
            const missing = parts.stems.subtract(result.legend);
            ok(Math.abs(missing.volume()) < 1e-5, label + ' stems in legend'); missing.delete();
            // SPEC preserves shell material at the stem/shell junction: the
            // two color parts can overlap there, so assert the specified cap.
            const baseLayer = parts.outer.translate(parts.layout.frame.normal.map(v => -v * (p.topThickness + p.dishDepth + .5)));
            const layer = parts.outer.subtract(baseLayer);
            const local = cs.extrude(40), centered = local.translate([0,0,-20]);
            const prism = centered.transform(parts.layout.frame.mat4), cut = prism.intersect(layer);
            const expected = parts.shell.subtract(cut);
            ok(Math.abs(result.cap.volume()-expected.volume())<1e-5, label+' shell minus cut');
            for(const m of [baseLayer,layer,local,centered,prism,cut,expected]) m.delete();
          }
        }
        if (id === 'inter-bold' && text === 'A' && family === 'cherry' && mode === 'inlay') exportsCheck([
          { name:'Keycap', manifold:result.cap, color:p.capColor }, { name:'Legend', manifold:result.legend, color:p.legendColor },
        ]);
        dispose(parts, result);
      }
    }
    cs.delete();
  }
  const missing = textToContours(font, '\u0378');
  ok(missing.warnings.includes('warn.glyphMissing'), `${id}: genuinely missing glyph warning`);
  const { cs: empty, polygons } = fitted(font, '   ');
  ok(polygons.length === 0 && polygons.warnings.includes('warn.legendEmpty'), 'spaces empty');
  const parts = buildKeycap(wasm, DEFAULT_PARAMS), result = applyLegend(wasm, parts, empty, parts.layout.params);
  ok(result.cap === parts.capBody && result.legend === null && result.warnings.includes('warn.legendEmpty'), 'spaces preserve cap');
  dispose(parts,result); empty.delete();
}
const font = loadFont(readFileSync(new URL('../fonts/inter-bold.ttf', import.meta.url)));

console.log('KLP saddle tilted × legend modes × stem');
{
  const { cs } = fitted(font, 'A', 6);
  for (const stemType of ['choc', 'mx']) {
    for (const stemSeparate of [false, true]) {
      for (const mode of ['inlay', 'recessed', 'raised', 'shine']) {
        const p = { ...applyPreset({ ...DEFAULT_PARAMS, stemType, pitch: 18, pitchY: 17, gap: 0.5 }, 'klp-saddle', 'tilted'), legendMode: mode, stemSeparate };
        const res = await buildModel(wasm, p, cs);
        const label = `klp-saddle/tilted/${stemType}/${stemSeparate ? 'separate' : 'joined'}/${mode}`;
        ok(res.cap.status() === 'NoError' && res.cap.volume() > 0, label + ' cap valid');
        if (mode === 'recessed') ok(res.legend === null, label + ' single color');
        else ok(res.legend && res.legend.status() === 'NoError' && res.legend.volume() > 0, label + ' legend valid');
        ok(!!res.stem === stemSeparate, label + ' stem part presence');
        disposeModel(res);
      }
    }
  }
  cs.delete();
  const parts = buildKeycap(wasm, applyPreset(DEFAULT_PARAMS, 'klp', 'flat'));
  const model = strFromU8(unzipSync(to3MF([{ name: 'Keycap', manifold: parts.capBody, color: '#1c1c1e' }],
    { description: 'KLP Lamé–style (braindefender)' }))['3D/3dmodel.model']);
  xmlStructure(model);
  ok(model.includes('<metadata name="Description">KLP Lamé–style (braindefender)</metadata>'), '3MF description metadata');
  const plain = strFromU8(unzipSync(to3MF([{ name: 'Keycap', manifold: parts.capBody, color: '#1c1c1e' }]))['3D/3dmodel.model']);
  ok(!plain.includes('<metadata'), '3MF without metadata by default');
  dispose(parts);
  const round = projectFromJSON(projectToJSON({ params: { ...applyPreset(DEFAULT_PARAMS, 'klp-saddle', 'tilted'), stemType: 'choc', pitchY: 17, stemRotate: 90 }, legendSource: { kind: 'none' } }));
  ok(round.params.dishType === 'klp-saddle' && round.params.pitchY === 17 && round.params.stemRotate === 90 && round.params.skirtStyle === 'rounded', 'KLP project round trip');
  const old = projectFromJSON(JSON.stringify({ app: 'keycap-generator', version: 1, params: { pitch: 19.05 }, legendSource: { kind: 'none' } }));
  ok(old.params.pitchY === null && old.params.skirtStyle === 'straight' && old.params.stemType === 'mx', 'old project loads with previous defaults');
}

const { cs: overflow } = fitted(font, 'A', 16);
const parts = buildKeycap(wasm, DEFAULT_PARAMS), result = applyLegend(wasm, parts, overflow, parts.layout.params);
ok(result.warnings.includes('warn.legendOverflow'), 'overflow warning');
ok(result.cap.status()==='NoError' && result.legend.status()==='NoError', 'overflow valid');
dispose(parts,result);
const integrated = await buildModel(wasm, DEFAULT_PARAMS, overflow);
ok(integrated.cap.status()==='NoError' && integrated.legend && integrated.layout.warnings.includes('warn.legendOverflow'), 'T1 buildModel integrates legend');
disposeModel(integrated); overflow.delete();

console.log('Separate stem part × legend modes');
{
  const { cs } = fitted(font, 'A', 8);
  for (const mode of ['inlay', 'recessed', 'raised', 'shine']) {
    const p = { ...DEFAULT_PARAMS, stemSeparate: true, legendMode: mode };
    const res = await buildModel(wasm, p, cs, { quality: 'preview' });
    const label = `stemSeparate/${mode}`;
    ok(res.cap.status() === 'NoError' && res.cap.volume() > 0, label + ' cap valid');
    ok(res.stem && res.stem.status() === 'NoError' && res.stem.volume() > 0, label + ' stem valid');
    const ci = res.cap.intersect(res.stem);
    ok(Math.abs(ci.volume()) < 1e-4, label + ' cap/stem disjoint');
    ci.delete();
    if (mode === 'recessed') {
      ok(res.legend === null, label + ' single colour, no legend part');
    } else {
      ok(res.legend && res.legend.status() === 'NoError' && res.legend.volume() > 0, label + ' legend valid');
      const li = res.legend.intersect(res.stem);
      ok(Math.abs(li.volume()) < 1e-4, label + ' legend/stem disjoint');
      li.delete();
    }
    ok(res.stats.tris === res.cap.numTri() + (res.legend ? res.legend.numTri() : 0) + res.stem.numTri(),
      label + ' stats include stem triangles');
    const exportParts = [{ name: 'Keycap', manifold: res.cap, color: p.capColor }];
    if (res.legend) exportParts.push({ name: 'Legend', manifold: res.legend, color: p.legendColor });
    exportParts.push({ name: 'Stem', manifold: res.stem, color: p.stemColor });
    exportsCheck(exportParts);
    if (mode !== 'recessed') ok(exportParts.length === 3, label + ' 3-part 3MF');
    else ok(exportParts.length === 2, label + ' cap+stem 3MF');
    disposeModel(res);
  }
  cs.delete();

  const custom = await buildModel(wasm,
    { ...DEFAULT_PARAMS, stemSeparate: true, stemColor: '#112233' }, null, { quality: 'preview' });
  const files = unzipSync(to3MF([
    { name: 'Keycap', manifold: custom.cap, color: DEFAULT_PARAMS.capColor },
    { name: 'Stem', manifold: custom.stem, color: '#112233' },
  ]));
  ok(strFromU8(files['3D/3dmodel.model']).includes('#112233FF'), 'stemColor becomes the stem material colour');
  disposeModel(custom);
}

console.log('Project serialization and mesh property stride');
const state = { params:{...DEFAULT_PARAMS}, legendSource:{kind:'text',text:'A',fontId:'custom',fontBase64:'AAEC/w=='}, customFonts:[{id:'custom',name:'Custom',data:'AAEC/w=='}] };
const restored = projectFromJSON(projectToJSON(state));
assert.deepEqual(restored.params,state.params); assert.deepEqual(restored.legendSource,state.legendSource); assert.deepEqual(restored.customFonts,state.customFonts); checks+=3;
const stemState = { params: { ...DEFAULT_PARAMS, stemFillet: 2.4, stemRibs: 'cross', ribThickness: 1.4, ribHeight: 4.2, stemSeparate: true, stemColor: '#aabbcc' }, legendSource: { kind: 'none' } };
assert.deepEqual(projectFromJSON(projectToJSON(stemState)).params, stemState.params); checks += 1;
const svg = {params:DEFAULT_PARAMS,legendSource:{kind:'svg',name:'ring.svg',svgText:'<svg><path d="M0 0"/></svg>'}};
assert.deepEqual(projectFromJSON(projectToJSON(svg)).legendSource,svg.legendSource); checks++;
const svgParts = { ...svg, legendSource: { ...svg.legendSource,
  partModes: { p0:'off', p1:'fill', p2:'outline', p3:'cut' }, svgOptions: { outlineWidth:2.75, invert:true },
} };
assert.deepEqual(projectFromJSON(projectToJSON(svgParts)).legendSource,svgParts.legendSource); checks++;
const invalidSvg = { ...svg, legendSource: { ...svg.legendSource,
  partModes: { p0:'fill', p1:'bad', p2:1, p3:null, p4:{mode:'off'} },
  svgOptions: { outlineWidth:'2', invert:1, unknown:true },
} };
const validatedSvg = projectFromJSON(projectToJSON(invalidSvg)).legendSource;
assert.deepEqual(validatedSvg.partModes,{p0:'fill'}); assert.deepEqual(validatedSvg.svgOptions,{}); checks+=2;
for (const value of [null, [], 'off', 42]) {
  const saved = projectFromJSON(projectToJSON({ ...svg, legendSource: { ...svg.legendSource, partModes:value, svgOptions:value } })).legendSource;
  ok(!Object.hasOwn(saved,'partModes') && !Object.hasOwn(saved,'svgOptions'), 'invalid SVG option containers ignored');
}
const nonfinite = JSON.parse(projectToJSON({ ...svg, legendSource: { ...svg.legendSource, svgOptions:{outlineWidth:Infinity,invert:false} } }));
assert.deepEqual(nonfinite.legendSource.svgOptions,{invert:false}); checks++;
const unknownModeId = projectFromJSON(projectToJSON({ ...svg, legendSource: { ...svg.legendSource, partModes:JSON.parse('{"__proto__":"off","custom-part":"cut"}') } })).legendSource;
ok(Object.hasOwn(unknownModeId.partModes,'__proto__') && unknownModeId.partModes['custom-part']==='cut', 'arbitrary string part IDs safely preserved');
const defaults = projectFromJSON('{"app":"keycap-generator","version":1,"params":{"unknown":5},"extra":1}');
assert.deepEqual(defaults.params,DEFAULT_PARAMS); ok(!('extra' in defaults), 'unknown keys ignored');
assert.throws(()=>projectFromJSON('{"app":"wrong","version":1}')); checks++;
const stride = meshData({getMesh:()=>({numProp:5,vertProperties:new Float32Array([1,2,3,9,8,4,5,6,7,8]),triVerts:new Uint32Array([0,1,0])})});
assert.deepEqual([...stride.positions],[1,2,3,4,5,6]); checks++;
ok(!/[<>:"/\\|?*]/.test(safeFileName('a/b:c*?')), 'safe filename');
ok(safeFileName('CON')==='_CON' && safeFileName('...')==='legend', 'Windows filename edge cases');
console.log(`${checks} checks — ALL PASS`);
