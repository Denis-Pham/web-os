// Test API task A3 (thiết kế v0.2 mục 2, 4, 8, 9, 13): việc, lịch, gói/Hoàn tác, nhật ký, đề xuất, cải tiến, tiến độ, brief, xuất việc, màn chủ.
// Đi qua socket thật (moiTruong). Đồng hồ máy chủ giả (dongHo) cố định «hôm nay giờ VN»; đề xuất tạo bằng taoDeXuat trên kho của máy chủ (m.db).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { apGoi, taoDeXuat } from '../may-chu/goi.mjs';
import { DAU_GHI, moiTruong, goi, ve, AUD_HUB } from './chung.mjs';

const mt = moiTruong();
const T0 = Date.parse('2026-11-12T18:30:00Z');   // 01:30 ngày 13/11 giờ VN: ngày VN khác ngày UTC
let T = T0;
const dongHo = { now: () => T, setTimeout: () => 0, clearTimeout: () => {} };   // bộ hẹn sao lưu không bao giờ bắn
const may = (them = {}) => mt.may({ cosGhi: true, ...them }, [], { dongHo });
let m;
before(async () => { m = await may(); });
after(() => mt.dong());

let so = 0;
const khoa = () => `api-khoa-${String(++so).padStart(6, '0')}`;
const iso = () => new Date(T).toISOString();
const post = (may_, duong, o) => goi(may_, duong, { method: 'POST', dau: DAU_GHI, than: typeof o === 'string' ? o : JSON.stringify(o) });
const ghi = (may_, ops, khoa_lap = khoa()) => post(may_, '/api/goi', { khoa_lap, ops });
const them = (bang, truong) => ({ loai: 'them', bang, truong });
const lenh = (loai, bang, r) => ({ loai, bang, id: r.id, phien_ban: r.phien_ban });
// Thêm một dòng qua route (phải 200); trả { bang, id, phien_ban }.
async function moi(may_, bang, truong) { const r = await ghi(may_, [them(bang, truong)]); assert.equal(r.ma, 200, r.than); return r.json.ket_qua[0]; }
async function lam(may_, ops) { const r = await ghi(may_, ops); assert.equal(r.ma, 200, r.than); return r.json; }
const neoDeXuat = (may_, ops, o = {}) => taoDeXuat(may_.db, { mach: 'cos', chu_the: 'neo', noi_dung: 'Neo đề xuất', ops, ...o }, iso()).id;

const bam = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const bang = (db, b) => db.prepare(`SELECT * FROM ${b} ORDER BY rowid`).all().map(r => ({ ...r }));
const anhKho = db => bam(['viec', 'lich', 'cai_tien', 'y_tuong', 'tien_do', 'goi_ghi', 'nhat_ky', 'de_xuat'].map(b => bang(db, b)));
const dem = (db, b) => db.prepare(`SELECT count(*) AS n FROM ${b}`).get().n;
const CT = { ngay: '2026-11-12', mach: 'cos', loai: 'quy_trinh', mon: 'brief', noi_dung: 'gộp hai bước', trang_thai: 'cho' };
const NEO_TIN = { chu_the: 'neo', nguon: { loai: 'tin_anh', kenh: 'lenh', tin_id: '1' } };

test('việc: thêm ⇒ GET thấy · phien_ban cũ ⇒ 409 · xoá ⇒ không thấy, Hoàn tác ⇒ thấy lại · khoa_lap lặp ⇒ một gói · nhat_ky anh/web', async () => {
  const K = khoa(), ops = [them('viec', { tieu_de: 'Gọi ngân hàng', han: '2026-11-20' })];
  const r = await ghi(m, ops, K);
  assert.equal(r.ma, 200, r.than);
  assert.deepEqual(Object.keys(r.json).sort(), ['goi_id', 'ket_qua', 'ma_hoan']);
  const id = r.json.ket_qua[0].id;
  const thay = async (q = '?mo=1&mach=cos') => { const x = await goi(m, '/api/viec' + q); assert.equal(x.ma, 200, q); return x.json.viec.find(v => v.id === id); };
  assert.deepEqual(await thay(), { id, tieu_de: 'Gọi ngân hàng', han: '2026-11-20', danh_sach: null, ghi_chu: null, xong_luc: null, mach: 'cos', phien_ban: 1 });
  assert.equal(await thay('?mach=learning'), undefined, 'lọc mach');
  const lap = await ghi(m, ops, K);
  assert.deepEqual([lap.ma, lap.json], [200, r.json], 'bấm hai lần ⇒ cùng gói');
  assert.equal(m.db.prepare('SELECT count(*) AS n FROM goi_ghi WHERE khoa_lap = ?').get(K).n, 1);
  assert.deepEqual((await ghi(m, [them('viec', { tieu_de: 'khác' })], K)).json, { loi: 'khoa_lap_trung' });
  const sua = (phien_ban, tieu_de) => ghi(m, [{ loai: 'sua', bang: 'viec', id, phien_ban, truong: { tieu_de } }]);
  assert.equal((await sua(1, 'Gọi ngân hàng ACB')).ma, 200);
  const cu = await sua(1, 'Ảnh cũ');
  assert.deepEqual([cu.ma, cu.json], [409, { loi: 'phien_ban', chi_tiet: { bang: 'viec', id } }]);
  assert.equal((await thay()).tieu_de, 'Gọi ngân hàng ACB');
  await lam(m, [lenh('xong', 'viec', { id, phien_ban: 2 })]);
  assert.equal(await thay(), undefined, 'mo=1: việc đã xong không hiện');
  assert.equal((await thay('')).xong_luc, iso());
  const xoa = await lam(m, [lenh('xoa', 'viec', { id, phien_ban: 3 })]);
  assert.equal(await thay(''), undefined, 'đã xoá');
  const h = await post(m, '/api/hoan', { ma_hoan: xoa.ma_hoan });
  assert.equal(h.ma, 200, h.than);
  assert.deepEqual(Object.keys(h.json), ['goi_id']);
  assert.deepEqual(await thay(''), { id, tieu_de: 'Gọi ngân hàng ACB', han: '2026-11-20', danh_sach: null, ghi_chu: null, xong_luc: iso(), mach: 'cos', phien_ban: 5 });
  assert.deepEqual((await post(m, '/api/hoan', { ma_hoan: xoa.ma_hoan })).json, { loi: 'da_hoan' });
  assert.equal((await post(m, '/api/hoan', { ma_hoan: 'f'.repeat(32) })).ma, 404);
  const nk = m.db.prepare('SELECT chu_the, nguon FROM nhat_ky WHERE dong_id = ? ORDER BY id').all(id).map(x => ({ ...x }));
  assert.deepEqual(nk, Array(5).fill({ chu_the: 'anh', nguon: 'web' }));   // them, sua, xong, xoa, Hoàn tác; lệnh hỏng không ghi
  const api = (await goi(m, '/api/nhat-ky')).json.nhat_ky.filter(n => n.dong_id === id);
  assert.deepEqual(api.map(n => [n.chu_the, n.nguon, n.goi_id]).at(0), ['anh', 'web', h.json.goi_id]);
  assert.equal(api.length, 5);
});

test('khách không chọn được chủ thể/nguồn: trường lạ trong thân ⇒ 400, không ghi; JSON hỏng / không phải object ⇒ 400 json; query lạ, lặp, sai ⇒ 400', async () => {
  const ops = [them('viec', { tieu_de: 'Lạ' })], U = randomUUID();
  for (const la of [{ chu_the: 'neo' }, { nguon: { loai: 'tu_chay' } }, { x: 1 }]) {
    const truoc = anhKho(m.db), r = await post(m, '/api/goi', { khoa_lap: khoa(), ops, ...la });
    assert.deepEqual([r.ma, r.json], [400, { loi: 'luoc_do', chi_tiet: { ly_do: 'khoa_la' } }], JSON.stringify(la));
    assert.equal(anhKho(m.db), truoc);
  }
  for (const t of ['{', '[]', 'null', '"x"', '1', '', '\ufeff{}']) assert.deepEqual((await post(m, '/api/goi', t)).json, { loi: 'json' }, `thân ${t}`);
  // Byte UTF-8 hỏng (0xFF) ⇒ 400 json, không thành U+FFFD trong kho; đối chứng: cùng thân UTF-8 đúng ⇒ 200 (soát A3)
  const thanUtf8 = tieu => Buffer.concat([Buffer.from(`{"khoa_lap":"${khoa()}","ops":[{"loai":"them","bang":"viec","truong":{"tieu_de":"a`), tieu, Buffer.from('"}}]}')]);
  const anhUtf = anhKho(m.db), hongU = await goi(m, '/api/goi', { method: 'POST', dau: DAU_GHI, than: thanUtf8(Buffer.from([0xff])) });
  assert.deepEqual([hongU.ma, hongU.json, anhKho(m.db)], [400, { loi: 'json' }, anhUtf]);
  assert.equal((await goi(m, '/api/goi', { method: 'POST', dau: DAU_GHI, than: thanUtf8(Buffer.from('ê')) })).ma, 200, 'đối chứng UTF-8 đúng');
  for (const t of [{}, { ma_hoan: 1 }, { ma_hoan: null }]) assert.deepEqual((await post(m, '/api/hoan', t)).json, { loi: 'luoc_do', chi_tiet: { ly_do: 'ma_hoan' } }, JSON.stringify(t));
  // Route không nhận query (mọi lệnh ghi, /api/phien): query khác rỗng ⇒ 400, không ghi; đối chứng: không query ⇒ qua (soát A3)
  const anhQ = anhKho(m.db), U2 = randomUUID();
  for (const [d, t] of [['/api/goi?x=1', { khoa_lap: khoa(), ops }], ['/api/goi?khoa_lap=abcdefgh', { khoa_lap: khoa(), ops }], ['/api/hoan?x=1', { ma_hoan: 'f'.repeat(32) }],
    [`/api/de-xuat/${U2}/bo-qua?x=1`, {}], [`/api/de-xuat/${U2}/ap-dung?x=1`, { khoa_lap: khoa() }], [`/api/cai-tien/${U2}/trang-thai?x=1`, { trang_thai: 'bo', phien_ban: 1 }]])
    assert.deepEqual((await post(m, d, t)).json?.loi, 'query', d);
  assert.equal(anhKho(m.db), anhQ);
  assert.deepEqual((await goi(m, '/api/phien?x=1')).json?.loi, 'query', '/api/phien?x=1');
  assert.equal((await post(m, '/api/goi?', { khoa_lap: khoa(), ops })).ma, 200, 'đối chứng: «?» rỗng ⇒ qua');
  for (const [duong, t] of [['/api/hoan', { ma_hoan: 'x', chu_the: 'neo' }], [`/api/cai-tien/${U}/trang-thai`, { trang_thai: 'bo', phien_ban: 1, khoa_lap: 'abcdefgh' }],
    [`/api/de-xuat/${U}/ap-dung`, { khoa_lap: khoa(), chu_the: 'neo' }], [`/api/de-xuat/${U}/bo-qua`, { nguon: 'web' }]])
    assert.deepEqual((await post(m, duong, t)).json, { loi: 'luoc_do', chi_tiet: { ly_do: 'khoa_la' } }, duong);
  const r = await ghi(m, ops);   // đối chứng: cùng thân không trường lạ ⇒ ghi, chủ thể anh / nguồn web
  assert.equal(r.ma, 200);
  assert.deepEqual({ ...m.db.prepare('SELECT chu_the, nguon FROM goi_ghi WHERE id = ?').get(r.json.goi_id) }, { chu_the: 'anh', nguon: '{"loai":"web"}' });
  for (const q of ['?la=1', '?mo=1&mo=1', '?mo=0', '?mo=', '?mach=cos&mach=cos']) assert.equal((await goi(m, '/api/viec' + q)).ma, 400, q);
  for (const d of ['/api/brief?x=1', '/api/man-chu?x=1', '/api/cai-tien?x=1', '/api/de-xuat?x=1', '/api/nhat-ky?x=1', '/api/xuat-viec?dang=json&x=1', '/api/tien-do?viec=a&x=1'])
    assert.deepEqual((await goi(m, d)).json?.loi, 'query', d);
  assert.equal((await goi(m, '/api/viec?mo=1&mach=cos')).ma, 200, 'đối chứng');
});

test('lịch: tu–den bắt buộc, ngày có thật, den ≥ tu, ≤ 62 ngày tính cả hai đầu; trả lịch phủ khoảng, không lịch đã xoá', async () => {
  const mL = await may(), L = {};
  for (const [k, t] of [['sang', { tieu_de: 'Họp', bat_dau: '2026-11-13T09:00', ket_thuc: '2026-11-13T10:00', dia_diem: 'Q1', nhac_truoc_phut: 15 }],
    ['dai', { tieu_de: 'Công tác', bat_dau: '2026-11-10', ket_thuc: '2026-11-14', ca_ngay: 1 }],
    ['sau', { tieu_de: 'Khám', bat_dau: '2026-12-01T08:00' }], ['xoa', { tieu_de: 'Huỷ', bat_dau: '2026-11-13T11:00' }]]) L[k] = await moi(mL, 'lich', t);
  await lam(mL, [lenh('xoa', 'lich', L.xoa)]);
  const lay = async q => { const r = await goi(mL, '/api/lich' + q); assert.equal(r.ma, 200, q + ' ' + r.than); return r.json.lich; };
  const homNay = await lay('?tu=2026-11-13&den=2026-11-13');
  assert.deepEqual(homNay.map(x => x.id), [L.dai.id, L.sang.id]);
  assert.deepEqual(homNay[1], { id: L.sang.id, tieu_de: 'Họp', bat_dau: '2026-11-13T09:00', ket_thuc: '2026-11-13T10:00', ca_ngay: 0, nhac_truoc_phut: 15, dia_diem: 'Q1', phien_ban: 1 });
  assert.deepEqual(await lay('?tu=2026-11-15&den=2026-11-30'), []);
  assert.deepEqual((await lay('?tu=2026-11-14&den=2026-12-01')).map(x => x.id), [L.dai.id, L.sau.id]);
  assert.deepEqual(await lay('?tu=2026-07-01&den=2026-08-31'), [], '62 ngày tính cả hai đầu ⇒ nhận');
  for (const q of ['', '?tu=2026-11-13', '?den=2026-11-13', '?tu=2026-02-30&den=2026-03-01', '?tu=2026-11-1&den=2026-11-13', '?tu=2026-11-13&den=2026-11-12',
    '?tu=2026-07-01&den=2026-09-01', '?tu=2026-11-13T00:00&den=2026-11-14', '?tu=2026-11-13&den=2026-11-14&x=1', '?tu=2026-11-13&tu=2026-11-13&den=2026-11-14'])
    assert.equal((await goi(mL, '/api/lich' + q)).ma, 400, q);
});

test('tiến độ: ghi qua /api/goi, GET theo việc; ghi cho việc đã xoá ⇒ 403, kho không đổi', async () => {
  const v = await moi(m, 'viec', { tieu_de: 'Học IELTS' }), khac = await moi(m, 'viec', { tieu_de: 'Việc khác' });
  const t = await moi(m, 'tien_do', { doi_tuong: `viec:${v.id}`, ghi: 'xong bài 1', phan_tram: 30 });
  const tk = await moi(m, 'tien_do', { doi_tuong: `viec:${khac.id}`, phan_tram: 5 });
  assert.deepEqual((await goi(m, `/api/tien-do?viec=${v.id}`)).json, { tien_do: [{ id: t.id, ghi: 'xong bài 1', phan_tram: 30, phien_ban: 1 }] });
  assert.deepEqual((await goi(m, `/api/tien-do?viec=${khac.id}`)).json.tien_do.map(x => x.id), [tk.id]);
  await lam(m, [lenh('xoa', 'viec', v)]);
  const truoc = anhKho(m.db), r = await ghi(m, [them('tien_do', { doi_tuong: `viec:${v.id}`, phan_tram: 40 })]);
  assert.deepEqual([r.ma, r.json], [403, { loi: 'quyen', chi_tiet: { bang: 'tien_do', loai: 'them' } }]);
  assert.equal(anhKho(m.db), truoc);
  assert.equal((await goi(m, '/api/tien-do')).ma, 400);
});

test('đề xuất: GET chỉ «cho» · Bỏ qua ⇒ goi_ghi và lịch sử Hoàn tác y nguyên (R9) · Áp dụng ⇒ ảnh sau = ảnh trước + ĐÚNG phép đổi (R6, K1) · hai lần ⇒ 409, một gói', async () => {
  const mD = await may();
  const A = await moi(mD, 'viec', { tieu_de: 'A', han: '2026-11-15', ghi_chu: 'giữ', danh_sach: 'Nhà' });
  const B = await moi(mD, 'viec', { tieu_de: 'B', han: '2026-11-16' });
  await moi(mD, 'lich', { tieu_de: 'C', bat_dau: '2026-11-13T09:00' });
  const doiHan = neoDeXuat(mD, [lenh('sua', 'viec', A)].map(o => ({ ...o, truong: { han: '2026-11-21' } })), { noi_dung: 'Dời hạn A sang 21/11' });
  const themViec = neoDeXuat(mD, [them('viec', { tieu_de: 'Mua quà', han: '2026-11-25' })]);
  const boDi = neoDeXuat(mD, [lenh('xoa', 'viec', B)]);
  const hoc = neoDeXuat(mD, [them('viec', { tieu_de: 'Ôn bài' })], { mach: 'learning' });
  const ds = async q => { const r = await goi(mD, '/api/de-xuat' + q); assert.equal(r.ma, 200); return r.json.de_xuat; };
  assert.deepEqual((await ds('?mach=cos')).map(d => d.id).sort(), [doiHan, themViec, boDi].sort());
  assert.deepEqual((await ds('')).map(d => d.id).sort(), [doiHan, themViec, boDi, hoc].sort());
  assert.deepEqual((await ds('?mach=cos')).find(d => d.id === doiHan), { id: doiHan, mach: 'cos', chu_the: 'neo', noi_dung: 'Dời hạn A sang 21/11',
    ops: [{ loai: 'sua', bang: 'viec', id: A.id, phien_ban: 1, truong: { han: '2026-11-21' } }], phien_ban: 1, tao_luc: iso() });
  // Bỏ qua (R9): không gói, không lịch sử Hoàn tác, không nhat_ky, dữ liệu y nguyên
  const goiTruoc = bang(mD.db, 'goi_ghi'), nkTruoc = dem(mD.db, 'nhat_ky'), duLieu = bam(['viec', 'lich'].map(b => bang(mD.db, b)));
  const bq = await post(mD, `/api/de-xuat/${boDi}/bo-qua`, {});
  assert.deepEqual([bq.ma, bq.json], [200, { trang_thai: 'bo_qua' }]);
  assert.deepEqual(bang(mD.db, 'goi_ghi'), goiTruoc, 'Bỏ qua đổi goi_ghi (lịch sử Hoàn tác)');
  assert.equal(dem(mD.db, 'nhat_ky'), nkTruoc);
  assert.equal(bam(['viec', 'lich'].map(b => bang(mD.db, b))), duLieu);
  assert.ok(!(await ds('')).some(d => d.id === boDi), 'đã Bỏ qua thì không còn trong danh sách chờ');
  assert.deepEqual((await post(mD, `/api/de-xuat/${boDi}/bo-qua`, {})).json, { loi: 'de_xuat_da_xu_ly' });
  assert.deepEqual((await post(mD, `/api/de-xuat/${boDi}/ap-dung`, { khoa_lap: khoa() })).json, { loi: 'de_xuat_da_xu_ly' });
  assert.deepEqual(bang(mD.db, 'goi_ghi'), goiTruoc);
  // Áp dụng sửa (R6): đúng id, đúng giá trị, trường khác giữ, không thêm/bớt dòng, bảng khác y nguyên
  const viecTruoc = bang(mD.db, 'viec'), lichTruoc = bang(mD.db, 'lich');
  const ad = await post(mD, `/api/de-xuat/${doiHan}/ap-dung`, { khoa_lap: khoa() });
  assert.equal(ad.ma, 200, ad.than);
  assert.deepEqual(Object.keys(ad.json).sort(), ['goi_id', 'ma_hoan']);
  const ky = viecTruoc.map(r => (r.id === A.id ? { ...r, han: '2026-11-21', phien_ban: 2, sua_luc: iso(), nguoi_sua: 'anh' } : r));
  assert.deepEqual(bang(mD.db, 'viec'), ky);
  assert.deepEqual(bang(mD.db, 'lich'), lichTruoc);
  assert.deepEqual({ ...mD.db.prepare('SELECT trang_thai, goi_id FROM de_xuat WHERE id = ?').get(doiHan) }, { trang_thai: 'ap_dung', goi_id: ad.json.goi_id });
  const anhAd = anhKho(mD.db), lai = await post(mD, `/api/de-xuat/${doiHan}/ap-dung`, { khoa_lap: khoa() });   // đề xuất sua, lần hai khoá khác (soát A3)
  assert.deepEqual([lai.ma, lai.json, anhKho(mD.db)], [409, { loi: 'de_xuat_da_xu_ly' }, anhAd]);
  // Áp dụng thêm (K1): đúng MỘT dòng mới, đúng giá trị, dòng cũ y nguyên
  const K2 = khoa(), ad2 = await post(mD, `/api/de-xuat/${themViec}/ap-dung`, { khoa_lap: K2 });
  assert.equal(ad2.ma, 200, ad2.than);
  const sau = bang(mD.db, 'viec'), moiDong = sau.at(-1);
  assert.deepEqual(sau.slice(0, -1), ky);
  assert.deepEqual(moiDong, { id: moiDong.id, tieu_de: 'Mua quà', han: '2026-11-25', danh_sach: null, ghi_chu: null, xong_luc: null, mach: 'cos', nguon_gieo: null,
    phien_ban: 1, tao_luc: iso(), sua_luc: iso(), nguoi_sua: 'anh', xoa_luc: null });
  // hai lần (khác khoa_lap) ⇒ 409, chỉ một gói; bấm hai lần (cùng khoa_lap) ⇒ cùng gói
  const soGoi = dem(mD.db, 'goi_ghi'), anh = anhKho(mD.db);
  assert.deepEqual((await post(mD, `/api/de-xuat/${themViec}/ap-dung`, { khoa_lap: khoa() })).json, { loi: 'de_xuat_da_xu_ly' });
  const lap = await post(mD, `/api/de-xuat/${themViec}/ap-dung`, { khoa_lap: K2 });
  assert.deepEqual([lap.ma, lap.json], [200, ad2.json]);
  assert.deepEqual([dem(mD.db, 'goi_ghi'), anhKho(mD.db)], [soGoi, anh]);
  assert.deepEqual(mD.db.prepare('SELECT chu_the, nguon FROM nhat_ky WHERE goi_id = ?').all(ad.json.goi_id).map(x => ({ ...x })), [{ chu_the: 'anh', nguon: 'web' }]);
  // Hoàn tác gói Áp dụng ⇒ A về hạn cũ; đề xuất không có ⇒ 404
  assert.equal((await post(mD, '/api/hoan', { ma_hoan: ad.json.ma_hoan })).ma, 200);
  assert.equal(bang(mD.db, 'viec').find(r => r.id === A.id).han, '2026-11-15');
  assert.deepEqual((await post(mD, `/api/de-xuat/${randomUUID()}/ap-dung`, { khoa_lap: khoa() })).json, { loi: 'khong_co' });
  // R11: đề xuất có ngày ngoài 2000–2100 không lưu được
  assert.throws(() => neoDeXuat(mD, [them('viec', { tieu_de: 'X', han: '2101-01-01' })]), e => e.ma === 400 && e.loi === 'luoc_do');
  assert.equal(dem(mD.db, 'de_xuat'), 4);
});

test('cải tiến: GET; đổi trạng thái qua route (gói anh, Hoàn tác được); phien_ban cũ ⇒ 409; trạng thái lạ / thiếu ⇒ 400', async () => {
  const k = apGoi(m.db, { khoa_lap: khoa(), ...NEO_TIN, ops: [them('cai_tien', CT)] }, iso()).ket_qua[0];
  const thay = async () => (await goi(m, '/api/cai-tien')).json.cai_tien.find(c => c.id === k.id);
  assert.deepEqual(await thay(), { id: k.id, ...CT, duong: null, phien_ban: 1 });
  const gx = apGoi(m.db, { khoa_lap: khoa(), ...NEO_TIN, ops: [them('cai_tien', { ...CT, mon: 'sẽ xoá' })] }, iso()), xoa = gx.ket_qua[0];
  assert.ok((await goi(m, '/api/cai-tien')).json.cai_tien.some(c => c.id === xoa.id));
  assert.equal((await post(m, '/api/hoan', { ma_hoan: gx.ma_hoan })).ma, 200);   // Hoàn tác một them = xoá mềm (R10)
  assert.ok(!(await goi(m, '/api/cai-tien')).json.cai_tien.some(c => c.id === xoa.id), 'cải tiến đã xoá không hiện');
  const doi = t => post(m, `/api/cai-tien/${k.id}/trang-thai`, t);
  const r = await doi({ trang_thai: 'da_nhap', phien_ban: 1 });
  assert.equal(r.ma, 200, r.than);
  assert.deepEqual(Object.keys(r.json).sort(), ['goi_id', 'ket_qua', 'ma_hoan']);
  assert.deepEqual(await thay(), { id: k.id, ...CT, trang_thai: 'da_nhap', duong: null, phien_ban: 2 });
  assert.equal((await doi({ trang_thai: 'bo', phien_ban: 1 })).ma, 409);
  for (const t of [{ trang_thai: 'xau', phien_ban: 2 }, { phien_ban: 2 }, { trang_thai: 'bo' }]) assert.equal((await doi(t)).ma, 400, JSON.stringify(t));
  assert.equal((await post(m, '/api/hoan', { ma_hoan: r.json.ma_hoan })).ma, 200);
  assert.equal((await thay()).trang_thai, 'cho');
});

test('cosGhi: false ⇒ gói, Hoàn tác, Áp dụng, Bỏ qua, đổi trạng thái cải tiến đều 423, kho không đổi; đọc + xuất việc vẫn chạy; đối chứng cosGhi: true ⇒ cùng yêu cầu ghi được', async () => {
  const kho = path.join(mt.tam, 'kho-chung');
  fs.mkdirSync(kho);
  const mA = await may({ thuMucKho: kho });
  const v = await moi(mA, 'viec', { tieu_de: 'Đã có' });
  const g = await lam(mA, [them('viec', { tieu_de: 'Sẽ hoàn' })]);
  const ct = apGoi(mA.db, { khoa_lap: khoa(), ...NEO_TIN, ops: [them('cai_tien', CT)] }, iso()).ket_qua[0];
  const P = neoDeXuat(mA, [them('viec', { tieu_de: 'Từ đề xuất' })]), Q = neoDeXuat(mA, [them('viec', { tieu_de: 'Bỏ' })]);
  // Không tự dong(): mt.dong() đóng mọi máy một lần (đóng hai lần ⇒ đột biến dong-mot-lan treo cả lượt test). Hai máy mở CÙNG kho (WAL).
  const yeuCau = [['/api/goi', { khoa_lap: khoa(), ops: [them('viec', { tieu_de: 'Mới' })] }], ['/api/hoan', { ma_hoan: g.ma_hoan }],
    [`/api/de-xuat/${P}/ap-dung`, { khoa_lap: khoa() }], [`/api/de-xuat/${Q}/bo-qua`, {}], [`/api/cai-tien/${ct.id}/trang-thai`, { trang_thai: 'da_nhap', phien_ban: 1 }]];
  const m0 = await may({ thuMucKho: kho, cosGhi: false });
  const truoc = anhKho(m0.db);
  for (const [d, t] of yeuCau) {
    const r = await post(m0, d, t);
    assert.deepEqual([r.ma, r.json], [423, { loi: 'cos_ghi_tat' }], d);
    assert.equal(anhKho(m0.db), truoc, d);
  }
  assert.equal((await post(m0, '/api/goi', '{')).ma, 423, 'kiểm cosGhi trước khi đọc thân');
  assert.ok((await goi(m0, '/api/viec')).json.viec.some(x => x.id === v.id));
  assert.ok((await goi(m0, '/api/xuat-viec?dang=json')).json.viec.some(x => x.id === v.id), 'xuất việc chạy khi cosGhi: false');
  for (const d of ['/api/lich?tu=2026-11-13&den=2026-11-13', '/api/nhat-ky', '/api/de-xuat', '/api/cai-tien', '/api/brief', '/api/man-chu', `/api/tien-do?viec=${v.id}`, '/api/xuat-viec?dang=csv'])
    assert.equal((await goi(m0, d)).ma, 200, d);
  assert.equal(anhKho(m0.db), truoc);
  for (const [d, t] of yeuCau) {   // đối chứng: máy cosGhi: true trên cùng kho ⇒ cùng yêu cầu ghi được (m0 thấy kho đổi)
    const t1 = anhKho(m0.db), r = await post(mA, d, t);
    assert.equal(r.ma, 200, `đối chứng ${d}: ${r.than}`);
    assert.notEqual(anhKho(m0.db), t1, d);
  }
});

test('đường :id chỉ khớp UUID chữ thường, không giải mã %: hoa, %-mã hoá, thừa/thiếu ký tự, «:id» viết thẳng ⇒ 404, không tới route; đối chứng UUID đúng ⇒ tới route (parse thân)', async () => {
  const u = '0b3f6c1e-7d2a-4c59-9e8f-1a2b3c4d5e6f';
  for (const d of [u.toUpperCase(), '%30' + u.slice(1), 'x' + u, u + 'x', u.slice(1), ':id', '', u + '/x'])
    for (const duoi of ['bo-qua', 'ap-dung']) assert.deepEqual((await post(m, `/api/de-xuat/${d}/${duoi}`, '[]')).json, { loi: 'khong_co' }, `${d} ${duoi}`);
  assert.deepEqual((await post(m, `/api/cai-tien/${u.toUpperCase()}/trang-thai`, '[]')).json, { loi: 'khong_co' });
  assert.deepEqual((await post(m, '/api/cai-tien/:id/trang-thai', '[]')).json, { loi: 'khong_co' });
  for (const duoi of ['de-xuat/' + u + '/bo-qua', 'de-xuat/' + u + '/ap-dung', 'cai-tien/' + u + '/trang-thai'])
    assert.deepEqual((await post(m, '/api/' + duoi, '[]')).json, { loi: 'json' }, 'đối chứng ' + duoi);
  assert.deepEqual((await post(m, `/api/de-xuat/${u}/bo-qua`, {})).json, { loi: 'khong_co' }, 'UUID đúng mà không có đề xuất ⇒ 404 từ hàm');
  assert.equal((await goi(m, `/api/de-xuat/${u}/bo-qua`)).ma, 404, 'GET ⇒ 404');
});

test('brief: số tính thẳng từ kho lúc gọi theo giờ VN, khớp truy vấn SQL viết tay; kho trống ⇒ mọi số 0', async () => {
  const mB = await may();
  try {
    assert.deepEqual((await goi(mB, '/api/brief')).json, { qua_han: 0, han_hom_nay: 0, lich_hom_nay: 0, de_xuat_cho: 0 });
    for (const han of ['2026-11-12', '2026-11-13', '2026-11-13T01:00', '2026-11-13T09:00', '2026-11-14', null]) await moi(mB, 'viec', { tieu_de: 'v', han });
    await lam(mB, [lenh('xong', 'viec', await moi(mB, 'viec', { tieu_de: 'xong', han: '2026-11-01' }))]);
    await lam(mB, [lenh('xoa', 'viec', await moi(mB, 'viec', { tieu_de: 'xoá', han: '2026-11-13' }))]);
    for (const [bat_dau, ket_thuc] of [['2026-11-13T09:00', null], ['2026-11-10', '2026-11-14'], ['2026-11-12T20:00', null], ['2026-11-14T08:00', null]])
      await moi(mB, 'lich', { tieu_de: 'L', bat_dau, ket_thuc });
    await lam(mB, [lenh('xoa', 'lich', await moi(mB, 'lich', { tieu_de: 'xoá', bat_dau: '2026-11-13T07:00' }))]);
    neoDeXuat(mB, [them('viec', { tieu_de: 'a' })]); neoDeXuat(mB, [them('viec', { tieu_de: 'b' })]);
    assert.equal((await post(mB, `/api/de-xuat/${neoDeXuat(mB, [them('viec', { tieu_de: 'c' })])}/bo-qua`, {})).ma, 200);
    // Truy vấn viết tay, công thức khác mã: ngày VN + giờ VN của đồng hồ giả
    const tay = (ngay, gio) => {
      const n = (sql, ...a) => mB.db.prepare(`SELECT count(*) AS n FROM ${sql}`).get(...a).n, mo = 'viec WHERE xoa_luc IS NULL AND xong_luc IS NULL';
      return {
        qua_han: n(`${mo} AND ((length(han) = 10 AND han < ?) OR (length(han) = 16 AND han < ?))`, ngay, gio),
        han_hom_nay: n(`${mo} AND han LIKE ? || '%'`, ngay),
        lich_hom_nay: n("lich WHERE xoa_luc IS NULL AND bat_dau < date(?, '+1 day') AND coalesce(ket_thuc, bat_dau) >= ?", ngay, ngay),
        de_xuat_cho: n("de_xuat WHERE trang_thai NOT IN ('bo_qua', 'ap_dung')"),
      };
    };
    const b1 = (await goi(mB, '/api/brief')).json;
    assert.deepEqual(b1, tay('2026-11-13', '2026-11-13T01:30'));
    assert.deepEqual(b1, { qua_han: 2, han_hom_nay: 3, lich_hom_nay: 2, de_xuat_cho: 2 });
    T += 86400e3;   // một ngày sau: số đổi theo lúc gọi
    const b2 = (await goi(mB, '/api/brief')).json;
    assert.deepEqual(b2, tay('2026-11-14', '2026-11-14T01:30'));
    assert.deepEqual(b2, { qua_han: 4, han_hom_nay: 1, lich_hom_nay: 2, de_xuat_cho: 2 });
  } finally { T = T0; }
});

test('xuất việc: json + csv có mọi việc mở (không đã xoá/đã xong) + lịch còn mở; CSV RFC 4180, ô mở đầu = + - @ TAB CR thêm \'; dang lạ ⇒ 400', async () => {
  const mX = await may();
  const V = [['Bình thường', '2026-11-14'], ['=1+2', '2026-11-15'], ['-5 phút, "gấp"\nxuống dòng', '2026-11-16'], ['@lệnh\ndòng hai', '2026-11-17'], ['+84 "909"', '2026-11-18'],
    ['\tthụt', '2026-11-19'], ['\rvề đầu', '2026-11-20']];
  const ids = [];
  for (const [tieu_de, han] of V) ids.push((await moi(mX, 'viec', { tieu_de, han, ...(ids.length ? {} : { ghi_chu: 'a,b' }) })).id);
  await lam(mX, [lenh('xoa', 'viec', await moi(mX, 'viec', { tieu_de: 'Đã xoá', han: '2026-11-14' }))]);
  await lam(mX, [lenh('xong', 'viec', await moi(mX, 'viec', { tieu_de: 'Đã xong', han: '2026-11-14' }))]);
  const L1 = await moi(mX, 'lich', { tieu_de: 'Khám, răng', bat_dau: '2026-11-20T08:00', ket_thuc: '2026-11-20T09:00', nhac_truoc_phut: 30, dia_diem: 'Q3' });
  await moi(mX, 'lich', { tieu_de: 'Đã qua', bat_dau: '2026-11-12T20:00' });   // hôm qua giờ VN
  await lam(mX, [lenh('xoa', 'lich', await moi(mX, 'lich', { tieu_de: 'Huỷ', bat_dau: '2026-11-21' }))]);
  const j = await goi(mX, '/api/xuat-viec?dang=json');
  assert.equal(j.ma, 200);
  assert.equal(j.dau['content-type'], 'application/json; charset=utf-8');
  assert.equal(j.dau['content-disposition'], 'attachment; filename="viec-mo-2026-11-13.json"');
  assert.deepEqual(j.json.viec.map(v => v.id), ids);
  assert.deepEqual(j.json.viec[0], { id: ids[0], tieu_de: 'Bình thường', han: '2026-11-14', danh_sach: null, ghi_chu: 'a,b', mach: 'cos' });
  assert.deepEqual(j.json.lich, [{ id: L1.id, tieu_de: 'Khám, răng', bat_dau: '2026-11-20T08:00', ket_thuc: '2026-11-20T09:00', ca_ngay: 0, nhac_truoc_phut: 30, dia_diem: 'Q3' }]);
  const c = await goi(mX, '/api/xuat-viec?dang=csv');
  assert.equal(c.ma, 200);
  assert.equal(c.dau['content-type'], 'text/csv; charset=utf-8');
  assert.equal(c.dau['content-disposition'], 'attachment; filename="viec-mo-2026-11-13.csv"');
  const v = (i, o) => `viec,${ids[i]},${o},${V[i][1]},,${i === 0 ? '"a,b"' : ''},cos,,,,,`;
  assert.equal(c.than, ['loai,id,tieu_de,han,danh_sach,ghi_chu,mach,bat_dau,ket_thuc,ca_ngay,nhac_truoc_phut,dia_diem',
    v(0, 'Bình thường'), v(1, "'=1+2"), v(2, '"\'-5 phút, ""gấp""\nxuống dòng"'), v(3, '"\'@lệnh\ndòng hai"'), v(4, '"\'+84 ""909"""'), v(5, "'\tthụt"), v(6, '"\'\rvề đầu"'),
    `lich,${L1.id},"Khám, răng",,,,,2026-11-20T08:00,2026-11-20T09:00,0,30,Q3`].join('\r\n') + '\r\n');
  for (const q of ['', '?dang=xml', '?dang=CSV', '?dang=csv&dang=json']) assert.equal((await goi(mX, '/api/xuat-viec' + q)).ma, 400, q);
});

test('màn chủ: không thuMucXuatVao ⇒ khối tệp chua_noi, không số; agent + token luôn chua_noi; có tệp ⇒ tot/cu/hong/thieu, trả nguyên dữ liệu; Lịch hôm nay + Nhật ký từ kho', async () => {
  const CN = { trang_thai: 'chua_noi' }, mC = await may();
  const r0 = (await goi(mC, '/api/man-chu')).json;
  assert.deepEqual(Object.keys(r0).sort(), ['agent_dang_chay', 'chi_phi_token', 'cho_anh', 'lich_hom_nay', 'nhat_ky', 'suc_khoe', 'tien_do', 'xai_duoc']);
  for (const k of ['xai_duoc', 'cho_anh', 'suc_khoe', 'tien_do', 'agent_dang_chay', 'chi_phi_token']) assert.deepEqual(r0[k], CN, k);
  assert.deepEqual(r0.nhat_ky, { trang_thai: 'tot', du_lieu: { kho: [], tong_quan: CN } });
  assert.deepEqual(r0.lich_hom_nay, { trang_thai: 'tot', du_lieu: { lich: [], viec: [], viec_bo: CN } });
  const L = await moi(mC, 'lich', { tieu_de: 'Họp', bat_dau: '2026-11-13T09:00' });
  await moi(mC, 'lich', { tieu_de: 'Hôm qua giờ VN', bat_dau: '2026-11-12T20:00' });
  const V = await moi(mC, 'viec', { tieu_de: 'Nộp hồ sơ', han: '2026-11-13T17:00' });
  await moi(mC, 'viec', { tieu_de: 'Mai', han: '2026-11-14' });
  await lam(mC, [lenh('xong', 'viec', await moi(mC, 'viec', { tieu_de: 'Xong rồi', han: '2026-11-13' }))]);
  const r1 = (await goi(mC, '/api/man-chu')).json;
  assert.deepEqual(r1.lich_hom_nay.du_lieu.lich.map(x => x.id), [L.id]);
  assert.deepEqual(r1.lich_hom_nay.du_lieu.viec.map(x => x.id), [V.id]);
  assert.deepEqual(r1.nhat_ky.du_lieu.kho.map(n => n.id), [6, 5, 4, 3, 2, 1]);
  // Có thư mục tệp xuất: dữ liệu trả nguyên (cả chuỗi giống HTML); docTepXuat so gio_dung với đồng hồ thật
  const vao = path.join(mt.tam, 'xuat-vao'), nay = new Date().toISOString();
  fs.mkdirSync(vao);
  const tt = { ...JSON.parse(fs.readFileSync(new URL('./mau/trang-thai.json', import.meta.url), 'utf8')), gio_dung: nay };
  tt.xai_duoc[0].ten = '<b>Nộp</b> bài';
  const bo = { luoc_do: 1, gio_dung: nay, viec: [
    { id: 'b1', ten: 'Đóng học phí', han: '2026-11-13', lap: null, xong: false, sua_luc: null },
    { id: 'b2', ten: 'Đã làm', han: '2026-11-13', lap: null, xong: true, sua_luc: null },
    { id: 'b3', ten: 'Hôm qua giờ VN', han: '2026-11-12', lap: null, xong: false, sua_luc: null },
    { id: 'b4', ten: 'Không hạn', han: null, lap: 'hằng tuần', xong: false, sua_luc: null }] };
  const tep = (ten, o) => fs.writeFileSync(path.join(vao, ten), typeof o === 'string' ? o : JSON.stringify(o));
  tep('trang-thai.json', tt); tep('viec-bo.json', bo);
  const mV = await may({ thuMucXuatVao: vao });
  const r2 = (await goi(mV, '/api/man-chu')).json;
  for (const k of ['xai_duoc', 'cho_anh', 'suc_khoe', 'tien_do']) assert.deepEqual(r2[k], { trang_thai: 'tot', du_lieu: tt[k], gio_dung: nay }, k);
  assert.deepEqual(r2.nhat_ky.du_lieu.tong_quan, { trang_thai: 'tot', du_lieu: tt.nhat_ky, gio_dung: nay });
  assert.deepEqual(r2.lich_hom_nay.du_lieu.viec_bo, { trang_thai: 'tot', du_lieu: [bo.viec[0]], gio_dung: nay });
  for (const k of ['agent_dang_chay', 'chi_phi_token']) assert.deepEqual(r2[k], CN, k);
  const cu = new Date(Date.now() - 4 * 3600e3).toISOString();
  tep('trang-thai.json', { ...tt, gio_dung: cu });
  assert.deepEqual((await goi(mV, '/api/man-chu')).json.suc_khoe, { trang_thai: 'cu', du_lieu: tt.suc_khoe, gio_dung: cu });
  tep('trang-thai.json', '{"luoc_do": 1');
  assert.deepEqual((await goi(mV, '/api/man-chu')).json.cho_anh, { trang_thai: 'hong', du_lieu: tt.cho_anh, gio_dung: cu });
  fs.rmSync(path.join(vao, 'viec-bo.json'));
  assert.deepEqual((await goi(mV, '/api/man-chu')).json.lich_hom_nay.du_lieu.viec_bo, { trang_thai: 'thieu', du_lieu: null, gio_dung: null });
});

test('nhật ký: 24 giờ gần nhất, mới trước, ≤ 200 dòng; tu chỉ thu hẹp (không nới quá 24 giờ); tu sai ⇒ 400', async () => {
  const mN = await may();
  try {
    const cu = await moi(mN, 'viec', { tieu_de: 'Cũ' });
    T += 23 * 3600e3;
    const gan = await moi(mN, 'viec', { tieu_de: 'Gần' });
    T += 3 * 3600e3;   // cũ: 26 giờ trước, gần: 3 giờ trước
    const nk = async q => { const r = await goi(mN, '/api/nhat-ky' + q); assert.equal(r.ma, 200, q); return r.json.nhat_ky; };
    const r = await nk('');
    assert.deepEqual(r.map(n => n.dong_id), [gan.id]);
    assert.deepEqual(r[0], { id: 2, luc: new Date(T - 3 * 3600e3).toISOString(), chu_the: 'anh', nguon: 'web', goi_id: r[0].goi_id, bang: 'viec', dong_id: gan.id, truoc: null,
      sau: { ...bang(mN.db, 'viec')[1] } });
    assert.deepEqual((await nk('?tu=2000-01-01T00:00:00.000Z')).map(n => n.dong_id), [gan.id], 'tu cũ hơn 24 giờ không nới cửa sổ');
    assert.ok(!(await nk('')).some(n => n.dong_id === cu.id));
    for (let g = 0; g < 6; g++) await lam(mN, Array.from({ length: 40 }, (_, i) => them('viec', { tieu_de: `v${g}-${i}` })));
    const day = await nk(''), lon = mN.db.prepare('SELECT max(id) AS n FROM nhat_ky').get().n;
    assert.deepEqual(day.map(n => n.id), Array.from({ length: 200 }, (_, i) => lon - i));
    T += 1000;
    const moiNhat = await moi(mN, 'viec', { tieu_de: 'Mới nhất' });
    assert.deepEqual((await nk('?tu=' + iso())).map(n => n.dong_id), [moiNhat.id]);
    for (const q of ['?tu=x', '?tu=2026-11-13', '?tu=2026-11-13T01:30:00Z', '?tu=2026-02-30T00:00:00.000Z', '?tu='])
      assert.deepEqual((await goi(mN, '/api/nhat-ky' + q)).json, { loi: 'query', chi_tiet: { truong: 'tu' } }, q);
  } finally { T = T0; }
});

test('B2 /api/viec-bo: không thuMucXuatVao ⇒ chua_noi; có mẫu ⇒ chỉ việc xong: false; query lạ ⇒ 400; vé Hub ⇒ 401', async () => {
  const m0 = await may();
  assert.deepEqual((await goi(m0, '/api/viec-bo')).json, { viec_bo: { trang_thai: 'chua_noi' } });
  const vao = path.join(mt.tam, 'xuat-viec-bo'), nay = new Date().toISOString();
  fs.mkdirSync(vao);
  const bo = { luoc_do: 1, gio_dung: nay, viec: [
    { id: 'b1', ten: 'Đóng học phí', han: '2026-11-13', lap: null, xong: false, sua_luc: null },
    { id: 'b2', ten: 'Đã làm', han: '2026-11-13', lap: null, xong: true, sua_luc: null },
    { id: 'b4', ten: 'Không hạn', han: null, lap: 'hằng tuần', xong: false, sua_luc: null }] };
  fs.writeFileSync(path.join(vao, 'viec-bo.json'), JSON.stringify(bo));
  const m1 = await may({ thuMucXuatVao: vao });
  assert.deepEqual((await goi(m1, '/api/viec-bo')).json, { viec_bo: { trang_thai: 'tot', du_lieu: [bo.viec[0], bo.viec[2]], gio_dung: nay } });
  assert.equal((await goi(m1, '/api/viec-bo?x=1')).ma, 400);
  assert.equal((await goi(m1, '/api/viec-bo', { jwt: ve({ aud: [AUD_HUB] }) })).ma, 401);
});

test('B2 /api/phien: cos_ghi theo cosGhi, ban_ghi theo ghiBat (đều boolean)', async () => {
  const phien = async o => (await goi(await may(o), '/api/phien')).json;
  assert.equal((await phien({ cosGhi: true })).cos_ghi, true);
  assert.equal((await phien({ cosGhi: false })).cos_ghi, false);
  const goc = path.join(mt.tam, 'ban-ghi'), cho = path.join(goc, 'cho'), ban = path.join(goc, 'ban-web');
  fs.mkdirSync(path.join(cho, 'ban'), { recursive: true }); fs.mkdirSync(ban);
  assert.equal((await phien({ thuMucCho: cho, uidCho: process.getuid(), thuMucBan: ban, uidBan: process.getuid() })).ban_ghi, true);
  assert.equal((await phien({})).ban_ghi, false);
});
