// Test kernel.sock (task A4; thiết kế v0.2 mục 3 dòng 9/9b, mục 4, 5.3): cổng Neo (Hermes Kernel) đọc/ghi kho.
// Khung 4 byte độ dài big-endian + JSON ≤ 64 KiB, MỘT kết nối = MỘT khung = MỘT thao tác, chủ thể LUÔN neo. Mọi ca đi qua socket thật.
// Đồng hồ giả (dongHo): hẹn 5 s của kernel không tự bắn, test bắn tay; sao lưu không bao giờ bắn.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { createHash, randomUUID } from 'node:crypto';
import { DAU_GHI, moiTruong, goi } from './chung.mjs';

const mt = moiTruong();
const T0 = Date.parse('2026-11-12T03:00:00Z');
const hen = new Set();
const dongHo = { now: () => T0, setTimeout: (f, ms) => { const h = { f, ms }; hen.add(h); return h; }, clearTimeout: h => hen.delete(h) };
let m, mTat;   // cosGhi: true / false
before(async () => { m = await mt.may({ cosGhi: true }, [], { dongHo }); mTat = await mt.may({ cosGhi: false }, [], { dongHo }); });
after(() => mt.dong());

const bam = o => createHash('sha256').update(JSON.stringify(o)).digest('hex');
const bang = (db, b) => db.prepare(`SELECT * FROM ${b} ORDER BY rowid`).all().map(r => ({ ...r }));
const anhKho = db => bam(['viec', 'lich', 'cai_tien', 'y_tuong', 'tien_do', 'goi_ghi', 'nhat_ky', 'de_xuat'].map(b => bang(db, b)));
const dem = (db, b) => db.prepare(`SELECT count(*) AS n FROM ${b}`).get().n;
const motDong = (db, b, id) => ({ ...db.prepare(`SELECT * FROM ${b} WHERE id = ?`).get(id) });
const CT = { ngay: '2026-11-12', mach: 'cos', loai: 'quy_trinh', mon: 'brief', noi_dung: 'gộp hai bước', trang_thai: 'cho' };

const TIN = (tin_id = randomUUID()) => ({ loai: 'tin_anh', kenh: 'lenh', tin_id });
const TU = (tin_id = randomUUID()) => ({ loai: 'tu_chay', kenh: 'ke-hoach-tuan', tin_id });
const lenh = (op, thao_tac, nguon = TIN()) => ({ op, nguon, ...(thao_tac === undefined ? {} : { thao_tac }) });
const khung = o => { const j = Buffer.isBuffer(o) ? o : Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)), l = Buffer.alloc(4); l.writeUInt32BE(j.length); return Buffer.concat([l, j]); };

// Gửi byte thô, gom trả lời tới khi máy chủ đóng. Máy chủ không đóng trong `ms` ⇒ null (test hỏng thay vì treo).
function guiTho(may_, buf, ms = 3000) {
  return new Promise(ok => {
    const c = net.createConnection(may_.ngheKernel), b = [];
    const t = setTimeout(() => { c.destroy(); ok(null); }, ms);
    c.on('connect', () => c.write(buf));
    c.on('data', d => b.push(d));
    c.on('error', () => {});   // máy chủ huỷ lúc đang ghi ⇒ EPIPE/ECONNRESET: vẫn là «đóng»
    c.on('close', () => { clearTimeout(t); ok(Buffer.concat(b)); });
  });
}
async function ker(may_, o) {
  const ra = await guiTho(may_, Buffer.isBuffer(o) ? o : khung(o));
  assert.ok(ra, 'máy chủ không đóng kết nối');
  assert.equal(ra.readUInt32BE(0), ra.length - 4, 'khung trả lời: 4 byte độ dài + JSON, một khung');
  return JSON.parse(ra.subarray(4));
}
async function cho(dk, ten, ms = 2000) {
  const het = Date.now() + ms;
  while (!dk()) { if (Date.now() > het) assert.fail('hết giờ chờ: ' + ten); await new Promise(r => setTimeout(r, 5)); }
}

const GHI = ['viec_them', 'viec_sua', 'viec_xong', 'viec_mo_lai', 'lich_them', 'lich_sua', 'cai_tien_them', 'de_xuat_tao', 'xoa_de_xuat', 'hoan'];
// thao_tac đúng khuôn cho mọi op ghi (giá trị không cần trỏ dòng thật: cổng chặn trước khi chạm kho)
const TT_MAU = {
  viec_them: { truong: { tieu_de: 'x' } }, viec_sua: { id: 'x', phien_ban: 1, truong: { tieu_de: 'x' } }, viec_xong: { id: 'x', phien_ban: 1 },
  viec_mo_lai: { id: 'x', phien_ban: 1 }, lich_them: { truong: { tieu_de: 'x', bat_dau: '2026-11-14' } }, lich_sua: { id: 'x', phien_ban: 1, truong: { tieu_de: 'x' } },
  cai_tien_them: { truong: CT }, de_xuat_tao: { mach: 'cos', noi_dung: 'x', ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'x' } }] },
  xoa_de_xuat: { bang: 'viec', id: 'x' }, hoan: { ma_hoan: 'x' },
};

test('khung > 64 KiB (hay độ dài khai khống) ⇒ huỷ, không trả, không ghi; đối chứng: đúng 64 KiB ⇒ ghi', async () => {
  const daiN = n => { const j = JSON.stringify(lenh('viec_them', { truong: { tieu_de: 'Khung lớn' } }, TIN('lon-' + n))); return j + ' '.repeat(n - Buffer.byteLength(j)); };
  const truoc = anhKho(m.db);
  assert.deepEqual(await guiTho(m, khung(daiN(64 * 1024 + 1))), Buffer.alloc(0));
  const h = Buffer.alloc(4); h.writeUInt32BE(0xffffffff);
  assert.deepEqual(await guiTho(m, Buffer.concat([h, Buffer.from('{}')])), Buffer.alloc(0), 'khai 4 GiB ⇒ huỷ ngay, không chờ');
  assert.equal(anhKho(m.db), truoc);
  const r = await ker(m, khung(daiN(64 * 1024)));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(motDong(m.db, 'viec', r.ket_qua[0].id).tieu_de, 'Khung lớn');
});

test('khung không về đủ trong 5 s ⇒ huỷ, không trả; đối chứng: khung đủ ⇒ trả lời và gỡ hẹn', async () => {
  const cu = new Set(hen), moi = () => [...hen].filter(h => !cu.has(h));
  const c = net.createConnection(m.ngheKernel), b = [];
  let dong = false;
  c.on('data', d => b.push(d)); c.on('error', () => {}); c.on('close', () => { dong = true; });
  c.on('connect', () => c.write(Buffer.from([0, 0, 0])));
  await cho(() => moi().length === 1, 'hẹn của kết nối');
  const [h] = moi();
  assert.equal(h.ms, 5000);
  h.f();
  await cho(() => dong, 'máy chủ huỷ kết nối khi hết hẹn');
  assert.equal(b.length, 0);
  // đối chứng
  const r = await ker(m, lenh('doc_viec', {}));
  assert.equal(r.ok, true);
  await cho(() => moi().length === 0, 'hẹn của kết nối đã trả lời được gỡ');
});

test('byte thừa sau khung bị bỏ: một trả lời, chỉ khung đầu được chạy', async () => {
  const truoc = dem(m.db, 'viec');
  const r = await ker(m, Buffer.concat([khung(lenh('viec_them', { truong: { tieu_de: 'Khung đầu' } })), khung(lenh('viec_them', { truong: { tieu_de: 'Khung thừa' } }))]));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(dem(m.db, 'viec'), truoc + 1);
});

test('JSON hỏng / UTF-8 hỏng ⇒ json; JSON không phải object ⇒ khung; kho không đổi', async () => {
  const truoc = anhKho(m.db);
  // 0xff NẰM TRONG chuỗi JSON của một lệnh ghi hợp lệ: giải mã lỏng sẽ thành U+FFFD và ghi việc.
  const goc = Buffer.from(JSON.stringify(lenh('viec_them', { truong: { tieu_de: '' } }))), i = goc.indexOf('"tieu_de":"') + 11;
  const utf8 = Buffer.concat([goc.subarray(0, i), Buffer.from([0xff]), goc.subarray(i)]);
  for (const tho of ['{', '{"op":', Buffer.from([0x7b, 0xff, 0x7d]), utf8]) assert.deepEqual(await ker(m, khung(tho)), { ok: false, loi: 'json' }, String(tho));
  for (const tho of ['[1]', 'null', '1', '"viec_them"']) assert.deepEqual(await ker(m, khung(tho)), { ok: false, loi: 'khung' }, tho);
  assert.equal(anhKho(m.db), truoc);
});

test('op lạ / op: "goi" / op: "viec_xoa" / op không phải chuỗi / op kế thừa ⇒ op_la, kho không đổi; đối chứng: viec_them ⇒ ghi', async () => {
  const truoc = anhKho(m.db);
  const ops = [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'gói nhiều' } }];
  for (const op of ['goi', 'viec_xoa', 'lich_xoa', 'xoa', 'khong_co', 'toString', '__proto__', 'hasOwnProperty', 1, null, ['viec_them'], { op: 'viec_them' }])
    assert.deepEqual(await ker(m, { op, nguon: TIN(), thao_tac: { ops } }), { ok: false, loi: 'op_la' }, JSON.stringify(op));
  assert.deepEqual(await ker(m, { nguon: TIN(), thao_tac: { ops } }), { ok: false, loi: 'op_la' }, 'thiếu op');
  assert.equal(anhKho(m.db), truoc);
  assert.equal((await ker(m, lenh('viec_them', { truong: { tieu_de: 'đối chứng op' } }))).ok, true);
});

test('khung khoá ĐÓNG: chu_the: "anh" (hay khoá lạ khác) ⇒ khung, kho không đổi; đối chứng: bỏ khoá lạ ⇒ ghi, chủ thể neo ở dòng, gói, nhật ký', async () => {
  const goc = lenh('viec_them', { truong: { tieu_de: 'Neo ghi' } }, TIN('chu-the-1'));
  const truoc = anhKho(m.db);
  for (const la of [{ chu_the: 'anh' }, { chu_the: 'neo' }, { khoa_lap: 'tu-chon-khoa-01' }, { ve: 'x' }, { ops: [] }])
    assert.deepEqual(await ker(m, { ...goc, ...la }), { ok: false, loi: 'khung' }, JSON.stringify(la));
  assert.equal(anhKho(m.db), truoc);
  const r = await ker(m, goc);
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(Object.keys(r).sort(), ['goi_id', 'ket_qua', 'lap', 'ma_hoan', 'ok']);
  assert.equal(motDong(m.db, 'viec', r.ket_qua[0].id).nguoi_sua, 'neo');
  const g = motDong(m.db, 'goi_ghi', r.goi_id);
  assert.equal(g.chu_the, 'neo');
  assert.deepEqual(JSON.parse(g.nguon), { loai: 'tin_anh', kenh: 'lenh', tin_id: 'chu-the-1' });
  assert.deepEqual(m.db.prepare('SELECT chu_the, nguon FROM nhat_ky WHERE goi_id = ?').all(r.goi_id).map(n => ({ ...n })), [{ chu_the: 'neo', nguon: 'tin_anh' }]);
});

test('nguon khoá đóng { loai: tin_anh|tu_chay, kenh, tin_id }: kenh/tin_id chuỗi 1–100, bắt buộc với op ghi ⇒ sai thì nguon; đối chứng: op đọc không cần kenh', async () => {
  const truoc = anhKho(m.db), tt = TT_MAU.viec_them;
  const sai = [
    undefined, null, 'tin_anh', [], {}, { loai: 'web', kenh: 'a', tin_id: 'b' }, { loai: 'de_xuat', kenh: 'a', tin_id: 'b' }, { loai: 'anh', kenh: 'a', tin_id: 'b' },
    { loai: 'tin_anh', kenh: 'a', tin_id: 'b', chu_the: 'anh' }, { loai: 'tin_anh', tin_id: 'b' }, { loai: 'tin_anh', kenh: 'a' },
    { loai: 'tin_anh', kenh: '', tin_id: 'b' }, { loai: 'tin_anh', kenh: 'a', tin_id: '' }, { loai: 'tin_anh', kenh: 'a'.repeat(101), tin_id: 'b' },
    { loai: 'tin_anh', kenh: 'a', tin_id: 'b'.repeat(101) }, { loai: 'tin_anh', kenh: 1, tin_id: 'b' }, { loai: 'tin_anh', kenh: 'a', tin_id: 2 }, { loai: 'tin_anh', kenh: ['a'], tin_id: 'b' },
  ];
  for (const nguon of sai) assert.equal((await ker(m, { op: 'viec_them', ...(nguon === undefined ? {} : { nguon }), thao_tac: tt })).loi, 'nguon', JSON.stringify(nguon));
  for (const nguon of [{ loai: 'tu_chay', kenh: '' }, { loai: 'tin_anh', tin_id: 'b'.repeat(101) }]) assert.equal((await ker(m, lenh('doc_viec', {}, nguon))).loi, 'nguon', JSON.stringify(nguon));
  assert.equal(anhKho(m.db), truoc);
  assert.equal((await ker(m, lenh('viec_them', tt, { loai: 'tin_anh', kenh: 'a'.repeat(100), tin_id: 'b'.repeat(100) }))).ok, true, 'đúng 100 ký tự');
  assert.equal((await ker(m, lenh('doc_viec', {}, { loai: 'tu_chay' }))).ok, true);
  assert.equal((await ker(m, lenh('doc_viec', undefined, { loai: 'tin_anh' }))).ok, true, 'op đọc không thao_tac');
});

test('thao_tac khoá đóng theo từng op ⇒ khung, kho không đổi', async () => {
  const truoc = anhKho(m.db);
  const sai = [
    ['viec_them', { truong: { tieu_de: 'x' }, bang: 'lich' }], ['viec_them', { truong: { tieu_de: 'x' }, loai: 'xoa' }], ['viec_xong', { id: 'x', phien_ban: 1, truong: { tieu_de: 'x' } }],
    ['viec_sua', { id: 'x', phien_ban: 1, truong: { tieu_de: 'x' }, chu_the: 'anh' }], ['xoa_de_xuat', { bang: 'viec', id: 'x', phien_ban: 1 }], ['hoan', { ma_hoan: 'x', chu_the: 'anh' }],
    ['de_xuat_tao', { mach: 'cos', noi_dung: 'x', ops: [], chu_the: 'anh' }], ['doc_cai_tien', { x: 1 }], ['doc_viec', { xoa: true }], ['doc_lich', { tu: '2026-11-01', den: '2026-11-02', mach: 'x' }],
    ['viec_them', [{ truong: { tieu_de: 'x' } }]], ['viec_them', null], ['viec_them', 'x'],
  ];
  for (const [op, tt] of sai) assert.equal((await ker(m, { op, nguon: TIN(), thao_tac: tt })).loi, 'khung', op + ' ' + JSON.stringify(tt));
  assert.equal(anhKho(m.db), truoc);
});

test('tu_chay + MỖI op ghi (cả hoan, xoa_de_xuat) ⇒ tu_chay_chi_de_xuat, kho không đổi; đối chứng: cùng thao_tac với tin_anh ⇒ ghi', async () => {
  const da = [];
  const thu = async (op, tt) => {
    da.push(op);
    const truoc = anhKho(m.db);
    assert.deepEqual(await ker(m, lenh(op, tt, TU())), { ok: false, loi: 'tu_chay_chi_de_xuat' }, op);
    assert.equal(anhKho(m.db), truoc, op);
    const r = await ker(m, lenh(op, tt));
    assert.equal(r.ok, true, op + ' ' + JSON.stringify(r));
    assert.notEqual(anhKho(m.db), truoc, op + ': đối chứng phải ghi');
    return r;
  };
  const v = (await thu('viec_them', { truong: { tieu_de: 'Việc của Neo' } })).ket_qua[0];
  await thu('viec_sua', { id: v.id, phien_ban: 1, truong: { tieu_de: 'Việc của Neo (sửa)' } });
  await thu('viec_xong', { id: v.id, phien_ban: 2 });
  await thu('viec_mo_lai', { id: v.id, phien_ban: 3 });
  const l = (await thu('lich_them', { truong: { tieu_de: 'Họp', bat_dau: '2026-11-14T09:00' } })).ket_qua[0];
  await thu('lich_sua', { id: l.id, phien_ban: 1, truong: { dia_diem: 'Phòng 2' } });
  const ct = await thu('cai_tien_them', { truong: CT });
  await thu('xoa_de_xuat', { bang: 'viec', id: v.id });
  await thu('hoan', { ma_hoan: ct.ma_hoan });
  assert.deepEqual(da.sort(), GHI.filter(op => op !== 'de_xuat_tao').sort(), 'phủ mọi op ghi trừ de_xuat_tao');
  const cv = motDong(m.db, 'viec', v.id);
  assert.deepEqual([cv.tieu_de, cv.xong_luc, cv.phien_ban, cv.xoa_luc], ['Việc của Neo (sửa)', null, 4, null]);
});

test('de_xuat_tao từ tu_chay ⇒ có dòng de_xuat của neo, viec/lich không đổi; gửi lại ⇒ cùng id (R12); đối chứng: ops khác / mach khác / đề xuất đã bỏ qua ⇒ dòng mới', async () => {
  const ops = [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Ôn bài', han: '2026-11-16' } }];
  const truoc = [bang(m.db, 'viec'), bang(m.db, 'lich')], soDx = dem(m.db, 'de_xuat');
  const r = await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'Kế hoạch tuần', ops }, TU()));
  assert.deepEqual(Object.keys(r).sort(), ['id', 'lap', 'ok']);
  assert.deepEqual([r.ok, r.lap], [true, false]);
  const dx = motDong(m.db, 'de_xuat', r.id);
  assert.deepEqual([dx.chu_the, dx.trang_thai, dx.mach, dx.noi_dung, JSON.parse(dx.ops)], ['neo', 'cho', 'cos', 'Kế hoạch tuần', ops]);
  assert.deepEqual([bang(m.db, 'viec'), bang(m.db, 'lich')], truoc);
  const lai = await ker(m, lenh('de_xuat_tao', { ops: [{ truong: { han: '2026-11-16', tieu_de: 'Ôn bài' }, bang: 'viec', loai: 'them' }], noi_dung: 'Kế hoạch tuần (gửi lại)', mach: 'cos' }, TU()));
  assert.deepEqual(lai, { ok: true, id: r.id, lap: true });
  assert.equal(dem(m.db, 'de_xuat'), soDx + 1);
  const khac = await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'x', ops: [{ ...ops[0], truong: { tieu_de: 'Ôn bài', han: '2026-11-17' } }] }, TU()));
  const machKhac = await ker(m, lenh('de_xuat_tao', { mach: 'learning', noi_dung: 'x', ops }, TU()));
  assert.equal(new Set([r.id, khac.id, machKhac.id]).size, 3);
  assert.equal(dem(m.db, 'de_xuat'), soDx + 3);
  const bo = await goi(m, `/api/de-xuat/${r.id}/bo-qua`, { method: 'POST', dau: DAU_GHI, than: '{}' });
  assert.equal(bo.ma, 200, bo.than);
  const sauBo = await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'Kế hoạch tuần', ops }, TU()));
  assert.deepEqual([sauBo.ok, sauBo.lap], [true, false]);
  assert.notEqual(sauBo.id, r.id);
  assert.deepEqual([bang(m.db, 'viec'), bang(m.db, 'lich')], truoc);
});

test('de_xuat_tao mang thao tác xoa ⇒ quyen (xoá chỉ qua xoa_de_xuat), kho không đổi; ops sai lược đồ ⇒ luoc_do', async () => {
  const v = (await ker(m, lenh('viec_them', { truong: { tieu_de: 'Giữ' } }))).ket_qua[0];
  const truoc = anhKho(m.db);
  const xoa = { loai: 'xoa', bang: 'viec', id: v.id, phien_ban: 1 }, them_ = { loai: 'them', bang: 'viec', truong: { tieu_de: 'x' } };
  for (const nguon of [TU(), TIN()]) for (const ops of [[xoa], [them_, xoa]])
    assert.deepEqual(await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'x', ops }, nguon)), { ok: false, loi: 'quyen', chi_tiet: { op: 'de_xuat_tao', loai: 'xoa' } });
  assert.equal((await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'x', ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: '' } }] }, TU()))).loi, 'luoc_do');
  assert.equal((await ker(m, lenh('de_xuat_tao', { mach: 'cos', noi_dung: 'x', ops: [] }, TU()))).loi, 'luoc_do');
  assert.equal(anhKho(m.db), truoc);
});

test('xoa_de_xuat ⇒ dòng de_xuat loại xoá, viec không đổi; gửi lại ⇒ cùng id; anh Áp dụng trên web ⇒ xoá mềm; dòng không có/đã xoá ⇒ khong_co', async () => {
  const v = (await ker(m, lenh('viec_them', { truong: { tieu_de: 'Bỏ đi' } }))).ket_qua[0];
  assert.equal((await ker(m, lenh('viec_sua', { id: v.id, phien_ban: 1, truong: { ghi_chu: 'trùng' } }))).ok, true);
  const l = (await ker(m, lenh('lich_them', { truong: { tieu_de: 'Lịch bỏ', bat_dau: '2026-11-20' } }))).ket_qua[0];
  const truoc = bang(m.db, 'viec');
  const r = await ker(m, lenh('xoa_de_xuat', { bang: 'viec', id: v.id, ly_do: 'trùng việc khác' }));
  assert.deepEqual([r.ok, r.lap], [true, false], JSON.stringify(r));
  const dx = motDong(m.db, 'de_xuat', r.id);
  assert.deepEqual([dx.chu_the, dx.trang_thai, dx.mach, dx.noi_dung, JSON.parse(dx.ops)], ['neo', 'cho', 'cos', 'trùng việc khác', [{ loai: 'xoa', bang: 'viec', id: v.id, phien_ban: 2 }]]);
  assert.deepEqual(bang(m.db, 'viec'), truoc, 'đề xuất chưa xoá gì');
  assert.deepEqual(await ker(m, lenh('xoa_de_xuat', { bang: 'viec', id: v.id })), { ok: true, id: r.id, lap: true });
  const rl = await ker(m, lenh('xoa_de_xuat', { bang: 'lich', id: l.id }));
  assert.deepEqual(JSON.parse(motDong(m.db, 'de_xuat', rl.id).ops), [{ loai: 'xoa', bang: 'lich', id: l.id, phien_ban: 1 }]);
  const ad = await goi(m, `/api/de-xuat/${r.id}/ap-dung`, { method: 'POST', dau: DAU_GHI, than: JSON.stringify({ khoa_lap: 'ap-dung-xoa-0001' }) });
  assert.equal(ad.ma, 200, ad.than);
  const sau = motDong(m.db, 'viec', v.id);
  assert.notEqual(sau.xoa_luc, null, 'xoá mềm');
  assert.equal(sau.tieu_de, 'Bỏ đi', 'dòng còn, không xoá cứng');
  const truocSai = anhKho(m.db);
  for (const tt of [{ bang: 'viec', id: v.id }, { bang: 'viec', id: randomUUID() }, { bang: 'lich', id: v.id }])
    assert.deepEqual(await ker(m, lenh('xoa_de_xuat', tt)), { ok: false, loi: 'khong_co' }, JSON.stringify(tt));
  for (const tt of [{ bang: 'cai_tien', id: v.id }, { bang: 'tien_do', id: v.id }, { bang: 'viec', id: 1 }, { bang: 'viec' }])
    assert.equal((await ker(m, lenh('xoa_de_xuat', tt))).loi, 'luoc_do', JSON.stringify(tt));
  assert.equal(anhKho(m.db), truocSai);
});

test('cosGhi: false ⇒ MỌI op ghi (cả hoan) ⇒ cos_ghi_tat, kho không đổi; đối chứng: op đọc vẫn chạy, cosGhi: true + hoan ⇒ hoàn', async () => {
  const truoc = anhKho(mTat.db);
  for (const op of GHI) assert.deepEqual(await ker(mTat, lenh(op, TT_MAU[op])), { ok: false, loi: 'cos_ghi_tat' }, op);
  assert.equal(anhKho(mTat.db), truoc);
  assert.deepEqual(await ker(mTat, lenh('doc_viec', {})), { ok: true, viec: [] });
  const n = await ker(m, lenh('viec_them', { truong: { tieu_de: 'Sẽ hoàn' } }));
  const h = await ker(m, lenh('hoan', { ma_hoan: n.ma_hoan }));
  assert.deepEqual(Object.keys(h).sort(), ['goi_id', 'ok']);
  assert.notEqual(motDong(m.db, 'viec', n.ket_qua[0].id).xoa_luc, null);
});

test('hoan gói của anh qua socket ⇒ quyen, kho không đổi; đối chứng: hoan gói của neo ⇒ hoàn, gói nghịch chủ thể neo', async () => {
  const a = await goi(m, '/api/goi', { method: 'POST', dau: DAU_GHI, than: JSON.stringify({ khoa_lap: 'goi-cua-anh-0001', ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Của anh' } }] }) });
  assert.equal(a.ma, 200, a.than);
  const truoc = anhKho(m.db);
  const r = await ker(m, lenh('hoan', { ma_hoan: a.json.ma_hoan }));
  assert.deepEqual([r.ok, r.loi], [false, 'quyen'], JSON.stringify(r));
  assert.ok(!JSON.stringify(r).includes(a.json.ma_hoan));
  assert.equal(anhKho(m.db), truoc);
  const n = await ker(m, lenh('viec_them', { truong: { tieu_de: 'Của Neo' } }));
  const h = await ker(m, lenh('hoan', { ma_hoan: n.ma_hoan }));
  assert.equal(h.ok, true, JSON.stringify(h));
  assert.notEqual(motDong(m.db, 'viec', n.ket_qua[0].id).xoa_luc, null);
  assert.deepEqual([motDong(m.db, 'goi_ghi', h.goi_id).chu_the, motDong(m.db, 'goi_ghi', h.goi_id).hoan_cua], ['neo', n.goi_id]);
  assert.equal(motDong(m.db, 'viec', a.json.ket_qua[0].id).xoa_luc, null, 'gói của anh còn nguyên');
});

test('doc_cai_tien từ tin_anh ⇒ quyen; đối chứng: từ tu_chay ⇒ đọc được', async () => {
  await ker(m, lenh('cai_tien_them', { truong: { ...CT, mon: 'đọc thử' } }));
  assert.deepEqual(await ker(m, lenh('doc_cai_tien', {})), { ok: false, loi: 'quyen', chi_tiet: { op: 'doc_cai_tien' } });
  const r = await ker(m, lenh('doc_cai_tien', {}, TU()));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.ok(r.cai_tien.some(c => c.mon === 'đọc thử'));
  assert.equal((await ker(m, lenh('doc_cai_tien', undefined, { loai: 'tu_chay' }))).ok, true);
});

test('R12: cùng khung (kể cả khoá xếp khác) gửi lại ⇒ một gói, cùng ma_hoan, lap; đối chứng: tin_id / kenh / thao_tac khác ⇒ gói mới', async () => {
  const nguon = TIN('r12-1'), tt = { truong: { tieu_de: 'Gọi điện', han: '2026-11-20' } };
  const r = await ker(m, lenh('viec_them', tt, nguon));
  assert.deepEqual([r.ok, r.lap], [true, false]);
  const soGoi = dem(m.db, 'goi_ghi'), soViec = dem(m.db, 'viec');
  const lai = await ker(m, { thao_tac: { truong: { han: '2026-11-20', tieu_de: 'Gọi điện' } }, nguon: { tin_id: 'r12-1', kenh: 'lenh', loai: 'tin_anh' }, op: 'viec_them' });
  assert.deepEqual(lai, { ...r, lap: true });
  assert.deepEqual([dem(m.db, 'goi_ghi'), dem(m.db, 'viec')], [soGoi, soViec]);
  const kl = motDong(m.db, 'goi_ghi', r.goi_id).khoa_lap;
  const chuan = '{"truong":{"han":"2026-11-20","tieu_de":"Gọi điện"}}';
  assert.equal(kl, 'k_' + createHash('sha256').update(['lenh', 'r12-1', 'viec_them', chuan].join('\n')).digest('hex'));
  for (const [ng, t] of [[TIN('r12-2'), tt], [{ ...nguon, kenh: 'kenh-khac' }, tt], [nguon, { truong: { tieu_de: 'Gọi điện', han: '2026-11-21' } }]]) {
    const k = await ker(m, lenh('viec_them', t, ng));
    assert.deepEqual([k.ok, k.lap], [true, false], JSON.stringify(ng));
    assert.notEqual(k.goi_id, r.goi_id);
  }
});

test('doc_viec / doc_lich trả dữ liệu kho; doc_lich quá 62 ngày ⇒ query; thao_tac sai kiểu ⇒ luoc_do', async () => {
  const v = (await ker(m, lenh('viec_them', { truong: { tieu_de: 'Đọc thử', mach: 'learning' } }))).ket_qua[0];
  const l = (await ker(m, lenh('lich_them', { truong: { tieu_de: 'Lịch đọc', bat_dau: '2026-12-03T08:00' } }))).ket_qua[0];
  const xong = (await ker(m, lenh('viec_them', { truong: { tieu_de: 'Đã xong', mach: 'learning' } }))).ket_qua[0];
  assert.equal((await ker(m, lenh('viec_xong', { id: xong.id, phien_ban: 1 }))).ok, true);
  const dv = await ker(m, lenh('doc_viec', { mach: 'learning', mo: true }));
  assert.deepEqual(dv.viec.map(x => x.id), [v.id]);
  assert.deepEqual(dv.viec[0], { id: v.id, tieu_de: 'Đọc thử', han: null, danh_sach: null, ghi_chu: null, xong_luc: null, mach: 'learning', phien_ban: 1 });
  for (const tt of [{ mach: 'learning', mo: false }, { mach: 'learning' }]) assert.deepEqual((await ker(m, lenh('doc_viec', tt))).viec.map(x => x.id).sort(), [v.id, xong.id].sort(), JSON.stringify(tt));
  assert.ok((await ker(m, lenh('doc_viec', {}))).viec.some(x => x.mach === 'cos'), 'không lọc mach ⇒ mọi mạch');
  const dl = await ker(m, lenh('doc_lich', { tu: '2026-12-01', den: '2026-12-05' }, TU()));
  assert.deepEqual(dl.lich.map(x => x.id), [l.id]);
  assert.deepEqual(await ker(m, lenh('doc_lich', { tu: '2026-12-01', den: '2027-02-01' })), { ok: false, loi: 'query', chi_tiet: { truong: 'den' } });
  for (const [op, tt] of [['doc_viec', { mo: 1 }], ['doc_viec', { mo: 'true' }], ['doc_viec', { mach: 1 }], ['doc_viec', { mach: null }], ['doc_lich', { tu: 20261201, den: '2026-12-05' }], ['doc_lich', { tu: '2026-12-01', den: 20261205 }]])
    assert.equal((await ker(m, lenh(op, tt))).loi, 'luoc_do', op + ' ' + JSON.stringify(tt));
});

test('lỗi lạ ⇒ { ok: false, loi: "loi_may_chu" }, không lộ thông điệp', async () => {
  const goc = Object.getOwnPropertyDescriptor(m.db, 'prepare');
  m.db.prepare = () => { throw new Error('BI-MAT-loi /duong/kho.sqlite'); };
  try {
    for (const k of [lenh('doc_viec', {}), lenh('viec_them', { truong: { tieu_de: 'x' } })]) {
      const ra = await guiTho(m, khung(k));
      assert.deepEqual(JSON.parse(ra.subarray(4)), { ok: false, loi: 'loi_may_chu' });
      assert.ok(!ra.toString().includes('BI-MAT'));
    }
  } finally { if (goc) Object.defineProperty(m.db, 'prepare', goc); else delete m.db.prepare; }
  assert.equal((await ker(m, lenh('doc_viec', {}))).ok, true, 'đối chứng sau khi trả prepare');
});
