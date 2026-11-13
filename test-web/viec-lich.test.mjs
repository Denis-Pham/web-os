// Màn «Việc & lịch» (B2 lượt 2b): dữ liệu từ máy chủ thật qua cầu vé. Gieo đúng như brief: 5 việc (1 quá hạn, 1 hạn hôm nay, 1 đã xong, 2 hạn sau),
// 3 lịch hôm nay, 1 đề xuất ⇒ brief = 1/1/3/1. B2-Đ1 chuyển thể bộ đo CoS của demo (kiem/do-demo.js:140–175) sang trang thật;
// Đ2 brief khớp /api/brief; Đ3 Hoàn tác từng bước. Mỗi ca đối chứng cấy bản cố ý sai (chỉ khi DOI_CHUNG) ⇒ phải ĐỎ.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { moTrinh, dungMay, datBan, trangMoi, gieo, heapCo, DOI_CHUNG } from './chung-web.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { goi, ve, giayNay } from '../test-may-chu/chung.mjs';
import { COT_CSV } from '../may-chu/api.mjs';
import { taoDeXuat, apGoi } from '../may-chu/goi.mjs';

const ngayVn = (them = 0) => new Date(Date.now() + 7 * 3600e3 + them * 864e5).toISOString().slice(0, 10);
const NEO_GHI = 'await taiLai();', NEO_BRIEF = "const b = await goiApi('/api/brief');", NEO_POP = 'LICH_SU.pop()';
const BRIEF_MAU = "const b = { qua_han: 2, han_hom_nay: 3, lich_hom_nay: 1, de_xuat_cho: 1 };";
let trinh, m;
const ngu = ms => new Promise(r => setTimeout(r, ms));

before(async () => {
  trinh = await moTrinh();
  m = await dungMay(); await datBan(m);
  const v = (tieu_de, han) => ({ loai: 'them', bang: 'viec', truong: { tieu_de, han } });
  const r = await gieo(m, [v('Việc quá hạn', ngayVn(-1)), v('Việc hạn hôm nay', ngayVn(0)), v('Việc đã xong', ngayVn(-1)), v('Việc hạn sau A', ngayVn(5)), v('Việc hạn sau B', ngayVn(9))]);
  await gieo(m, [{ loai: 'xong', bang: 'viec', id: r.ket_qua[2].id, phien_ban: r.ket_qua[2].phien_ban }]);
  await gieo(m, ['09:00', '11:30', '15:45'].map((g, i) => ({ loai: 'them', bang: 'lich', truong: { tieu_de: `Lịch mẫu ${i + 1}`, bat_dau: `${ngayVn(0)}T${g}` } })));
  taoDeXuat(m.may.db, { mach: 'cos', chu_the: 'neo', noi_dung: 'Neo đề xuất', ops: [{ loai: 'them', bang: 'viec', truong: { tieu_de: 'Việc Neo gợi ý' } }] }, new Date().toISOString());
});
after(async () => { await trinh?.close(); await m?.dong(); });

async function moCos(fn, mm = m, viewport) {
  const { ctx, page, loi, mang } = await trangMoi(trinh, mm.url, viewport && { viewport });
  page.setDefaultTimeout(5000);
  try {
    await page.goto(mm.url + '/#cos');
    await page.locator('section[data-man="cos"] [data-brief] [data-so="qua_han"]').waitFor();
    return await fn(page, loi, mang);
  } finally { await ctx.close(); }
}
async function cho(f, ten) {
  const t = Date.now();
  for (;;) { if (await f()) return; if (Date.now() - t > 5000) assert.fail('hết giờ chờ: ' + ten); await ngu(50); }
}
// Trạng thái nội dung qua API (bỏ phien_ban, sua_luc như bộ đo demo).
async function trangThai() {
  const bo = x => x.map(({ phien_ban, sua_luc, ...con }) => con);
  const v = await goi(m.may, '/api/viec'), l = await goi(m.may, `/api/lich?tu=${ngayVn(0)}&den=${ngayVn(13)}`);
  return JSON.stringify({ viec: bo(v.json.viec), lich: bo(l.json.lich) });
}
const manh = page => page.locator('[data-viec],[data-lich]').evaluateAll(a => a.map(r => (r.dataset.viec ? 'v' + r.dataset.viec : 'l' + r.dataset.lich) + '|'
  + r.textContent.replace(/\s+/g, ' ').trim() + '|' + [...r.querySelectorAll('[aria-pressed]')].map(x => x.getAttribute('aria-pressed')).join()).join('\n'));
const dien = (page, ten, v) => page.locator(`#hop [name="${ten}"]`).fill(v);
const bam = (page, act, goc) => (goc ?? page).locator(`[data-act="${act}"]`).first().click();
const luu = async page => { await bam(page, 'luu', page.locator('#hop')); await page.locator('#hop[open]').waitFor({ state: 'hidden' }); };
const hoanTac = page => page.locator('#thanh-hoan-tac [data-act="hoan-tac"]').click();
const dong = (page, k, chu) => page.locator(`[data-${k}]`, { hasText: chu });

// Một bước của Đ1: làm ⇒ kiểm màn + API đổi ⇒ Hoàn tác ⇒ nội dung y trước (API + màn).
async function buoc(page, ten, lam, kiem) {
  const s0 = await trangThai(), d0 = await manh(page);
  await lam();
  await cho(async () => (await trangThai()) !== s0, ten + ': dữ liệu không đổi');
  await kiem();
  assert.notEqual(await manh(page), d0, ten + ': màn không đổi');
  await hoanTac(page);
  await cho(async () => (await trangThai()) === s0, ten + ': Hoàn tác không về y trạng thái trước');
  await cho(async () => (await manh(page)) === d0, ten + ': màn sau Hoàn tác khác trước');
}
async function chayDo1(page) {
  const ngay = ngayVn(7);
  await buoc(page, 'thêm việc', async () => {
    await bam(page, 'them-viec'); await dien(page, 'tieu_de', 'Việc thử đo'); await dien(page, 'han', ngay); await luu(page);
  }, () => dong(page, 'viec', 'Việc thử đo').waitFor());
  await buoc(page, 'sửa việc', async () => {
    await bam(page, 'sua', page.locator('[data-viec]').first()); await dien(page, 'tieu_de', 'Đã sửa thử'); await luu(page);
  }, () => dong(page, 'viec', 'Đã sửa thử').waitFor());
  await buoc(page, 'xoá việc', async () => {
    await page.locator('[data-viec]').first().locator('[data-act="xoa"]').click();
  }, () => cho(async () => (await page.locator('[data-viec]').count()) === 4, 'dòng viec đã xoá phải mất khỏi màn'));
  await buoc(page, 'xong việc', async () => {
    await page.locator('[data-viec]').first().locator('[data-act="xong"]').click();
  }, () => page.locator('[data-viec] [aria-pressed="true"]').nth(1).waitFor());
  await buoc(page, 'thêm lịch', async () => {
    await bam(page, 'them-lich'); await dien(page, 'tieu_de', 'Lịch thử đo'); await dien(page, 'ngay', ngayVn(3)); await dien(page, 'gio', '09:30'); await luu(page);
  }, () => dong(page, 'lich', 'Lịch thử đo').waitFor());
  await buoc(page, 'sửa lịch', async () => {
    await bam(page, 'sua', page.locator('[data-lich]').first()); await dien(page, 'tieu_de', 'Lịch đã sửa'); await luu(page);
  }, () => dong(page, 'lich', 'Lịch đã sửa').waitFor());
  await buoc(page, 'xoá lịch', async () => {
    await page.locator('[data-lich]').first().locator('[data-act="xoa"]').click();
  }, () => cho(async () => (await page.locator('[data-lich]').count()) === 2, 'dòng lich đã xoá phải mất khỏi màn'));
}

test('B2-Đ1 bộ đo CoS của demo trên trang thật: 7 bước ghi, màn đổi đúng, Hoàn tác về y trước; đối chứng «ghi không vẽ lại» ⇒ đỏ', async () => {
  await moCos(async (page, loi, mang) => {
    assert.equal(await page.locator('[data-viec]').count(), 5);
    assert.equal(await page.locator('[data-lich]').count(), 3);
    await chayDo1(page);
    assert.deepEqual(loi, []);
    assert.deepEqual(mang, []);
  });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'viec-ghi.js': [[NEO_GHI, '']] } });
    try {
      const ket = await moCos(page => buoc(page, 'thêm việc', async () => {
        await bam(page, 'them-viec'); await dien(page, 'tieu_de', 'Việc thử đo'); await luu(page);
      }, () => dong(page, 'viec', 'Việc thử đo').waitFor())).then(() => null, e => e);
      assert.ok(ket, 'cấy bỏ vẽ lại sau ghi mà bộ đo vẫn xanh');
    } finally { await datBan(m); }
  }
});

const doBrief = (page) => page.locator('[data-brief] [data-so]').evaluateAll(a => Object.fromEntries(a.map(x => [x.dataset.so, x.textContent])));
const veBrief = async () => {
  const b = (await goi(m.may, '/api/brief')).json;
  return moCos(async page => ({ man: await doBrief(page), api: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, String(v)])) }));
};

test('B2-Đ2 brief khớp /api/brief (1/1/3/1); đối chứng cấy brief mẫu ⇒ lệch', async () => {
  const { man, api } = await veBrief();
  assert.deepEqual(api, { qua_han: '1', han_hom_nay: '1', lich_hom_nay: '3', de_xuat_cho: '1' });
  assert.deepEqual(man, api);
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'viec-lich.js': [[NEO_BRIEF, BRIEF_MAU]] } });
    try {
      const cay = await veBrief();
      assert.notDeepEqual(cay.man, cay.api, 'cấy brief mẫu mà màn vẫn khớp');
    } finally { await datBan(m); }
  }
});

async function chayDo3(page) {
  const sua = async (cu, ten) => { await bam(page, 'sua', dong(page, 'viec', cu)); await dien(page, 'tieu_de', ten); await luu(page); await dong(page, 'viec', ten).waitFor(); };
  await sua('Việc hạn sau A', 'Sửa lần 1'); await sua('Sửa lần 1', 'Sửa lần 2');
  await hoanTac(page);
  await cho(async () => (await trangThai()).includes('Sửa lần 1') && !(await trangThai()).includes('Sửa lần 2'), 'một lần Hoàn tác phải chỉ trả lần sau');
  await dong(page, 'viec', 'Sửa lần 1').waitFor();
  assert.equal(await dong(page, 'viec', 'Sửa lần 2').count(), 0);
  await page.locator('#thanh-hoan-tac:not([hidden])').waitFor();   // còn mục kế ⇒ thanh hiện lại
}

const khoiPhuc = async () => {   // trả tên gốc (Hoàn tác lần hai của máy chủ báo «đã sửa sau» vì Hoàn tác lần một cũng là một lần ghi)
  for (const x of (await goi(m.may, '/api/viec')).json.viec) {
    if (/^Sửa lần/.test(x.tieu_de)) await gieo(m, [{ loai: 'sua', bang: 'viec', id: x.id, phien_ban: x.phien_ban, truong: { tieu_de: 'Việc hạn sau A' } }]);
  }
};

test('B2-Đ3 Hoàn tác từng bước: hai lần sửa, một lần Hoàn tác chỉ trả lần sau; đối chứng LICH_SU.pop ⇒ shift ⇒ đỏ', async () => {
  try { await moCos(chayDo3); } finally { await khoiPhuc(); }
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'viec-ghi.js': [[NEO_POP, 'LICH_SU.shift()']] } });
    try {
      const ket = await moCos(chayDo3).then(() => null, e => e);
      assert.ok(ket, 'cấy shift mà Hoàn tác vẫn đúng thứ tự');
    } finally { await datBan(m); await khoiPhuc(); }
  }
});

// ===== Lượt 2c: B2-T1 focus + thanh Hoàn tác · B2-T2 Việc nhà chỉ đọc + miền ngày + Xuất · B2-T3 cos_ghi · XSS · heap =====
const NUT_GHI = ['them-viec', 'them-lich', 'sua', 'xoa', 'xong', 'mo-lai'];
const MIEN = { min: '2000-01-01', max: '2100-12-31' };   // = MIEN_NGAY của giao-dien.js = laNgay 2000–2100 (goi.mjs)
const mayDong = [];
// Máy riêng (không đụng m): bản đã duyệt + 5 việc + 3 lịch như m; `them` thêm việc.
async function maySach(tuy = {}, them = []) {
  const mm = await dungMay(tuy); mayDong.push(mm); await datBan(mm);
  await gieo(mm, [...['Việc một', 'Việc hai', 'Việc ba', 'Việc bốn', 'Việc năm'].map((t, i) => ({ loai: 'them', bang: 'viec', truong: { tieu_de: t, han: ngayVn(i + 1) } })),
    ...['A', 'B', 'C'].map((t, i) => ({ loai: 'them', bang: 'lich', truong: { tieu_de: `Lịch ${t}`, bat_dau: `${ngayVn(0)}T0${i + 7}:00` } })), ...them]);
  return mm;
}
after(async () => { for (const x of mayDong) await x.dong().catch(() => {}); });

const noiFocus = page => page.evaluate(() => {
  const a = document.activeElement, r = a.closest('[data-viec],[data-lich]');
  return { act: a.dataset.act ?? null, dong: r ? (r.dataset.viec ?? r.dataset.lich) : null, bang: r ? (r.dataset.viec !== undefined ? 'viec' : 'lich') : null };
});
const choFocus = (page, mong, ten) => cho(async () => JSON.stringify(await noiFocus(page)) === JSON.stringify(mong), ten + ': focus sai ' + '(mong ' + JSON.stringify(mong) + ')');
const choHop = page => page.locator('#hop[open]').waitFor({ state: 'hidden' });

async function chayT1(page) {
  const hang = n => page.locator('[data-viec]').nth(n), idHang = n => hang(n).getAttribute('data-viec');
  const s0 = await trangThai(), id0 = await idHang(0), id1 = await idHang(1), id2 = await idHang(2);
  await bam(page, 'sua', hang(0)); await dien(page, 'tieu_de', 'Focus sau Lưu'); await luu(page);
  await dong(page, 'viec', 'Focus sau Lưu').waitFor();
  await choFocus(page, { act: 'sua', dong: id0, bang: 'viec' }, 'sau Lưu');
  await hoanTac(page); await cho(async () => (await trangThai()) === s0, 'Hoàn tác sửa');
  // Chrome tự trả focus về nút mở hộp khi dialog đóng (không qua .focus() của JS) ⇒ chỉ nhìn focus cuối không giết được đột biến bỏ
  // traVe?.focus(). Nên thêm một tai nghe .focus(): sau Huỷ/Esc phải có lời gọi .focus() lên nút `sua` của dòng đã mở hộp (traFocus của giao-dien.js).
  await page.evaluate(() => { window.__fc = []; const f = HTMLElement.prototype.focus; HTMLElement.prototype.focus = function (...a) { if (this.dataset.act === 'sua') window.__fc.push(this.closest('[data-viec]')?.dataset.viec); return f.apply(this, a); }; });
  const daFocus = (id, ten) => cho(async () => (await page.evaluate(() => window.__fc)).includes(id), ten + ': không ai gọi .focus() về nút đã mở hộp');
  await bam(page, 'sua', hang(1)); await page.evaluate(() => { window.__fc = []; }); await bam(page, 'huy', page.locator('#hop')); await choHop(page);
  await choFocus(page, { act: 'sua', dong: id1, bang: 'viec' }, 'sau Huỷ'); await daFocus(id1, 'sau Huỷ');
  await page.evaluate(() => { window.__fc = []; });
  await bam(page, 'sua', hang(1)); await page.keyboard.press('Escape'); await choHop(page);
  await choFocus(page, { act: 'sua', dong: id1, bang: 'viec' }, 'sau Esc'); await daFocus(id1, 'sau Esc');
  await hang(1).locator('[data-act="xoa"]').click();
  await cho(async () => (await page.locator(`[data-viec="${id1}"]`).count()) === 0, 'dòng xoá phải mất');
  await choFocus(page, { act: 'sua', dong: id2, bang: 'viec' }, 'sau xoá (nút đầu dòng kế)');
  await page.locator('#thanh-hoan-tac:not([hidden])').waitFor();
  const o = await page.evaluate(async () => {   // dòng cuối cuộn tới đáy không bị thanh Hoàn tác che
    const cuoi = document.querySelector('section[data-man="cos"] .luoi-cos').lastElementChild;
    for (const n of [document.scrollingElement, document.querySelector('main')]) n.scrollTop = 1e7;   // tới đáy thật (cả khi main là vùng cuộn)
    await new Promise(r => setTimeout(r, 150));
    return { duoi: cuoi.getBoundingClientRect().bottom, thanh: document.getElementById('thanh-hoan-tac').getBoundingClientRect().top };
  });
  assert.ok(o.duoi <= o.thanh, `dòng cuối bị thanh Hoàn tác che: ${JSON.stringify(o)}`);
  await hoanTac(page); await cho(async () => (await trangThai()) === s0, 'Hoàn tác xoá');
}

test('B2-T1 (375×812) focus sau Lưu/Huỷ/Esc/xoá + dòng cuối không bị thanh Hoàn tác che; đối chứng bỏ lớp co-hoan-tac ⇒ đỏ', async () => {
  await moCos(chayT1, m, { width: 375, height: 812 });
  if (DOI_CHUNG) {
    await datBan(m, { va: { 'giao-dien.js': [["document.body.classList.add('co-hoan-tac');", '']] } });
    try {
      const ket = await moCos(chayT1, m, { width: 375, height: 812 }).then(() => null, e => e);
      assert.ok(ket && /che/.test(ket.message), 'bỏ lớp co-hoan-tac mà dòng cuối vẫn không bị che: ' + ket?.message);
    } finally { await datBan(m); await khoiPhuc(); }
    await datBan(m, { va: { 'giao-dien.js': [['function traFocus() { traVe?.focus(); traVe = null; }', 'function traFocus() { traVe = null; }']] } });
    try {
      const ket = await moCos(chayT1, m, { width: 375, height: 812 }).then(() => null, e => e);
      assert.ok(ket && /focus/.test(ket.message), 'bỏ traVe?.focus() mà focus vẫn về nút mở hộp: ' + ket?.message);
    } finally { await datBan(m); await khoiPhuc(); }
  }
});

// B2-T2
const BO = nay => ({ luoc_do: 1, gio_dung: nay, viec: [
  { id: 'b1', ten: 'Đóng học phí', han: '2026-11-13', lap: null, xong: false, sua_luc: null },
  { id: 'b2', ten: 'Đã làm xong', han: '2026-11-13', lap: null, xong: true, sua_luc: null },
  { id: 'b3', ten: 'Dọn bếp', han: null, lap: 'hằng tuần', xong: false, sua_luc: null }] });
async function doT2(mm) {
  return moCos(async page => {
    const nha = page.locator('[data-nhom="viec-nha"]');
    await nha.waitFor();
    const r = { viecBo: await nha.locator('[data-viec-bo]').count(), nutBo: await page.locator('[data-viec-bo] button').count(),
      hub: await nha.locator('a', { hasText: 'Mở ở Hub' }).count(), hubChuaNoi: await nha.locator('[data-chua-noi]', { hasText: 'Mở ở Hub: chưa nối' }).count(), ngay: [] };
    for (const [nut, goc] of [['them-viec', null], ['them-lich', null], ['sua', '[data-viec]'], ['sua', '[data-lich]']]) {
      await bam(page, nut, goc ? page.locator(goc).first() : null);
      r.ngay.push(await page.locator('#hop input[type="date"]').evaluateAll(a => a.map(x => [x.min, x.max])));
      await bam(page, 'huy', page.locator('#hop')); await choHop(page);
    }
    return r;
  }, mm);
}
const CSV = async page => { const [d] = await Promise.all([page.waitForEvent('download'), page.locator('a[href="/api/xuat-viec?dang=csv"]').click()]); return fs.readFileSync(await d.path(), 'utf8').split(/\r?\n/)[0]; };

test('B2-T2 Việc nhà chỉ đọc + Mở ở Hub + miền ngày MIEN_NGAY mọi ô date + Xuất CSV dòng đầu COT_CSV; đối chứng cấy bỏ min/max và hub null', async () => {
  const nha = await dungMay(); mayDong.push(nha);   // chỉ để mượn thư mục tạm (nha.mt.tam, dọn khi nha đóng)
  const vao = path.join(nha.mt.tam, 'xuat-vao'), tep = path.join(vao, 'viec-bo.json');
  fs.mkdirSync(vao);
  fs.writeFileSync(tep, JSON.stringify(BO(new Date().toISOString())));
  try {
    const mm = await maySach({ xuatVao: vao });
    const chua = await doT2(mm);
    assert.deepEqual({ ...chua, ngay: undefined }, { viecBo: 2, nutBo: 0, hub: 0, hubChuaNoi: 1, ngay: undefined });
    assert.deepEqual(chua.ngay, [[[MIEN.min, MIEN.max]], [[MIEN.min, MIEN.max]], [[MIEN.min, MIEN.max]], [[MIEN.min, MIEN.max]]]);
    assert.equal(await moCos(CSV, mm), COT_CSV.join(','));
    await datBan(mm, { va: { 'lien-ket.json': [['"hub": null', '"hub": "https://hub.thu.test/"']] } });
    const co = await doT2(mm);
    assert.deepEqual({ hub: co.hub, hubChuaNoi: co.hubChuaNoi, nutBo: co.nutBo }, { hub: 1, hubChuaNoi: 0, nutBo: 0 });
    if (DOI_CHUNG) {
      assert.notEqual(await moCos(CSV, mm), COT_CSV.slice(1).join(','), 'đối chứng CSV: thiếu cột mà vẫn khớp');
      await datBan(mm, { va: { 'giao-dien.js': [[', min: MIEN_NGAY.min, max: MIEN_NGAY.max', '']] } });
      assert.notDeepEqual((await doT2(mm)).ngay[0], [[MIEN.min, MIEN.max]], 'cấy bỏ min/max mà ô ngày vẫn có miền');
    }
  } finally { /* thư mục nằm trong nha.mt.tam, dọn khi nha.dong() */ }
});

// B2-T3 (R12): ghi tắt ⇒ nút ghi disabled NGAY sau khi vẽ, trước mọi cú bấm; 423 dự phòng ⇒ «chỉ đọc», không Hết phiên.
const NEO_COS = "datGhi((await goiApi('/api/phien')).cos_ghi === true)";
async function doT3(mm) {
  return moCos(async page => {
    const nut = `${NUT_GHI.map(a => `[data-act="${a}"]`).join(',')}`;
    const truoc = { tong: await page.locator(nut).count(), bat: await page.locator(nut.split(',').map(x => x + ':not([disabled])').join(',')).count() };
    await page.locator(nut).evaluateAll(a => a.forEach(n => n.removeAttribute('disabled')));   // đường dự phòng: bấm khi DOM không còn tắt
    await bam(page, 'them-viec'); await dien(page, 'tieu_de', 'Không ghi được');
    await bam(page, 'luu', page.locator('#hop'));
    await page.locator('#tin', { hasText: 'Ghi đang tắt — chỉ đọc' }).waitFor({ timeout: 3000 }).catch(() => {});
    return { ...truoc, tin: await page.locator('#tin', { hasText: 'Ghi đang tắt — chỉ đọc' }).count(),
      hetPhien: await page.locator('section[data-man="het-phien"]').count(), sauBat: await page.locator(nut.split(',').map(x => x + ':not([disabled])').join(',')).count() };
  }, mm);
}
test('B2-T3 cosGhi:false ⇒ mọi nút ghi disabled ngay khi vẽ; 423 dự phòng ⇒ «Ghi đang tắt — chỉ đọc», không Hết phiên; đối chứng datGhi(true) ⇒ nút bật', async () => {
  const mm = await dungMay({ cosGhi: false }); mayDong.push(mm); await datBan(mm);
  assert.equal((await goi(mm.may, '/api/phien')).json.cos_ghi, false);
  // gieo thẳng vào kho (apGoi, không qua route): cosGhi:false chặn mọi route ghi
  apGoi(mm.may.db, { khoa_lap: crypto.randomUUID(), chu_the: 'anh', nguon: { loai: 'web' }, ops: [
    ...['Việc một', 'Việc hai'].map(t => ({ loai: 'them', bang: 'viec', truong: { tieu_de: t, han: ngayVn(2) } })),
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Lịch A', bat_dau: `${ngayVn(0)}T07:00` } }] }, new Date().toISOString());
  const r = await doT3(mm);
  assert.ok(r.tong === 2 + 3 * 2 + 2 && r.bat === 0, 'nút ghi chưa disabled khi vẽ: ' + JSON.stringify(r));
  assert.equal(r.tin, 1); assert.equal(r.hetPhien, 0); assert.equal(r.sauBat, 0);
  if (DOI_CHUNG) {
    await datBan(mm, { va: { 'viec-lich.js': [[NEO_COS, 'datGhi(true)']] } });
    assert.ok((await doT3(mm)).bat > 0, 'cấy datGhi(true) mà nút vẫn disabled');
  }
});

// XSS (R10): tieu_de là mã HTML ⇒ hiện nguyên văn, không thành phần tử
const XSS = '<img src=x onerror="document.title=\'X\'">';
const NEO_CON = 'for (const c of con) if (c !== null && c !== false && c !== undefined) n.append(c);';
const CAY_CON = "for (const c of con) if (c !== null && c !== false && c !== undefined) { if (typeof c === 'string') n.insertAdjacentHTML('beforeend', c); else n.append(c); }";
test('XSS (R10): tieu_de mã HTML ⇒ nguyên văn, không img trong màn, document.title không đổi; đối chứng insertAdjacentHTML ⇒ có img', async () => {
  const mm = await maySach({}, [{ loai: 'them', bang: 'viec', truong: { tieu_de: XSS } }]);
  const doXss = () => moCos(async page => {
    const tieu = await page.title();
    await dong(page, 'viec', 'onerror').waitFor();
    await page.waitForTimeout(300);
    return { img: await page.locator('section[data-man="cos"] img').count(), doi: (await page.title()) !== tieu,
      chu: await page.locator('[data-viec] strong', { hasText: 'onerror' }).evaluateAll(a => a.map(x => x.textContent)) };
  }, mm);
  assert.deepEqual(await doXss(), { img: 0, doi: false, chu: [XSS] });
  if (DOI_CHUNG) {
    await datBan(mm, { va: { 'dom.js': [[NEO_CON, CAY_CON]] } });
    const cay = await doXss().catch(e => ({ loi: e.message }));
    assert.ok(cay.loi || cay.img > 0 || cay.doi, 'cấy HTML mà màn vẫn sạch: ' + JSON.stringify(cay));
  }
});

// Heap (R10): ma_hoan (chuỗi phẳng từ JSON.parse của /api/goi) nằm trong LICH_SU ⇒ có trước het_luc, hết sau het_luc
const NEO_DON = 'don() { donGhi();';
async function doHeap(mm) {
  mm.cau.datVe(ve({ exp: giayNay() + 120 }));
  const t = await trangMoi(trinh, mm.url);
  const { ctx, page } = t;
  try {
    await page.clock.install();
    await page.goto(mm.url + '/#cos');
    await page.locator('[data-viec]').first().waitFor({ timeout: 10_000 });
    await bam(page, 'sua', page.locator('[data-viec]').first()); await dien(page, 'tieu_de', 'Heap ' + crypto.randomBytes(4).toString('hex'));
    const [r] = await Promise.all([page.waitForResponse(x => new URL(x.url()).pathname === '/api/goi'), bam(page, 'luu', page.locator('#hop'))]);
    const bi = (await r.json()).ma_hoan;
    assert.match(bi, /^[0-9a-f]{32}$/);
    await page.locator('#thanh-hoan-tac:not([hidden])').waitFor();
    const truoc = await heapCo(page, bi);
    await ctx.setOffline(true);
    await page.clock.fastForward(130_000);
    await page.locator('#noi-dung > section[data-man="het-phien"]').waitFor({ timeout: 3000 }).catch(() => {});
    return { truoc, het: await page.locator('#noi-dung > section[data-man="het-phien"]').count(), sau: await heapCo(page, bi) };
  } finally { mm.cau.datVe(); await ctx.close(); }
}
test('Heap (R10): ma_hoan trong LICH_SU có trước het_luc, không còn sau; đối chứng don() không thật (viec-don-goi) ⇒ còn', async () => {
  const mm = await maySach();
  assert.deepEqual(await doHeap(mm), { truoc: true, het: 1, sau: false });
  if (DOI_CHUNG) {
    await datBan(mm, { va: { 'viec-lich.js': [[NEO_DON, 'donX() { donGhi();']] } });
    const cay = await doHeap(mm).catch(e => ({ loi: e.message }));
    assert.ok(cay.loi || cay.sau, 'cấy don() không thật mà bí mật vẫn hết khỏi heap: ' + JSON.stringify(cay));
  }
});

// ===== Vòng sửa 1 =====
test('B2-S1 hộp sửa mở, máy khác đổi hạn ⇒ Lưu = 409 «em tải lại» ⇒ Lưu lần hai KHÔNG lùi hạn của máy kia', async () => {
  const mm = await maySach();
  const mot = async id => (await goi(mm.may, '/api/viec')).json.viec.find(x => id ? x.id === id : x.tieu_de === 'Việc một');
  await moCos(async page => {
    await bam(page, 'sua', dong(page, 'viec', 'Việc một'));
    await dien(page, 'tieu_de', 'Việc một sửa');
    const x = await mot(), hanMay = ngayVn(20);
    assert.notEqual(x.han.slice(0, 10), hanMay);
    await gieo(mm, [{ loai: 'sua', bang: 'viec', id: x.id, phien_ban: x.phien_ban, truong: { han: hanMay } }]);
    await bam(page, 'luu', page.locator('#hop'));
    await page.locator('#tin', { hasText: 'Dòng này vừa đổi ở chỗ khác — em tải lại.' }).waitFor();
    await dong(page, 'viec', 'Hạn ' + hanMay.slice(8, 10)).first().waitFor().catch(() => {});   // taiLai đã làm mới đệm
    await bam(page, 'luu', page.locator('#hop'));
    await page.waitForTimeout(500);
    const sau = await mot(x.id);
    assert.equal(sau.han.slice(0, 10), hanMay, 'Lưu lần hai đã lùi thay đổi của máy kia');
    assert.equal(sau.tieu_de, 'Việc một', 'Lưu lần hai đã ghi đè dù dòng đổi');
  }, mm);
});

test('B2-S2 heap: tieu_de của lần ghi THẤT BẠI (offline) có trước het_luc, không còn sau', async () => {
  const mm = await maySach(), bi = 'BiMat' + crypto.randomBytes(6).toString('hex');
  mm.cau.datVe(ve({ exp: giayNay() + 120 }));
  const { ctx, page } = await trangMoi(trinh, mm.url);
  try {
    await page.clock.install();
    await page.goto(mm.url + '/#cos');
    await page.locator('[data-viec]').first().waitFor({ timeout: 10_000 });
    await bam(page, 'them-viec'); await dien(page, 'tieu_de', bi);
    await ctx.setOffline(true);
    await bam(page, 'luu', page.locator('#hop'));
    await page.locator('#tin', { hasText: 'Mất kết nối' }).waitFor();
    const truoc = await heapCo(page, bi);
    await page.clock.fastForward(130_000);
    await page.locator('#noi-dung > section[data-man="het-phien"]').waitFor({ timeout: 3000 }).catch(() => {});
    assert.deepEqual({ truoc, het: await page.locator('#noi-dung > section[data-man="het-phien"]').count(), sau: await heapCo(page, bi) }, { truoc: true, het: 1, sau: false });
  } finally { mm.cau.datVe(); await ctx.close(); }
});

test('B2-S3 Việc nhà: tệp cũ ⇒ «cũ, dựng lúc»; tệp hỏng không bản tốt ⇒ chỉ nhãn «hỏng» (lớp nhan-loi), không «Chưa có việc nhà nào.»', async () => {
  const nha = await dungMay(); mayDong.push(nha);
  const vao = path.join(nha.mt.tam, 'xuat-vao'), tep = path.join(vao, 'viec-bo.json');
  fs.mkdirSync(vao);
  fs.writeFileSync(tep, JSON.stringify(BO(new Date(Date.now() - 4 * 3600e3).toISOString())));
  const doNha = mm => moCos(async page => {
    const k = page.locator('[data-nhom="viec-nha"]');
    return { cu: await k.locator('.nhan-khoi', { hasText: /^cũ, dựng lúc \d\d:\d\d \d\d\/\d\d$/ }).count(), hong: await k.locator('.nhan-khoi.nhan-loi', { hasText: /^hỏng$/ }).count(),
      rong: await k.locator('text=Chưa có việc nhà nào.').count(), muc: await k.locator('[data-viec-bo]').count() };
  }, mm);
  assert.deepEqual(await doNha(await maySach({ xuatVao: vao })), { cu: 1, hong: 0, rong: 0, muc: 2 });
  const vao2 = path.join(nha.mt.tam, 'xuat-vao2');
  fs.mkdirSync(vao2); fs.writeFileSync(path.join(vao2, 'viec-bo.json'), '{hỏng');
  assert.deepEqual(await doNha(await maySach({ xuatVao: vao2 })), { cu: 0, hong: 1, rong: 0, muc: 0 });
});
