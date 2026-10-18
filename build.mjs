import { readFile, mkdir, writeFile } from 'node:fs/promises';
const modules = ['simulation', 'scenarios', 'render', 'input', 'playtest', 'main'];
// This small, dependency-free bundle keeps the delivered game usable via file://.
// The source modules deliberately use unique top-level names and named exports.
const scripts = await Promise.all(modules.map(async name => {
  const source = await readFile(new URL(`src/${name}.js`, import.meta.url), 'utf8');
  return `// ${name}.js\n${source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')}`;
}));
let html = await readFile(new URL('index.html', import.meta.url), 'utf8');
const css = await readFile(new URL('style.css', import.meta.url), 'utf8');
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="src/main.js"></script>', () => `<script>\n(() => {\n'use strict';\n${scripts.join('\n')}\n})();\n</script>`);
await mkdir(new URL('dist/', import.meta.url), { recursive: true });
await writeFile(new URL('dist/index.html', import.meta.url), html);
console.log(`Built dist/index.html (${Math.ceil(Buffer.byteLength(html) / 1024)} KB). Open it directly in a browser; no server needed.`);
