// Service worker vỏ trang (B1, thiết kế 7) — cổng an ninh: KHÔNG BAO GIỜ trả dữ liệu đã lưu. Cache = đúng vỏ (mã + khung tĩnh) của bản SHA
// lúc cài, dựng một lần ở install; không cache.put lúc chạy. Mạng trước; chỉ khi mạng hỏng hoặc máy chủ trả 401/403 (hết phiên) mới trả vỏ
// đệm — vỏ không chứa dữ liệu, trang tự gọi /api/phien ⇒ «Hết phiên» / «Mất kết nối». Danh sách TRẮNG: /api/*, /ban.json, /phuc-hoi(.js),
// mọi thứ có query đi thẳng mạng (không respondWith). 302 của lề Access (opaqueredirect) trả nguyên ⇒ trình duyệt theo sang đăng nhập.
// Vỏ trả khi gặp 401/403 cho MỌI tệp vỏ (không riêng điều hướng): vỏ đệm cần nạp được khung.js/phien.js thì mới hiện được «Hết phiên».
'use strict';
const SHA = new URL(self.location.href).searchParams.get('ban') || 'khong-ro', TEN = 'vo-' + SHA;
const VO = ['/', '/index.html', '/nen.css', '/man.css', '/dom.js', '/api.js', '/phien.js', '/giao-dien.js', '/khung.js', '/man-chu.js', '/mach.js',
  '/manifest.webmanifest', '/bieu-tuong.svg', '/lien-ket.json'];
const laVo = u => u.origin === self.location.origin && u.search === '' && VO.includes(u.pathname);
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil(caches.open(TEN).then(c => c.addAll(VO))); });
async function donCache() { for (const k of await caches.keys()) if (k !== TEN) await caches.delete(k); }
self.addEventListener('activate', e => { e.waitUntil(donCache().then(() => self.clients.claim())); });
async function traVo(req, u) {
  let r;
  try { r = await fetch(req); } catch { return (await caches.match(u.pathname, { cacheName: TEN })) || Response.error(); }
  if (r.status === 401 || r.status === 403) return (await caches.match(u.pathname, { cacheName: TEN })) || r;
  return r;
}
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || !laVo(u)) return;
  e.respondWith(traVo(e.request, u));
});
