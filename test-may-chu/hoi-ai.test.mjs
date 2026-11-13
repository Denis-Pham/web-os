// Test B3 «Hỏi AI CoS — chỉ đề xuất» (thiết kế 5.7, 13; plan B3 lượt 3a): máy chủ thật qua socket, model GIẢ tiêm qua khoiDong({ goiAI }).
// KHÔNG yêu cầu nào tới CLIProxyAPI 127.0.0.1:8317 (quota chung não Neo): bộ gác fetch cài TRƯỚC khi nạp mã máy chủ, ca cuối khẳng định gác 0 lần.
// Đối chứng «ghi ngay lúc đề xuất» (Đ2) = đột biến runner `ai-ghi-ngay` (phán quyết điều phối: không dựng bản chép may-chu/ trong test).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

// Bộ gác: cổng 8317 hay máy khác 127.0.0.1 ⇒ ghi lại + ném, KHÔNG gửi.
const gac = (goc, chan) => async (dich, ...con) => {
  const s = String(dich?.url ?? dich);
  let u = null; try { u = new URL(s); } catch { /* không phân tích được ⇒ chặn */ }
  if (!u || u.port === '8317' || u.hostname !== '127.0.0.1') { chan.push(s); throw new TypeError('bộ gác test: chặn ' + s); }
  return goc(dich, ...con);
};
const CHAN = [];
globalThis.fetch = gac(globalThis.fetch, CHAN);
const { DAU_GHI, moiTruong, goi, ve, AUD_HUB } = await import('./chung.mjs');
const { taoGoiAI, docKhoaAI } = await import('../may-chu/hoi-ai.mjs');

const mt = moiTruong();
// Model giả: mỗi ca đặt `traLoi` (messages ⇒ chuỗi, có thể là lời hứa); `daGui` giữ messages máy chủ đã gửi.
let traLoi = () => '{}';
const daGui = [];
const goiAI = async messages => { daGui.push(messages); return traLoi(messages); };
let m;
before(async () => { m = await mt.may({ cosGhi: true }, [], { goiAI }); });
after(() => mt.dong());

let so = 0;
const post = (may_, duong, o, dau = DAU_GHI) => goi(may_, duong, { method: 'POST', dau, than: JSON.stringify(o) });
const hoi = (may_ = m) => post(may_, '/api/hoi-ai', {});
async function lam(ops) { const r = await post(m, '/api/goi', { khoa_lap: 'ai-khoa-' + ++so, ops }); assert.equal(r.ma, 200, r.than); return r.json; }
const dong = id => m.db.prepare('SELECT * FROM viec WHERE id = ?').get(id);
const moiViec = async (tieu_de, han, them = {}) => dong((await lam([{ loai: 'them', bang: 'viec', truong: { tieu_de, han, ...them } }])).ket_qua[0].id);
const xong = v => lam([{ loai: 'xong', bang: 'viec', id: v.id, phien_ban: v.phien_ban }]);
const dem = bang => m.db.prepare(`SELECT count(*) AS n FROM ${bang}`).get().n;
const chup = () => ({ viec: m.db.prepare('SELECT * FROM viec ORDER BY id').all(), goi_ghi: dem('goi_ghi'), nhat_ky: dem('nhat_ky'), de_xuat: dem('de_xuat') });
const suaHan = (v, han, them = {}) => ({ loai: 'sua', bang: 'viec', id: v.id, phien_ban: v.phien_ban, truong: { han, ...them } });
const deXuat = (ops, them = {}) => () => JSON.stringify({ noi_dung: 'Dời hạn cho kịp', ops, ...them });
// Cột nội dung của việc (không phien_ban, sua_luc, nguoi_sua — Áp dụng/Hoàn tác tăng chúng).
const noiDung = v => { const { phien_ban, sua_luc, nguoi_sua, ...o } = v; return o; };

test('B3-Đ1 model giả bị chặn: 200 de_xuat null với ĐÚNG ly_do, không dòng de_xuat, viec/goi_ghi/nhat_ky y trước', async () => {
  const A = await moiViec('Đ1 việc A', '2026-11-20'), B = await moiViec('Đ1 việc B', '2026-11-25');
  const x = await moiViec('Đ1 việc đã xong', '2026-11-22');
  await xong(x);
  const X = dong(x.id);
  const CA = [
    ['(a) ghi thẳng: khoá lạ ap_dung_ngay', deXuat([suaHan(A, '2026-11-21')], { ap_dung_ngay: true }), 'sai_dang'],
    ['(b) noi_dung có <b>', () => JSON.stringify({ noi_dung: 'Dời <b>gấp</b>', ops: [suaHan(A, '2026-11-21')] }), 'sai_dang'],
    ['(c) hạn 2101-01-01', deXuat([suaHan(A, '2101-01-01')]), 'gia_tri'],
    ['(c) hạn +010000-01', deXuat([suaHan(A, '+010000-01')]), 'gia_tri'],
    ['(c) hạn 9999-12-31', deXuat([suaHan(A, '9999-12-31')]), 'gia_tri'],
    ['(c) hạn null', deXuat([suaHan(A, null)]), 'ngay'],
    ['(d) hai thao tác', deXuat([suaHan(A, '2026-11-21'), suaHan(B, '2026-11-26')]), 'so_thao_tac'],
    ['(e) xoa', deXuat([{ loai: 'xoa', bang: 'viec', id: A.id, phien_ban: A.phien_ban }]), 'loai'],
    ['(f) sửa tieu_de', deXuat([{ loai: 'sua', bang: 'viec', id: A.id, phien_ban: A.phien_ban, truong: { tieu_de: 'Đổi tên' } }]), 'truong'],
    ['(f) sửa han + tieu_de', deXuat([suaHan(A, '2026-11-21', { tieu_de: 'Đổi tên' })]), 'truong'],
    ['(g) việc đã xong', deXuat([suaHan(X, '2026-11-23')]), 'viec_het'],
  ];
  for (const [ten, tl, ly_do] of CA) {
    traLoi = tl;
    const truoc = chup(), n = daGui.length, r = await hoi();
    assert.equal(r.ma, 200, `${ten}: ${r.than}`);
    assert.equal(daGui.length, n + 1, `${ten}: model phải được hỏi`);
    assert.deepEqual(r.json, { de_xuat: null, ly_do }, ten);
    assert.deepEqual(chup(), truoc, ten);
  }
});

test('B3-Đ2 đối chứng dương: dời hạn một việc mở + 1 ngày ⇒ MỘT dòng de_xuat ai/cho, viec + goi_ghi + nhat_ky KHÔNG đổi', async () => {
  const A = await moiViec('Đ2 việc A', '2026-11-20', { ghi_chu: 'ghi chú riêng Đ2', danh_sach: 'danh sách riêng Đ2' });
  await xong(await moiViec('Đ2 việc đã xong', '2026-11-19'));
  await moiViec('Đ2 việc không hạn');
  traLoi = deXuat([suaHan(A, '2026-11-21')]);
  const truoc = chup(), n = daGui.length, r = await hoi();
  assert.equal(r.ma, 200, r.than);
  const id = r.json.de_xuat?.id;
  assert.equal(typeof id, 'string', r.than);
  assert.deepEqual(r.json.de_xuat, { id, noi_dung: 'Dời hạn cho kịp', ops: [suaHan(A, '2026-11-21')] });
  const dx = m.db.prepare('SELECT * FROM de_xuat WHERE id = ?').get(id);
  assert.deepEqual([dx.chu_the, dx.trang_thai, dx.mach, dx.goi_id], ['ai', 'cho', 'cos', null]);
  assert.deepEqual(JSON.parse(dx.ops), [suaHan(A, '2026-11-21')]);
  assert.deepEqual(chup(), { ...truoc, de_xuat: truoc.de_xuat + 1 });   // gợi ý KHÔNG ghi ngay
  // Gửi model: chỉ việc mở có hạn, đúng 4 trường (không ghi_chu / danh_sach).
  const gui = JSON.parse(daGui[n][1].content), mo = m.db.prepare('SELECT id FROM viec WHERE xoa_luc IS NULL AND xong_luc IS NULL AND han IS NOT NULL ORDER BY id').all().map(v => v.id);
  assert.deepEqual(gui.viec.map(v => v.id).sort(), mo);
  for (const v of gui.viec) assert.deepEqual(Object.keys(v).sort(), ['han', 'id', 'phien_ban', 'tieu_de']);
  assert.ok(!JSON.stringify(daGui[n]).includes('riêng Đ2'));
});

test('B3-T1 Bỏ qua đề xuất AI: goi_ghi, nhat_ky, viec y trước; de_xuat.trang_thai = bo_qua', async () => {
  const A = await moiViec('T1 việc A', '2026-11-20');
  traLoi = deXuat([suaHan(A, '2026-12-01')]);
  const id = (await hoi()).json.de_xuat.id;
  const truoc = chup(), r = await post(m, `/api/de-xuat/${id}/bo-qua`, {});
  assert.equal(r.ma, 200, r.than);
  assert.deepEqual(chup(), truoc);
  assert.equal(m.db.prepare('SELECT trang_thai FROM de_xuat WHERE id = ?').get(id).trang_thai, 'bo_qua');
});

test('B3-T2 Áp dụng kiểm lại: việc xong sau đề xuất ⇒ 409 de_xuat_ai viec_het; việc mở ⇒ 200 đúng han, Hoàn tác về trước', async () => {
  const A = await moiViec('T2 việc A', '2026-11-20');
  traLoi = deXuat([suaHan(A, '2026-11-21')]);
  const id1 = (await hoi()).json.de_xuat.id;
  await xong(A);
  let truoc = chup(), r = await post(m, `/api/de-xuat/${id1}/ap-dung`, { khoa_lap: randomUUID() });
  assert.equal(r.ma, 409, r.than);
  assert.deepEqual(r.json, { loi: 'de_xuat_ai', chi_tiet: { ly_do: 'viec_het' } });
  assert.deepEqual(chup(), truoc);

  const B = await moiViec('T2 việc B', '2026-11-20', { ghi_chu: 'giữ nguyên' });
  traLoi = deXuat([suaHan(B, '2026-11-24')]);
  const id2 = (await hoi()).json.de_xuat.id;
  truoc = chup();
  r = await post(m, `/api/de-xuat/${id2}/ap-dung`, { khoa_lap: randomUUID() });
  assert.equal(r.ma, 200, r.than);
  assert.deepEqual(noiDung(dong(B.id)), { ...noiDung(B), han: '2026-11-24' });
  assert.equal(dem('goi_ghi'), truoc.goi_ghi + 1);
  r = await post(m, '/api/hoan', { ma_hoan: r.json.ma_hoan });
  assert.equal(r.ma, 200, r.than);
  assert.deepEqual(noiDung(dong(B.id)), noiDung(B));
});

test('B3-T3 cổng: 423 cos_ghi tắt · 503 chưa cấu hình · 403 CSRF · 401 vé Hub · 400 khoá lạ · lượt đồng thời ⇒ một 429', async () => {
  const C = await moiViec('T3 việc C', '2026-11-20');
  const hopLe = deXuat([suaHan(C, '2026-11-21')]);
  traLoi = hopLe;
  const n = daGui.length, dx = dem('de_xuat');
  const tat = await mt.may({ cosGhi: false }, [], { goiAI });
  let r = await hoi(tat);
  assert.deepEqual([r.ma, r.json], [423, { loi: 'cos_ghi_tat' }]);
  const chuaCauHinh = await mt.may({ cosGhi: true });   // không goiAI, không tepKhoaAI
  r = await hoi(chuaCauHinh);
  assert.deepEqual([r.ma, r.json], [503, { loi: 'ai_chua_cau_hinh' }]);
  r = await post(m, '/api/hoi-ai', {}, { 'Content-Type': 'application/json' });
  assert.deepEqual([r.ma, r.json], [403, { loi: 'csrf' }]);
  r = await goi(m, '/api/hoi-ai', { method: 'POST', jwt: ve({ aud: [AUD_HUB] }), dau: DAU_GHI, than: '{}' });
  assert.equal(r.ma, 401, r.than);
  r = await post(m, '/api/hoi-ai', { x: 1 });
  assert.deepEqual([r.ma, r.json], [400, { loi: 'luoc_do', chi_tiet: { ly_do: 'khoa_la' } }]);
  assert.equal(daGui.length, n, 'cổng chặn trước khi hỏi model');
  assert.equal(dem('de_xuat'), dx);

  // Hai lượt đồng thời: lượt đầu treo ở model ⇒ lượt hai 429; lượt đầu xong ⇒ cờ nhả, lượt ba hỏi được.
  let mo, daHoi;
  const cho = new Promise(ok => { mo = ok; }), dangHoi = new Promise(ok => { daHoi = ok; });
  traLoi = async msgs => { daHoi(); await cho; return hopLe(msgs); };
  const p1 = hoi();
  await dangHoi;
  r = await hoi();
  assert.deepEqual([r.ma, r.json], [429, { loi: 'ai_dang_hoi' }]);
  mo();
  r = await p1;
  assert.equal(r.ma, 200, r.than);
  assert.equal(typeof r.json.de_xuat?.id, 'string', r.than);
  traLoi = hopLe;
  r = await hoi();
  assert.equal(r.ma, 200, r.than);
});

// Khoá thử (lượt 3b): mỗi tệp trong một thư mục mkdtemp riêng (trong mt.tam), quyền đặt tường minh — không đọc/ghi tệp khoá thật nào.
const KHOA_THU = 'khoa_thu_' + randomUUID().replaceAll('-', '');
function tepKhoa(quyen) {
  const f = path.join(fs.mkdtempSync(path.join(mt.tam, 'khoa-')), 'khoa');
  fs.writeFileSync(f, KHOA_THU + '\n');
  fs.chmodSync(f, quyen);
  return f;
}
// CLIProxyAPI giả trên 127.0.0.1:0, ghi mọi yêu cầu (đường, header, thân): /chuyen ⇒ 302 sang /dich · /cham không trả · /cham-than trả header rồi treo thân · còn lại 200.
async function mayGia() {
  const nhan = [];
  let goc;
  const sv = http.createServer((req, res) => {
    const b = []; req.on('data', d => b.push(d));
    req.on('end', () => {
      nhan.push({ duong: req.url, dau: req.headers, than: Buffer.concat(b).toString() });
      if (req.url === '/chuyen') { res.writeHead(302, { Location: goc + '/dich' }); res.end(); return; }
      if (req.url === '/cham') return;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url === '/cham-than') { res.write('{"choices":'); return; }
      res.end(JSON.stringify({ choices: [{ message: { content: 'tra-loi-gia' } }] }));
    });
  });
  await new Promise(ok => sv.listen(0, '127.0.0.1', ok));
  goc = 'http://127.0.0.1:' + sv.address().port;
  return { goc, nhan, dong: () => new Promise(ok => { sv.closeAllConnections(); sv.close(ok); }) };
}

test('B3-T4 taoGoiAI + docKhoaAI (máy giả 127.0.0.1:0): 0600 ⇒ model đúng, không tools, Bearer · 0644 ⇒ 500 · 302 ⇒ 502 không theo · chậm ⇒ 503', async () => {
  const gia = await mayGia();
  try {
    const tep600 = tepKhoa(0o600), tep644 = tepKhoa(0o644), tin = [{ role: 'user', content: 'thử' }];
    const hoiGia = (tep, duong, them = {}) => taoGoiAI({ khoa: () => docKhoaAI(tep), url: gia.goc + duong, ...them })(tin);
    assert.equal(await hoiGia(tep600, '/ok'), 'tra-loi-gia');
    assert.equal(gia.nhan.length, 1);
    const [y] = gia.nhan, than = JSON.parse(y.than);
    assert.equal(than.model, 'gemini-3.8-flash-high');
    assert.equal(Object.hasOwn(than, 'tools'), false, 'thân yêu cầu không có khoá tools: ' + y.than);
    assert.deepEqual(than.messages, tin);
    assert.equal(y.dau.authorization, 'Bearer ' + KHOA_THU);

    await assert.rejects(hoiGia(tep644, '/ok'), { ma: 500, loi: 'khoa_ai_quyen' });
    assert.equal(gia.nhan.length, 1, 'khoá sai quyền ⇒ không gửi yêu cầu');

    await assert.rejects(hoiGia(tep600, '/chuyen'), { ma: 502, loi: 'ai_loi' });
    assert.equal(gia.nhan.filter(q => q.duong === '/dich').length, 0, 'không theo Location');
    assert.deepEqual(gia.nhan.map(q => q.duong), ['/ok', '/chuyen']);

    for (const duong of ['/cham', '/cham-than']) await assert.rejects(hoiGia(tep600, duong, { hetGio: 200 }), { ma: 503, loi: 'ai_ban' }, duong);
  } finally { await gia.dong(); }
});

test('B3-T4 khởi động: tepKhoaAI 0644, không tiêm goiAI ⇒ /api/hoi-ai 500 khoa_ai_quyen, không yêu cầu nào ra mạng (bộ gác 0 lần)', async () => {
  const n = CHAN.length;
  const k = await mt.may({ cosGhi: true, tepKhoaAI: tepKhoa(0o644) });
  let r = await post(k, '/api/goi', { khoa_lap: 'ai-khoa-' + ++so, ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Khởi động: việc mở có hạn', han: '2026-11-20' } }] });
  assert.equal(r.ma, 200, r.than);
  r = await hoi(k);
  assert.deepEqual([r.ma, r.json], [500, { loi: 'khoa_ai_quyen' }]);
  assert.deepEqual(CHAN.slice(n), [], 'không yêu cầu nào tới CLIProxyAPI thật');
});

test('bộ gác mạng: đối chứng (chặn 8317 + máy khác, cho 127.0.0.1 cổng khác) và cả tệp không yêu cầu nào bị chặn', async () => {
  const chan = [], qua = [];
  const f = gac(async d => { qua.push(String(d)); return 'qua'; }, chan);
  await assert.rejects(f('http://127.0.0.1:8317/v1/chat/completions'), /bộ gác test/);
  await assert.rejects(f('http://example.com/'), /bộ gác test/);
  assert.equal(await f('http://127.0.0.1:4567/x'), 'qua');
  assert.deepEqual([chan.length, qua], [2, ['http://127.0.0.1:4567/x']]);
  assert.deepEqual(CHAN, []);
});
