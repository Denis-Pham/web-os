// Đột biến máy chủ web-os (R7). Chuyển thể từ Learning kiem/dot-bien-may-chu.mjs @630a0bf, vá lỗi xanh-sai của bản đó
// (mọi rc ≠ 0, kể cả hết giờ, tính «diệt»; còn đột biến sống vẫn thoát 0).
// Dùng: node kiem/dot-bien-may-chu.mjs [NHÓM …]   (vd A1; bỏ trống = mọi nhóm). Thoát 0 CHỈ khi gốc xanh và MỌI đột biến DIỆT.
// Pha B: phần tử thứ 5 (tuỳ chọn) = mảng tệp test của đột biến (vắng ⇒ test-may-chu/*.test.mjs); gốc chạy MỌI bộ tệp test có mặt, mỗi đột biến
// so số test với gốc CỦA BỘ ĐÓ; bộ có test-web/ hạn 240 s; con chạy với WEB_DOI_CHUNG=0 (cấy đối chứng của test trình duyệt tắt).
// Chép từng tệp của `git ls-files` (đã theo dõi + chưa theo dõi mà không bị .gitignore) sang thư mục tạm — không rsync/cp -R,
// không symlink (symlink ghi xuyên về nguồn thật). Bản chép CHƯA đột biến chạy trước: không xanh ⇒ «GỐC ĐỎ», thoát 1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url))), NODE = process.execPath, HAN_MS = 60000, HAN_WEB_MS = 240000;
const BO_MAC_DINH = ['test-may-chu/*.test.mjs'];
const KHO = 'may-chu/kho.mjs', GOI = 'may-chu/goi.mjs';
const XT = 'may-chu/xac-thuc.mjs', API = 'may-chu/api.mjs', MC = 'may-chu/may-chu.mjs', CH = 'may-chu/cau-hinh.mjs';
const SL = 'may-chu/sao-luu.mjs', XU = 'may-chu/xuat.mjs', KER = 'may-chu/kernel.mjs', BAN = 'may-chu/ban.mjs';
const DOM = 'web/dom.js', MAN_CHU = 'web/man-chu.js', T_KHUNG = ['test-web/khung.test.mjs'], T_MAN_CHU = ['test-web/man-chu.test.mjs'], T_TINH = ['test-web/tinh.test.mjs'];
const PHIEN = 'web/phien.js', API_WEB = 'web/api.js', KHUNG = 'web/khung.js', T_PHIEN = ['test-web/phien.test.mjs'];
const SW = 'web/sw.js', T_SW = ['test-web/sw.test.mjs'];
const BAN_UI = 'web/ban.js', T_BAN_UI = ['test-web/ban-ui.test.mjs'], T_PHUC_HOI = ['test-web/phuc-hoi.test.mjs'];
const VL = 'web/viec-lich.js', VG = 'web/viec-ghi.js', T_VL = ['test-web/viec-lich.test.mjs'];
const HA = 'may-chu/hoi-ai.mjs', T_AI = ['test-may-chu/hoi-ai.test.mjs'];
const LOI_403_HOAN = "throw new LoiGoi(403, 'quyen', { bang: 'goi_ghi', loai: 'hoan_tac' });\n";

// [tên, tệp, chuỗi gốc (phải khớp ĐÚNG 1 chỗ), chuỗi thay]. Mỗi cổng hai đột biến: trong hàm (-ham) và ở chỗ gọi (-goi).
const NHOM = {
  A1: [
    // 11 đột biến bắt buộc (Step 5)
    ['khoa-lap-unique', KHO, 'khoa_lap TEXT NOT NULL UNIQUE', 'khoa_lap TEXT NOT NULL'],
    ['trigger-nhat-ky-ca-hai', KHO, "CREATE TRIGGER IF NOT EXISTS nhat_ky_khong_sua BEFORE UPDATE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;\nCREATE TRIGGER IF NOT EXISTS nhat_ky_khong_xoa BEFORE DELETE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;\n", ''],
    ['phien-ban-ham', GOI, 'function kiemPhienBan(dong, op) {\n', 'function kiemPhienBan(dong, op) {\n  return;\n'],
    ['phien-ban-goi', GOI, "  if (loai !== 'them') kiemPhienBan(truoc, op);\n", ''],
    ['kiem-ops-ham', GOI, 'export function kiemOps(ops) {\n', 'export function kiemOps(ops) {\n  return ops;\n'],
    ['kiem-ops-goi', GOI, 'const chuan = kiemOps(ops);', 'const chuan = ops;'],
    ['hoan-bo-so-phien-ban', GOI, "      if (hien.phien_ban !== d.phien_ban) throw new LoiGoi(409, 'da_sua_sau', { bang: d.bang, id: d.id });\n", ''],
    ['hoan-tra-phien-ban-cu', GOI, '{ ...ve, phien_ban: hien.phien_ban + 1 }', '{ ...ve, phien_ban: d.truoc ? d.truoc.phien_ban : 1 }'],
    ['kiem-quyen-ham', GOI, 'export function kiemQuyen(chu_the, nguon, ops) {\n', 'export function kiemQuyen(chu_the, nguon, ops) {\n  return;\n'],
    ['kiem-quyen-goi', GOI, '  kiemQuyen(chu_the, nguon, chuan);\n', ''],
    ['nguon-gieo-index', KHO, 'CREATE UNIQUE INDEX IF NOT EXISTS viec_nguon_gieo ON viec(nguon_gieo) WHERE nguon_gieo IS NOT NULL;\n', ''],
    // Sổ chỉ thêm + giao dịch
    ['trigger-khong-sua', KHO, "CREATE TRIGGER IF NOT EXISTS nhat_ky_khong_sua BEFORE UPDATE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;\n", ''],
    ['trigger-khong-xoa', KHO, "CREATE TRIGGER IF NOT EXISTS nhat_ky_khong_xoa BEFORE DELETE ON nhat_ky BEGIN SELECT RAISE(ABORT, 'nhat_ky_chi_them'); END;\n", ''],
    ['giao-dich-rollback-ham', KHO, "catch (e) { if (db.isTransaction) db.exec('ROLLBACK'); throw e; }", 'catch (e) { throw e; }'],
    ['giao-dich-ap-goi', GOI, 'const opsJson = JSON.stringify(chuan);\n  return trongGiaoDich(db, () => {', 'const opsJson = JSON.stringify(chuan);\n  return (f => f())(() => {'],
    ['giao-dich-hoan-goi', GOI, 'const nguonJson = kiemNguon(nguon);\n  return trongGiaoDich(db, () => {', 'const nguonJson = kiemNguon(nguon);\n  return (f => f())(() => {'],
    ['nhat-ky-bo-ghi', GOI, "  db.prepare('INSERT INTO nhat_ky (luc, chu_the, nguon, goi_id, bang, dong_id, truoc, sau) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')\n    .run(bayGio, chu_the, nguon, goi_id, bang, id, truoc ? JSON.stringify(truoc) : null, JSON.stringify(sau));\n", ''],
    ['nhat-ky-bo-truoc', GOI, 'truoc ? JSON.stringify(truoc) : null, JSON.stringify(sau)', 'null, JSON.stringify(sau)'],
    // R8 nguồn: hàm kiemNguon + hai chỗ gọi; nhat_ky.nguon = loai, goi_ghi.nguon = JSON đủ
    ['nguon-ham-loai', GOI, ' || !NGUON.includes(nguon.loai)', ''],
    ['nguon-ham-khoa-la', GOI, "  if (Object.keys(nguon).some(k => !['loai', 'kenh', 'tin_id'].includes(k))) throw saiLuocDo({ ly_do: 'nguon_khoa_la' });\n", ''],
    ['nguon-ham-tran', GOI, "typeof nguon[k] === 'string' && nguon[k].length <= 100", "typeof nguon[k] === 'string'"],
    ['nguon-ham-kieu', GOI, "typeof nguon[k] === 'string' && nguon[k].length <= 100", 'nguon[k].length <= 100'],
    ['nguon-ham-json', GOI, "JSON.stringify(nguon, ['loai', 'kenh', 'tin_id'])", 'JSON.stringify({ loai: nguon.loai })'],
    ['nguon-goi-ap', GOI, '  const nguonJson = kiemNguon(nguon);\n  const chuan', '  const nguonJson = JSON.stringify(nguon);\n  const chuan'],
    ['nguon-goi-hoan', GOI, 'const nguonJson = kiemNguon(nguon);\n  return trongGiaoDich', 'const nguonJson = JSON.stringify(nguon);\n  return trongGiaoDich'],
    ['nguon-nhat-ky', GOI, 'const ng = { goi_id: randomUUID(), chu_the, nguon: nguon.loai, bayGio };\n    const ket_qua = chuan', 'const ng = { goi_id: randomUUID(), chu_the, nguon: nguonJson, bayGio };\n    const ket_qua = chuan'],
    // R9 khoá lặp
    ['khoa-lap-ham', GOI, 'const KHOA_LAP = /^[A-Za-z0-9_-]{8,100}$/;', 'const KHOA_LAP = /^.{1,}$/;'],
    ['khoa-lap-kieu', GOI, "typeof khoa_lap !== 'string' || ", ''],
    ['khoa-lap-goi', GOI, "  if (typeof khoa_lap !== 'string' || !KHOA_LAP.test(khoa_lap)) throw saiLuocDo({ ly_do: 'khoa_lap' });\n", ''],
    ['r9-bo-so-chu-the', GOI, 'cu.chu_the !== chu_the || ', ''],
    ['r9-bo-so-ops', GOI, ' || cu.ops !== opsJson', ''],
    ['r9-bo-chuan-hoa', GOI, 'Object.keys(t).sort().map', 'Object.keys(t).map'],
    // Bảng quyền: từng ô + luật cai_tien chỉ trang_thai
    ['quyen-cai-tien-chi-trang-thai', GOI, "    if (bang === 'cai_tien' && loai === 'sua' && Object.keys(truong).some(k => k !== 'trang_thai')) throw new LoiGoi(403, 'quyen', { bang, loai });", ''],
    ['quyen-neo-xoa-viec', GOI, "viec: ['them', 'sua', 'xong', 'mo_lai'], lich", "viec: ['them', 'sua', 'xong', 'mo_lai', 'xoa'], lich"],
    ['quyen-neo-xoa-lich', GOI, "lich: ['them', 'sua', 'xong', 'mo_lai'], cai_tien", "lich: ['them', 'sua', 'xong', 'mo_lai', 'xoa'], cai_tien"],
    ['quyen-neo-tien-do', GOI, "cai_tien: ['them'] } },", "cai_tien: ['them'], tien_do: ['them', 'sua'] } },"],
    ['quyen-neo-sua-cai-tien', GOI, "cai_tien: ['them'] } },", "cai_tien: ['them', 'sua', 'xoa'] } },"],
    ['quyen-anh-xoa-tien-do', GOI, "tien_do: ['them', 'sua'], cai_tien: ['sua'] }", "tien_do: ['them', 'sua', 'xoa'], cai_tien: ['sua'] }"],
    ['quyen-anh-them-cai-tien', GOI, "cai_tien: ['sua'] }", "cai_tien: ['sua', 'them', 'xoa'] }"],
    ['quyen-tu-chay', GOI, 'neo: { tin_anh:', 'neo: { tu_chay: QUYEN_ANH, tin_anh:'],
    ['quyen-neo-web', GOI, 'neo: { tin_anh:', 'neo: { web: QUYEN_ANH, de_xuat: QUYEN_ANH, tin_anh:'],
    ['quyen-anh-tin-anh', GOI, 'anh: { web: QUYEN_ANH,', 'anh: { tin_anh: QUYEN_ANH, tu_chay: QUYEN_ANH, web: QUYEN_ANH,'],
    ['quyen-hasown', GOI, 'Object.hasOwn(QUYEN, chu_the) && ', ''],
    // R6 tien_do gắn việc còn hiện
    ['r6-ham', GOI, 'function kiemDoiTuong(db, doi_tuong, loai) {\n', 'function kiemDoiTuong(db, doi_tuong, loai) {\n  return;\n'],
    ['r6-goi', GOI, "  if (bang === 'tien_do') kiemDoiTuong(db, doi.doi_tuong ?? truoc.doi_tuong, loai);\n", ''],
    ['r6-goi-sua-khong-doi', GOI, "  if (bang === 'tien_do') kiemDoiTuong(", "  if (bang === 'tien_do' && doi.doi_tuong) kiemDoiTuong("],
    ['r6-con-hien', GOI, 'SELECT 1 FROM viec WHERE id = ? AND xoa_luc IS NULL', 'SELECT 1 FROM viec WHERE id = ?'],
    ['r6-neo-dau', GOI, '/^viec:(.+)$/', '/viec:(.+)$/'],
    ['phien-ban-da-xoa', GOI, 'dong.xoa_luc !== null || ', ''],
    ['trung-nguon-gieo-ma', GOI, "    if (e.errcode === 2067 && e.message.includes('viec.nguon_gieo')) throw new LoiGoi(409, 'trung_nguon_gieo');", ''],
    // Hoàn tác: một lần, quyền người bấm, R10, chạm đầu / chạm cuối, cột trả về
    ['hoan-luc-mot-lan', GOI, ' AND hoan_luc IS NULL', ''],
    ['hoan-neo-goi-anh', GOI, "    if (chu_the === 'neo' && goc.chu_the !== 'neo') " + LOI_403_HOAN, ''],
    ['hoan-quyen-nguon', GOI, '    if (!quyenCua(chu_the, nguon.loai)) ' + LOI_403_HOAN, ''],
    ['hoan-r10-xoa-cung', GOI, '      const ve = d.truoc ?', '      if (!d.truoc) { db.prepare(`DELETE FROM ${d.bang} WHERE id = ?`).run(d.id); return { bang: d.bang, id: d.id, phien_ban: 0 }; }\n      const ve = d.truoc ?'],
    ['hoan-cham-dau', GOI, 'if (!dong.has(`${n.bang}:${n.dong_id}`)) dong.set', 'dong.set'],
    ['hoan-cham-cuoi', GOI, 'for (const k of JSON.parse(goc.ket_qua))', 'for (const k of JSON.parse(goc.ket_qua).reverse())'],
    ['hoan-cot-xoa-luc', GOI, "'xoa_luc', ...(b === 'viec'", "...(b === 'viec'"],
    ['hoan-cot-xong-luc', GOI, "['xong_luc'] : []", '[] : []'],
    // kiemOps (R5, R11): từng điều kiện
    ['ops-mang', GOI, '!Array.isArray(ops) || ops.length < 1', 'ops.length < 1'],   // B3 3a: kiemDeXuatAI cũng có «!Array.isArray(ops) || »
    ['ops-it-nhat-1', GOI, 'ops.length < 1 || ', ''],
    ['ops-tran-40', GOI, 'ops.length > 40', 'ops.length > 41'],
    ['ops-loai', GOI, ' || !Object.hasOwn(KHOA_OP, op.loai)', ''],
    ['ops-khoa-la', GOI, "    if (Object.keys(op).some(k => !khoa.includes(k))) throw hong('khoa_la');\n", ''],
    ['ops-bang', GOI, "    if (typeof op.bang !== 'string' || !Object.hasOwn(LUOC, op.bang)) throw hong('bang');\n", ''],
    ['r5-chi-viec', GOI, " && op.bang !== 'viec') throw hong('chi_viec');", ") throw hong('chi_viec');"],
    ['r5-bo', GOI, "    if ((op.loai === 'xong' || op.loai === 'mo_lai') && op.bang !== 'viec') throw hong('chi_viec');", ''],
    ['ops-id', GOI, "      if (typeof op.id !== 'string' || op.id.length < 1 || op.id.length > 100) throw hong('id');\n", ''],
    ['ops-phien-ban', GOI, "      if (!Number.isInteger(op.phien_ban) || op.phien_ban < 1) throw hong('phien_ban');\n", ''],
    ['ops-truong-obj', GOI, '!laObj(t) || ', ''],
    ['ops-truong-rong', GOI, ' || Object.keys(t).length === 0', ''],
    ['ops-truong-la', GOI, '!Object.hasOwn(luoc, k) || ', ''],
    ['ops-gia-tri', GOI, ' || !hopLe(luoc[k], t[k])', ''],
    ['ops-bat-buoc', GOI, "      if (op.loai === 'them') for (const k of Object.keys(luoc)) if (luoc[k].bb && !Object.hasOwn(t, k)) throw hong('thieu', k);\n", ''],
    ['gt-null', GOI, 'return !luat.bb && !luat.nn;', 'return true;'],
    ['gt-null-nn', GOI, 'return !luat.bb && !luat.nn;', 'return !luat.bb;'],
    ['gt-chu-kieu', GOI, "typeof v === 'string' && !v.includes", '!v.includes'],
    ['gt-nul', GOI, " && !v.includes('\\0')", ''],
    ['gt-it', GOI, '[...v].length >= (luat.it ?? 0) && ', ''],
    ['gt-chu-tran', GOI, ' && [...v].length <= luat.chu', ''],
    ['gt-dem-ky-tu', GOI, '[...v].length <= luat.chu', 'v.length <= luat.chu'],
    ['gt-so-nguyen', GOI, 'Number.isInteger(v) && v >= luat.so[0]', "typeof v === 'number' && v >= luat.so[0]"],
    ['gt-so-min', GOI, ' && v >= luat.so[0]', ''],
    ['gt-so-max', GOI, ' && v <= luat.so[1]', ''],
    ['gt-chon', GOI, 'return luat.chon.includes(v);', 'return true;'],
    ['ngay-kieu', GOI, "typeof v === 'string' ? NGAY.exec(v) : null", 'NGAY.exec(v)'],
    ['ngay-neo-dau', GOI, 'const NGAY = /^(', 'const NGAY = /('],
    ['ngay-neo-cuoi', GOI, ')?$/;', ')?/;'],
    ['ngay-nam-duoi', GOI, 'nam >= 2000 && ', ''],
    ['ngay-nam-tren', GOI, ' && nam <= 2100', ''],
    ['ngay-thang-duoi', GOI, ' && thang >= 1', ''],
    ['ngay-thang-tren', GOI, ' && thang <= 12', ''],
    ['ngay-ngay-duoi', GOI, ' && ngay >= 1', ''],
    ['ngay-co-that', GOI, ' && ngay <= cuoiThang', ''],
    ['ngay-gio', GOI, ' && gio <= 23', ''],
    ['ngay-phut', GOI, ' && phut <= 59', ''],
    ['ngay-goi', GOI, '  if (luat.ngay) return laNgay(v);', '  if (luat.ngay) return true;'],   // bỏ hẳn dòng ⇒ luat.chon undefined ⇒ TypeError: đỏ vì lý do khác
    // Khoá tra bảng phải là chuỗi trước khi tra (soát A1 I1): Object.hasOwn ép ['cai_tien'] thành 'cai_tien'
    ['kieu-ops-loai', GOI, "typeof op.loai !== 'string' || ", ''],
    ['kieu-ops-bang', GOI, "typeof op.bang !== 'string' || ", ''],
    ['kieu-quyen-bang', GOI, "typeof bang !== 'string' || ", ''],
    ['kieu-quyen-chu-the', GOI, "typeof chu_the === 'string' && ", ''],
    ['kieu-quyen-nguon', GOI, "typeof loai === 'string' && ", ''],
    ['chu-the-ap-goi', GOI, "  if (!CHU_THE.includes(chu_the)) throw saiLuocDo({ ly_do: 'chu_the' });\n  const nguonJson = kiemNguon(nguon);\n  const chuan", '  const nguonJson = kiemNguon(nguon);\n  const chuan'],
    ['chu-the-hoan-tac', GOI, "  if (!CHU_THE.includes(chu_the)) throw saiLuocDo({ ly_do: 'chu_the' });\n  const nguonJson = kiemNguon(nguon);\n  return", '  const nguonJson = kiemNguon(nguon);\n  return'],
  ],
  A2: [
    // Bắt buộc Step 5: chữ ký, aud, email, iss (hàm + chỗ gọi trong kiem); kiemCsrf (hàm + chỗ gọi ở bộ định tuyến chung)
    ['chu-ky-ham', XT, 'function kiemChuKy(phan, k) {\n', 'function kiemChuKy(phan, k) {\n  return;\n'],
    ['chu-ky-goi', XT, '    kiemChuKy(phan, k);\n', ''],
    ['aud-ham', XT, 'function kiemAud(p, aud) {', 'function kiemAud(p, aud) { return;'],
    ['aud-goi', XT, '    kiemAud(p, aud);\n', ''],
    ['email-ham', XT, 'function kiemEmail(p, emails) {\n', 'function kiemEmail(p, emails) {\n  return;\n'],
    ['email-goi', XT, '    kiemEmail(p, choPhep);\n', ''],
    ['iss-ham', XT, 'function kiemIss(p, iss) {\n', 'function kiemIss(p, iss) {\n  return;\n'],
    ['iss-goi', XT, '    kiemIss(p, iss);\n', ''],
    ['csrf-ham', API, 'export function kiemCsrf(req) {\n', 'export function kiemCsrf(req) {\n  return true;\n'],
    ['csrf-goi', API, "    if (!kiemCsrf(req)) return traJson(res, 403, { loi: 'csrf' });\n", ''],
    // Hạn vé, JWKS lỗi không dùng khoá cũ, het_luc, mã 403 email
    ['han-ham', XT, 'function kiemHan(p, now) {\n', 'function kiemHan(p, now) {\n  return;\n'],
    ['han-goi', XT, '    kiemHan(p, now);\n', ''],
    ['han-exp', XT, ' || p.exp <= now', ''],
    ['han-nbf', XT, "  if (typeof p.nbf === 'number' && p.nbf > now + 60) throw new LoiXacThuc(401, 'chua_hieu_luc');\n", ''],
    ['email-403', XT, "throw new LoiXacThuc(403, 'email_la')", "throw new LoiXacThuc(401, 'email_la')"],
    ['het-luc', XT, 'het_luc: new Date(p.exp * 1000).toISOString()', 'het_luc: new Date(Date.now() + 600000).toISOString()'],
    ['jwks-loi-dung-khoa-cu', XT, "catch { throw new LoiXacThuc(503, 'khong_lay_duoc_khoa'); }", 'catch { /* dùng khoá cũ */ }'],
    ['jwks-bo-han-khoa', XT, ' || bayGio() - napLuc >= hanKhoa', ''],
    ['jwks-loi-trong-60s', XT, 'return loiCuoi ? Promise.reject(loiCuoi) : Promise.resolve();', 'return Promise.resolve();'],
    // kiemYeuCau ở bộ định tuyến chung (hàm + chỗ gọi), lỗi lạ ⇒ 401, mã vé đi nguyên (401/403/503)
    ['kiem-yeu-cau-ham', XT, 'export async function kiemYeuCau(kiem, req) {\n', "export async function kiemYeuCau(kiem, req) {\n  return { email: 'x', het_luc: 'x' };\n"],
    ['kiem-yeu-cau-goi', API, 'try { ve = await kiemYeuCau(ctx.kiem, req); }', "try { ve = { email: 'x', het_luc: 'x' }; }"],
    ['kiem-yeu-cau-loi-la', XT, "catch (e) { throw e instanceof LoiXacThuc ? e : new LoiXacThuc(401, 'jwt_sai_dang'); }", 'catch (e) { throw e; }'],
    ['ma-ve-chung', API, 'return traJson(res, e.ma, THAN_VE[e.ma]); }', 'return traJson(res, 401, THAN_VE[401]); }'],
    // CSRF từng điều kiện + phạm vi phương thức + thứ tự cổng
    ['csrf-x-webos', API, "  if (h['x-webos'] !== '1') return false;\n", ''],
    ['csrf-content-type', API, "  if (String(h['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return false;\n", ''],
    ['csrf-sec-fetch-site', API, "return h['sec-fetch-site'] === undefined || h['sec-fetch-site'] === 'same-origin';", 'return true;'],
    ['csrf-vang-sfs-chan', API, "return h['sec-fetch-site'] === undefined || h['sec-fetch-site'] === 'same-origin';", "return h['sec-fetch-site'] === 'same-origin';"],
    ['csrf-chi-post', API, "if (req.method !== 'GET' && req.method !== 'HEAD') {", "if (req.method === 'POST') {"],
    ['thu-tu-csrf-truoc-ve', API, '  let ve;\n', "  if (req.method === 'POST' && !kiemCsrf(req)) return traJson(res, 403, { loi: 'csrf' });\n  let ve;\n"],
    ['thu-tu-than-truoc-csrf', API, "    if (!kiemCsrf(req)) return traJson(res, 403, { loi: 'csrf' });\n    than = await docThan(req, TRAN_THAN);\n", "    than = await docThan(req, TRAN_THAN);\n    if (!kiemCsrf(req)) return traJson(res, 403, { loi: 'csrf' });\n"],
    // Trần thân 64 KiB (hàm + chỗ gọi)
    ['tran-than-ham', API, 'export const TRAN_THAN = 64 * 1024;', 'export const TRAN_THAN = 65 * 1024;'],
    ['tran-than-goi', API, "    if (than === null) return traJson(res, 413, { loi: 'than_qua_lon' });\n", ''],
    ['tran-than-chi-content-length', API, "req.on('end', () => ok(qua(n) ? null : Buffer.concat(ds)));", "req.on('end', () => ok(qua(Number(req.headers['content-length'] ?? 0)) ? null : Buffer.concat(ds)));"],
    // Ánh xạ lỗi route: LoiGoi ⇒ e.ma chung; lỗi khác ⇒ 500 không lộ thông điệp
    ['loi-goi-ma', API, '? traJson(res, e.ma, { loi: e.loi', '? traJson(res, 400, { loi: e.loi'],
    ['loi-khac-lo', API, "traJson(res, 500, { loi: 'loi_may_chu' }); }", 'traJson(res, 500, { loi: String(e.message) }); }'],
    // Socket: không gỡ đường không phải socket cũ của uid mình (hàm + chỗ gọi), mode 0660, cong chỉ 127.0.0.1
    ['socket-cu-loai', MC, 'if (!st.isSocket() || st.uid', 'if (st.uid'],
    ['socket-cu-uid', MC, ' || st.uid !== process.getuid()) throw', ') throw'],
    ['socket-cu-goi', MC, '  goSocketCu(duong);\n', '  fs.rmSync(duong, { force: true });\n'],
    ['mode-0660', MC, 'fs.chmodSync(duong, 0o660);', 'fs.chmodSync(duong, 0o666);'],
    ['mode-0660-bo', MC, '  fs.chmodSync(duong, 0o660);\n', ''],
    ['cong-127', MC, "return lang(cong, '127.0.0.1');", "return lang(cong, '0.0.0.0');"],
    ['kho-0600', MC, "fs.closeSync(fs.openSync(tepKho, 'a', 0o600));", ''],
    // Cấu hình khoá đóng (hàm từng luật + chỗ gọi docCauHinh)
    ['cau-hinh-goi', MC, 'const ch = docCauHinh(duongCauHinh);', "const ch = { ngheSocket: null, ...JSON.parse(fs.readFileSync(duongCauHinh, 'utf8')) };"],
    ['cong-va-socket', CH, "  if (Object.hasOwn(ch, 'cong') === Object.hasOwn(ch, 'ngheSocket')) throw new Error('cấu hình: cần đúng một trong cong (chỉ dev) và ngheSocket');\n", ''],
    ['khoa-la', CH, "  for (const k of Object.keys(ch)) if (!BAT_BUOC.includes(k) && !TUY_CHON.includes(k)) throw new Error('cấu hình: khoá lạ ' + k);\n", ''],
    ['thieu-khoa', CH, "  for (const k of BAT_BUOC) if (!Object.hasOwn(ch, k)) throw new Error('cấu hình: thiếu ' + k);\n", ''],
    ['kieu-emails', CH, "throw new Error('cấu hình: emails sai');", '0;'],
    ['kieu-cos-ghi', CH, "throw new Error('cấu hình: cosGhi phải là true/false');", '0;'],
    ['kieu-cong', CH, "throw new Error('cấu hình: cong sai');", '0;'],
    ['kieu-uid-cho', CH, "throw new Error('cấu hình: uidCho phải là số nguyên ≥ 0');", '0;'],
    ['kieu-duong', CH, "throw new Error('cấu hình: ' + k + ' phải là đường tuyệt đối');", '0;'],
    ['kernel-trung-web', CH, "throw new Error('cấu hình: ngheKernel trùng ngheSocket');", '0;'],
    ['kernel-trung-tho', CH, 'path.resolve(ch.ngheKernel) === path.resolve(ch.ngheSocket)', 'ch.ngheKernel === ch.ngheSocket'],
    ['kernel-trung-tho-ben-web', CH, '=== path.resolve(ch.ngheSocket)', '=== ch.ngheSocket'],
    ['kernel-trung-tho-ben-kernel', CH, 'path.resolve(ch.ngheKernel) ===', 'ch.ngheKernel ==='],
    ['kernel-trung-bo-chan-dev', CH, "Object.hasOwn(ch, 'ngheSocket') && path.resolve", 'path.resolve'],
  ],
  A6: [
    // Bắt buộc Step 5: trần cỡ, trường lạ, so dấu khi sao lưu (hàm + chỗ gọi); lời gọi henSaoLuu và dung() trong may-chu.mjs
    ['tran-co-ham', XU, "  if (n > tran) throw new Error('tệp xuất quá trần');\n", ''],
    ['tran-co-goi', XU, 'docGioiHan(fd, tranByte)', 'docGioiHan(fd, tranByte + 1)'],
    ['truong-la-ham', XU, '    && Object.keys(v).every(k => Object.hasOwn(luat, k))\n', ''],
    ['truong-la-goi', XU, '  if (!hop(luocDo, du_lieu)) return hong();\n', ''],
    ['so-dau-ham', SL, 'export function cungDau(a, b) {\n', 'export function cungDau(a, b) {\n  return true;\n'],
    ['so-dau-goi', SL, "    if (!cungDau(kiemBan(tam), dau)) throw new Error('sao lưu: bản sao lệch bản sống');\n", '    kiemBan(tam);\n'],
    ['hen-goi', MC, '  const hen = henSaoLuu(db, ch, { dongHo, ghiLog, moiGio });', '  const hen = { dung() {} };'],   // vòng sửa 1: thêm moiGio vào chuỗi cũ, giữ ý
    ['dung-goi', MC, '    hen.dung();\n', ''],
    // Tệp xuất: trần mặc định, lược đồ đóng từng luật
    ['tran-mac-dinh', XU, 'tranByte = 2 * 1024 * 1024,', 'tranByte = 2 * 1024 * 1024 + 1,'],
    ['thieu-truong', XU, 'Object.hasOwn(v, k) && hop(luat[k], v[k])', '(!Object.hasOwn(v, k) || hop(luat[k], v[k]))'],
    ['hang-luoc-do', XU, "if (typeof luat === 'number') return v === luat;", "if (typeof luat === 'number') return true;"],
    ['chu-tran-500', XU, '[...v].length <= 500', '[...v].length <= 501'],
    ['chu-dem-diem-ma', XU, '[...v].length <= 500', 'v.length <= 500'],
    ['chu-null', XU, "if (luat === 'chu?') return v === null || hop('chu', v);", "if (luat === 'chu?') return true;"],
    ['bool', XU, "if (luat === 'bool') return typeof v === 'boolean';", "if (luat === 'bool') return true;"],
    ['dem-nguyen', XU, 'Number.isSafeInteger(v) && v >= 0', "typeof v === 'number' && v >= 0"],
    ['dem-am', XU, ' && v >= 0;', ';'],
    ['iso-ham', XU, "if (luat === 'iso') return laIso(v);", "if (luat === 'iso') return true;"],
    ['iso-ngay-co-that', XU, ' && Number(m[3]) <= new Date(Date.UTC(Number(m[1]), Number(m[2]), 0)).getUTCDate()', ''],
    ['iso-neo-dau', XU, 'const ISO = /^(', 'const ISO = /('],
    ['iso-neo-cuoi', XU, ':[0-5]\\d)$/;', ':[0-5]\\d)/;'],
    ['iso-mui-gio', XU, '2[0-3]):[0-5]\\d)$/;', '2[0-3]):[0-5]\\d)?$/;'],
    ['mang-200', XU, 'v.length <= 200', 'v.length <= 201'],
    ['mang-phan-tu', XU, ' && v.every(x => hop(luat[0], x))', ''],
    // Mở tệp (symlink, FIFO), thiếu tệp, bản tốt cuối, cũ
    ['nofollow', XU, ' | fs.constants.O_NOFOLLOW', ''],
    ['nonblock', XU, ' | fs.constants.O_NONBLOCK', ''],
    ['thieu-ma', XU, "e.code === 'ENOENT' ?", 'false ?'],
    ['tot-cuoi-tra', XU, ', ...TOT_CUOI.get(duong) });', ' });'],
    ['tot-cuoi-ghi', XU, '  TOT_CUOI.set(duong, { du_lieu, gio_dung: du_lieu.gio_dung });\n', ''],
    ['cu-nguong', XU, 'cuSauMs = 3 * 3600 * 1000', 'cuSauMs = 4 * 3600 * 1000'],
    ['cu-bo', XU, "> cuSauMs ? 'cu' : 'tot'", "> Infinity ? 'cu' : 'tot'"],
    // so-dem.json: chỉ số, đếm đúng, ghi nguyên tử, 0644, dọn tạm khi lỗi
    ['so-dem-lo-chu', XU, "de_xuat_cho: dem(\"SELECT count(*) AS n FROM de_xuat WHERE trang_thai = 'cho'\"),", "de_xuat_cho: dem(\"SELECT count(*) AS n FROM de_xuat WHERE trang_thai = 'cho'\"), mau: db.prepare('SELECT tieu_de FROM viec').get()?.tieu_de,"],
    ['so-dem-xong', XU, ' AND xong_luc IS NULL', ''],
    ['so-dem-han-gio', XU, 'homNay, vn.slice(0, 16))', 'homNay, homNay)'],
    ['so-dem-gio-vn', XU, 'luc.getTime() + 7 * 3600e3', 'luc.getTime()'],
    ['so-dem-lich-phu', XU, 'substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ?', 'substr(bat_dau, 1, 10) >= ?'],
    ['so-dem-de-xuat-cho', XU, "FROM de_xuat WHERE trang_thai = 'cho'", 'FROM de_xuat'],
    ['so-dem-nguyen-tu', XU, "fs.renameSync(tam, path.join(thuMucXuat, 'so-dem.json'));", "fs.writeFileSync(path.join(thuMucXuat, 'so-dem.json'), fs.readFileSync(tam)); fs.rmSync(tam);"],
    ['so-dem-0644', XU, '    fs.chmodSync(tam, 0o644);\n', ''],
    ['so-dem-don-tam', XU, '  } catch (e) { fs.rmSync(tam, { force: true }); throw e; }', '  } catch (e) { throw e; }'],
    // Sao lưu: integrity_check (hàm + chỗ gọi), quyền, số giữ, mẫu tên, dọn khi lỗi, dấu mọi bảng, diễn tập đọc <tep>.json
    ['integrity-ham', SL, "    if (Object.values(db.prepare('PRAGMA integrity_check').get())[0] !== 'ok') throw new Error('sao lưu: integrity_check hỏng');\n", ''],
    ['integrity-goi', SL, 'cungDau(kiemBan(tam), dau)', 'cungDau((d => { try { return dauVanTay(d); } finally { d.close(); } })(new DatabaseSync(tam, { readOnly: true })), dau)'],
    ['mode-tep-0600', SL, "fs.openSync(tam, 'wx', 0o600)", "fs.openSync(tam, 'wx', 0o644)"],
    ['mode-dau-0600', SL, "{ mode: 0o600, flag: 'wx' }", "{ mode: 0o644, flag: 'wx' }"],
    ['mode-thu-muc-0700', SL, 'mode: 0o700', 'mode: 0o755'],
    ['giu-gio-48', SL, 'gio: 48, ngay: 14', 'gio: 49, ngay: 14'],
    ['giu-ngay-14', SL, 'gio: 48, ngay: 14', 'gio: 48, ngay: 15'],
    ['ten-neo-dau', SL, 'gio: /^kho-gio-', 'gio: /kho-gio-'],
    ['ten-neo-cuoi', SL, 'kho-gio-\\d{8}-\\d{4}\\.sqlite$/', 'kho-gio-\\d{8}-\\d{4}\\.sqlite/'],
    ['ten-theo-loai', SL, '.filter(f => TEN[loai].test(f))', '.filter(f => TEN.gio.test(f))'],
    ['don-kem-json', SL, " fs.rmSync(path.join(thuMuc, f + '.json'), { force: true });", ''],
    ['loai-sai', SL, "  if (!Object.hasOwn(GIU, loai)) throw new Error('sao lưu: loai phải là gio hoặc ngay');\n", ''],
    ['ten-gio-vn', SL, 'new Date(bayGio).getTime() + VN', 'new Date(bayGio).getTime()'],
    ['don-tam-cu', SL, '  don();\n  const dau', '  const dau'],
    ['loi-khong-don', SL, "  } catch (e) { don(); if (jXong) fs.rmSync(dich + '.json', { force: true }); throw e; }", '  } catch (e) { throw e; }'],
    ['dau-bo-loc-sqlite', SL, "type = 'table' AND substr(name, 1, 7) <> 'sqlite_'", "type = 'table'"],
    ['dau-bam-dong', SL, "h.update(JSON.stringify(r)); h.update('\\n'); n++;", 'n++;'],
    ['khoi-phuc-so', SL, 'return { khop: cungDau(ra, mong), mong, ra };', 'return { khop: true, mong, ra };'],
    ['khoi-phuc-dau-tep', SL, "JSON.parse(fs.readFileSync(tep + '.json', 'utf8'))", 'kiemBan(tep)'],
    // Bộ hẹn: chu kỳ giờ, 03:00 giờ VN, hẹn lại theo giờ mới, dung(), lỗi không thoát ra
    ['hen-chu-ky-gio', SL, "dat('gio', GIO, 0);", "dat('gio', 2 * GIO, 0);"],
    ['hen-ngay-03h-vn', SL, "dat('ngay', NGAY, 3 * GIO - VN);", "dat('ngay', NGAY, 3 * GIO);"],
    ['hen-lai', SL, '      dat(loai, chuKy, lech, t);\n', ''],
    ['hen-tu-gio-moi', SL, 'tu + toiMoc(tu, chuKy, lech)', 'tu + chuKy'],   // vòng sửa 1: chuỗi cũ đổi theo mã mới, giữ ý
    ['dung-ham', SL, 'return { dung() { for (const t of Object.values(hen)) dongHo.clearTimeout(t); } };', 'return { dung() {} };'],
    ['hen-bat-loi', SL, '      catch (e) { ghiLog(`LỖI sao lưu ${loai}: ${sach(e)}`); }', '      catch (e) { throw e; }'],
    // Vòng sửa 1: nối ghiSoDem, timer bắn sớm, dong() một lần
    ['so-dem-khoi-dong', MC, '  if (moiGio) { try { moiGio(bayGio()); }', '  if (false) { try { moiGio(bayGio()); }'],
    ['so-dem-moi-gio', SL, "if (loai === 'gio' && moiGio) {", 'if (false) {'],
    ['so-dem-moi-gio-chan-nhau', SL, "if (loai === 'gio' && moiGio) { try { moiGio(t); } catch { ghiLog('LỖI ghi so đếm'); } }", "if (loai === 'gio' && moiGio) { moiGio(t); }"],
    ['so-dem-khoi-dong-loi', MC, "moiGio(bayGio()); } catch { ghiLog('LỖI ghi so đếm'); }", 'moiGio(bayGio()); } catch (e) { throw e; }'],
    ['so-dem-co-thu-muc-xuat', MC, 'ch.thuMucXuat ? t => ghiSoDem(db, ch.thuMucXuat, t) : undefined', 't => ghiSoDem(db, ch.thuMucXuat, t)'],
    ['hen-som-max', SL, 'Math.max(dongHo.now(), moc)', 'dongHo.now()'],
    ['hen-som-moc-ke', SL, 'dat(loai, chuKy, lech, t);', 'dat(loai, chuKy, lech);'],
    ['dong-mot-lan', MC, 'const dong = () => (p ??= (async () => {', 'const dong = () => ((async () => {'],
    // Tắt êm khi nhận tín hiệu; thuMucSaoLuu bắt buộc
    ['tin-sigterm', MC, "['SIGTERM', 'SIGINT']", "['SIGINT']"],
    ['tin-sigint', MC, "['SIGTERM', 'SIGINT']", "['SIGTERM']"],
    ['tin-thoat-0', MC, 'dong().then(() => process.exit(0)', 'dong().then(() => process.exit(1)'],
    ['tin-khong-dong', MC, 'process.once(tin, () => dong().then(', 'process.once(tin, () => Promise.resolve().then('],
    ['sao-luu-bat-buoc', CH, "'thuMucSaoLuu', 'cosGhi'];   // thuMucSaoLuu bắt buộc từ A6: không chạy kho mà không sao lưu\nconst TUY_CHON = ['ngheSocket',", "'cosGhi'];\nconst TUY_CHON = ['thuMucSaoLuu', 'ngheSocket',"],
  ],
  A3: [
    // Đề xuất (goi.mjs, R1). Step 5: Áp dụng ghi thêm một dòng (K1) · đổi sang giá trị khác (R6) · Bỏ qua tạo gói rỗng (R9)
    ['dx-ap-them-dong', GOI, 'ops: JSON.parse(dx.ops) }', "ops: [...JSON.parse(dx.ops), { loai: 'them', bang: 'viec', truong: { tieu_de: 'thêm lén' } }] }"],
    ['dx-ap-doi-gia-tri', GOI, 'ops: JSON.parse(dx.ops) }', "ops: JSON.parse(dx.ops.replaceAll('-11-', '-12-')) }"],
    ['dx-bo-qua-tao-goi', GOI, "  return { trang_thai: 'bo_qua' };", "  db.prepare(\"INSERT INTO goi_ghi (id, khoa_lap, chu_the, nguon, ops, ket_qua, tao_luc) VALUES (?, ?, 'anh', '{}', '[]', '[]', ?)\").run(randomUUID(), randomUUID(), bayGio);\n  return { trang_thai: 'bo_qua' };"],
    // Cùng giao dịch + điều kiện trên de_xuat (hai lần ⇒ 409, một gói)
    ['dx-cung-giao-dich', GOI, "bayGio, goi_id => doiDeXuat(db, dx, 'ap_dung', goi_id, chu_the, bayGio));", "bayGio);\n  doiDeXuat(db, dx, 'ap_dung', kq.goi_id, chu_the, bayGio);"],
    ['dx-goi-sau-ghi', GOI, '    sauGhi?.(ng.goi_id);\n', ''],
    ['dx-dk-cho', GOI, " AND trang_thai = 'cho' AND phien_ban = ?", ' AND phien_ban = ?'],
    ['dx-dk-doi-0', GOI, "  if (r.changes !== 1) throw new LoiGoi(409, 'de_xuat_da_xu_ly');\n", ''],
    ['dx-ap-dung-trang-thai', GOI, "doiDeXuat(db, dx, 'ap_dung',", "doiDeXuat(db, dx, 'bo_qua',"],
    ['dx-lap-luon-409', GOI, 'kq.lap && kq.goi_id !== dx.goi_id', 'kq.lap'],
    ['dx-lap-bo', GOI, "  if (kq.lap && kq.goi_id !== dx.goi_id) throw new LoiGoi(409, 'khoa_lap_trung');\n", ''],
    ['dx-404', GOI, "  if (!dx) throw new LoiGoi(404, 'khong_co');\n  return dx;", '  return dx;'],
    // Người duyệt chỉ anh (hàm + hai chỗ gọi), từng điều kiện
    ['dx-duyet-ham', GOI, 'function kiemNguoiDuyet(chu_the, nguon) {\n', 'function kiemNguoiDuyet(chu_the, nguon) {\n  return;\n'],
    ['dx-duyet-goi-bo-qua', GOI, '  kiemNguoiDuyet(chu_the, nguon);\n  doiDeXuat(db, layDeXuat', '  doiDeXuat(db, layDeXuat'],
    ['dx-duyet-goi-ap-dung', GOI, '  kiemNguoiDuyet(chu_the, nguon);\n  const dx = layDeXuat', '  const dx = layDeXuat'],
    ['dx-duyet-chi-anh', GOI, "chu_the !== 'anh' || ", ''],
    ['dx-duyet-o-quyen', GOI, ' || !quyenCua(chu_the, nguon.loai)) throw new LoiGoi(403, \'quyen\', { bang: \'de_xuat\'', ") throw new LoiGoi(403, 'quyen', { bang: 'de_xuat'"],
    ['dx-duyet-nguon', GOI, "  kiemNguon(nguon);\n  if (chu_the !== 'anh'", "  if (chu_the !== 'anh'"],
    ['dx-duyet-chu-the', GOI, "  if (!CHU_THE.includes(chu_the)) throw saiLuocDo({ ly_do: 'chu_the' });\n  kiemNguon(nguon);\n", '  kiemNguon(nguon);\n'],
    // taoDeXuat: R11 qua kiemOps, từng trường
    ['dx-tao-kiem-ops', GOI, 'const opsChuan = kiemOps(ops);', 'const opsChuan = ops;'],   // B3 3a: taoDeXuat kiemOps một lần (opsChuan)
    ['dx-tao-chu-the', GOI, "  if (!CHU_THE_DE_XUAT.includes(chu_the)) throw saiLuocDo({ ly_do: 'chu_the' });\n  if (!hopLe({ chu: 200", '  if (!hopLe({ chu: 200'],
    ['dx-tao-mach', GOI, "  if (!hopLe({ chu: 200, it: 1, bb: true }, mach)) throw saiLuocDo({ ly_do: 'mach' });\n", ''],
    ['dx-tao-noi-dung', GOI, "  if (!hopLe({ chu: 2000, bb: true }, noi_dung)) throw saiLuocDo({ ly_do: 'noi_dung' });\n", ''],
    // api.mjs — cổng cosGhi: hàm + MỌI chỗ gọi (bắt buộc: /api/hoan) + thứ tự (trước khi đọc thân) + chỉ-đọc không qua cổng
    ['cos-ghi-ham', API, 'function kiemCosGhi(ctx) { if (ctx.ch.cosGhi !== true) throw', 'function kiemCosGhi(ctx) { if (false) throw'],
    ['cos-ghi-goi-hoan', API, '    kiemCosGhi(ctx);\n    const { ma_hoan } = docJson(', '    const { ma_hoan } = docJson('],
    ['cos-ghi-goi-goi', API, '    kiemCosGhi(ctx);\n    const { khoa_lap, ops } = docJson(', '    const { khoa_lap, ops } = docJson('],
    ['cos-ghi-goi-bo-qua', API, '    kiemCosGhi(ctx);\n    docJson(than, []);', '    docJson(than, []);'],
    ['cos-ghi-goi-ap-dung', API, '    kiemCosGhi(ctx);\n    const { khoa_lap } = docJson(', '    const { khoa_lap } = docJson('],
    ['cos-ghi-goi-cai-tien', API, '    kiemCosGhi(ctx);\n    const { trang_thai, phien_ban } = docJson(', '    const { trang_thai, phien_ban } = docJson('],
    ['cos-ghi-sau-than', API, "    kiemCosGhi(ctx);\n    const { khoa_lap, ops } = docJson(than, ['khoa_lap', 'ops']);\n", "    const { khoa_lap, ops } = docJson(than, ['khoa_lap', 'ops']);\n    kiemCosGhi(ctx);\n"],
    ['xuat-viec-ghi-tat', API, "    const { dang } = docQuery(query, ['dang']);\n", "    kiemCosGhi(ctx);\n    const { dang } = docQuery(query, ['dang']);\n"],
    // Chủ thể/nguồn route web cố định; thân + query khoá đóng
    ['chu-the-anh', API, "chu_the: 'anh', nguon: Object.freeze", "chu_the: 'neo', nguon: Object.freeze"],
    ['nguon-web', API, "nguon: Object.freeze({ loai: 'web' })", "nguon: Object.freeze({ loai: 'tin_anh', kenh: 'lenh', tin_id: '1' })"],
    ['than-khoa-dong', API, "  for (const k of Object.keys(o)) if (!khoa.includes(k)) throw new LoiGoi(400, 'luoc_do', { ly_do: 'khoa_la' });\n", ''],
    ['than-mang', API, "typeof o !== 'object' || o === null || Array.isArray(o)", "typeof o !== 'object' || o === null"],
    ['query-la', API, '    if (!khoa.includes(k) || Object.hasOwn(o, k)) throw saiQuery(k);\n', '    if (Object.hasOwn(o, k)) throw saiQuery(k);\n'],
    ['query-lap', API, '    if (!khoa.includes(k) || Object.hasOwn(o, k)) throw saiQuery(k);\n', '    if (!khoa.includes(k)) throw saiQuery(k);\n'],
    // Bộ định tuyến :id — UUID chữ thường, neo hai đầu, không giải mã %, «:id» viết thẳng ⇒ 404; id tới handler; TraTho
    ['id-uuid-hoa', API, '[0-9a-f]{12}$/;', '[0-9a-f]{12}$/i;'],
    ['id-neo-dau', API, 'const UUID = /^[0-9a-f]{8}', 'const UUID = /[0-9a-f]{8}'],
    ['id-neo-cuoi', API, '[0-9a-f]{12}$/;', '[0-9a-f]{12}/;'],
    ['id-giai-ma', API, "const doan = p.split('/'),", "const doan = p.split('/').map(decodeURIComponent),"],
    ['id-literal', API, " || (id === null && khoa.includes(':id'))", ''],
    ['id-truyen', API, 'query, id }); }', 'query }); }'],
    ['tra-tho', API, 'if (o instanceof TraTho) return tra(', 'if (false) return tra('],
    // Việc, đề xuất, tiến độ, cải tiến: lọc
    ['viec-mo', API, "[q.mo === '1' ? 'AND xong_luc IS NULL' : '', ", "['', "],
    ['viec-mo-gia-tri', API, "    if (q.mo !== undefined && q.mo !== '1') throw saiQuery('mo');\n", ''],
    ['viec-xoa', API, 'FROM viec WHERE xoa_luc IS NULL ${dk}', 'FROM viec WHERE 1 ${dk}'],
    ['viec-mach', API, "q.mach !== undefined ? 'AND mach = ?'", "q.mach !== undefined ? 'AND ? IS NOT NULL'"],
    ['de-xuat-cho', API, "FROM de_xuat WHERE trang_thai = 'cho' ${mach", 'FROM de_xuat WHERE 1 ${mach'],
    ['de-xuat-mach', API, "${mach !== undefined ? 'AND mach = ?'", "${mach !== undefined ? 'AND ? IS NOT NULL'"],
    ['tien-do-loc', API, 'AND doi_tuong = ? ORDER BY', 'AND ? IS NOT NULL ORDER BY'],
    ['tien-do-viec-bat-buoc', API, "    if (viec === undefined) throw saiQuery('viec');\n", ''],
    ['cai-tien-xoa', API, 'FROM cai_tien WHERE xoa_luc IS NULL ORDER BY', 'FROM cai_tien WHERE 1 ORDER BY'],
    // Lịch: tu–den, ≤ 62 ngày cả hai đầu, ngày có thật, phủ khoảng
    ['lich-62', API, '> 61 * 86400e3', '> 62 * 86400e3'],
    ['lich-62-chat', API, '> 61 * 86400e3', '> 60 * 86400e3'],
    ['lich-den-truoc-tu', API, ' || den < tu || ', ' || '],
    ['lich-tu', API, "    if (!ngayThat(tu)) throw saiQuery('tu');\n", ''],
    ['lich-ngay-that', API, " && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s", ''],
    ['lich-phu-ket-thuc', API, 'AND substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ? ORDER BY bat_dau, id`, den, tu)', 'AND substr(bat_dau, 1, 10) >= ? ORDER BY bat_dau, id`, den, tu)'],
    ['lich-phu-bat-dau', API, 'AND substr(bat_dau, 1, 10) <= ? AND substr(coalesce', 'AND ? IS NOT NULL AND substr(coalesce'],
    ['lich-xoa', API, 'FROM lich WHERE xoa_luc IS NULL AND substr(bat_dau', 'FROM lich WHERE 1 AND substr(bat_dau'],
    // Nhật ký: 24 giờ, tu chỉ thu hẹp, mới trước, ≤ 200, tu ISO đúng dạng
    ['nhat-ky-24h', API, '24 * 3600e3', '27 * 3600e3'],
    ['nhat-ky-tu-noi', API, 'tu !== undefined && tu > san ? tu : san', 'tu !== undefined ? tu : san'],
    ['nhat-ky-tu-bo', API, 'tu !== undefined && tu > san ? tu : san', 'san'],
    ['nhat-ky-200', API, 'LIMIT 200', 'LIMIT 201'],
    ['nhat-ky-thu-tu', API, 'ORDER BY id DESC LIMIT', 'ORDER BY id LIMIT'],
    ['nhat-ky-tu-iso', API, ' && new Date(s).toISOString() === s', ''],
    // Brief (Step 5: trả số cố định) — giờ VN, từng số
    ['brief-so-co-dinh', API, '    const vn = gioVn(ctx), homNay = vn.slice(0, 10), dem =', '    return { qua_han: 2, han_hom_nay: 3, lich_hom_nay: 2, de_xuat_cho: 2 };\n    const vn = gioVn(ctx), homNay = vn.slice(0, 10), dem ='],
    ['gio-vn-utc', API, 'ctx.bayGio() + 7 * 3600e3', 'ctx.bayGio()'],
    ['brief-qua-han-xong', API, 'qua_han: dem(`${VIEC_MO} AND han <', 'qua_han: dem(`FROM viec WHERE xoa_luc IS NULL AND han <'],
    ['brief-han-hom-nay', API, 'han_hom_nay: dem(`${VIEC_MO} AND substr(han, 1, 10) = ?`', 'han_hom_nay: dem(`${VIEC_MO} AND han = ?`'],
    ['brief-de-xuat-tat-ca', API, "de_xuat_cho: dem(\"FROM de_xuat WHERE trang_thai = 'cho'\")", "de_xuat_cho: dem('FROM de_xuat')"],
    // Xuất việc: mở, không xoá, lịch chưa qua, dang đóng, tải về; CSV RFC 4180 + chống công thức (từng ký tự)
    ['xuat-viec-xoa', API, 'SELECT id, tieu_de, han, danh_sach, ghi_chu, mach ${VIEC_MO}', 'SELECT id, tieu_de, han, danh_sach, ghi_chu, mach FROM viec WHERE xong_luc IS NULL'],
    ['xuat-viec-xong', API, 'SELECT id, tieu_de, han, danh_sach, ghi_chu, mach ${VIEC_MO}', 'SELECT id, tieu_de, han, danh_sach, ghi_chu, mach FROM viec WHERE xoa_luc IS NULL'],
    ['xuat-viec-lich-qua', API, "FROM lich WHERE xoa_luc IS NULL AND substr(coalesce(ket_thuc, bat_dau), 1, 10) >= ? ORDER BY bat_dau, id', homNay)", "FROM lich WHERE xoa_luc IS NULL AND ? IS NOT NULL ORDER BY bat_dau, id', homNay)"],
    ['xuat-viec-dang', API, "    if (dang !== 'json' && dang !== 'csv') throw saiQuery('dang');\n", ''],
    ['xuat-viec-tep', API, '`attachment; filename=', '`inline; filename='],
    ['csv-cong-thuc', API, String.raw`if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;`, ''],
    ['csv-cong-thuc-bang', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[+\-@\t\r]/`],
    ['csv-cong-thuc-cong', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[=\-@\t\r]/`],
    ['csv-cong-thuc-tru', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[=+@\t\r]/`],
    ['csv-cong-thuc-a-cong', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[=+\-\t\r]/`],
    ['csv-cong-thuc-tab', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[=+\-@\r]/`],
    ['csv-cong-thuc-cr', API, String.raw`/^[=+\-@\t\r]/`, String.raw`/^[=+\-@\t]/`],
    ['csv-bao', API, String.raw`return /[",\r\n]/.test(s) ?`, 'return false ?'],
    ['csv-bao-cr', API, String.raw`/[",\r\n]/`, String.raw`/[",\n]/`],
    ['csv-bao-lf', API, String.raw`/[",\r\n]/`, String.raw`/[",\r]/`],
    ['csv-bao-phay', API, String.raw`/[",\r\n]/`, String.raw`/["\r\n]/`],
    ['csv-bao-nhay', API, String.raw`/[",\r\n]/`, String.raw`/[,\r\n]/`],
    ['csv-bao-nhay-kep', API, `s.replaceAll('"', '""')`, 's'],
    ['csv-crlf', API, String.raw`.join('\r\n') + '\r\n'`, String.raw`.join('\n') + '\n'`],
    // Màn chủ: không nguồn ⇒ chua_noi (không số bịa); agent/token luôn chua_noi; từng khối đúng phần; việc bỏ hôm nay chưa xong
    ['man-chu-bia', API, "const CHUA_NOI = Object.freeze({ trang_thai: 'chua_noi' });", "const CHUA_NOI = Object.freeze({ trang_thai: 'tot', du_lieu: [] });"],
    ['man-chu-agent', API, 'agent_dang_chay: CHUA_NOI', "agent_dang_chay: { trang_thai: 'tot', du_lieu: [] }"],
    ['man-chu-token', API, 'chi_phi_token: CHUA_NOI', "chi_phi_token: { trang_thai: 'tot', du_lieu: 0 }"],
    ['man-chu-khong-nguon', API, 'const tuTep = k => (tt === null ? CHUA_NOI :', "const tuTep = k => (tt === null ? { trang_thai: 'thieu', du_lieu: null, gio_dung: null } :"],
    ['man-chu-khoi-nguyen', API, 'khoiTep(tt, d => d[k])', 'khoiTep(tt, d => d)'],
    ['man-chu-viec-bo-xong', API, '!v.xong && v.han', 'v.han'],
    ['man-chu-viec-bo-ngay', API, 'v.han?.slice(0, 10) === homNay))', 'v.han !== undefined))'],
    ['man-chu-viec-han', API, 'AND substr(han, 1, 10) = ? ${THU_TU_VIEC}`, ngay)', 'AND han = ? ${THU_TU_VIEC}`, ngay)'],
    ['man-chu-nhat-ky', API, 'kho: nhatKy(ctx)', 'kho: []'],
  ],
  A4: [
    // Khung: trần 64 KiB (giá trị + chỗ kiểm + biên), hẹn 5 s (giá trị + chỗ đặt + đồng hồ + gỡ khi đóng), byte thừa, UTF-8 chặt.
    // Không có đột biến «bỏ c.off('data')»: gần tương đương — chỉ khác khi kho đổi giữa hai chunk (anh Bỏ qua đề xuất, hoặc kết nối khác đổi phien_ban), ca này không test ổn định được. Lần nhận sau chỉ chạy lại CHÍNH khung đầu (b luôn bắt đầu từ khung đầu),
    // cùng khoa_lap ⇒ apGoi trả lap / deXuat trả id cũ / hoan ⇒ da_hoan, không ghi thêm; trả lời đã end. Đột biến chạy khung thừa ở dưới.
    ['tran-khung-ham', KER, 'export const TRAN_KHUNG = 64 * 1024;', 'export const TRAN_KHUNG = 64 * 1024 + 1;'],
    ['tran-khung-goi', KER, '      if (dai > TRAN_KHUNG) return c.destroy();', '      if (false) return c.destroy();'],
    ['tran-khung-bien', KER, 'if (dai > TRAN_KHUNG)', 'if (dai >= TRAN_KHUNG)'],
    ['han-5s-ham', KER, 'const HAN_KHUNG_MS = 5000;', 'const HAN_KHUNG_MS = 50000;'],
    ['han-5s-goi', KER, 'hen.setTimeout(() => c.destroy(), HAN_KHUNG_MS)', 'hen.setTimeout(() => {}, HAN_KHUNG_MS)'],
    ['hen-mac-dinh', KER, 'hen = { setTimeout, clearTimeout }', 'hen = { setTimeout: () => 0, clearTimeout() {} }'],
    ['nguon-ky-tu-dieu-khien', KER, ' && !/[\\u0000-\\u001f\\u007f]/.test(nguon[x])', ''],
    ['han-dong-ho-that', KER, 'const t = hen.setTimeout(', 'const t = setTimeout('],
    ['han-go-khi-dong', KER, "c.on('close', () => { ketNoi.delete(c); hen.clearTimeout(t); });", "c.on('close', () => { ketNoi.delete(c); });"],
    ['byte-thua-chay-tiep', KER, '      c.end(Buffer.concat([l, ra]));\n', '      c.end(Buffer.concat([l, ra]));\n      if (n > 4 + dai) xuLyKhung(ctx, b.subarray(8 + dai));\n'],
    ['byte-thua-treo', KER, 'if (n < 4 + dai) return;', 'if (n !== 4 + dai) return;'],
    ['utf8-long', KER, "new TextDecoder('utf-8', { fatal: true })", "new TextDecoder('utf-8')"],
    // Khung khoá đóng + chủ thể luôn neo. «Lấy chu_the từ khung» cần HAI chỗ cùng hỏng (khung nhận khoá + chỗ gọi dùng nó) ⇒ tách:
    // khung nhận chu_the (hàm) · chỗ gọi apGoi / taoDeXuat / hoanTac không dùng NEO (gọi) · hằng NEO.
    ['khung-ham', KER, 'function kiemKhung(k) {\n', 'function kiemKhung(k) {\n  return;\n'],
    ['khung-goi', KER, '    kiemKhung(k);\n', ''],
    ['khung-khoa-mo', KER, "Object.keys(k).some(x => !['op', 'nguon', 'thao_tac'].includes(x))", 'false'],
    ['chu-the-khung-ham', KER, "!['op', 'nguon', 'thao_tac'].includes(x)", "!['op', 'nguon', 'thao_tac', 'chu_the'].includes(x)"],
    ['chu-the-hang', KER, "const NEO = 'neo';", "const NEO = 'anh';"],
    ['chu-the-goi-ap-goi', KER, 'chu_the: NEO, nguon, ops: [{ ...tt, loai, bang }]', "chu_the: 'anh', nguon, ops: [{ ...tt, loai, bang }]"],
    ['chu-the-goi-de-xuat', KER, 'taoDeXuat(db, { mach, chu_the: NEO, noi_dung, ops }, bayGio)', "taoDeXuat(db, { mach, chu_the: 'anh', noi_dung, ops }, bayGio)"],
    // op đóng
    ['op-ham', KER, 'function kiemOp(op) {\n', 'function kiemOp(op) {\n  return;\n'],
    ['op-goi', KER, '    kiemOp(op);\n', ''],
    ['op-ke-thua', KER, '!Object.hasOwn(KHOA_TT, op)', '!(op in KHOA_TT)'],
    // nguon
    ['nguon-ham', KER, 'function kiemNguon(op, nguon) {\n', 'function kiemNguon(op, nguon) {\n  return;\n'],
    ['nguon-goi', KER, '    kiemNguon(op, nguon);\n', ''],
    ['nguon-loai', KER, "['tin_anh', 'tu_chay'].includes(nguon.loai)", "['tin_anh', 'tu_chay', 'web'].includes(nguon.loai)"],
    ['nguon-khoa-mo', KER, "Object.keys(nguon).some(x => !['loai', 'kenh', 'tin_id'].includes(x))", 'false'],
    ['nguon-kieu', KER, "typeof nguon[x] === 'string' && ", ''],
    ['nguon-rong', KER, 'nguon[x].length >= 1', 'nguon[x].length >= 0'],
    ['nguon-tran-100', KER, 'nguon[x].length <= 100', 'nguon[x].length <= 101'],
    ['nguon-ghi-bat-buoc', KER, ": !DOC.includes(op)) throw khongNhan('nguon', { truong: x });", ": false) throw khongNhan('nguon', { truong: x });"],
    // thao_tac khoá đóng
    ['thao-tac-ham', KER, 'function kiemThaoTac(op, tt) {\n', 'function kiemThaoTac(op, tt) {\n  return tt ?? {};\n'],
    ['thao-tac-goi', KER, 'const tt = kiemThaoTac(op, k.thao_tac);', 'const tt = k.thao_tac ?? {};'],
    ['thao-tac-khoa-mo', KER, 'Object.keys(tt).some(x => !KHOA_TT[op].includes(x))', 'false'],
    // tu_chay chỉ đọc + đề xuất (thiết kế 3 dòng 9b)
    ['tu-chay-ham', KER, 'function kiemTuChay(op, nguon) {\n', 'function kiemTuChay(op, nguon) {\n  return;\n'],
    ['tu-chay-goi', KER, '    kiemTuChay(op, nguon);\n', ''],
    ['tu-chay-hoan', KER, "op !== 'de_xuat_tao') throw new LoiGoi(403, 'tu_chay_chi_de_xuat')", "op !== 'de_xuat_tao' && op !== 'hoan') throw new LoiGoi(403, 'tu_chay_chi_de_xuat')"],
    ['tu-chay-xoa-de-xuat', KER, "op !== 'de_xuat_tao') throw new LoiGoi(403, 'tu_chay_chi_de_xuat')", "op !== 'de_xuat_tao' && op !== 'xoa_de_xuat') throw new LoiGoi(403, 'tu_chay_chi_de_xuat')"],
    // doc_cai_tien chỉ tu_chay
    ['doc-cai-tien-ham', KER, 'function kiemDocCaiTien(op, nguon) {\n', 'function kiemDocCaiTien(op, nguon) {\n  return;\n'],
    ['doc-cai-tien-goi', KER, '    kiemDocCaiTien(op, nguon);\n', ''],
    // cosGhi trên socket
    ['cos-ghi-ham', KER, 'function kiemCosGhi(ch, op) {\n', 'function kiemCosGhi(ch, op) {\n  return;\n'],
    ['cos-ghi-goi', KER, '    kiemCosGhi(ctx.ch, op);\n', ''],
    ['cos-ghi-de-xuat', KER, 'if (!DOC.includes(op) && ch.cosGhi !== true)', "if (!DOC.includes(op) && op !== 'de_xuat_tao' && ch.cosGhi !== true)"],
    ['cos-ghi-hoan', KER, 'if (!DOC.includes(op) && ch.cosGhi !== true)', "if (!DOC.includes(op) && op !== 'hoan' && ch.cosGhi !== true)"],
    // de_xuat_tao không mang xoa
    ['khong-xoa-ham', KER, 'function kiemKhongXoa(ops) {\n', 'function kiemKhongXoa(ops) {\n  return;\n'],
    ['khong-xoa-goi', KER, '{ kiemKhongXoa(tt.ops); return deXuat(ctx.db, tt, t); }', '{ return deXuat(ctx.db, tt, t); }'],
    // hoan gói của anh: chặn ở hoanTac (hàm, A1) + kernel gọi hoanTac với chủ thể neo (gọi)
    ['hoan-anh-ham', GOI, "if (chu_the === 'neo' && goc.chu_the !== 'neo')", 'if (false)'],
    ['hoan-anh-goi', KER, 'hoanTac(ctx.db, { ma_hoan, chu_the: NEO, nguon }, t)', "hoanTac(ctx.db, { ma_hoan, chu_the: 'anh', nguon: { loai: 'web' } }, t)"],
    // R12: khoa_lap từ (kenh, tin_id, op, JSON chuẩn hoá) · đề xuất lặp ⇒ id cũ
    ['khoa-lap-sap-xep', KER, 'JSON.stringify(sapXep(tt))', 'JSON.stringify(tt)'],
    ['khoa-lap-goi', KER, 'khoa_lap: khoaLap(nguon, op, tt)', 'khoa_lap: khoaLap(nguon, op, { ...tt, lan: Math.random() })'],
    ['khoa-lap-kenh', KER, '[nguon.kenh, nguon.tin_id, op, ', '[nguon.tin_id, op, '],
    ['khoa-lap-tin-id', KER, '[nguon.kenh, nguon.tin_id, op, ', '[nguon.kenh, op, '],
    ['khoa-lap-op', KER, '[nguon.kenh, nguon.tin_id, op, ', '[nguon.kenh, nguon.tin_id, '],
    ['de-xuat-lap-ham', KER, "trang_thai = 'cho' AND mach = ?", 'mach = ?'],
    ['de-xuat-lap-goi', KER, 'return cu ? { id: cu.id, lap: true } :', 'return false ? { id: cu.id, lap: true } :'],
    ['de-xuat-lap-mach', KER, 'AND mach = ? AND chu_the = ? AND ops = ?").get(mach, NEO, opsJson)', 'AND chu_the = ? AND ops = ?").get(NEO, opsJson)'],
    ['de-xuat-lap-ops', KER, 'AND mach = ? AND chu_the = ? AND ops = ?").get(mach, NEO, opsJson)', 'AND mach = ? AND chu_the = ?").get(mach, NEO)'],
    // xoa_de_xuat: dòng còn sống, phiên bản đang thấy, chỉ viec/lich
    ['xoa-de-xuat-da-xoa', KER, ' WHERE id = ? AND xoa_luc IS NULL`', ' WHERE id = ?`'],
    ['xoa-de-xuat-phien-ban', KER, 'phien_ban: dong.phien_ban }] }, t)', 'phien_ban: 1 }] }, t)'],
    ['xoa-de-xuat-bang', KER, "if (bang !== 'viec' && bang !== 'lich') throw saiTruong('bang');", "if (typeof bang !== 'string') throw saiTruong('bang');"],
    ['xoa-de-xuat-id', KER, "    if (typeof id !== 'string') throw saiTruong('id');\n", ''],
    // lỗi lạ không lộ thông điệp
    ['loi-may-chu-lo', KER, ": { ok: false, loi: 'loi_may_chu' }", ": { ok: false, loi: 'loi_may_chu', chi_tiet: String(e.message) }"],
    // đọc: kiểu + lọc
    ['doc-viec-mo-kieu', KER, "    if (Object.hasOwn(tt, 'mo') && typeof tt.mo !== 'boolean') throw saiTruong('mo');\n", ''],
    ['doc-viec-loc-mo', KER, "...(tt.mo ? { mo: '1' } : {})", '...{}'],
    ['doc-viec-loc-mach', KER, '...(tt.mach === undefined ? {} : { mach: tt.mach })', '...{}'],
    ['doc-chuoi-ham', KER, 'function chuoi(tt, k) { if (', 'function chuoi(tt, k) { return; if ('],
    ['doc-viec-mach-goi', KER, "    chuoi(tt, 'mach');\n", ''],
    ['doc-lich-tu', KER, "chuoi(tt, 'tu'); ", ''],
    ['doc-lich-den', KER, " chuoi(tt, 'den');", ''],
  ],
  A5: [
    // Parked soát A3 — 1: đề xuất đã xử lý ⇒ 409 de_xuat_da_xu_ly TRƯỚC apGoi (hàm + chỗ gọi + điều kiện khoá)
    ['dx-con-cho-ham', GOI, "  if (dx.trang_thai === 'cho') return;\n", '  return;\n'],
    ['dx-con-cho-goi', GOI, '  kiemConCho(db, dx, khoa_lap);\n', ''],
    ['dx-con-cho-khoa', GOI, 'WHERE id = ? AND khoa_lap = ?', 'WHERE id = ? AND ? IS NOT NULL'],
    // 2: thân UTF-8 hỏng ⇒ 400 json (hàm + chỗ gọi); /api/hoan thiếu ma_hoan ⇒ 400 luoc_do
    ['utf8-fatal-ham', API, "new TextDecoder('utf-8', { fatal: true, ignoreBOM: true })", "new TextDecoder('utf-8', { fatal: false, ignoreBOM: true })"],
    ['utf8-fatal-goi', API, 'JSON.parse(UTF8.decode(than))', "JSON.parse(than.toString('utf8'))"],
    ['hoan-ma-hoan-luoc-do', API, "    if (typeof ma_hoan !== 'string') throw new LoiGoi(400, 'luoc_do', { ly_do: 'ma_hoan' });", ''],
    // 3: route không nhận query ⇒ query khác rỗng 400 (hàm docQuery + chỗ gọi lệnh ghi + /api/phien)
    ['query-ham', API, 'function docQuery(query, khoa) {\n  const o = {};\n', 'function docQuery(query, khoa) {\n  const o = {};\n  return o;\n'],
    ['query-ghi-goi', API, 'if (than !== null) docQuery(query, []); ', ''],
    ['query-phien-goi', API, '({ ve, query }) => { docQuery(query, []); return', '({ ve, query }) => { return'],
    // Cửa duyệt bản (Step 5). Tính lại manifest: hàm (bỏ nội dung) + chỗ gọi (bản mới chép; SHA từng duyệt)
    ['manifest-ham', BAN, 'ds.map(f => [f.ten, f.co, f.sha256])', 'ds.map(f => [f.ten, f.co])'],
    ['manifest-nguon', BAN, 'manifestCua(await docBan(tam, uidMay))', 'manifestCua(await docBan(nguon, ch.uidCho))'],
    ['manifest-goi-chep', BAN, "    if (manifestCua(await docBan(tam, uidMay)) !== manifest) throw new LoiGoi(409, 'manifest_lech');\n", ''],
    ['manifest-goi-da-duyet', BAN, "    if (manifestCua(await docBan(dich, uidMay)) !== manifest) throw new LoiGoi(409, 'manifest_lech');\n", ''],
    // Bản đã duyệt 0700 (thư mục) / 0600 (tệp): neo không đọc được (ràng buộc 5.3)
    ['ban-mode-thu-muc', BAN, 'fs.chmodSync(tam, 0o700);', 'fs.chmodSync(tam, 0o755);'],
    ['ban-mode-tep', BAN, "f.buf, { flag: 'wx', mode: 0o600 }", "f.buf, { flag: 'wx', mode: 0o644 }"],
    ['ban-mode-ban-json', BAN, "+ '\\n', { flag: 'wx', mode: 0o600 }", "+ '\\n', { flag: 'wx', mode: 0o644 }"],
    // Chủ tệp bản chờ = uidCho: hàm + ba chỗ gọi (duyệt, xem, xem tệp)
    ['uid-cho-ham', BAN, "    if (st.uid !== uid) throw new BanHong('sai_chu');\n", ''],
    ['uid-cho-goi-duyet', BAN, 'docBan(nguon, ch.uidCho)', 'docBan(nguon, uidMay)'],
    ['uid-cho-goi-xem', BAN, 'docBan(path.join(thuMucCho, sha), ch.uidCho)', 'docBan(path.join(thuMucCho, sha), process.getuid())'],
    ['uid-cho-goi-tep', BAN, "docBan(path.join(ch.thuMucCho, 'ban', sha), ch.uidCho)", "docBan(path.join(ch.thuMucCho, 'ban', sha), process.getuid())"],
    // O_NOFOLLOW: cờ (hàm) + chỗ gọi theo symlink trước khi mở
    ['nofollow-ham', BAN, ' | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK', ' | fs.constants.O_NONBLOCK'],
    ['nofollow-goi', BAN, 'await docTep(path.join(thuMuc, t), uid, TRAN_TEP)', 'await docTep(await fsp.realpath(path.join(thuMuc, t)), uid, TRAN_TEP)'],
    // Đuôi / cỡ tệp / số tệp / tổng: hàm hoặc hằng + chỗ kiểm
    ['duoi-ham', BAN, ' && !!loaiTep(t)', ''],
    ['duoi-goi', BAN, "    if (!tenDung(t)) throw new BanHong('ten_sai');\n", ''],
    ['tran-tep-hang', BAN, 'TRAN_TEP = 20480,', 'TRAN_TEP = 20481,'],
    ['tran-tep-goi', BAN, "      if (n > tran) throw new BanHong('tep_lon');\n", ''],
    ['so-tep-hang', BAN, 'TRAN_SO_TEP = 64,', 'TRAN_SO_TEP = 65,'],
    ['so-tep-goi', BAN, "  if (ten.length > TRAN_SO_TEP) throw new BanHong('qua_nhieu_tep');\n", ''],
    ['tong-hang', BAN, 'TRAN_TONG = 1 << 20,', 'TRAN_TONG = 2 << 20,'],
    ['tong-bien', BAN, '(tong += buf.length) > TRAN_TONG', '(tong += buf.length) >= TRAN_TONG'],
    ['tong-goi', BAN, "    if ((tong += buf.length) > TRAN_TONG) throw new BanHong('tong_lon');\n", ''],
    // Route ghi bản chỉ bật khi bản phục vụ thuộc _webos (uidBan = uid tiến trình): hàm + điều kiện uid + cổng api + ba route + CLI + kiểu cấu hình
    ['ghi-ban-ham', BAN, 'export function ghiBat(ch) { return ', 'export function ghiBat(ch) { return true || '],
    ['ghi-ban-uid', BAN, 'ch.uidBan === process.getuid() && ', ''],
    ['ghi-ban-kiem-ham', API, 'function kiemGhiBan(ctx) { if (!ghiBat(ctx.ch)) throw', 'function kiemGhiBan(ctx) { if (false) throw'],
    ['ghi-ban-goi-xem', API, '    kiemGhiBan(ctx);\n    docQuery(query, []);\n', '    docQuery(query, []);\n'],
    ['ghi-ban-goi-duyet', API, '    kiemGhiBan(ctx);\n    const { sha, manifest }', '    const { sha, manifest }'],
    ['ghi-ban-goi-lui', API, '    kiemGhiBan(ctx);\n    const { sha } =', '    const { sha } ='],
    ['ghi-ban-cli', BAN, '  if (!ghiBat(ch)) thoi(1,', '  if (false) thoi(1,'],
    ['uid-ban-cau-hinh', CH, "throw new Error('cấu hình: uidBan phải là số nguyên ≥ 0');", '0;'],
    // Phục vụ tĩnh: tệp của uidBan, không ra ngoài bản, hien-tai phải là <thuMucBan>/ban/<SHA40>
    ['tinh-uid', BAN, 'st.uid !== ch.uidBan || ', ''],
    ['tinh-trong-goc', BAN, "  if (!that.startsWith(goc + path.sep)) return [404, ''];", ''],
    ['tinh-hien-tai', BAN, "goc !== path.join(await fsp.realpath(ch.thuMucBan), 'ban', sha)", 'false'],
    // Lật nguyên tử, đúng thứ tự; lùi về đúng truoc
    ['lat-thu-tu', BAN, "  if (cu && cu !== moi) doiLink(goc, 'truoc', cu);\n  doiLink(goc, 'hien-tai', moi);\n", "  doiLink(goc, 'hien-tai', moi);\n  if (cu && cu !== moi) doiLink(goc, 'truoc', cu);\n"],
    ['lat-nguyen-tu', BAN, "  fs.symlinkSync(path.join('ban', sha), tam);\n", "  fs.rmSync(path.join(goc, ten), { force: true });\n  fs.symlinkSync(path.join('ban', sha), tam);\n"],
    ['lui-ve-truoc', BAN, '  return lat(goc, tr);\n', '  return lat(goc, ht);\n'],
    ['lui-truoc-lech', BAN, "  if (sha !== tr) throw new LoiGoi(409, 'truoc_lech');\n", ''],
    // /phuc-hoi: mã máy chủ tra trước bản; nút Lùi gửi đúng truoc và gỡ service worker
    ['phuc-hoi-goi', BAN, '  if (Object.hasOwn(PHUC_HOI, p)) return [200, ...PHUC_HOI[p]];\n', ''],
    ['phuc-hoi-lui-sha', BAN, 'body: JSON.stringify({ sha })', "body: JSON.stringify({ sha: 'x' })"],
    ['phuc-hoi-go-sw', BAN, '    if (navigator.serviceWorker) for (const d of await navigator.serviceWorker.getRegistrations()) await d.unregister();\n', ''],
  ],
  A8: [
    // Soát an ninh A8 — HIGH: mỗi socket một nhóm cấu hình. chown (hàm + chỗ gọi: bỏ truyền / đổi chéo gid), thứ tự chown ⇒ chmod,
    // lstat kiểm (hàm: gid, mode + chỗ gọi), cấu hình (bắt buộc ở production, khác nhau, kiểu).
    ['gid-chown-ham', MC, '  if (gid !== undefined) fs.lchownSync(duong, -1, gid);\n', ''],
    ['gid-goi-bo-truyen', MC, 'await nghe(kernel, ch.ngheKernel, undefined, ch.gidKernel);', 'await nghe(kernel, ch.ngheKernel);'],
    ['gid-goi-kernel-dung-web', MC, 'nghe(kernel, ch.ngheKernel, undefined, ch.gidKernel)', 'nghe(kernel, ch.ngheKernel, undefined, ch.gidWeb)'],
    ['gid-goi-web-dung-kernel', MC, 'nghe(server, ch.ngheSocket, ch.cong, ch.gidWeb)', 'nghe(server, ch.ngheSocket, ch.cong, ch.gidKernel)'],
    ['gid-thu-tu', MC, '  if (gid !== undefined) fs.lchownSync(duong, -1, gid);\n  fs.chmodSync(duong, 0o660);\n', '  fs.chmodSync(duong, 0o660);\n  if (gid !== undefined) fs.lchownSync(duong, -1, gid);\n'],
    ['gid-kiem-ham', MC, ' && (gid === undefined || st.gid === gid)', ''],
    ['gid-kiem-mode', MC, ' && mode === 0o660))', '))'],
    ['gid-kiem-goi', MC, '  kiemSocket(duong, gid);\n', ''],
    ['gid-cau-hinh-bat-buoc', CH, "    if (Object.hasOwn(ch, 'ngheSocket') && !Object.hasOwn(ch, k)) throw new Error('cấu hình: thiếu ' + k + ' (bắt buộc khi có ngheSocket)');\n", ''],
    ['gid-cau-hinh-bat-buoc-kernel', CH, "&& !Object.hasOwn(ch, k)) throw", "&& k === 'gidWeb' && !Object.hasOwn(ch, k)) throw"],
    ['gid-cau-hinh-khac-nhau', CH, "  if (Object.hasOwn(ch, 'gidWeb') && ch.gidWeb === ch.gidKernel) throw new Error('cấu hình: gidWeb trùng gidKernel');\n", ''],
    ['gid-cau-hinh-khac-nhau-chi-dev', CH, "if (Object.hasOwn(ch, 'gidWeb') && ch.gidWeb === ch.gidKernel)", "if (Object.hasOwn(ch, 'cong') && ch.gidWeb === ch.gidKernel)"],
    ['gid-cau-hinh-kieu', CH, ' && (!Number.isInteger(ch[k]) || ch[k] < 0)) throw', ' && false) throw'],
    ['gid-cau-hinh-am', CH, 'ch[k] < 0', 'ch[k] < -1'],
    // MEDIUM: /api/ban/tep gắn với manifest anh thấy — so trong tepBan (hàm) · chỗ gọi truyền manifest tính lại · query bắt buộc
    ['tep-manifest-ham', BAN, "  if (manifestCua(ds) !== manifest) throw new LoiGoi(409, 'manifest_lech');\n", ''],
    ['tep-manifest-goi', API, 'return tepBan(ctx.ch, sha, ten, manifest);', 'return xemBan(ctx.ch).then(x => tepBan(ctx.ch, sha, ten, x.cho.find(c => c.sha === sha)?.manifest));'],
    ['tep-manifest-query', API, "    if (!khop(MANIFEST, manifest)) throw saiQuery('manifest');\n", ''],
    // LOW: kernel.sock trần 32 kết nối đồng thời (hằng + dòng gán)
    ['ket-noi-tran-hang', KER, 'const TRAN_KET_NOI = 32;', 'const TRAN_KET_NOI = 33;'],
    ['ket-noi-tran-goi', KER, '  s.maxConnections = TRAN_KET_NOI;\n', ''],
  ],
  // Pha B — B1 lượt 1a: BAN.json (máy chủ) · dom.el cấm thuộc tính (hàm + chỗ gọi) · con chuỗi thành nút chữ · nhãn «chưa nối» · soatTinh (R4)
  B1: [
    ['ban-ten-dat-truoc-ham', BAN, 'const tenDatTruoc = t => t !== BAN_JSON && t.toLowerCase() === BAN_JSON;', 'const tenDatTruoc = t => false;'],
    ['ban-ten-dat-truoc-goi', BAN, "  if (ten.some(tenDatTruoc)) throw new BanHong('ten_dat_truoc');\n", ''],
    ['dom-thuoc-tinh-ham', DOM, "const kiemThuocTinh = k => { if (k === 'style' || k.startsWith('on') || k === 'innerHTML') throw new Error('thuộc tính cấm: ' + k); };", 'const kiemThuocTinh = k => { };', T_KHUNG],
    ['dom-thuoc-tinh-goi', DOM, '    kiemThuocTinh(k);\n', '', T_KHUNG],
    ['dom-chu-ham', DOM, 'for (const c of con) if (c !== null && c !== false && c !== undefined) n.append(c);', "for (const c of con) if (c !== null && c !== false && c !== undefined) { if (typeof c === 'string') n.insertAdjacentHTML('beforeend', c); else n.append(c); }", T_MAN_CHU],
    ['man-chu-chua-noi-ham', MAN_CHU, "chua_noi: 'chưa nối'", "chua_noi: '0'", T_MAN_CHU],
    ['soat-tinh-ham', 'test-web/tinh.test.mjs', '/insertAdjacentHTML\\(/, ', '', T_TINH],
    // B1 lượt 1b: phiên — hẹn het_luc (hàm + chỗ gọi), kiểm lại khi hiện lại (hàm + pageshow + visibilitychange), xoá DOM + DON,
    // api.js nhận ra Hết phiên (hàm + chỗ gọi) + redirect 'manual' (302 lề Access ⇒ opaqueredirect)
    ['phien-hen-ham', PHIEN, 'return Number.isNaN(t) ? 0 : Math.max(0, t - bayGio);', 'return 2147483647;', T_PHIEN],
    ['phien-hen-goi', PHIEN, '  datHen(o.het_luc);\n', '', T_PHIEN],
    ['phien-kiem-lai-ham', PHIEN, 'export async function kiemLai() {', 'export async function kiemLai() { return;', T_PHIEN],
    ['phien-pageshow-goi', PHIEN, "  window.addEventListener('pageshow', kiemLai);\n", '', T_PHIEN],
    ['phien-hien-lai-goi', PHIEN, "  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kiemLai(); });\n", '', T_PHIEN],
    ['phien-xoa-dom-ham', PHIEN, "  document.getElementById('noi-dung').replaceChildren();\n", '', T_PHIEN],
    ['phien-don-goi', PHIEN, '  for (const f of DON) f();\n', '', T_PHIEN],
    ['api-het-phien-ham', API_WEB, "export const laHetPhien = r => r.type === 'opaqueredirect' || r.status === 401 || r.status === 403;", 'export const laHetPhien = r => false;', T_PHIEN],
    ['api-het-phien-goi', API_WEB, '  if (laHetPhien(r)) { khiHetPhien(); throw new LoiPhien(); }\n', '', T_PHIEN],
    ['api-redirect', API_WEB, "redirect: 'manual'", "redirect: 'follow'", T_PHIEN],
    // B1 vòng sửa 1: chưa hẹn được het_luc ⇒ không vẽ (hàm + chỗ gọi ở veMan) · phản hồi /api/man-chu về sau het_luc không vào lại đệm ·
    // xoá đệm khi hết phiên: don() của màn chủ (hàm) + đăng ký don ở khung.js (chỗ gọi)
    ['phien-chua-kiem-ham', PHIEN, 'export async function daKiemPhien() {', 'export async function daKiemPhien() { return true;', T_PHIEN],
    ['phien-chua-kiem-goi', KHUNG, '  if (!(await daKiemPhien())) return;   // chưa hẹn được het_luc ⇒ không vẽ dữ liệu\n', '', T_PHIEN],
    ['man-chu-het-phien-goi', MAN_CHU, '    if (daHetPhien()) return;   // phản hồi về sau het_luc (đã don()) ⇒ không đưa lại vào đệm\n', '', T_PHIEN],
    ['man-chu-don-ham', MAN_CHU, 'don() { duLieu = null; }', 'don() {}', T_PHIEN],
    ['khung-dang-ky-don-goi', KHUNG, '  for (const m of SO_MAN.values()) dangKyDon(() => m.don());\n', '', T_PHIEN],
    // B1 lượt 1c: service worker — danh sách trắng (hàm + chỗ gọi), vỏ khi 401/403, dọn cache SHA khác (hàm + chỗ gọi), skipWaiting, claim;
    // lật bản: so SHA (hàm + chỗ gọi tải lại)
    ['sw-la-vo-ham', SW, "const laVo = u => u.origin === self.location.origin && u.search === '' && VO.includes(u.pathname);", 'const laVo = u => u.origin === self.location.origin;', T_SW],
    ['sw-la-vo-goi', SW, "if (e.request.method !== 'GET' || !laVo(u)) return;", "if (e.request.method !== 'GET') return;", T_SW],
    ['sw-401-vo', SW, '  if (r.status === 401 || r.status === 403) return (await caches.match(u.pathname, { cacheName: TEN })) || r;\n', '', T_SW],
    ['sw-don-cache-ham', SW, 'async function donCache() { for (const k of await caches.keys()) if (k !== TEN) await caches.delete(k); }', 'async function donCache() {}', T_SW],
    ['sw-don-cache-goi', SW, 'donCache().then(() => self.clients.claim())', 'self.clients.claim()', T_SW],
    ['sw-skip-waiting', SW, 'self.skipWaiting(); ', '', T_SW],
    ['sw-claim', SW, '.then(() => self.clients.claim())', '', T_SW],
    ['phien-so-sha-ham', PHIEN, 'export const soSha = (cu, moi) => cu !== null && moi !== null && cu !== moi;', 'export const soSha = () => false;', T_SW],
    ['phien-so-sha-goi', PHIEN, '  if (soSha(SHA_TRANG, moi)) location.reload();\n', '', T_SW],
    // B1 lượt 1d: /phuc-hoi giữ nút Lùi tắt sau khi lùi (hàm xongLui + chỗ gọi; neo cả đầu hàm — `$('lui').disabled = true;` có 2 chỗ, R8),
    // gỡ SW lỗi bọc riêng (R8: catch ném lại) · màn #ban: xem tệp mang manifest (chỗ gọi) · 423 ⇒ chỉ đọc (hàm + chỗ gọi, B1-T3)
    ['phuc-hoi-giu-tat-ham', BAN, "function xongLui(sha, goLoi) { $('lui').disabled = true; ", 'function xongLui(sha, goLoi) { ', T_PHUC_HOI],
    ['phuc-hoi-giu-tat-goi', BAN, '    xongLui(sha, goLoi);\n', '', T_PHUC_HOI],
    ['phuc-hoi-go-sw-ham', BAN, 'catch { goLoi = true; }', 'catch (e) { throw e; }', T_PHUC_HOI],
    ['ban-ui-manifest-goi', BAN_UI, 'const q = new URLSearchParams({ sha: b.sha, ten, manifest: b.manifest });', 'const q = new URLSearchParams({ sha: b.sha, ten });', T_BAN_UI],
    ['api-chi-doc-ham', API_WEB, 'export const laChiDoc = r => r.status === 423;', 'export const laChiDoc = r => false;', T_BAN_UI],
    ['api-chi-doc-goi', API_WEB, '  if (laChiDoc(r)) { khiChiDoc(); throw new LoiChiDoc(); }\n', '', T_BAN_UI],
  ],
  // B2 lượt 2a: máy chủ — /api/viec-bo (lọc việc chưa xong · chỗ gọi: route luôn chua_noi) · /api/phien cos_ghi (R12)
  B2: [
    ['viec-bo-ham', API, "d => d.viec.filter(v => !v.xong)) };", 'd => d.viec) };'],
    ['viec-bo-goi', API, 'return { viec_bo: vao === undefined ?', 'return { viec_bo: true ?'],
    ['cos-ghi-ham', API, 'cos_ghi: ctx.ch.cosGhi === true,', 'cos_ghi: true,'],
    // B2 lượt 2b: màn Việc & lịch — vẽ lại sau ghi (hàm + chỗ gọi) · brief từ /api/brief (chỗ gọi: brief mẫu; hàm: veBrief ghi '0') ·
    // Hoàn tác từng bước (hàm: pop ⇒ shift; chỗ gọi: thanh Hoàn tác không gắn hàm)
    ['ghi-tai-lai-ham', VL, 'export async function taiLai() {', 'export async function taiLai() { return;', T_VL],
    ['ghi-tai-lai-goi', VG, '  await taiLai();\n', '', T_VL],
    ['brief-goi', VL, "const b = await goiApi('/api/brief');", 'const b = { qua_han: 2, han_hom_nay: 3, lich_hom_nay: 1, de_xuat_cho: 1 };', T_VL],
    ['brief-ham', VL, "el('span', { 'data-so': k }, String(b[k]))", "el('span', { 'data-so': k }, '0')", T_VL],
    ['hoan-tac-ham', VG, 'LICH_SU.pop()', 'LICH_SU.shift()', T_VL],
    ['hoan-tac-goi', VG, 'hienHoanTac(tin, hoanTac);', 'hienHoanTac(tin, null);', T_VL],
    // B2 lượt 2c: trả focus sau Huỷ/Esc (hàm: traFocus không focus) · miền ngày R11 (hàm: oNgay bỏ min/max; chỗ gọi: ô han của form việc không qua oNgay) ·
    // don() của màn cos không còn thật (bí mật còn trong heap sau het_luc) · cos_ghi (chỗ gọi: màn luôn bật nút ghi)
    ['focus-ham', 'web/giao-dien.js', 'function traFocus() { traVe?.focus(); traVe = null; }', 'function traFocus() { traVe = null; }', T_VL],
    ['ngay-mien-ham', 'web/giao-dien.js', ', min: MIEN_NGAY.min, max: MIEN_NGAY.max', '', T_VL],
    ['ngay-mien-goi', VG, "o('Hạn', oNgay('han', v?.han?.slice(0, 10))),", "o('Hạn', el('input', { type: 'date', name: 'han' })),", T_VL],
    ['viec-don-goi', VL, 'don() { donGhi(); dem = null;', 'donX() { donGhi(); dem = null;', T_VL],
    ['don-ghi-goi', VL, 'don() { donGhi(); dem = null;', 'don() { dem = null;', T_VL],
    ['cos-ghi-goi', VL, "datGhi((await goiApi('/api/phien')).cos_ghi === true)", 'datGhi(true)', T_VL],
  ],
  // B3 lượt 3a: Hỏi AI chỉ đề xuất — kiemDeXuatAI từng điều kiện (hàm) + chỗ gọi ở taoDeXuat / apDungDeXuat · docDeXuat chặn HTML (hàm) + chỗ gọi ·
  // chu_the 'ai' · cấy «ghi ngay lúc đề xuất» (đối chứng Đ2) · route: cổng cos_ghi + 503 chưa cấu hình (R11). Không ai-ngay-ham (R11).
  B3: [
    ['ai-so-thao-tac-ham', GOI, "ops.length !== 1) throw sai('so_thao_tac');", "ops.length < 1) throw sai('so_thao_tac');", T_AI],
    ['ai-loai-ham', GOI, "  if (op.loai !== 'sua' || op.bang !== 'viec') throw sai('loai');\n", '', T_AI],
    ['ai-truong-ham', GOI, "  if (!laObj(op.truong) || Object.keys(op.truong).join() !== 'han') throw sai('truong');\n", '', T_AI],
    ['ai-viec-het-ham', GOI, "  if (!v || v.xoa_luc !== null || v.xong_luc !== null) throw sai('viec_het');\n", '', T_AI],
    ['ai-kiem-tao-goi', GOI, "  if (chu_the === 'ai') kiemDeXuatAI(db, opsChuan);\n", '', T_AI],
    ['ai-kiem-ap-dung-goi', GOI, "  if (dx.chu_the === 'ai') kiemDeXuatAI(db, JSON.parse(dx.ops));", '', T_AI],
    ['ai-html-ham', HA, '  if (/[<>]/.test(o.noi_dung)) return null;\n', '', T_AI],
    ['ai-doc-de-xuat-goi', HA, 'const d = docDeXuat(chu);', 'const d = JSON.parse(chu);', T_AI],
    ['ai-chu-the', HA, "chu_the: 'ai'", "chu_the: 'neo'", T_AI],
    ['ai-ghi-ngay', HA, 'ops: d.ops }, iso);\n', "ops: d.ops }, iso);\n      (await import('./goi.mjs')).apGoi(ctx.db, { khoa_lap: crypto.randomUUID(), ops: d.ops, chu_the: 'anh', nguon: { loai: 'de_xuat' } }, iso);\n", T_AI],
    ['ai-cos-ghi-goi', API, '{ kiemCosGhi(ctx); docJson(than, []); if (!ctx.goiAI)', '{ docJson(than, []); if (!ctx.goiAI)', T_AI],
    ['ai-chua-cau-hinh-goi', API, " if (!ctx.goiAI) throw new LoiGoi(503, 'ai_chua_cau_hinh');", '', T_AI],
    // B3 lượt 3b: quyền khoá (hàm) + chỗ gọi docKhoaAI ở khoiDong (ca khởi động 0644; fetch tới 8317 bị bộ gác test chặn) · redirect manual · không tools (R11).
    ['ai-khoa-quyen-ham', HA, '(st.mode & 0o077) !== 0 || st.uid !== process.getuid()', 'st.uid !== process.getuid()', T_AI],
    ['ai-khoa-goi', MC, 'khoa: () => docKhoaAI(ch.tepKhoaAI)', "khoa: () => fs.readFileSync(ch.tepKhoaAI, 'utf8').trim()", T_AI],
    ['ai-redirect-ham', HA, "redirect: 'manual'", "redirect: 'follow'", T_AI],
    ['ai-tools-ham', HA, "response_format: { type: 'json_object' } }", "response_format: { type: 'json_object' }, tools: [] }", T_AI],
  ],
};

const chon = process.argv.slice(2);
for (const n of chon) if (!Object.hasOwn(NHOM, n)) { console.error(`không có nhóm ${n}; có: ${Object.keys(NHOM).join(', ')}`); process.exit(2); }
const DS = (chon.length ? chon : Object.keys(NHOM)).flatMap(n => NHOM[n]);

function chep(dich) {
  const tep = execFileSync('git', ['-C', REPO, 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const t of tep) {
    const nguon = path.join(REPO, t), st = fs.lstatSync(nguon, { throwIfNoEntry: false });
    if (!st) continue;   // đã xoá ở cây làm việc, còn trong chỉ mục
    if (!st.isFile()) throw new Error(`không phải tệp thường (symlink?): ${t} — từ chối chép`);
    fs.mkdirSync(path.join(dich, path.dirname(t)), { recursive: true });
    fs.copyFileSync(nguon, path.join(dich, t));
  }
}

// rc 0 ⇒ SỐNG · rc 1 kèm ít nhất một test hỏng ⇒ DIỆT · hết giờ / chết vì tín hiệu / rc khác ⇒ LỖI ĐO.
// Tệp test không nạp được (ca «not ok» mang tên tệp *.test.mjs, hoặc số test chạy ít hơn bản gốc) ⇒ LỖI ĐO: đỏ vì import hỏng, không phải test bắt.
// `node --test` chạy trong NHÓM tiến trình riêng (detached): xong hay hết giờ đều giết CẢ nhóm — SIGKILL riêng cha bỏ lại tiến trình
// con từng tệp test (treo mãi). TMPDIR + WO_GOC (chung.mjs) trỏ thư mục riêng của lượt, dọn sau lượt: test bị giết không bỏ lại wo-*.
function chayCon(thuMuc, tep) {
  const goc = fs.mkdtempSync('/tmp/wd-'), han = tep.some(t => t.startsWith('test-web/')) ? HAN_WEB_MS : HAN_MS;
  return new Promise(ok => {
    const con = spawn(NODE, ['--test', '--test-reporter=tap', ...tep], { cwd: thuMuc, detached: true, stdio: ['ignore', 'pipe', 'ignore'], env: { ...process.env, TMPDIR: goc, WO_GOC: goc, WEB_DOI_CHUNG: '0' } });
    const ra = [];
    let het = false;
    // ESRCH: nhóm đã hết · EPERM: macOS trả khi nhóm chỉ còn tiến trình xác (zombie) chờ launchd gặt — đều là đã chết.
    const giet = () => { try { process.kill(-con.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH' && e.code !== 'EPERM') throw e; } };
    const t = setTimeout(() => { het = true; giet(); }, han);
    const xong = r => { clearTimeout(t); if (con.pid) giet(); fs.rmSync(goc, { recursive: true, force: true }); ok(r); };
    con.stdout.on('data', d => ra.push(d));
    con.on('error', e => xong({ error: e }));
    con.on('close', (status, signal) => xong({ status, signal: het ? 'hết giờ' : signal, stdout: Buffer.concat(ra).toString('utf8') }));
  });
}

async function chayTest(thuMuc, tep, soGoc = 0) {
  const r = await chayCon(thuMuc, tep);
  if (r.error || r.signal) return { kq: 'LỖI ĐO', ghi: r.error?.code ?? r.signal };
  const tong = Number(/^# tests (\d+)$/m.exec(r.stdout)?.[1] ?? 0);
  if (r.status === 0) return { kq: 'SỐNG', ghi: '', tong };
  const hong = Number(/^# fail (\d+)$/m.exec(r.stdout)?.[1] ?? 0), dau = /^\s*not ok \d+ - (.+)$/m.exec(r.stdout)?.[1] ?? '';
  const nap = /^\s*not ok \d+ - (.+\.test\.mjs)$/m.exec(r.stdout)?.[1];
  if (nap || tong < soGoc) return { kq: 'LỖI ĐO', ghi: `nạp hỏng: ${nap ?? '-'} · chạy ${tong}/${soGoc} test` };
  return r.status === 1 && hong > 0 ? { kq: 'DIỆT', ghi: dau } : { kq: 'LỖI ĐO', ghi: `rc ${r.status}, fail ${hong}` };
}

// Kiểm cú pháp sau đột biến. .js của web/ là ES module không có package.json: `node --check tệp.js` trả 0 cả khi sai cú pháp (đo 13/11,
// Node 26) ⇒ đọc qua stdin với --input-type=module. Tệp không phải JS (css/html…) ⇒ không kiểm.
function cuPhapDung(f) {
  if (f.endsWith('.mjs')) return spawnSync(NODE, ['--check', f]).status === 0;
  if (f.endsWith('.js')) return spawnSync(NODE, ['--input-type=module', '--check'], { input: fs.readFileSync(f) }).status === 0;
  return true;
}

async function chayHet(tam) {
  chep(tam);
  const tongGoc = new Map();   // bộ tệp test (nối bằng dấu cách) ⇒ số test của bản chép chưa đột biến
  for (const bo of new Set(DS.map(d => (d[4] ?? BO_MAC_DINH).join(' ')))) {
    const goc = await chayTest(tam, bo.split(' '));
    if (goc.kq !== 'SỐNG' || !(goc.tong > 0)) { console.log(`GỐC ĐỎ · ${bo} · ${goc.kq} · ${goc.ghi} · ${goc.tong ?? 0} test`); return 1; }
    console.log(`gốc XANH · ${goc.tong} test · ${bo}`);
    tongGoc.set(bo, goc.tong);
  }
  let xau = 0;
  for (const [ten, tep, cu, moi, bo = BO_MAC_DINH] of DS) {
    const f = path.join(tam, tep), nguyen = fs.readFileSync(f, 'utf8'), n = nguyen.split(cu).length - 1;
    let kq;
    if (n !== 1) kq = { kq: 'LỖI ĐO', ghi: `khớp ${n} chỗ` };
    else {
      fs.writeFileSync(f, nguyen.replace(cu, () => moi));
      try {
        kq = !cuPhapDung(f) ? { kq: 'LỖI ĐO', ghi: 'lỗi cú pháp sau đột biến' } : await chayTest(tam, bo, tongGoc.get(bo.join(' ')));
      } finally { fs.writeFileSync(f, nguyen); }
    }
    if (kq.kq !== 'DIỆT') xau++;
    console.log(`${ten} · ${kq.kq} · ${kq.ghi}`);
  }
  console.log(`tổng ${DS.length} · DIỆT ${DS.length - xau} · SỐNG/LỖI ĐO ${xau}`);
  return xau ? 1 : 0;
}

const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'webos-dot-bien-'));
let ma = 1;
try { ma = await chayHet(tam); } finally { fs.rmSync(tam, { recursive: true, force: true }); }
process.exit(ma);
