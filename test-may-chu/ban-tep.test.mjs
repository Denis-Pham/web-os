// Test GET /api/ban/tep (chép các ca Learning 630a0bf:test-may-chu/ban-tep.test.mjs, đổi tên + dạng lỗi web-os): NỘI DUNG tệp bản chờ + bản đang chạy,
// đọc bằng đúng mức kiểm của docBan (symlink, chủ, tên) và CHỌN theo tên trong danh sách (không ghép đường từ chữ người gửi); trần số mục khi liệt kê.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { moiTruong, goi, DAU_GHI } from './chung.mjs';

const UID = process.getuid();
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const post = (may, duong, o) => goi(may, duong, { method: 'POST', dau: DAU_GHI, than: JSON.stringify(o) });
const mt = moiTruong();
after(() => mt.dong());
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40);
const pick = r => [r.ma, r.json];
const hong = ly_do => [422, { loi: 'ban_hong', chi_tiet: { ly_do } }];
let so = 0;
async function mayMoi(them = {}, bo = []) {
  const goc = path.join(mt.tam, 'm' + so++), cho = path.join(goc, 'cho'), ban = path.join(goc, 'ban-web');
  fs.mkdirSync(path.join(cho, 'ban'), { recursive: true }); fs.mkdirSync(ban);
  const cfg = { thuMucCho: cho, uidCho: UID, thuMucBan: ban, uidBan: UID, ...them };
  return { may: await mt.may(cfg, bo), cho: cfg.thuMucCho, ban };
}
function datBan(cho, sha, tep) {
  const d = path.join(cho, 'ban', sha); fs.mkdirSync(d, { recursive: true });
  for (const [t, nd] of Object.entries(tep)) fs.writeFileSync(path.join(d, t), nd);
  return d;
}
const manifestTu = tep => sha256(JSON.stringify(Object.keys(tep).filter(t => t !== 'ban.json').sort().map(t => { const b = Buffer.from(tep[t]); return [t, b.length, sha256(b)]; })));
// manifest bắt buộc (soát A8): bản chờ phải đúng bản anh thấy ở danh sách; M_RAC cho ca lỗi xảy ra trước khi so manifest.
const M_RAC = 'f'.repeat(64);
const tep = (m, sha, ten, manifest) => goi(m.may, `/api/ban/tep?sha=${sha}&ten=${encodeURIComponent(ten)}&manifest=${manifest}`);
const chu = s => ({ sha256: sha256(Buffer.from(s)), noi_dung: s });

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00]);
const tepA = { 'index.html': '<!doctype html><title>A</title>', 'old.js': 'cu()', 'style.css': 'body{}', 'logo.png': PNG };
const XSS = '<img src=x onerror="alert(1)">\n';
const tepB = { 'index.html': '<!doctype html><title>B — tiếng Việt</title>', 'app.js': XSS, 'style.css': 'body{}', 'logo.png': Buffer.concat([PNG, PNG]),
  'bom.css': '﻿body{}', 'hong.js': Buffer.from([0x61, 0xff, 0xfe, 0x62]), 'ban.json': '{"ban":"NEO-VIET"}' };
let m1;

test('tep: moi + cu đúng nội dung; tệp mới ⇒ cu null; tệp bị xoá ⇒ moi null; ảnh ⇒ nhi_phan, không nội dung; UTF-8 hỏng ⇒ null; BOM giữ', async () => {
  m1 = await mayMoi();
  datBan(m1.cho, A, tepA);
  assert.equal((await post(m1.may, '/api/ban/duyet', { sha: A, manifest: manifestTu(tepA) })).ma, 200);
  datBan(m1.cho, B, tepB);
  const mB = manifestTu(tepB);
  assert.deepEqual(pick(await tep(m1, B, 'index.html', mB)), [200, { ten: 'index.html', moi: chu(tepB['index.html']), cu: chu(tepA['index.html']) }]);
  assert.deepEqual(pick(await tep(m1, B, 'app.js', mB)), [200, { ten: 'app.js', moi: chu(XSS), cu: null }]);   // nguyên văn, máy chủ không đụng
  assert.deepEqual(pick(await tep(m1, B, 'old.js', mB)), [200, { ten: 'old.js', moi: null, cu: chu('cu()') }]);
  assert.deepEqual(pick(await tep(m1, B, 'logo.png', mB)), [200, { ten: 'logo.png', nhi_phan: true, moi: { sha256: sha256(tepB['logo.png']) }, cu: { sha256: sha256(PNG) } }]);
  assert.deepEqual(pick(await tep(m1, B, 'hong.js', mB)), [200, { ten: 'hong.js', moi: { sha256: sha256(tepB['hong.js']), noi_dung: null }, cu: null }]);
  const bom = (await tep(m1, B, 'bom.css', mB)).json.moi;   // trang tính sha256(UTF-8 của noi_dung): phải ra đúng sha của byte thật
  assert.equal(sha256(Buffer.from(bom.noi_dung, 'utf8')), bom.sha256);
  assert.deepEqual(pick(await tep(m1, B, 'khong.js', mB)), [404, { loi: 'khong_co_tep' }]);
  assert.deepEqual(pick(await tep(m1, B, 'ban.json', mB)), [404, { loi: 'khong_co_tep' }]);   // ban.json của neo có trong thư mục nhưng KHÔNG trong danh sách
  assert.deepEqual(pick(await tep(m1, C, 'app.js', M_RAC)), [404, { loi: 'khong_co_ban' }]);
  assert.equal((await goi(m1.may, `/api/ban/tep?sha=${B}&ten=app.js&manifest=${mB}`, { jwt: '' })).ma, 401);   // qua vé như mọi GET
});

test('tep: tham số lạ ⇒ 400 query (tên có / hay .., đuôi lạ, sha sai, thiếu/thừa/lặp khoá); không cần ghiBat; không cấu hình chờ ⇒ 404', async () => {
  const MQ = `&manifest=${M_RAC}`;
  const sai = [`ten=app.js${MQ}`, `sha=${B}${MQ}`, `sha=${B}&ten=app.js&x=1${MQ}`, `sha=${B}&sha=${B}&ten=app.js${MQ}`, `sha=${B}&ten=app.js&ten=old.js${MQ}`,
    `sha=${B.toUpperCase()}&ten=app.js${MQ}`, `sha=${B.slice(1)}&ten=app.js${MQ}`, `sha=..%2F..&ten=app.js${MQ}`, '',
    `sha=${B}&ten=app.js`, `sha=${B}&ten=app.js&manifest=`, `sha=${B}&ten=app.js&manifest=${M_RAC.toUpperCase()}`, `sha=${B}&ten=app.js&manifest=${M_RAC.slice(1)}`,
    `sha=${B}&ten=app.js${MQ}${MQ}`];
  for (const t of ['../ban.json', '..%2Fx.js', 'a/b.js', '.an.js', 'x.mjs', 'a..js', 'app.js%00', '%2Fetc%2Fhosts.txt', '']) sai.push(`sha=${B}&ten=${t}${MQ}`);
  for (const q of sai) { const r = await goi(m1.may, '/api/ban/tep?' + q); assert.deepEqual([r.ma, r.json.loi], [400, 'query'], q); }
  assert.deepEqual([(await goi(m1.may, '/api/ban/tep')).ma, (await goi(m1.may, '/api/ban/tep')).json.loi], [400, 'query']);
  const tat = await mayMoi({ uidBan: UID + 1 }), nd = { 'app.js': 'x()' };   // ghi tắt (uidBan ≠ uid) ⇒ /api/ban 423 nhưng xem tệp vẫn được
  datBan(tat.cho, B, nd);
  assert.equal((await goi(tat.may, '/api/ban')).ma, 423);
  assert.deepEqual(pick(await tep(tat, B, 'app.js', manifestTu(nd))), [200, { ten: 'app.js', moi: chu('x()'), cu: null }]);
  const khong = await mayMoi({}, ['thuMucCho', 'uidCho']);
  assert.deepEqual(pick(await tep(khong, B, 'app.js', M_RAC)), [404, { loi: 'khong_co_ban' }]);
});

// Soát A8 (MEDIUM): neo tráo tệp giữa lúc anh xem danh sách và lúc xem tệp, trả lại trước khi Duyệt ⇒ anh duyệt nội dung chưa từng thấy.
test('tep: tráo tệp sau GET /api/ban ⇒ /tep với manifest cũ 409 manifest_lech; không tráo (hay trả lại) ⇒ 200; thiếu manifest ⇒ 400 query', async () => {
  const m = await mayMoi(), lanh = { 'app.js': 'lanh()', 'index.html': '<p>a</p>' }, d = datBan(m.cho, A, lanh);
  const mA = (await goi(m.may, '/api/ban')).json.cho[0].manifest;
  assert.equal(mA, manifestTu(lanh));
  assert.deepEqual(pick(await tep(m, A, 'app.js', mA)), [200, { ten: 'app.js', moi: chu('lanh()'), cu: null }]);   // đối chứng: không tráo
  fs.writeFileSync(path.join(d, 'app.js'), 'doc()');
  for (const t of ['app.js', 'index.html']) assert.deepEqual(pick(await tep(m, A, t, mA)), [409, { loi: 'manifest_lech' }], t);   // cả tệp không bị tráo
  fs.writeFileSync(path.join(d, 'app.js'), 'lanh()');
  assert.deepEqual(pick(await tep(m, A, 'app.js', mA)), [200, { ten: 'app.js', moi: chu('lanh()'), cu: null }]);
  assert.deepEqual(pick(await goi(m.may, `/api/ban/tep?sha=${A}&ten=app.js`)), [400, { loi: 'query', chi_tiet: { truong: 'manifest' } }]);
});

test('tep: bản có symlink / tệp sai chủ / tên lạ trong thư mục ⇒ 422 cả bản (kể cả hỏi tệp lành); đối chứng uidCho đúng ⇒ 200', async () => {
  const m = await mayMoi(), d = datBan(m.cho, A, { 'index.html': 'a' });
  fs.writeFileSync(path.join(mt.tam, 'ngoai.js'), 'NGOAI');
  fs.symlinkSync(path.join(mt.tam, 'ngoai.js'), path.join(d, 'app.js'));
  for (const t of ['app.js', 'index.html']) assert.deepEqual(pick(await tep(m, A, t, M_RAC)), hong('symlink'), t);
  datBan(m.cho, B, { 'index.html': 'b', 'x.mjs': 'x' });
  assert.deepEqual(pick(await tep(m, B, 'index.html', M_RAC)), hong('ten_sai'));
  const lech = await mayMoi({ uidCho: UID + 1 });
  datBan(lech.cho, C, { 'index.html': 'c' });
  assert.deepEqual(pick(await tep(lech, C, 'index.html', M_RAC)), hong('sai_chu'));
  const dc = await mayMoi({ thuMucCho: lech.cho });
  assert.deepEqual(pick(await tep(dc, C, 'index.html', manifestTu({ 'index.html': 'c' }))), [200, { ten: 'index.html', moi: chu('c'), cu: null }]);
});

// Đếm số mục đọc qua fsp.opendir (máy chủ chạy trong tiến trình test ⇒ cùng đối tượng fsp).
async function demMuc(viec) {
  const goc = fsp.opendir, dem = new Map();
  fsp.opendir = async (d, ...k) => {
    const dir = await goc(d, ...k);
    return (async function* () { for await (const e of dir) { dem.set(d, (dem.get(d) ?? 0) + 1); yield e; } })();
  };
  try { return [await viec(), dem]; } finally { fsp.opendir = goc; }
}

test('trần mục: thư mục chờ 256 mục ⇒ liệt kê bình thường; 257 ⇒ qua_nhieu, cho rỗng, đọc ≤ 257 mục; bản > 64 tệp đọc ≤ 66 mục', async () => {
  const m = await mayMoi(), chua = path.join(m.cho, 'ban');
  datBan(m.cho, A, { 'index.html': 'a' });
  for (let i = 0; i < 255; i++) fs.mkdirSync(path.join(chua, 'rac' + i));
  assert.deepEqual((await goi(m.may, '/api/ban')).json.cho.map(c => c.sha), [A]);
  assert.equal(Object.hasOwn((await goi(m.may, '/api/ban')).json, 'qua_nhieu'), false);
  for (let i = 255; i < 600; i++) fs.mkdirSync(path.join(chua, 'rac' + i));
  const [r, dem] = await demMuc(() => goi(m.may, '/api/ban'));
  assert.deepEqual(r.json, { hien_tai: null, truoc: null, cho: [], qua_nhieu: true });
  assert.ok(dem.get(chua) <= 257, `đọc ${dem.get(chua)} mục`);
  const m2 = await mayMoi(), d64 = Object.fromEntries(Array.from({ length: 64 }, (_, i) => [`t${i}.js`, 'x']));
  datBan(m2.cho, B, { ...d64, 'ban.json': '{}' });   // biên: 64 tệp + ban.json = 65 mục ⇒ vẫn đọc được
  assert.equal((await goi(m2.may, '/api/ban')).json.cho[0].loi, null);
  const dLon = datBan(m2.cho, C, Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`t${i}.js`, 'x'])));
  const [r2, dem2] = await demMuc(() => tep(m2, C, 't1.js', M_RAC));
  assert.deepEqual(pick(r2), hong('qua_nhieu_tep'));
  assert.ok(dem2.get(dLon) <= 66, `đọc ${dem2.get(dLon)} mục`);
});
