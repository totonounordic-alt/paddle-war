// Cloudflare Pages -build: kopioi tiedostot dist-kansioon ja kirjoittaa versionumeron index.html:ään.
// Versio = 1.0.<commit-määrä> <lyhyt commit-tunniste>, esim. "1.0.57 A1B2C3D"
const { execSync } = require('child_process'), fs = require('fs');
const sh = c => { try { return execSync(c, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } };
sh('git fetch --unshallow'); // Pages kloonaa usein matalasti; ilman tätä commit-määrä jäisi väärin
const n = sh('git rev-list --count HEAD');
const sha = (process.env.CF_PAGES_COMMIT_SHA || sh('git rev-parse HEAD')).slice(0, 7).toUpperCase();
const v = '1.0' + (n ? '.' + n : '') + (sha ? ' ' + sha : '');
fs.rmSync('dist', { recursive: true, force: true });
fs.mkdirSync('dist');
for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) fs.copyFileSync(f, 'dist/' + f);
fs.writeFileSync('dist/index.html', fs.readFileSync('index.html', 'utf8').replaceAll('__BUILD__', v));
console.log('Build', v);
