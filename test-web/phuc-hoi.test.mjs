// /phuc-hoi (B1 lượt 1d, mã máy chủ ban.mjs): sau khi lùi nút Lùi GIỮ tắt (B1-M2 — bấm lại sẽ lùi tiếp sang bản vừa bỏ) và gỡ service
// worker lỗi ⇒ báo riêng, vẫn «Đã lùi» (B1-M3 — lùi đã xong ở máy chủ, không được báo «Lùi không được»).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { moTrinh, dungMay, datBan, trangMoi } from './chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';

let trinh, m;
before(async () => { trinh = await moTrinh(); m = await dungMay(); });
after(async () => { await trinh?.close(); await m?.dong(); });

const choSw = (page, s) => page.waitForFunction(x => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js?ban=' + x), s, { timeout: 5000 }).then(() => true, () => false);

// Duyệt A rồi B ⇒ /phuc-hoi (trước = A) ⇒ bấm Lùi ⇒ chờ nap() đọc lại (#hien-tai = A) ⇒ đọc #tin, #lui. `truocKhi(t, B)` chạy trước khi mở /phuc-hoi.
async function luiTuPhucHoi(truocKhi) {
  const A = await datBan(m), B = await datBan(m), t = await trangMoi(trinh, m.url);
  try {
    const sw = truocKhi ? await truocKhi(t, B) : null;
    await t.page.goto(m.url + '/phuc-hoi');
    await t.page.locator('#lui:not([disabled])').waitFor({ timeout: 5000 });
    const dk = await t.page.evaluate(() => navigator.serviceWorker.getRegistrations().then(d => d.length));
    await t.page.locator('#lui').click();
    await t.page.locator(`#hien-tai:has-text("${A}")`).waitFor({ timeout: 5000 }).catch(() => {});
    await t.page.locator('#tin:has-text("Đã lùi"), #tin:has-text("Lùi không được")').waitFor({ timeout: 5000 }).catch(() => {});
    return { A, sw, dk, tat: await t.page.locator('#lui').isDisabled(), tin: await t.page.locator('#tin').textContent(),
      hienTai: (await goi(m.may, '/api/ban')).json.hien_tai.sha === A, loi: t.loi, mang: t.mang };
  } finally { await t.ctx.close(); }
}

test('B1-M2 /phuc-hoi: lùi xong ⇒ #lui giữ tắt (trước giờ là bản vừa bỏ), #tin «Đã lùi về bản <A>»', async () => {
  const r = await luiTuPhucHoi();
  assert.ok(r.tin.startsWith('Đã lùi về bản ' + r.A + '.'), r.tin);
  assert.deepEqual({ tat: r.tat, hienTai: r.hienTai, loi: r.loi, mang: r.mang }, { tat: true, hienTai: true, loi: [], mang: [] });
});

test('B1-M3 /phuc-hoi: gỡ service worker lỗi ⇒ vẫn «Đã lùi» + báo riêng «service worker», không «Lùi không được»', async () => {
  const r = await luiTuPhucHoi(async (t, B) => {
    await t.page.addInitScript(() => { ServiceWorkerRegistration.prototype.unregister = () => Promise.reject(new Error('giả lỗi gỡ')); });
    await t.page.goto(m.url + '/#chu');
    return choSw(t.page, B);
  });
  assert.equal(r.sw, true, 'SW của bản B chưa điều khiển ⇒ ca không đi qua nhánh gỡ SW');
  assert.ok(r.dk >= 1, 'không có đăng ký SW nào để gỡ');
  assert.ok(r.tin.includes('Đã lùi về bản ' + r.A) && r.tin.includes('service worker') && !r.tin.includes('Lùi không được'), r.tin);
  assert.deepEqual({ tat: r.tat, hienTai: r.hienTai, mang: r.mang }, { tat: true, hienTai: true, mang: [] });
});
