// kernel.sock (thiết kế v0.2 mục 3, 4, 5.3; task A4): cửa để Neo (Hermes Kernel) đọc/ghi kho. MỘT kết nối = MỘT khung yêu cầu = MỘT trả lời rồi đóng.
// Khung: 4 byte độ dài big-endian (>I, như hermes-core executors/learning_core.py) + JSON UTF-8, trần 64 KiB. Chủ thể LUÔN neo, không lấy từ khung.
// MỘT khung = MỘT thao tác: `op` ngoài cùng là thứ gate Kernel kiểm (LICENSE_OPS chỉ xét args.op) ⇒ không có op gói nhiều thao tác, không có op xoá thẳng.
// Thứ tự cổng, trước mọi đọc/ghi kho: khung → op → nguon/thao_tac → tu_chay → doc_cai_tien → cosGhi → apGoi/taoDeXuat/hoanTac (A1: kiemOps + kiemQuyen).
// Không log nội dung khung. Trả { ok: true, ... } | { ok: false, loi, chi_tiet? }; không bao giờ vé, đường tệp, ma_hoan gói khác.
import net from 'node:net';
import { createHash } from 'node:crypto';
import { LoiGoi, apGoi, hoanTac, kiemOps, taoDeXuat } from './goi.mjs';
import { ROUTE } from './api.mjs';

export const TRAN_KHUNG = 64 * 1024;
const HAN_KHUNG_MS = 5000;
const NEO = 'neo';

// Khoá đóng của thao_tac từng op (danh sách op đóng = khoá của bảng này).
const KHOA_TT = {
  viec_them: ['truong'], viec_sua: ['id', 'phien_ban', 'truong'], viec_xong: ['id', 'phien_ban'], viec_mo_lai: ['id', 'phien_ban'],
  lich_them: ['truong'], lich_sua: ['id', 'phien_ban', 'truong'], cai_tien_them: ['truong'],
  de_xuat_tao: ['mach', 'noi_dung', 'ops'], xoa_de_xuat: ['bang', 'id', 'ly_do'], hoan: ['ma_hoan'],
  doc_viec: ['mo', 'mach'], doc_lich: ['tu', 'den'], doc_cai_tien: [],
};
const DOC = ['doc_viec', 'doc_lich', 'doc_cai_tien'];
// op ghi đi apGoi ⇒ [bảng, loại thao tác A1]
const GOI_A1 = { viec_them: ['viec', 'them'], viec_sua: ['viec', 'sua'], viec_xong: ['viec', 'xong'], viec_mo_lai: ['viec', 'mo_lai'], lich_them: ['lich', 'them'], lich_sua: ['lich', 'sua'], cai_tien_them: ['cai_tien', 'them'] };

const laObj = o => typeof o === 'object' && o !== null && !Array.isArray(o);
const khongNhan = (loi, chi_tiet = null) => new LoiGoi(400, loi, chi_tiet);
const saiTruong = truong => new LoiGoi(400, 'luoc_do', { truong });

// Khung khoá ĐÓNG { op, nguon, thao_tac? }: khoá lạ (kể cả chu_the, khoa_lap) ⇒ 'khung'.
function kiemKhung(k) {
  if (!laObj(k) || Object.keys(k).some(x => !['op', 'nguon', 'thao_tac'].includes(x))) throw khongNhan('khung');
}
function kiemOp(op) {
  if (typeof op !== 'string' || !Object.hasOwn(KHOA_TT, op)) throw khongNhan('op_la');
}
// nguon khoá đóng { loai: tin_anh|tu_chay, kenh, tin_id }; kenh/tin_id chuỗi 1–100, bắt buộc với op ghi.
function kiemNguon(op, nguon) {
  if (!laObj(nguon) || !['tin_anh', 'tu_chay'].includes(nguon.loai) || Object.keys(nguon).some(x => !['loai', 'kenh', 'tin_id'].includes(x))) throw khongNhan('nguon');
  for (const x of ['kenh', 'tin_id']) {
    const co = Object.hasOwn(nguon, x);
    if (co ? !(typeof nguon[x] === 'string' && nguon[x].length >= 1 && nguon[x].length <= 100) : !DOC.includes(op)) throw khongNhan('nguon', { truong: x });
  }
}
function kiemThaoTac(op, tt) {
  if (tt === undefined) return {};
  if (!laObj(tt) || Object.keys(tt).some(x => !KHOA_TT[op].includes(x))) throw khongNhan('khung', { truong: 'thao_tac' });
  return tt;
}
// Lượt tự chạy (thiết kế 3 dòng 9, 9b): chỉ đọc + tạo đề xuất; mọi op ghi khác (cả hoan, xoa_de_xuat) ⇒ từ chối.
function kiemTuChay(op, nguon) {
  if (nguon.loai === 'tu_chay' && !DOC.includes(op) && op !== 'de_xuat_tao') throw new LoiGoi(403, 'tu_chay_chi_de_xuat');
}
// Thiết kế 4: Neo theo tin anh chỉ THÊM cải tiến, không đọc; lượt chụp 06:30 (tu_chay) đọc.
function kiemDocCaiTien(op, nguon) {
  if (op === 'doc_cai_tien' && nguon.loai !== 'tu_chay') throw new LoiGoi(403, 'quyen', { op });
}
// Công tắc cosGhi (như kiemCosGhi của route web): tắt ⇒ mọi op ghi, kể cả tạo đề xuất và hoan.
function kiemCosGhi(ch, op) {
  if (!DOC.includes(op) && ch.cosGhi !== true) throw new LoiGoi(423, 'cos_ghi_tat');
}
// Tự quyết A4: xoá chỉ qua xoa_de_xuat (tu_chay không được) ⇒ de_xuat_tao không mang thao tác xoa, kẻo lượt tự chạy lách cổng tu_chay.
function kiemKhongXoa(ops) {
  if (Array.isArray(ops) && ops.some(o => laObj(o) && o.loai === 'xoa')) throw new LoiGoi(403, 'quyen', { op: 'de_xuat_tao', loai: 'xoa' });
}

// JSON chuẩn hoá: khoá object xếp theo tên ở mọi tầng.
const sapXep = v => (Array.isArray(v) ? v.map(sapXep) : laObj(v) ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sapXep(v[k])])) : v);
// R12: Kernel gửi lại cùng khung ⇒ cùng khoa_lap ⇒ apGoi trả gói cũ (lap). '_' thay ':' của plan: KHOA_LAP (A1) chỉ nhận [A-Za-z0-9_-].
const khoaLap = (nguon, op, tt) => 'k_' + createHash('sha256').update([nguon.kenh, nguon.tin_id, op, JSON.stringify(sapXep(tt))].join('\n')).digest('hex');

// R12 đề xuất: đã có đề xuất 'cho' cùng mach + chủ thể + ops (JSON chuẩn hoá của kiemOps, như cột de_xuat.ops) ⇒ trả id cũ.
function deXuat(db, { mach, noi_dung, ops }, bayGio) {
  const opsJson = JSON.stringify(kiemOps(ops));
  const cu = typeof mach === 'string' ? db.prepare("SELECT id FROM de_xuat WHERE trang_thai = 'cho' AND mach = ? AND chu_the = ? AND ops = ?").get(mach, NEO, opsJson) : undefined;
  return cu ? { id: cu.id, lap: true } : { ...taoDeXuat(db, { mach, chu_the: NEO, noi_dung, ops }, bayGio), lap: false };
}

// Đọc qua đúng handler route web (cùng kiểm query, cùng cột).
const doc = (ctx, route, q) => ROUTE[route]({ ctx, query: new URLSearchParams(q).toString() });
function chuoi(tt, k) { if (Object.hasOwn(tt, k) && typeof tt[k] !== 'string') throw saiTruong(k); }

const LAM = {
  ...Object.fromEntries(Object.entries(GOI_A1).map(([op, [bang, loai]]) => [op, (ctx, tt, nguon, t) =>
    apGoi(ctx.db, { khoa_lap: khoaLap(nguon, op, tt), chu_the: NEO, nguon, ops: [{ ...tt, loai, bang }] }, t)])),
  de_xuat_tao: (ctx, tt, nguon, t) => { kiemKhongXoa(tt.ops); return deXuat(ctx.db, tt, t); },
  // Neo không xoá thẳng: tạo đề xuất xoá phiên bản đang thấy; dòng chỉ bị xoá (mềm) khi anh Áp dụng trên web.
  xoa_de_xuat: (ctx, { bang, id, ly_do }, nguon, t) => {
    if (bang !== 'viec' && bang !== 'lich') throw saiTruong('bang');
    if (typeof id !== 'string') throw saiTruong('id');
    const dong = ctx.db.prepare(`SELECT * FROM ${bang} WHERE id = ? AND xoa_luc IS NULL`).get(id);
    if (!dong) throw new LoiGoi(404, 'khong_co');
    return deXuat(ctx.db, { mach: dong.mach ?? 'cos', noi_dung: ly_do ?? 'Neo đề xuất xoá', ops: [{ loai: 'xoa', bang, id, phien_ban: dong.phien_ban }] }, t);
  },
  // hoanTac (A1) chặn neo hoàn gói của anh.
  hoan: (ctx, { ma_hoan }, nguon, t) => hoanTac(ctx.db, { ma_hoan, chu_the: NEO, nguon }, t),
  doc_viec: (ctx, tt) => {
    if (Object.hasOwn(tt, 'mo') && typeof tt.mo !== 'boolean') throw saiTruong('mo');
    chuoi(tt, 'mach');
    return doc(ctx, 'GET /api/viec', { ...(tt.mo ? { mo: '1' } : {}), ...(tt.mach === undefined ? {} : { mach: tt.mach }) });
  },
  doc_lich: (ctx, tt) => { chuoi(tt, 'tu'); chuoi(tt, 'den'); return doc(ctx, 'GET /api/lich', tt); },
  doc_cai_tien: ctx => doc(ctx, 'GET /api/cai-tien', {}),
};

export function xuLyKhung(ctx, raw) {
  try {
    let k;
    try { k = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); } catch { throw khongNhan('json'); }
    kiemKhung(k);
    const { op, nguon } = k;
    kiemOp(op);
    kiemNguon(op, nguon);
    const tt = kiemThaoTac(op, k.thao_tac);
    kiemTuChay(op, nguon);
    kiemDocCaiTien(op, nguon);
    kiemCosGhi(ctx.ch, op);
    return { ok: true, ...LAM[op](ctx, tt, nguon, new Date(ctx.bayGio()).toISOString()) };
  } catch (e) {
    return e instanceof LoiGoi ? { ok: false, loi: e.loi, ...(e.chi_tiet === null ? {} : { chi_tiet: e.chi_tiet }) } : { ok: false, loi: 'loi_may_chu' };
  }
}

// hen: { setTimeout, clearTimeout } (test truyền đồng hồ giả của khoiDong).
export function taoKernel(ctx, hen = { setTimeout, clearTimeout }) {
  const ketNoi = new Set();
  const s = net.createServer(c => {
    ketNoi.add(c);
    // Hẹn sống tới khi đóng: khung không về đủ trong 5 s (hay khách giữ kết nối sau trả lời) ⇒ huỷ.
    const t = hen.setTimeout(() => c.destroy(), HAN_KHUNG_MS);
    c.on('close', () => { ketNoi.delete(c); hen.clearTimeout(t); });
    c.on('error', () => {});
    let ds = [], n = 0;
    const nhan = d => {
      ds.push(d); n += d.length;
      if (n < 4) return;
      const b = Buffer.concat(ds), dai = b.readUInt32BE(0);
      ds = [b];
      if (dai > TRAN_KHUNG) return c.destroy();   // quá trần ⇒ huỷ: không trả, không ghi
      if (n < 4 + dai) return;
      c.off('data', nhan);   // đủ khung: byte thừa sau khung bị bỏ
      const ra = Buffer.from(JSON.stringify(xuLyKhung(ctx, b.subarray(4, 4 + dai)))), l = Buffer.alloc(4);
      l.writeUInt32BE(ra.length);
      c.end(Buffer.concat([l, ra]));
    };
    c.on('data', nhan);
  });
  s.closeAllConnections = () => { for (const c of ketNoi) c.destroy(); };
  return s;
}
