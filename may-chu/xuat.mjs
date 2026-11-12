// Tệp xuất (thiết kế v0.2 mục 4, 8, 16.1). Đọc tệp do bên khác dựng (trang-thai.json, viec-bo.json) theo lược đồ ĐÓNG: là DỮ LIỆU,
// hỏng ⇒ giữ bản tốt cuối; ghi so-dem.json (chỉ số, không tiêu đề/nội dung) cho dung-trang.py đọc.
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';

// Lược đồ: số ⇒ đúng hằng đó · 'chu' chuỗi ≤ 500 ký tự · 'chu?' chuỗi hoặc null · 'bool' · 'dem' số nguyên ≥ 0 · 'iso' giờ ISO có múi
// · [x] mảng ≤ 200 phần tử dạng x · { … } object có ĐÚNG các khoá đó (lạ hay thiếu ⇒ hỏng).
const C = 'chu', CN = 'chu?';
export const LUOC_VIEC_BO = { luoc_do: 1, gio_dung: 'iso', viec: [{ id: C, ten: C, han: CN, lap: CN, xong: 'bool', sua_luc: CN }] };
export const LUOC_TRANG_THAI = {
  luoc_do: 1, gio_dung: 'iso', xai_duoc: [{ mach: C, ten: C, lam_gi: C, o_dau: C }], cho_anh: [{ ma: C, tieu_de: C, mach: C, hanh_dong: C }],
  suc_khoe: [{ ten: C, trang_thai: C }], tien_do: [{ mach: C, buoc_ke: C, dang_lam: C }], nhat_ky: [{ luc: C, dong: C }],
};
export const LUOC_SO_DEM = { luoc_do: 1, gio_dung: 'iso', viec_mo: 'dem', qua_han: 'dem', lich_hom_nay: 'dem', de_xuat_cho: 'dem' };

const ISO = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,6})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;
function laIso(v) {
  const m = typeof v === 'string' ? ISO.exec(v) : null;
  return m !== null && Number(m[3]) <= new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate();   // ngày có thật (30/02 sai)
}

function hop(luat, v) {
  if (typeof luat === 'number') return v === luat;
  if (luat === 'chu') return typeof v === 'string' && [...v].length <= 500;   // đếm điểm mã như len() của Python (bên dựng)
  if (luat === 'chu?') return v === null || hop('chu', v);
  if (luat === 'bool') return typeof v === 'boolean';
  if (luat === 'dem') return Number.isSafeInteger(v) && v >= 0;
  if (luat === 'iso') return laIso(v);
  if (Array.isArray(luat)) return Array.isArray(v) && v.length <= 200 && v.every(x => hop(luat[0], x));
  return typeof v === 'object' && v !== null   // mảng rơi ở bước khoá bắt buộc (mọi lược đồ object có khoá)
    && Object.keys(v).every(k => Object.hasOwn(luat, k))
    && Object.keys(luat).every(k => Object.hasOwn(v, k) && hop(luat[k], v[k]));
}

// Đọc tối đa tran + 1 byte; vượt trần ⇒ ném (người gọi coi là hỏng).
function docGioiHan(fd, tran) {
  const buf = Buffer.alloc(tran + 1);
  let n = 0;
  for (let r; n < buf.length && (r = fs.readSync(fd, buf, n, buf.length - n, null)) > 0;) n += r;
  if (n > tran) throw new Error('tệp xuất quá trần');
  return buf.subarray(0, n);
}

const TOT_CUOI = new Map();   // đường ⇒ { du_lieu, gio_dung } bản tốt cuối, trong bộ nhớ tiến trình
const MO = fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK;   // symlink ⇒ ELOOP; FIFO không treo tiến trình

export function docTepXuat(duong, luocDo, { tranByte = 2 * 1024 * 1024, cuSauMs = 3 * 3600 * 1000 } = {}) {
  const hong = () => ({ trang_thai: 'hong', du_lieu: null, gio_dung: null, ...TOT_CUOI.get(duong) });
  let fd, du_lieu;
  try { fd = fs.openSync(duong, MO); } catch (e) { return e.code === 'ENOENT' ? { trang_thai: 'thieu', du_lieu: null, gio_dung: null } : hong(); }
  try { du_lieu = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(docGioiHan(fd, tranByte))); } catch { return hong(); } finally { fs.closeSync(fd); }
  if (!hop(luocDo, du_lieu)) return hong();
  TOT_CUOI.set(duong, { du_lieu, gio_dung: du_lieu.gio_dung });
  return { trang_thai: Date.now() - Date.parse(du_lieu.gio_dung) > cuSauMs ? 'cu' : 'tot', du_lieu, gio_dung: du_lieu.gio_dung };
}

// so-dem.json: chỉ số theo giờ VN (UTC+7) lúc bayGio. Quá hạn: hạn ngày < hôm nay, hạn có giờ < bây giờ. Lịch hôm nay: lịch phủ hôm nay.
// Ghi nguyên tử: tệp tạm O_EXCL cùng thư mục rồi đổi tên (thay luôn symlink nếu có, không ghi xuyên); 0644 vì chỉ có số, quyền đọc do thư mục giữ.
export function ghiSoDem(db, thuMucXuat, bayGio) {
  const luc = new Date(bayGio), vn = new Date(luc.getTime() + 7 * 3600e3).toISOString(), homNay = vn.slice(0, 10);
  const dem = (sql, ...a) => db.prepare(sql).get(...a).n, MO_VIEC = 'FROM viec WHERE xoa_luc IS NULL AND xong_luc IS NULL';
  const so = {
    luoc_do: 1, gio_dung: luc.toISOString(),
    viec_mo: dem(`SELECT count(*) AS n ${MO_VIEC}`),
    qua_han: dem(`SELECT count(*) AS n ${MO_VIEC} AND han < CASE WHEN length(han) = 10 THEN ? ELSE ? END`, homNay, vn.slice(0, 16)),
    lich_hom_nay: dem('SELECT count(*) AS n FROM lich WHERE xoa_luc IS NULL AND substr(bat_dau, 1, 10) <= ? AND substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ?', homNay, homNay),
    de_xuat_cho: dem("SELECT count(*) AS n FROM de_xuat WHERE trang_thai = 'cho'"),
  };
  const tam = path.join(thuMucXuat, `.so-dem.${randomBytes(6).toString('hex')}.tam`);
  try {
    fs.writeFileSync(tam, JSON.stringify(so), { flag: 'wx' });
    fs.chmodSync(tam, 0o644);
    fs.renameSync(tam, path.join(thuMucXuat, 'so-dem.json'));
  } catch (e) { fs.rmSync(tam, { force: true }); throw e; }
  return so;
}
