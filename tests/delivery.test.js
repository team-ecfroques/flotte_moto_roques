import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, rm, appendFile } from 'node:fs/promises';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const root = fileURLToPath(new URL('../',import.meta.url));

test('livraison : version commune aux ressources, stable sans changement et renouvelée après modification',async t => {
  const fixture = await mkdtemp(join(tmpdir(),'ecf-delivery-'));
  t.after(() => rm(fixture,{recursive:true,force:true}));
  await cp(join(root,'public'),join(fixture,'public'),{recursive:true});
  await mkdir(join(fixture,'scripts'));
  const script = join(fixture,'scripts/prepare-pages.mjs');
  await copyFile(join(root,'scripts/prepare-pages.mjs'),script);
  await appendFile(join(fixture,'public/should-not-be-published.txt'),'not a public asset');
  async function build() {
    await run(process.execPath,[script]);
    const html = await readFile(join(fixture,'dist/index.html'),'utf8');
    const version = html.match(/\.css\?v=([0-9a-f]{16})/)[1];
    assert.ok(html.includes(`bootstrap.js?v=${version}`));
    const directory = join(fixture,'dist/assets/js');
    for(const file of await readdir(directory)) {
      const code = await readFile(join(directory,file),'utf8');
      for(const match of code.matchAll(/(?:from\s*|import\s*\(\s*)["'](\.{1,2}\/[^"']+)["']/g)) {
        const url = new URL(match[1],'http://site.test/project/assets/js/'+file);
        assert.equal(url.searchParams.get('v'),version,`${file}: ${match[1]}`);
        assert.ok((await readdir(directory)).includes(url.pathname.split('/').at(-1)));
      }
    }
    assert.ok(!(await readdir(join(fixture,'dist'))).includes('should-not-be-published.txt'));
    return version;
  }
  const first = await build(); assert.equal(await build(),first);
  await appendFile(join(fixture,'public/assets/css/styles.css'),'\n/* next release */\n');
  assert.notEqual(await build(),first);
});

test('serveur local : pas de cache et anciens chemins récupérés sans 404',async t => {
  const server = spawn('python3',[join(root,'scripts/serve.py'),'--bind','127.0.0.1','--port','0'],{stdio:['ignore','pipe','pipe']});
  t.after(() => {server.kill();});
  const base = await new Promise((resolve,reject) => {
    let output = '', errors = '';
    const timer = setTimeout(() => reject(new Error('Serveur local non démarré : '+errors)),5000);
    server.once('error',error => {clearTimeout(timer); reject(error);});
    server.once('exit',code => {clearTimeout(timer); reject(new Error(`Serveur arrêté (${code}) : ${errors}`));});
    server.stderr.on('data',data => {errors += data;});
    server.stdout.on('data',data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) {clearTimeout(timer); resolve(match[0]);}
    });
  });
  const page = await fetch(base,{headers:{'If-Modified-Since':'Wed, 01 Jan 2031 00:00:00 GMT'}});
  assert.equal(page.status,200); assert.match(page.headers.get('cache-control'),/no-store/);
  assert.match(await page.text(),/assets\/js\/bootstrap\.js/);
  for(const file of ['app','model','store','firebase-config','fault-picker','cloud-session']) {
    const response = await fetch(`${base}/js/${file}.js?v=old`,{redirect:'manual'});
    assert.equal(response.status,307);
    assert.equal(response.headers.get('location'),`/assets/js/${file}.js?v=old`);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.equal((await fetch(new URL(response.headers.get('location'),base))).status,200);
  }
  const css = await fetch(`${base}/styles.css?v=old`);
  assert.equal(css.status,200); assert.match(css.url,/\/assets\/css\/styles.css/);
  assert.equal((await fetch(`${base}/firebase/database.rules.json`)).status,404);
});
