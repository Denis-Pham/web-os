// Màn chủ 8 khối (B1-T1) + XSS (B1-Đ0): dữ liệu từ /api/man-chu của máy chủ thật, tệp xuất trong thư mục xuatVao của test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { moTrinh, dungMay, datBan, trangMoi, gieo, DOI_CHUNG } from './chung-web.mjs';

const MAU = fileURLToPath(new URL('../test-may-chu/mau/', import.meta.url));
const TT = JSON.parse(fs.readFileSync(path.join(MAU, 'trang-thai.json'), 'utf8'));
const KHOI = ['xai_duoc', 'cho_anh', 'suc_khoe', 'tien_do', 'agent_dang_chay', 'chi_phi_token', 'nhat_ky', 'lich_hom_nay'];
const TIEU_DE = 'Sổ — Không gian AI cá nhân', XSS = '<img src=x onerror="document.title=\'X\'">';
const NEO_CON = 'for (const c of con) if (c !== null && c !== false && c !== undefined) n.append(c);';
const CAY_CON = "for (const c of con) if (c !== null && c !== false && c !== undefined) { if (typeof c === 'string') n.insertAdjacentHTML('beforeend', c); else n.append(c); }";
const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const gioTruoc = h => new Date(Date.now() - h * 3600e3).toISOString();

let trinh, xuat, mX, m0;
const ghiTT = o => fs.writeFileSync(path.join(xuat, 'trang-thai.json'), typeof o === 'string' ? o : JSON.stringify(o));
before(async () => {
  trinh = await moTrinh();
  xuat = fs.mkdtempSync(path.join(process.env.WO_GOC || '/tmp', 'wo-x-'));
  ghiTT({ ...TT, gio_dung: gioTruoc(0) });
  fs.copyFileSync(path.join(MAU, 'viec-bo.json'), path.join(xuat, 'viec-bo.json'));
  mX = await dungMay({ xuatVao: xuat }); await datBan(mX);
  m0 = await dungMay(); await datBan(m0);
});
after(async () => {
  await trinh?.close(); await mX?.dong(); await m0?.dong();
  for (const t of fs.readdirSync(xuat)) fs.unlinkSync(path.join(xuat, t));
  fs.rmdirSync(xuat);
});

async function moChu(m, fn) {
  const { ctx, page, loi, mang } = await trangMoi(trinh, m.url);
  try {
    await page.goto(m.url + '/#chu');
    await page.locator('section[data-man="chu"] [data-khoi]').nth(7).waitFor();
    return await fn(page, loi, mang);
  } finally { await ctx.close(); }
}
const khoi = (page, k, them = '') => page.locator(`[data-khoi="${k}"]${them}`);

test('B1-T1 có tệp xuất: 8 khối đúng thứ tự móc, agent + token «chưa nối», dữ liệu tệp hiện, đầu trang không tự ghi «ổn»', () => moChu(mX, async (page, loi, mang) => {
  assert.deepEqual((await page.locator('[data-khoi]').evaluateAll(a => a.map(x => x.dataset.khoi))).sort(), [...KHOI].sort());
  for (const k of ['agent_dang_chay', 'chi_phi_token']) {
    assert.equal(await khoi(page, k, '[data-chua-noi]').count(), 1, k);
    assert.equal(await khoi(page, k).filter({ hasText: 'chưa nối' }).count(), 1, k);
  }
  for (const k of ['xai_duoc', 'cho_anh', 'suc_khoe', 'tien_do', 'nhat_ky', 'lich_hom_nay']) assert.equal(await khoi(page, k, '[data-chua-noi]').count(), 0, k);
  assert.equal(await khoi(page, 'xai_duoc').filter({ hasText: 'Nộp bài viết' }).count(), 1);
  assert.equal(await khoi(page, 'cho_anh').filter({ hasText: 'CA-000' }).count(), 1);
  assert.equal(await khoi(page, 'nhat_ky').filter({ hasText: 'Dựng lại trang Tổng quan' }).count(), 1);
  assert.equal(await page.locator('#trang-thai-he').filter({ hasText: /^Dựng lúc \d\d:\d\d/ }).count(), 1);
  assert.equal(await page.locator('#trang-thai-he').filter({ hasText: 'ổn' }).count(), 0);
  assert.deepEqual(loi, []);
  assert.deepEqual(mang, []);
}));

test('B1-T1 không tệp xuất: 4 khối tệp + 2 khối «chưa nối»; nhật ký kho + lịch hôm nay vẫn hiện', async () => {
  await gieo(m0, [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc hạn hôm nay', han: homNay() } }]);
  await moChu(m0, async (page, loi) => {
    for (const k of KHOI.slice(0, 6)) {
      assert.equal(await khoi(page, k, '[data-chua-noi]').count(), 1, k);
      assert.equal(await khoi(page, k).filter({ hasText: 'chưa nối' }).count(), 1, k);
    }
    for (const k of KHOI.slice(6)) assert.equal(await khoi(page, k, '[data-chua-noi]').count(), 0, k);
    assert.equal(await page.locator('[data-khoi="lich_hom_nay"] [data-viec]').filter({ hasText: 'Việc hạn hôm nay' }).count(), 1);
    assert.equal(await khoi(page, 'nhat_ky').filter({ hasText: 'Việc hạn hôm nay' }).count(), 1);
    assert.equal(await page.locator('#trang-thai-he').filter({ hasText: 'Sức khoẻ: chưa nối' }).count(), 1);
    assert.deepEqual(loi, []);
  });
});

test('B1-T1 tệp cũ 4 giờ ⇒ «cũ, dựng lúc»; tệp hỏng sau bản tốt ⇒ bản tốt cuối + «hỏng, dựng lúc»', async () => {
  ghiTT({ ...TT, gio_dung: gioTruoc(4) });
  await moChu(mX, async page => {
    assert.equal(await khoi(page, 'xai_duoc').filter({ hasText: 'cũ, dựng lúc' }).count(), 1);
    assert.equal(await khoi(page, 'xai_duoc').filter({ hasText: 'Nộp bài viết' }).count(), 1);
    assert.equal(await page.locator('#trang-thai-he').filter({ hasText: /^Có \d+ tín hiệu cần xem$/ }).count(), 1);
  });
  ghiTT('{hỏng');
  await moChu(mX, async page => {
    assert.equal(await khoi(page, 'xai_duoc').filter({ hasText: 'hỏng, dựng lúc' }).count(), 1);
    assert.equal(await khoi(page, 'xai_duoc').filter({ hasText: 'Nộp bài viết' }).count(), 1);
  });
  ghiTT({ ...TT, gio_dung: gioTruoc(0) });
});

const doXss = m => moChu(m, async page => ({
  img: await page.locator('[data-khoi] img').count(), title: await page.title(),
  nguyenVan: await khoi(page, 'xai_duoc').filter({ hasText: XSS }).count(),
}));

test('B1-Đ0 XSS: chữ tệp xuất hiện nguyên văn, không thành thẻ, tiêu đề không đổi; đối chứng cấy insertAdjacentHTML ⇒ lộ img', async () => {
  ghiTT({ ...TT, gio_dung: gioTruoc(0), xai_duoc: [{ ...TT.xai_duoc[0], ten: XSS }] });
  try {
    assert.deepEqual(await doXss(mX), { img: 0, title: TIEU_DE, nguyenVan: 1 });
    if (DOI_CHUNG) {
      await datBan(mX, { va: { 'dom.js': [[NEO_CON, CAY_CON]] } });
      const cay = await doXss(mX);
      assert.ok(cay.img > 0 && cay.nguyenVan === 0, JSON.stringify(cay));
      await datBan(mX);
    }
  } finally { ghiTT({ ...TT, gio_dung: gioTruoc(0) }); }
});
