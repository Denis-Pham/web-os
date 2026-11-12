// Test an ninh máy chủ web-os (task A2, thiết kế v0.2 mục 5.1–5.3): vé Access, CSRF, trần thân, socket, cấu hình khoá đóng.
// Mỗi ca 401/403 kèm đối chứng: cùng yêu cầu nhưng vé/header đúng ⇒ qua (phép đo phân biệt được đúng và sai).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { taoKiemJwt } from '../may-chu/xac-thuc.mjs';
import { TEAM, AUD, AUD_HUB, EMAIL, K1, K_LA, jwk, ve, VE, giayNay, DAU_GHI, moiTruong, goi } from './chung.mjs';

const mt = moiTruong();
let m;
before(async () => { m = await mt.may(); });
after(() => mt.dong());

test('vé: anh ⇒ 200; không vé / khoá khác cùng kid / AUD Hub / iss khác / hết hạn / chưa hiệu lực / thân null ⇒ 401; email khác ⇒ 403', async () => {
  const ca = [
    ['không vé', '', 401], ['vé rác', 'a.b', 401], ['khoá khác cùng kid', ve({}, { khoa: K_LA }), 401],
    ['AUD Hub', ve({ aud: [AUD_HUB] }), 401], ['iss khác', ve({ iss: 'https://khac.cloudflareaccess.com' }), 401],
    ['hết hạn', ve({ exp: giayNay() - 1 }), 401], ['chưa hiệu lực', ve({ nbf: giayNay() + 600 }), 401], ['thân null', ve({}, { than: null }), 401],
    ['email khác', ve({ email: 'la@vi-du.vn' }), 403],
  ];
  for (const [ten, jwt, ma] of ca) {
    assert.equal((await goi(m, '/api/phien', { jwt })).ma, ma, ten);
    assert.equal((await goi(m, '/api/phien')).ma, 200, 'đối chứng ' + ten);
  }
  assert.equal((await goi(m, '/api/phien', { jwt: ve({ email: EMAIL.toUpperCase() }) })).ma, 200, 'email không phân biệt hoa thường');
});

test('JWKS lỗi ⇒ 503 (đối chứng JWKS tốt ⇒ 200)', async () => {
  const hong = await mt.may({}, [], { layJwks: async () => { throw new Error('mạng'); } });
  assert.equal((await goi(hong, '/api/phien')).ma, 503);
  assert.equal((await goi(m, '/api/phien')).ma, 200);
});

test('bộ khoá quá 1 giờ + JWKS lỗi ⇒ 503, không dùng khoá cũ; lỗi lại trong 60 s vẫn 503; JWKS về ⇒ qua', async () => {
  let gio = Date.now(), hong = false, lan = 0;
  const kiem = taoKiemJwt({ teamDomain: TEAM, aud: AUD, emails: [EMAIL], bayGio: () => gio,
    layJwks: async () => { lan++; if (hong) throw new Error('mạng'); return { keys: [jwk(K1, 'k1')] }; } });
  const v = ve({ exp: Math.floor(gio / 1000) + 7200 });
  assert.equal((await kiem(v)).email, EMAIL);                       // đối chứng: khoá tốt ⇒ qua
  assert.equal((await kiem(v)).email, EMAIL); assert.equal(lan, 1);  // trong hạn: dùng bộ đệm
  gio += 3_600_000; hong = true;
  await assert.rejects(kiem(v), e => e.ma === 503);                  // khoá cũ còn trong bộ nhớ nhưng quá hạn
  gio += 1000;
  await assert.rejects(kiem(v), e => e.ma === 503);                  // trong 60 s sau lần hỏng: không lấy lại, vẫn không dùng khoá cũ
  assert.equal(lan, 2);
  gio += 60_000; hong = false;
  assert.equal((await kiem(v)).email, EMAIL);
});

test('CSRF ghi: thiếu/sai X-WebOS, Content-Type text/plain, Sec-Fetch-Site cross-site/same-site ⇒ 403; đủ hai header (vắng hoặc same-origin) ⇒ qua cổng (404)', async () => {
  const ghi = (dau, method = 'POST') => goi(m, '/api/khong-co', { method, dau, than: '{}' });
  const ca = [
    ['thiếu X-WebOS', { 'Content-Type': 'application/json' }], ['X-WebOS: 0', { ...DAU_GHI, 'X-WebOS': '0' }],
    ['text/plain', { ...DAU_GHI, 'Content-Type': 'text/plain' }], ['thiếu Content-Type', { 'X-WebOS': '1' }],
    ['cross-site', { ...DAU_GHI, 'Sec-Fetch-Site': 'cross-site' }], ['same-site', { ...DAU_GHI, 'Sec-Fetch-Site': 'same-site' }],
  ];
  for (const [ten, dau] of ca) assert.equal((await ghi(dau)).ma, 403, ten);
  assert.equal((await ghi(DAU_GHI)).ma, 404, 'vắng Sec-Fetch-Site + đủ hai header ⇒ qua');
  assert.equal((await ghi({ ...DAU_GHI, 'Sec-Fetch-Site': 'same-origin' })).ma, 404, 'same-origin ⇒ qua');
  assert.equal((await ghi({ ...DAU_GHI, 'Content-Type': 'application/json; charset=utf-8' })).ma, 404, 'charset ⇒ qua');
  for (const method of ['PUT', 'DELETE', 'PATCH']) {
    assert.equal((await ghi({}, method)).ma, 403, method + ' thiếu header');
    assert.equal((await ghi(DAU_GHI, method)).ma, 404, method + ' đủ header');
  }
  assert.equal((await goi(m, '/api/phien')).ma, 200, 'GET không đòi header ghi');
});

// Thân bỏ dở (khai 100 byte, gửi 5): cổng nào quyết TRƯỚC khi đọc thân thì trả mã ngay; đọc thân trước thì treo.
function treo(dau, jwt = VE) {
  return new Promise(ok => {
    const r = http.request({ socketPath: m.ngheSocket, path: '/api/khong-co', method: 'POST', agent: false,
      headers: { ...(jwt ? { 'Cf-Access-Jwt-Assertion': jwt } : {}), 'Content-Length': 100, ...dau } }, res => { res.resume(); ok(res.statusCode); r.destroy(); });
    r.on('error', () => {});
    r.write('{"a":');
    setTimeout(() => { r.destroy(); ok('treo'); }, 800).unref();
  });
}

test('thứ tự cổng: vé trước CSRF, cả hai trước đọc thân; trần thân 64 KiB ⇒ 413', async () => {
  assert.equal((await goi(m, '/api/khong-co', { method: 'POST', jwt: '', than: '{}' })).ma, 401, 'không vé + thiếu header ⇒ 401');
  assert.equal(await treo(DAU_GHI, ''), 401, 'không vé ⇒ 401 không chờ thân');
  assert.equal(await treo({}), 403, 'thiếu header ⇒ 403 không chờ thân');
  assert.equal(await treo(DAU_GHI), 'treo', 'đối chứng: qua hai cổng ⇒ chờ đọc thân');
  assert.equal((await goi(m, '/api/khong-co', { method: 'POST', dau: DAU_GHI, than: 'x'.repeat(64 * 1024 + 1) })).ma, 413, '64 KiB + 1 ⇒ 413');
  assert.equal((await goi(m, '/api/khong-co', { method: 'POST', dau: DAU_GHI, than: 'x'.repeat(64 * 1024) })).ma, 404, 'đúng 64 KiB ⇒ qua trần');
  // Thân chunked (không Content-Length): trần đếm byte thật. Header đo ở phía máy chủ nhận.
  const manh = Array(4).fill('x'.repeat(16 * 1024));
  for (const [ds, ma, ten] of [[[...manh, 'x'], 413, 'chunked 64 KiB + 1 ⇒ 413'], [manh, 404, 'chunked đúng 64 KiB ⇒ qua trần']]) {
    const [kq, nhan] = await chunked(ds);
    assert.equal(nhan['content-length'], undefined, ten); assert.equal(nhan['transfer-encoding'], 'chunked', ten);
    assert.equal(kq, ma, ten);
  }
});

// Gửi thân theo từng mảnh, Transfer-Encoding: chunked; trả [mã, header máy chủ nhận được].
function chunked(ds) {
  return new Promise((ok, loi) => {
    let nhan;
    m.server.once('request', req => { nhan = req.headers; });
    const r = http.request({ socketPath: m.ngheSocket, path: '/api/khong-co', method: 'POST', agent: false,
      headers: { 'Cf-Access-Jwt-Assertion': VE, ...DAU_GHI, 'Transfer-Encoding': 'chunked' } }, res => { res.resume(); res.on('end', () => ok([res.statusCode, nhan])); });
    r.on('error', loi);
    for (const d of ds) r.write(d);
    r.end();
  });
}

test('socket: web + kernel mode 0660, không TCP; socket cũ của chính mình ⇒ thay được', async () => {
  assert.equal(typeof m.server.address(), 'string'); assert.equal(m.cong, null);
  for (const s of [m.ngheSocket, m.ngheKernel]) assert.equal(fs.lstatSync(s).mode & 0o7777, 0o660, s);
  const cu = path.join(mt.tam, 'cu.s');
  spawnSync(process.execPath, ['-e', `require('net').createServer().listen(${JSON.stringify(cu)}, () => process.kill(process.pid, 'SIGKILL'))`]);
  assert.ok(fs.lstatSync(cu).isSocket(), 'không dựng được socket cũ');
  const m2 = await mt.may({ ngheSocket: cu });
  assert.equal(fs.lstatSync(cu).mode & 0o7777, 0o660);
  assert.equal((await goi(m2, '/api/phien')).ma, 200);
});

test('socket: đường đã có không phải socket của uid mình ⇒ không xoá, từ chối (web lẫn kernel)', async () => {
  const f = path.join(mt.tam, 'tep.s'); fs.writeFileSync(f, 'GIU-NGUYEN');
  for (const k of ['ngheSocket', 'ngheKernel']) {
    assert.match(String((await mt.thuKhoi(mt.cauHinh({ [k]: f })))?.message), /không phải socket cũ/, k);
    assert.equal(fs.readFileSync(f, 'utf8'), 'GIU-NGUYEN', k);
  }
  if (process.getuid() !== 0) {                 // root: socket hệ thống thành «của mình» ⇒ không đo ở đây
    const la = '/var/run/mDNSResponder', st = fs.lstatSync(la);
    assert.ok(st.isSocket() && st.uid !== process.getuid(), 'cần socket của uid khác để đo');
    assert.match(String((await mt.thuKhoi(mt.cauHinh({ ngheSocket: la })))?.message), /không phải socket cũ/);
  }
});

test('cấu hình: cong + ngheSocket, thiếu cả hai, khoá lạ, thiếu khoá, sai kiểu, kernel trùng web ⇒ không khởi động, không nghe', async () => {
  const sai = [
    [{ cong: 0 }, [], /cong.*ngheSocket/], [{}, ['ngheSocket'], /cong.*ngheSocket/], [{ la: 1 }, [], /khoá lạ la/],
    ...['teamDomain', 'aud', 'emails', 'ngheKernel', 'thuMucKho', 'thuMucSaoLuu', 'cosGhi'].map(k => [{}, [k], new RegExp('thiếu ' + k)]),
    [{ emails: [] }, [], /emails/], [{ emails: 'anh@vi-du.vn' }, [], /emails/], [{ emails: ['khong-email'] }, [], /emails/],
    [{ cosGhi: 'false' }, [], /cosGhi/], [{ ngheKernel: 'k.s' }, [], /ngheKernel phải là đường tuyệt đối/],
    [{ thuMucBan: 1 }, [], /thuMucBan phải là đường tuyệt đối/], [{ uidCho: -1 }, [], /uidCho/],
    [{ cong: 1.5 }, ['ngheSocket'], /cong/], [{ cong: 70000 }, ['ngheSocket'], /cong/], [{ aud: '' }, [], /aud/],
  ];
  for (const [them, bo, re] of sai) {
    const f = mt.cauHinh(them, bo), c = JSON.parse(fs.readFileSync(f, 'utf8'));
    assert.match(String((await mt.thuKhoi(f))?.message), re, JSON.stringify([them, bo]));
    for (const s of [c.ngheSocket, c.ngheKernel]) if (typeof s === 'string' && path.isAbsolute(s)) assert.ok(!fs.existsSync(s), 'lỗi cấu hình mà vẫn nghe ' + s);
  }
  const trung = path.join(mt.tam, 'trung.s');
  assert.match(String((await mt.thuKhoi(mt.cauHinh({ ngheSocket: trung, ngheKernel: trung })))?.message), /ngheKernel trùng ngheSocket/);
  assert.ok(!fs.existsSync(trung));
  // Cùng một đường viết khác chữ (`//`, `/./`, `x/../`, ở bên kernel lẫn bên web) ⇒ vẫn trùng; đối chứng: đường khác thật ⇒ nhận.
  const t0 = mt.tam;
  for (const [web, ker] of [[path.join(t0, 'tr1.s'), t0 + '//tr1.s'], [t0 + '/./tr2.s', path.join(t0, 'tr2.s')], [path.join(t0, 'tr3.s'), t0 + '/x/../tr3.s']]) {
    assert.match(String((await mt.thuKhoi(mt.cauHinh({ ngheSocket: web, ngheKernel: ker })))?.message), /ngheKernel trùng ngheSocket/, web + ' | ' + ker);
    assert.ok(!fs.existsSync(path.resolve(web)), 'lỗi cấu hình mà vẫn nghe ' + web);
  }
  assert.equal(await mt.thuKhoi(mt.cauHinh({ ngheSocket: t0 + '//w-khac.s', ngheKernel: t0 + '/./k-khac.s' })), null, 'đối chứng: đường khác thật ⇒ nhận');
  // Đối chứng: đủ danh sách khoá đóng (tuỳ chọn hợp lệ) ⇒ khởi động; cong (dev) ⇒ chỉ 127.0.0.1, vé đúng ⇒ 200
  const t = mt.tam;
  assert.equal(await mt.thuKhoi(mt.cauHinh({ thuMucBan: t, thuMucCho: t, uidCho: 0, thuMucXuat: t, thuMucXuatVao: t, thuMucSaoLuu: t, tepKhoaAI: t, cosGhi: true })), null);
  const dev = await mt.may({ cong: 0 }, ['ngheSocket']);
  assert.equal(dev.server.address().address, '127.0.0.1');
  assert.equal((await goi(dev, '/api/phien')).ma, 200);
  assert.equal((await goi(dev, '/api/phien', { jwt: '' })).ma, 401);
});
