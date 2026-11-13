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
const NEO_CHUA_KIEM = 'if (!(await daKiemPhien())) return;';   // khung.js veMan
const NEO_MC_HET = 'if (daHetPhien()) return;';   // man-chu.js trước khi gán đệm
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
  await t.page.locator('[data-khoi="lich_hom_nay"] [data-viec]').first().waitFor({ timeout: 10_000 });   // đột biến không vẽ ⇒ đỏ sau 10 s, không 30 s
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
    await ctx.setOffline(true);   // quá het_luc ⇒ phải xoá NGAY không cần mạng (không dựa vào 401 của /api/phien)
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

// Phản hồi /api/man-chu gửi trước het_luc (máy chủ còn 200) về SAU khi hẹn giờ đã xoá ⇒ không được vào lại đệm duLieu (heap).
async function manChuVeSauHet() {
  const { ctx, page, loi } = await mo(veNgan());
  try {
    let giu;
    const daGiu = new Promise(ok => { giu = ok; });
    await page.route('**/api/man-chu', r => giu(r));
    await page.locator('#cac-mach a[href="#hoc"]').click();
    await page.locator('#cac-mach a[href="#chu"]').click();
    const r = await daGiu;
    await page.clock.fastForward(130_000);
    await choHet(page);
    const xong = page.waitForEvent('requestfinished', x => new URL(x.url()).pathname === '/api/man-chu');
    await r.continue();
    await xong;
    await page.evaluate(() => new Promise(ok => setTimeout(ok, 200)));   // JS của trang xử lý xong phản hồi
    return { ...(await dem(page)), sau: await heapCo(page, BI_MAT), loi };
  } finally { m.cau.datVe(); await ctx.close(); }
}

test('B1-Đ3 đua: phản hồi /api/man-chu về sau het_luc ⇒ bí mật không vào lại heap; đối chứng bỏ chặn daHetPhien ở man-chu.js ⇒ còn', async () => {
  assert.deepEqual(await manChuVeSauHet(), { viec: 0, khoi: 0, het: 1, sau: false, loi: [] });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'man-chu.js': [[NEO_MC_HET, '']] } });
    try {
      const cay = await manChuVeSauHet();
      assert.ok(cay.het === 1 && cay.sau, JSON.stringify(cay));
    } finally { await datBan(m); }
  }
});

// /api/phien lỗi lúc mở (mất mạng / 503 JWKS chết) ⇒ chưa hẹn được het_luc ⇒ bấm #chu: veMan hỏi lại phiên, vẫn lỗi ⇒ không vẽ dữ liệu;
// mạng về ⇒ kiểm được ⇒ vẽ. Trả { viec lúc lỗi, hoi = số lần gọi /api/phien do cú bấm, sau = có việc sau khi mạng về }.
async function phienLoiLucMo(loiPhien) {
  m.cau.datVe();
  const { ctx, page } = await trangMoi(trinh, m.url);
  try {
    let lan = 0;
    const choLan = async n => { for (let i = 0; lan < n && i < 250; i++) await new Promise(ok => setTimeout(ok, 20)); };   // trần 5 s
    await page.route('**/api/phien', r => { lan++; return loiPhien(r); });
    await page.goto(m.url + '/#hoc');
    await page.locator('html[data-san="1"]').waitFor();
    await choLan(2);   // lúc mở: batDau và pageshow (kiemLai) đều hỏi /api/phien
    const goc = lan;
    await page.locator('#cac-mach a[href="#chu"]').click();
    await Promise.race([choLan(goc + 1), page.locator('[data-viec]').first().waitFor({ timeout: 5000 })]).catch(() => {});
    const viec = await page.locator('[data-viec]').count(), hoi = lan - goc;
    await page.unroute('**/api/phien');
    await page.locator('#cac-mach a[href="#hoc"]').click();
    await page.locator('#cac-mach a[href="#chu"]').click();
    const sau = await page.locator('[data-viec]').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
    return { viec, hoi, sau };
  } finally { await ctx.close(); }
}

for (const [ten, loiPhien] of [['mất mạng', r => r.abort()], ['503', r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"loi":"jwks"}' })]]) {
  test(`phiên chưa kiểm được lúc mở (${ten}) ⇒ bấm #chu không dữ liệu; mạng về ⇒ vẽ; đối chứng bỏ chặn ở veMan ⇒ dữ liệu hiện`, async () => {
    assert.deepEqual(await phienLoiLucMo(loiPhien), { viec: 0, hoi: 1, sau: true });
    if (DOI_CHUNG) {
      await datBan(m, { va: { 'khung.js': [[NEO_CHUA_KIEM, '']] } });
      try {
        const cay = await phienLoiLucMo(loiPhien);
        assert.ok(cay.viec >= 1, JSON.stringify(cay));
      } finally { await datBan(m); }
    }
  });
}

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
