// Thước đo «khớp Sổ» (plan-giao-dien-so Task 1): màn chủ trông như bản Sổ anh chốt 12/11 (demo/codex @6f544d4) trên dữ liệu DÀY.
// Dữ liệu tổng hợp ngay trong test, cỡ chuỗi theo số đo thật 17/11 (không chép dữ liệu thật vào repo). Phải ĐỎ trên 46267b3.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { moTrinh, dungMay, datBan, trangMoi, gieo } from './chung-web.mjs';

const KHOI = ['cho_anh', 'lich_hom_nay', 'suc_khoe', 'xai_duoc', 'tien_do', 'chi_phi_token', 'nhat_ky', 'agent_dang_chay'];
const HANG = [['cho_anh', 'lich_hom_nay', 'suc_khoe'], ['xai_duoc', 'tien_do', 'chi_phi_token'], ['nhat_ky', 'agent_dang_chay']];
const TRAN = { cho_anh: 3, lich_hom_nay: 3, suc_khoe: 3, tien_do: 3, nhat_ky: 3, xai_duoc: 4 };
const LAP = ' nội dung tổng hợp để đo bố cục như dữ liệu thật,';
const dai = (dau, n) => (dau + LAP.repeat(Math.ceil(n / LAP.length))).slice(0, n);
const gioTruoc = h => new Date(Date.now() - h * 3600e3).toISOString();
const homNay = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const day = (n, f) => Array.from({ length: n }, (_, i) => f(i));
const MA = day(9, i => 'CA-1' + (10 + i));
const TT = () => ({
  luoc_do: 1, gio_dung: gioTruoc(0),
  xai_duoc: day(49, i => ({ mach: dai('Mạch ' + i, 47), ten: dai('Món ' + (i + 1), 70), lam_gi: dai('Làm gì', 382), o_dau: dai('Bấm ở', 139) })),
  cho_anh: MA.map((ma, i) => ({ ma, tieu_de: dai('Việc chờ ' + (i + 1), 78), mach: 'cos', hanh_dong: dai('Anh làm', 67) })),
  suc_khoe: [...['0 nguồn hỏng', '3 lỗi khuôn', '4 đỏ · 4 vàng', '5 dự án lệch'].map((t, i) => ({ ten: dai('Tín hiệu ' + i, 19), trang_thai: t })),
    ...day(3, i => ({ ten: dai('Chưa nguồn ' + i, 19), trang_thai: 'chua_noi' }))],
  tien_do: day(12, i => ({ mach: dai('Mạch ' + (i + 1), 47), dang_lam: dai('Đang làm', 400), buoc_ke: dai('Bước kế', 200) })),
  nhat_ky: [{ luc: gioTruoc(1), dong: dai('Dựng lại trang Tổng quan', 42) }, { luc: gioTruoc(2), dong: dai('Đối chiếu bản đồ', 42) }],
});

let trinh, xuat, m;
before(async () => {
  trinh = await moTrinh();
  xuat = fs.mkdtempSync(path.join(process.env.WO_GOC || '/tmp', 'wo-so-'));
  fs.writeFileSync(path.join(xuat, 'trang-thai.json'), JSON.stringify(TT()));
  m = await dungMay({ xuatVao: xuat }); await datBan(m);
  await gieo(m, [...['07:30', '08:30', '10:00', '14:00', '16:30', '20:30'].map((g, i) => ({ loai: 'them', bang: 'lich', truong: { tieu_de: dai('Lịch ' + (i + 1), 60), bat_dau: `${homNay()}T${g}` } })),
    ...day(3, i => ({ loai: 'them', bang: 'viec', truong: { tieu_de: dai('Việc hạn hôm nay ' + (i + 1), 60), han: homNay() } }))]);
});
after(async () => {
  await trinh?.close(); await m?.dong();
  fs.rmSync(xuat, { recursive: true, force: true });
});

async function mo(tuy, fn) {
  const { ctx, page, loi, mang } = await trangMoi(trinh, m.url, tuy);
  try {
    await page.goto(m.url + '/#chu');
    await page.locator('html[data-san="1"]').waitFor();
    await page.locator('section[data-man="chu"] [data-khoi]').nth(7).waitFor();
    return await fn(page, loi, mang);
  } finally { await ctx.close(); }
}
const hop = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-man="chu"] [data-khoi]')].map(e => {
  const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
  return [e.dataset.khoi, { top: r.top, bottom: r.bottom, w: r.width, nen: cs.backgroundColor }];
})));
const dongThay = (page, k) => page.locator(`[data-man="chu"] [data-khoi="${k}"] li`).evaluateAll(a => a.filter(x => x.checkVisibility()).length);

for (const colorScheme of ['light', 'dark']) {
  test(`S1 1440×900 ${colorScheme}: đủ 8 thẻ trên nếp gấp, không tràn ngang, không lỗi, không gọi mạng ngoài`, () => mo({ colorScheme }, async (page, loi, mang) => {
    const h = await hop(page);
    assert.deepEqual(Object.keys(h).sort(), [...KHOI].sort());
    assert.deepEqual(KHOI.filter(k => h[k].bottom > 900).map(k => `${k}:${Math.round(h[k].bottom)}`), []);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(loi, []);
    assert.deepEqual(mang, []);
  }));
  test(`S5 ${colorScheme}: thẻ Chờ anh tô màu khác thẻ Lịch`, () => mo({ colorScheme }, async page => {
    const h = await hop(page);
    assert.notEqual(h.cho_anh.nen, h.lich_hom_nay.nen);
  }));
}

test('S2 1440: lưới so le 5/4/3 · 5/4/3 · 8/4, ba hàng thẳng', () => mo({}, async page => {
  const h = await hop(page), w = Object.fromEntries(KHOI.map(k => [k, Math.round(h[k].w)]));
  assert.ok(h.cho_anh.w > h.lich_hom_nay.w && h.lich_hom_nay.w > h.suc_khoe.w, JSON.stringify(w));
  assert.ok(h.nhat_ky.w >= 1.9 * h.agent_dang_chay.w, JSON.stringify(w));
  for (const r of HANG) for (const k of r) assert.ok(Math.abs(h[k].top - h[r[0]].top) <= 1, `${k} lệch hàng ${r[0]}`);
  assert.ok(h.cho_anh.top < h.xai_duoc.top && h.xai_duoc.top < h.nhat_ky.top, 'ba hàng phải khác nhau');
}));

test('S3 thứ tự: DOM và số thẻ 01–08 theo Sổ; 375×812 Lịch trên Chờ anh', async () => {
  await mo({}, async page => {
    assert.deepEqual(await page.locator('[data-man="chu"] [data-khoi]').evaluateAll(a => a.map(x => x.dataset.khoi)), KHOI);
    assert.deepEqual(await page.locator('[data-man="chu"] [data-khoi] .so-khoi').evaluateAll(a => a.map(x => x.textContent.trim())), day(8, i => '0' + (i + 1)));
  });
  await mo({ viewport: { width: 375, height: 812 } }, async page => {
    const h = await hop(page);
    assert.ok(h.lich_hom_nay.top < h.cho_anh.top, `lịch ${h.lich_hom_nay.top} / chờ anh ${h.cho_anh.top}`);
  });
});

test('S4 chữ có chân: main h1, .hieu, .so-khoi là Georgia', () => mo({}, async page => {
  for (const s of ['main h1', '.hieu', '[data-man="chu"] .so-khoi']) {
    assert.match(await page.locator(s).first().evaluate(e => getComputedStyle(e).fontFamily), /^"?Georgia/, s);
  }
}));

test('S6 biểu tượng: mỗi link mạch và mỗi dòng xem nhanh Chờ anh có svg', () => mo({}, async page => {
  const mach = await page.locator('#cac-mach a').evaluateAll(a => a.map(x => !!x.querySelector('svg')));
  assert.equal(mach.length, 12);
  assert.ok(mach.every(Boolean), 'link mạch thiếu svg');
  const dong = await page.locator('[data-khoi="cho_anh"] li').evaluateAll(a => a.filter(x => x.checkVisibility()).map(x => !!x.querySelector('svg')));
  assert.ok(dong.length > 0 && dong.every(Boolean), 'dòng Chờ anh thiếu svg');
}));

test('S7 xem nhanh: ≤ trần dòng mỗi thẻ; «09 việc»; «Xem cả 9» mở hộp đủ 9 mã, Esc trả focus về nút', () => mo({}, async (page, loi) => {
  const vuot = [];
  for (const [k, n] of Object.entries(TRAN)) { const so = await dongThay(page, k); if (so > n) vuot.push(`${k}:${so}>${n}`); }
  assert.deepEqual(vuot, []);
  assert.equal(await page.locator('[data-khoi="cho_anh"]').filter({ hasText: '09 việc' }).count(), 1);
  const nut = page.locator('[data-khoi="cho_anh"] [data-act="xem-het"]');
  assert.equal(await nut.count(), 1);
  assert.match(await nut.textContent(), /Xem cả 9/);
  await nut.click();
  const h = page.locator('#hop[open]');
  await h.waitFor();
  for (const ma of MA) assert.equal(await h.filter({ hasText: ma }).count(), 1, ma);
  await page.keyboard.press('Escape');
  await page.locator('#hop:not([open])').waitFor({ state: 'attached' });
  assert.equal(await page.evaluate(() => !!document.activeElement?.matches('[data-khoi="cho_anh"] [data-act="xem-het"]')), true);
  assert.deepEqual(loi, []);
}));
