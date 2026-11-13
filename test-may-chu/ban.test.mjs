// Test cửa duyệt bản (thiết kế v0.2 mục 6; chép các ca Learning 630a0bf:test-may-chu/ban.test.mjs, đổi tên + dạng lỗi web-os { loi, chi_tiet }):
// xem/duyệt/lùi qua HTTP; kiểm từng tệp (O_NOFOLLOW, fstat chủ = uidCho, tệp thường, cỡ, tên/đuôi); manifest TÍNH LẠI từ byte đã chép (đổi sau khi
// xem ⇒ 409); lật symlink nguyên tử + đúng thứ tự; route ghi bản chỉ bật khi uidBan = uid tiến trình; phục vụ tĩnh bản đã duyệt; /phuc-hoi; CLI lễ; do.sh dat-ban.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { moiTruong, goi, DAU_GHI } from './chung.mjs';
import { docCauHinh } from '../may-chu/cau-hinh.mjs';

const BAN_MJS = fileURLToPath(new URL('../may-chu/ban.mjs', import.meta.url));
const DO_SH = fileURLToPath(new URL('../trien-khai/do.sh', import.meta.url));
const UID = process.getuid();
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const hex = n => crypto.randomBytes(n).toString('hex').slice(0, n);
const post = (may, duong, o) => goi(may, duong, { method: 'POST', dau: DAU_GHI, than: JSON.stringify(o) });
const mt = moiTruong();
after(() => mt.dong());
const A = 'a'.repeat(40), B = 'b'.repeat(40), C = 'c'.repeat(40), D = 'd'.repeat(40), E = 'e'.repeat(40);
const pick = r => [r.ma, r.json];
const hong = ly_do => [422, { loi: 'ban_hong', chi_tiet: { ly_do } }];
const luocDo = ly_do => [400, { loi: 'luoc_do', chi_tiet: { ly_do } }];
const GHI_TAT = [423, { loi: 'ghi_tat' }];

let so = 0;
async function mayMoi(them = {}, bo = []) {   // mỗi máy một thư mục chờ + thư mục bản riêng; mặc định ghi bật (uidBan = uid test)
  const goc = path.join(mt.tam, 'm' + so++), cho = path.join(goc, 'cho'), ban = path.join(goc, 'ban-web');
  fs.mkdirSync(path.join(cho, 'ban'), { recursive: true }); fs.mkdirSync(ban);
  const cfg = { thuMucCho: cho, uidCho: UID, thuMucBan: ban, uidBan: UID, ...them };
  return { may: await mt.may(cfg, bo), ch: mt.cauHinh(cfg, bo), cho: cfg.thuMucCho, ban: cfg.thuMucBan };
}
function datBan(cho, sha, tep) {
  const d = path.join(cho, 'ban', sha); fs.mkdirSync(d, { recursive: true });
  for (const [t, nd] of Object.entries(tep)) fs.writeFileSync(path.join(d, t), nd);
  return d;
}
// Tính ĐỘC LẬP từ nội dung nguồn (không gọi mã máy chủ): sha256 của JSON mảng [tên, cỡ, sha256] sắp theo tên, bỏ ban.json.
const tepTu = (tep, tt = () => 'moi') => Object.keys(tep).filter(t => t !== 'ban.json').sort().map(t => { const b = Buffer.from(tep[t]); return { ten: t, co: b.length, sha256: sha256(b), trang_thai: tt(t) }; });
const manifestTu = tep => sha256(JSON.stringify(tepTu(tep).map(f => [f.ten, f.co, f.sha256])));
const xemCho = async (m, sha) => (await goi(m.may, '/api/ban')).json.cho.find(c => c.sha === sha);
const duyet = (m, sha, manifest) => post(m.may, '/api/ban/duyet', { sha, manifest });
const link = (m, ten) => { try { return fs.readlinkSync(path.join(m.ban, ten)); } catch { return null; } };
const tamSot = m => fs.readdirSync(m.ban).filter(t => t.startsWith('.'));
async function cho(dk) { for (let i = 0; i < 400 && !dk(); i++) await new Promise(r => setTimeout(r, 5)); assert.ok(dk(), 'hết giờ chờ'); }

const tepA = { 'index.html': '<!doctype html><title>A</title>', 'old.js': 'cu()', 'style.css': 'body{}', 'ban.json': '{"ban":"' + 'f'.repeat(40) + '"}' };
const tepB = { 'index.html': '<!doctype html><title>B!</title>', 'app.js': 'moi()', 'style.css': 'body{}' };
let m1, mB;

test('xem → duyệt: manifest khớp cách tính độc lập; manifest sai ⇒ 409, không lật; đúng ⇒ phục vụ A, ban.json do máy chủ viết, không sót tạm', async () => {
  m1 = await mayMoi();
  assert.equal((await goi(m1.may, '/')).ma, 503);                              // chưa duyệt bản nào
  datBan(m1.cho, A, tepA);
  assert.deepEqual(pick(await goi(m1.may, '/api/ban')), [200, { hien_tai: null, truoc: null, cho: [{ sha: A, manifest: manifestTu(tepA), loi: null, tep: tepTu(tepA) }] }]);
  assert.deepEqual(pick(await duyet(m1, A, manifestTu({ ...tepA, 'style.css': 'body{x}' }))), [409, { loi: 'manifest_lech' }]);
  assert.equal(link(m1, 'hien-tai'), null);
  assert.deepEqual(pick(await duyet(m1, A, manifestTu(tepA))), [200, { hien_tai: A, truoc: null }]);
  assert.equal(link(m1, 'hien-tai'), 'ban/' + A);
  const r = await goi(m1.may, '/');
  assert.equal(r.than, tepA['index.html']); assert.match(r.dau['content-type'], /^text\/html/); assert.equal(r.dau['cache-control'], 'no-cache');
  assert.match(r.dau['content-security-policy'], /default-src 'self'/);
  assert.deepEqual(JSON.parse((await goi(m1.may, '/ban.json')).than), { ban: A });
  assert.equal(fs.statSync(path.join(m1.ban, 'ban', A)).mode & 0o777, 0o700);   // ràng buộc 5.3: neo không đọc được bản đã duyệt
  for (const t of ['index.html', 'ban.json']) assert.equal(fs.statSync(path.join(m1.ban, 'ban', A, t)).mode & 0o777, 0o600, t);
  assert.deepEqual(tamSot(m1), []);
  assert.deepEqual((await goi(m1.may, '/api/ban')).json, { hien_tai: { sha: A, manifest: manifestTu(tepA) }, truoc: null, cho: [] });
});

test('bản chờ B: trang_thai moi/sua/giu/xoa; tệp đổi SAU khi xem (cùng cỡ) ⇒ 409, vẫn phục vụ A; xem lại rồi duyệt ⇒ truoc A, hien-tai B', async () => {
  datBan(m1.cho, B, tepB);
  const c = await xemCho(m1, B);
  assert.deepEqual(c, { sha: B, manifest: manifestTu(tepB), loi: null, tep: [...tepTu(tepB, t => ({ 'app.js': 'moi', 'index.html': 'sua', 'style.css': 'giu' })[t]),
    { ...tepTu({ 'old.js': tepA['old.js'] })[0], trang_thai: 'xoa' }] });
  fs.writeFileSync(path.join(m1.cho, 'ban', B, 'app.js'), 'MOI()');
  assert.deepEqual(pick(await duyet(m1, B, c.manifest)), [409, { loi: 'manifest_lech' }]);
  assert.equal(link(m1, 'hien-tai'), 'ban/' + A);
  assert.ok(!fs.existsSync(path.join(m1.ban, 'ban', B)));
  assert.deepEqual(tamSot(m1), []);
  mB = (await xemCho(m1, B)).manifest;
  assert.equal(mB, manifestTu({ ...tepB, 'app.js': 'MOI()' }));
  assert.deepEqual(pick(await duyet(m1, B, mB)), [200, { hien_tai: B, truoc: A }]);
  assert.equal((await goi(m1.may, '/app.js')).than, 'MOI()');
  assert.equal((await goi(m1.may, '/old.js')).ma, 404);
});

test('duyệt lại bản hiện tại ⇒ không đổi; lùi: bấm lại/sha lệch/đúng; SHA từng duyệt so với bản ĐÃ duyệt (neo sửa thư mục chờ vô hiệu); thân/query sai ⇒ 400', async () => {
  assert.deepEqual(pick(await duyet(m1, B, mB)), [200, { hien_tai: B, truoc: A }]);
  assert.deepEqual(pick(await post(m1.may, '/api/ban/lui', { sha: B })), [200, { hien_tai: B, truoc: A }]);
  assert.deepEqual(pick(await post(m1.may, '/api/ban/lui', { sha: E })), [409, { loi: 'truoc_lech' }]);
  assert.deepEqual(pick(await post(m1.may, '/api/ban/lui', { sha: A })), [200, { hien_tai: A, truoc: B }]);
  assert.equal((await goi(m1.may, '/')).than, tepA['index.html']);
  assert.deepEqual(pick(await post(m1.may, '/api/ban/lui', { sha: A })), [200, { hien_tai: A, truoc: B }]);
  fs.writeFileSync(path.join(m1.cho, 'ban', B, 'app.js'), 'XAU()');
  assert.deepEqual(pick(await duyet(m1, B, manifestTu({ ...tepB, 'app.js': 'XAU()' }))), [409, { loi: 'manifest_lech' }]);
  assert.deepEqual(pick(await duyet(m1, B, mB)), [200, { hien_tai: B, truoc: A }]);
  assert.equal((await goi(m1.may, '/app.js')).than, 'MOI()');
  for (const [d, o, ly_do] of [['/api/ban/duyet', { sha: B.toUpperCase(), manifest: mB }, 'sha'], ['/api/ban/duyet', { sha: [B], manifest: mB }, 'sha'],
    ['/api/ban/duyet', { sha: B }, 'manifest'], ['/api/ban/duyet', { sha: B, manifest: mB.slice(1) }, 'manifest'], ['/api/ban/duyet', { sha: B, manifest: mB, thua: 1 }, 'khoa_la'],
    ['/api/ban/lui', {}, 'sha'], ['/api/ban/lui', { sha: [A] }, 'sha']])
    assert.deepEqual(pick(await post(m1.may, d, o)), luocDo(ly_do), d + JSON.stringify(o));
  assert.equal((await post(m1.may, `/api/ban/lui?sha=${B}`, { sha: B })).json.loi, 'query');
  assert.equal((await goi(m1.may, '/api/ban?x=1')).json.loi, 'query');
  assert.equal(link(m1, 'hien-tai'), 'ban/' + B);
  assert.deepEqual(pick(await duyet(m1, E, mB)), [404, { loi: 'khong_co_ban' }]);
  assert.deepEqual(pick(await post((await mayMoi()).may, '/api/ban/lui', { sha: A })), [409, { loi: 'khong_co_truoc' }]);
});

test('uidCho lệch (tệp không thuộc neo) ⇒ xem sai_chu, duyệt 422; đối chứng cùng thư mục chờ, uidCho đúng ⇒ 200', async () => {
  const lech = await mayMoi({ uidCho: UID + 1 }), tep = { 'index.html': 'c' };
  datBan(lech.cho, C, tep);
  assert.deepEqual(await xemCho(lech, C), { sha: C, manifest: null, loi: 'sai_chu', tep: [] });
  assert.deepEqual(pick(await duyet(lech, C, manifestTu(tep))), hong('sai_chu'));
  assert.equal(link(lech, 'hien-tai'), null);
  assert.deepEqual(tamSot(lech), []);
  const dc = await mayMoi({ thuMucCho: lech.cho });
  assert.deepEqual(pick(await duyet(dc, C, manifestTu(tep))), [200, { hien_tai: C, truoc: null }]);
});

test('symlink trong bản chờ (trỏ tới tệp của chính neo) ⇒ loi symlink, duyệt 422 dù manifest tính theo đích', async () => {
  const m = await mayMoi(), d = datBan(m.cho, D, { 'index.html': 'd' });
  fs.writeFileSync(path.join(mt.tam, 'ngoai.js'), 'NGOAI');
  fs.symlinkSync(path.join(mt.tam, 'ngoai.js'), path.join(d, 'app.js'));
  assert.equal((await xemCho(m, D)).loi, 'symlink');
  assert.deepEqual(pick(await duyet(m, D, manifestTu({ 'index.html': 'd', 'app.js': 'NGOAI' }))), hong('symlink'));
  assert.equal(link(m, 'hien-tai'), null);
});

test('tệp lạ: FIFO/thư mục con ⇒ khong_phai_tep (không treo); > 20 480 byte ⇒ tep_lon; tên/đuôi lạ ⇒ ten_sai; > 64 tệp; tổng > 1 MiB; rỗng ⇒ 422', async () => {
  const m = await mayMoi(), day = 'x'.repeat(20480);
  const thu = async (loi, tep, sau = () => {}) => {   // mỗi ca: đặt bản (mới nhất ⇒ trong 10 bản xem) ⇒ xem báo lỗi ⇒ duyệt 422
    const s = hex(40);
    sau(datBan(m.cho, s, tep));
    assert.deepEqual(await xemCho(m, s), { sha: s, manifest: null, loi, tep: [] }, loi);
    assert.deepEqual(pick(await duyet(m, s, '0'.repeat(64))), hong(loi), loi);
  };
  await thu('khong_phai_tep', { 'index.html': 'x' }, d => execFileSync('/usr/bin/mkfifo', [path.join(d, 'app.js')]));
  await thu('khong_phai_tep', { 'index.html': 'x' }, d => fs.mkdirSync(path.join(d, 'con.js')));
  await thu('ten_sai', { 'index.html': 'x' }, d => fs.mkdirSync(path.join(d, 'con')));
  await thu('tep_lon', { 'index.html': 'x', 'app.js': day + 'x' });
  for (const t of ['.an.js', 'x.mjs', 'a b.js', 'a..js', 'check.mjs', 'x.sh', 'khong-duoi']) await thu('ten_sai', { 'index.html': 'x', [t]: 'x' });
  await thu('qua_nhieu_tep', Object.fromEntries(Array.from({ length: 65 }, (_, i) => [`t${i}.js`, 'x'])));
  // 51 × 20 480 + 4 096 = đúng 1 MiB (trần, qua); thêm 1 byte ⇒ tong_lon
  const mib = Object.fromEntries([...Array.from({ length: 51 }, (_, i) => [`t${i}.js`, day]), ['u.js', 'x'.repeat(4096)]]);
  await thu('tong_lon', { ...mib, 'u.js': 'x'.repeat(4097) });
  await thu('rong', {});
  await thu('rong', { 'ban.json': '{}' });
  assert.deepEqual(tamSot(m), []);
  datBan(m.cho, E, mib);
  assert.deepEqual(pick(await duyet(m, E, manifestTu(mib))), [200, { hien_tai: E, truoc: null }]);   // đối chứng: tệp đúng 20 480 byte, tổng đúng 1 MiB
});

test('xem: tối đa 10 bản chờ mới nhất theo mtime, trừ bản đang phục vụ; thư mục không phải SHA40 bị bỏ', async () => {
  const m = await mayMoi(), ds = Array.from({ length: 12 }, () => hex(40));
  ds.forEach((s, i) => { datBan(m.cho, s, { 'index.html': String(i) }); fs.utimesSync(path.join(m.cho, 'ban', s), 1e9 + i, 1e9 + i); });
  fs.mkdirSync(path.join(m.cho, 'ban', 'khong-phai-sha'));
  assert.deepEqual((await goi(m.may, '/api/ban')).json.cho.map(c => c.sha), ds.slice(2).reverse());
  assert.equal((await duyet(m, ds[11], manifestTu({ 'index.html': '11' }))).ma, 200);
  assert.deepEqual((await goi(m.may, '/api/ban')).json.cho.map(c => c.sha), ds.slice(1, 11).reverse());
});

async function coBanA() { const m = await mayMoi(); datBan(m.cho, A, tepA); assert.equal((await duyet(m, A, manifestTu(tepA))).ma, 200); datBan(m.cho, B, tepB); return m; }
const loiGia = () => Object.assign(new Error('EIO giả'), { code: 'EIO' });

test('lật nguyên tử: tạo symlink hien-tai mới hỏng ⇒ 500, hien-tai vẫn trỏ bản cũ (không lúc nào vắng); thử lại ⇒ lật xong', async () => {
  const m = await coBanA(), goc = fs.symlinkSync;
  fs.symlinkSync = (dich, p) => { if (dich === path.join('ban', B)) throw loiGia(); return goc(dich, p); };
  try { assert.equal((await duyet(m, B, manifestTu(tepB))).ma, 500); } finally { fs.symlinkSync = goc; }
  assert.equal(link(m, 'hien-tai'), 'ban/' + A);
  assert.equal((await goi(m.may, '/')).than, tepA['index.html']);
  assert.deepEqual(pick(await duyet(m, B, manifestTu(tepB))), [200, { hien_tai: B, truoc: A }]);
});

test('manifest TÍNH LẠI từ byte ĐÃ CHÉP, không đọc lại nguồn: nguồn bị ghi đè ngay sau khi chép một tệp ⇒ duyệt bằng manifest gốc vẫn 200 và phục vụ đúng nội dung GỐC', async () => {
  const m = await coBanA(), goc = fs.writeFileSync, nguon = path.join(m.cho, 'ban', B, 'app.js');
  fs.writeFileSync = (p, ...r) => { const kq = goc(p, ...r); if (String(p).includes('.tam-') && path.basename(String(p)) === 'app.js') goc(nguon, 'TRAO()'); return kq; };
  try { assert.deepEqual(pick(await duyet(m, B, manifestTu(tepB))), [200, { hien_tai: B, truoc: A }]); } finally { fs.writeFileSync = goc; }
  assert.equal(fs.readFileSync(nguon, 'utf8'), 'TRAO()');                    // móc có chạy: nguồn đã bị tráo thật
  assert.equal((await goi(m.may, '/app.js')).than, 'moi()');
});

test('thứ tự lật: truoc trước, hien-tai sau ⇒ đổi hien-tai hỏng thì vẫn phục vụ bản cũ, symlink tạm được dọn; thử lại ⇒ lật xong', async () => {
  const m = await coBanA(), goc = fs.renameSync;
  let n = 0;
  fs.renameSync = (a, b) => { if (['hien-tai', 'truoc'].includes(path.basename(b)) && ++n === 2) throw loiGia(); return goc(a, b); };
  try { assert.equal((await duyet(m, B, manifestTu(tepB))).ma, 500); } finally { fs.renameSync = goc; }
  assert.equal(link(m, 'hien-tai'), 'ban/' + A);
  assert.deepEqual(tamSot(m), []);
  assert.deepEqual(pick(await duyet(m, B, manifestTu(tepB))), [200, { hien_tai: B, truoc: A }]);
  assert.equal(link(m, 'truoc'), 'ban/' + A);
});

test('route ghi bản chỉ bật khi bản phục vụ thuộc chính máy chủ (uidBan = uid tiến trình) và có cửa chờ: lệch ⇒ 423 ghi_tat cả ba route, không lật; đối chứng ⇒ 200', async () => {
  const tat = await mayMoi({ uidBan: UID + 1 }), tep = { 'index.html': 't' };
  datBan(tat.cho, A, tep);
  assert.deepEqual(pick(await goi(tat.may, '/api/ban')), GHI_TAT);
  assert.deepEqual(pick(await duyet(tat, A, manifestTu(tep))), GHI_TAT);
  assert.deepEqual(pick(await post(tat.may, '/api/ban/lui', { sha: A })), GHI_TAT);
  assert.equal(link(tat, 'hien-tai'), null);
  for (const bo of [['thuMucCho', 'uidCho'], ['uidBan']]) assert.deepEqual(pick(await goi((await mayMoi({}, bo)).may, '/api/ban')), GHI_TAT, String(bo));
  const dc = await mayMoi({ thuMucCho: tat.cho });
  assert.equal((await goi(dc.may, '/api/ban')).ma, 200);
  assert.deepEqual(pick(await duyet(dc, A, manifestTu(tep))), [200, { hien_tai: A, truoc: null }]);
});

test('phục vụ tĩnh: chỉ bản hien-tai trong <thuMucBan>/ban/<SHA40>, tệp của uidBan, không symlink ra ngoài; đường lạ ⇒ 400/404; vẫn qua vé', async () => {
  const m = await mayMoi(), tep = { 'index.html': 's', 'app.js': 'a()' };
  datBan(m.cho, A, tep);
  assert.equal((await duyet(m, A, manifestTu(tep))).ma, 200);
  const r = await goi(m.may, '/app.js');
  assert.equal(r.than, 'a()'); assert.match(r.dau['content-type'], /^text\/javascript/);   // đối chứng
  fs.writeFileSync(path.join(mt.tam, 'ngoai2.js'), 'NGOAI');
  fs.symlinkSync(path.join(mt.tam, 'ngoai2.js'), path.join(m.ban, 'ban', A, 'x.js'));
  assert.equal((await goi(m.may, '/x.js')).ma, 404);                                       // symlink ra ngoài bản (tệp cùng chủ)
  const lech = await mayMoi({ thuMucBan: m.ban, uidBan: UID + 1 });
  assert.equal((await goi(lech.may, '/app.js')).ma, 404);                                  // tệp không thuộc uidBan
  const ngoai = await mayMoi();
  datBan(ngoai.cho, B, tep);
  fs.symlinkSync(path.join(ngoai.cho, 'ban', B), path.join(ngoai.ban, 'hien-tai'));
  assert.equal((await goi(ngoai.may, '/app.js')).ma, 503);                                 // hien-tai trỏ thẳng vào bản chờ của neo
  for (const [d, ma] of [['/..%2Fapp.js', 400], ['/.an.js', 400], ['/a//b.js', 400], ['/x.mjs', 404], ['/khong.js', 404]]) assert.equal((await goi(m.may, d)).ma, ma, d);
  assert.equal((await goi(m.may, '/app.js', { jwt: '' })).ma, 401);
  assert.equal((await goi(m.may, '/app.js', { method: 'HEAD' })).ma, 200);
});

test('/phuc-hoi + /phuc-hoi.js do máy chủ phục vụ (không thuộc bản): bản hiện tại hỏng JS ⇒ vẫn 200, nút Lùi về bản trước và gỡ service worker', async () => {
  const m = await mayMoi(), dau = await goi(m.may, '/phuc-hoi');   // chưa có bản nào ⇒ vẫn 200
  assert.equal(dau.ma, 200); assert.match(dau.dau['content-type'], /^text\/html/); assert.match(dau.than, /<script src="\/phuc-hoi\.js"/);
  assert.equal((await goi(m.may, '/phuc-hoi', { jwt: '' })).ma, 401);
  const tA = { 'index.html': '<!doctype html><script src="app.js"></script>', 'app.js': 'chay()' };
  const tB = { 'index.html': tA['index.html'], 'app.js': 'chay(', 'phuc-hoi.js': 'HONG(' };   // B hỏng JS + cố đè /phuc-hoi.js
  assert.throws(() => new vm.Script(tB['app.js']), SyntaxError);                             // đối chứng: B hỏng thật
  datBan(m.cho, A, tA); assert.equal((await duyet(m, A, manifestTu(tA))).ma, 200);
  datBan(m.cho, B, tB); assert.equal((await duyet(m, B, manifestTu(tB))).ma, 200);
  assert.equal((await goi(m.may, '/app.js')).than, 'chay(');
  const html = await goi(m.may, '/phuc-hoi'), js = await goi(m.may, '/phuc-hoi.js');
  assert.deepEqual([html.ma, html.than], [200, dau.than]);
  assert.equal(js.ma, 200); assert.match(js.dau['content-type'], /^text\/javascript/); assert.notEqual(js.than, 'HONG(');
  // Chạy phuc-hoi.js thật với DOM giả; fetch đi qua máy chủ thật (vé + CSRF như trình duyệt).
  const el = {}, goSw = [];
  const $ = id => (el[id] ??= { textContent: '', disabled: false, nghe: {}, addEventListener(t, f) { this.nghe[t] = f; } });
  const fetchGia = async (url, o = {}) => {
    const r = await goi(m.may, url, { method: o.method ?? 'GET', dau: o.headers ?? {}, than: o.body });
    return { ok: r.ma >= 200 && r.ma < 300, status: r.ma, json: async () => r.json };
  };
  const navigator = { serviceWorker: { getRegistrations: async () => [{ unregister: async () => { goSw.push(1); return true; } }] } };
  vm.runInNewContext(js.than, { document: { getElementById: $ }, fetch: fetchGia, navigator });
  await cho(() => el.truoc?.textContent === A && el.lui.disabled === false);
  assert.equal(el['hien-tai'].textContent, B);
  el.lui.nghe.click();
  await cho(() => el['hien-tai'].textContent === A);
  assert.deepEqual(goSw, [1]);
  assert.equal(link(m, 'hien-tai'), 'ban/' + A); assert.equal(link(m, 'truoc'), 'ban/' + B);
  assert.equal((await goi(m.may, '/app.js')).than, 'chay()');
});

test('CLI lễ: xem in JSON; duyet manifest sai rc 1, đúng rc 0 «DUYET: ĐẠT»; uidBan ≠ uid ⇒ rc 1 ghi_tat; tham số sai ⇒ rc 2', async () => {
  const m = await mayMoi(), tep = { 'index.html': 'e' };
  datBan(m.cho, E, tep);
  const chay = (...a) => spawnSync(process.execPath, [BAN_MJS, ...a], { encoding: 'utf8' });
  let r = chay('xem', m.ch);
  assert.equal(r.status, 0, r.stderr); assert.equal(JSON.parse(r.stdout).cho[0].manifest, manifestTu(tep));
  r = chay('duyet', m.ch, E, '0'.repeat(64));
  assert.equal(r.status, 1); assert.match(r.stderr, /manifest_lech/);
  r = chay('duyet', m.ch, E, manifestTu(tep));
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, `DUYET: ĐẠT ${E}\n`);
  assert.equal(link(m, 'hien-tai'), 'ban/' + E);
  r = chay('xem', mt.cauHinh({ thuMucCho: m.cho, uidCho: UID, thuMucBan: m.ban, uidBan: UID + 1 }));
  assert.equal(r.status, 1); assert.match(r.stderr, /ghi_tat/);
  assert.equal(chay('duyet', m.ch, 'x', 'y').status, 2);
});

test('cấu hình: uidBan tuỳ chọn, số nguyên ≥ 0', () => {
  for (const v of [-1, '501', 1.5, null]) assert.throws(() => docCauHinh(mt.cauHinh({ uidBan: v })), /uidBan/, String(v));
  assert.equal(docCauHinh(mt.cauHinh({ uidBan: 0 })).uidBan, 0);
  assert.equal(docCauHinh(mt.cauHinh()).uidBan, undefined);
});

test('do.sh dat-ban: chép web/ của commit vào <cho>/ban/<SHA40> (đọc được với umask 077), không lật link; đặt hai lần ⇒ máy chủ vẫn phục vụ bản cũ tới khi Duyệt', async () => {
  const repo = path.join(mt.tam, 'repo'), env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  const git = (...a) => execFileSync('git', ['-C', repo, ...a], { env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  fs.mkdirSync(path.join(repo, 'web'), { recursive: true });
  git('init', '-q');
  const commit = tep => {
    for (const [t, nd] of Object.entries(tep)) fs.writeFileSync(path.join(repo, 'web', t), nd);
    git('add', '-A'); git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
    return git('rev-parse', 'HEAD');
  };
  const tA = { 'index.html': 'A', 'app.js': 'a()' }, sA = commit(tA), tB = { 'index.html': 'B', 'app.js': 'b()' }, sB = commit(tB);
  const m = await mayMoi();
  const dat = sha => spawnSync('/bin/bash', ['-c', 'umask 077; exec /bin/bash "$0" dat-ban "$1"', DO_SH, sha], { env: { ...env, WO_CHO: m.cho, WO_REPO: repo }, encoding: 'utf8' });
  let r = dat(sA);
  assert.equal(r.status, 0, r.stderr); assert.equal(r.stdout, `DAT-BAN: ĐẠT ${sA}\n`);
  const dA = path.join(m.cho, 'ban', sA);
  assert.deepEqual(fs.readdirSync(dA).sort(), ['app.js', 'index.html']);
  assert.deepEqual([fs.statSync(dA).mode & 0o777, fs.statSync(path.join(dA, 'app.js')).mode & 0o777], [0o755, 0o644]);
  assert.deepEqual(fs.readdirSync(m.cho), ['ban']);                                          // không link, không sót tạm
  assert.equal((await goi(m.may, '/')).ma, 503);                                            // đặt chưa phải duyệt
  assert.equal((await duyet(m, sA, manifestTu(tA))).ma, 200);
  for (let i = 0; i < 2; i++) { r = dat(sB); assert.equal(r.status, 0, r.stderr); }
  assert.equal((await goi(m.may, '/')).than, 'A');
  assert.equal(link(m, 'hien-tai'), 'ban/' + sA);
  assert.deepEqual((await goi(m.may, '/api/ban')).json.cho.map(c => [c.sha, c.manifest]), [[sB, manifestTu(tB)]]);
  assert.deepEqual(pick(await duyet(m, sB, manifestTu(tB))), [200, { hien_tai: sB, truoc: sA }]);
  assert.equal((await goi(m.may, '/')).than, 'B');
  for (const sai of ['x', sA.toUpperCase(), 'f'.repeat(40)]) assert.equal(dat(sai).status, 1, sai);   // SHA sai dạng / không có commit
  r = spawnSync('/bin/bash', [DO_SH, 'dat-ban', sB], { env: { ...env, WO_CHO: path.join(mt.tam, 'khong-co'), WO_REPO: repo }, encoding: 'utf8' });
  assert.equal(r.status, 1); assert.match(r.stderr, /chưa có/);   // thư mục chờ do lễ tạo: không tự tạo (umask 077 ⇒ _webos không đọc được)
  assert.equal(spawnSync('/bin/bash', [DO_SH, 'lat', sB], { env }).status, 2);
  assert.deepEqual(fs.readdirSync(m.cho), ['ban']);
});

test('B1-M1: bản chờ có BAN.json (trùng tên dành riêng ban.json, APFS không phân biệt hoa thường) ⇒ xem loi ten_dat_truoc, duyệt 422 — không 500', async () => {
  const m = await mayMoi(), tep = { 'index.html': '<!doctype html><title>M1</title>', 'BAN.json': '{"ban":"x"}' };
  datBan(m.cho, E, tep);
  assert.deepEqual(await xemCho(m, E), { sha: E, manifest: null, loi: 'ten_dat_truoc', tep: [] });
  assert.deepEqual(pick(await duyet(m, E, manifestTu(tep))), hong('ten_dat_truoc'));
  assert.equal(link(m, 'hien-tai'), null);
  assert.deepEqual(tamSot(m), []);
});
