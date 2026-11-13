// Cửa DUY NHẤT ra /api/* (Pha B): redirect 'manual' (302 của lề Access ⇒ opaqueredirect, không theo sang trang đăng nhập bằng fetch),
// cache 'no-store'. 401/403/opaqueredirect ⇒ Hết phiên · 423 ⇒ chỉ đọc · fetch ném ⇒ LoiMang · mã khác 2xx ⇒ LoiApi { ma, loi, chi_tiet }.
// Lệnh ghi mang X-WebOS: 1 + Content-Type: application/json (chống CSRF, thiết kế 5.2). Xử lý Hết phiên / chỉ đọc gắn qua datXuLy (tránh vòng import).
export class LoiPhien extends Error { constructor() { super('het_phien'); } }
export class LoiChiDoc extends Error { constructor() { super('chi_doc'); } }
export class LoiMang extends Error { constructor() { super('mang'); } }
export class LoiApi extends Error {
  constructor(ma, loi, chi_tiet) { super(loi); this.ma = ma; this.loi = loi; this.chi_tiet = chi_tiet; }
}

export const laHetPhien = r => r.type === 'opaqueredirect' || r.status === 401 || r.status === 403;
export const laChiDoc = r => r.status === 423;

let khiHetPhien = () => {}, khiChiDoc = () => {};
export const datXuLy = ({ hetPhien, chiDoc }) => { if (hetPhien) khiHetPhien = hetPhien; if (chiDoc) khiChiDoc = chiDoc; };
export const khoaLap = () => crypto.randomUUID();

export async function goiApi(duong, { method = 'GET', than } = {}) {
  const tuy = { method, redirect: 'manual', cache: 'no-store', credentials: 'same-origin' };
  if (method !== 'GET') { tuy.headers = { 'X-WebOS': '1', 'Content-Type': 'application/json' }; tuy.body = JSON.stringify(than ?? {}); }
  let r;
  try { r = await fetch(duong, tuy); } catch { throw new LoiMang(); }
  if (laHetPhien(r)) { khiHetPhien(); throw new LoiPhien(); }
  if (laChiDoc(r)) { khiChiDoc(); throw new LoiChiDoc(); }
  let o = null;
  try { o = await r.json(); } catch { /* thân không phải JSON */ }
  if (!r.ok) throw new LoiApi(r.status, o?.loi ?? 'loi_may_chu', o?.chi_tiet ?? null);
  if (o === null || typeof o !== 'object') throw new LoiApi(r.status, 'than_hong', null);
  return o;
}
