/* ZxT — offline P&L journal. All data lives in this device's localStorage. */
(function () {
  'use strict';

  const KEY = 'zxt.trades.v1';
  const TYPE_KEY = 'zxt.lastType';
  const TYPES = ['GXT', 'IFVG'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON3 = MONTHS.map((m) => m.slice(0, 3));

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------------------------------------------------------------- storage */
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter(validTrade) : [];
    } catch (e) {
      return [];
    }
  }
  function validTrade(t) {
    return t && typeof t.id === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
      typeof t.pnl === 'number' && isFinite(t.pnl) && TYPES.includes(t.type);
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(trades));
      return true;
    } catch (e) {
      toast("Couldn't save — storage is full or blocked.", 'err');
      return false;
    }
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  let trades = load();

  /* ---------------------------------------------------------------- helpers */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const mondayOf = (d) => addDays(d, -((d.getDay() + 6) % 7));
  const round2 = (v) => Math.round(v * 100) / 100;

  function isoWeek(d) {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil(((t - y0) / 86400000 + 1) / 7);
  }

  function money(v, compact) {
    v = round2(v);
    if (v === 0) return '$0';
    const abs = Math.abs(v);
    const sign = v < 0 ? '-' : '+';
    let body;
    if (compact && abs >= 1000) {
      const k = abs / 1000;
      body = String(parseFloat(k.toFixed(k >= 10 ? 0 : 1))) + 'k';
    } else if (Number.isInteger(abs)) {
      body = abs.toLocaleString('en-US');
    } else {
      body = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return sign + '$' + body;
  }

  /** Same as money(v, true) but wraps the "$" so phones can hide it inside tiny day boxes. */
  function moneyCell(v) {
    const m = money(v, true);
    if (m === '$0') return '<span class="cu">$</span>0';
    return m.charAt(0) + '<span class="cu">$</span>' + m.slice(2);
  }
  const tone = (v) => { v = round2(v); return v > 0 ? 'pos' : v < 0 ? 'neg' : 'zero'; };
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  /** "-50", "+150", "$150", "-$50", "1,250.5", unicode minus → number or NaN */
  function parsePnl(raw) {
    const s = String(raw).replace(/[−–—]/g, '-').replace(/[\s$,]/g, '');
    if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(s)) return NaN;
    return round2(Number(s));
  }

  function statsOf(list) {
    const count = list.length;
    const wins = list.filter((t) => t.pnl > 0).length;
    const losses = list.filter((t) => t.pnl < 0).length;
    return {
      pnl: round2(list.reduce((a, t) => a + t.pnl, 0)),
      count, wins, losses,
      winRate: count ? Math.round((wins / count) * 100) : null,
    };
  }

  /* ---------------------------------------------------------------- toasts */
  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || 'ok');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('hide'); setTimeout(() => el.remove(), 450); }, kind === 'err' ? 5000 : 2600);
  }

  /* ---------------------------------------------------------------- state */
  const now0 = new Date();
  let view = { y: now0.getFullYear(), m: now0.getMonth() }; // m: 0-11

  /* ---------------------------------------------------------------- render */
  function byDayMap() {
    const map = {};
    trades.forEach((t) => { (map[t.date] = map[t.date] || []).push(t); });
    return map;
  }

  function render() {
    const todayKey = ymd(new Date());
    const byDay = byDayMap();
    const monthKey = view.y + '-' + pad(view.m + 1);
    const isCurrent = monthKey === todayKey.slice(0, 7);

    $('#month-label').innerHTML = MONTHS[view.m] + ' <span>' + view.y + '</span>';
    $('#go-today').hidden = isCurrent;

    // ---- stats
    const monthTrades = trades.filter((t) => t.date.startsWith(monthKey));
    const ms = statsOf(monthTrades);
    const dayTotals = {};
    monthTrades.forEach((t) => { dayTotals[t.date] = round2((dayTotals[t.date] || 0) + t.pnl); });
    const totals = Object.values(dayTotals);
    const best = totals.length ? Math.max(...totals) : null;
    const worst = totals.length ? Math.min(...totals) : null;

    const wkStart = mondayOf(new Date());
    const wkA = ymd(wkStart), wkB = ymd(addDays(wkStart, 6));
    const ws = statsOf(trades.filter((t) => t.date >= wkA && t.date <= wkB));

    $('#stats').innerHTML = `
      <div class="card stat">
        <span class="label">${MONTHS[view.m]} P&amp;L</span>
        <strong class="value ${tone(ms.pnl)}">${money(ms.pnl)}</strong>
        <span class="sub">${best !== null
          ? `Best <b class="pos">${money(best)}</b> · Worst <b class="neg">${money(worst)}</b>`
          : 'No trades yet this month'}</span>
      </div>
      <div class="card stat">
        <span class="label">This week</span>
        <strong class="value ${tone(ws.pnl)}">${money(ws.pnl)}</strong>
        <span class="sub">${plural(ws.count, 'trade')} · Mon–Sun</span>
      </div>
      <div class="card stat">
        <span class="label">Win rate</span>
        <strong class="value">${ms.winRate !== null ? ms.winRate + '%' : '—'}</strong>
        <span class="sub"><b class="pos">${ms.wins}W</b> · <b class="neg">${ms.losses}L</b></span>
      </div>
      <div class="card stat">
        <span class="label">Trades</span>
        <strong class="value">${ms.count}</strong>
        <span class="sub">in ${MONTHS[view.m]}</span>
      </div>`;

    // ---- calendar (Mon → Sun rows + weekly total column)
    const first = new Date(view.y, view.m, 1, 12);
    const last = new Date(view.y, view.m + 1, 0, 12);
    let cursor = mondayOf(first);
    const end = addDays(mondayOf(last), 6);
    let html = '';
    while (cursor <= end) {
      const weekNo = isoWeek(cursor);
      let wPnl = 0, wCount = 0, cells = '';
      for (let i = 0; i < 7; i++) {
        const key = ymd(cursor);
        const list = byDay[key] || [];
        const pnl = round2(list.reduce((a, t) => a + t.pnl, 0));
        wPnl += pnl; wCount += list.length;
        const cls = ['day', list.length ? tone(pnl) : 'empty'];
        if (cursor.getMonth() !== view.m) cls.push('out');
        if (i >= 5) cls.push('wknd');
        if (key === todayKey) cls.push('today');
        const types = [...new Set(list.map((t) => t.type))];
        cells += `<button type="button" class="${cls.join(' ')}" data-date="${key}" aria-label="${key}, ${list.length ? money(pnl) : 'no trades'}">
            <span class="num">${cursor.getDate()}</span>
            ${list.length ? `<span class="amt">${moneyCell(pnl)}</span>
            <span class="meta">${plural(list.length, 'trade')} ${types.map((t) => `<i class="tag ${t.toLowerCase()}">${t}</i>`).join('')}</span>` : ''}
          </button>`;
        cursor = addDays(cursor, 1);
      }
      wPnl = round2(wPnl);
      html += `<div class="cal-grid cal-week">${cells}
        <div class="week-total ${wCount ? tone(wPnl) : 'empty'}">
          <span class="wlabel">W${weekNo}</span>
          <strong>${wCount ? money(wPnl, true) : '—'}</strong>
          <span class="meta">${plural(wCount, 'trade')}</span>
        </div></div>`;
    }
    $('#weeks').innerHTML = html;
    const mt = $('#month-total');
    mt.textContent = money(ms.pnl);
    mt.className = tone(ms.pnl);

    // ---- year overview
    let yearPnl = 0;
    const tiles = MON3.map((label, m) => {
      const key = view.y + '-' + pad(m + 1);
      const list = trades.filter((t) => t.date.startsWith(key));
      const pnl = round2(list.reduce((a, t) => a + t.pnl, 0));
      yearPnl += pnl;
      const cls = ['mtile', list.length ? tone(pnl) : 'empty'];
      if (m === view.m) cls.push('active');
      return `<button type="button" class="${cls.join(' ')}" data-month="${m}">
          <span class="mlabel">${label}</span>
          <strong>${list.length ? money(pnl, true) : '—'}</strong>
          <span class="meta">${plural(list.length, 'trade')}</span>
        </button>`;
    }).join('');
    yearPnl = round2(yearPnl);
    $('#year-label').textContent = view.y;
    $('#months').innerHTML = tiles;
    $('#year-total-label').textContent = view.y + ' total';
    const yt = $('#year-total');
    yt.textContent = money(yearPnl);
    yt.className = tone(yearPnl);

    // ---- by setup
    $('#setup-month').textContent = MONTHS[view.m] + ' ' + view.y;
    $('#setups').innerHTML = TYPES.map((type) => {
      const s = statsOf(monthTrades.filter((t) => t.type === type));
      return `<div class="setup">
        <div class="setup-top">
          <i class="tag ${type.toLowerCase()} lg">${type}</i>
          <strong class="${tone(s.pnl)}">${s.count ? money(s.pnl) : '—'}</strong>
        </div>
        <div class="bar"><span style="width:${s.winRate || 0}%"></span></div>
        <div class="setup-bot">
          <span>${plural(s.count, 'trade')}</span>
          <span>${s.winRate !== null ? s.winRate + '% win rate' : 'no data'}</span>
        </div>
      </div>`;
    }).join('');
  }

  /* ---------------------------------------------------------------- navigation */
  function shiftMonth(delta) {
    const d = new Date(view.y, view.m + delta, 1);
    view = { y: d.getFullYear(), m: d.getMonth() };
    render();
  }
  $('#prev').addEventListener('click', () => shiftMonth(-1));
  $('#next').addEventListener('click', () => shiftMonth(1));
  $('#prev-year').addEventListener('click', () => shiftMonth(-12));
  $('#next-year').addEventListener('click', () => shiftMonth(12));
  $('#go-today').addEventListener('click', () => { const n = new Date(); view = { y: n.getFullYear(), m: n.getMonth() }; render(); });

  $('#weeks').addEventListener('click', (e) => {
    const b = e.target.closest('.day');
    if (b) openDay(b.dataset.date);
  });
  $('#months').addEventListener('click', (e) => {
    const b = e.target.closest('.mtile');
    if (b) { view.m = Number(b.dataset.month); render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });

  // swipe left/right on the calendar to change month
  (function () {
    const el = $('.calendar');
    let x0 = 0, y0 = 0;
    el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchend', (e) => {
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 45) shiftMonth(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* ---------------------------------------------------------------- dialogs + back button */
  const dayDlg = $('#day-dialog');
  const setDlg = $('#settings-dialog');

  function openDlg(d) {
    if (!d.open) d.showModal();
    history.pushState({ dlg: 1 }, '');
  }
  [dayDlg, setDlg].forEach((d) => {
    d.addEventListener('close', () => { if (history.state && history.state.dlg) history.back(); });
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
    $('[data-close]', d).addEventListener('click', () => d.close());
  });
  window.addEventListener('popstate', () => { [dayDlg, setDlg].forEach((d) => { if (d.open) d.close(); }); });

  /* ---------------------------------------------------------------- trade form */
  const form = $('#trade-form');
  const pnlInput = $('#f-pnl');
  const reasonInput = $('#f-reason');
  const dateInput = $('#f-date');
  let currentDate = null;
  let editingId = null;

  const lastType = () => {
    const t = localStorage.getItem(TYPE_KEY);
    return TYPES.includes(t) ? t : TYPES[0];
  };
  const setType = (t) => { const r = $(`input[name=type][value="${t}"]`, form); if (r) r.checked = true; };

  function paintPnl() {
    const v = parsePnl(pnlInput.value);
    pnlInput.classList.toggle('pos', !isNaN(v) && v > 0);
    pnlInput.classList.toggle('neg', !isNaN(v) && v < 0);
  }
  pnlInput.addEventListener('input', paintPnl);
  $('#flip').addEventListener('click', () => {
    let s = pnlInput.value.trim().replace(/[−–—]/g, '-');
    if (!s) s = '-';
    else if (s[0] === '-') s = s.slice(1);
    else if (s[0] === '+') s = '-' + s.slice(1);
    else s = '-' + s;
    pnlInput.value = s;
    pnlInput.focus();
    paintPnl();
  });

  const fmtLong = (iso) => parseYmd(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  function setAddMode() {
    editingId = null;
    $('#form-title').textContent = 'Add a trade';
    $('#form-submit').textContent = 'Add trade';
    $('#cancel-edit').hidden = true;
    pnlInput.value = '';
    reasonInput.value = '';
    dateInput.value = currentDate;
    setType(lastType());
    $$('.trade-item').forEach((li) => li.classList.remove('editing'));
    paintPnl();
  }

  function setEditMode(t, li) {
    editingId = t.id;
    $('#form-title').textContent = 'Edit trade';
    $('#form-submit').textContent = 'Save changes';
    $('#cancel-edit').hidden = false;
    pnlInput.value = t.pnl > 0 ? '+' + t.pnl : String(t.pnl);
    reasonInput.value = t.reason || '';
    dateInput.value = t.date;
    setType(t.type);
    $$('.trade-item').forEach((x) => x.classList.toggle('editing', x === li));
    paintPnl();
    pnlInput.focus();
  }
  $('#cancel-edit').addEventListener('click', setAddMode);

  function renderDayList() {
    const list = trades.filter((t) => t.date === currentDate);
    const sum = round2(list.reduce((a, t) => a + t.pnl, 0));
    $('#dlg-title').textContent = fmtLong(currentDate);
    const total = $('#dlg-total');
    total.textContent = list.length ? money(sum) : 'No trades';
    total.className = 'dlg-total ' + (list.length ? tone(sum) : 'zero');

    const ul = $('#dlg-list');
    ul.innerHTML = '';
    list.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'trade-item';
      li.innerHTML = `
        <div class="t-left">
          <span class="t-pnl ${tone(t.pnl)}">${money(t.pnl)}</span>
          <i class="tag ${t.type.toLowerCase()}">${t.type}</i>
        </div>
        <div class="t-reason ${t.reason ? '' : 'none'}">${t.reason ? esc(t.reason) : 'No reason added'}</div>
        <div class="t-actions">
          <button type="button" class="link" data-edit>Edit</button>
          <button type="button" class="link danger" data-del>Delete</button>
        </div>`;
      $('[data-edit]', li).addEventListener('click', () => setEditMode(t, li));
      $('[data-del]', li).addEventListener('click', () => {
        if (!confirm('Delete this ' + money(t.pnl) + ' ' + t.type + ' trade?')) return;
        trades = trades.filter((x) => x.id !== t.id);
        if (save()) { toast('Trade deleted.'); render(); renderDayList(); setAddMode(); }
      });
      ul.appendChild(li);
    });
  }

  function openDay(date) {
    currentDate = date;
    renderDayList();
    setAddMode();
    openDlg(dayDlg);
    pnlInput.focus();
  }

  $('#fab').addEventListener('click', () => openDay(ymd(new Date())));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const pnl = parsePnl(pnlInput.value);
    if (isNaN(pnl)) { toast('Enter the P&L like -50 or +150.', 'err'); pnlInput.focus(); return; }
    const type = ($('input[name=type]:checked', form) || {}).value || TYPES[0];
    const reason = reasonInput.value.trim().slice(0, 500);
    const date = dateInput.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { toast('Pick a date.', 'err'); return; }

    if (editingId) {
      const t = trades.find((x) => x.id === editingId);
      if (t) Object.assign(t, { pnl, type, reason, date });
    } else {
      trades.push({ id: newId(), date, pnl, type, reason, createdAt: Date.now() });
    }
    if (!save()) return;
    try { localStorage.setItem(TYPE_KEY, type); } catch (e2) { /* ignore */ }

    const d = parseYmd(date);
    view = { y: d.getFullYear(), m: d.getMonth() };
    toast(editingId ? 'Trade updated.' : 'Trade added: ' + money(pnl) + ' ' + type);
    render();
    dayDlg.close();
  });

  /* ---------------------------------------------------------------- settings: backup / restore */
  function updateSummary() {
    $('#data-summary').textContent = plural(trades.length, 'trade') + ' saved on this device';
  }
  $('#open-settings').addEventListener('click', () => { updateSummary(); openDlg(setDlg); });

  $('#export-btn').addEventListener('click', async () => {
    if (!trades.length) { toast('Nothing to export yet.', 'err'); return; }
    const payload = JSON.stringify({ app: 'zxt', version: 1, exported: new Date().toISOString(), trades }, null, 2);
    const name = 'zxt-backup-' + ymd(new Date()) + '.json';
    const file = new File([payload], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ZxT backup' });
        toast('Backup shared.');
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return; // user closed the share sheet
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('Backup saved to Downloads.');
  });

  $('#import-btn').addEventListener('click', () => $('#import-file').click());
  $('#import-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const incoming = Array.isArray(data) ? data : data.trades;
      if (!Array.isArray(incoming)) throw new Error('bad file');
      const have = new Set(trades.map((t) => t.id));
      let added = 0;
      incoming.forEach((t) => {
        if (validTrade(t) && !have.has(t.id)) {
          trades.push({ id: t.id, date: t.date, pnl: round2(t.pnl), type: t.type, reason: String(t.reason || '').slice(0, 500), createdAt: t.createdAt || Date.now() });
          have.add(t.id); added++;
        }
      });
      if (save()) { toast(added ? 'Imported ' + plural(added, 'trade') + '.' : 'Nothing new to import.'); render(); updateSummary(); }
    } catch (err) {
      toast("That file isn't a ZxT backup.", 'err');
    }
  });

  $('#wipe-btn').addEventListener('click', () => {
    if (!trades.length) { toast('No data to delete.'); return; }
    if (!confirm('Delete ALL ' + plural(trades.length, 'trade') + ' from this phone? This cannot be undone.\n\nTip: export a backup first.')) return;
    trades = [];
    if (save()) { toast('All data deleted.'); render(); updateSummary(); }
  });

  // Ask the browser not to evict our data when storage is low.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((ok) => {
      $('#persist-note').textContent = ok
        ? 'Storage protection is on.'
        : 'Tip: install the app to your home screen to protect your data from being cleaned up.';
    }).catch(() => {});
  }

  /* ---------------------------------------------------------------- boot */
  // Refresh "today"/"this week" when the app comes back to the foreground
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
