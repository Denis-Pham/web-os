// Khung (B1): thanh trái 12 mạch + #ban, định tuyến # bằng bấm thật, ngăn ☰ ở 375×812 (inert + focus), #tin luôn có mặt
// (kể cả Hết phiên), dom.el cấm style/on*/innerHTML. Trang phục vụ qua đường thật A5 (datBan) + cầu vé.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { moTrinh, dungMay, datBan, trangMoi } from './chung-web.mjs';

const MACH = ['chu', 'cos', 'hoc', 'y-tuong', 'tri-thuc', 'factory', 'sia', 'toa-an', 'tai-chinh', 'dau-tu', 'creator', 'nao-chung'];
let trinh, m;
before(async () => { trinh = await moTrinh(); m = await dungMay(); await datBan(m); });
after(async () => { await trinh?.close(); await m?.dong(); });

async function mo(tuy) {
  const t = await trangMoi(trinh, m.url, tuy);
  await t.page.goto(m.url + '/');
  await t.page.locator('section[data-man="chu"] [data-khoi]').nth(7).waitFor();
  return t;
}

test('thanh trái: 12 mạch đúng thứ tự + liên kết #ban; bấm thật đổi # và hiện đúng một màn; #tin mọi màn', async () => {
  const { ctx, page, loi, mang } = await mo();
  try {
    assert.deepEqual(await page.locator('#cac-mach a').evaluateAll(a => a.map(x => x.getAttribute('href'))), MACH.map(x => '#' + x));
    assert.equal(await page.locator('.thanh-trai a[href="#ban"]').count(), 1);
    for (const id of [...MACH.slice(1), 'ban', 'chu']) {
      await page.locator(id === 'ban' ? '.thanh-trai a[href="#ban"]' : `#cac-mach a[href="#${id}"]`).click();
      await page.locator(`#noi-dung > section[data-man="${id}"]`).waitFor();
      assert.equal(new URL(page.url()).hash, '#' + id);
      assert.equal(await page.locator('#noi-dung > section[data-man]').count(), 1, id);
      assert.equal(await page.locator(`#cac-mach a[aria-current="page"]`).count(), id === 'ban' ? 0 : 1, id);
      assert.equal(await page.locator('#tin[role="status"]').count(), 1, id);
    }
    assert.equal(await page.locator('#trang-thai-he', { hasText: 'ổn' }).count(), 0);
    assert.deepEqual(loi, []);
    assert.deepEqual(mang, []);
  } finally { await ctx.close(); }
});

test('375×812: ☰ mở ⇒ .workspace inert, focus vào ngăn; Esc ⇒ đóng, focus về ☰; chọn mạch trong ngăn ⇒ đóng ngăn', async () => {
  const { ctx, page, loi } = await mo({ viewport: { width: 375, height: 812 } });
  try {
    const nut = page.locator('[data-act="mo-menu"]');
    assert.equal(await page.locator('.workspace[inert]').count(), 0);
    await nut.click();
    assert.equal(await page.locator('.workspace[inert]').count(), 1);
    assert.equal(await nut.getAttribute('aria-expanded'), 'true');
    assert.ok(await page.evaluate(() => document.getElementById('danh-sach-mach').contains(document.activeElement)));
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.workspace[inert]').count(), 0);
    assert.equal(await nut.getAttribute('aria-expanded'), 'false');
    assert.ok(await page.evaluate(() => document.activeElement?.dataset.act === 'mo-menu'));
    await nut.click();
    await page.locator('#cac-mach a[href="#hoc"]').click();
    await page.locator('section[data-man="hoc"]').waitFor();
    assert.equal(await page.locator('.workspace[inert]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(loi, []);
  } finally { await ctx.close(); }
});

test('Hết phiên khi trang đang mở (401) ⇒ màn het-phien không dữ liệu, #tin còn và báo «Hết phiên»', async () => {
  const { ctx, page } = await mo();
  try {
    await page.locator('#cac-mach a[href="#hoc"]').click();
    m.cau.datVe(null);
    await page.locator('#cac-mach a[href="#chu"]').click();
    await page.locator('#noi-dung > section[data-man="het-phien"]').waitFor();
    assert.equal(await page.locator('[data-khoi]').count(), 0);
    assert.equal(await page.locator('#tin', { hasText: 'Hết phiên' }).count(), 1);
    assert.equal(await page.locator('[data-act="dang-nhap-lai"]').count(), 1);
    await page.locator('#cac-mach a[href="#cos"]').click();
    assert.equal(await page.locator('#noi-dung > section[data-man="het-phien"]').count(), 1);   // định tuyến không vẽ màn khác khi đã hết
  } finally { m.cau.datVe(); await ctx.close(); }
});

test('dom.el ném với style / onclick / innerHTML; thuộc tính thường và con chữ vẫn dựng', async () => {
  const { ctx, page } = await mo();
  try {
    const kq = await page.evaluate(async () => {
      const { el } = await import('/dom.js');
      const thu = t => { try { el('p', t); return 'khong-nem'; } catch (e) { return e.message; } };
      return [thu({ style: 'x' }), thu({ onclick: 'x' }), thu({ innerHTML: 'x' }), el('p', { title: 'a' }, '<b>', null, 2).outerHTML];
    });
    assert.deepEqual(kq, ['thuộc tính cấm: style', 'thuộc tính cấm: onclick', 'thuộc tính cấm: innerHTML', '<p title="a">&lt;b&gt;2</p>']);
  } finally { await ctx.close(); }
});
