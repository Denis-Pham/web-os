// Service worker + lật bản (B1 lượt 1c): hết phiên + tắt mạng ⇒ màn không dữ liệu (Đ1), tải lại khi không vé ⇒ vỏ đệm ⇒ Hết phiên, không
// JSON thô (T2), SW không chặn /api/*, /phuc-hoi(.js) (T4), SW của bản hỏng vẫn để /phuc-hoi lùi được (Đ4), lật bản đổi SHA ⇒ tải lại,
// SW mới điều khiển, cache cũ bị dọn (Đ5). Yêu cầu do SW gửi đi qua ctx.route (cờ ở chung-web.mjs) — ca đồ nghề có đối chứng riêng.
// Bí mật đến trang qua JSON của /api/man-chu; không đọc chữ trang bằng textContent/hasText trước khi soi heap — chỉ đếm.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { moTrinh, dungMay, datBan, trangMoi, gieo, heapCo, DOI_CHUNG } from './chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';

const BI_MAT = 'VIEC-BI-MAT-' + crypto.randomBytes(8).toString('hex');
const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const HET = '#noi-dung > section[data-man="het-phien"]', MAT = '#noi-dung > section[data-man="mat-ket-noi"]';
const NEO_FETCH = "if (e.request.method !== 'GET' || !laVo(u)) return;";
const NEO_LA_VO = "const laVo = u => u.origin === self.location.origin && u.search === '' && VO.includes(u.pathname);";
const NEO_401 = '  if (r.status === 401 || r.status === 403) return (await caches.match(u.pathname, { cacheName: TEN })) || r;\n';
const NEO_DON_CACHE = 'async function donCache() { for (const k of await caches.keys()) if (k !== TEN) await caches.delete(k); }';
const NEO_SO_SHA = 'if (soSha(SHA_TRANG, moi)) location.reload();';
const NEO_SAN = "if (co) veMan(); document.documentElement.dataset.san = '1';";   // khung.js: cấy «bản hỏng» SAU khi phiên đã đăng ký SW
// Cấy Đ1 (brief): SW đệm /api/* lúc chạy, mất mạng thì trả bản đệm.
const CAY_API = "if (e.request.method !== 'GET') return; if (u.pathname.startsWith('/api/')) { e.respondWith(fetch(e.request).then(x => { const y = x.clone(); caches.open(TEN).then(c => c.put(e.request, y)); return x; }).catch(() => caches.match(e.request))); return; } if (!laVo(u)) return;";
// Mất mạng thật: Chrome ghi lỗi console cho mỗi fetch hỏng (/ban.json, /api/phien) — không phải lỗi của trang.
const LOI_MAT_MANG = 'console: Failed to load resource: net::ERR_INTERNET_DISCONNECTED';

let trinh, m, sha;
before(async () => {
  trinh = await moTrinh(); m = await dungMay(); sha = await datBan(m);
  await gieo(m, [{ loai: 'them', bang: 'viec', truong: { tieu_de: BI_MAT, han: homNay() } }]);
});
after(async () => { await trinh?.close(); await m?.dong(); });

const choSw = (page, s) => page.waitForFunction(x => navigator.serviceWorker.controller?.scriptURL.endsWith('/sw.js?ban=' + x), s, { timeout: 5000 }).then(() => true, () => false);
const choViec = page => page.locator('[data-khoi="lich_hom_nay"] [data-viec]').first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
const dem = (page, s) => page.locator(s).count();
const PHAT_HIEN_LAI = () => {
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
};

// Trang mới có vé, mở màn chủ, chờ SW của bản `s` điều khiển (≤ 5 s: skipWaiting + clients.claim ngay lượt đầu).
async function moDieuKhien(s) {
  m.cau.datVe();
  const t = await trangMoi(trinh, m.url);
  await t.page.goto(m.url + '/#chu');
  return { ...t, sw: await choSw(t.page, s) };
}

// Bản gốc ⇒ mang rỗng: khẳng định ở T4. CSP connect-src 'self' của máy chủ (cả trên sw.js) chặn fetch khác gốc trong SW trước khi ra mạng
// (đo 13/11: lớp chặn không thấy gì) ⇒ ca này bỏ CSP RIÊNG cho sw.js để yêu cầu ra tới lớp chặn của đồ nghề.
test('đồ nghề: yêu cầu khác gốc do SW gửi bị chặn và ghi vào mang (ctx.route), page.route không thấy', async () => {
  if (!DOI_CHUNG) return;   // cấy vào sw.js — runner đột biến tắt (đột biến xoá neo ⇒ cấy ném ⇒ DIỆT giả)
  const X = 'https://vi-du.invalid/sw-ra-ngoai', S = await datBan(m, { va: { 'sw.js': [['self.skipWaiting();', `self.skipWaiting(); fetch('${X}').catch(() => {});`]] } });
  m.cau.datVe();
  const t = await trangMoi(trinh, m.url), trang = [];
  try {
    await t.ctx.route(u => u.pathname === '/sw.js', async r => {
      const x = await r.fetch(), h = x.headers();
      delete h['content-security-policy'];
      await r.fulfill({ response: x, headers: h });
    });
    await t.page.route(u => u.origin !== new URL(m.url).origin, r => { trang.push(r.request().url()); return r.abort(); });
    await t.page.goto(m.url + '/#chu');
    const sw = await choSw(t.page, S);
    for (let i = 0; i < 50 && !t.mang.includes(X); i++) await new Promise(ok => setTimeout(ok, 100));
    assert.deepEqual({ sw, mang: t.mang, loi: t.loi, trang }, { sw: true, mang: [X], loi: ['chặn mạng: ' + X], trang: [] });
  } finally { await t.ctx.close(); sha = await datBan(m); }
});

// Đ1: lượt hai (tải lại khi SW đã điều khiển) để /api/* đi qua SW — cấy đệm /api/* mới có cái để đệm; rồi mất vé + tắt mạng + tải lại.
async function matMangSauHet(s) {
  const t = await moDieuKhien(s);
  try {
    await t.page.reload();
    const truoc = await choViec(t.page);
    m.cau.datVe(null);
    await t.ctx.setOffline(true);
    await t.page.reload();
    await t.page.locator(`${MAT}, ${HET}, [data-viec]`).first().waitFor({ timeout: 5000 }).catch(() => {});
    const viec = await dem(t.page, '[data-viec]'), mat = await dem(t.page, MAT), heap = await heapCo(t.page, BI_MAT);
    return { sw: t.sw, truoc, viec, mat, heap, tin: await dem(t.page, '#tin:has-text("Mất kết nối")'), loi: t.loi.filter(x => x !== LOI_MAT_MANG) };
  } finally { m.cau.datVe(); await t.ctx.close(); }
}

test('B1-Đ1 hết phiên + tắt mạng ⇒ màn «Mất kết nối», không dữ liệu, bí mật không trong heap; đối chứng SW đệm /api/* ⇒ dữ liệu hiện lại', async () => {
  assert.deepEqual(await matMangSauHet(sha), { sw: true, truoc: true, viec: 0, mat: 1, heap: false, tin: 1, loi: [] });
  if (DOI_CHUNG) {
    const S = await datBan(m, { va: { 'sw.js': [[NEO_FETCH, CAY_API]] } });
    try {
      const cay = await matMangSauHet(S);
      assert.ok(cay.sw && cay.truoc && cay.viec >= 1 && cay.mat === 0, JSON.stringify(cay));
    } finally { sha = await datBan(m); }
  }
});

// T2 (tải lại): điều hướng gặp 401 khi SW đang điều khiển ⇒ vỏ đệm (không dữ liệu) ⇒ /api/phien 401 ⇒ màn Hết phiên.
async function taiLaiKhongVe(s) {
  const t = await moDieuKhien(s);
  try {
    const truoc = await choViec(t.page);
    m.cau.datVe(null);
    const r = await t.page.reload();
    await t.page.locator(HET).waitFor({ timeout: 5000 }).catch(() => {});
    return { sw: t.sw, truoc, tuSw: r.fromServiceWorker(), loai: await t.page.evaluate(() => document.contentType), het: await dem(t.page, HET), viec: await dem(t.page, '[data-viec]') };
  } finally { m.cau.datVe(); await t.ctx.close(); }
}

test('B1-T2 tải lại online khi không vé (SW đang điều khiển) ⇒ màn Hết phiên, không JSON thô; đối chứng bỏ nhánh 401 của SW ⇒ JSON thô', async () => {
  assert.deepEqual(await taiLaiKhongVe(sha), { sw: true, truoc: true, tuSw: true, loai: 'text/html', het: 1, viec: 0 });
  if (DOI_CHUNG) {
    const S = await datBan(m, { va: { 'sw.js': [[NEO_401, '']] } });
    try {
      const cay = await taiLaiKhongVe(S);
      assert.ok(cay.sw && cay.loai === 'application/json' && cay.het === 0, JSON.stringify(cay));
    } finally { sha = await datBan(m); }
  }
});

test('B1-T4 SW không chặn /api/*, /phuc-hoi(.js) khi trang đang được điều khiển; vỏ lúc mất mạng do SW trả', async () => {
  const t = await moDieuKhien(sha), ds = [];
  try {
    assert.equal(t.sw, true);
    t.page.on('response', r => ds.push([new URL(r.url()).pathname, r.fromServiceWorker()]));
    await t.page.reload();
    assert.equal(await choViec(t.page), true);
    await t.page.goto(m.url + '/phuc-hoi');
    await t.page.locator(`#hien-tai:has-text("${sha}")`).waitFor({ timeout: 5000 });   // /api/ban đã về
    const ngoai = ds.filter(([p]) => p.startsWith('/api/') || p.startsWith('/phuc-hoi')), vo = ds.filter(([p]) => ['/', '/khung.js', '/phien.js'].includes(p));
    for (const p of ['/api/phien', '/api/man-chu', '/phuc-hoi', '/phuc-hoi.js', '/api/ban']) assert.ok(ngoai.some(x => x[0] === p), 'thiếu ' + p);
    assert.deepEqual(ngoai.filter(x => x[1]), [], 'phản hồi do SW trả');
    assert.ok(vo.length >= 3 && vo.every(x => x[1]), 'vỏ không do SW trả (trang không được điều khiển?): ' + JSON.stringify(vo));
    await t.page.goto(m.url + '/');
    await t.ctx.setOffline(true);
    const r = await t.page.reload();
    assert.deepEqual([r.fromServiceWorker(), r.status()], [true, 200]);
    assert.deepEqual(t.mang, []);
  } finally { await t.ctx.close(); }
});

// Đ4: A tốt; B có khung.js hỏng SAU khi phiên đã đăng ký SW (sw.js nguyên, hoặc cấy `vaSw`) ⇒ trang ở B, SW của B điều khiển ⇒ /phuc-hoi.
async function phucHoiKhiBanHong(vaSw) {
  const A = await datBan(m), B = await datBan(m, { va: { 'khung.js': [[NEO_SAN, "throw new Error('hỏng');"]], ...(vaSw ? { 'sw.js': vaSw } : {}) } });
  const t = await moDieuKhien(B);
  try {
    const r = await t.page.goto(m.url + '/phuc-hoi'), tuSw = r.fromServiceWorker();
    await t.page.locator('#lui:not([disabled])').waitFor({ timeout: 5000 });
    await t.page.locator('#lui').click();
    await t.page.locator('#tin:has-text("Đã lùi")').waitFor({ timeout: 5000 });
    const lui = (await goi(m.may, '/api/ban')).json.hien_tai.sha === A;
    await t.page.goto(m.url + '/');
    const san = await t.page.locator('html[data-san="1"]').waitFor({ timeout: 10_000 }).then(() => true, () => false);
    return { sw: t.sw, tuSw, lui, san };
  } finally { await t.ctx.close(); sha = await datBan(m); }
}

test('B1-Đ4 SW của bản hỏng đang điều khiển ⇒ /phuc-hoi tới thẳng mạng, Lùi chạy, bản A khởi động; đối chứng SW chặn mọi đường cùng gốc ⇒ /phuc-hoi qua SW', async () => {
  assert.deepEqual(await phucHoiKhiBanHong(), { sw: true, tuSw: false, lui: true, san: true });
  if (DOI_CHUNG) {
    const cay = await phucHoiKhiBanHong([[NEO_LA_VO, 'const laVo = u => u.origin === self.location.origin;']]);
    assert.ok(cay.sw && cay.tuSw, JSON.stringify(cay));
  }
});

// Đ5: trang mở ở A (SW A điều khiển) ⇒ harness duyệt B (khác A một chú thích) ⇒ trang hiện lại ⇒ so SHA lệch ⇒ tải lại ⇒ SW B, chỉ còn vo-B.
async function latBan({ vaA = {}, vaB = {} } = {}) {
  const A = await datBan(m, { va: vaA }), t = await moDieuKhien(A);
  try {
    await t.page.locator('html[data-san="1"]').waitFor({ timeout: 5000 });
    const B = await datBan(m, { va: { 'index.html': [['<title>', '<!-- bản B --><title>']], ...vaB } });
    const napLai = t.page.waitForEvent('load', { timeout: 5000 }).then(() => true, () => false);
    await t.page.evaluate(PHAT_HIEN_LAI);
    const lai = await napLai, swB = await choSw(t.page, B);
    const ban = await t.page.evaluate(() => fetch('/ban.json', { cache: 'no-store' }).then(r => r.json()).then(o => o.ban));
    let cache = [];
    for (let i = 0; i < 25; i++) {
      cache = (await t.page.evaluate(() => caches.keys())).map(k => k === 'vo-' + A ? 'A' : k === 'vo-' + B ? 'B' : k).sort();
      if (cache.length === 1 && cache[0] === 'B') break;
      await new Promise(ok => setTimeout(ok, 200));
    }
    return { sw: t.sw, lai, swB, ban: ban === B, cache };
  } finally { await t.ctx.close(); sha = await datBan(m); }
}

test('B1-Đ5 lật bản đổi SHA ⇒ trang tải lại, SW bản mới điều khiển, chỉ còn cache vo-<B>; đối chứng bỏ so SHA ⇒ không tải lại; donCache rỗng ⇒ còn vo-<A>', async () => {
  assert.deepEqual(await latBan(), { sw: true, lai: true, swB: true, ban: true, cache: ['B'] });
  if (DOI_CHUNG) {
    const cay1 = await latBan({ vaA: { 'phien.js': [[NEO_SO_SHA, '']] } });
    assert.ok(cay1.sw && !cay1.lai && !cay1.swB, JSON.stringify(cay1));
    const cay2 = await latBan({ vaB: { 'sw.js': [[NEO_DON_CACHE, 'async function donCache() {}']] } });
    assert.ok(cay2.lai && cay2.swB && cay2.cache.includes('A'), JSON.stringify(cay2));
  }
});
