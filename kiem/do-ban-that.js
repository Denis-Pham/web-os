// Bộ đo demo web app AI Personal OS (đề chung BRIEF-DEMO.md). Chạy trong trang: page.evaluate(nguyên tệp).
// Phần do1 + đối chứng giao diện lấy từ ~/dev/learning-ban-mau/kiem/do-ban-mau.js (Khuôn Hub).
(async () => {
  const ngu = ms => new Promise(r => setTimeout(r, ms));
  const $$ = (s, g = document) => [...g.querySelectorAll(s)];
  const hien = el => !!el && el.isConnected && el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) &&
    (r => r.width > 0 && r.height > 0)(el.getBoundingClientRect());
  const W0 = innerWidth; // chốt bề rộng đặt từ đầu
  const MACH = ['cos', 'hoc', 'y-tuong', 'tri-thuc', 'factory', 'sia', 'toa-an', 'tai-chinh', 'dau-tu', 'creator', 'nao-chung'];
  const MAN = ['chu', ...MACH];
  const KHOI = ['xai-duoc', 'cho-anh', 'suc-khoe', 'tien-do', 'agent', 'nhat-ky', 'chi-phi', 'lich'];
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
    d.soNho && d.soNho + ' chữ nhỏ ' + d.nho.join('|'), d.soTuongPhan && d.soTuongPhan + ' tương phản ' + d.tuongPhan.join('|'),
    d.anh.length && 'tiếng Anh ' + d.anh.join(',')].filter(Boolean).join('; ');

  const kq = { cheDo: matchMedia('(prefers-color-scheme: dark)').matches ? 'tối' : 'sáng', iw: innerWidth, ih: innerHeight,
    hong: [], doiChung: {}, khoiDuoiNep: [], cos: [] };
  const hong = s => kq.hong.push(s);
  const thu = async (ten, fn) => { try { await fn(); } catch (e) { hong(ten + ': ' + e.message); } };
  const D = window.DEMO;
  if (!D || typeof D.trangThai !== 'function' || typeof D.datLai !== 'function') return { ...kq, dat: false, hong: ['thiếu window.DEMO.trangThai/datLai'] };
  const S = () => JSON.stringify(D.trangThai());
  const toi = async m => { location.hash = '#' + m; await ngu(200); };
  const veCos = async () => { D.datLai(); await toi('chu'); await toi('cos'); };
  const nut = (act, g = document) => $$(`[data-act="${act}"]`, g).find(hien);
  // bấm như người: nút phải là thứ nằm trên cùng ở tâm của nó (lớp phủ che ⇒ trượt), soát chung 11/11 phát hiện 15
  const bamEl = async (b, ten) => {
    b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(), x = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    if (!x || !(x === b || b.contains(x))) throw Error('nút ' + ten + ' bị che'); b.click(); await ngu(200); };
  const bam = async (act, g) => { const b = nut(act, g); if (!b) throw Error('không thấy nút ' + act); await bamEl(b, act); };
  // ảnh chụp giao diện các dòng việc/lịch: phép đo đọc MÀN, không chỉ window.DEMO (soát chung 11/11 phát hiện 4/14)
  const dom = () => $$('[data-viec],[data-lich]').filter(hien).map(r => (r.dataset.viec ? 'v' + r.dataset.viec : 'l' + r.dataset.lich) + '|' +
    r.textContent.replace(/\s+/g, ' ').trim() + '|' + $$('[aria-pressed]', r).map(x => x.getAttribute('aria-pressed')).join()).join('\n');
  const coDong = (k, id) => $$(`[data-${k}="${id}"]`).some(hien);
  const dongCo = (k, chu) => $$(`[data-${k}]`).some(r => hien(r) && r.textContent.includes(chu));
  const dien = (ten, v) => {
    const i = $$(`input[name="${ten}"],textarea[name="${ten}"]`).find(hien); if (!i) throw Error('không thấy ô ' + ten);
    i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const hop = () => $$('[role="dialog"]').find(hien);
  const dongHop = async h => { const b = h && $$('button', h).find(x => hien(x) && x.textContent.trim() === 'Đóng'); if (b) { b.click(); await ngu(150); } };
  const doiDong = (a, b) => { let n = 0; for (const k of ['viec', 'lich']) {
    const A = new Map(a[k].map(x => [String(x.id), JSON.stringify(x)])), B = new Map(b[k].map(x => [String(x.id), JSON.stringify(x)]));
    for (const [id, v] of A) if (B.get(id) !== v) n++; for (const id of B.keys()) if (!A.has(id)) n++; } return n; };
  const dong1 = sel => { const r = $$(sel).find(hien); if (!r) throw Error('không có dòng ' + sel); return r; };
  const tim = (k, id) => D.trangThai()[k].find(x => String(x.id) === String(id));

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
    const a = D.trangThai(), b = JSON.parse(JSON.stringify(a));
    if (b.viec[0]) b.viec[0].tieu_de += '!'; if (b.lich[0]) b.lich[0].gio = '23:59';
    kq.doiChung.batDoiHaiDong = doiDong(a, b) === 2;
  });

  for (const m of MAN) await thu('màn ' + m, async () => {
    await toi(m); const g = document.querySelector(`[data-man="${m}"]`);
    if (!hien(g)) throw Error('không hiện');
    const khac = $$('[data-man]').filter(x => x !== g && hien(x)).length; if (khac) hong('màn ' + m + ': ' + khac + ' màn khác cùng hiện');
    const t = tomTat(do1()); if (t) hong('màn ' + m + ': ' + t);
    if (m !== 'chu' && !nut('hoi-ai')) hong('màn ' + m + ': thiếu nút Hỏi AI');
    const st = $$('[style]').length + $$('script:not([src])').length;  // CSP mục 5.8 chặn style= và script nội tuyến
    if (st) hong('màn ' + m + ': ' + st + ' chỗ style=/script nội tuyến');
  });

  await thu('8 khối', async () => {
    await toi('chu'); const rong = innerWidth >= 1280;
    for (const k of KHOI) {
      const el = document.querySelector(`[data-man="chu"] [data-khoi="${k}"]`);
      if (!el) { hong('thiếu khối ' + k); continue; }
      if (rong) {
        if (!hien(el)) hong('khối ' + k + ' không thấy ở màn rộng');
        else if (el.getBoundingClientRect().bottom > innerHeight) { kq.khoiDuoiNep.push(k); hong('khối ' + k + ' dưới nếp gấp ở màn rộng'); }
        continue;
      }
      // màn hẹp: khối thu gọn phải mở được, mở ra thì đo luôn phần bên trong (soát chung 11/11 phát hiện 5/16)
      const mo = () => $$(`[data-mo-khoi="${k}"]`).find(hien);
      if (!mo()) { if (!hien(el)) hong('khối ' + k + ' không thấy, không có nút mở'); continue; }
      const n0 = $$('*', el).filter(hien).length; await bamEl(mo(), 'mở ' + k);
      if ($$('*', el).filter(hien).length <= n0) hong('khối ' + k + ': bấm mở không hiện thêm gì');
      const t = tomTat(do1()); if (t) hong('khối ' + k + ' khi mở: ' + t);
      if (mo()) await bamEl(mo(), 'thu ' + k);
    }
  });

  await thu('lối vào', async () => {
    await toi('cos'); await toi('chu');
    const thieu = () => [...MACH.filter(m => !$$(`a[href="#${m}"]`).some(hien)), ...($$('[data-loi-sang="family"]').some(hien) ? [] : ['family'])];
    let t = thieu(); if (t.length && nut('mo-menu')) { await bam('mo-menu'); t = thieu(); }
    if (t.length) hong('thiếu lối vào: ' + t.join(','));
    await toi('cos'); await toi('chu');
  });

  const hoanTacVe = (ten, lam) => thu(ten, async () => {
    await veCos(); const s0 = S(), d0 = dom();
    await lam();
    if (S() === s0) throw Error('ghi không đổi dữ liệu');
    await dongHop(hop());
    if (dom() === d0) throw Error('giao diện không đổi sau khi ghi');
    await bam('hoan-tac');
    if (S() !== s0) throw Error('Hoàn tác không về y trạng thái trước');
    if (dom() !== d0) throw Error('giao diện sau Hoàn tác khác trước');
    kq.cos.push(ten);
  });
  await hoanTacVe('thêm việc', async () => {
    await bam('them-viec'); const t = tomTat(do1()); if (t) hong('form việc: ' + t);
    dien('tieu_de', 'Việc thử đo'); dien('han', '2026-11-20'); await bam('luu');
    if (!D.trangThai().viec.some(v => v.tieu_de === 'Việc thử đo')) throw Error('không thấy việc mới');
    if (!dongCo('viec', 'Việc thử đo')) throw Error('màn không hiện việc mới');
  });
  await hoanTacVe('sửa việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec; await bam('sua', r); dien('tieu_de', 'Đã sửa thử'); await bam('luu');
    if (tim('viec', id)?.tieu_de !== 'Đã sửa thử') throw Error('sửa sai dòng');
    if (!$$(`[data-viec="${id}"]`).some(x => hien(x) && x.textContent.includes('Đã sửa thử'))) throw Error('màn không hiện tên đã sửa');
  });
  await hoanTacVe('xoá việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec; await bam('xoa', r); if (tim('viec', id)) throw Error('chưa xoá');
    if (coDong('viec', id)) throw Error('màn còn dòng đã xoá');
  });
  await hoanTacVe('xong việc', async () => {
    const r = dong1('[data-viec]'), id = r.dataset.viec, truoc = tim('viec', id).xong; await bam('xong', r);
    if (tim('viec', id).xong === truoc) throw Error('xong không đổi');
  });
  await hoanTacVe('thêm lịch', async () => {
    await bam('them-lich'); dien('tieu_de', 'Lịch thử đo'); dien('ngay', '2026-11-20'); dien('gio', '09:30'); await bam('luu');
    if (!D.trangThai().lich.some(v => v.tieu_de === 'Lịch thử đo')) throw Error('không thấy lịch mới');
    if (!dongCo('lich', 'Lịch thử đo')) throw Error('màn không hiện lịch mới');
  });
  await hoanTacVe('sửa lịch', async () => {
    const r = dong1('[data-lich]'), id = r.dataset.lich; await bam('sua', r); dien('tieu_de', 'Lịch đã sửa'); await bam('luu');
    if (tim('lich', id)?.tieu_de !== 'Lịch đã sửa') throw Error('sửa sai dòng');
    if (!$$(`[data-lich="${id}"]`).some(x => hien(x) && x.textContent.includes('Lịch đã sửa'))) throw Error('màn không hiện tên đã sửa');
  });
  await hoanTacVe('xoá lịch', async () => {
    const r = dong1('[data-lich]'), id = r.dataset.lich; await bam('xoa', r); if (tim('lich', id)) throw Error('chưa xoá');
    if (coDong('lich', id)) throw Error('màn còn dòng đã xoá');
  });

  await thu('Hỏi AI', async () => {
    await veCos(); const s0 = D.trangThai(), j0 = JSON.stringify(s0);
    await bam('hoi-ai'); let h = hop(); if (!h) throw Error('không mở hộp');
    if (!$$('[data-de-xuat]', h).some(hien)) throw Error('không có đề xuất');
    const t = tomTat(do1()); if (t) hong('hộp AI: ' + t);
    if (S() !== j0) throw Error('hiện đề xuất đã ghi dữ liệu');
    await bam('bo-qua', h); if (S() !== j0) throw Error('Bỏ qua đổi dữ liệu');
    await dongHop(hop());
    await veCos(); const d0 = dom(); await bam('hoi-ai'); h = hop();
    const chuDX = ($$('[data-de-xuat]', h).find(hien) || {}).textContent || ''; await bam('ap-dung', h);
    const s1 = D.trangThai(), n = doiDong(s0, s1); if (n !== 1) throw Error('Áp dụng đổi ' + n + ' dòng (phải 1)');
    // dòng bị đổi phải là dòng đề xuất nói tên (soát chung 11/11 phát hiện 13)
    const sau = new Map([...s1.viec, ...s1.lich].map(x => [String(x.id), JSON.stringify(x)]));
    const doi = [...s0.viec, ...s0.lich].find(x => sau.get(String(x.id)) !== JSON.stringify(x));
    if (doi && !chuDX.includes(doi.tieu_de)) throw Error('Áp dụng đổi «' + doi.tieu_de + '», không phải dòng đề xuất nói');
    if (!nut('hoan-tac')) await dongHop(hop());
    if (dom() === d0) throw Error('Áp dụng: giao diện không đổi');
    await bam('hoan-tac'); if (S() !== j0) throw Error('Hoàn tác sau Áp dụng không về y trước');
    await dongHop(hop()); kq.cos.push('Hỏi AI');
  });
  // Góp ý 12/11: Não chung = ký ức (bản đồ ký ức + chỗ cho hai bản đồ kiến trúc); SIA và Toà án là mạch riêng, chỉ xem.
  await thu('Não chung', async () => {
    await toi('nao-chung'); const g = document.querySelector('[data-man="nao-chung"]');
    for (const p of ['ban-do-ky-uc', 'kien-truc-he-thong', 'kien-truc-du-lieu'])
      if (!$$(`[data-phan="${p}"]`, g).some(hien)) hong('Não chung thiếu phần ' + p);
    if ($$('[data-phan^="sia"],[data-phan^="toa-an"]', g).length) hong('Não chung còn phần SIA/Toà án (phải tách riêng)');
    const ky = () => $$('[data-ky-uc]', g).filter(hien), n0 = ky().length;
    if (n0 < 5) throw Error('bản đồ ký ức có ' + n0 + ' ký ức (phải ≥ 5)');
    const tu = ky()[n0 - 1].dataset.kyUc.split(' ')[0];
    dien('tim-ky-uc', tu); await ngu(100);
    const sau = ky();
    if (!sau.length || sau.length >= n0 || !sau.every(x => x.textContent.toLowerCase().includes(tu.toLowerCase())))
      hong('tìm ký ức không lọc («' + tu + '»: ' + n0 + ' ⇒ ' + sau.length + ')');
    dien('tim-ky-uc', ''); await ngu(100);
    if (ky().length !== n0) hong('xoá ô tìm không hiện lại đủ ký ức');
  });
  await thu('SIA và Toà án', async () => {
    const choPhep = new Set(['hoi-ai', 'mo-menu', 'dong-menu', 'hoan-tac']);
    for (const [m, phan, ten] of [['sia', 'sia-vu', 'SIA'], ['toa-an', 'toa-an-cho', 'Toà án']]) {
      await toi(m); const g = document.querySelector(`[data-man="${m}"]`);
      if (!g) { hong(ten + ' không có màn'); continue; }
      const p = $$(`[data-phan="${phan}"]`, g).find(hien); if (!p) { hong(ten + ' thiếu phần ' + phan); continue; }
      const ghi = $$('[data-act]', g).map(b => b.dataset.act).filter(a => !choPhep.has(a));
      if (ghi.length) hong(ten + ' có nút ghi: ' + ghi.join(','));
      if (m === 'sia' && !$$('[data-vu]', p).some(hien)) hong('SIA không có vụ nào hiện');
      if (m === 'toa-an' && !p.textContent.includes('Chưa xây')) hong('Toà án không ghi «Chưa xây»');
    }
  });
  // Đối chứng của phần chức năng nằm ở kiem/doi-chung.cjs: bản cố ý hỏng thật, mỗi bản phải trượt đúng lý do.

  D.datLai(); await toi('chu');
  kq.dat = kq.hong.length === 0 && Object.keys(kq.doiChung).length === 6 && Object.values(kq.doiChung).every(Boolean);
  return kq;
})()
