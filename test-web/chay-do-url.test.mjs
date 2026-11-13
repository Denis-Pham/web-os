// Pha C Task 2: `kiem/chay-do.mjs --url` — bộ đo B4 CHỈ ĐỌC trên trang thật (sau Cloudflare Access). Máy thử = dungMay cosGhi:false như lễ W;
// cầu vé 127.0.0.1 đóng vai Access. Trạm (cầu HTTP 127.0.0.1 đặt TRƯỚC cầu vé) đếm yêu cầu ghi tới máy và lần cookie CF_Authorization tới.
// Ca (b)/(c) cấy web/ qua datBan và KHÔNG theo cờ WEB_DOI_CHUNG: đột biến nhóm C2 chỉ sửa kiem/chay-do.mjs, neo cấy ở web/ không đổi.
// chay-do chạy bằng spawn (bất đồng bộ): máy thử + trạm sống trong tiến trình này, spawnSync sẽ chặn chúng.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dungMay, datBan } from './chung-web.mjs';

const GOC = fileURLToPath(new URL('..', import.meta.url)), CO = ['--co', '375x812-light'], HAN = 300000;
const GAC = 'gac' + crypto.randomBytes(12).toString('hex');   // chuỗi gác = giá trị cookie; không được lộ ra stdout/stderr
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}\n';
const NEO_CSS = '/* Nền + khung (B1)', NEO_JS = "import './ai.js';\n";
const GHI_LUC_TAI = "fetch('/api/goi', { method: 'POST', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});\n";
let m, tram, tam;
const dem = { ghi: [], cookie: 0 };

const chay = (...a) => new Promise((ok, loi) => {
  const c = spawn(process.execPath, ['kiem/chay-do.mjs', ...a], { cwd: GOC, stdio: ['ignore', 'pipe', 'pipe'] });
  let ra = '', err = '';
  c.stdout.on('data', d => { ra += d; }); c.stderr.on('data', d => { err += d; });
  const t = setTimeout(() => c.kill('SIGKILL'), HAN);
  c.on('error', loi);
  c.on('close', rc => { clearTimeout(t); ok({ rc, ra, err, dong: ra.split('\n').filter(s => s.startsWith('{')).map(s => JSON.parse(s)) }); });
});
const tramDem = dich => new Promise(ok => {
  const sv = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) dem.ghi.push(req.method + ' ' + req.url);
    if ((req.headers.cookie ?? '').includes('CF_Authorization=' + GAC)) dem.cookie++;
    const r = http.request(dich + req.url, { method: req.method, headers: req.headers, agent: false }, kq => { res.writeHead(kq.statusCode, kq.headers); kq.pipe(res); });
    r.on('error', () => res.destroy());
    req.pipe(r);
  });
  sv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${sv.address().port}`, dong: () => new Promise(d => { sv.closeAllConnections(); sv.close(() => d()); }) }));
});
const tep = (ten, noiDung, mode) => { const f = path.join(tam, ten); fs.writeFileSync(f, noiDung, { mode }); fs.chmodSync(f, mode); return f; };

before(async () => {
  tam = fs.mkdtempSync(path.join(process.env.WO_GOC || os.tmpdir(), 'wo-url-'));
  m = await dungMay({ cosGhi: false });
  await datBan(m);
  tram = await tramDem(m.url);
});
after(async () => {
  await tram?.dong(); await m?.dong();
  if (tam) { for (const t of fs.readdirSync(tam)) fs.unlinkSync(path.join(tam, t)); fs.rmdirSync(tam); }
});

test('(d) tham số sai ⇒ rc 2: cookie 0644, cookie symlink, --url + --pha, --url + --va, gốc có đường, http ngoài 127.0.0.1', { timeout: HAN }, async () => {
  const c644 = tep('c644', GAC + '\n', 0o644), c600 = tep('c600-d', GAC + '\n', 0o600), lk = path.join(tam, 'lk');
  fs.symlinkSync(c600, lk);
  const va = tep('va.json', '{}', 0o600);
  for (const a of [['--url', tram.url, '--cookie-tep', c644], ['--url', tram.url, '--cookie-tep', lk], ['--url', tram.url, '--pha'],
    ['--url', tram.url, '--va', va], ['--url', 'https://x/duong'], ['--url', 'http://example.com']]) {
    const r = await chay(...a, ...CO);
    assert.equal(r.rc, 2, a.join(' ') + '\n' + r.ra + r.err);
    assert.ok(!(r.ra + r.err).includes(GAC), 'lộ giá trị cookie: ' + a.join(' '));
  }
  assert.deepEqual(dem.ghi, []);
});

test('(a) bản đã duyệt, trang thật qua cầu vé ⇒ rc 0, mọi dòng đạt, ghi rỗng, bo khác rỗng, máy không nhận yêu cầu ghi', { timeout: HAN }, async () => {
  dem.ghi.length = 0;
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(r.dong.length >= 1, r.ra + r.err);
  for (const d of r.dong) {
    assert.equal(d.dat, true, JSON.stringify(d));
    assert.deepEqual(d.ghi, [], JSON.stringify(d));
    assert.ok(Array.isArray(d.bo) && d.bo.length > 0, JSON.stringify(d));
  }
  assert.deepEqual(dem.ghi, []);
});

test('(e) tệp cookie 0600 ⇒ cookie tới máy, giá trị không lộ ra stdout/stderr', { timeout: HAN }, async () => {
  dem.cookie = 0;
  const r = await chay('--url', tram.url, '--cookie-tep', tep('c600', GAC + '\n', 0o600), ...CO);
  assert.ok(!(r.ra + r.err).includes(GAC), 'stdout/stderr lộ giá trị cookie');
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(dem.cookie > 0, 'cookie CF_Authorization không tới máy');
});

test('(b) đối chứng bố cục: bản cấy nút nhỏ (như --pha) duyệt qua datBan ⇒ rc 1, trượt vì nút <44', { timeout: HAN }, async () => {
  await datBan(m, { va: { 'nen.css': [[NEO_CSS, PHA + NEO_CSS]] } });
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => !d.dat && d.hong.some(h => h.includes('nút <44'))), r.ra);
});

test('(c) đối chứng chặn ghi: bản cấy POST /api/goi lúc tải ⇒ rc 1, ghi có /api/goi, máy KHÔNG nhận POST', { timeout: HAN }, async () => {
  await datBan(m, { va: { 'khung.js': [[NEO_JS, NEO_JS + GHI_LUC_TAI]] } });
  dem.ghi.length = 0;
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => !d.dat && d.ghi?.some(g => g.includes('/api/goi'))), r.ra);
  assert.deepEqual(dem.ghi, []);
});
