// Cài ra màn hình chính (B1, Khuôn L7): manifest tải được + đủ trường hợp đồng, biểu tượng PNG 192/512 + apple-touch-icon 180 tải được đúng
// loại; CDP Page.getInstallabilityErrors ⇒ [] khi SW đang điều khiển — trong context BỀN (newContext ẩn danh luôn báo «in-incognito», probe
// 13/11). Lệnh CDP không có ⇒ bỏ qua kèm «không đo được» (skip, KHÔNG tính đạt), phần kiểm tĩnh vẫn chạy. Đối chứng: manifest mất icons ⇒ có lỗi.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { moTrinh, moTrinhBen, dungMay, datBan, trangMoi, ganCanh, DOI_CHUNG } from './chung-web.mjs';

let m, so = 0;
before(async () => { m = await dungMay(); await datBan(m); });
after(async () => { await m?.dong(); });

test('manifest tải được, đủ trường hợp đồng; biểu tượng 192/512/svg + apple-touch-icon 180 tải được, đúng loại', async () => {
  const trinh = await moTrinh();
  try {
    const { page, loi, mang } = await trangMoi(trinh, m.url);
    await page.goto(m.url + '/');
    const kq = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href, r = await fetch(href), mf = await r.json();
      const anh = [...mf.icons.map(i => new URL(i.src, href).href), document.querySelector('link[rel="apple-touch-icon"]').href];
      return { ma: r.status, mf, anh: await Promise.all(anh.map(u => fetch(u).then(x => `${new URL(u).pathname} ${x.status} ${x.headers.get('content-type')}`))) };
    });
    assert.equal(kq.ma, 200);
    const { icons, ...truong } = kq.mf;
    assert.deepEqual(truong, { name: 'Sổ — Không gian AI cá nhân', short_name: 'Sổ', lang: 'vi', start_url: '/', scope: '/', display: 'standalone', background_color: '#f3f0e8', theme_color: '#f3f0e8' });
    assert.deepEqual(icons, [
      { src: 'bieu-tuong-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'bieu-tuong-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'bieu-tuong.svg', sizes: 'any', type: 'image/svg+xml' },
    ]);
    assert.deepEqual(kq.anh, ['/bieu-tuong-192.png 200 image/png', '/bieu-tuong-512.png 200 image/png', '/bieu-tuong.svg 200 image/svg+xml', '/bieu-tuong-180.png 200 image/png']);
    assert.deepEqual([loi, mang], [[], []]);
  } finally { await trinh.close(); }
});

// Hồ sơ Chrome trong thư mục tạm của moiTruong (m.dong() dọn). Trả { sw, loi: [errorId…] | { khongDo }, mang }.
async function loiCai() {
  const ctx = await moTrinhBen(path.join(m.mt.tam, 'ho-so-' + (++so)));
  try {
    const { page, mang } = await ganCanh(ctx, ctx.pages()[0] ?? await ctx.newPage(), m.url);
    await page.goto(m.url + '/');
    const sw = await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 5000 }).then(() => true, () => false);
    const cdp = await ctx.newCDPSession(page);
    let loi;
    try { loi = (await cdp.send('Page.getInstallabilityErrors')).installabilityErrors.map(x => x.errorId); } catch (e) { loi = { khongDo: e.message }; }
    return { sw, loi, mang };
  } finally { await ctx.close(); }
}

test('cài được: Page.getInstallabilityErrors ⇒ [] khi SW đang điều khiển; đối chứng manifest mất icons ⇒ có lỗi cài', async t => {
  const kq = await loiCai();
  if (kq.loi?.khongDo) { t.diagnostic('không đo được: ' + kq.loi.khongDo); t.skip('không đo được — Page.getInstallabilityErrors không có'); return; }
  assert.deepEqual(kq, { sw: true, loi: [], mang: [] });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'manifest.webmanifest': [['"icons":', '"icons_bo":']] } });
    try {
      const cay = await loiCai();
      assert.ok(cay.sw && Array.isArray(cay.loi) && cay.loi.length > 0, JSON.stringify(cay));
    } finally { await datBan(m); }
  }
});
