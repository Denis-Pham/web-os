// Đột biến máy chủ web-os (R7). Chuyển thể từ Learning kiem/dot-bien-may-chu.mjs @630a0bf, vá lỗi xanh-sai của bản đó
// (mọi rc ≠ 0, kể cả hết giờ, tính «diệt»; còn đột biến sống vẫn thoát 0).
// Dùng: node kiem/dot-bien-may-chu.mjs [NHÓM …]   (vd A1; bỏ trống = mọi nhóm). Thoát 0 CHỈ khi gốc xanh và MỌI đột biến DIỆT.
// Chép từng tệp của `git ls-files` (đã theo dõi + chưa theo dõi mà không bị .gitignore) sang thư mục tạm — không rsync/cp -R,
// không symlink (symlink ghi xuyên về nguồn thật). Bản chép CHƯA đột biến chạy trước: không xanh ⇒ «GỐC ĐỎ», thoát 1.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url))), NODE = process.execPath, HAN_MS = 60000;
const KHO = 'may-chu/kho.mjs', GOI = 'may-chu/goi.mjs';
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
    ['ops-mang', GOI, '!Array.isArray(ops) || ', ''],
    ['ops-it-nhat-1', GOI, 'ops.length < 1 || ', ''],
    ['ops-tran-40', GOI, 'ops.length > 40', 'ops.length > 41'],
    ['ops-loai', GOI, ' || !Object.hasOwn(KHOA_OP, op.loai)', ''],
    ['ops-khoa-la', GOI, "    if (Object.keys(op).some(k => !khoa.includes(k))) throw hong('khoa_la');\n", ''],
    ['ops-bang', GOI, "    if (!Object.hasOwn(LUOC, op.bang)) throw hong('bang');\n", ''],
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
function chayTest(thuMuc) {
  const r = spawnSync(NODE, ['--test', '--test-reporter=tap', 'test-may-chu/*.test.mjs'], { cwd: thuMuc, encoding: 'utf8', timeout: HAN_MS, killSignal: 'SIGKILL' });
  if (r.error || r.signal) return { kq: 'LỖI ĐO', ghi: r.error?.code ?? r.signal };
  if (r.status === 0) return { kq: 'SỐNG', ghi: '' };
  const hong = Number(/^# fail (\d+)$/m.exec(r.stdout)?.[1] ?? 0), dau = /^\s*not ok \d+ - (.+)$/m.exec(r.stdout)?.[1] ?? '';
  return r.status === 1 && hong > 0 ? { kq: 'DIỆT', ghi: dau } : { kq: 'LỖI ĐO', ghi: `rc ${r.status}, fail ${hong}` };
}

function chayHet(tam) {
  chep(tam);
  const goc = chayTest(tam);
  if (goc.kq !== 'SỐNG') { console.log(`GỐC ĐỎ · ${goc.kq} · ${goc.ghi}`); return 1; }
  console.log('gốc XANH');
  let xau = 0;
  for (const [ten, tep, cu, moi] of DS) {
    const f = path.join(tam, tep), nguyen = fs.readFileSync(f, 'utf8'), n = nguyen.split(cu).length - 1;
    let kq;
    if (n !== 1) kq = { kq: 'LỖI ĐO', ghi: `khớp ${n} chỗ` };
    else {
      fs.writeFileSync(f, nguyen.replace(cu, () => moi));
      try {
        kq = spawnSync(NODE, ['--check', f]).status !== 0 ? { kq: 'LỖI ĐO', ghi: 'lỗi cú pháp sau đột biến' } : chayTest(tam);
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
try { ma = chayHet(tam); } finally { fs.rmSync(tam, { recursive: true, force: true }); }
process.exit(ma);
