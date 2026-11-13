// node kiem/doi-chung.cjs [demo/codex]   (đứng ở gốc repo)
// Đối chứng THẬT cho bộ đo: chép bản demo, cấy từng lỗi một, chạy kiem/chay-do.cjs. Mỗi bản hỏng phải rc 1 VÀ lời trượt
// phải chứa đúng lý do; bản gốc phải rc 0. rc 0 = bộ đo phân biệt được đúng/sai ở mọi phép. Mẫu cấy viết cho bản Sổ (demo/codex).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const goc = path.resolve(process.argv[2] || 'demo/codex');
const doDemo = path.join(__dirname, 'chay-do.cjs');
const CAY = [ // [tên, tệp, chuỗi cũ (đúng 1 chỗ) hoặc null = nối vào cuối, chuỗi mới, lý do phải thấy]
  ['ghi không vẽ lại', 'app.js', '  thayDoi();\n  veMan();\n  bao(tin);', '  thayDoi();\n  bao(tin);', 'giao diện không đổi sau khi ghi'],
  ['thẻ gập chữ nhỏ', 'style.css', null, '\n@media(max-width:760px){.card.expanded .card-body *{font-size:9px!important}}', 'khi mở'],
  ['AI đổi nhầm dòng', 'app.js', 'duLieu.viec.find(v => v.id === id).han = han;', 'duLieu.viec.find(v => v.id !== id && !v.xong).han = han;', 'không phải dòng đề xuất nói'],
  ['AI ghi ngay khi hiện', 'app.js', "toISOString().slice(0, 10) } : null;", "toISOString().slice(0, 10) } : null;\n    if (v) v.han = deXuat.han;", 'hiện đề xuất đã ghi dữ liệu'],
  ['Bỏ qua vẫn ghi', 'app.js', 'function boQuaDeXuat() {\n', 'function boQuaDeXuat() {\n  if (deXuat) duLieu.viec.find(v => v.id === deXuat.id).han = deXuat.han;\n', 'Bỏ qua đổi dữ liệu'],
  ['style= nội tuyến', 'app.js', '<span class="w-${n}"></span>', '<span style="width:${n}%"></span>', 'style=/script nội tuyến'],
  ['khối dưới nếp gấp', 'style.css', null, '\n@media(min-width:1280px){.dashboard{margin-top:700px}}', 'dưới nếp gấp'],
  ['lớp phủ che nút', 'style.css', null, '\nbody::after{content:"";position:fixed;inset:0;z-index:999}', 'bị che'],
  // góp ý 12/11: Não chung, SIA, Toà án
  ['Não chung thiếu bản đồ ký ức', 'app.js', 'data-phan="ban-do-ky-uc"', 'data-phan="khac"', 'thiếu phần ban-do-ky-uc'],
  ['tìm ký ức không lọc', 'app.js', 'el.hidden = !khop;', 'el.hidden = false;', 'tìm ký ức không lọc'],
  ['SIA lọt nút ghi', 'app.js', "${dauThe('Các vụ hội đồng đã bàn'", "<button data-act=\"mo-vu\">Mở vụ mới</button>${dauThe('Các vụ hội đồng đã bàn'", 'SIA có nút ghi'],
];
const chay = dir => spawnSync(process.execPath, [doDemo, dir], { encoding: 'utf8', timeout: 240000 });
const tam = fs.mkdtempSync(path.join(os.tmpdir(), 'doi-chung-'));
let sai = 0;
try {
  const g = chay(goc);
  console.log(JSON.stringify({ ban: 'GỐC', rc: g.status, dat: g.status === 0 }));
  if (g.status !== 0) { sai++; console.log(g.stdout.slice(0, 600)); }
  for (const [ten, tep, cu, moi, lyDo] of CAY) {
    const dir = path.join(tam, String(CAY.findIndex(c => c[0] === ten)));
    fs.cpSync(goc, dir, { recursive: true });
    const p = path.join(dir, tep), s = fs.readFileSync(p, 'utf8');
    if (cu !== null && s.split(cu).length !== 2) { sai++; console.log(JSON.stringify({ ban: ten, loi: 'mẫu cấy không khớp đúng 1 chỗ' })); continue; }
    fs.writeFileSync(p, cu === null ? s + moi : s.replace(cu, () => moi));
    const r = chay(dir), dungLyDo = (r.stdout || '').includes(lyDo), dat = r.status === 1 && dungLyDo;
    console.log(JSON.stringify({ ban: ten, rc: r.status, dungLyDo, dat }));
    if (!dat) sai++;
  }
} finally { fs.rmSync(tam, { recursive: true, force: true }); }
console.log(sai ? `ĐỐI CHỨNG TRƯỢT: ${sai}` : `ĐỐI CHỨNG ĐẠT: gốc đạt, ${CAY.length}/${CAY.length} bản hỏng bị bắt đúng lý do`);
process.exitCode = sai ? 1 : 0;
