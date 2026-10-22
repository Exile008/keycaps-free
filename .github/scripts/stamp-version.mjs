// Cache-busting for the GitHub Pages copy (run by .github/workflows/pages.yml).
// GitHub Pages lets browsers cache every file for 10 minutes, so after a
// deploy a browser can mix new and old ES modules (e.g. a new main.js with an
// old keycap.js). This tags the entry script, the stylesheet and every js/
// module with ?v=<version> so each deploy loads one consistent set.
// The js/ modules are remapped through the import map, which applies to every
// static and dynamic import of that URL, so a module never loads twice.
// Usage: node .github/scripts/stamp-version.mjs <siteDir> <version>
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [site, rawVersion] = process.argv.slice(2);
if (!site || !rawVersion) {
  console.error('usage: stamp-version.mjs <siteDir> <version>');
  process.exit(1);
}
const v = encodeURIComponent(rawVersion);
const file = join(site, 'index.html');
let html = readFileSync(file, 'utf8');

const replaceOnce = (from, to) => {
  if (!html.includes(from)) throw new Error(`index.html: "${from}" not found`);
  html = html.replace(from, to);
};
replaceOnce('href="./css/style.css"', `href="./css/style.css?v=${v}"`);
replaceOnce('src="./js/main.js"', `src="./js/main.js?v=${v}"`);

const match = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
if (!match) throw new Error('index.html: import map not found');
const map = JSON.parse(match[1]);
for (const name of readdirSync(join(site, 'js')).filter((f) => f.endsWith('.js')).sort()) {
  map.imports[`./js/${name}`] = `./js/${name}?v=${v}`;
}
html = html.replace(match[0], `<script type="importmap">\n${JSON.stringify(map, null, 2)}\n</script>`);

writeFileSync(file, html);
console.log(`stamped ${Object.keys(map.imports).length} import-map entries with v=${rawVersion}`);
