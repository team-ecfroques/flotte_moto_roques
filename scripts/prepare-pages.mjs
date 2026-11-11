import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, 'public');
const output = join(root, 'dist');
// Liste explicite : aucun nouveau fichier du dépôt n'est publié par accident.
const publicFiles = [
  'index.html',
  'assets/css/styles.css',
  'assets/js/bootstrap.js',
  'assets/js/app.js',
  'assets/js/model.js',
  'assets/js/firebase-config.js',
  'assets/js/cloud-session.js',
  'assets/js/store.js',
  'assets/js/fault-picker.js'
];

const contents = new Map();
const hash = createHash('sha256');
for (const file of publicFiles) {
  const content = await readFile(join(source,file),'utf8');
  contents.set(file,content); hash.update(file).update('\0').update(content).update('\0');
}
const version = hash.digest('hex').slice(0,16);

// Même version pour tout le graphe de modules : pas de mélange entre livraisons.
function versioned(file, content) {
  if (file.endsWith('.html')) return content.replace(/((?:src|href)=["'])(\.\/[^"'?#]+\.(?:js|css))(?:\?[^"']*)?(["'])/g,
    (_match,prefix,path,quote) => `${prefix}${path}?v=${version}${quote}`);
  if (file.endsWith('.js')) return content.replace(/(\b(?:from\s*|import\s*\(\s*|import\s*)["'])(\.{1,2}\/[^"'?#\s]+\.js)(?:\?[^"']*)?(["'])/g,
    (_match,prefix,path,quote) => `${prefix}${path}?v=${version}${quote}`);
  return content;
}

await rm(output, { recursive: true, force: true });
for (const file of publicFiles) {
  const target = join(output,file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target,versioned(file,contents.get(file)));
}
await writeFile(join(output,'.nojekyll'),'');
console.log(`GitHub Pages : ${publicFiles.length} fichiers du site, version ${version}, préparés dans dist/.`);
