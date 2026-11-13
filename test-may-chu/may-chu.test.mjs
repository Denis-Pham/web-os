// Test khung máy chủ web-os (task A2): /api/phien, bộ định tuyến chung (404, ánh xạ LoiGoi → HTTP, 500 không lộ lỗi),
// kernel.sock (khung + một yêu cầu một trả lời; giao thức đủ ở kernel.test.mjs), kho 0600, log không mang vé, lối chạy CLI `node may-chu/may-chu.mjs <cau-hinh.json>`.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ROUTE } from '../may-chu/api.mjs';
import { LoiGoi } from '../may-chu/goi.mjs';
import { ve, VE, EMAIL, giayNay, DAU_GHI, moiTruong, goi } from './chung.mjs';

const MAY = fileURLToPath(new URL('../may-chu/may-chu.mjs', import.meta.url));
const mt = moiTruong(), log = [];
let m;
before(async () => { m = await mt.may({}, [], { ghiLog: s => log.push(s) }); });
after(() => mt.dong());

test('GET /api/phien ⇒ { email, het_luc, cos_ghi, ban_ghi } với het_luc = exp của vé (ISO UTC); HEAD cũng qua cổng', async () => {
  const exp = giayNay() + 1234, r = await goi(m, '/api/phien', { jwt: ve({ exp }) });
  assert.equal(r.ma, 200);
  assert.deepEqual(r.json, { email: EMAIL, het_luc: new Date(exp * 1000).toISOString(), cos_ghi: false, ban_ghi: false });
  assert.match(r.dau['content-type'], /^application\/json/); assert.equal(r.dau['cache-control'], 'no-store');
  assert.match(r.dau['content-security-policy'], /default-src 'self'.*frame-ancestors 'none'/);
  assert.equal((await goi(m, '/api/phien', { method: 'HEAD' })).ma, 200);
  assert.equal((await goi(m, '/api/phien', { method: 'HEAD', jwt: '' })).ma, 401);
});

test('route lạ ⇒ 404 (sau cổng vé); đường ngoài /api cũng đòi vé', async () => {
  assert.equal((await goi(m, '/api/khong-co')).ma, 404);
  assert.equal((await goi(m, '/khong-co', { jwt: '' })).ma, 401);
  assert.equal((await goi(m, '/khong-co')).ma, 404);
});

test('route ghi nhận thân + vé; LoiGoi ⇒ e.ma chung (kể cả 409 trung_nguon_gieo); lỗi khác ⇒ 500 thân chung, không lộ thông điệp', async () => {
  ROUTE['POST /api/thu-than'] = ({ than, ve: v }) => ({ dai: than.length, email: v.email });
  ROUTE['POST /api/thu-loi'] = ({ than }) => {
    const o = JSON.parse(than);
    throw o.goi ? new LoiGoi(o.ma, o.loi, o.chi_tiet ?? null) : new Error('BI-MAT-' + o.loi);
  };
  try {
    const p = (duong, o) => goi(m, duong, { method: 'POST', dau: DAU_GHI, than: JSON.stringify(o) });
    assert.deepEqual((await p('/api/thu-than', { a: 1 })).json, { dai: 7, email: EMAIL });
    for (const [ma, loi, chi_tiet] of [[409, 'trung_nguon_gieo'], [409, 'da_sua_sau', { bang: 'viec' }], [400, 'luoc_do', { ly_do: 'x' }], [403, 'quyen']]) {
      const r = await p('/api/thu-loi', { goi: true, ma, loi, chi_tiet });
      assert.equal(r.ma, ma, loi); assert.deepEqual(r.json, chi_tiet ? { loi, chi_tiet } : { loi });
    }
    const r = await p('/api/thu-loi', { goi: false, loi: 'x' });
    assert.equal(r.ma, 500); assert.deepEqual(r.json, { loi: 'loi_may_chu' }); assert.ok(!r.than.includes('BI-MAT'));
  } finally { delete ROUTE['POST /api/thu-than']; delete ROUTE['POST /api/thu-loi']; }
});

test('kernel.sock: khung 4 byte độ dài BE + JSON ⇒ MỘT khung trả lời rồi đóng (khung khoá lạ ⇒ khung)', async () => {
  const ra = await new Promise((ok, loi) => {
    const c = net.createConnection(m.ngheKernel), b = [];
    c.on('connect', () => { const j = Buffer.from('{"hoi":1}'), l = Buffer.alloc(4); l.writeUInt32BE(j.length); c.write(Buffer.concat([l, j])); });
    c.on('data', d => b.push(d)); c.on('end', () => ok(Buffer.concat(b))); c.on('error', loi);
  });
  assert.equal(ra.readUInt32BE(0), ra.length - 4);
  assert.deepEqual(JSON.parse(ra.subarray(4)), { ok: false, loi: 'khung' });
});

test('kho tạo mới mode 0600', async () => {
  const cu = process.umask(0o022);
  try {
    const f = mt.cauHinh(), kho = path.join(JSON.parse(fs.readFileSync(f, 'utf8')).thuMucKho, 'kho.sqlite');
    assert.equal(await mt.thuKhoi(f), null);
    assert.equal(fs.statSync(kho).mode & 0o777, 0o600);
  } finally { process.umask(cu); }
});

test('log: không ghi vé, không ghi query', async () => {
  log.length = 0;
  await goi(m, '/api/viec?mach=BI-MAT-Q');   // /api/phien không nhận query (A5) ⇒ đo trên route nhận query, trả 200
  await new Promise(r => setImmediate(r));
  assert.ok(log.some(s => s.includes(' GET /api/viec 200 ')), 'không có dòng log — phép đo không chạy');
  assert.ok(log.every(s => !s.includes(VE) && !s.includes(VE.split('.')[2]) && !s.includes('BI-MAT')));
});

test('CLI: cấu hình khoá lạ / thiếu argv ⇒ thoát ≠ 0 có lời báo, không nghe; đối chứng cấu hình đúng ⇒ nghe', async () => {
  const f = mt.cauHinh({ la: 1 }), s = JSON.parse(fs.readFileSync(f, 'utf8')).ngheSocket;
  const r = spawnSync(process.execPath, [MAY, f], { encoding: 'utf8', timeout: 5000 });
  assert.equal(r.signal, null); assert.notEqual(r.status, 0); assert.match(r.stderr, /khoá lạ la/); assert.ok(!fs.existsSync(s));
  const r2 = spawnSync(process.execPath, [MAY], { encoding: 'utf8', timeout: 5000 });
  assert.equal(r2.signal, null); assert.notEqual(r2.status, 0); assert.match(r2.stderr, /thiếu đường cấu hình/);
  const g = mt.cauHinh(), s2 = JSON.parse(fs.readFileSync(g, 'utf8')).ngheSocket;
  const con = spawn(process.execPath, [MAY, g], { stdio: ['ignore', 'ignore', 'pipe'] });
  try {
    const dong = await new Promise((ok, loi) => {
      let e = '';
      con.stderr.on('data', d => { e += d; if (e.includes('\n')) ok(e); });
      con.on('exit', c => loi(new Error(`thoát ${c}: ${e}`)));
      setTimeout(() => loi(new Error('hết giờ')), 5000).unref();
    });
    assert.match(dong, /^nghe /); assert.ok(fs.lstatSync(s2).isSocket());
  } finally { con.kill('SIGKILL'); }
});
