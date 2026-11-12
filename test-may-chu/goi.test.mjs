// Test gói ghi + Hoàn tác (task A1, ca 1–12). Mỗi ca so ẢNH kho (băm JSON) trước/sau, không chỉ so mã lỗi.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { moKho } from '../may-chu/kho.mjs';
import { apGoi, hoanTac, kiemOps, kiemQuyen, LoiGoi } from '../may-chu/goi.mjs';

let giay = 0, so = 0;
const gio = () => new Date(Date.UTC(2026, 10, 12, 1, 0, giay++)).toISOString();
const khoa = () => `khoa-${String(++so).padStart(6, '0')}`;
const WEB = { loai: 'web' }, DX = { loai: 'de_xuat' }, TIN = { loai: 'tin_anh', kenh: 'lenh', tin_id: '1234' }, TU = { loai: 'tu_chay' };
const NEO = { chu_the: 'neo', nguon: TIN };
const ghi = (db, ops, { chu_the = 'anh', nguon = WEB, khoa_lap = khoa() } = {}) => apGoi(db, { khoa_lap, chu_the, nguon, ops }, gio());
const hoan = (db, ma_hoan, { chu_the = 'anh', nguon = WEB } = {}) => hoanTac(db, { ma_hoan, chu_the, nguon }, gio());

const bam = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const MOI_BANG = ['luoc_do', 'viec', 'lich', 'cai_tien', 'y_tuong', 'tien_do', 'goi_ghi', 'nhat_ky', 'de_xuat'];
// Ảnh cả kho: mọi dòng mọi bảng (gồm goi_ghi, nhat_ky) — lệnh hỏng không được đổi một byte.
const anhKho = db => bam(MOI_BANG.map(b => db.prepare(`SELECT * FROM ${b} ORDER BY rowid`).all()));
// Ảnh NỘI DUNG: dòng còn hiện của bảng dữ liệu, bỏ phien_ban/tao_luc/sua_luc/nguoi_sua (giữ cột nội dung + xoa_luc + xong_luc).
const META = new Set(['phien_ban', 'tao_luc', 'sua_luc', 'nguoi_sua']);
const anhNoiDung = db => bam(['viec', 'lich', 'tien_do', 'cai_tien'].map(b =>
  db.prepare(`SELECT * FROM ${b} WHERE xoa_luc IS NULL ORDER BY id`).all().map(r => Object.entries(r).filter(([k]) => !META.has(k)))));
const dong = (db, bang, id) => { const r = db.prepare(`SELECT * FROM ${bang} WHERE id = ?`).get(id); return r && { ...r }; };
const dem = (db, bang) => db.prepare(`SELECT count(*) AS n FROM ${bang}`).get().n;
const nhatKy = db => db.prepare('SELECT * FROM nhat_ky ORDER BY id').all().map(r => ({ ...r }));

// Lệnh hỏng: phải ném đúng LoiGoi (không để lỗi SQLite lọt ra) và ảnh kho không đổi.
function hong(db, f, ma, loi, chi_tiet, ten = '') {
  const truoc = anhKho(db);
  assert.throws(f, e => {
    assert.ok(e instanceof LoiGoi, `${ten} không phải LoiGoi: ${e?.stack}`);
    assert.deepEqual([e.ma, e.loi], [ma, loi], ten);
    if (chi_tiet !== undefined) assert.deepEqual(e.chi_tiet, chi_tiet, ten);
    return true;
  }, `${ten}: không ném`);
  assert.equal(anhKho(db), truoc, `${ten}: kho đổi sau lệnh hỏng`);
}
// Đối chứng: lệnh được phép phải GHI (ảnh kho đổi).
function duoc(db, f) {
  const truoc = anhKho(db);
  const kq = f();
  assert.notEqual(anhKho(db), truoc, 'lệnh được phép mà không ghi');
  return kq;
}

const VIEC = { tieu_de: 'Gọi điện cho ngân hàng', han: '2026-11-20' };
const LICH = { tieu_de: 'Họp nhóm', bat_dau: '2026-11-13T09:00' };
const CT = { ngay: '2026-11-12', mach: 'cos', loai: 'quy_trinh', mon: 'brief', noi_dung: 'gộp hai bước', trang_thai: 'cho' };
const them = (bang, truong) => ({ loai: 'them', bang, truong });
const sua = (bang, r, truong) => ({ loai: 'sua', bang, id: r.id, phien_ban: r.phien_ban, truong });
const lenh = (loai, bang, r) => ({ loai, bang, id: r.id, phien_ban: r.phien_ban });
const moi = (db, bang = 'viec', truong = VIEC, o) => ghi(db, [them(bang, truong)], o).ket_qua[0];
const cu = (db, bang, id) => { const r = dong(db, bang, id); return { id: r.id, phien_ban: r.phien_ban }; };

test('1 them một việc: phien_ban 1; nhat_ky một dòng truoc null, chu_the + nguon đúng; goi_ghi giữ nguồn đủ (R8)', () => {
  const db = moKho(), luc = '2026-11-12T03:00:00.000Z';
  const kq = apGoi(db, { khoa_lap: 'them-viec-1', chu_the: 'anh', nguon: WEB, ops: [them('viec', VIEC)] }, luc);
  assert.equal(kq.lap, false);
  assert.match(kq.ma_hoan, /^[0-9a-f]{32}$/);
  const r = dong(db, 'viec', kq.ket_qua[0].id);
  assert.deepEqual(kq.ket_qua, [{ bang: 'viec', id: r.id, phien_ban: 1 }]);
  assert.deepEqual(r, { id: r.id, tieu_de: VIEC.tieu_de, han: VIEC.han, danh_sach: null, ghi_chu: null, xong_luc: null, mach: 'cos',
    nguon_gieo: null, phien_ban: 1, tao_luc: luc, sua_luc: luc, nguoi_sua: 'anh', xoa_luc: null });
  const nk = nhatKy(db);
  assert.equal(nk.length, 1);
  assert.deepEqual({ ...nk[0], sau: JSON.parse(nk[0].sau) },
    { id: 1, luc, chu_the: 'anh', nguon: 'web', goi_id: kq.goi_id, bang: 'viec', dong_id: r.id, truoc: null, sau: r });
  const g = { ...db.prepare('SELECT * FROM goi_ghi').get() };
  assert.deepEqual({ ...g, nguon: JSON.parse(g.nguon), ops: JSON.parse(g.ops), ket_qua: JSON.parse(g.ket_qua) },
    { id: kq.goi_id, khoa_lap: 'them-viec-1', chu_the: 'anh', nguon: WEB, ops: [them('viec', VIEC)], ket_qua: kq.ket_qua,
      ma_hoan: kq.ma_hoan, hoan_cua: null, hoan_luc: null, tao_luc: luc });
  // neo · tin_anh: goi_ghi.nguon = JSON đủ đối tượng; nhat_ky.nguon = nguon.loai; nguoi_sua = neo
  const kn = ghi(db, [them('viec', { tieu_de: 'Neo ghi' })], NEO);
  assert.deepEqual(JSON.parse(db.prepare('SELECT nguon FROM goi_ghi WHERE id = ?').get(kn.goi_id).nguon), TIN);
  assert.deepEqual({ ...db.prepare('SELECT chu_the, nguon FROM nhat_ky WHERE goi_id = ?').get(kn.goi_id) }, { chu_the: 'neo', nguon: 'tin_anh' });
  assert.equal(dong(db, 'viec', kn.ket_qua[0].id).nguoi_sua, 'neo');
});

test('2 cùng khoa_lap hai lần: một gói, lần hai lap:true cùng goi_id + ma_hoan; R9 khác chủ thể / thao tác ⇒ 409; UNIQUE ở SQLite', () => {
  const db = moKho();
  const a = ghi(db, [them('viec', VIEC)], { khoa_lap: 'bam-hai-lan' });
  const truoc = anhKho(db);
  const b = ghi(db, [them('viec', { han: VIEC.han, tieu_de: VIEC.tieu_de })], { khoa_lap: 'bam-hai-lan' });   // khoá đảo thứ tự: JSON chuẩn hoá vẫn khớp
  assert.deepEqual(b, { ...a, lap: true });
  assert.equal(anhKho(db), truoc);
  assert.deepEqual([dem(db, 'goi_ghi'), dem(db, 'viec')], [1, 1]);
  hong(db, () => ghi(db, [them('viec', VIEC)], { khoa_lap: 'bam-hai-lan', ...NEO }), 409, 'khoa_lap_trung');   // neo không lấy được ma_hoan của anh
  hong(db, () => ghi(db, [them('viec', { tieu_de: 'khác' })], { khoa_lap: 'bam-hai-lan' }), 409, 'khoa_lap_trung');
  assert.throws(() => db.prepare("INSERT INTO goi_ghi (id, khoa_lap, chu_the, nguon, ops, ket_qua, tao_luc) VALUES ('x', 'bam-hai-lan', 'anh', '{}', '[]', '[]', 't')").run(),
    /UNIQUE constraint failed: goi_ghi\.khoa_lap/);
});

test('3 sua kèm phien_ban cũ ⇒ 409 phien_ban, kho không đổi; dòng không có / đã xoá mềm cũng 409', () => {
  const db = moKho();
  const r = moi(db);
  const r2 = duoc(db, () => ghi(db, [sua('viec', r, { tieu_de: 'lần một' })])).ket_qua[0];
  assert.equal(r2.phien_ban, 2);
  hong(db, () => ghi(db, [sua('viec', r, { tieu_de: 'cũ' })]), 409, 'phien_ban', { bang: 'viec', id: r.id });
  hong(db, () => ghi(db, [lenh('xong', 'viec', r)]), 409, 'phien_ban', { bang: 'viec', id: r.id });
  hong(db, () => ghi(db, [sua('viec', { id: 'khong-co', phien_ban: 1 }, { tieu_de: 'x' })]), 409, 'phien_ban', { bang: 'viec', id: 'khong-co' });
  const r3 = duoc(db, () => ghi(db, [lenh('xoa', 'viec', r2)])).ket_qua[0];
  hong(db, () => ghi(db, [sua('viec', r3, { tieu_de: 'sửa dòng đã xoá' })]), 409, 'phien_ban', { bang: 'viec', id: r.id });
  hong(db, () => ghi(db, [lenh('xoa', 'viec', r3)]), 409, 'phien_ban', { bang: 'viec', id: r.id });
  const l = moi(db, 'lich', LICH);
  assert.equal(duoc(db, () => ghi(db, [sua('lich', l, { dia_diem: 'Quận 1' })])).ket_qua[0].phien_ban, 2);   // đối chứng
});

test('4 gói 3 thao tác, thao tác 3 hỏng ⇒ cả gói không ghi, goi_ghi không thêm', () => {
  const db = moKho();
  const r = moi(db), x = moi(db, 'viec', { tieu_de: 'sẽ xoá' });
  hong(db, () => ghi(db, [them('viec', { tieu_de: 'a' }), sua('viec', r, { tieu_de: 'b' }), sua('viec', r, { tieu_de: 'c' })]), 409, 'phien_ban');
  hong(db, () => ghi(db, [them('viec', { tieu_de: 'a' }), lenh('xoa', 'viec', x), them('tien_do', { doi_tuong: `viec:${x.id}` })]), 403, 'quyen');
  hong(db, () => ghi(db, [them('viec', { tieu_de: 'a', nguon_gieo: 'g1' }), them('lich', LICH), them('viec', { tieu_de: 'b', nguon_gieo: 'g1' })]),
    409, 'trung_nguon_gieo');
  assert.equal(dem(db, 'goi_ghi'), 2);
});

const V = truong => [them('viec', truong)];
const L = truong => [them('lich', { ...LICH, ...truong })];
const S = (bang, truong) => [{ loai: 'sua', bang, id: 'mot-dong', phien_ban: 1, truong }];
const X = (loai, bang, o = {}) => [{ loai, bang, id: 'mot-dong', phien_ban: 1, ...o }];
const CA_400 = [
  ['0 thao tác', []], ['41 thao tác', Array.from({ length: 41 }, () => them('viec', VIEC))], ['ops không phải mảng', { 0: them('viec', VIEC), length: 1 }],
  ['thao tác null', [null]], ['loai lạ', X('xoa_cung', 'viec')], ['loai toString', [{ loai: 'toString', bang: 'viec', truong: VIEC }]],
  ['bang lạ', [them('nhat_ky', VIEC)]], ['bang y_tuong chưa mở', [them('y_tuong', { tieu_de: 'a' })]], ['bang toString', [them('toString', VIEC)]],
  ['khoá lạ trong thao tác', [{ ...them('viec', VIEC), nguoi_sua: 'anh' }]], ['them kèm id', [{ ...them('viec', VIEC), id: 'x' }]],
  ['sua thiếu phien_ban', [{ loai: 'sua', bang: 'viec', id: 'x', truong: { tieu_de: 'a' } }]], ['xoa thiếu id', [{ loai: 'xoa', bang: 'viec', phien_ban: 1 }]],
  ['xoa kèm truong', X('xoa', 'viec', { truong: {} })], ['id rỗng', X('xoa', 'viec', { id: '' })], ['id 101 ký tự', X('xoa', 'viec', { id: 'a'.repeat(101) })],
  ['id số', X('xoa', 'viec', { id: 5 })], ['phien_ban 0', X('xoa', 'viec', { phien_ban: 0 })], ['phien_ban chuỗi', X('xoa', 'viec', { phien_ban: '1' })],
  ['phien_ban 1.5', X('xoa', 'viec', { phien_ban: 1.5 })], ['truong null', [{ loai: 'them', bang: 'viec', truong: null }]],
  ['truong mảng', [{ loai: 'them', bang: 'viec', truong: ['tieu_de'] }]], ['sua truong rỗng', S('viec', {})],
  ['trường lạ', V({ ...VIEC, la: 1 })], ['trường __proto__', V(JSON.parse('{"tieu_de":"a","__proto__":{"x":1}}'))],
  ['phien_ban trong truong', V({ ...VIEC, phien_ban: 5 })], ['id trong truong', V({ ...VIEC, id: 'x' })], ['xoa_luc trong truong', V({ ...VIEC, xoa_luc: null })],
  ['xong_luc trong truong', S('viec', { xong_luc: '2026-11-12' })], ['nguoi_sua trong truong', V({ ...VIEC, nguoi_sua: 'neo' })],
  ['tao_luc trong truong', V({ ...VIEC, tao_luc: 'x' })],
  ['tieu_de 201 ký tự', V({ tieu_de: 'a'.repeat(201) })], ['tieu_de rỗng', V({ tieu_de: '' })], ['tieu_de có NUL', V({ tieu_de: '\0abc' })],
  ['tieu_de số', V({ tieu_de: 5 })], ['thiếu tieu_de khi them', V({ han: '2026-11-20' })], ['tieu_de null khi sua', S('viec', { tieu_de: null })],
  ['mach null', V({ ...VIEC, mach: null })], ['danh_sach 201', V({ ...VIEC, danh_sach: 'a'.repeat(201) })], ['ghi_chu 2001', V({ ...VIEC, ghi_chu: 'a'.repeat(2001) })],
  ['nguon_gieo 201', V({ ...VIEC, nguon_gieo: 'a'.repeat(201) })],
  ...['+010000-01', '9999-12-31', '2026-02-30', '2026-02-29', '2026-04-31', '2026-13-01', '2026-00-10', '2026-11-00', '1999-12-31', '2101-01-01',
    '2026-11-12T24:00', '2026-11-12T09:60', '2026-11-12T09:30:00', 'x2026-11-12', '2026-1-5', '2026-11-12 09:30', 20261112, ['2026-11-12']].map(h => [`han ${h}`, V({ ...VIEC, han: h })]),
  ['lich thiếu bat_dau', [them('lich', { tieu_de: 'a' })]], ['lich bat_dau 2026-11-31', L({ bat_dau: '2026-11-31' })], ['lich ket_thuc chữ', L({ ket_thuc: 'mai' })],
  ['ca_ngay 2', L({ ca_ngay: 2 })], ['ca_ngay true', L({ ca_ngay: true })], ['ca_ngay null', L({ ca_ngay: null })],
  ['nhac 10081', L({ nhac_truoc_phut: 10081 })], ['nhac -1', L({ nhac_truoc_phut: -1 })], ['nhac 1.5', L({ nhac_truoc_phut: 1.5 })],
  ['dia_diem 201', L({ dia_diem: 'a'.repeat(201) })],
  ['tien_do thiếu doi_tuong', [them('tien_do', { phan_tram: 5 })]], ['phan_tram 101', [them('tien_do', { doi_tuong: 'viec:x', phan_tram: 101 })]],
  ['phan_tram -1', [them('tien_do', { doi_tuong: 'viec:x', phan_tram: -1 })]], ['tien_do ghi 2001', [them('tien_do', { doi_tuong: 'viec:x', ghi: 'a'.repeat(2001) })]],
  ['doi_tuong 201', [them('tien_do', { doi_tuong: 'viec:' + 'a'.repeat(196) })]],
  ['cai_tien trang_thai lạ', S('cai_tien', { trang_thai: 'xong' })], ['cai_tien noi_dung 2001', [them('cai_tien', { ...CT, noi_dung: 'a'.repeat(2001) })]],
  ['cai_tien ngay 2026-02-29', [them('cai_tien', { ...CT, ngay: '2026-02-29' })]], ['cai_tien thiếu mon', [them('cai_tien', (({ mon, ...x }) => x)(CT))]],
  ['R5 xong lich', X('xong', 'lich')], ['R5 mo_lai lich', X('mo_lai', 'lich')], ['R5 mo_lai cai_tien', X('mo_lai', 'cai_tien')], ['R5 xong tien_do', X('xong', 'tien_do')],
];
const CA_400_GOI = [
  ['khoa_lap 7 ký tự', { khoa_lap: 'a'.repeat(7) }], ['khoa_lap 101 ký tự', { khoa_lap: 'a'.repeat(101) }], ['khoa_lap có hai chấm', { khoa_lap: 'hoan:12345678' }],
  ['khoa_lap số', { khoa_lap: 123456789 }], ['khoa_lap thiếu', { khoa_lap: undefined }],
  ['nguon null', { nguon: null }], ['nguon.loai lạ', { nguon: { loai: 'discord' } }], ['nguon khoá lạ', { nguon: { loai: 'web', ve: 'x' } }],
  ['nguon.kenh 101', { nguon: { loai: 'web', kenh: 'a'.repeat(101) } }], ['nguon.tin_id số', { nguon: { loai: 'web', tin_id: 5 } }], ['nguon.kenh mảng', { nguon: { loai: 'web', kenh: ['a'] } }],
];

test('5 lược đồ sai ⇒ 400 luoc_do trước khi chạm SQLite, kho không đổi; đối chứng biên được ghi', () => {
  const db = moKho();
  moi(db);
  for (const [ten, ops] of CA_400) {
    hong(db, () => ghi(db, ops), 400, 'luoc_do', undefined, ten);
    if (Array.isArray(ops) && ops.length) assert.throws(() => kiemOps(ops), e => e instanceof LoiGoi && e.ma === 400, ten);
  }
  for (const [ten, doi] of CA_400_GOI)
    hong(db, () => apGoi(db, { khoa_lap: khoa(), chu_the: 'anh', nguon: WEB, ops: V(VIEC), ...doi }, gio()), 400, 'luoc_do', undefined, ten);
  const DUOC = [
    ['40 thao tác', Array.from({ length: 40 }, (_, i) => them('viec', { tieu_de: `v${i}` }))], ['tieu_de 1 ký tự', V({ tieu_de: 'a' })],
    ['tieu_de 200 ký tự', V({ tieu_de: 'a'.repeat(200) })], ['tieu_de 200 emoji (đếm ký tự như SQLite)', V({ tieu_de: '😀'.repeat(200) })],
    ...['2028-02-29', '2000-01-01', '2100-12-31T23:59', '2026-11-12T00:00', null].map(h => [`han ${h}`, V({ ...VIEC, han: h })]),
    ['ghi_chu 2000 + danh_sach 200 + mach', V({ ...VIEC, ghi_chu: 'a'.repeat(2000), danh_sach: 'b'.repeat(200), mach: 'learning' })],
    ['lich đủ trường biên trên', L({ ket_thuc: '2026-11-13T10:00', ca_ngay: 1, nhac_truoc_phut: 10080, dia_diem: 'a'.repeat(200) })],
    ['lich biên dưới', L({ ca_ngay: 0, nhac_truoc_phut: 0, ket_thuc: null })],
  ];
  for (const [ten, ops] of DUOC) assert.equal(duoc(db, () => ghi(db, ops)).ket_qua.length, ops.length, ten);
  duoc(db, () => apGoi(db, { khoa_lap: 'a'.repeat(8), chu_the: 'anh', nguon: { loai: 'web', kenh: 'k'.repeat(100), tin_id: 't'.repeat(100) }, ops: V(VIEC) }, gio()));
  duoc(db, () => apGoi(db, { khoa_lap: 'A_-9'.repeat(25), chu_the: 'anh', nguon: WEB, ops: V(VIEC) }, gio()));
  duoc(db, () => ghi(db, [them('cai_tien', { ...CT, noi_dung: 'a'.repeat(2000), duong: 'd'.repeat(200) })], NEO));
  // sua với trường tuỳ chọn null (xoá giá trị) được
  const r = moi(db, 'viec', { ...VIEC, ghi_chu: 'x' });
  duoc(db, () => ghi(db, [sua('viec', r, { ghi_chu: null, han: null })]));
});

test('6 hoanTac sau them / sua / xoa / xong / mo_lai ⇒ nội dung y trước gói, phien_ban gốc + 2, nhat_ky chỉ thêm', () => {
  const db = moKho();
  const r = moi(db, 'viec', { ...VIEC, ghi_chu: 'gốc', danh_sach: 'nhà' });
  const l = moi(db, 'lich', { ...LICH, dia_diem: 'Q1', nhac_truoc_phut: 15 });
  const c = moi(db, 'cai_tien', CT, NEO);
  const CA = [
    ['sua viec', 'viec', r.id, x => sua('viec', x, { tieu_de: 'đổi', ghi_chu: null, han: '2026-12-01T08:30' })],
    ['xoa viec', 'viec', r.id, x => lenh('xoa', 'viec', x)],
    ['xong viec', 'viec', r.id, x => lenh('xong', 'viec', x)],
    ['sua lich', 'lich', l.id, x => sua('lich', x, { dia_diem: null, ca_ngay: 1, bat_dau: '2026-11-14' })],
    ['xoa lich', 'lich', l.id, x => lenh('xoa', 'lich', x)],
    ['sua cai_tien', 'cai_tien', c.id, x => sua('cai_tien', x, { trang_thai: 'da_nhap' })],
  ];
  const CU = { viec: { tieu_de: 'lệnh cũ' }, lich: { tieu_de: 'lệnh cũ' }, cai_tien: { trang_thai: 'bo' } };
  for (const [ten, bang, id, taoOp] of CA) {
    const hien = cu(db, bang, id), noiDung = anhNoiDung(db), nk = nhatKy(db);
    const g = ghi(db, [taoOp(hien)]);
    assert.notEqual(anhNoiDung(db), noiDung, ten);
    const h = hoan(db, g.ma_hoan);
    assert.equal(anhNoiDung(db), noiDung, ten);
    assert.equal(dong(db, bang, id).phien_ban, hien.phien_ban + 2, ten);
    const nk2 = nhatKy(db);
    assert.deepEqual(nk2.slice(0, nk.length), nk, ten);
    assert.deepEqual(nk2.slice(nk.length).map(x => x.goi_id), [g.goi_id, h.goi_id], ten);
    hong(db, () => ghi(db, [sua(bang, hien, CU[bang])]), 409, 'phien_ban', undefined, ten);
    hong(db, () => ghi(db, [sua(bang, { id, phien_ban: hien.phien_ban + 1 }, CU[bang])]), 409, 'phien_ban', undefined, ten);
    const gg = { ...db.prepare('SELECT * FROM goi_ghi WHERE id = ?').get(h.goi_id) };
    assert.deepEqual([gg.hoan_cua, gg.ma_hoan, gg.chu_the], [g.goi_id, null, 'anh'], ten);
    assert.notEqual(db.prepare('SELECT hoan_luc FROM goi_ghi WHERE id = ?').get(g.goi_id).hoan_luc, null, ten);
  }
  // mo_lai: xong_luc trả về giờ đánh xong cũ
  ghi(db, [lenh('xong', 'viec', cu(db, 'viec', r.id))]);
  const xong = dong(db, 'viec', r.id), noiDung = anhNoiDung(db);
  const gm = ghi(db, [lenh('mo_lai', 'viec', xong)]);
  assert.equal(dong(db, 'viec', r.id).xong_luc, null);
  hoan(db, gm.ma_hoan);
  assert.equal(anhNoiDung(db), noiDung);
  assert.equal(dong(db, 'viec', r.id).xong_luc, xong.xong_luc);
  // them: Hoàn tác = xoá mềm (R10), dòng vẫn còn trong bảng, phien_ban 2
  const nd = anhNoiDung(db);
  const gt = ghi(db, [them('viec', { tieu_de: 'mới' }), them('lich', LICH)]);
  hoan(db, gt.ma_hoan);
  assert.equal(anhNoiDung(db), nd);
  for (const k of gt.ket_qua) {
    const x = dong(db, k.bang, k.id);
    assert.ok(x, 'Hoàn tác them phải xoá mềm, không xoá cứng');
    assert.equal(x.phien_ban, 2);
    assert.notEqual(x.xoa_luc, null);
  }
  // gói sua hai lần cùng một dòng ⇒ về nội dung trước lần ĐẦU (so phien_ban lần CUỐI)
  const h0 = cu(db, 'viec', r.id), nd0 = anhNoiDung(db);
  const g2 = ghi(db, [sua('viec', h0, { tieu_de: 'một' }), sua('viec', { id: r.id, phien_ban: h0.phien_ban + 1 }, { tieu_de: 'hai', ghi_chu: 'x' })]);
  hoan(db, g2.ma_hoan);
  assert.equal(anhNoiDung(db), nd0);
  assert.equal(dong(db, 'viec', r.id).phien_ban, h0.phien_ban + 3);
});

test('7 sua rồi sua tiếp rồi hoanTac gói đầu ⇒ 409 da_sua_sau, kho không đổi', () => {
  const db = moKho();
  const r = moi(db);
  const g1 = ghi(db, [sua('viec', r, { tieu_de: 'một' })]);
  ghi(db, [sua('viec', g1.ket_qua[0], { tieu_de: 'hai' })]);
  hong(db, () => hoan(db, g1.ma_hoan), 409, 'da_sua_sau', { bang: 'viec', id: r.id });
  const gt = ghi(db, [them('viec', { tieu_de: 'mới' })]);
  ghi(db, [lenh('xong', 'viec', gt.ket_qua[0])]);
  hong(db, () => hoan(db, gt.ma_hoan), 409, 'da_sua_sau');
});

test('8 hoanTac hai lần ⇒ 409 da_hoan; mã lạ ⇒ 404; neo chỉ hoàn gói của neo; tu_chay không hoàn', () => {
  const db = moKho();
  const r = moi(db);
  const g = ghi(db, [sua('viec', r, { tieu_de: 'một' })]);
  hoan(db, g.ma_hoan);
  const luc = db.prepare('SELECT hoan_luc FROM goi_ghi WHERE id = ?').get(g.goi_id).hoan_luc;
  hong(db, () => hoan(db, g.ma_hoan), 409, 'da_hoan');
  assert.equal(db.prepare('SELECT hoan_luc FROM goi_ghi WHERE id = ?').get(g.goi_id).hoan_luc, luc);
  hong(db, () => hoan(db, 'f'.repeat(32)), 404, 'khong_co');
  hong(db, () => hoan(db, undefined), 404, 'khong_co');
  const ga = ghi(db, [them('viec', { tieu_de: 'của anh' })]);
  hong(db, () => hoan(db, ga.ma_hoan, NEO), 403, 'quyen');
  hong(db, () => hoan(db, ga.ma_hoan, { nguon: { loai: 'web', ve: 'x' } }), 400, 'luoc_do');
  const gn = ghi(db, [them('viec', { tieu_de: 'của neo' })], NEO);
  hong(db, () => hoan(db, gn.ma_hoan, { chu_the: 'neo', nguon: TU }), 403, 'quyen');
  hong(db, () => hoan(db, gn.ma_hoan, { chu_the: 'khach', nguon: WEB }), 403, 'quyen');
  hong(db, () => hoan(db, gn.ma_hoan, { chu_the: 'anh', nguon: TU }), 403, 'quyen');
  duoc(db, () => hoan(db, gn.ma_hoan, NEO));   // đối chứng: neo hoàn gói của neo
  assert.equal(db.prepare('SELECT chu_the FROM goi_ghi WHERE hoan_cua = ?').get(gn.goi_id).chu_the, 'neo');
  duoc(db, () => hoan(db, ga.ma_hoan));   // anh hoàn gói của anh
  const gn2 = ghi(db, [them('viec', { tieu_de: 'của neo 2' })], NEO);
  duoc(db, () => hoan(db, gn2.ma_hoan, { nguon: DX }));   // anh hoàn gói của neo
});

test('9 UPDATE / DELETE nhat_ky thẳng ⇒ nhat_ky_chi_them', () => {
  const db = moKho();
  moi(db);
  const truoc = anhKho(db);
  assert.throws(() => db.exec("UPDATE nhat_ky SET chu_the = 'neo'"), /nhat_ky_chi_them/);
  assert.throws(() => db.exec('DELETE FROM nhat_ky'), /nhat_ky_chi_them/);
  assert.equal(anhKho(db), truoc);
});

test('10 kiemQuyen: mỗi ô «không» và thao tác ngoài ô ⇒ 403, kho không đổi; đối chứng chủ thể được phép ⇒ ghi', () => {
  const db = moKho();
  const v = moi(db), l = moi(db, 'lich', LICH), c = moi(db, 'cai_tien', CT, NEO);
  const t = moi(db, 'tien_do', { doi_tuong: `viec:${v.id}`, phan_tram: 10 });
  const ANH_DX = { nguon: DX };
  const KHONG = [
    ['anh them cai_tien', {}, () => them('cai_tien', CT)],
    ['anh xoa cai_tien', {}, () => lenh('xoa', 'cai_tien', cu(db, 'cai_tien', c.id))],
    ['anh sua noi_dung cai_tien', {}, () => sua('cai_tien', cu(db, 'cai_tien', c.id), { noi_dung: 'đổi' })],
    ['anh sua trang_thai + noi_dung cai_tien', {}, () => sua('cai_tien', cu(db, 'cai_tien', c.id), { trang_thai: 'bo', noi_dung: 'đổi' })],
    ['anh xoa tien_do', {}, () => lenh('xoa', 'tien_do', cu(db, 'tien_do', t.id))],
    ['anh · de_xuat them cai_tien', ANH_DX, () => them('cai_tien', CT)],
    ['neo xoa viec', NEO, () => lenh('xoa', 'viec', cu(db, 'viec', v.id))],
    ['neo xoa lich', NEO, () => lenh('xoa', 'lich', cu(db, 'lich', l.id))],
    ['neo them tien_do', NEO, () => them('tien_do', { doi_tuong: `viec:${v.id}` })],
    ['neo sua tien_do', NEO, () => sua('tien_do', cu(db, 'tien_do', t.id), { phan_tram: 20 })],
    ['neo sua cai_tien', NEO, () => sua('cai_tien', cu(db, 'cai_tien', c.id), { trang_thai: 'bo' })],
    ['neo xoa cai_tien', NEO, () => lenh('xoa', 'cai_tien', cu(db, 'cai_tien', c.id))],
    ...[['viec', VIEC], ['lich', LICH], ['tien_do', { doi_tuong: `viec:${v.id}` }], ['cai_tien', CT]]
      .map(([b, tr]) => [`tu_chay them ${b}`, { chu_the: 'neo', nguon: TU }, () => them(b, tr)]),
    ['tu_chay sua viec', { chu_the: 'neo', nguon: TU }, () => sua('viec', cu(db, 'viec', v.id), { tieu_de: 'x' })],
    ['anh · tin_anh', { nguon: TIN }, () => them('viec', VIEC)], ['anh · tu_chay', { nguon: TU }, () => them('viec', VIEC)],
    ['neo · web', { chu_the: 'neo', nguon: WEB }, () => them('viec', VIEC)], ['neo · de_xuat', { chu_the: 'neo', nguon: DX }, () => them('viec', VIEC)],
    ['chủ thể lạ', { chu_the: 'khach' }, () => them('viec', VIEC)], ['chủ thể toString', { chu_the: 'toString' }, () => them('viec', VIEC)],
  ];
  for (const [ten, o, op] of KHONG) {
    const x = op();
    hong(db, () => ghi(db, [x], o), 403, 'quyen', { bang: x.bang, loai: x.loai }, ten);
  }
  hong(db, () => ghi(db, [them('viec', VIEC), lenh('xoa', 'viec', cu(db, 'viec', v.id))], NEO), 403, 'quyen', { bang: 'viec', loai: 'xoa' });   // gói trộn
  assert.throws(() => kiemQuyen('neo', TU, [them('viec', VIEC)]), e => e instanceof LoiGoi && e.ma === 403);
  const CO = [
    ...['anh', 'anh · de_xuat'].flatMap(ai => {
      const o = ai === 'anh' ? {} : ANH_DX;
      return [
        [`${ai} them viec`, o, () => them('viec', VIEC)], [`${ai} sua viec`, o, () => sua('viec', cu(db, 'viec', v.id), { ghi_chu: ai })],
        [`${ai} xong viec`, o, () => lenh('xong', 'viec', cu(db, 'viec', v.id))], [`${ai} mo_lai viec`, o, () => lenh('mo_lai', 'viec', cu(db, 'viec', v.id))],
        [`${ai} them lich`, o, () => them('lich', LICH)], [`${ai} sua lich`, o, () => sua('lich', cu(db, 'lich', l.id), { dia_diem: ai })],
        [`${ai} them tien_do`, o, () => them('tien_do', { doi_tuong: `viec:${v.id}` })],
        [`${ai} sua tien_do`, o, () => sua('tien_do', cu(db, 'tien_do', t.id), { phan_tram: ai === 'anh' ? 30 : 40 })],
        [`${ai} sua trang_thai cai_tien`, o, () => sua('cai_tien', cu(db, 'cai_tien', c.id), { trang_thai: ai === 'anh' ? 'da_nhap' : 'bo' })],
      ];
    }),
    ['neo them viec', NEO, () => them('viec', VIEC)], ['neo sua viec', NEO, () => sua('viec', cu(db, 'viec', v.id), { ghi_chu: 'neo' })],
    ['neo xong viec', NEO, () => lenh('xong', 'viec', cu(db, 'viec', v.id))], ['neo mo_lai viec', NEO, () => lenh('mo_lai', 'viec', cu(db, 'viec', v.id))],
    ['neo them lich', NEO, () => them('lich', LICH)], ['neo sua lich', NEO, () => sua('lich', cu(db, 'lich', l.id), { dia_diem: 'neo' })],
    ['neo them cai_tien', NEO, () => them('cai_tien', CT)],
    ['anh xoa lich', {}, () => lenh('xoa', 'lich', cu(db, 'lich', l.id))], ['anh xoa viec', {}, () => lenh('xoa', 'viec', cu(db, 'viec', v.id))],
  ];
  for (const [ten, o, op] of CO) assert.equal(duoc(db, () => ghi(db, [op()], o)).ket_qua.length, 1, ten);
});

test('11 cùng nguon_gieo ⇒ một dòng, gói hai 409 trung_nguon_gieo; nguon_gieo null nhiều dòng được', () => {
  const db = moKho();
  const GIEO = { tieu_de: 'Bước 1', mach: 'learning', nguon_gieo: 'ban-do/learning.md#Bước 1' };
  duoc(db, () => ghi(db, [them('viec', GIEO)]));
  hong(db, () => ghi(db, [them('viec', GIEO)]), 409, 'trung_nguon_gieo');
  hong(db, () => ghi(db, [them('viec', { ...GIEO, tieu_de: 'khác' })], NEO), 409, 'trung_nguon_gieo');
  const r = moi(db);
  hong(db, () => ghi(db, [sua('viec', r, { nguon_gieo: GIEO.nguon_gieo })]), 409, 'trung_nguon_gieo');
  assert.equal(db.prepare('SELECT count(*) AS n FROM viec WHERE nguon_gieo = ?').get(GIEO.nguon_gieo).n, 1);
  duoc(db, () => ghi(db, [them('viec', { tieu_de: 'a' }), them('viec', { tieu_de: 'b', nguon_gieo: null })]));
  assert.equal(db.prepare('SELECT count(*) AS n FROM viec WHERE nguon_gieo IS NULL').get().n, 3);
  duoc(db, () => ghi(db, [them('viec', { ...GIEO, nguon_gieo: 'ban-do/learning.md#Bước 2' })]));
});

test('12 tien_do: doi_tuong phải là viec:<id> còn hiện, kiểm TRONG giao dịch ⇒ 403, kho không đổi (R6)', () => {
  const db = moKho();
  const v = moi(db), v2 = moi(db), v3 = moi(db);
  const t = duoc(db, () => ghi(db, [them('tien_do', { doi_tuong: `viec:${v.id}`, phan_tram: 0, ghi: 'a'.repeat(2000) })])).ket_qua[0];   // đối chứng
  duoc(db, () => ghi(db, [them('tien_do', { doi_tuong: `viec:${v.id}`, phan_tram: 100 })]));
  for (const d of ['viec:khong-co', `y_tuong:${v.id}`, `xviec:${v.id}`, 'viec:', `viec:${v.id}\n`, v.id])
    hong(db, () => ghi(db, [them('tien_do', { doi_tuong: d })]), 403, 'quyen', { bang: 'tien_do', loai: 'them' });
  ghi(db, [lenh('xoa', 'viec', v2)]);
  hong(db, () => ghi(db, [them('tien_do', { doi_tuong: `viec:${v2.id}` })]), 403, 'quyen', { bang: 'tien_do', loai: 'them' });
  hong(db, () => ghi(db, [sua('tien_do', t, { doi_tuong: `viec:${v2.id}` })]), 403, 'quyen', { bang: 'tien_do', loai: 'sua' });
  // xoá việc rồi gắn tiến độ vào nó TRONG CÙNG gói ⇒ 403 (kiểm thấy thao tác trước trong giao dịch)
  hong(db, () => ghi(db, [lenh('xoa', 'viec', v3), them('tien_do', { doi_tuong: `viec:${v3.id}` })]), 403, 'quyen', { bang: 'tien_do', loai: 'them' });
  const t2 = duoc(db, () => ghi(db, [sua('tien_do', t, { phan_tram: 50 })])).ket_qua[0];   // đối chứng sua: việc còn hiện
  duoc(db, () => ghi(db, [sua('tien_do', t2, { doi_tuong: `viec:${v3.id}` })]));
  ghi(db, [lenh('xoa', 'viec', cu(db, 'viec', v3.id))]);
  hong(db, () => ghi(db, [sua('tien_do', cu(db, 'tien_do', t.id), { phan_tram: 60 })]), 403, 'quyen', { bang: 'tien_do', loai: 'sua' });
});
