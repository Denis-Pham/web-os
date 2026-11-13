// Bộ định tuyến chung của web-os (thiết kế v0.2 mục 5.1–5.2): MỌI yêu cầu đi một đường, thứ tự cố định:
// kiemYeuCau (mọi phương thức, mọi đường) → khác GET/HEAD: kiemCsrf (403) rồi đọc thân trần 64 KiB (413) → mới tra ROUTE.
// Route ghi task sau thêm vào ROUTE là tự đi qua cùng cổng. Lỗi route: LoiGoi ⇒ e.ma chung; lỗi khác ⇒ 500 thân chung, không lộ thông điệp.
// CSRF + docThan chép từ Learning 630a0bf:may-chu/ghi.mjs (header X-Learning ⇒ X-WebOS); tra/DAU_AN_NINH từ 630a0bf:may-chu/may-chu.mjs.
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { kiemYeuCau } from './xac-thuc.mjs';
import { LoiGoi, apGoi, hoanTac, boQuaDeXuat, apDungDeXuat } from './goi.mjs';
import { docTepXuat, LUOC_TRANG_THAI, LUOC_VIEC_BO } from './xuat.mjs';
import { ghiBat, xem as xemBan, duyet as duyetBan, lui as luiBan, tuanTu, tepBan, tenDung, docTinh, SHA, MANIFEST } from './ban.mjs';

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

// Handler trả TraTho ⇒ tải về (Content-Disposition attachment) thay vì JSON 200.
export class TraTho { constructor(loai, than, ten_tep) { this.loai = loai; this.than = than; this.ten_tep = ten_tep; } }

// Route web: chủ thể LUÔN anh, nguồn LUÔN web (R8); khách không chọn được (khoá thân đóng ⇒ trường lạ 400).
const ANH = Object.freeze({ chu_the: 'anh', nguon: Object.freeze({ loai: 'web' }) });
const iso = ctx => new Date(ctx.bayGio()).toISOString();
const gioVn = ctx => new Date(ctx.bayGio() + 7 * 3600e3).toISOString();   // giờ VN UTC+7 (GIẢ ĐỊNH thiết kế 8): slice 10 = ngày, 16 = phút
// Một cổng cho mọi route ghi kho: gọi ĐẦU handler, trước mọi đọc thân/kho.
function kiemCosGhi(ctx) { if (ctx.ch.cosGhi !== true) throw new LoiGoi(423, 'cos_ghi_tat'); }
// Cửa duyệt bản (thiết kế 6): route ghi bản chỉ bật khi bản phục vụ thuộc chính máy chủ (ban.mjs ghiBat); gọi ĐẦU handler.
function kiemGhiBan(ctx) { if (!ghiBat(ctx.ch)) throw new LoiGoi(423, 'ghi_tat'); }
const khop = (re, s) => typeof s === 'string' && re.test(s);
// fatal: byte UTF-8 hỏng ⇒ ném (Buffer.toString thay bằng U+FFFD rồi lưu — soát A3); ignoreBOM: giữ BOM ⇒ JSON.parse từ chối như trước.
const UTF8 = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });
function docJson(than, khoa) {
  let o;
  try { o = JSON.parse(UTF8.decode(than)); } catch { throw new LoiGoi(400, 'json'); }
  if (typeof o !== 'object' || o === null || Array.isArray(o)) throw new LoiGoi(400, 'json');
  for (const k of Object.keys(o)) if (!khoa.includes(k)) throw new LoiGoi(400, 'luoc_do', { ly_do: 'khoa_la' });
  return o;
}
const saiQuery = truong => new LoiGoi(400, 'query', { truong });
// Query khoá đóng: tham số lạ hay lặp ⇒ 400; trả { khoá: giá trị } (vắng ⇒ undefined).
function docQuery(query, khoa) {
  const o = {};
  for (const [k, v] of new URLSearchParams(query)) {
    if (!khoa.includes(k) || Object.hasOwn(o, k)) throw saiQuery(k);
    o[k] = v;
  }
  return o;
}
const NGAY = /^\d{4}-\d{2}-\d{2}$/;
const ngayThat = s => NGAY.test(s) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const laIso = s => typeof s === 'string' && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s;

const COT_VIEC = 'id, tieu_de, han, danh_sach, ghi_chu, xong_luc, mach, phien_ban';
const COT_LICH = 'id, tieu_de, bat_dau, ket_thuc, ca_ngay, nhac_truoc_phut, dia_diem, phien_ban';
const VIEC_MO = 'FROM viec WHERE xoa_luc IS NULL AND xong_luc IS NULL';
const THU_TU_VIEC = 'ORDER BY han IS NULL, han, tao_luc, id';
const tat = (db, sql, ...a) => db.prepare(sql).all(...a).map(r => ({ ...r }));
// Lịch phủ [tu, den] (ngày VN): bắt đầu ≤ den và kết thúc (hoặc bắt đầu) ≥ tu.
const lichPhu = (db, tu, den) => tat(db, `SELECT ${COT_LICH} FROM lich WHERE xoa_luc IS NULL AND substr(bat_dau, 1, 10) <= ? AND substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ? ORDER BY bat_dau, id`, den, tu);
const viecHanNgay = (db, ngay) => tat(db, `SELECT ${COT_VIEC} ${VIEC_MO} AND substr(han, 1, 10) = ? ${THU_TU_VIEC}`, ngay);
// Nhật ký: 24 giờ gần nhất (tu chỉ thu hẹp), mới trước, ≤ 200 dòng.
function nhatKy(ctx, tu) {
  const san = new Date(ctx.bayGio() - 24 * 3600e3).toISOString();
  return tat(ctx.db, 'SELECT * FROM nhat_ky WHERE luc >= ? ORDER BY id DESC LIMIT 200', tu !== undefined && tu > san ? tu : san)
    .map(n => ({ ...n, truoc: JSON.parse(n.truoc), sau: JSON.parse(n.sau) }));
}

// CSV RFC 4180; ô mở đầu = + - @ TAB CR ⇒ thêm ' (chống công thức khi mở bằng bảng tính).
function oCsv(v) {
  if (v === null || v === undefined) return '';
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}
const COT_CSV = ['loai', 'id', 'tieu_de', 'han', 'danh_sach', 'ghi_chu', 'mach', 'bat_dau', 'ket_thuc', 'ca_ngay', 'nhac_truoc_phut', 'dia_diem'];

// Khối màn chủ dựa tệp xuất (A6 docTepXuat): trả nguyên trạng thái + giờ dựng; du_lieu là phần của khối (DỮ LIỆU, không diễn giải).
const CHUA_NOI = Object.freeze({ trang_thai: 'chua_noi' });
const khoiTep = (kq, lay) => ({ trang_thai: kq.trang_thai, du_lieu: kq.du_lieu === null ? null : lay(kq.du_lieu), gio_dung: kq.gio_dung });

// 'PHƯƠNG_THỨC /đường' → ({ ctx, ve, than, query, id }) ⇒ object trả 200 | TraTho | ném LoiGoi. HEAD tra như GET.
// Đoạn ':id' chỉ khớp UUID chữ thường (id kho là randomUUID()), không giải mã %.
export const ROUTE = {
  'GET /api/phien': ({ ve, query }) => { docQuery(query, []); return { email: ve.email, het_luc: ve.het_luc }; },
  'GET /api/viec': ({ ctx, query }) => {
    const q = docQuery(query, ['mo', 'mach']);
    if (q.mo !== undefined && q.mo !== '1') throw saiQuery('mo');
    const dk = [q.mo === '1' ? 'AND xong_luc IS NULL' : '', q.mach !== undefined ? 'AND mach = ?' : ''].join(' ');
    return { viec: tat(ctx.db, `SELECT ${COT_VIEC} FROM viec WHERE xoa_luc IS NULL ${dk} ${THU_TU_VIEC}`, ...(q.mach !== undefined ? [q.mach] : [])) };
  },
  'GET /api/lich': ({ ctx, query }) => {
    const { tu, den } = docQuery(query, ['tu', 'den']);
    if (!ngayThat(tu)) throw saiQuery('tu');
    if (!ngayThat(den) || den < tu || Date.parse(den) - Date.parse(tu) > 61 * 86400e3) throw saiQuery('den');   // ≤ 62 ngày tính cả hai đầu
    return { lich: lichPhu(ctx.db, tu, den) };
  },
  'POST /api/goi': ({ ctx, than }) => {
    kiemCosGhi(ctx);
    const { khoa_lap, ops } = docJson(than, ['khoa_lap', 'ops']);
    const { goi_id, ma_hoan, ket_qua } = apGoi(ctx.db, { khoa_lap, ops, ...ANH }, iso(ctx));
    return { goi_id, ma_hoan, ket_qua };
  },
  'POST /api/hoan': ({ ctx, than }) => {
    kiemCosGhi(ctx);
    const { ma_hoan } = docJson(than, ['ma_hoan']);
    if (typeof ma_hoan !== 'string') throw new LoiGoi(400, 'luoc_do', { ly_do: 'ma_hoan' });   // thiếu/sai kiểu là lược đồ, không phải 404 (soát A3)
    return hoanTac(ctx.db, { ma_hoan, ...ANH }, iso(ctx));
  },
  'GET /api/nhat-ky': ({ ctx, query }) => {
    const { tu } = docQuery(query, ['tu']);
    if (tu !== undefined && !laIso(tu)) throw saiQuery('tu');
    return { nhat_ky: nhatKy(ctx, tu) };
  },
  'GET /api/de-xuat': ({ ctx, query }) => {
    const { mach } = docQuery(query, ['mach']);
    const ds = tat(ctx.db, `SELECT id, mach, chu_the, noi_dung, ops, phien_ban, tao_luc FROM de_xuat WHERE trang_thai = 'cho' ${mach !== undefined ? 'AND mach = ?' : ''} ORDER BY tao_luc, id`, ...(mach !== undefined ? [mach] : []));
    return { de_xuat: ds.map(d => ({ ...d, ops: JSON.parse(d.ops) })) };
  },
  'POST /api/de-xuat/:id/bo-qua': ({ ctx, than, id }) => {
    kiemCosGhi(ctx);
    docJson(than, []);
    return boQuaDeXuat(ctx.db, { id, ...ANH }, iso(ctx));
  },
  'POST /api/de-xuat/:id/ap-dung': ({ ctx, than, id }) => {
    kiemCosGhi(ctx);
    const { khoa_lap } = docJson(than, ['khoa_lap']);
    return apDungDeXuat(ctx.db, { id, khoa_lap, ...ANH }, iso(ctx));
  },
  'GET /api/cai-tien': ({ ctx, query }) => {
    docQuery(query, []);
    return { cai_tien: tat(ctx.db, 'SELECT id, ngay, mach, loai, mon, duong, noi_dung, trang_thai, phien_ban FROM cai_tien WHERE xoa_luc IS NULL ORDER BY tao_luc, id') };
  },
  // Mỗi lần đổi là một gói anh mới (khoá lặp ngẫu nhiên): bấm hai lần ⇒ lần hai 409 phien_ban; Hoàn tác được như mọi gói.
  'POST /api/cai-tien/:id/trang-thai': ({ ctx, than, id }) => {
    kiemCosGhi(ctx);
    const { trang_thai, phien_ban } = docJson(than, ['trang_thai', 'phien_ban']);
    const { goi_id, ma_hoan, ket_qua } = apGoi(ctx.db, { khoa_lap: randomUUID(), ops: [{ loai: 'sua', bang: 'cai_tien', id, phien_ban, truong: { trang_thai } }], ...ANH }, iso(ctx));
    return { goi_id, ma_hoan, ket_qua };
  },
  'GET /api/tien-do': ({ ctx, query }) => {
    const { viec } = docQuery(query, ['viec']);
    if (viec === undefined) throw saiQuery('viec');
    return { tien_do: tat(ctx.db, 'SELECT id, ghi, phan_tram, phien_ban FROM tien_do WHERE xoa_luc IS NULL AND doi_tuong = ? ORDER BY tao_luc, id', 'viec:' + viec) };
  },
  // Brief sáng (thiết kế 13): đếm thẳng từ kho lúc gọi, giờ VN. Quá hạn: hạn ngày < hôm nay, hạn có giờ < bây giờ (như so-dem.json).
  'GET /api/brief': ({ ctx, query }) => {
    docQuery(query, []);
    const vn = gioVn(ctx), homNay = vn.slice(0, 10), dem = (sql, ...a) => ctx.db.prepare(`SELECT count(*) AS n ${sql}`).get(...a).n;
    return {
      qua_han: dem(`${VIEC_MO} AND han < CASE WHEN length(han) = 10 THEN ? ELSE ? END`, homNay, vn.slice(0, 16)),
      han_hom_nay: dem(`${VIEC_MO} AND substr(han, 1, 10) = ?`, homNay),
      lich_hom_nay: lichPhu(ctx.db, homNay, homNay).length,
      de_xuat_cho: dem("FROM de_xuat WHERE trang_thai = 'cho'"),
    };
  },
  // Xuất danh sách (thiết kế 9, lùi lễ CoS): việc mở + lịch chưa qua (ngày VN). Chỉ đọc ⇒ không qua cổng cosGhi.
  'GET /api/xuat-viec': ({ ctx, query }) => {
    const { dang } = docQuery(query, ['dang']);
    if (dang !== 'json' && dang !== 'csv') throw saiQuery('dang');
    const homNay = gioVn(ctx).slice(0, 10), ten_tep = `viec-mo-${homNay}.${dang}`;
    const viec = tat(ctx.db, `SELECT id, tieu_de, han, danh_sach, ghi_chu, mach ${VIEC_MO} ${THU_TU_VIEC}`);
    const lich = tat(ctx.db, 'SELECT id, tieu_de, bat_dau, ket_thuc, ca_ngay, nhac_truoc_phut, dia_diem FROM lich WHERE xoa_luc IS NULL AND substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ? ORDER BY bat_dau, id', homNay);
    if (dang === 'json') return new TraTho('application/json; charset=utf-8', JSON.stringify({ viec, lich }), ten_tep);
    const dong = [...viec.map(v => ({ loai: 'viec', ...v })), ...lich.map(l => ({ loai: 'lich', ...l }))];
    return new TraTho('text/csv; charset=utf-8', [COT_CSV, ...dong.map(d => COT_CSV.map(c => d[c]))].map(h => h.map(oCsv).join(',')).join('\r\n') + '\r\n', ten_tep);
  },
  // Màn chủ (thiết kế 8): 8 khối; khối không nguồn ⇒ chua_noi, không số bịa.
  'GET /api/man-chu': ({ ctx, query }) => {
    docQuery(query, []);
    const vao = ctx.ch.thuMucXuatVao, homNay = gioVn(ctx).slice(0, 10);
    const tt = vao === undefined ? null : docTepXuat(path.join(vao, 'trang-thai.json'), LUOC_TRANG_THAI);
    const bo = vao === undefined ? null : docTepXuat(path.join(vao, 'viec-bo.json'), LUOC_VIEC_BO);
    const tuTep = k => (tt === null ? CHUA_NOI : khoiTep(tt, d => d[k]));
    return {
      xai_duoc: tuTep('xai_duoc'), cho_anh: tuTep('cho_anh'), suc_khoe: tuTep('suc_khoe'), tien_do: tuTep('tien_do'),
      agent_dang_chay: CHUA_NOI, chi_phi_token: CHUA_NOI,
      nhat_ky: { trang_thai: 'tot', du_lieu: { kho: nhatKy(ctx), tong_quan: tuTep('nhat_ky') } },
      lich_hom_nay: { trang_thai: 'tot', du_lieu: {
        lich: lichPhu(ctx.db, homNay, homNay), viec: viecHanNgay(ctx.db, homNay),
        viec_bo: bo === null ? CHUA_NOI : khoiTep(bo, d => d.viec.filter(v => !v.xong && v.han?.slice(0, 10) === homNay)),
      } },
    };
  },
  // Cửa duyệt bản (thiết kế 6, A5): xem/duyệt/lùi chạy tuanTu (hai lần bấm không chép chồng); /api/ban/tep chỉ đọc ⇒ không cần ghiBat.
  'GET /api/ban': ({ ctx, query }) => {
    kiemGhiBan(ctx);
    docQuery(query, []);
    return tuanTu(() => xemBan(ctx.ch));
  },
  'POST /api/ban/duyet': ({ ctx, than }) => {
    kiemGhiBan(ctx);
    const { sha, manifest } = docJson(than, ['sha', 'manifest']);
    if (!khop(SHA, sha)) throw new LoiGoi(400, 'luoc_do', { ly_do: 'sha' });
    if (!khop(MANIFEST, manifest)) throw new LoiGoi(400, 'luoc_do', { ly_do: 'manifest' });
    return tuanTu(() => duyetBan(ctx.ch, sha, manifest));
  },
  'POST /api/ban/lui': ({ ctx, than }) => {
    kiemGhiBan(ctx);
    const { sha } = docJson(than, ['sha']);
    if (!khop(SHA, sha)) throw new LoiGoi(400, 'luoc_do', { ly_do: 'sha' });
    return tuanTu(() => luiBan(ctx.ch, sha));
  },
  // manifest bắt buộc (soát A8): manifest anh thấy ở GET /api/ban; bản chờ đổi từ lúc đó ⇒ 409 (nội dung xem gắn với manifest sẽ duyệt).
  'GET /api/ban/tep': ({ ctx, query }) => {
    const { sha, ten, manifest } = docQuery(query, ['sha', 'ten', 'manifest']);
    if (!khop(SHA, sha)) throw saiQuery('sha');
    if (!tenDung(ten)) throw saiQuery('ten');
    if (!khop(MANIFEST, manifest)) throw saiQuery('manifest');
    return tepBan(ctx.ch, sha, ten, manifest);
  },
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  // GET/HEAD ngoài /api/: /phuc-hoi(.js) hoặc tệp của bản đã duyệt (ban.mjs docTinh) — vẫn sau cổng vé.
  if ((req.method === 'GET' || req.method === 'HEAD') && !p.startsWith('/api/')) return tra(res, ...await docTinh(ctx.ch, p));
  // Đoạn UUID đầu tiên ⇒ ':id'; «:id» viết thẳng trong đường (không có UUID) ⇒ 404.
  const doan = p.split('/'), i = doan.findIndex(d => UUID.test(d)), id = i < 0 ? null : doan[i];
  if (i >= 0) doan[i] = ':id';
  const khoa = `${req.method === 'HEAD' ? 'GET' : req.method} ${doan.join('/')}`;
  if (!Object.hasOwn(ROUTE, khoa) || (id === null && khoa.includes(':id'))) return traJson(res, 404, { loi: 'khong_co' });
  const query = q < 0 ? '' : raw.slice(q + 1);
  let o;
  // Lệnh ghi (than ≠ null) không nhận query: khác rỗng ⇒ 400, trước handler (soát A3: POST bỏ qua query lạ).
  try { if (than !== null) docQuery(query, []); o = await ROUTE[khoa]({ ctx, ve, than, query, id }); }
  catch (e) { return e instanceof LoiGoi ? traJson(res, e.ma, { loi: e.loi, ...(e.chi_tiet === null ? {} : { chi_tiet: e.chi_tiet }) }) : traJson(res, 500, { loi: 'loi_may_chu' }); }
  if (o instanceof TraTho) return tra(res, 200, o.than, o.loai, { 'Content-Disposition': `attachment; filename="${o.ten_tep}"` });
  return traJson(res, 200, o);
}
