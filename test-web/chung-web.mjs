// Đồ nghề test trình duyệt (Pha B, B1 bước 0): máy chủ thật (moiTruong của test máy chủ, nghe Unix socket như production)
// + cầu TCP 127.0.0.1 chèn vé như cloudflared + đặt/duyệt bản giao diện theo đường thật A5 + Chrome thật (playwright-core, đường tuyệt đối).
// Cầu thay vì extraHTTPHeaders: probe 13/11 đo được Playwright KHÔNG chèn header vào yêu cầu do service worker gửi.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import duong from '../kiem/duong-pw.cjs';
import { moiTruong, goi, VE, DAU_GHI } from '../test-may-chu/chung.mjs';

// Yêu cầu do service worker gửi (sw.js, cache.addAll, fetch trong SW) chỉ qua context.route + chịu setOffline khi bật cờ này (probe 13/11,
// playwright-core 1.55: tắt ⇒ ctx.route không thấy, setOffline không chặn SW). Đặt TRƯỚC khi nạp playwright-core.
process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
const { chromium } = createRequire(import.meta.url)(duong.PW);
export const WEB = fileURLToPath(new URL('../web/', import.meta.url));
// Ca đối chứng (cấy qua datBan va) chỉ chạy khi bật. Runner đột biến đặt WEB_DOI_CHUNG=0: đột biến xoá dòng neo thì cấy không khớp ⇒ ném ⇒ «DIỆT» giả.
export const DOI_CHUNG = process.env.WEB_DOI_CHUNG !== '0';

const CO = ['--disable-background-networking', '--disable-component-update', '--no-first-run'];
export const moTrinh = () => chromium.launch({ executablePath: duong.CHROME, headless: true, args: CO });
// Context bền (hồ sơ thật, KHÔNG ẩn danh): Page.getInstallabilityErrors trong newContext luôn báo «in-incognito» (probe 13/11).
export const moTrinhBen = (thuMuc, tuy = {}) => chromium.launchPersistentContext(thuMuc, { executablePath: duong.CHROME, headless: true, args: CO, ...tuy });

// Cầu: bỏ vé khách gửi, chèn vé hiện tại, chuyển nguyên method/đường/header/thân sang web.sock; trả nguyên mã/header/thân.
// datVe() ⇒ VE · datVe(null) ⇒ không vé (401) · datVe('chuyen') ⇒ giả lề Cloudflare Access: 302 sang /cdn-cgi/access/login, đường đó 200 «đăng nhập».
export function cauNoi(may) {
  let ve = VE;
  const sv = http.createServer((req, res) => {
    if (ve === 'chuyen') {
      if (req.url.startsWith('/cdn-cgi/access/login')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>Đăng nhập</title><p>đăng nhập</p>'); }
      else { res.writeHead(302, { Location: '/cdn-cgi/access/login' }); res.end(); }
      return;
    }
    const dau = { ...req.headers };
    delete dau['cf-access-jwt-assertion'];
    if (ve) dau['cf-access-jwt-assertion'] = ve;
    const r = http.request({ socketPath: may.ngheSocket, path: req.url, method: req.method, headers: dau, agent: false }, kq => { res.writeHead(kq.statusCode, kq.headers); kq.pipe(res); });
    r.on('error', () => res.destroy());
    req.pipe(r);
  });
  return new Promise(ok => sv.listen(0, '127.0.0.1', () => ok({
    url: `http://127.0.0.1:${sv.address().port}`,
    datVe: (v = VE) => { ve = v; },
    dong: () => new Promise(d => { sv.closeAllConnections(); sv.close(() => d()); }),
  })));
}

// Máy chủ + thư mục bản/chờ của chính tiến trình test. ghiBan:false ⇒ máy thứ nhất duyệt bản rồi đóng; máy thứ hai CÙNG thuMucBan, bỏ
// thuMucCho/uidCho ⇒ ghiBat sai ⇒ route bản 423 mà trang vẫn phục vụ. Trả { may, ch, mt, cau, url, dong() }; ch = cấu hình (đối tượng).
export async function dungMay({ cosGhi = true, ghiBan = true, xuatVao = null, goiAI } = {}) {
  const mt = moiTruong(), uid = process.getuid(), ban = path.join(mt.tam, 'ban'), cho = path.join(mt.tam, 'cho');
  fs.mkdirSync(ban); fs.mkdirSync(path.join(cho, 'ban'), { recursive: true });
  const ch = { cosGhi, thuMucBan: ban, uidBan: uid, thuMucCho: cho, uidCho: uid, ...(xuatVao ? { thuMucXuatVao: xuatVao } : {}) };
  const tuy = goiAI ? { goiAI } : undefined;
  let may = await mt.may(ch, [], tuy);
  if (!ghiBan) {
    await datBan({ may, ch });
    await may.dong();
    may = await mt.may(ch, ['thuMucCho', 'uidCho'], tuy);
  }
  const cau = await cauNoi(may);
  return { may, ch, mt, cau, url: cau.url, async dong() { await cau.dong(); await mt.dong(); } };
}

// Đường thật A5: chép web/ vào <thuMucCho>/ban/<sha> (va = { 'tệp': [[cũ, mới], …] }, mỗi `cũ` khớp ĐÚNG 1 chỗ) ⇒ GET /api/ban lấy manifest
// ⇒ POST /api/ban/duyet ⇒ khẳng định hien_tai (R5) ⇒ xoá thư mục chờ của sha đó (giữ ≤ SO_CHO bản chờ). m = kết quả dungMay (cần may, ch).
export async function datBan(m, { va = {} } = {}) {
  const sha = crypto.createHash('sha1').update(crypto.randomUUID()).digest('hex'), d = path.join(m.ch.thuMucCho, 'ban', sha), ten = fs.readdirSync(WEB);
  for (const t of Object.keys(va)) if (!ten.includes(t)) throw new Error('cấy vào tệp không có: ' + t);
  fs.mkdirSync(d);
  for (const t of ten) {
    let b = fs.readFileSync(path.join(WEB, t));
    if (va[t]) {
      let s = b.toString('utf8');
      for (const [cu, moi] of va[t]) {
        const n = s.split(cu).length - 1;
        if (n !== 1) throw new Error(`cấy ${t}: khớp ${n} chỗ`);
        s = s.replace(cu, () => moi);
      }
      b = Buffer.from(s);
    }
    fs.writeFileSync(path.join(d, t), b);
  }
  const c = (await goi(m.may, '/api/ban')).json?.cho?.find(x => x.sha === sha);
  assert.ok(c?.manifest, 'bản chờ hỏng: ' + (c?.loi ?? 'không thấy'));
  const r = await goi(m.may, '/api/ban/duyet', { method: 'POST', dau: DAU_GHI, than: JSON.stringify({ sha, manifest: c.manifest }) });
  assert.equal(r.ma, 200, r.than);
  assert.equal(r.json.hien_tai, sha);
  assert.equal((await goi(m.may, '/api/ban')).json.hien_tai.sha, sha);
  for (const t of fs.readdirSync(d)) fs.unlinkSync(path.join(d, t));
  fs.rmdirSync(d);
  return sha;
}

// Chặn + ghi mọi yêu cầu khác gốc cầu nối (vào `mang` và `loi`) ở mức CONTEXT (gồm yêu cầu do service worker gửi — page.route không
// thấy chúng); pageerror + console.error của trang vào `loi`.
export async function ganCanh(ctx, page, url) {
  const loi = [], mang = [], goc = new URL(url).origin;
  await ctx.route('**/*', r => {
    if (new URL(r.request().url()).origin === goc) return r.continue();
    mang.push(r.request().url());
    loi.push('chặn mạng: ' + r.request().url());
    return r.abort();
  });
  page.on('pageerror', e => loi.push('pageerror: ' + e.message));
  page.on('console', x => { if (x.type() === 'error') loi.push('console: ' + x.text()); });
  return { ctx, page, loi, mang };
}

// Mỗi ca một context (SW/cache sạch).
export async function trangMoi(trinh, url, { viewport = { width: 1440, height: 900 }, colorScheme = 'light' } = {}) {
  const ctx = await trinh.newContext({ viewport, colorScheme });
  return ganCanh(ctx, await ctx.newPage(), url);
}

// Gieo dữ liệu kho: POST /api/goi qua socket (vé VE, DAU_GHI, khoa_lap ngẫu nhiên).
export async function gieo(m, ops) {
  const r = await goi(m.may, '/api/goi', { method: 'POST', dau: DAU_GHI, than: JSON.stringify({ khoa_lap: crypto.randomUUID(), ops }) });
  assert.equal(r.ma, 200, r.than);
  return r.json;
}

// Soi bộ nhớ V8 của trang (cả thế giới phụ cùng isolate): GC rồi chụp heap, tìm chuỗi trong ảnh chụp. Chuỗi bí mật phải ASCII và đến trang
// dạng chuỗi PHẲNG (JSON.parse của /api/*): chuỗi ghép (ConsString) hiện trong ảnh chụp là «(concatenated string)», không thấy nguyên chuỗi.
// Không đọc chữ của trang bằng textContent()/hasText trước khi soi (chuỗi trả về nằm lại thế giới phụ) — đếm bằng locator.count().
export async function heapCo(page, chuoi) {
  const cdp = await page.context().newCDPSession(page), phan = [];
  cdp.on('HeapProfiler.addHeapSnapshotChunk', e => phan.push(e.chunk));
  await cdp.send('HeapProfiler.enable'); await cdp.send('HeapProfiler.collectGarbage');
  await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
  await cdp.detach(); return phan.join('').includes(chuoi);
}
