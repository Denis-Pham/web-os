// Phiên (B1 lượt 1b): het_luc xoá DOM + biến JS kể cả mất mạng (Đ3), trang treo nền qua het_luc rồi hiện lại qua pageshow (Đ2) /
// visibilitychange (Đ2b) ⇒ màn trống, 401/403/302 khi trang đang mở ⇒ Hết phiên (T2). Dụng cụ heapCo có đối chứng riêng (ca đầu).
// Bí mật đến trang qua JSON của /api/man-chu (chuỗi phẳng); không đọc chữ trang bằng textContent/hasText trước khi soi heap — chỉ đếm.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { moTrinh, dungMay, datBan, trangMoi, gieo, heapCo, DOI_CHUNG } from './chung-web.mjs';
import { ve, giayNay } from '../test-may-chu/chung.mjs';

const NEO_PAGESHOW = "window.addEventListener('pageshow', kiemLai);";
const NEO_HIEN_LAI = "document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') kiemLai(); });";
const NEO_DON = 'for (const f of DON) f();';
const HET = '#noi-dung > section[data-man="het-phien"]';
const BI_MAT = 'VIEC-BI-MAT-' + crypto.randomBytes(8).toString('hex');
const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

let trinh, m;
before(async () => {
  trinh = await moTrinh(); m = await dungMay(); await datBan(m);
  await gieo(m, [{ loai: 'them', bang: 'viec', truong: { tieu_de: BI_MAT, han: homNay() } }]);
});
after(async () => { await trinh?.close(); await m?.dong(); });

// Mở màn chủ với vé `v` (đồng hồ giả cài trước goto nếu `dongHo`), chờ việc bí mật hiện trong «Lịch hôm nay».
async function mo(v, dongHo = true) {
  m.cau.datVe(v);
  const t = await trangMoi(trinh, m.url);
  if (dongHo) await t.page.clock.install();
  await t.page.goto(m.url + '/#chu');
  await t.page.locator('[data-khoi="lich_hom_nay"] [data-viec]').first().waitFor();
  return t;
}
const choHet = page => page.locator(HET).waitFor({ timeout: 3000 }).catch(() => {});
const dem = async page => ({ viec: await page.locator('[data-viec]').count(), khoi: await page.locator('[data-khoi]').count(), het: await page.locator(HET).count() });
const veNgan = () => ve({ exp: giayNay() + 120 });

test('heapCo đối chứng: trang giữ chuỗi phẳng trong biến ⇒ true; gán null ⇒ false', async () => {
  const ctx = await trinh.newContext(), page = await ctx.newPage();
  try {
    await page.goto('about:blank');
    const s = 'VIEC-BI-MAT-' + crypto.randomBytes(8).toString('hex');
    await page.evaluate(j => { window.giu = JSON.parse(j); }, JSON.stringify({ t: s }));
    assert.equal(await heapCo(page, s), true);
    await page.evaluate(() => { window.giu = null; });
    assert.equal(await heapCo(page, s), false);
  } finally { await ctx.close(); }
});

// Đ2/Đ2b: hẹn giờ đóng băng (pauseAt), giờ hệ thống nhảy qua het_luc, mất vé, rồi phát sự kiện «trang hiện lại».
async function treoRoiHien(phat) {
  const { ctx, page, loi } = await mo(veNgan());
  try {
    await page.clock.pauseAt(Date.now() + 1000);
    await page.clock.setSystemTime(Date.now() + 300_000);
    m.cau.datVe(null);
    await page.evaluate(phat);
    await choHet(page);
    return { ...(await dem(page)), loi };
  } finally { m.cau.datVe(); await ctx.close(); }
}
const PHAT_PAGESHOW = () => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
const PHAT_HIEN_LAI = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

for (const [ma, ten, phat, neo] of [['B1-Đ2', 'pageshow', PHAT_PAGESHOW, NEO_PAGESHOW], ['B1-Đ2b', 'visibilitychange', PHAT_HIEN_LAI, NEO_HIEN_LAI]]) {
  test(`${ma} trang treo nền qua het_luc rồi hiện lại (${ten}) ⇒ màn Hết phiên, không việc; đối chứng bỏ dòng neo ⇒ dữ liệu còn`, async () => {
    assert.deepEqual(await treoRoiHien(phat), { viec: 0, khoi: 0, het: 1, loi: [] });
    if (DOI_CHUNG) {
      await datBan(m, { va: { 'phien.js': [[neo, '']] } });
      try {
        const cay = await treoRoiHien(phat);
        assert.ok(cay.viec >= 1 && cay.het === 0, JSON.stringify(cay));
      } finally { await datBan(m); }
    }
  });
}

// Đ3: hẹn giờ het_luc chạy khi đã mất mạng ⇒ DOM trống + bí mật không còn trong heap.
async function hetLucMatMang() {
  const { ctx, page, loi } = await mo(veNgan());
  try {
    const truoc = await heapCo(page, BI_MAT);
    await ctx.setOffline(true);
    await page.clock.fastForward(130_000);
    await choHet(page);
    return { truoc, ...(await dem(page)), sau: await heapCo(page, BI_MAT), loi };
  } finally { m.cau.datVe(); await ctx.close(); }
}

test('B1-Đ3 het_luc xoá DOM và biến JS kể cả mất mạng; đối chứng bỏ vòng DON ⇒ bí mật còn trong heap', async () => {
  assert.deepEqual(await hetLucMatMang(), { truoc: true, viec: 0, khoi: 0, het: 1, sau: false, loi: [] });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'phien.js': [[NEO_DON, '']] } });
    try {
      const cay = await hetLucMatMang();
      assert.ok(cay.truoc && cay.het === 1 && cay.sau, JSON.stringify(cay));
    } finally { await datBan(m); }
  }
});

for (const [ten, veSai, maMong] of [['401 không vé', () => null, 401], ['403 email khác', () => ve({ email: 'khac@vi-du.vn' }), 403], ['302 lề Access', () => 'chuyen', 'net::ERR_ABORTED']]) {
  test(`B1-T2 ${ten} khi trang đang mở ⇒ bấm #chu ⇒ Hết phiên, không dữ liệu`, async () => {
    const { ctx, page } = await mo(undefined, false), ma = [];
    try {
      // Playwright báo 302 của fetch redirect:'manual' là requestfailed net::ERR_ABORTED (đo 13/11), không phải response 302.
      const laManChu = r => new URL(r.url()).pathname === '/api/man-chu';
      page.on('response', r => { if (laManChu(r)) ma.push(r.status()); });
      page.on('requestfailed', r => { if (laManChu(r)) ma.push(r.failure()?.errorText); });
      await page.locator('#cac-mach a[href="#hoc"]').click();
      m.cau.datVe(veSai());
      await page.locator('#cac-mach a[href="#chu"]').click();
      await page.locator(HET).waitFor({ timeout: 5000 });
      assert.deepEqual(await dem(page), { viec: 0, khoi: 0, het: 1 });
      assert.equal(ma.at(-1), maMong, JSON.stringify(ma));
      assert.equal(await page.locator('#tin', { hasText: 'Hết phiên' }).count(), 1);
    } finally { m.cau.datVe(); await ctx.close(); }
  });
}
