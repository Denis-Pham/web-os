// Gói ghi + Hoàn tác (thiết kế v0.2 mục 2, 4, 5.4, 5.5). MỌI lệnh ghi vào kho đi qua apGoi: route web, kernel.sock (A4), Áp dụng đề xuất (A3).
// Thứ tự cổng: khoa_lap + nguồn + lược đồ (400) → quyền (403) → trong MỘT giao dịch: khoá lặp (R9), phien_ban (409), doi_tuong tien_do (R6, 403).
import { randomBytes, randomUUID } from 'node:crypto';
import { trongGiaoDich } from './kho.mjs';

export class LoiGoi extends Error {
  constructor(ma, loi, chi_tiet = null) { super(loi); this.ma = ma; this.loi = loi; this.chi_tiet = chi_tiet; }
}
const saiLuocDo = chi_tiet => new LoiGoi(400, 'luoc_do', chi_tiet);
const laObj = o => typeof o === 'object' && o !== null && !Array.isArray(o);

// Cột NỘI DUNG từng bảng (không id, phien_ban, *_luc, nguoi_sua); luật chép từ DDL kho.mjs (R11).
// chu: trần ký tự (cột chữ không CHECK: 200) · it: tối thiểu · ngay · so: [min, max] nguyên · chon · bb: bắt buộc khi them · nn: NOT NULL có mặc định
const LUOC = {
  viec: {
    tieu_de: { chu: 200, it: 1, bb: true }, han: { ngay: true }, danh_sach: { chu: 200 }, ghi_chu: { chu: 2000 },
    mach: { chu: 200, nn: true }, nguon_gieo: { chu: 200 },
  },
  lich: {
    tieu_de: { chu: 200, it: 1, bb: true }, bat_dau: { ngay: true, bb: true }, ket_thuc: { ngay: true },
    ca_ngay: { so: [0, 1], nn: true }, nhac_truoc_phut: { so: [0, 10080] }, dia_diem: { chu: 200 },
  },
  tien_do: { doi_tuong: { chu: 200, bb: true }, ghi: { chu: 2000 }, phan_tram: { so: [0, 100] } },
  cai_tien: {
    ngay: { ngay: true, bb: true }, mach: { chu: 200, bb: true }, loai: { chu: 200, bb: true }, mon: { chu: 200, bb: true },
    duong: { chu: 200 }, noi_dung: { chu: 2000, bb: true }, trang_thai: { chon: ['cho', 'da_nhap', 'bo'], bb: true },
  },
};
// Cột Hoàn tác trả về: cột nội dung + xoa_luc (+ xong_luc ở viec).
const COT_HOAN = Object.fromEntries(Object.keys(LUOC).map(b => [b, [...Object.keys(LUOC[b]), 'xoa_luc', ...(b === 'viec' ? ['xong_luc'] : [])]]));

// Ngày giờ VN: YYYY-MM-DD hoặc YYYY-MM-DDTHH:MM, năm 2000–2100, phải là ngày có thật (2026-02-30 sai).
const NGAY = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/;
function laNgay(v) {
  const m = typeof v === 'string' ? NGAY.exec(v) : null;
  if (!m) return false;
  const [nam, thang, ngay, gio, phut] = m.slice(1).map(x => Number(x ?? 0));
  const cuoiThang = new Date(Date.UTC(nam, thang, 0)).getUTCDate();   // ngày 0 của tháng sau = ngày cuối tháng này (lịch, không đọc đồng hồ)
  return nam >= 2000 && nam <= 2100 && thang >= 1 && thang <= 12 && ngay >= 1 && ngay <= cuoiThang && gio <= 23 && phut <= 59;
}
// Đếm ký tự như length() của SQLite; cấm NUL vì length() dừng ở NUL ⇒ CHECK lệch, lỗi SQLite lọt ra.
function hopLe(luat, v) {
  if (v === null) return !luat.bb && !luat.nn;
  if (luat.chu) return typeof v === 'string' && !v.includes('\0') && [...v].length >= (luat.it ?? 0) && [...v].length <= luat.chu;
  if (luat.ngay) return laNgay(v);
  if (luat.so) return Number.isInteger(v) && v >= luat.so[0] && v <= luat.so[1];
  return luat.chon.includes(v);
}

const KHOA_OP = {
  them: ['loai', 'bang', 'truong'],
  sua: ['loai', 'bang', 'id', 'phien_ban', 'truong'],
  xoa: ['loai', 'bang', 'id', 'phien_ban'],
  xong: ['loai', 'bang', 'id', 'phien_ban'],
  mo_lai: ['loai', 'bang', 'id', 'phien_ban'],
};
// Danh sách đóng; trả thao tác đã chuẩn hoá (khoá cố định, trường xếp theo tên) để so R9 bằng JSON.
export function kiemOps(ops) {
  if (!Array.isArray(ops) || ops.length < 1 || ops.length > 40) throw saiLuocDo({ ly_do: 'so_thao_tac' });
  return ops.map((op, i) => {
    const hong = (ly_do, truong) => saiLuocDo({ thao_tac: i, ly_do, ...(truong && { truong }) });
    if (!laObj(op) || !Object.hasOwn(KHOA_OP, op.loai)) throw hong('loai');
    const khoa = KHOA_OP[op.loai];
    if (Object.keys(op).some(k => !khoa.includes(k))) throw hong('khoa_la');
    if (!Object.hasOwn(LUOC, op.bang)) throw hong('bang');
    if ((op.loai === 'xong' || op.loai === 'mo_lai') && op.bang !== 'viec') throw hong('chi_viec');   // R5: chỉ viec có xong_luc
    const ra = { loai: op.loai, bang: op.bang };
    if (op.loai !== 'them') {
      if (typeof op.id !== 'string' || op.id.length < 1 || op.id.length > 100) throw hong('id');
      if (!Number.isInteger(op.phien_ban) || op.phien_ban < 1) throw hong('phien_ban');
      ra.id = op.id; ra.phien_ban = op.phien_ban;
    }
    if (op.loai === 'them' || op.loai === 'sua') {
      const t = op.truong, luoc = LUOC[op.bang];
      if (!laObj(t) || Object.keys(t).length === 0) throw hong('truong');
      for (const k of Object.keys(t)) if (!Object.hasOwn(luoc, k) || !hopLe(luoc[k], t[k])) throw hong('gia_tri', k);
      if (op.loai === 'them') for (const k of Object.keys(luoc)) if (luoc[k].bb && !Object.hasOwn(t, k)) throw hong('thieu', k);
      ra.truong = Object.fromEntries(Object.keys(t).sort().map(k => [k, t[k]]));
    }
    return ra;
  });
}

// R8: goi_ghi.nguon = JSON đủ đối tượng nguồn; nhat_ky.nguon = nguon.loai. Khoá lạ ⇒ 400.
const NGUON = ['web', 'de_xuat', 'tin_anh', 'tu_chay'];
function kiemNguon(nguon) {
  if (!laObj(nguon) || !NGUON.includes(nguon.loai)) throw saiLuocDo({ ly_do: 'nguon' });
  if (Object.keys(nguon).some(k => !['loai', 'kenh', 'tin_id'].includes(k))) throw saiLuocDo({ ly_do: 'nguon_khoa_la' });
  for (const k of ['kenh', 'tin_id']) if (Object.hasOwn(nguon, k) && !(typeof nguon[k] === 'string' && nguon[k].length <= 100)) throw saiLuocDo({ ly_do: 'nguon', truong: k });
  return JSON.stringify(nguon, ['loai', 'kenh', 'tin_id']);
}

// Bảng quyền (thiết kế mục 4). Không có ô ⇒ 403: neo · tu_chay, anh · tin_anh, neo · web… đều không ghi được.
const MOI = ['them', 'sua', 'xoa', 'xong', 'mo_lai'];
const QUYEN_ANH = { viec: MOI, lich: MOI, tien_do: ['them', 'sua'], cai_tien: ['sua'] };   // anh · web, anh · de_xuat (anh bấm Áp dụng)
const QUYEN = {
  anh: { web: QUYEN_ANH, de_xuat: QUYEN_ANH },
  neo: { tin_anh: { viec: ['them', 'sua', 'xong', 'mo_lai'], lich: ['them', 'sua', 'xong', 'mo_lai'], cai_tien: ['them'] } },   // KHÔNG xoa: xoá qua đề xuất (A4)
};
const quyenCua = (chu_the, loai) => (Object.hasOwn(QUYEN, chu_the) && Object.hasOwn(QUYEN[chu_the], loai) ? QUYEN[chu_the][loai] : null);

export function kiemQuyen(chu_the, nguon, ops) {
  const o = quyenCua(chu_the, nguon?.loai) ?? {};
  for (const { bang, loai, truong } of ops) {
    if (!Object.hasOwn(o, bang) || !o[bang].includes(loai)) throw new LoiGoi(403, 'quyen', { bang, loai });
    if (bang === 'cai_tien' && loai === 'sua' && Object.keys(truong).some(k => k !== 'trang_thai')) throw new LoiGoi(403, 'quyen', { bang, loai });   // anh chỉ đổi trạng thái
  }
}

const lay = (db, bang, id) => db.prepare(`SELECT * FROM ${bang} WHERE id = ?`).get(id);

// Sửa phải kèm phien_ban vừa đọc; dòng không có hay đã xoá mềm cũng là lệch (máy khách cầm ảnh cũ).
function kiemPhienBan(dong, op) {
  if (!dong || dong.xoa_luc !== null || dong.phien_ban !== op.phien_ban) throw new LoiGoi(409, 'phien_ban', { bang: op.bang, id: op.id });
}

// R6: tien_do chỉ gắn vào việc còn hiện; kiemQuyen không có db nên kiểm ở đây, TRONG giao dịch (thấy cả thao tác trước trong gói).
function kiemDoiTuong(db, doi_tuong, loai) {
  const m = /^viec:(.+)$/.exec(doi_tuong);
  if (!m || !db.prepare('SELECT 1 FROM viec WHERE id = ? AND xoa_luc IS NULL').get(m[1])) throw new LoiGoi(403, 'quyen', { bang: 'tien_do', loai });
}

// Ghi một dòng + một dòng nhat_ky (truoc/sau đủ dòng). truoc null ⇒ thêm (phien_ban mặc định 1); có ⇒ sửa, người gọi đặt phien_ban mới trong gan.
function ghiDong(db, bang, id, gan, truoc, { goi_id, chu_the, nguon, bayGio }) {
  const cot = Object.keys(gan), gia = cot.map(c => gan[c]);
  try {
    if (truoc) db.prepare(`UPDATE ${bang} SET ${cot.map(c => `${c} = ?`).join(', ')}, sua_luc = ?, nguoi_sua = ? WHERE id = ?`).run(...gia, bayGio, chu_the, id);
    else db.prepare(`INSERT INTO ${bang} (id, ${cot.join(', ')}, tao_luc, sua_luc, nguoi_sua) VALUES (?, ${cot.map(() => '?').join(', ')}, ?, ?, ?)`).run(id, ...gia, bayGio, bayGio, chu_the);
  } catch (e) {
    if (e.errcode === 2067 && e.message.includes('viec.nguon_gieo')) throw new LoiGoi(409, 'trung_nguon_gieo');   // SQLITE_CONSTRAINT_UNIQUE ở chỉ mục viec_nguon_gieo
    throw e;
  }
  const sau = lay(db, bang, id);
  db.prepare('INSERT INTO nhat_ky (luc, chu_the, nguon, goi_id, bang, dong_id, truoc, sau) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(bayGio, chu_the, nguon, goi_id, bang, id, truoc ? JSON.stringify(truoc) : null, JSON.stringify(sau));
  return { bang, id, phien_ban: sau.phien_ban };
}

function apMot(db, op, ng) {
  const { loai, bang } = op;
  const truoc = loai === 'them' ? null : lay(db, bang, op.id);
  if (loai !== 'them') kiemPhienBan(truoc, op);
  const doi = loai === 'them' || loai === 'sua' ? op.truong : loai === 'xoa' ? { xoa_luc: ng.bayGio } : { xong_luc: loai === 'xong' ? ng.bayGio : null };
  if (bang === 'tien_do') kiemDoiTuong(db, doi.doi_tuong ?? truoc.doi_tuong, loai);
  return truoc ? ghiDong(db, bang, op.id, { ...doi, phien_ban: truoc.phien_ban + 1 }, truoc, ng) : ghiDong(db, bang, randomUUID(), doi, null, ng);
}

const KHOA_LAP = /^[A-Za-z0-9_-]{8,100}$/;

export function apGoi(db, { khoa_lap, chu_the, nguon, ops }, bayGio) {
  if (typeof khoa_lap !== 'string' || !KHOA_LAP.test(khoa_lap)) throw saiLuocDo({ ly_do: 'khoa_lap' });
  const nguonJson = kiemNguon(nguon);
  const chuan = kiemOps(ops);
  kiemQuyen(chu_the, nguon, chuan);
  const opsJson = JSON.stringify(chuan);
  return trongGiaoDich(db, () => {
    const cu = db.prepare('SELECT * FROM goi_ghi WHERE khoa_lap = ?').get(khoa_lap);
    if (cu) {
      // R9: cùng khoá + cùng chủ thể + cùng thao tác ⇒ trả gói cũ; khác ⇒ 409 (neo không lấy được ma_hoan gói của anh bằng khoá của anh).
      if (cu.chu_the !== chu_the || cu.ops !== opsJson) throw new LoiGoi(409, 'khoa_lap_trung');
      return { goi_id: cu.id, ma_hoan: cu.ma_hoan, ket_qua: JSON.parse(cu.ket_qua), lap: true };
    }
    const ng = { goi_id: randomUUID(), chu_the, nguon: nguon.loai, bayGio };
    const ket_qua = chuan.map(op => apMot(db, op, ng));
    const ma_hoan = randomBytes(16).toString('hex');
    db.prepare('INSERT INTO goi_ghi (id, khoa_lap, chu_the, nguon, ops, ket_qua, ma_hoan, tao_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(ng.goi_id, khoa_lap, chu_the, nguonJson, opsJson, JSON.stringify(ket_qua), ma_hoan, bayGio);
    return { goi_id: ng.goi_id, ma_hoan, ket_qua, lap: false };
  });
}

// Hoàn tác = gói nghịch NỘI BỘ (không qua kiemOps) dựng từ nhat_ky.truoc của gói gốc; chỉ chạy khi mọi dòng còn đúng phien_ban trong ket_qua.
export function hoanTac(db, { ma_hoan, chu_the, nguon }, bayGio) {
  const nguonJson = kiemNguon(nguon);
  return trongGiaoDich(db, () => {
    const goc = typeof ma_hoan === 'string' ? db.prepare('SELECT * FROM goi_ghi WHERE ma_hoan = ?').get(ma_hoan) : undefined;
    if (!goc) throw new LoiGoi(404, 'khong_co');
    // Người bấm là chủ thể gói nghịch: phải có ô quyền ở nguồn này; anh hoàn mọi gói, neo chỉ hoàn gói của neo.
    if (!quyenCua(chu_the, nguon.loai)) throw new LoiGoi(403, 'quyen', { bang: 'goi_ghi', loai: 'hoan_tac' });
    if (chu_the === 'neo' && goc.chu_the !== 'neo') throw new LoiGoi(403, 'quyen', { bang: 'goi_ghi', loai: 'hoan_tac' });
    // hoan_luc đặt MỘT lần: điều kiện IS NULL là cổng chống Hoàn tác hai lần.
    if (db.prepare('UPDATE goi_ghi SET hoan_luc = ? WHERE id = ? AND hoan_luc IS NULL').run(bayGio, goc.id).changes !== 1) throw new LoiGoi(409, 'da_hoan');
    // Gói chạm một dòng nhiều lần: trả về truoc của lần chạm ĐẦU, so phien_ban của lần chạm CUỐI.
    const dong = new Map();
    for (const n of db.prepare('SELECT bang, dong_id, truoc FROM nhat_ky WHERE goi_id = ? ORDER BY id').all(goc.id))
      if (!dong.has(`${n.bang}:${n.dong_id}`)) dong.set(`${n.bang}:${n.dong_id}`, { bang: n.bang, id: n.dong_id, truoc: JSON.parse(n.truoc) });
    for (const k of JSON.parse(goc.ket_qua)) dong.get(`${k.bang}:${k.id}`).phien_ban = k.phien_ban;
    const ng = { goi_id: randomUUID(), chu_the, nguon: nguon.loai, bayGio };
    const ket_qua = [...dong.values()].map(d => {
      const hien = lay(db, d.bang, d.id);
      if (hien.phien_ban !== d.phien_ban) throw new LoiGoi(409, 'da_sua_sau', { bang: d.bang, id: d.id });
      // R10: Hoàn tác một them = xoá mềm (không xoá cứng); còn lại trả cột nội dung + xoa_luc + xong_luc về như trước. phien_ban vẫn tăng.
      const ve = d.truoc ? Object.fromEntries(COT_HOAN[d.bang].map(c => [c, d.truoc[c]])) : { xoa_luc: bayGio };
      return ghiDong(db, d.bang, d.id, { ...ve, phien_ban: hien.phien_ban + 1 }, hien, ng);
    });
    db.prepare('INSERT INTO goi_ghi (id, khoa_lap, chu_the, nguon, ops, ket_qua, hoan_cua, tao_luc) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(ng.goi_id, `hoan:${goc.id}`, chu_the, nguonJson, JSON.stringify(ket_qua.map(({ bang, id }) => ({ loai: 'hoan_tac', bang, id }))),
        JSON.stringify(ket_qua), goc.id, bayGio);
    return { goi_id: ng.goi_id };
  });
}
