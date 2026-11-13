// node kiem/doi-chung.mjs [tên cấy…]   (đứng ở gốc repo; vắng tên ⇒ mọi cấy)
// Đối chứng THẬT cho bộ đo (B4; chép từ web-os-demo@6f544d4 kiem/doi-chung.cjs rồi vá): chạy gốc (bản web/ sạch, 6 cỡ) ⇒ phải rc 0; mỗi cấy
// [tên, tệp, cũ, mới, lý do, cỡ, lo] áp vào bản chép web/ qua đường duyệt A5 (chay-do.mjs --va ⇒ datBan va), chạy MỘT cỡ:
// (1) bộ đo MỚI phải rc 1 VÀ in đúng lý do; (2) lo khác null ⇒ bộ đo với --cu <lo> phải rc 0 (bộ đo cũ lọt). rc 0 = mọi điều kiện đạt.
// Neo `cũ` là hợp đồng (QĐ 13): khớp ĐÚNG 1 chỗ trong tệp web/ — kiểm trước khi chạy.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const doDemo = fileURLToPath(new URL('./chay-do.mjs', import.meta.url));
const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const NEO_CSS = '.de-xuat .nhan { font-weight: 600; color: var(--phu); }';   // dòng cuối man.css: cấy CSS nối sau dòng này
const CAY = [ // [tên, tệp, chuỗi cũ (đúng 1 chỗ), chuỗi mới, lý do phải thấy, cỡ, lỗ (--cu) hay null]
  ['Thẻ gập chữ nhỏ', 'man.css', NEO_CSS, NEO_CSS + '\n[data-khoi] .than-khoi{font-size:12px}', 'chữ < 16 px', '375x812-light', null],
  ['style= nội tuyến', 'index.html', '<p id="tin" class="tin" role="status"></p>', '<p style="color:red">x</p>\n<p id="tin" class="tin" role="status"></p>', 'style= nội tuyến', '375x812-light', null],
  ['Khối dưới nếp gấp', 'man.css', NEO_CSS, NEO_CSS + '\n.luoi-chu{margin-top:900px}', 'khối dưới nếp gấp', '1440x900-light', null],
  ['Lớp phủ che nút', 'man.css', NEO_CSS, NEO_CSS + '\n.nut-dong:has(> [data-act="them-viec"]){position:relative}.nut-dong:has(> [data-act="them-viec"])::after{content:"";position:absolute;inset:0}', 'nút bị che', '375x812-light', null],
  ['Ghi không vẽ lại', 'viec-ghi.js', '  await taiLai();\n', '', 'giao diện không đổi', '375x812-light', null],
];
const chon = process.argv.slice(2), ds = chon.length ? CAY.filter(c => chon.includes(c[0])) : CAY;
const chay = (...a) => spawnSync(process.execPath, [doDemo, ...a], { encoding: 'utf8', timeout: 240000 });
const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'doi-chung-')), tepVa = path.join(tam, 'va.json');
let sai = 0;
for (const t of chon.filter(t => !CAY.some(c => c[0] === t))) { sai++; console.log(JSON.stringify({ ban: t, loi: 'không có cấy tên này' })); }
try {
  const g = chay();
  console.log(JSON.stringify({ ban: 'GỐC', rc: g.status, dat: g.status === 0 }));
  if (g.status !== 0) { sai++; console.log((g.stdout + g.stderr).slice(0, 1500)); }
  for (const [ten, tep, cu, moi, lyDo, co, lo] of ds) {
    if (fs.readFileSync(path.join(WEB, tep), 'utf8').split(cu).length !== 2) { sai++; console.log(JSON.stringify({ ban: ten, loi: 'mẫu cấy không khớp đúng 1 chỗ' })); continue; }
    fs.writeFileSync(tepVa, JSON.stringify({ [tep]: [[cu, moi]] }));
    const r = chay('--va', tepVa, '--co', co), dungLyDo = (r.stdout || '').includes(lyDo);
    let dat = r.status === 1 && dungLyDo, rcCu = null;
    if (lo !== null) { rcCu = chay('--va', tepVa, '--co', co, '--cu', lo).status; dat &&= rcCu === 0; }
    console.log(JSON.stringify({ ban: ten, co, rc: r.status, dungLyDo, ...(lo !== null ? { lo, rcCu } : {}), dat }));
    if (!dat) { sai++; console.log((r.stdout + r.stderr).slice(0, 1500)); }
  }
} finally { if (fs.existsSync(tepVa)) fs.unlinkSync(tepVa); fs.rmdirSync(tam); }
console.log(sai ? `ĐỐI CHỨNG TRƯỢT: ${sai}` : `ĐỐI CHỨNG ĐẠT: gốc đạt, ${ds.length}/${ds.length} bản hỏng bị bắt đúng lý do`);
process.exitCode = sai ? 1 : 0;
