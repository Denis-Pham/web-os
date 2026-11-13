// Màn «Việc & lịch» (B2 lượt 2b): dữ liệu từ máy chủ thật qua cầu vé. Gieo đúng như brief: 5 việc (1 quá hạn, 1 hạn hôm nay, 1 đã xong, 2 hạn sau),
// 3 lịch hôm nay, 1 đề xuất ⇒ brief = 1/1/3/1. B2-Đ1 chuyển thể bộ đo CoS của demo (kiem/do-demo.js:140–175) sang trang thật;
// Đ2 brief khớp /api/brief; Đ3 Hoàn tác từng bước. Mỗi ca đối chứng cấy bản cố ý sai (chỉ khi DOI_CHUNG) ⇒ phải ĐỎ.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { moTrinh, dungMay, datBan, trangMoi, gieo, DOI_CHUNG } from './chung-web.mjs';
import { goi } from '../test-may-chu/chung.mjs';
import { taoDeXuat } from '../may-chu/goi.mjs';

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

async function moCos(fn) {
  const { ctx, page, loi, mang } = await trangMoi(trinh, m.url);
  page.setDefaultTimeout(5000);
  try {
    await page.goto(m.url + '/#cos');
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
