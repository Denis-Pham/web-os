// Bộ đo bản thật web-os (B4; chép từ web-os-demo@6f544d4 kiem/do-demo.js rồi vá). Chạy trong trang: page.evaluate(`(${src})(${JSON.stringify(cu)})`).
// CU = tên lỗ chạy biến thể CŨ (R6/K1, R7 ở lượt 4b; R8, R11 ở lượt 4c). CHE_DO 'het-phien' = chỉ đo màn Hết phiên đang hiện (chay-do.mjs gọi sau datVe(null)).
// CHE_DO 'url' (Pha C, chay-do.mjs --url) = trang thật CHỈ ĐỌC: không datLai/ghi/Hỏi AI; phép cần ghi hay dữ liệu gieo ⇒ bỏ, tên vào kq.bo.
// Trạng thái đọc qua API thật (trangThai/datLai), không còn window.DEMO. Phần do1 + đối chứng giao diện lấy từ ~/dev/learning-ban-mau/kiem/do-ban-mau.js (Khuôn Hub).
async (CU = [], CHE_DO = null) => {
  const ngu = ms => new Promise(r => setTimeout(r, ms));
  const $$ = (s, g = document) => [...g.querySelectorAll(s)];
  const hien = el => !!el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    (r => r.width > 0 && r.height > 0)(el.getBoundingClientRect());
  const W0 = innerWidth; // chốt bề rộng đặt từ đầu
  const MACH = ['cos', 'hoc', 'y-tuong', 'tri-thuc', 'factory', 'sia', 'toa-an', 'tai-chinh', 'dau-tu', 'creator', 'nao-chung'];
  const MAN = ['chu', ...MACH];
  const KHOI = ['lich_hom_nay', 'cho_anh', 'suc_khoe', 'xai_duoc', 'tien_do', 'chi_phi_token', 'nhat_ky', 'agent_dang_chay'];
  const TU_ANH = /\b(Add|Delete|Remove|Save|Cancel|Undo|Submit|Send|Back|Menu|Home|Settings|Next|Done|Close|Edit|Loading|Error|Apply|Skip|Dashboard|undefined|null|NaN)\b/g;
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const lum = c => { const f = v => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; const m = rgb(c); return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
  const nen = el => { for (let e = el; e; e = e.parentElement) { const b = getComputedStyle(e).backgroundColor, a = rgb(b); if (a.length === 3 || a[3] > 0.5) return b; } return matchMedia('(prefers-color-scheme: dark)').matches ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)'; };
  const tp = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const do1 = () => {
    const nut = $$('button,a[href],input:not([type=hidden]),select,textarea,[role=button],[data-act]').filter(hien)
      .filter(el => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; })
      .map(el => (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 20));
    const nho = new Set(), mo = new Set(); let chu = '';
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
    while ((n = w.nextNode())) {
      const t = n.textContent.trim(), p = n.parentElement; if (!t || !p || !hien(p)) continue;
      const cs = getComputedStyle(p), fs = parseFloat(cs.fontSize), san = p.closest('[data-phu]') ? 13 : 16;
      if (fs < san) nho.add(Math.round(fs) + 'px «' + t.slice(0, 18) + '»');
      if (tp(cs.color, nen(p)) < 4.5) mo.add('«' + t.slice(0, 18) + '»');
      if (!p.closest('[lang="en"]')) chu += ' ' + t;
    }
    $$('[placeholder],[aria-label],[title]').filter(hien).filter(el => !el.closest('[lang="en"]'))
      .forEach(el => ['placeholder', 'aria-label', 'title'].forEach(a => { const v = el.getAttribute(a); if (v) chu += ' ' + v; }));
    return { tran: document.documentElement.scrollWidth > W0, soNut: nut.length, nut: nut.slice(0, 3),
      soNho: nho.size, nho: [...nho].slice(0, 3), soTuongPhan: mo.size, tuongPhan: [...mo].slice(0, 3),
      anh: [...new Set(chu.match(TU_ANH) || [])] };
  };
  const tomTat = d => [d.tran && 'tràn ngang', d.soNut && d.soNut + ' nút <44 ' + d.nut.join('|'),
    d.soNho && d.soNho + ' chữ < 16 px ' + d.nho.join('|'), d.soTuongPhan && d.soTuongPhan + ' tương phản ' + d.tuongPhan.join('|'),
    d.anh.length && 'tiếng Anh ' + d.anh.join(',')].filter(Boolean).join('; ');
  // CSP mục 5.8 chặn style= và script nội tuyến
  const noiTuyen = () => [$$('[style]').length && $$('[style]').length + ' chỗ style= nội tuyến',
    $$('script:not([src])').length && $$('script:not([src])').length + ' chỗ script nội tuyến'].filter(Boolean).join('; ');

  const kq = { cheDo: matchMedia('(prefers-color-scheme: dark)').matches ? 'tối' : 'sáng', iw: innerWidth, ih: innerHeight,
    hong: [], doiChung: {}, khoiDuoiNep: [], cos: [], bo: [] };
  const hong = s => kq.hong.push(s);
  const chiDoc = CHE_DO === 'url', boQua = s => kq.bo.push(s);
  const thu = async (ten, fn) => { try { await fn(); } catch (e) { hong(ten + ': ' + e.message); } };

  // Màn Hết phiên (vé đã bị bỏ ở cầu): chỉ đo giao diện của màn đó.
  if (CHE_DO === 'het-phien') {
    const g = document.querySelector('#noi-dung > section[data-man="het-phien"]');
    if (!hien(g)) hong('màn Hết phiên không hiện');
    const khac = $$('[data-man]').filter(x => x !== g && hien(x)).length; if (khac) hong('màn Hết phiên: ' + khac + ' màn khác cùng hiện');
    const t = tomTat(do1()); if (t) hong('màn Hết phiên: ' + t);
    const st = noiTuyen(); if (st) hong('màn Hết phiên: ' + st);
    return { ...kq, dat: kq.hong.length === 0 };
  }

  // Mọi fetch của trang đếm ở đây để chờ trang yên (ghi ⇒ tải lại là bất đồng bộ, khác demo đồng bộ).
  let dangGoi = 0; const fetchGoc = window.fetch;
  window.fetch = function (...a) { dangGoi++; return fetchGoc.apply(this, a).finally(() => { dangGoi--; }); };
  const cho = async (f, ms = 5000) => { for (const t = Date.now(); !f(); await ngu(25)) if (Date.now() - t > ms) return false; return true; };
  const yen = async () => { let on = 0; for (const t = Date.now(); on < 4 && Date.now() - t < 5000; await ngu(20)) on = dangGoi ? 0 : on + 1; };
  // Hộp/ngăn vừa mở còn chạy hiệu ứng (hien-hop 160 ms, nen.css:74) ⇒ do1 đo giữa chừng ra cao 44 ± 3e-5 ⇒ «nút <44» chập chờn (task-3-sua1-report).
  // Chờ mọi hiệu ứng của trang xong rồi mới đo; hạn 1 s để hiệu ứng vô hạn không treo. KHÔNG nới phép so 44.
  const choHieuUng = async () => { const a = document.documentElement.getAnimations({ subtree: true });
    if (a.length) await Promise.race([Promise.allSettled(a.map(x => x.finished)), ngu(1000)]); };

  // Trạng thái qua API thật (thay window.DEMO): bỏ phien_ban, sua_luc (ghi/Hoàn tác tăng chúng).
  const hom = (them = 0) => new Date(Date.now() + 7 * 3600e3 + them * 864e5).toISOString().slice(0, 10);   // ngày giờ VN
  const LICH = `/api/lich?tu=${hom(-30)}&den=${hom(31)}`;
  const lay = async u => { const r = await fetch(u, { cache: 'no-store', redirect: 'manual' }); if (!r.ok) throw Error('GET ' + u + ' ' + r.status); return r.json(); };
  const gui = async (u, than) => { const r = await fetch(u, { method: 'POST', redirect: 'manual', headers: { 'X-WebOS': '1', 'Content-Type': 'application/json' }, body: JSON.stringify(than) });
    if (!r.ok) throw Error('POST ' + u + ' ' + r.status + ' ' + (await r.text()).slice(0, 120)); return r.json(); };
  const bo = ({ phien_ban, sua_luc, ...x }) => x;
  const trangThai = async () => ({ viec: (await lay('/api/viec')).viec.map(bo), lich: (await lay(LICH)).lich.map(bo), de_xuat: (await lay('/api/de-xuat')).de_xuat.map(bo) });
  const BO_CHUAN = () => [
    { loai: 'them', bang: 'viec', truong: { tieu_de: 'Gửi báo cáo tuần', han: hom(0) } },
    { loai: 'them', bang: 'viec', truong: { tieu_de: 'Đặt lịch khám răng', han: hom(4) } },
    { loai: 'them', bang: 'viec', truong: { tieu_de: 'Đọc lại ghi chú họp', han: hom(9), ghi_chu: 'Ghi ba ý chính' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Họp nhóm sáng', bat_dau: hom(0) + 'T09:00', ca_ngay: 0, dia_diem: 'Phòng họp nhỏ' } },
    { loai: 'them', bang: 'lich', truong: { tieu_de: 'Sinh nhật mẹ', bat_dau: hom(5), ca_ngay: 1 } },
  ];
  // Xoá mềm mọi dòng việc/lịch hiện có, bỏ qua đề xuất đang chờ, rồi gieo lại bộ chuẩn — một gói POST /api/goi.
  const datLai = async () => {
    for (const d of (await lay('/api/de-xuat')).de_xuat) await gui(`/api/de-xuat/${d.id}/bo-qua`, {});
    const v = (await lay('/api/viec')).viec, l = (await lay(LICH)).lich;
    await gui('/api/goi', { khoa_lap: crypto.randomUUID(), ops: [...v.map(x => ({ loai: 'xoa', bang: 'viec', id: x.id, phien_ban: x.phien_ban })),
      ...l.map(x => ({ loai: 'xoa', bang: 'lich', id: x.id, phien_ban: x.phien_ban })), ...BO_CHUAN()] });
  };
  const S = async () => JSON.stringify(await trangThai());
  const DL = s => JSON.stringify([s.viec, s.lich]);   // chỉ dữ liệu việc/lịch (đề xuất chờ tính riêng)
  const toi = async m => { location.hash = '#' + m; await cho(() => document.querySelector(`#noi-dung > section[data-man="${m}"]`) &&
    (m !== 'cos' || document.querySelector('[data-man="cos"] [data-brief]'))); await yen(); };
  const veCos = async () => { await datLai(); await toi('chu'); await toi('cos'); };
  const nut = (act, g = document) => $$(`[data-act="${act}"]`, g).find(hien);
  // bấm như người: nút phải là thứ nằm trên cùng ở tâm của nó (lớp phủ che ⇒ trượt), soát chung 11/11 phát hiện 15
  const bamEl = async (b, ten) => {
    b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!x || !(x === b || b.contains(x))) throw Error('nút bị che: ' + ten); b.click(); await yen(); };
  const bam = async (act, g) => { const b = nut(act, g); if (!b) throw Error('không thấy nút ' + act); await bamEl(b, act); };
  // ảnh chụp giao diện các dòng việc/lịch: phép đo đọc MÀN, không chỉ trạng thái (soát chung 11/11 phát hiện 4/14)
  const dom = () => $$('[data-viec],[data-lich]').filter(hien).map(r => (r.dataset.viec ? 'v' + r.dataset.viec : 'l' + r.dataset.lich) + '|' +
    r.textContent.replace(/\s+/g, ' ').trim() + '|' + $$('[aria-pressed]', r).map(x => x.getAttribute('aria-pressed')).join()).join('\n');
  const coDong = (k, id) => $$(`[data-${k}="${id}"]`).some(hien);
  const dongCo = (k, chu) => $$(`[data-${k}]`).some(r => hien(r) && r.textContent.includes(chu));
  const dien = (ten, v) => {
    const i = $$(`input[name="${ten}"],textarea[name="${ten}"]`).find(hien); if (!i) throw Error('không thấy ô ' + ten);
    i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const hop = () => $$('[role="dialog"],dialog[open]').find(hien);
  const dongHop = async h => { const b = h && $$('button', h).find(x => hien(x) && x.textContent.trim() === 'Đóng'); if (b) { b.click(); await ngu(150); } };
  const doiDong = (a, b) => { let n = 0; for (const k of ['viec', 'lich']) {
    const A = new Map(a[k].map(x => [String(x.id), JSON.stringify(x)])), B = new Map(b[k].map(x => [String(x.id), JSON.stringify(x)]));
    for (const [id, v] of A) if (B.get(id) !== v) n++; for (const id of B.keys()) if (!A.has(id)) n++; } return n; };
  const dong1 = sel => { const r = $$(sel).find(hien); if (!r) throw Error('không có dòng ' + sel); return r; };
  const tim = async (k, id) => (await trangThai())[k].find(x => String(x.id) === String(id));

  await thu('gieo bộ chuẩn', async () => { if (!chiDoc) await datLai(); await toi('cos'); await toi('chu'); });
  // trang thật: phiên Access hợp lệ (GET /api/phien có email + het_luc)
  if (chiDoc) await thu('phiên', async () => { const p = await lay('/api/phien'); if (!p.email || !p.het_luc) throw Error('/api/phien thiếu email/het_luc'); });

  // Đối chứng: phép đo phải bắt được bản cố ý hỏng
  await thu('đối chứng', async () => {
    await toi('chu');
    const d = document.createElement('div'); d.style.minWidth = (W0 + 300) + 'px'; d.textContent = 'x'; document.body.append(d);
    kq.doiChung.batTran = do1().tran; d.remove();
    const s = document.createElement('span'); s.setAttribute('role', 'button');
    s.style.cssText = 'display:inline-block;width:20px;height:20px;font-size:12px;color:#bbb;background:#fff'; s.textContent = 'Save';
    document.body.prepend(s); const dc = do1(); s.remove();
    kq.doiChung.batNutNho = dc.nut.some(x => x.startsWith('Save'));
    kq.doiChung.batChuNho = dc.nho.some(x => x.includes('Save'));
    kq.doiChung.batTuongPhan = dc.tuongPhan.some(x => x.includes('Save'));
    kq.doiChung.batTiengAnh = dc.anh.includes('Save');
    // trang thật: kho có thể trống ⇒ phép so hai dòng đo trên trạng thái dựng sẵn
    const a = chiDoc ? { viec: [{ id: 1, tieu_de: 'a' }], lich: [{ id: 1, gio: '09:00' }], de_xuat: [] } : await trangThai(), b = JSON.parse(JSON.stringify(a));
    if (b.viec[0]) b.viec[0].tieu_de += '!'; if (b.lich[0]) b.lich[0].gio = '23:59';
    kq.doiChung.batDoiHaiDong = doiDong(a, b) === 2;
  });

  for (const m of MAN) await thu('màn ' + m, async () => {
    await toi(m); const g = document.querySelector(`#noi-dung > section[data-man="${m}"]`);
    if (!hien(g)) throw Error('không hiện');
    const khac = $$('[data-man]').filter(x => x !== g && hien(x)).length; if (khac) hong('màn ' + m + ': ' + khac + ' màn khác cùng hiện');
    const t = tomTat(do1()); if (t) hong('màn ' + m + ': ' + t);
    if (m === 'cos' && !nut('hoi-ai')) hong('màn ' + m + ': thiếu nút Hỏi AI');
    const st = noiTuyen(); if (st) hong('màn ' + m + ': ' + st);
  });

  await thu('8 khối', async () => {
    await toi('chu'); const rong = innerWidth >= 1280;
    for (const k of KHOI) {
      const el = document.querySelector(`[data-man="chu"] [data-khoi="${k}"]`);
      if (!el) { hong('thiếu khối ' + k); continue; }
      if (rong) {
        if (!hien(el)) hong('khối ' + k + ' không thấy ở màn rộng');
        else if (el.getBoundingClientRect().bottom > innerHeight) { kq.khoiDuoiNep.push(k); hong('khối dưới nếp gấp ở màn rộng: ' + k); }
        continue;
      }
      // màn hẹp: khối gập phải mở được, mở ra thì đo luôn phần bên trong (soát chung 11/11 phát hiện 5/16)
      const gap = mo => $$('[data-act="gap"]', el).find(b => hien(b) && b.getAttribute('aria-expanded') === String(mo));
      if (!gap(false)) { if (!hien(el)) hong('khối ' + k + ' không thấy, không có nút mở'); continue; }
      const n0 = $$('*', el).filter(hien).length; await bamEl(gap(false), 'mở ' + k); await choHieuUng();
      if ($$('*', el).filter(hien).length <= n0) hong('khối ' + k + ': bấm mở không hiện thêm gì');
      const t = tomTat(do1()); if (t) hong('khối ' + k + ' khi mở: ' + t);
      if (gap(true)) await bamEl(gap(true), 'gập ' + k);
    }
  });

  await thu('lối vào', async () => {
    await toi('cos'); await toi('chu');
    const thieu = () => [...MACH.filter(m => !$$(`a[href="#${m}"]`).some(hien)), ...($$('#lk-hub').some(hien) ? [] : ['family'])];
    let t = thieu(); if (t.length && nut('mo-menu')) { await bam('mo-menu'); t = thieu(); }
    if (t.length) hong('thiếu lối vào: ' + t.join(','));
    if (document.body.classList.contains('mo-menu')) { nut('dong-menu')?.click(); await ngu(150); }
    await toi('cos'); await toi('chu');
  });

  const hoanTacVe = (ten, lam) => chiDoc ? boQua(ten + ' + Hoàn tác · cần ghi') : thu(ten, async () => {
    await veCos(); const s0 = await S(), d0 = dom();
    await lam();
    if (await S() === s0) throw Error('ghi không đổi dữ liệu');
    await dongHop(hop());
    if (dom() === d0) throw Error('giao diện không đổi sau khi ghi');
    await bam('hoan-tac');
    if (await S() !== s0) throw Error('Hoàn tác không về y trạng thái trước');
    if (dom() !== d0) throw Error('giao diện sau Hoàn tác khác trước');
    kq.cos.push(ten);
  });
  await hoanTacVe('thêm việc', async () => {
    await bam('them-viec'); await choHieuUng(); const t = tomTat(do1()); if (t) hong('form việc: ' + t);
    dien('tieu_de', 'Việc thử đo'); dien('han', hom(7)); await bam('luu');
    if (!(await trangThai()).viec.some(v => v.tieu_de === 'Việc thử đo')) throw Error('không thấy việc mới');
    if (!dongCo('viec', 'Việc thử đo')) throw Error('màn không hiện việc mới');
  });
  await hoanTacVe('sửa việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec; await bam('sua', r); dien('tieu_de', 'Đã sửa thử'); await bam('luu');
    if ((await tim('viec', id))?.tieu_de !== 'Đã sửa thử') throw Error('sửa sai dòng');
    if (!$$(`[data-viec="${id}"]`).some(x => hien(x) && x.textContent.includes('Đã sửa thử'))) throw Error('màn không hiện tên đã sửa');
  });
  await hoanTacVe('xoá việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec; await bam('xoa', r); if (await tim('viec', id)) throw Error('chưa xoá');
    if (coDong('viec', id)) throw Error('màn còn dòng đã xoá');
  });
  await hoanTacVe('xong việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec, truoc = (await tim('viec', id)).xong_luc; await bam('xong', r);
    if ((await tim('viec', id)).xong_luc === truoc) throw Error('xong không đổi');
  });
  await hoanTacVe('thêm lịch', async () => {
    await bam('them-lich'); dien('tieu_de', 'Lịch thử đo'); dien('ngay', hom(7)); dien('gio', '09:30'); await bam('luu');
    if (!(await trangThai()).lich.some(v => v.tieu_de === 'Lịch thử đo')) throw Error('không thấy lịch mới');
    if (!dongCo('lich', 'Lịch thử đo')) throw Error('màn không hiện lịch mới');
  });
  await hoanTacVe('sửa lịch', async () => {
    const r = dong1('[data-lich]'), id = r.dataset.lich; await bam('sua', r); dien('tieu_de', 'Lịch đã sửa'); await bam('luu');
    if ((await tim('lich', id))?.tieu_de !== 'Lịch đã sửa') throw Error('sửa sai dòng');
    if (!$$(`[data-lich="${id}"]`).some(x => hien(x) && x.textContent.includes('Lịch đã sửa'))) throw Error('màn không hiện tên đã sửa');
  });
  await hoanTacVe('xoá lịch', async () => {
    const r = dong1('[data-lich]'), id = r.dataset.lich; await bam('xoa', r); if (await tim('lich', id)) throw Error('chưa xoá');
    if (coDong('lich', id)) throw Error('màn còn dòng đã xoá');
  });

  // R6 + K1 (một phép so, lượt 4b): kỳ vọng = trạng thái trước Áp dụng với ĐÚNG viec[op.id].han = op.truong.han (ops đọc từ /api/de-xuat);
  // sau Áp dụng so SÂU theo id: tập id việc + lịch phải trùng (K1), mọi trường nội dung phải trùng (R6). trangThai() đã bỏ phien_ban, sua_luc.
  const khoaDong = x => JSON.stringify(Object.keys(x).sort().map(k => [k, x[k]]));
  const soApDung = (truoc, ops, sau) => {
    const ky = { viec: truoc.viec.map(x => ({ ...x })), lich: truoc.lich.map(x => ({ ...x })) };
    for (const op of ops) {
      const v = op.loai === 'sua' && op.bang === 'viec' && Object.keys(op.truong ?? {}).join() === 'han' && ky.viec.find(x => String(x.id) === String(op.id));
      if (!v) throw Error('đề xuất có thao tác phép so không nhận (chỉ sửa hạn việc có sẵn): ' + JSON.stringify(op).slice(0, 100));
      v.han = op.truong.han;
    }
    const bang = k => [new Map(ky[k].map(x => [String(x.id), khoaDong(x)])), new Map(sau[k].map(x => [String(x.id), khoaDong(x)]))];
    for (const k of ['viec', 'lich']) { const [A, B] = bang(k); if (A.size !== B.size || [...A.keys()].some(id => !B.has(id))) throw Error('Áp dụng thêm/bớt dòng'); }
    for (const k of ['viec', 'lich']) { const [A, B] = bang(k); for (const [id, v] of A) if (B.get(id) !== v) throw Error('Áp dụng sai giá trị hạn'); }
  };
  if (chiDoc) boQua('R6/K1 Hỏi AI + Áp dụng · cần ghi + goiAI giả');
  else await thu('Hỏi AI', async () => {
    await veCos(); const s0 = await trangThai(), j0 = DL(s0);
    await bam('hoi-ai');
    // dữ liệu trước, hộp sau: hộp tự ghi rồi tự đóng vẫn phải báo đúng lỗi ghi
    if (DL(await trangThai()) !== j0) throw Error('hiện đề xuất đã ghi dữ liệu');
    let h = hop(); if (!h) throw Error('không mở hộp');
    if (!$$('[data-de-xuat]', h).some(hien)) throw Error('không có đề xuất');
    await choHieuUng(); const t = tomTat(do1()); if (t) hong('hộp AI: ' + t);
    await bam('bo-qua', h); if (DL(await trangThai()) !== j0) throw Error('Bỏ qua đổi dữ liệu');
    await dongHop(hop());
    await veCos(); const s0b = await trangThai(), d0 = dom(); await bam('hoi-ai'); h = hop();
    const li = h && $$('[data-de-xuat]', h).find(hien); if (!li) throw Error('không có đề xuất để Áp dụng');
    const chuDX = li.textContent, dx = (await lay('/api/de-xuat')).de_xuat.find(d => String(d.id) === li.dataset.deXuat);
    if (!dx) throw Error('đề xuất trên hộp không có ở /api/de-xuat');
    await bam('ap-dung', li);
    const s1 = await trangThai();
    if (CU.includes('R6') || CU.includes('K1')) {
      // CŨ (demo :180–187): đếm doiDong === 1 + tên dòng trong chữ đề xuất — lọt sai giá trị hạn (R6) và dòng thêm cùng tên (K1).
      const n = doiDong(s0b, s1); if (n !== 1) throw Error('Áp dụng đổi ' + n + ' dòng (phải 1)');
      // dòng bị đổi phải là dòng đề xuất nói tên (soát chung 11/11 phát hiện 13)
      const sau = new Map([...s1.viec, ...s1.lich].map(x => [String(x.id), JSON.stringify(x)]));
      const doi = [...s0b.viec, ...s0b.lich].find(x => sau.get(String(x.id)) !== JSON.stringify(x));
      if (doi && !chuDX.includes(doi.tieu_de)) throw Error('Áp dụng đổi «' + doi.tieu_de + '», không phải dòng đề xuất nói');
    } else soApDung(s0b, dx.ops, s1);
    if (!nut('hoan-tac')) await dongHop(hop());
    if (dom() === d0) throw Error('Áp dụng: giao diện không đổi');
    await bam('hoan-tac'); if (DL(await trangThai()) !== DL(s0b)) throw Error('Hoàn tác sau Áp dụng không về y trước');
    await dongHop(hop()); kq.cos.push('Hỏi AI');
  });
  // R11 (lượt 4c): mọi input[type=date] của form việc/lịch (thêm + sửa, mở form thật) có min="2000-01-01" và max="2100-12-31" (miền laNgay);
  // goiAI giả đổi sang hạn 2101-01-01 (móc __aiNgoaiMien của chay-do.mjs) ⇒ sau Hỏi AI hộp mở mà không có đề xuất mới, dữ liệu không đổi;
  // datLai() sau đó (phép sau không thấy đề xuất thừa). CŨ (CU R11): không kiểm.
  if (chiDoc) { boQua('R11 ô ngày · cần dòng việc/lịch gieo, nút ghi'); boQua('R11 đề xuất ngoài miền · cần ghi + goiAI giả'); }
  else if (!CU.includes('R11')) {
    await thu('R11 ô ngày', async () => {
      await veCos();
      for (const [ten, mo] of [['thêm việc', () => bam('them-viec')], ['sửa việc', () => bam('sua', dong1('[data-viec]'))],
        ['thêm lịch', () => bam('them-lich')], ['sửa lịch', () => bam('sua', dong1('[data-lich]'))]]) {
        await mo(); const h = hop(); if (!h) throw Error('form ' + ten + ' không mở');
        const o = $$('input[type="date"]', h); if (!o.length) throw Error('form ' + ten + ' không có ô ngày');
        for (const i of o) if (i.getAttribute('min') !== '2000-01-01' || i.getAttribute('max') !== '2100-12-31')
          hong(`ô ngày thiếu min/max: form ${ten}, ô ${i.name} (min=${i.getAttribute('min')}, max=${i.getAttribute('max')})`);
        await bam('huy', h); await choHieuUng(); if (hop()) throw Error('form ' + ten + ': Huỷ không đóng hộp');
      }
    });
    await thu('R11 đề xuất ngoài miền', async () => {
      if (typeof window.__aiNgoaiMien !== 'function') throw Error('thiếu móc __aiNgoaiMien của chay-do.mjs');
      await veCos(); const s0 = await trangThai(), id0 = JSON.stringify(s0.de_xuat.map(d => d.id));
      await window.__aiNgoaiMien(true);
      try {
        try { await bam('hoi-ai'); } finally { await window.__aiNgoaiMien(false); }
        const h = hop(); if (!h) throw Error('không mở hộp');
        const s1 = await trangThai();
        if (JSON.stringify(s1.de_xuat.map(d => d.id)) !== id0 || $$('[data-de-xuat]', h).filter(hien).length !== s0.de_xuat.length || DL(s1) !== DL(s0))
          throw Error('đề xuất ngoài miền hiện ra');
      } finally { await dongHop(hop()); await datLai(); }
    });
  }
  // R7 (lượt 4b): màn chỉ xem = chu + 10 màn mach.js + nhóm Việc nhà. Bấm MỌI button, [role=button], input, [data-act] hiện (trừ ☰, Hỏi AI,
  // Hoàn tác, liên kết thanh trái; [data-act] từ vòng sửa 1: bộ nghe chung giao-dien.js chạy hành động cho MỌI phần tử mang nó), đóng hộp sau
  // mỗi cú bấm, rồi so việc + lịch + nhật ký trước/sau. Đề xuất chờ không so (ruling 4b, như Hỏi AI).
  // /api/nhat-ky trả ≤ 200 dòng ⇒ «số nhật ký» = số dòng kèm id mới nhất (đếm trần 200 không đổi khi thêm dòng).
  // Trang thật (chiDoc, Pha C Task 5 L2): /api/nhat-ky là cửa sổ trượt 24 giờ (may-chu/api.mjs:90–93) ⇒ dòng cũ trôi ra giữa hai lần chụp làm số dòng
  // giảm (đỏ-sai); ghi từ trang đã bị chanGhi chặn và vào `ghi` ⇒ chỉ so id mới nhất (dòng mới đổi nó, dòng trôi ra thì không).
  const soNhatKy = async () => { const n = (await lay('/api/nhat-ky')).nhat_ky, id = n[0]?.id ?? 0; return chiDoc ? String(id) : n.length + ':' + id; };
  const anhR7 = async () => DL(await trangThai()) + '|' + await soNhatKy();
  const BO_R7 = '[data-act="mo-menu"],[data-act="hoi-ai"],[data-act="hoan-tac"],#cac-mach *';
  const bamHet = async (goc, ve, ten) => {   // goc() hỏi lại mỗi vòng: cú bấm có thể vẽ lại màn
    for (let i = 0; ; i++) {
      const ds = $$('button,[role=button],input,[data-act]', goc()).filter(b => hien(b) && !b.matches(BO_R7));
      if (i >= ds.length) return;
      if (i >= 60) throw Error(ten + ': quá 60 nút');
      await bamEl(ds[i], (ds[i].getAttribute('aria-label') || ds[i].textContent || ds[i].tagName).trim().slice(0, 20));
      await dongHop(hop()); await ve();
    }
  };
  if (!CU.includes('R7')) await thu('màn chỉ xem', async () => {
    for (const m of MAN.filter(x => x !== 'cos')) {
      await toi(m); const a0 = await anhR7();
      await bamHet(() => document, async () => { if (location.hash !== '#' + m) await toi(m); }, 'màn ' + m);
      if (await anhR7() !== a0) hong('màn chỉ xem đổi trạng thái: ' + m);
    }
    // Nhóm Việc nhà luôn vẽ cùng lượt với [data-brief] mà toi('cos') đợi (web/viec-lich.js:35–38, :48–51; «chưa nối» vẫn trong nhóm) ⇒ vắng = hỏng,
    // cả ở trang thật.
    await toi('cos'); const g = () => document.querySelector('[data-man="cos"] [data-nhom="viec-nha"]');
    if (!hien(g())) { hong('thiếu nhóm Việc nhà'); return; }
    // chay-do chế độ cũ dựng máy với viec-bo.json mẫu (vòng sửa 1) ⇒ thiếu dòng = hỏng; trang thật (Pha C Task 5 L3) chưa có dòng ⇒ bỏ.
    if (!$$('[data-viec-bo]', g()).some(hien)) { if (chiDoc) boQua('R7 nhóm Việc nhà · trang thật không có dòng Việc nhà'); else hong('thiếu dòng Việc nhà'); return; }
    const a0 = await anhR7();
    await bamHet(g, async () => { if (location.hash !== '#cos') await toi('cos'); }, 'nhóm Việc nhà');
    if (await anhR7() !== a0) hong('màn chỉ xem đổi trạng thái: nhóm Việc nhà');
  });
  // CŨ (CU R7; demo :206–216, SIA/Toà án): màn chỉ xem không có nút ghi — dò tên data-act. Lọt nút ghi không mang data-act.
  else await thu('màn chỉ xem', async () => {
    const choPhep = new Set(['hoi-ai', 'mo-menu', 'dong-menu', 'hoan-tac', 'gap']);
    for (const m of MAN.filter(x => x !== 'cos')) {
      await toi(m); const g = document.querySelector(`#noi-dung > section[data-man="${m}"]`);
      const ghi = $$('[data-act]', g).map(b => b.dataset.act).filter(a => !choPhep.has(a));
      if (ghi.length) hong('màn ' + m + ' có nút ghi: ' + ghi.join(','));
    }
    await toi('cos'); const g = document.querySelector('[data-man="cos"] [data-nhom="viec-nha"]');
    if (!hien(g)) hong('thiếu nhóm Việc nhà');
    const ghi = g ? $$('[data-act]', g).map(b => b.dataset.act) : [];
    if (ghi.length) hong('nhóm Việc nhà có nút ghi: ' + ghi.join(','));
  });
  // Đối chứng của phần chức năng nằm ở kiem/doi-chung.mjs: bản cố ý hỏng thật, mỗi bản phải trượt đúng lý do.

  if (!chiDoc) await thu('trả bộ chuẩn', async () => { await datLai(); await toi('cos'); await toi('chu'); });
  window.fetch = fetchGoc;
  kq.dat = kq.hong.length === 0 && Object.keys(kq.doiChung).length === 6 && Object.values(kq.doiChung).every(Boolean);
  return kq;
}
