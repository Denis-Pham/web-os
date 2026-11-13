// Màn #ban (B1 lượt 1d, web/ban.js): danh sách bản chờ mới/sửa/giữ/xoá, xem tệp mang ĐÚNG manifest của danh sách, nội dung tệp nguyên văn
// trong <pre> (XSS), bản chờ đổi sau khi liệt kê ⇒ 409 ⇒ «Bản chờ đã đổi…», Duyệt ⇒ tải lại ở bản mới, Lùi ⇒ về bản cũ, ten_dat_truoc ⇒ lời
// Việt. B1-T3: máy chủ tắt cửa duyệt (423) ⇒ «chỉ đọc», Duyệt/Lùi tắt, KHÔNG Hết phiên, phần còn lại của trang vẫn có dữ liệu.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { moTrinh, dungMay, datBan, datCho, xoaCho, trangMoi, gieo, DOI_CHUNG } from './chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';

const TIEU_DE = 'Sổ — Không gian AI cá nhân', XSS = '<img src=x onerror="document.title=\'X\'">';
const NEO_CON = 'for (const c of con) if (c !== null && c !== false && c !== undefined) n.append(c);';
const CAY_CON = "for (const c of con) if (c !== null && c !== false && c !== undefined) { if (typeof c === 'string') n.insertAdjacentHTML('beforeend', c); else n.append(c); }";
const NEO_HET_PHIEN = "export const laHetPhien = r => r.type === 'opaqueredirect' || r.status === 401 || r.status === 403;";
const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const BAN = 'section[data-man="ban"]', HET = '#noi-dung > section[data-man="het-phien"]';

let trinh, m;
before(async () => { trinh = await moTrinh(); m = await dungMay(); await datBan(m); });
after(async () => { await trinh?.close(); await m?.dong(); });

const choCuaMay = async (mm, sha) => (await goi(mm.may, '/api/ban')).json.cho.find(c => c.sha === sha);
const ghiCho = (sha, ten, s) => fs.writeFileSync(path.join(m.ch.thuMucCho, 'ban', sha, ten), s);

// Mở #ban của máy `mm`, chờ thẻ bản chờ `sha` hiện (sha null: chờ màn #ban hoặc màn Hết phiên).
async function moBan(mm, sha) {
  const t = await trangMoi(trinh, mm.url);
  await t.page.goto(mm.url + '/#ban');
  await t.page.locator(sha ? `${BAN} [data-cho="${sha}"]` : `${BAN}, ${HET}`).first().waitFor({ timeout: 10_000 });
  return t;
}

test('bản chờ: danh sách mới/sửa/giữ/xoá, manifest đủ 64 ký tự, dòng «nhãn neo đặt»; Xem gọi /api/ban/tep mang đúng manifest của danh sách ⇒ <pre> có nội dung', async () => {
  const C = datCho(m, { va: { 'index.html': [['<title>', '<!-- bản chờ --><title>']] }, them: { 'ghi-chu.txt': 'Ghi chú bản chờ\n' }, bo: ['bieu-tuong-512.png'] });
  const M = (await choCuaMay(m, C)).manifest, t = await moBan(m, C), yc = [];
  try {
    t.page.on('request', r => { if (new URL(r.url()).pathname === '/api/ban/tep') yc.push(Object.fromEntries(new URL(r.url()).searchParams)); });
    const tt = Object.fromEntries(await t.page.locator(`[data-cho="${C}"] [data-tep]`).evaluateAll(a => a.map(x => [x.dataset.tep, x.dataset.trangThai])));
    assert.deepEqual([tt['index.html'], tt['ghi-chu.txt'], tt['bieu-tuong-512.png'], tt['khung.js']], ['sua', 'moi', 'xoa', 'giu']);
    assert.equal(await t.page.locator(`[data-cho="${C}"][data-manifest="${M}"]`, { hasText: M }).count(), 1);
    assert.equal(await t.page.locator(BAN, { hasText: 'tên SHA chỉ là nhãn neo đặt' }).count(), 1);
    await t.page.locator(`[data-cho="${C}"] [data-tep="ghi-chu.txt"] [data-act="xem-tep"]`).click();
    await t.page.locator(`[data-cho="${C}"] pre`).waitFor({ timeout: 5000 }).catch(() => {});
    assert.deepEqual(yc, [{ sha: C, ten: 'ghi-chu.txt', manifest: M }]);
    assert.deepEqual(await t.page.locator(`[data-cho="${C}"] pre`).allTextContents(), ['Ghi chú bản chờ\n']);
    assert.deepEqual({ loi: t.loi, mang: t.mang }, { loi: [], mang: [] });
  } finally { await t.ctx.close(); xoaCho(m, C); }
});

async function doXss() {
  const C = datCho(m, { them: { 'xss.txt': XSS } }), t = await moBan(m, C);
  try {
    await t.page.locator(`[data-cho="${C}"] [data-tep="xss.txt"] [data-act="xem-tep"]`).click();
    await t.page.locator(`[data-cho="${C}"] [data-xem]:not([hidden])`).waitFor({ timeout: 5000 });
    return { img: await t.page.locator(`${BAN} img`).count(), title: await t.page.title(), pre: await t.page.locator(`[data-cho="${C}"] pre`).allTextContents() };
  } finally { await t.ctx.close(); xoaCho(m, C); }
}

test('XSS: tệp chứa <img onerror> hiện nguyên văn trong <pre>, không thành thẻ, tiêu đề không đổi; đối chứng cấy insertAdjacentHTML ⇒ lộ img', async () => {
  assert.deepEqual(await doXss(), { img: 0, title: TIEU_DE, pre: [XSS] });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'dom.js': [[NEO_CON, CAY_CON]] } });
    try {
      const cay = await doXss();
      assert.ok(cay.img > 0 && cay.pre[0] !== XSS, JSON.stringify(cay));
    } finally { await datBan(m); }
  }
});

test('bản chờ đổi sau khi liệt kê ⇒ Xem và Duyệt nhận 409 ⇒ «Bản chờ đã đổi…», tải lại danh sách (manifest mới), không duyệt', async () => {
  const C = datCho(m, { them: { 'ghi-chu.txt': 'bản một' } }), ht = (await goi(m.may, '/api/ban')).json.hien_tai.sha, t = await moBan(m, C);
  try {
    for (const [i, nut] of [[1, '[data-tep="ghi-chu.txt"] [data-act="xem-tep"]'], [2, '[data-act="duyet-ban"]']]) {
      ghiCho(C, 'ghi-chu.txt', 'bản đổi lần ' + i);
      const M = (await choCuaMay(m, C)).manifest;
      await t.page.locator(`[data-cho="${C}"] ${nut}`).click();
      await t.page.locator(`[data-cho="${C}"][data-manifest="${M}"]`).waitFor({ timeout: 5000 }).catch(() => {});
      assert.equal(await t.page.locator('#tin', { hasText: 'Bản chờ đã đổi' }).count(), 1, nut);
      assert.equal(await t.page.locator(`[data-cho="${C}"][data-manifest="${M}"]`).count(), 1, nut);
      await t.page.locator('#tin').evaluate(n => { n.textContent = ''; });
    }
    assert.equal(await t.page.locator(`[data-cho="${C}"] pre`).count(), 0);
    assert.equal((await goi(m.may, '/api/ban')).json.hien_tai.sha, ht);
  } finally { await t.ctx.close(); xoaCho(m, C); }
});

// SW đang điều khiển phải là bản `sha` và không còn installing/waiting (hạn 10 s, hết hạn ⇒ fail kèm trạng thái).
async function swOnDinh(page, sha) {
  const hang = () => page.evaluate(async x => {
    const rg = await navigator.serviceWorker.getRegistration();
    const url = navigator.serviceWorker.controller?.scriptURL ?? null;
    return { ok: !!url && url.endsWith('/sw.js?ban=' + x) && !!rg && rg.installing === null && rg.waiting === null, url, installing: !!rg?.installing, waiting: !!rg?.waiting };
  }, sha);
  const han = Date.now() + 10_000;
  let tt = await hang();
  while (!tt.ok && Date.now() < han) { await new Promise(r => setTimeout(r, 100)); tt = await hang(); }
  if (!tt.ok) assert.fail(`SW chưa ổn định ở bản ${sha}: ${JSON.stringify(tt)}`);
}

test('Duyệt ⇒ trang tải lại ở bản mới; Lùi ⇒ về bản cũ', async () => {
  const A = await datBan(m), C = datCho(m, { va: { 'index.html': [['<title>', '<!-- bản C --><title>']] } }), t = await moBan(m, C);
  const banTrang = () => t.page.evaluate(() => fetch('/ban.json', { cache: 'no-store' }).then(r => r.json()).then(o => o.ban));
  try {
    for (const [nut, dich, dang] of [[`[data-cho="${C}"] [data-act="duyet-ban"]`, C, A], ['[data-act="lui-ban"]', A, C]]) {
      await t.page.locator(nut + ':not([disabled])').waitFor({ timeout: 5000 });
      await swOnDinh(t.page, dang);
      await t.page.evaluate(() => { window.__cu = 1; });
      const [r] = await Promise.all([
        t.page.waitForResponse(x => /\/api\/ban\/(duyet|lui)$/.test(new URL(x.url()).pathname), { timeout: 10_000 }),
        t.page.locator(nut).click(),
      ]);
      if (r.status() !== 200) assert.fail(`POST hỏng: ${r.status()} · #tin «${await t.page.locator('#tin').textContent()}»`);
      await t.page.waitForFunction(() => !window.__cu && document.documentElement.dataset.san === '1', null, { timeout: 10_000 })
        .catch(async e => assert.fail(`không tải lại sau ${nut} · ${e.message.split('\n')[0]} · #tin «${await t.page.locator('#tin').textContent().catch(() => '?')}» · loi ${JSON.stringify(t.loi)}`));
      assert.deepEqual([await banTrang(), (await goi(m.may, '/api/ban')).json.hien_tai.sha], [dich, dich], nut);
      await t.page.locator(`${BAN} [data-hien-tai]`, { hasText: dich }).waitFor({ timeout: 5000 });
    }
    assert.deepEqual({ loi: t.loi, mang: t.mang }, { loi: [], mang: [] });
  } finally { await t.ctx.close(); xoaCho(m, C); }
});

test('bản chờ có BAN.json ⇒ lời Việt «có tệp trùng tên dành riêng ban.json», không có nút Duyệt', async () => {
  const C = datCho(m, { them: { 'BAN.json': '{}' } }), t = await moBan(m, C);
  try {
    assert.equal(await t.page.locator(`[data-cho="${C}"] [data-loi="ten_dat_truoc"]`, { hasText: 'có tệp trùng tên dành riêng ban.json' }).count(), 1);
    assert.equal(await t.page.locator(`[data-cho="${C}"] [data-act="duyet-ban"]`).count(), 0);
  } finally { await t.ctx.close(); xoaCho(m, C); }
});

// B1-T3: máy thứ hai ghiBan:false (route bản 423). va = cấy vào bản máy đó phục vụ.
async function chiDoc(va) {
  const mm = await dungMay({ ghiBan: false, va });
  try {
    await gieo(mm, [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc hạn hôm nay', han: homNay() } }]);
    const t = await moBan(mm, null);
    try {
      await t.page.locator(BAN, { hasText: 'chỉ đọc' }).waitFor({ timeout: 5000 }).catch(() => {});
      const r = {
        chiDoc: await t.page.locator(BAN, { hasText: 'chỉ đọc' }).count(),
        luiTat: await t.page.locator(`${BAN} [data-act="lui-ban"][disabled]`).count(),
        nutBat: await t.page.locator(`${BAN} [data-act="duyet-ban"]:not([disabled]), ${BAN} [data-act="lui-ban"]:not([disabled])`).count(),
        hetPhien: await t.page.locator('#tin', { hasText: 'Hết phiên' }).count(),
        thanhTrai: await t.page.locator('#cac-mach a').count(),
      };
      await t.page.locator('#cac-mach a[href="#chu"]').click();
      r.viec = await t.page.locator('section[data-man="chu"] [data-viec]').first().waitFor({ timeout: 5000 }).then(() => true, () => false);
      return r;
    } finally { await t.ctx.close(); }
  } finally { await mm.dong(); }
}

test('B1-T3 423 ⇒ «chỉ đọc», Duyệt/Lùi tắt, #tin không «Hết phiên», thanh trái + màn chủ vẫn có dữ liệu; đối chứng laHetPhien gồm 423 ⇒ Hết phiên', async () => {
  assert.deepEqual(await chiDoc(), { chiDoc: 1, luiTat: 1, nutBat: 0, hetPhien: 0, thanhTrai: 12, viec: true });
  if (DOI_CHUNG) {
    const cay = await chiDoc({ 'api.js': [[NEO_HET_PHIEN, NEO_HET_PHIEN.replace(' || r.status === 403;', ' || r.status === 403 || r.status === 423;')]] });
    assert.ok(cay.hetPhien === 1 && cay.chiDoc === 0 && !cay.viec, JSON.stringify(cay));
  }
});

// B1-T3 vế «Duyệt tắt» (Minor 2): ghi tắt ⇒ GET /api/ban 423 ⇒ không có thẻ bản chờ; ban.js đọc ban_ghi ở /api/phien để vẫn vẽ nút Duyệt tắt.
async function duyetTat(va) {
  const mm = await dungMay({ ghiBan: false, va });
  try {
    const t = await moBan(mm, null);
    try {
      await t.page.locator(BAN, { hasText: 'chỉ đọc' }).waitFor({ timeout: 5000 }).catch(() => {});
      return {
        duyetTat: await t.page.locator(`${BAN} [data-act="duyet-ban"][disabled]`).count(),
        duyetBat: await t.page.locator(`${BAN} [data-act="duyet-ban"]:not([disabled])`).count(),
        chiDoc: await t.page.locator(BAN, { hasText: 'chỉ đọc' }).count(),
        hetPhien: await t.page.locator('#tin', { hasText: 'Hết phiên' }).count(),
      };
    } finally { await t.ctx.close(); }
  } finally { await mm.dong(); }
}

test('B1-T3 vế Duyệt tắt: ban_ghi:false ⇒ màn #ban có nút Duyệt disabled + «chỉ đọc»; đối chứng bỏ đọc ban_ghi ⇒ không có nút', async () => {
  assert.deepEqual(await duyetTat(), { duyetTat: 1, duyetBat: 0, chiDoc: 1, hetPhien: 0 });
  if (DOI_CHUNG) {
    const cay = await duyetTat({ 'ban.js': [['.ban_ghi === false', ".ban_ghi === 'x'"]] });
    assert.equal(cay.duyetTat, 0, JSON.stringify(cay));
  }
});
