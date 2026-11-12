// Bộ định tuyến chung của web-os (thiết kế v0.2 mục 5.1–5.2): MỌI yêu cầu đi một đường, thứ tự cố định:
// kiemYeuCau (mọi phương thức, mọi đường) → khác GET/HEAD: kiemCsrf (403) rồi đọc thân trần 64 KiB (413) → mới tra ROUTE.
// Route ghi task sau thêm vào ROUTE là tự đi qua cùng cổng. Lỗi route: LoiGoi ⇒ e.ma chung; lỗi khác ⇒ 500 thân chung, không lộ thông điệp.
// CSRF + docThan chép từ Learning 630a0bf:may-chu/ghi.mjs (header X-Learning ⇒ X-WebOS); tra/DAU_AN_NINH từ 630a0bf:may-chu/may-chu.mjs.
import { kiemYeuCau } from './xac-thuc.mjs';
import { LoiGoi } from './goi.mjs';

const DAU_AN_NINH = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
};
export function tra(res, ma, than = '', loai = 'text/plain; charset=utf-8', them = {}) {
  res.writeHead(ma, { ...DAU_AN_NINH, 'Cache-Control': 'no-store', ...them, 'Content-Type': loai });
  res.end(than);
}
export function traJson(res, ma, o) { return tra(res, ma, JSON.stringify(o), 'application/json; charset=utf-8'); }

// Chống CSRF lệnh ghi (5.2): X-WebOS: 1 + Content-Type application/json + Sec-Fetch-Site (nếu có) = same-origin.
export function kiemCsrf(req) {
  const h = req.headers;
  if (h['x-webos'] !== '1') return false;
  if (String(h['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return false;
  return h['sec-fetch-site'] === undefined || h['sec-fetch-site'] === 'same-origin';
}

export const TRAN_THAN = 64 * 1024;
// Đọc HẾT thân (trả 413 sau khi đọc xong ⇒ trình duyệt nhận được mã, không bị RST); vượt trần ⇒ null, không giữ byte thừa.
function docThan(req, tran) {
  const qua = n => n > tran;
  return new Promise(ok => {
    if (req.destroyed) return ok(null);   // đứt trước khi kịp nghe
    const ds = [];
    let n = 0;
    req.on('data', c => { n += c.length; if (!qua(n)) ds.push(c); else if (n > 64 * tran) req.destroy(); });
    req.on('end', () => ok(qua(n) ? null : Buffer.concat(ds)));
    req.on('error', () => {});
    req.on('close', () => ok(null));   // đứt giữa chừng; sau 'end' thì không có tác dụng
  });
}

// 'PHƯƠNG_THỨC /đường' → ({ ctx, ve, than, query }) ⇒ object trả 200 | ném LoiGoi. HEAD tra như GET.
export const ROUTE = {
  'GET /api/phien': ({ ve }) => ({ email: ve.email, het_luc: ve.het_luc }),
};

const THAN_VE = { 401: { loi: 'chua_dang_nhap' }, 403: { loi: 'cam' }, 503: { loi: 'chua_san' } };

export async function xuLy(ctx, req, res) {
  const raw = req.url || '', q = raw.indexOf('?'), p = q < 0 ? raw : raw.slice(0, q);
  let ve;
  try { ve = await kiemYeuCau(ctx.kiem, req); } catch (e) { return traJson(res, e.ma, THAN_VE[e.ma]); }
  let than = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    if (!kiemCsrf(req)) return traJson(res, 403, { loi: 'csrf' });
    than = await docThan(req, TRAN_THAN);
    if (than === null) return traJson(res, 413, { loi: 'than_qua_lon' });
  }
  const khoa = `${req.method === 'HEAD' ? 'GET' : req.method} ${p}`;
  if (!Object.hasOwn(ROUTE, khoa)) return traJson(res, 404, { loi: 'khong_co' });
  let o;
  try { o = await ROUTE[khoa]({ ctx, ve, than, query: q < 0 ? '' : raw.slice(q + 1) }); }
  catch (e) { return e instanceof LoiGoi ? traJson(res, e.ma, { loi: e.loi, ...(e.chi_tiet === null ? {} : { chi_tiet: e.chi_tiet }) }) : traJson(res, 500, { loi: 'loi_may_chu' }); }
  return traJson(res, 200, o);
}
