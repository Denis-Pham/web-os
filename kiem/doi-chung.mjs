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
// ai.js apDung: thay lời gọi /ap-dung bằng POST /api/goi (op đọc lại từ /api/de-xuat) rồi bo-qua — máy chủ không còn gác giá trị đề xuất.
const NEO_AP = `  try { o = await goiApi('/api/de-xuat/' + id + '/ap-dung', { method: 'POST', than: { khoa_lap } }); }`;
const apThay = than => `  try { const op = (await goiApi('/api/de-xuat?mach=cos')).de_xuat.find(d => String(d.id) === id).ops[0]; ${than} await goiApi('/api/de-xuat/' + id + '/bo-qua', POST); }`;
const goi = ops => `o = await goiApi('/api/goi', { method: 'POST', than: { khoa_lap, ops: [${ops}] } });`;
const CAY = [ // [tên, tệp, chuỗi cũ (đúng 1 chỗ), chuỗi mới, lý do phải thấy, cỡ, lỗ (--cu) hay null]
  ['Thẻ gập chữ nhỏ', 'man.css', NEO_CSS, NEO_CSS + '\n[data-khoi] .than-khoi{font-size:12px}', 'chữ < 16 px', '375x812-light', null],
  ['style= nội tuyến', 'index.html', '<p id="tin" class="tin" role="status"></p>', '<p style="color:red">x</p>\n<p id="tin" class="tin" role="status"></p>', 'style= nội tuyến', '375x812-light', null],
  ['Khối dưới nếp gấp', 'man.css', NEO_CSS, NEO_CSS + '\n.luoi-chu{margin-top:900px}', 'khối dưới nếp gấp', '1440x900-light', null],
  ['Lớp phủ che nút', 'man.css', NEO_CSS, NEO_CSS + '\n.nut-dong:has(> [data-act="them-viec"]){position:relative}.nut-dong:has(> [data-act="them-viec"])::after{content:"";position:absolute;inset:0}', 'nút bị che', '375x812-light', null],
  ['Ghi không vẽ lại', 'viec-ghi.js', '  await taiLai();\n', '', 'giao diện không đổi', '375x812-light', null],
  ['Áp dụng ghi hạn khác', 'ai.js', NEO_AP, apThay(`const han = new Date(Date.parse(op.truong.han.slice(0, 10)) + 2 * 864e5).toISOString().slice(0, 10) + op.truong.han.slice(10); ` +
    goi(`{ loai: 'sua', bang: 'viec', id: op.id, phien_ban: op.phien_ban, truong: { han } }`)), 'Áp dụng sai giá trị hạn', '375x812-light', 'R6'],
  ['Áp dụng thêm dòng', 'ai.js', NEO_AP, apThay(goi(`{ loai: 'them', bang: 'viec', truong: { tieu_de: timDong('viec', op.id).tieu_de, han: op.truong.han } }`)),
    'Áp dụng thêm/bớt dòng', '375x812-light', 'K1'],
  ['Màn chỉ xem có nút ghi ẩn', 'mach.js', `    if (id !== 'hoc') { than.append(chuaNoi()); return; }`,
    `    if (id !== 'hoc') { const b = el('button', { type: 'button' }, 'Xem thêm'); b.addEventListener('click', () => fetch('/api/goi', { method: 'POST', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ khoa_lap: crypto.randomUUID(), ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc ẩn' } }] }) })); than.append(chuaNoi(), b); return; }`,
    'màn chỉ xem đổi trạng thái', '375x812-light', 'R7'],
  ['AI ghi ngay khi hiện', 'ai.js', '    veHop(ds, r.de_xuat === null);\n', `    veHop(ds, r.de_xuat === null);\n    apDung(document.querySelector('#hop [data-act="ap-dung"]'));\n`,
    'hiện đề xuất đã ghi dữ liệu', '375x812-light', null],
  ['Bỏ qua vẫn ghi', 'ai.js', `    await goiApi('/api/de-xuat/' + id + '/bo-qua', POST);`, `    await goiApi('/api/de-xuat/' + id + '/ap-dung', { method: 'POST', than: { khoa_lap: khoaLap() } });`,
    'Bỏ qua đổi dữ liệu', '375x812-light', null],
  ['AI đổi nhầm dòng', 'ai.js', NEO_AP, apThay(`const v = (await goiApi('/api/viec')).viec.find(x => x.id !== op.id && !x.xong_luc); ` +
    goi(`{ loai: 'sua', bang: 'viec', id: v.id, phien_ban: v.phien_ban, truong: { han: op.truong.han } }`)), 'Áp dụng sai giá trị hạn', '375x812-light', null],
  // lượt 4c: R8 (liên kết thanh trái — lớp thật `lk-mach`), R11 (miền ngày), bàn phím (ngăn ☰ inert, Esc trả focus)
  ['Liên kết thanh trái bị chặn', 'khung.js', `  window.addEventListener('hashchange', veMan);`,
    `  window.addEventListener('hashchange', veMan);\n  document.addEventListener('click', e => { if (e.target.closest('.lk-mach')) e.preventDefault(); }, true);`,
    'bấm liên kết không đổi màn', '1440x900-light', 'R8'],
  // Hash đổi khi bấm liên kết nhưng màn không vẽ lại (bỏ nghe hashchange); lo null: do-r8-ham chỉ kiểm hash nên cấy này LỌT bản đó.
  ['Đổi hash không vẽ màn', 'khung.js', `  window.addEventListener('hashchange', veMan);\n`, '', 'bấm liên kết không đổi màn', '1440x900-light', null],
  ['Ô ngày thiếu min/max', 'giao-dien.js', ', max: MIEN_NGAY.max', '', 'ô ngày thiếu min/max', '375x812-light', 'R11'],
  ['Ngăn ☰ không inert', 'khung.js', `  document.querySelector('.workspace').inert = mo;\n`, '', 'Tab thoát khỏi ngăn', '375x812-light', null],
  // Bỏ hẳn traVe?.focus() là cấy TƯƠNG ĐƯƠNG trên Chromium: <dialog> modal đóng thì trình duyệt tự trả focus về phần tử trước showModal
  // (đo 4c: bản cấy đó vẫn rc 0 sau khi có phép bàn phím). Cấy làm focus thật sự không về: traFocus bỏ focus đang có.
  ['Esc không trả focus', 'giao-dien.js', 'function traFocus() { traVe?.focus(); traVe = null; }', 'function traFocus() { document.activeElement?.blur(); traVe = null; }',
    'focus không về chỗ cũ', '375x812-light', null],
];
const chon = process.argv.slice(2), ds = chon.length ? CAY.filter(c => chon.includes(c[0])) : CAY;
const chay = (...a) => spawnSync(process.execPath, [doDemo, ...a], { encoding: 'utf8', timeout: 240000 });
const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'doi-chung-')), tepVa = path.join(tam, 'va.json');
let sai = 0;
for (const t of chon.filter(t => !CAY.some(c => c[0] === t))) { sai++; console.log(JSON.stringify({ ban: t, loi: 'không có cấy tên này' })); }
try {
  const g = ds.length < CAY.length ? chay('--co', [...new Set(ds.map(c => c[5]))].join(',')) : chay();   // có tên cấy ⇒ gốc chỉ trên cỡ của cấy được chọn
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
const soLo = ds.filter(c => c[6] !== null).length;
console.log(sai ? `ĐỐI CHỨNG TRƯỢT: ${sai}` : `ĐỐI CHỨNG ĐẠT: gốc đạt, ${ds.length}/${ds.length} bản hỏng bị bắt đúng lý do, ${soLo}/${soLo} lỗ «bộ đo cũ lọt»`);
process.exitCode = sai ? 1 : 0;
