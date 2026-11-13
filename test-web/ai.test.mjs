// Hỏi AI CoS — giao diện (B3 lượt 3c): trang thật + máy chủ thật, model GIẢ chạy trong tiến trình (goiAI tiêm qua dungMay; KHÔNG ra mạng, không 8317).
// T5 vòng đời đề xuất (Hỏi · Bỏ qua · Hỏi lại · Áp dụng đúng mục · Hoàn tác) · T6 XSS trong noi_dung · T7 hạn ngoài miền ⇒ không đề xuất.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { moTrinh, dungMay, datBan, trangMoi, gieo } from './chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';
import { taoDeXuat } from '../may-chu/goi.mjs';

const ngayVn = (them = 0) => new Date(Date.now() + 7 * 3600e3 + them * 864e5).toISOString().slice(0, 10);
const ngu = ms => new Promise(r => setTimeout(r, ms));
let trinh, m, A, B, traLoi = () => '{}';

before(async () => {
  trinh = await moTrinh();
  m = await dungMay({ goiAI: async () => traLoi() }); await datBan(m);
  const r = await gieo(m, ['Việc A', 'Việc B'].map((tieu_de, i) => ({ loai: 'them', bang: 'viec', truong: { tieu_de, han: ngayVn(5 + 3 * i) } })));
  [A, B] = r.ket_qua.map(k => k.id);
});
after(async () => { await trinh?.close(); await m?.dong(); });

const db = sql => m.may.db.prepare(sql);
const dongViec = id => db('SELECT * FROM viec WHERE id = ?').get(id);
const dem = bang => db(`SELECT count(*) AS n FROM ${bang}`).get().n;
const deXuatHan = (id, han, noi_dung) => JSON.stringify({ noi_dung, ops: [{ loai: 'sua', bang: 'viec', id, phien_ban: dongViec(id).phien_ban, truong: { han } }] });
// Trạng thái nội dung qua API (bỏ phien_ban, sua_luc: Áp dụng/Hoàn tác tăng chúng).
async function trangThai() {
  const v = await goi(m.may, '/api/viec');
  return v.json.viec.map(({ phien_ban, sua_luc, ...con }) => con);
}
async function cho(f, ten) {
  const t = Date.now();
  for (;;) { if (await f()) return; if (Date.now() - t > 5000) assert.fail('hết giờ chờ: ' + ten); await ngu(50); }
}
async function moCos(fn) {
  const { ctx, page, loi } = await trangMoi(trinh, m.url);
  page.setDefaultTimeout(5000);
  try {
    await page.goto(m.url + '/#cos');
    await page.locator('section[data-man="cos"] [data-brief]').waitFor();
    await page.locator('[data-act="hoi-ai"]:not([disabled])').waitFor();
    return await fn(page, loi);
  } finally { await ctx.close(); }
}
const hoiAI = async page => { await page.locator('[data-act="hoi-ai"]').click(); await page.locator('#hop[open]').waitFor(); await page.locator('#hop [data-de-xuat], #hop [data-khong-de-xuat]').first().waitFor(); };
const muc = (page, chu) => page.locator('#hop [data-de-xuat]', { hasText: chu });

test('B3-T5 Hỏi AI ⇒ hộp đề xuất; Bỏ qua không ghi; Áp dụng đúng mục AI đổi ĐÚNG hạn việc A; Hoàn tác về y trước', async () => {
  taoDeXuat(m.may.db, { mach: 'cos', chu_the: 'neo', noi_dung: 'Neo gợi ý dời việc B', ops: [{ loai: 'sua', bang: 'viec', id: B, phien_ban: dongViec(B).phien_ban, truong: { han: ngayVn(30) } }] }, new Date().toISOString());
  const truoc = await trangThai(), hanMoi = ngayVn(6);
  await moCos(async page => {
    traLoi = () => deXuatHan(A, hanMoi, 'Dời hạn việc A thêm một ngày');
    const manTruoc = await page.locator('[data-viec]').allTextContents();
    await hoiAI(page);
    assert.equal(await muc(page, 'Dời hạn việc A thêm một ngày').count(), 1, 'đề xuất AI có trong hộp');
    assert.equal(await muc(page, 'Neo gợi ý dời việc B').count(), 1, 'đề xuất Neo chờ cũng được liệt kê');
    assert.ok(!(await page.locator('#hop').textContent()).includes('false'), 'hộp đề xuất không có chữ "false" lạc');
    assert.deepEqual(await trangThai(), truoc, 'Hỏi AI chưa ghi gì');
    // Bỏ qua mục của AI
    const ghi0 = dem('goi_ghi');
    await muc(page, 'Dời hạn việc A').locator('[data-act="bo-qua"]').click();
    await cho(async () => (await muc(page, 'Dời hạn việc A').count()) === 0, 'mục bị bỏ qua phải biến mất');
    assert.deepEqual(await trangThai(), truoc, 'Bỏ qua không đổi dữ liệu');
    assert.equal(dem('goi_ghi'), ghi0, 'Bỏ qua không ghi gói');
    await page.keyboard.press('Escape');
    // Hỏi lại ⇒ Áp dụng mục của AI (không phải mục đầu: mục Neo đứng trước)
    traLoi = () => deXuatHan(A, hanMoi, 'Dời hạn việc A thêm một ngày');
    await hoiAI(page);
    assert.equal(await page.locator('#hop [data-de-xuat]').count(), 2);
    await muc(page, 'Dời hạn việc A').locator('[data-act="ap-dung"]').click();
    await page.locator('#hop[open]').waitFor({ state: 'hidden' });
    const mong = truoc.map(v => (v.id === A ? { ...v, han: hanMoi } : v));
    await cho(async () => JSON.stringify(await trangThai()) === JSON.stringify(mong), 'chỉ viec[A].han đổi');
    await cho(async () => JSON.stringify(await page.locator('[data-viec]').allTextContents()) !== JSON.stringify(manTruoc), 'màn phải đổi');
    await page.locator('#thanh-hoan-tac [data-act="hoan-tac"]').click();
    await cho(async () => JSON.stringify(await trangThai()) === JSON.stringify(truoc), 'Hoàn tác về y trước');
    await cho(async () => JSON.stringify(await page.locator('[data-viec]').allTextContents()) === JSON.stringify(manTruoc), 'màn sau Hoàn tác');
  });
});

test('B3-T6 XSS: noi_dung có thẻ HTML hiện nguyên chữ, không dựng phần tử', async () => {
  const doc = '<img src=x onerror="document.title=\'X\'">';
  taoDeXuat(m.may.db, { mach: 'cos', chu_the: 'neo', noi_dung: doc, ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc từ Neo' } }] }, new Date().toISOString());
  traLoi = () => '{}';
  await moCos(async page => {
    const tieu = await page.title();
    await hoiAI(page);
    assert.ok((await page.locator('#hop').textContent()).includes(doc), 'chữ hiện nguyên');
    assert.equal(await page.locator('#hop img').count(), 0);
    await ngu(300);
    assert.equal(await page.title(), tieu, 'onerror không chạy');
  });
});

test('B3-T7 AI trả hạn ngoài miền ⇒ «AI chưa có đề xuất hợp lệ», không đề xuất mới', async () => {
  const n0 = dem('de_xuat');
  traLoi = () => deXuatHan(A, '2200-01-01', 'Dời quá xa');
  await moCos(async page => {
    await hoiAI(page);
    assert.match(await page.locator('#hop').textContent(), /AI chưa có đề xuất hợp lệ/);
    assert.equal(await muc(page, 'Dời quá xa').count(), 0);
  });
  assert.equal(dem('de_xuat'), n0);
});

// Sửa cuối I1: đề xuất Neo máy chủ không áp được ⇒ 409 de_xuat_khong_ap_dung (trước: 403 quyen ⇒ api.js coi là Hết phiên, xoá trang).
test('B3-T8 Áp dụng đề xuất Neo không áp được ⇒ hộp báo «không áp dụng được — anh bấm Bỏ qua», KHÔNG sang Hết phiên, kho y trước', async () => {
  taoDeXuat(m.may.db, { mach: 'cos', chu_the: 'neo', noi_dung: 'Neo gắn tiến độ việc đã mất', ops: [{ loai: 'them', bang: 'tien_do', truong: { doi_tuong: 'viec:khong-co' } }] }, new Date().toISOString());
  traLoi = () => '{}';
  const truoc = await trangThai(), ghi0 = dem('goi_ghi');
  await moCos(async page => {
    await hoiAI(page);
    await muc(page, 'Neo gắn tiến độ việc đã mất').locator('[data-act="ap-dung"]').click();
    await page.locator('#hop [data-loi]', { hasText: 'Đề xuất này không áp dụng được — anh bấm Bỏ qua.' }).waitFor();
    assert.equal(await page.locator('#noi-dung > section[data-man="het-phien"]').count(), 0, 'không sang Hết phiên');
    assert.equal(await muc(page, 'Neo gắn tiến độ việc đã mất').count(), 1, 'mục còn trong hộp để Bỏ qua');
  });
  assert.deepEqual(await trangThai(), truoc);
  assert.equal(dem('goi_ghi'), ghi0);
});
