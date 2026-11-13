// Pha C Task 2: `kiem/chay-do.mjs --url` — bộ đo B4 CHỈ ĐỌC trên trang thật (sau Cloudflare Access). Máy thử = dungMay cosGhi:false như lễ W;
// cầu vé 127.0.0.1 đóng vai Access. Trạm (cầu HTTP 127.0.0.1 đặt TRƯỚC cầu vé) đếm yêu cầu ghi tới máy và lần cookie CF_Authorization tới.
// Ca (b)/(c)/(l)/(m) cấy web/ qua datBan và KHÔNG theo cờ WEB_DOI_CHUNG: đột biến nhóm C2 chỉ sửa kiem/, neo cấy ở web/ không đổi.
// chay-do chạy bằng spawn (bất đồng bộ): máy thử + trạm sống trong tiến trình này, spawnSync sẽ chặn chúng.
// Mỗi test spawn chay-do (mở Chrome) xếp hàng khoá tệp của doi-chung-chung.mjs (vòng sửa 1): chồng nhau làm bộ đo quá hạn. Hạn test CHO gồm
// cả lúc đợi hàng; hạn bộ đo HAN không đổi.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dungMay, datBan, gieo } from './chung-web.mjs';
import { vaoHang, nhaKhoa } from './doi-chung-chung.mjs';

const GOC = fileURLToPath(new URL('..', import.meta.url)), CO = ['--co', '375x812-light'], HAN = 300000, CHO = 3600000;
const GAC = 'gac' + crypto.randomBytes(12).toString('hex');   // chuỗi gác = giá trị cookie; không được lộ ra stdout/stderr
const PHA = 'button,a{min-height:0!important;min-width:0!important;padding:0!important;font-size:11px!important}\n';
const NEO_CSS = '/* Nền + khung (B1)', NEO_JS = "import './ai.js';\n";
const GHI_LUC_TAI = "fetch('/api/goi', { method: 'POST', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: '{}' }).catch(() => {});\n";
// Pha C Task 5 (L3): cấy chép nguyên văn từ kiem/doi-chung.mjs — dòng Việc nhà có nút ghi (không data-act) · Esc ở hộp không trả focus.
const NEO_NHA = `x => el('li', { 'data-viec-bo': x.id }, el('strong', {}, x.ten),`;
const CAY_NHA = `x => el('li', { 'data-viec-bo': x.id }, (b => { b.addEventListener('click', () => fetch('/api/goi', { method: 'POST', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ khoa_lap: crypto.randomUUID(), ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc ẩn' } }] }) })); return b; })(el('button', { type: 'button' }, 'Ghim')), el('strong', {}, x.ten),`;
const NEO_TRA = 'function traFocus() { traVe?.focus(); traVe = null; }', CAY_TRA = 'function traFocus() { document.activeElement?.blur(); traVe = null; }';
const BO_NHA = 'R7 nhóm Việc nhà · trang thật không có dòng Việc nhà', BO_SUA = 'bàn phím hộp sửa việc · trang thật không có dòng việc';
const BO_SUA_TAT = 'bàn phím hộp sửa việc · trang thật có dòng việc nhưng nút sửa tắt (cos_ghi tắt)';
let m, tram, tam, md, tramD, xuat;
const dem = { ghi: [], cookie: 0 };
let nhatKy = null, lanNhatKy = 0;   // L2: đặt hàm (lần gọi ⇒ mảng dòng) ⇒ trạm tự trả GET /api/nhat-ky, không chuyển về máy

const chayMt = (env, ...a) => chayHan(HAN, env, ...a);
const chayHan = (han, env, ...a) => new Promise((ok, loi) => {
  const c = spawn(process.execPath, ['kiem/chay-do.mjs', ...a], { cwd: GOC, env, stdio: ['ignore', 'pipe', 'pipe'] }), t0 = Date.now();
  let ra = '', err = '';
  c.stdout.on('data', d => { ra += d; }); c.stderr.on('data', d => { err += d; });
  const t = setTimeout(() => c.kill('SIGKILL'), han);
  c.on('error', loi);
  c.on('close', rc => { clearTimeout(t); ok({ rc, ra, err, ms: Date.now() - t0, dong: ra.split('\n').filter(s => s.startsWith('{')).map(s => JSON.parse(s)) }); });
});
const chay = (...a) => chayMt(process.env, ...a);
const xepHang = f => async () => { await vaoHang(); try { await f(); } finally { nhaKhoa(); } };
const tramDem = dich => new Promise(ok => {
  const sv = http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) dem.ghi.push(req.method + ' ' + req.url);
    if ((req.headers.cookie ?? '').includes('CF_Authorization=' + GAC)) dem.cookie++;
    if (nhatKy && req.method === 'GET' && req.url.startsWith('/api/nhat-ky')) {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify({ nhat_ky: nhatKy(lanNhatKy++) })); return;
    }
    const r = http.request(dich + req.url, { method: req.method, headers: req.headers, agent: false }, kq => { res.writeHead(kq.statusCode, kq.headers); kq.pipe(res); });
    r.on('error', () => res.destroy());
    req.pipe(r);
  });
  sv.listen(0, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${sv.address().port}`, dong: () => new Promise(d => { sv.closeAllConnections(); sv.close(() => d()); }) }));
});
const tep = (ten, noiDung, mode) => { const f = path.join(tam, ten); fs.writeFileSync(f, noiDung, { mode }); fs.chmodSync(f, mode); return f; };

before(async () => {
  tam = fs.mkdtempSync(path.join(process.env.WO_GOC || os.tmpdir(), 'wo-url-'));
  m = await dungMay({ cosGhi: false });
  await datBan(m);
  tram = await tramDem(m.url);
  // L3 máy CÓ dữ liệu: thư mục xuất vào như chay-do chế độ cũ (trang-thai.json giờ dựng = lúc chạy + viec-bo.json mẫu) + một dòng việc gieo
  // qua /api/goi (cần cosGhi:true; chế độ url không quan tâm cosGhi ⇒ nút sửa bật, phép bàn phím chạy được).
  const MAU = fileURLToPath(new URL('../test-may-chu/mau/', import.meta.url));
  xuat = fs.mkdtempSync(path.join(process.env.WO_GOC || os.tmpdir(), 'wo-url-x-'));
  fs.writeFileSync(path.join(xuat, 'trang-thai.json'), JSON.stringify({ ...JSON.parse(fs.readFileSync(path.join(MAU, 'trang-thai.json'), 'utf8')), gio_dung: new Date().toISOString() }));
  fs.copyFileSync(path.join(MAU, 'viec-bo.json'), path.join(xuat, 'viec-bo.json'));
  md = await dungMay({ cosGhi: true, xuatVao: xuat });
  await gieo(md, [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc thử đo', han: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10) } }]);
  await datBan(md);
  tramD = await tramDem(md.url);
});
after(async () => {
  await tram?.dong(); await m?.dong(); await tramD?.dong(); await md?.dong();
  for (const d of [tam, xuat]) if (d) { for (const t of fs.readdirSync(d)) fs.unlinkSync(path.join(d, t)); fs.rmdirSync(d); }
});

test('(d) tham số sai ⇒ rc 2: cookie 0644, cookie symlink, --url + --pha, --url + --va, gốc có đường, http ngoài 127.0.0.1', { timeout: CHO }, xepHang(async () => {
  const c644 = tep('c644', GAC + '\n', 0o644), c600 = tep('c600-d', GAC + '\n', 0o600), lk = path.join(tam, 'lk');
  fs.symlinkSync(c600, lk);
  const va = tep('va.json', '{}', 0o600);
  for (const a of [['--url', tram.url, '--cookie-tep', c644], ['--url', tram.url, '--cookie-tep', lk], ['--url', tram.url, '--pha'],
    ['--url', tram.url, '--va', va], ['--url', 'https://x/duong'], ['--url', 'http://example.com']]) {
    const r = await chay(...a, ...CO);
    assert.equal(r.rc, 2, a.join(' ') + '\n' + r.ra + r.err);
    assert.ok(!(r.ra + r.err).includes(GAC), 'lộ giá trị cookie: ' + a.join(' '));
  }
  assert.deepEqual(dem.ghi, []);
}));

// Vòng sửa 1: tham số lạ từng bị bỏ lặng ⇒ chế độ cũ chạy (dựng máy, đo web/ tại chỗ) ⇒ rc 0 mà trang thật không được đo (xanh-sai).
// Ca cuối: `--tên=` ở chỗ GIÁ TRỊ của cờ khác (--cu) — nhánh `--x=` của hàm kiểm chỉ ở đây không trùng nhánh «cờ không biết».
test('(f) tham số lạ ⇒ rc 2 ngay, không dựng máy: --url=…, --cookie-tep=…, -url, --khong-co, --cu --url=…', { timeout: CHO }, xepHang(async () => {
  for (const a of [['--url=https://x'], ['--cookie-tep=/x'], ['-url'], ['--khong-co'], ['--cu', '--url=https://x']]) {
    const r = await chay(...a, ...CO), la = a.at(-1), ten = la.replace(/=.*/s, '=');
    assert.deepEqual([r.rc, r.dong.length], [2, 0], `${la}: chạy chế độ cũ (rc ${r.rc}, ${r.dong.length} dòng đo)\n` + r.ra + r.err);
    assert.ok(r.ms < 10000, `${la}: ${r.ms} ms — rc 2 mà không ngay (đã dựng máy?)`);
    assert.ok(r.err.includes(ten), `${la}: thông báo không nêu tham số lạ\n` + r.err);
  }
}));

// Vòng sửa 1: DEBUG=pw:protocol ⇒ Playwright in thông điệp CDP ra stderr, có lệnh đặt cookie mang giá trị CF_Authorization.
test('(g) DEBUG có «pw» + --cookie-tep 0600 ⇒ rc 2, stdout/stderr không lộ giá trị cookie, bảo chạy env -u DEBUG', { timeout: CHO }, xepHang(async () => {
  const c600 = tep('c600-g', GAC + '\n', 0o600);
  for (const DEBUG of ['pw:protocol', 'PW:*']) {
    const r = await chayMt({ ...process.env, DEBUG }, '--url', tram.url, '--cookie-tep', c600, ...CO);
    assert.ok(!(r.ra + r.err).includes(GAC), `DEBUG=${DEBUG}: stdout/stderr lộ giá trị cookie (rc ${r.rc})`);
    assert.equal(r.rc, 2, `DEBUG=${DEBUG}\n` + r.ra + r.err);
    assert.ok(r.err.includes('env -u DEBUG'), r.err);
  }
}));

// Pha C Task 5 (L4): cờ nhận giá trị đứng cuối hay kế là cờ «-…» ⇒ thamSo trả undefined/cờ: --co bị bỏ lặng (đo cả 6 cỡ), --va thành {} (chế độ cũ
// chạy), --co --url ⇒ «cỡ không có: --url» (rc 2 do may, sai lý do). Gom mọi ca rồi mới khẳng định; mỗi ca giết sau 15 s (đúng thì rc 2 ngay).
test('(h) cờ nhận giá trị đứng cuối hay kế là cờ ⇒ rc 2 ngay, không mở trình duyệt, nêu tên cờ, không in phần tử kế', { timeout: CHO }, xepHang(async () => {
  const sai = [];
  for (const [co, a] of [['--co', ['--co', '--url', tram.url]], ['--co', ['--url', tram.url, '--co']], ['--va', ['--co', '375x812-light', '--va']]]) {
    const r = await chayHan(15000, process.env, ...a), loi = [];
    if (r.rc !== 2 || r.dong.length) loi.push(`rc ${r.rc}, ${r.dong.length} dòng đo`);
    if (r.ms >= 10000) loi.push(`${r.ms} ms`);
    if (!r.err.includes(co + ': thiếu giá trị')) loi.push('thông báo không nêu «' + co + ': thiếu giá trị»');
    if (a.some(x => x !== co && r.err.includes(x))) loi.push('thông báo in phần tử khác của argv');
    if (loi.length) sai.push(`${a.join(' ')}: ${loi.join('; ')} — stderr «${r.err.trim().split('\n')[0].slice(0, 120)}»`);
  }
  assert.deepEqual(sai, []);
}));

test('(a) bản đã duyệt, trang thật qua cầu vé ⇒ rc 0, mọi dòng đạt, ghi rỗng, bo khác rỗng, máy không nhận yêu cầu ghi', { timeout: CHO }, xepHang(async () => {
  dem.ghi.length = 0;
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(r.dong.length >= 1, r.ra + r.err);
  for (const d of r.dong) {
    assert.equal(d.dat, true, JSON.stringify(d));
    assert.deepEqual(d.ghi, [], JSON.stringify(d));
    assert.ok(Array.isArray(d.bo) && d.bo.length > 0, JSON.stringify(d));
    // L3: máy m không dữ liệu (kho trống, không xuatVao) ⇒ hai phép bỏ, có trong bo
    for (const b of [BO_NHA, BO_SUA]) assert.ok(d.bo.includes(b), `bo thiếu «${b}»: ` + JSON.stringify(d.bo));
  }
  assert.deepEqual(dem.ghi, []);
}));

test('(e) tệp cookie 0600 ⇒ cookie tới máy, giá trị không lộ ra stdout/stderr', { timeout: CHO }, xepHang(async () => {
  dem.cookie = 0;
  const r = await chay('--url', tram.url, '--cookie-tep', tep('c600', GAC + '\n', 0o600), ...CO);
  assert.ok(!(r.ra + r.err).includes(GAC), 'stdout/stderr lộ giá trị cookie');
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(dem.cookie > 0, 'cookie CF_Authorization không tới máy');
}));

// Pha C Task 5 (L2): /api/nhat-ky là cửa sổ trượt 24 giờ (may-chu/api.mjs:90–93) ⇒ trên trang thật dòng cũ trôi ra giữa hai lần chụp làm số dòng
// giảm. Trạm tự trả /api/nhat-ky: mỗi lần gọi bớt một dòng cũ nhất, id mới nhất giữ 100 ⇒ KHÔNG được «đổi trạng thái». Số lần gọi ≥ 2 ⇒ phép so có chạy.
const dongNK = (moi, n) => Array.from({ length: n }, (_, i) => ({ id: moi - i }));
const voiNhatKy = async (f, ...a) => { nhatKy = f; lanNhatKy = 0; try { return await chay(...a); } finally { nhatKy = null; } };
test('(i) L2 nhật ký: dòng cũ trôi khỏi cửa sổ 24 giờ giữa hai lần chụp ⇒ KHÔNG «màn chỉ xem đổi trạng thái», rc 0', { timeout: CHO }, xepHang(async () => {
  const r = await voiNhatKy(k => dongNK(100, Math.max(1, 100 - k)), '--url', tram.url, ...CO);
  assert.ok(lanNhatKy >= 2, `trạm chỉ nhận ${lanNhatKy} lần GET /api/nhat-ky — phép so R7 không chạy`);
  assert.ok(!r.dong.some(d => d.hong.some(h => h.includes('đổi trạng thái'))), r.ra);
  assert.equal(r.rc, 0, r.ra + r.err);
}));
// Đối chứng L2: id mới nhất đổi giữa hai lần chụp (dòng mới) ⇒ phép so còn sống, PHẢI hỏng.
test('(j) L2 đối chứng: id mới nhất đổi giữa hai lần chụp ⇒ rc 1, «màn chỉ xem đổi trạng thái»', { timeout: CHO }, xepHang(async () => {
  const r = await voiNhatKy(k => [{ id: 100 + k }], '--url', tram.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => !d.dat && d.hong.some(h => h.includes('màn chỉ xem đổi trạng thái'))), r.ra);
}));

test('(b) đối chứng bố cục: bản cấy nút nhỏ (như --pha) duyệt qua datBan ⇒ rc 1, trượt vì nút <44', { timeout: CHO }, xepHang(async () => {
  await datBan(m, { va: { 'nen.css': [[NEO_CSS, PHA + NEO_CSS]] } });
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => !d.dat && d.hong.some(h => h.includes('nút <44'))), r.ra);
}));

test('(c) đối chứng chặn ghi: bản cấy POST /api/goi lúc tải ⇒ rc 1, ghi có /api/goi, máy KHÔNG nhận POST', { timeout: CHO }, xepHang(async () => {
  await datBan(m, { va: { 'khung.js': [[NEO_JS, NEO_JS + GHI_LUC_TAI]] } });
  dem.ghi.length = 0;
  const r = await chay('--url', tram.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => !d.dat && d.ghi?.some(g => g.includes('/api/goi'))), r.ra);
  assert.deepEqual(dem.ghi, []);
}));

// Pha C Task 5 (L3): trang thật CÓ dữ liệu thì đo R7 nhóm Việc nhà + bàn phím hộp sửa việc, KHÔNG có thì bỏ (vào bo; ca không dữ liệu ở (a)).
// Máy md (before): một dòng việc gieo + viec-bo.json mẫu. (k) bản sạch ⇒ phải đạt (không đỏ-sai); (l) đối chứng ⇒ hai phép thật sự chạy.
test('(k) L3 có dòng việc + dòng Việc nhà ⇒ rc 0, mọi dòng đạt, bo không có mục bỏ của hai phép', { timeout: CHO }, xepHang(async () => {
  const r = await chay('--url', tramD.url, ...CO);
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(r.dong.length >= 1, r.ra + r.err);
  for (const d of r.dong) {
    assert.equal(d.dat, true, JSON.stringify(d));
    assert.ok(!d.bo.some(b => b.includes('Việc nhà') || b.includes('hộp sửa việc')), JSON.stringify(d.bo));
  }
}));
// (l): nút ghi ở dòng Việc nhà chỉ bị bấm khi R7 nhóm Việc nhà chạy ⇒ POST /api/goi vào ghi (chanGhi huỷ, máy không nhận); Esc ở hộp sửa việc
// không trả focus chỉ bị bắt khi phép bàn phím hộp sửa việc chạy.
test('(l) L3 đối chứng: cấy nút ghi ở dòng Việc nhà + Esc không trả focus ⇒ rc 1, ghi có POST /api/goi, «focus không về chỗ cũ: Esc ở hộp sửa việc»', { timeout: CHO }, xepHang(async () => {
  await datBan(md, { va: { 'viec-lich.js': [[NEO_NHA, CAY_NHA]], 'giao-dien.js': [[NEO_TRA, CAY_TRA]] } });
  dem.ghi.length = 0;
  const r = await chay('--url', tramD.url, ...CO);
  assert.equal(r.rc, 1, r.ra + r.err);
  assert.ok(r.dong.some(d => d.ghi.includes('POST /api/goi')), 'R7 nhóm Việc nhà không bấm nút ghi\n' + r.ra);
  assert.ok(r.dong.some(d => d.hong.includes('focus không về chỗ cũ: Esc ở hộp sửa việc')), 'phép bàn phím hộp sửa việc không chạy\n' + r.ra);
  assert.deepEqual(dem.ghi, []);
}));
// (m): dòng việc có mà nút sửa disabled (lễ W chạy cosGhi=false ⇒ viec-lich.js vẽ nút ghi disabled) ⇒ Tab không tới ⇒ bỏ có lý do, không đỏ-sai.
test('(m) L3 dòng việc có mà nút sửa tắt ⇒ rc 0, bo có «nút sửa tắt»', { timeout: CHO }, xepHang(async () => {
  await datBan(md, { va: { 'viec-lich.js': [['disabled: !ghiDuoc, ...them', 'disabled: true, ...them']] } });
  const r = await chay('--url', tramD.url, ...CO);
  assert.equal(r.rc, 0, r.ra + r.err);
  assert.ok(r.dong.length >= 1 && r.dong.every(d => d.bo.includes(BO_SUA_TAT)), r.ra);
}));
