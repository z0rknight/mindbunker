/* RMEDIA OS — Interaction Lab. Vanilla JS, no dependencies, no network, no storage.
   Simulated "server" = a timer. Every scene: init(), reset(), triggers via data-do="scene.action". */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = document.documentElement;
  var mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  var K = { public: 1.25, client: 1, operator: 0.8 };
  var reduced = function () { return root.dataset.motion === 'reduced'; };
  var dur = function (ms) { return reduced() ? 0 : ms * (K[document.body.dataset.intensity] || 1); };
  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var nextFrame = function () { return new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); }); };
  var fmt = function (m) { var h = Math.floor(m / 60), r = m % 60; return h ? h + 'h ' + String(r).padStart(2, '0') + 'm' : r + 'm'; };
  var say = function (t) { var a = $('#announce'); a.textContent = ''; setTimeout(function () { a.textContent = t; }, 30); };

  /* ── shared primitives (these are the reusable patterns) ─────────────── */
  function server() {               // simulated canonical action; rejects when "Fail next" is on
    var ms = +$('#latency').value;
    return sleep(ms).then(function () {
      var f = $('#failNext');
      if (f.checked) { f.checked = false; throw new Error('Simulated server failure'); }
    });
  }
  // ActionButton: no spinner for <150ms; if shown, stays >=300ms. Uses aria-disabled to keep focus.
  async function run(btn, work) {
    var lbl = $('.lbl', btn), shown = 0, ok = true, err = null;
    btn.setAttribute('aria-disabled', 'true');
    var t = setTimeout(function () {
      btn.dataset.state = 'loading'; btn.setAttribute('aria-busy', 'true'); shown = Date.now();
      if (lbl) { lbl.dataset.o = lbl.textContent; lbl.textContent = lbl.textContent.replace(/…$/, '') + '…'; }
    }, 150);
    try { await work(); } catch (e) { ok = false; err = e; }
    clearTimeout(t);
    if (shown) { var left = 300 - (Date.now() - shown); if (left > 0) await sleep(left); }
    btn.removeAttribute('aria-busy'); btn.removeAttribute('aria-disabled');
    if (lbl && lbl.dataset.o) { lbl.textContent = lbl.dataset.o; delete lbl.dataset.o; }
    btn.dataset.state = ok ? 'success' : 'error';
    if (ok) setTimeout(function () { if (btn.dataset.state === 'success') delete btn.dataset.state; }, 1400);
    return { ok: ok, err: err };
  }
  // StatusTransition: label swaps, pill width animates from old to new (no jump).
  function setStatus(el, status, label) {
    var l = $('.lbl', el), w0 = el.offsetWidth;
    el.dataset.status = status; el.style.background = '';
    var n = document.createElement('span'); n.className = 'lbl enter'; n.textContent = label; l.replaceWith(n);
    if (!reduced()) { var w1 = el.offsetWidth; el.style.width = w0 + 'px'; void el.offsetWidth; el.style.width = w1 + 'px'; setTimeout(function () { el.style.width = ''; }, 320); }
  }
  // UpdateFlash: a static, named marker that is removed after a hold (motion only softens the removal).
  function flash(el, tone, ms) { el.dataset.flash = tone; clearTimeout(el._f); if (ms !== 0) el._f = setTimeout(function () { delete el.dataset.flash; }, ms || 1400); }
  // ValueChange: old fades out fast, new fades in; width reserved by the grid stack.
  function changeValue(el, text, mode) {
    el.dataset.vc = mode || el.dataset.vc || 'crossfade';
    var cur = el.lastElementChild; if (cur.textContent === text) return;
    if (el.dataset.vc === 'flash') { cur.textContent = text; flash(el, 'info', 900); return; }
    var nw = document.createElement('span'); nw.className = 'in'; nw.textContent = text; cur.className = 'out'; el.appendChild(nw);
    setTimeout(function () { cur.remove(); nw.className = ''; }, reduced() ? 10 : 260);
  }
  // Reveal: create closed, open next frame; close then remove after the exit duration.
  async function reveal(el, open) { await nextFrame(); el.dataset.open = open ? 'true' : 'false'; }
  function removeAfterExit(el) { el.dataset.open = 'false'; setTimeout(function () { el.remove(); }, dur(140) + 40); }
  function msg(el, text, tone, hold) {
    el.textContent = text; el.dataset.tone = tone || ''; el.dataset.show = 'true'; clearTimeout(el._m);
    if (hold !== 0) el._m = setTimeout(function () { el.dataset.show = 'false'; }, hold || 2200);
  }
  function toast(text, tone) {
    var t = document.createElement('div'); t.className = 'toast'; t.dataset.tone = tone || ''; t.textContent = text; $('#toasts').appendChild(t);
    setTimeout(function () { t.remove(); }, 5000);
  }
  function openDialog(d, trigger) { d._t = trigger; d.dataset.phase = 'closed'; d.showModal(); nextFrame().then(function () { d.dataset.phase = 'open'; }); }
  function closeDialog(d) { if (d.dataset.phase === 'closing') return; d.dataset.phase = 'closing'; setTimeout(function () { d.close(); d.dataset.phase = 'closed'; }, dur(140)); }
  function ck() { return '<svg class="ck draw" aria-hidden="true"><use href="#ck"/></svg>'; }

  var SC = {}, ACT = {};

  /* ── 1 client approves ──────────────────────────────────────────────── */
  SC.s1 = { reset: function () {
    var c = $('#s1card'); c.dataset.state = 'ready'; delete c.dataset.flash;
    setStatusQuiet($('#s1st'), 'review', 'Your review'); setStatusQuiet($('#s1opst'), 'review', 'Ready for review');
    $$('#s1card .act').forEach(function (b) { b.removeAttribute('aria-disabled'); delete b.dataset.state; });
    $('#s1msg').dataset.show = 'false'; $('#s1err').dataset.show = 'false';
    $('#s1s2').dataset.done = 'false'; $('#s1d3').dataset.done = 'false';
    $('#s1ev').dataset.open = 'false'; $('#s1optime').textContent = 'waiting on client'; delete $('#s1op').dataset.flash;
    $('#s1foot').textContent = 'Your approval registers as soon as it is saved. Delivery is a separate step.';
  } };
  function setStatusQuiet(el, status, label) { el.dataset.status = status; el.style.width = ''; $('.lbl', el).textContent = label; $('.lbl', el).className = 'lbl'; }
  ACT['s1.approve'] = async function (btn) {
    var c = $('#s1card'); c.dataset.state = 'submitting'; $('#s1err').dataset.show = 'false';
    $$('#s1card .act').forEach(function (b) { if (b !== btn) b.setAttribute('aria-disabled', 'true'); });
    var r = await run(btn, server);
    if (!r.ok) {
      c.dataset.state = 'ready'; $$('#s1card .act').forEach(function (b) { b.removeAttribute('aria-disabled'); });
      var e = $('#s1err'); e.textContent = 'We couldn’t save your approval. Nothing has changed — please try again.'; e.dataset.show = 'true'; say('Approval not saved. Please try again.'); return;
    }
    c.dataset.state = 'approved'; setStatus($('#s1st'), 'approved', 'Approved'); flash(c, 'edge', 1600);
    $('#s1s2').dataset.done = 'true'; $('#s1d3').dataset.done = 'true';
    $$('#s1card .act').forEach(function (b) { b.setAttribute('aria-disabled', 'true'); });
    msg($('#s1msg'), 'Approved · your approval is recorded', 'success', 0);
    $('#s1foot').textContent = 'Thank you. Delivery is a separate step and will appear here when it is available.';
    say('Approved. Your approval was saved.');
    await sleep(700);                           // the operator's surface updates on its own refresh, a beat later
    setStatus($('#s1opst'), 'done', 'Done'); flash($('#s1op'), 'info', 1600);
    $('#s1optime').textContent = 'client approved · just now'; $('#s1ev').dataset.open = 'true';
  };
  ACT['s1.changes'] = async function (btn) {
    var c = $('#s1card'); c.dataset.state = 'submitting';
    var r = await run(btn, server);
    if (!r.ok) { c.dataset.state = 'ready'; var e = $('#s1err'); e.textContent = 'We couldn’t send your request. Nothing has changed — please try again.'; e.dataset.show = 'true'; return; }
    c.dataset.state = 'changes'; setStatus($('#s1st'), 'changes', 'Changes requested');
    $$('#s1card .act').forEach(function (b) { b.setAttribute('aria-disabled', 'true'); });
    msg($('#s1msg'), 'Sent to your editor', '', 0); say('Changes requested. Your note was sent.');
  };

  /* ── 2 payment ─────────────────────────────────────────────────────── */
  SC.s2 = { reset: function () {
    setStatusQuiet($('#s2st'), 'open', 'Open'); $('#s2st').style.background = 'var(--os-surface-3)';
    $('#s2bar').style.setProperty('--v', 40); $('#s2meter').textContent = 'Paid $100.00 of $250.00 requested · recorded payments only';
    $('#s2tl').innerHTML = '<li>Request sent · Sep 18</li>'; $('#s2err').dataset.show = 'false'; $('#s2rec').removeAttribute('aria-disabled'); delete $('#s2rec').dataset.state;
  } };
  ACT['s2.link'] = function () { var li = document.createElement('li'); li.className = 't-meta'; li.textContent = 'Client opened the Wise link · status unchanged (opening a link is not a payment)'; $('#s2tl').appendChild(li); say('Link opened. Payment status unchanged.'); };
  ACT['s2.record'] = async function (btn) {
    var st = $('#s2st'); $('#s2err').dataset.show = 'false'; setStatus(st, 'processing', 'Recording');
    var r = await run(btn, server);
    if (!r.ok) { setStatus(st, 'open', 'Open'); st.style.background = 'var(--os-surface-3)'; var e = $('#s2err'); e.textContent = 'Payment was not recorded. The request is still Open.'; e.dataset.show = 'true'; say('Payment not recorded.'); return; }
    setStatus(st, 'paid', 'Paid'); btn.setAttribute('aria-disabled', 'true');
    $('#s2bar').style.setProperty('--v', 100); $('#s2bar').parentElement.dataset.status = 'done';
    $('#s2meter').textContent = 'Paid $250.00 of $250.00 requested · recorded payments only';
    var li = document.createElement('li'); li.innerHTML = ck() + ' Payment recorded in Transactions · just now'; li.style.color = 'var(--os-success)'; li.style.display = 'flex'; li.style.gap = '6px'; li.style.alignItems = 'center'; $('#s2tl').appendChild(li); flash(li, 'success', 1600);
    say('Payment recorded. Status is Paid.');
  };

  /* ── 3 batch progress + recipes ────────────────────────────────────── */
  var SEQ = [[2, 'done'], [3, 'review'], [4, 'progress'], [3, 'done'], [4, 'review'], [4, 'done']];
  var s3 = { segs: [], step: 0, up: null, stp: 0 };
  function s3text() {
    var c = { done: 0, review: 0, progress: 0, planned: 0 }; s3.segs.forEach(function (s) { c[s]++; });
    $('#s3sum').textContent = c.done + ' of 5 done';
    $('#s3txt').textContent = c.done + ' done · ' + c.review + ' ready for review (waiting on client) · ' + c.progress + ' in progress · ' + c.planned + ' planned';
    $('#s3bar').setAttribute('aria-label', $('#s3txt').textContent); $('#s3rail').style.setProperty('--v', c.done * 20);
  }
  function s3render(anti) {
    var bar = $('#s3bar'); bar.innerHTML = '';
    s3.segs.forEach(function (s, i) { var d = document.createElement('div'); d.className = 'seg'; d.dataset.status = s; d.dataset.i = i; if (anti && s !== 'planned') d.classList.add('filling'); bar.appendChild(d); });
    s3text();
  }
  SC.s3 = { reset: function () {
    s3.segs = ['done', 'done', 'review', 'progress', 'planned']; s3.step = 0; $('#s3anti').checked = false; s3render(false);
    $('#s3rail').style.setProperty('--v', 40); if (s3.up) clearInterval(s3.up); $('#s3up').style.setProperty('--v', 0); $('#s3upt').textContent = 'Not started'; $('#s3up').parentElement.dataset.status = '';
    s3.stp = 0; s3steps();
  } };
  ACT['s3.advance'] = function () {
    if (s3.step >= SEQ.length) { say('Batch complete'); return; }
    var m = SEQ[s3.step++]; s3.segs[m[0]] = m[1]; var el = $('.seg[data-i="' + m[0] + '"]', $('#s3bar'));
    el.dataset.status = m[1]; el.classList.remove('filling'); void el.offsetWidth; if (m[1] !== 'planned') el.classList.add('filling'); setTimeout(function () { el.classList.remove('filling'); }, 300);
    s3text(); say($('#s3txt').textContent);
  };
  ACT['s3.replay'] = function () { var b = $('#s3bar'); s3render($('#s3anti').checked); if (!$('#s3anti').checked) { b.classList.add('no-anim'); } setTimeout(function () { b.classList.remove('no-anim'); }, 50); };
  ACT['s3.upload'] = function () {
    if (s3.up) clearInterval(s3.up); var v = 0, bar = $('#s3up');
    s3.up = setInterval(function () { v = Math.min(100, v + 12 + Math.round(Math.random() * 10)); bar.style.setProperty('--v', v); $('#s3upt').textContent = v < 100 ? 'Uploading ' + v + '% · ' + (v * 0.365).toFixed(1) + ' of 36.5 MB' : 'Uploaded · 36.5 MB'; if (v >= 100) { clearInterval(s3.up); bar.parentElement.dataset.status = 'done'; say('Upload complete'); } }, 380);
  };
  function s3steps() {
    var el = $('#s3steps'); el.innerHTML = '';
    for (var i = 0; i < 4; i++) {
      var d = document.createElement('span'); d.className = 'dot'; d.dataset.done = i < s3.stp; d.dataset.current = i === s3.stp; el.appendChild(d);
      if (i < 3) { var p = document.createElement('span'); p.className = 'stp'; p.dataset.done = i < s3.stp; el.appendChild(p); }
    }
  }
  ACT['s3.step'] = function () { s3.stp = (s3.stp + 1) % 4; var el = $('#s3steps'), ds = $$('.dot', el), ps = $$('.stp', el); ds.forEach(function (d, i) { d.dataset.done = i < s3.stp; d.dataset.current = i === s3.stp; }); ps.forEach(function (p, i) { p.dataset.done = i < s3.stp; }); };

  /* ── 4 table row update ────────────────────────────────────────────── */
  var S4 = [
    { item: 'Long session · Sep 19', change: '—', value: '14h 20m', st: ['warning', 'Review'] },
    { item: 'Billing allocation · week 1', change: '—', value: '4h 00m', st: ['done', 'Attributed'] },
    { item: 'Lead · Alex Sample', change: '—', value: 'Contacted', st: ['progress', 'Open'] },
    { item: 'Video · Story cut', change: '—', value: '—', st: ['review', 'Ready for review'] }
  ];
  function s4render() {
    $('#s4b').innerHTML = S4.map(function (r, i) { return '<tr data-i="' + i + '"><td>' + r.item + '<span class="chip-saved">Saved</span></td><td>' + r.change + '</td><td class="num"><span class="cellhl">' + r.value + '</span></td><td><span class="st" data-status="' + r.st[0] + '"><span class="lbl">' + r.st[1] + '</span></span></td></tr>'; }).join('');
  }
  function s4set(i, ch, val, st, tone, chip) {
    var tr = $('#s4b tr[data-i="' + i + '"]'), tds = $$('td', tr);
    tds[1].textContent = ch; $('.cellhl', tds[2]).textContent = val; if (st) setStatus($('.st', tds[3]), st[0], st[1]);
    $('.chip-saved', tds[0]).textContent = chip; flash(tr, tone, 1500); flash($('.cellhl', tds[2]), tone === 'error' ? 'error' : tone, 1500);
  }
  SC.s4 = { reset: s4render };
  ACT['s4.success'] = function () { s4set(1, 'allocation added', '6h 00m', ['done', 'Attributed'], 'success', 'Saved'); say('Allocation saved. 6h 00m attributed.'); };
  ACT['s4.warning'] = function () { s4set(0, 'observed over 12h', '14h 20m', ['warning', 'Review'], 'warning', 'Needs review'); say('Session exceeds 12 hours. Review needed.'); };
  ACT['s4.error'] = function () {
    var tr = $('#s4b tr[data-i="2"]'); var td = $$('td', tr);
    td[1].textContent = 'status → Won'; $('.cellhl', td[2]).textContent = 'Won'; $('.chip-saved', td[0]).textContent = 'Saving…'; flash(tr, 'info', 0);
    sleep(700).then(function () { $('.cellhl', td[2]).textContent = 'Contacted'; td[1].textContent = 'not saved · reverted'; $('.chip-saved', td[0]).textContent = 'Not saved — reverted'; flash(tr, 'error', 1800); say('Lead status was not saved and was reverted to Contacted.'); });
  };

  /* ── 5 metric value change ─────────────────────────────────────────── */
  var s5 = { on: false, mode: 'crossfade' };
  SC.s5 = { reset: function () {
    s5.on = false; changeValue($('#m1'), '4', s5.mode); changeValue($('#m2'), '6h 00m', s5.mode); changeValue($('#m3'), '$100.00', s5.mode);
    ['m1d', 'm2d', 'm3d'].forEach(function (id) { $('#' + id).dataset.show = 'false'; });
  } };
  ACT['s5.change'] = function () {
    s5.on = !s5.on; var d = s5.on;
    changeValue($('#m1'), d ? '5' : '4', s5.mode); changeValue($('#m2'), d ? '2h 00m' : '6h 00m', s5.mode); changeValue($('#m3'), d ? '$250.00' : '$100.00', s5.mode);
    [['m1d', d ? '+1' : '−1'], ['m2d', d ? '−4h 00m' : '+4h 00m'], ['m3d', d ? '+$150.00' : '−$150.00']].forEach(function (x) { var e = $('#' + x[0]); e.textContent = x[1]; e.dataset.show = 'true'; });
    say(d ? 'Active jobs 5. Unallocated 2 hours. Paid 250 dollars.' : 'Values changed back.');
  };

  /* ── 6 application bar chart ───────────────────────────────────────── */
  var APPS = [['Premiere Pro', 'fact'], ['Safari', 'fact'], ['Claude', 'fact'], ['Finder', 'fact'], ['Unknown', 'unknown']];
  var WIN = { today: { v: [134, 51, 32, 18, 27], cov: 87 }, '3d': { v: [402, 160, 118, 44, 96], cov: 84 }, '7d': { v: [905, 370, 260, 95, 210], cov: 86 }, month: { v: [3480, 1420, 1010, 380, 720], cov: 82 } };
  var s6 = { w: 'today', sel: null, empty: false };
  function s6rows() { return $$('.r', $('#s6hb')); }
  function s6build(zero) {
    var hb = $('#s6hb'); hb.innerHTML = '';
    if (s6.empty) { hb.innerHTML = '<div class="empty"><div class="t-card">No application data for this window</div><p class="t-small">Coverage is 0% — this is unknown, not zero usage.</p></div>'; $('#s6cov').textContent = ''; return; }
    APPS.forEach(function (a, i) {
      var b = document.createElement('button'); b.className = 'r'; b.type = 'button'; b.dataset.i = i; b.dataset.source = a[1]; b.setAttribute('aria-pressed', 'false');
      b.innerHTML = '<span>' + a[0] + '</span><span class="tr"><i style="--w:0"></i></span><span class="v"></span>'; hb.appendChild(b);
    });
    s6update(zero);
  }
  function s6update(stagger) {
    var d = WIN[s6.w], max = Math.max.apply(null, d.v), tot = d.v.reduce(function (a, b) { return a + b; }, 0);
    s6rows().forEach(function (r) {
      var i = +r.dataset.i, v = d.v[i]; $('.v', r).textContent = fmt(v);
      var bar = $('.tr i', r); bar.style.transitionDelay = stagger ? (i * 30) + 'ms' : ''; bar.style.setProperty('--w', Math.round(v / max * 100));
      r.setAttribute('aria-label', APPS[i][0] + ', ' + fmt(v) + (APPS[i][1] === 'unknown' ? ', unclassified time' : '') + (r.getAttribute('aria-pressed') === 'true' ? ', selected' : ''));
    });
    $('#s6cov').textContent = d.cov + '% telemetry coverage · ' + fmt(tot) + ' observed · bar length is relative to the longest bar in this window';
    s6sel();
  }
  function s6sel() {
    var d = WIN[s6.w], tot = d.v.reduce(function (a, b) { return a + b; }, 0), o = $('#s6sel');
    if (s6.sel === null) { o.textContent = 'Select a row for detail.'; return; }
    var v = d.v[s6.sel]; o.textContent = APPS[s6.sel][0] + ' · ' + fmt(v) + ' · ' + Math.round(v / tot * 100) + '% of observed time · ' + (APPS[s6.sel][1] === 'unknown' ? 'UNKNOWN: not classified' : 'SOURCE FACT');
  }
  function s6flip(mutate) {
    var rows = s6rows(), first = {}; rows.forEach(function (r) { first[r.dataset.i] = r.getBoundingClientRect().top; });
    mutate();
    if (reduced()) return;
    s6rows().forEach(function (r) { var dy = first[r.dataset.i] - r.getBoundingClientRect().top; if (dy) r.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: dur(180), easing: 'cubic-bezier(.2,0,0,1)' }); });
  }
  function s6order() {
    var hb = $('#s6hb'), d = WIN[s6.w], rows = s6rows();
    rows.sort(function (a, b) { return $('#s6sort').checked ? d.v[+b.dataset.i] - d.v[+a.dataset.i] : +a.dataset.i - +b.dataset.i; }).forEach(function (r) { hb.appendChild(r); });
  }
  SC.s6 = { reset: function () { s6.w = 'today'; s6.sel = null; s6.empty = false; $('#s6unk').checked = true; $('#s6sort').checked = false; $$('#s6win button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.w === 'today'); }); s6build(false); } };
  ACT['s6.empty'] = function () { s6.empty = true; s6build(false); };
  ACT['s6.load'] = async function () { s6.empty = false; s6build(true); var rows = s6rows(); await nextFrame(); s6update(true); if (!$('#s6unk').checked) { var u = rows.filter(function (r) { return r.dataset.source === 'unknown'; })[0]; if (u) u.hidden = true; } };

  /* ── 7 source / derived / unknown ──────────────────────────────────── */
  var WEEKS = [
    { l: 'W1', r: 10, a: 8.5, d: 1.5 }, { l: 'W2', r: 9.5, a: 0, d: 0 }, { l: 'W3', r: 8, a: 0, d: 0 }, { l: 'W4', r: 11, a: 0, d: 0 }, { l: 'W5', r: null }, { l: 'W6', r: 10, a: 0, d: 0 }, { l: 'W7', r: 11, a: 0, d: 0 }
  ];
  function s7build() {
    var vb = $('#s7vb'), mx = 12; vb.innerHTML = ''; $('#s7lab').innerHTML = WEEKS.map(function (w) { return '<span>' + w.l + '</span>'; }).join('');
    WEEKS.forEach(function (w) {
      var c = document.createElement('div'); c.className = 'c'; c.tabIndex = 0;
      if (w.r === null) { c.dataset.source = 'unknown'; c.setAttribute('aria-label', w.l + ': not recorded'); c.innerHTML = '<span class="val">n/r</span><div class="col" style="--h:35"></div>'; }
      else { var un = w.r - w.a - w.d; c.setAttribute('aria-label', w.l + ': ' + w.r + 'h registered; ' + w.a + 'h attributed; ' + w.d + 'h derived; ' + un + 'h unallocated'); c.innerHTML = '<span class="val">' + w.r + 'h</span><div class="col stk" style="--h:' + Math.round(w.r / mx * 100) + '"><i data-source="unknown" style="--s:' + Math.round(un / w.r * 100) + '"></i><i data-source="derived" style="--s:' + Math.round(w.d / w.r * 100) + '"></i><i data-source="fact" style="--s:' + Math.round(w.a / w.r * 100) + '"></i></div>'; }
      vb.appendChild(c);
    });
  }
  function s7stack(att) {
    var f = att, u = 6 - att; $('#s7st').innerHTML = '<span data-source="fact" style="--w:' + f / 6 * 100 + '"></span><span data-source="derived" style="--w:0"></span><span data-source="unknown" style="--w:' + u / 6 * 100 + '"></span>';
    $('#s7txt').textContent = '6h registered · ' + att + 'h attributed · ' + u + 'h unallocated'; $('#s7st').setAttribute('aria-label', $('#s7txt').textContent); $('#s7st [data-source="derived"]').hidden = true;
  }
  SC.s7 = { reset: function () { s7build(); s7stack(4); $('#s7gray').checked = false; $('#s7gray').dispatchEvent(new Event('change')); var b = $('[data-do="s7.attr"]'); b.removeAttribute('aria-disabled'); } };
  ACT['s7.attr'] = async function (btn) {
    var r = await run(btn, server); if (!r.ok) { say('Attribution not saved.'); return; }
    var fact = $('#s7st [data-source="fact"]'), un = $('#s7st [data-source="unknown"]'); fact.dataset.current = 'true'; fact.style.setProperty('--w', 100); un.style.setProperty('--w', 0);
    $('#s7txt').textContent = '6h registered · 6h attributed · 0h unallocated'; $('#s7st').setAttribute('aria-label', $('#s7txt').textContent);
    setTimeout(function () { delete fact.dataset.current; }, 1600); setTimeout(function () { un.hidden = true; }, 300); btn.setAttribute('aria-disabled', 'true'); say('2 hours attributed to the batch. 0 hours unallocated.');
  };

  /* ── 8 live sensor ─────────────────────────────────────────────────── */
  var s8 = { t: null, t0: 0 };
  function s8tick() { var s = Math.floor((Date.now() - s8.t0) / 1000); $('#s8t').textContent = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(function (n) { return String(n).padStart(2, '0'); }).join(':'); }
  SC.s8 = { reset: function () { clearInterval(s8.t); s8.t = null; $('#s8dot').dataset.live = 'false'; $('#s8app').textContent = 'Sensor idle'; $('#s8sub').textContent = 'No open observation'; $('#s8t').textContent = '00:00:00'; $('#s8btn').textContent = 'Start observation'; $('#s8ws').textContent = 'Not created — observed activity is not a Work Session.'; } };
  ACT['s8.toggle'] = function () {
    if (!s8.t) { s8.t0 = Date.now(); s8tick(); s8.t = setInterval(s8tick, 1000); $('#s8dot').dataset.live = 'true'; $('#s8app').textContent = 'Premiere Pro'; $('#s8sub').textContent = 'Observing · this is telemetry, not a Work Session'; $('#s8btn').textContent = 'Stop observation'; say('Sensor observation started.'); }
    else { clearInterval(s8.t); s8.t = null; $('#s8dot').dataset.live = 'false'; $('#s8app').textContent = 'Session closed'; $('#s8sub').textContent = 'Observed ' + $('#s8t').textContent + ' · awaiting review'; $('#s8btn').textContent = 'Start observation'; say('Sensor observation stopped.'); }
  };

  /* ── 9 exception resolved ──────────────────────────────────────────── */
  var EXC = [
    { id: 'long', pill: 'Long session', title: 'Sensor session · 14h 20m', detail: 'Sep 19 · Premiere Pro · counted as observed time', field: 'Corrected length (hours)', ph: '9.08', done: 'Corrected to 9h 05m · recalculated', check: function (v) { return +v > 0 && +v < 24; }, bad: 'Enter a length between 0 and 24 hours.' },
    { id: 'url', pill: 'Missing review URL', title: 'Story cut · cannot move to review', detail: 'READY_FOR_REVIEW needs a review link', field: 'Review URL', ph: 'https://…', done: 'Review URL saved · warning cleared', check: function (v) { return /^https?:\/\/\S+/.test(v); }, bad: 'Enter a full link starting with https://' }
  ];
  var s9n = 2;
  function s9build() {
    var L = $('#s9list'); L.innerHTML = ''; s9n = EXC.length; $('#s9empty').style.display = 'none'; $('#s9empty').dataset.open = 'false';
    EXC.forEach(function (x) {
      var w = document.createElement('div'); w.className = 'reveal'; w.dataset.open = 'true'; w.dataset.id = x.id;
      w.innerHTML = '<div class="in"><div class="exc"><div class="head"><span class="st" data-status="warning"><span class="lbl">' + x.pill + '</span></span><div class="grow"><div class="t-card">' + x.title + '</div><div class="t-small" data-d>' + x.detail + '</div></div><button class="btn sm" data-x="open" aria-expanded="false">Fix</button></div><div class="reveal" data-open="false" data-fix><div class="in"><div class="fix"><label class="field" style="flex:1;min-width:180px"><span class="t-label">' + x.field + '</span><input class="input" placeholder="' + x.ph + '"></label><button class="btn primary act sm" data-x="save"><span class="lbl">Save</span></button><button class="btn ghost sm" data-x="cancel">Cancel</button></div><p class="errline" role="alert" style="padding:0 14px 12px"></p></div></div></div></div>';
      L.appendChild(w);
    });
    $('#s9n').firstElementChild.textContent = String(s9n);
  }
  SC.s9 = { reset: s9build };
  document.addEventListener('click', async function (e) {
    var b = e.target.closest('[data-x]'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    var w = b.closest('[data-id]'), x = EXC.filter(function (q) { return q.id === w.dataset.id; })[0], fix = $('[data-fix]', w), inp = $('.input', w), er = $('.errline', w);
    if (b.dataset.x === 'open') { fix.dataset.open = 'true'; $('[data-x="open"]', w).setAttribute('aria-expanded', 'true'); setTimeout(function () { inp.focus(); }, dur(240) + 20); }
    if (b.dataset.x === 'cancel') { fix.dataset.open = 'false'; $('[data-x="open"]', w).setAttribute('aria-expanded', 'false'); $('[data-x="open"]', w).focus(); }
    if (b.dataset.x === 'save') {
      er.dataset.show = 'false';
      if (!x.check(inp.value.trim())) { er.textContent = x.bad; er.dataset.show = 'true'; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
      inp.removeAttribute('aria-invalid');
      var r = await run(b, server);
      if (!r.ok) { er.textContent = 'Not saved — the server did not confirm. Your entry is kept; try again.'; er.dataset.show = 'true'; return; }
      var exc = $('.exc', w); exc.dataset.resolved = 'true'; setStatus($('.st', w), 'approved', 'Resolved'); $('[data-d]', w).textContent = x.done; fix.dataset.open = 'false'; $('[data-x="open"]', w).style.display = 'none'; flash(exc, 'success', 1400);
      s9n--; changeValue($('#s9n'), String(s9n), 'crossfade'); say(x.done + '. ' + s9n + ' left needing attention.');
      await sleep(reduced() ? 900 : 1400);                                    // hold: the user sees it resolve where it was
      removeAfterExit(w);
      if (s9n === 0) { var em = $('#s9empty'); em.style.display = 'grid'; await nextFrame(); em.dataset.open = 'true'; }
    }
  });

  /* ── 10 modal ──────────────────────────────────────────────────────── */
  var m10 = function () { return $('#s10m'); };
  SC.s10 = { reset: function () { $('#s10res').dataset.show = 'false'; $('#s10err').dataset.show = 'false'; } };
  ACT['s10.open'] = function (b) { $('#s10err').dataset.show = 'false'; openDialog(m10(), b); };
  ACT['s10.cancel'] = function () { closeDialog(m10()); };
  ACT['s10.confirm'] = async function (btn) {
    var r = await run(btn, server);
    if (!r.ok) { var e = $('#s10err'); e.textContent = 'Couldn’t save. The link is not marked as sent — try again.'; e.dataset.show = 'true'; return; }
    closeDialog(m10()); await sleep(dur(140) + 60); msg($('#s10res'), 'Delivery link marked as sent', 'success', 3200); flash($('#s10res'), 'success', 1200); say('Delivery link marked as sent.');
  };

  /* ── 11 disclosure ─────────────────────────────────────────────────── */
  var DZ = [['Production Memory · 3 formats', 'Content Waterfall · Lecture Format · Client Success Format (fake data).'], ['Evidence details', 'Registered 6h · attributed 4h · unallocated 2h. Not billed revenue, not paid.'], ['History', 'Older revisions and notes are collected here, collapsed by default.']];
  SC.s11 = { reset: function () {
    $('#s11c').innerHTML = DZ.map(function (d, i) { return '<div class="dz"><button type="button" aria-expanded="false" aria-controls="dz' + i + '">' + d[0] + '</button><div class="reveal" id="dz' + i + '" role="region" data-open="false"><div class="in"><div class="body">' + d[1] + '</div></div></div></div>'; }).join('');
  } };
  document.addEventListener('click', function (e) { var b = e.target.closest('.dz > button'); if (!b) return; var o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', o); $('#' + b.getAttribute('aria-controls')).dataset.open = o; });

  /* ── 12 tabs ───────────────────────────────────────────────────────── */
  function tabs(listId, panelId, texts, fade) {
    var list = $(listId), panel = $(panelId), tb = $$('[role="tab"]', list), rule = $('.rule', list);
    function place(t) { rule.style.width = t.offsetWidth + 'px'; rule.style.transform = 'translateX(' + t.offsetLeft + 'px)'; }
    function sel(i, focus) {
      tb.forEach(function (t, j) { t.setAttribute('aria-selected', j === i); t.tabIndex = j === i ? 0 : -1; }); place(tb[i]);
      panel.innerHTML = '<span class="t-small">' + texts[i] + '</span>';
      if (fade) { panel.dataset.fade = 'false'; void panel.offsetWidth; panel.dataset.fade = 'true'; }
      if (focus) tb[i].focus();
    }
    tb.forEach(function (t, i) { t.addEventListener('click', function () { sel(i); }); t.addEventListener('keydown', function (e) { var k = { ArrowRight: 1, ArrowLeft: -1 }[e.key]; if (k) { e.preventDefault(); sel((i + k + tb.length) % tb.length, true); } if (e.key === 'Home') { e.preventDefault(); sel(0, true); } if (e.key === 'End') { e.preventDefault(); sel(tb.length - 1, true); } }); });
    place(tb[0]); window.addEventListener('resize', function () { place($('[aria-selected="true"]', list)); });
  }
  SC.s12 = { reset: function () { } };

  /* ── 13 guided intake ──────────────────────────────────────────────── */
  var Q = [
    { id: 'shape', t: 'What are you trying to make?', h: 'Choose the closest starting point. It does not need to be final.', o: [['One video', 'One specific piece to be edited.'], ['A few videos', 'A small set produced together.'], ['Ongoing content', 'Videos needed regularly.'], ['I’m not sure yet', 'Help me find a starting point.']] },
    { id: 'content', t: 'What kind of videos are they?', h: 'A rough length is enough.', o: [['Short clips', 'Under about 90 seconds.'], ['A few minutes', 'Lessons or stories, 2–10 minutes.'], ['Longer videos', 'Interviews or lessons over 10 minutes.']] },
    { id: 'ready', t: 'What do you already have?', h: 'Footage, recordings, scripts — not a full inventory.', o: [['Everything is ready', 'Material is available and defined.'], ['The material is ready', 'I want help shaping the story.'], ['Some things are coming', 'Still recording or gathering.']] }
  ];
  var s13 = { i: 0, a: [] };
  function s13steps() { var el = $('#s13steps'); el.innerHTML = ''; var n = 5; for (var i = 0; i < n; i++) { var d = document.createElement('span'); d.className = 'dot'; d.dataset.done = i < s13.i; d.dataset.current = i === s13.i; el.appendChild(d); if (i < n - 1) { var p = document.createElement('span'); p.className = 'stp'; p.dataset.done = i < s13.i; el.appendChild(p); } } $('#s13lab').textContent = ['Getting started', 'Your content', 'What is ready', 'Summary', 'Contact'][s13.i] + ' · ' + (s13.i + 1) + ' of 5'; }
  function s13render(dir, quiet) {
    $('#s13box').dataset.dir = dir || 'fwd'; var v = $('#s13v'), i = s13.i, h = '';
    if (i < 3) {
      var q = Q[i]; h = '<div class="slide"><h3 class="t-section" tabindex="-1" id="s13h">' + q.t + '</h3><p class="t-small" style="margin:6px 0 14px">' + q.h + '</p><div class="grid" role="radiogroup" aria-labelledby="s13h" style="gap:10px">' + q.o.map(function (o, k) { return '<button type="button" class="choice" role="radio" aria-checked="' + (s13.a[i] === k) + '" tabindex="' + ((s13.a[i] === k || (s13.a[i] === undefined && k === 0)) ? 0 : -1) + '" data-k="' + k + '"><span class="h">' + o[0] + '</span><span class="d">' + o[1] + '</span></button>'; }).join('') + '</div>' + (i ? '<div class="controls"><button class="btn ghost sm" data-g="back">Back</button></div>' : '') + '</div>';
    } else if (i === 3) {
      var ref = $('#s13ref').checked; h = '<div class="slide"><h3 class="t-section" tabindex="-1" id="s13h">Here’s what we have so far</h3><ul class="sum t-body" style="list-style:none;padding:0;margin:14px 0;display:grid;gap:8px">' + Q.map(function (q, n) { return '<li style="--i:' + n + '"><span class="t-meta">' + q.id + '</span> · ' + q.o[s13.a[n]][0] + '</li>'; }).join('') + (ref ? '<li style="--i:3"><span class="t-meta">referral</span> · PDBM</li>' : '') + '</ul><div class="controls"><button class="btn ghost sm" data-g="back">Back</button><button class="btn primary" data-g="next">Looks right</button></div></div>';
    } else {
      h = '<div class="slide"><h3 class="t-section" tabindex="-1" id="s13h">Where should Emmanuel reply?</h3><p class="t-small" style="margin:6px 0 14px">Prototype only — nothing is sent or saved.</p><div class="grid" style="gap:10px"><label class="field"><span class="t-label">Name</span><input class="input" autocomplete="off"></label><label class="field"><span class="t-label">Email</span><input class="input" type="email" autocomplete="off"></label></div><div class="controls"><button class="btn ghost sm" data-g="back">Back</button><button class="btn primary" data-g="send">Send (prototype)</button><span class="savemsg" id="s13m"></span></div></div>';
    }
    v.innerHTML = h; s13steps(); var hd = $('#s13h'); if (!quiet) { if (hd) hd.focus({ preventScroll: true }); say($('#s13lab').textContent + '. ' + (hd ? hd.textContent : '')); }
  }
  SC.s13 = { reset: function () { s13.i = 0; s13.a = []; $('#s13ref').checked = false; $('#s13box').dataset.ref = ''; s13render('fwd', true); } };
  $('#s13ref').addEventListener('change', function (e) { $('#s13box').dataset.ref = e.target.checked ? 'pdbm' : ''; if (s13.i === 3) s13render('fwd'); });
  document.addEventListener('click', function (e) {
    var c = e.target.closest('#s13v .choice'), g = e.target.closest('#s13v [data-g]');
    if (c) { var i = s13.i; s13.a[i] = +c.dataset.k; $$('#s13v .choice').forEach(function (x) { x.setAttribute('aria-checked', x === c); x.dataset.held = 'true'; }); setTimeout(function () { s13.i = i + 1; s13render('fwd'); }, dur(240) + (reduced() ? 60 : 0)); }
    if (g) { var a = g.dataset.g; if (a === 'back') { s13.i--; s13render('back'); } if (a === 'next') { s13.i++; s13render('fwd'); } if (a === 'send') msg($('#s13m'), 'Prototype: nothing was sent', '', 2600); }
  });
  document.addEventListener('keydown', function (e) {
    var c = e.target.closest && e.target.closest('#s13v .choice'); if (!c) return; var k = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]; if (!k) return; e.preventDefault();
    var all = $$('#s13v .choice'), n = (all.indexOf(c) + k + all.length) % all.length; all.forEach(function (x, j) { x.tabIndex = j === n ? 0 : -1; }); all[n].focus();
  });

  /* ── 14 delivery available ─────────────────────────────────────────── */
  var s14n;
  SC.s14 = { reset: function () { clearTimeout(s14n); setStatusQuiet($('#s14rv'), 'approved', 'Approved'); setStatusQuiet($('#s14dl'), 'planned', 'Not yet available'); $('#s14dw').dataset.open = 'false'; $('#s14v').textContent = 'v1'; $('#s14new').style.opacity = 0; $('#s14m').dataset.show = 'false'; } };
  ACT['s14.deliver'] = async function (btn) {
    var r = await run(btn, server); if (!r.ok) { msg($('#s14m'), 'Not saved — delivery unchanged', 'error', 3000); return; }
    setStatus($('#s14dl'), 'available', 'Available'); $('#s14dw').dataset.open = 'true'; await sleep(dur(240)); flash($('#s14row'), 'success', 1600); say('Delivery is now available. A download link was added.');
  };
  ACT['s14.version'] = function () {
    $('#s14v').textContent = 'v2'; $('#s14new').style.opacity = 1; setStatus($('#s14rv'), 'review', 'Your review'); setStatus($('#s14dl'), 'planned', 'Not yet available'); $('#s14dw').dataset.open = 'false';
    say('A new version, v2, is ready for your review.'); clearTimeout(s14n); s14n = setTimeout(function () { $('#s14new').style.opacity = 0; }, 8000);
  };

  /* ── 15 new item arrival ───────────────────────────────────────────── */
  var KIND = { 'Lead': ['New lead · Alex Sample', 'via quote request · PDBM referral'], 'Sensor session': ['Sensor session started · Premiere Pro', 'observed, not yet a Work Session'], 'Quick note': ['Quick note · “check 4K detail on hero”', 'captured from Sensor'], 'Client approval': ['Client approved · Spring launch cut 2', 'status DONE · delivery not recorded'], 'Review feedback': ['Review feedback · 3 comments', 'Story cut · v2'], 'Production Memory record': ['First format saved · Lecture Format', 'operator convention'], 'Deliverable': ['Deliverable added · Story cut', 'Batch 01'] };
  SC.s15 = { reset: function () { $('#s15l').innerHTML = ''; var e = $('#s15e'); e.dataset.open = 'true'; e.style.display = ''; } };
  ACT['s15.add'] = async function () {
    var k = $('#s15k').value, d = KIND[k], e = $('#s15e'); if (e.dataset.open === 'true') e.dataset.open = 'false';
    var w = document.createElement('div'); w.className = 'reveal'; w.dataset.open = 'false';
    var t = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    w.innerHTML = '<div class="in"><div class="row-i" data-new="true"><span class="edge"></span><div><div class="t-card">' + d[0] + ' <span class="newmark">New</span></div><div class="t-small">' + d[1] + '</div></div><span class="t-meta">' + t + '</span></div></div>';
    $('#s15l').prepend(w); await nextFrame(); w.dataset.open = 'true'; say(d[0]);
    var row = $('.row-i', w); setTimeout(function () { row.dataset.new = 'false'; }, 8000);
  };

  /* ── 16 action states + save feedback ──────────────────────────────── */
  ACT['s16.btn'] = async function (b) { $('#s16err').dataset.show = 'false'; var r = await run(b, server); if (!r.ok) { var e = $('#s16err'); e.textContent = 'Couldn’t save. Nothing changed — try again.'; e.dataset.show = 'true'; } };
  ACT['s16.del'] = ACT['s16.btn'];
  SC.s16 = { reset: function () { $('#s16err').dataset.show = 'false'; var f = $('#s16f'); f.value = 'Spring launch'; delete f.dataset.flash; $('#s16m').dataset.show = 'false'; $('#s16c').checked = false; $('#s16d').style.background = ''; } };
  var CH = {
    's16.field': async function (inp) { var m = $('#s16m'); delete inp.dataset.flash; msg(m, 'Saving…', '', 0); try { await server(); flash(inp, 'success', 1200); msg(m, 'Saved', 'success', 1800); say('Saved.'); } catch (e) { flash(inp, 'error', 0); msg(m, 'Not saved — try again', 'error', 0); say('Not saved.'); } },
    's16.dot': async function (inp) { var d = $('#s16d'); d.style.background = 'var(--os-text-2)'; try { await server(); d.style.background = 'var(--os-success)'; setTimeout(function () { d.style.background = ''; }, 1600); } catch (e) { inp.checked = !inp.checked; d.style.background = 'var(--os-danger)'; setTimeout(function () { d.style.background = ''; }, 1600); say('Setting not saved and was reverted.'); } }
  };
  document.addEventListener('change', function (e) { var t = e.target.closest('[data-do-change]'); if (t && CH[t.dataset.doChange]) CH[t.dataset.doChange](t); });

  /* ── 17 errors / toast ─────────────────────────────────────────────── */
  SC.s17 = { reset: function () { $('#s17e').value = ''; $('#s17ee').textContent = ''; $('#s17e').removeAttribute('aria-invalid'); $('#s17m').dataset.show = 'false'; $('#s17ok').dataset.show = 'false'; } };
  $('#s17f').addEventListener('submit', async function (e) {
    e.preventDefault(); var i = $('#s17e'), er = $('#s17ee'); $('#s17m').dataset.show = 'false';
    if (!/^\S+@\S+\.\S+$/.test(i.value)) { er.textContent = 'Enter an email like name@company.com.'; i.setAttribute('aria-invalid', 'true'); i.focus(); return; }
    er.textContent = ''; i.removeAttribute('aria-invalid');
    try { await server(); msg($('#s17ok'), 'Saved', 'success', 2200); } catch (x) { var m = $('#s17m'); m.textContent = 'Couldn’t reach the server. Your entry is kept — try again.'; m.dataset.show = 'true'; }
  });
  ACT['s17.perm'] = function () { var m = $('#s17m'); m.textContent = 'You don’t have permission to change this. Ask the owner for edit access.'; m.dataset.show = 'true'; };
  ACT['s17.conflict'] = function () { var m = $('#s17m'); m.textContent = 'This changed since you opened it (updated 2 min ago). Reload to see the latest — your text is kept.'; m.dataset.show = 'true'; };
  ACT['s17.toast'] = function () { toast('Delivery link saved for “Landing page hero”', 'success'); };

  /* ── 18 inspector ──────────────────────────────────────────────────── */
  var S18 = [['Sep 19 · Premiere Pro', '14h 20m', ['warning', 'Review'], 'Observed by Sensor; not a Work Session. Review to correct the length.'], ['Sep 19 · Safari', '0h 51m', ['done', 'Approved'], 'Browser surface; window titles are off.'], ['Sep 18 · Premiere Pro', '6h 05m', ['done', 'Approved'], 'Matches an existing Work Session.'], ['Sep 18 · Finder', '0h 18m', ['done', 'Approved'], 'Short utility session.']];
  var s18 = { m: 'auto', sel: null };
  SC.s18 = { reset: function () { closeInsp(true); s18.m = 'auto'; $$('#s18m button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.m === 'auto'); }); $('#s18b').innerHTML = S18.map(function (r, i) { return '<tr tabindex="0" data-i="' + i + '" aria-selected="false"><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td><span class="st" data-status="' + r[2][0] + '"><span class="lbl">' + r[2][1] + '</span></span></td></tr>'; }).join(''); } };
  function mode() { if (s18.m !== 'auto') return s18.m; return $('#s18w').offsetWidth < 560 ? 'sheet' : 'inspector'; }
  function closeInsp(quiet) {
    var i = $('#s18i'); i.dataset.open = 'false'; $$('#s18b tr.detail-row').forEach(function (r) { r.remove(); });
    $$('#s18b tr[aria-selected="true"]').forEach(function (r) { r.setAttribute('aria-selected', 'false'); if (!quiet) r.focus(); }); s18.sel = null;
  }
  function openInsp(tr) {
    closeInsp(true); var i = +tr.dataset.i, d = S18[i], m = mode(); tr.setAttribute('aria-selected', 'true'); s18.sel = tr;
    if (m === 'inplace') { var dr = document.createElement('tr'); dr.className = 'detail-row'; dr.innerHTML = '<td colspan="3"><div class="reveal" data-open="false"><div class="in"><div class="in" style="padding:10px 12px">' + d[3] + '</div></div></div></td>'; tr.after(dr); nextFrame().then(function () { $('.reveal', dr).dataset.open = 'true'; }); return; }
    var p = $('#s18i'); p.dataset.mode = m === 'sheet' ? 'sheet' : ''; $('#s18t').textContent = d[0]; $('#s18d').textContent = d[1] + ' · ' + d[3]; p.dataset.open = 'true'; setTimeout(function () { $('#s18t').focus({ preventScroll: true }); }, 30); say('Details opened for ' + d[0]);
  }
  document.addEventListener('click', function (e) { var tr = e.target.closest('#s18b tr[data-i]'); if (tr) openInsp(tr); });
  document.addEventListener('keydown', function (e) { var tr = e.target.closest && e.target.closest('#s18b tr[data-i]'); if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openInsp(tr); } if (e.key === 'Escape' && $('#s18i').dataset.open === 'true' && e.target.closest('#s18w')) closeInsp(); });
  ACT['s18.close'] = function () { closeInsp(); };

  /* ── 19 war room lanes ─────────────────────────────────────────────── */
  var LANES = ['active', 'next', 'blocked', 'review', 'done'];
  function lane(n) { return $('.lane[data-lane="' + n + '"] .items'); }
  function count() { LANES.forEach(function (n) { var c = $('.lane[data-lane="' + n + '"] .vc'); changeValue(c, String(lane(n).children.length), 'crossfade'); }); }
  function tk(id, t, sub) { var d = document.createElement('div'); d.className = 'tk'; d.dataset.id = id; d.innerHTML = t + '<small>' + sub + '</small>'; return d; }
  SC.s19 = { reset: function () {
    $('#s19l').innerHTML = LANES.map(function (n) { return '<div class="lane" data-lane="' + n + '"><h4><span>' + n + '</span><span class="vc" data-vc="crossfade"><span>0</span></span></h4><div class="items" style="display:grid;gap:8px"></div></div>'; }).join('');
    lane('active').append(tk('V-14', 'Lecture cut', 'V-14 · editing'));
    lane('next').append(tk('V-15', 'Story cut', 'V-15 · planned'), tk('V-16', 'Hero cut', 'V-16 · planned'));
    lane('review').append(tk('V-12', 'Intro clip', 'V-12 · with client')); lane('done').append(tk('V-09', 'Teaser', 'V-09 · done'));
    $$('.vc', $('#s19l')).forEach(function (c, i) { c.firstElementChild.textContent = String(lane(LANES[i]).children.length); }); $('#s19m').dataset.show = 'false';
  } };
  function move(t, to, atTop) {
    var f = t.getBoundingClientRect(); var L = lane(to); if (atTop) L.prepend(t); else L.append(t); var l = t.getBoundingClientRect();
    if (!reduced()) t.animate([{ transform: 'translate(' + (f.left - l.left) + 'px,' + (f.top - l.top) + 'px)' }, { transform: 'none' }], { duration: dur(240), easing: 'cubic-bezier(.2,0,0,1)' });
    count();
  }
  function first(n) { return lane(n).firstElementChild; }
  function none(n) { msg($('#s19m'), 'No ticket in ' + n.toUpperCase(), '', 1800); }
  ACT['s19.start'] = function () { var t = first('next'); if (!t) return none('next'); if (first('active')) { msg($('#s19m'), 'One ticket is already active', '', 1800); return; } move(t, 'active', true); $('small', t).textContent = t.dataset.id + ' · editing'; say(t.firstChild.textContent + ' is now active.'); };
  ACT['s19.block'] = function () { var t = first('active'); if (!t) return none('active'); move(t, 'blocked'); $('small', t).textContent = t.dataset.id + ' · waiting on footage'; msg($('#s19m'), 'Exception: ' + t.firstChild.textContent + ' blocked — waiting on footage', 'error', 3000); say(t.firstChild.textContent + ' is blocked.'); };
  ACT['s19.review'] = function () { var t = first('active'); if (!t) return none('active'); move(t, 'review'); $('small', t).textContent = t.dataset.id + ' · with client'; say(t.firstChild.textContent + ' sent to review.'); };
  ACT['s19.done'] = function () { var t = first('review'); if (!t) return none('review'); move(t, 'done', true); $('small', t).textContent = t.dataset.id + ' · done'; flash(t, 'success', 1600); say(t.firstChild.textContent + ' approved and done.'); };

  /* ── 20 chart recipes ──────────────────────────────────────────────── */
  var DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], HRS = [250, 310, 275, 340, 190, 60];
  var hm = function (m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); };
  var s20 = { n: 6, sp: [3.2, 4.1, 3.8, 5.0, 4.4, 2.6, 3.9, 4.8], r: 'all' };
  function s20v(newIdx) {
    var el = $('#s20v'); el.innerHTML = ''; var mx = 400;
    for (var i = 0; i < s20.n; i++) { var c = document.createElement('div'); c.className = 'c' + (i === newIdx ? ' new' : ''); if (i === s20.n - 1) c.dataset.current = 'true'; c.tabIndex = 0; c.setAttribute('aria-label', DAYS[i] + ' ' + hm(HRS[i]) + ' hours:minutes'); c.innerHTML = '<span class="val">' + hm(HRS[i]) + '</span><div class="col" style="--h:' + Math.round(HRS[i] / mx * 100) + '"></div>'; el.appendChild(c); }
    $('#s20vl').innerHTML = DAYS.slice(0, s20.n).map(function (d) { return '<span>' + d + '</span>'; }).join('');
  }
  function s20s(tail) {
    var p = s20.sp.slice(0, 12), w = 240, h = 64, mx = 6, x = function (i) { return (i / 11) * w; }, y = function (v) { return h - 6 - (v / mx) * (h - 12); };
    var pts = p.map(function (v, i) { return x(i) + ',' + y(v); }); var base = 'M' + pts.slice(0, tail ? -1 : undefined).join(' L');
    var html = '<path d="' + base + '"/>'; if (tail) html += '<path class="tail" d="M' + pts.slice(-2).join(' L') + '"/>';
    var l = p.length - 1; html += '<path d="M' + x(l) + ',' + y(p[l]) + ' h0" style="stroke:var(--os-violet-text);stroke-width:6"/>'; $('#s20s').innerHTML = html; $('#s20st').textContent = 'Latest ' + p[l].toFixed(1) + 'h · ' + p.length + ' days · hours are exact, line is not a forecast';
  }
  var STRIP = [[0, 10, 'fact'], [10, 6, 'unknown'], [16, 22, 'fact'], [38, 10, 'derived'], [48, 8, 'unknown'], [56, 24, 'fact', true], [80, 20, 'unknown']];
  function s20t() { $('#s20t').innerHTML = STRIP.map(function (b) { return '<b data-source="' + b[2] + '"' + (b[3] ? ' data-current="true"' : '') + ' style="--x:' + b[0] + ';--w:' + b[1] + '" title="' + b[2] + '"></b>'; }).join(''); $('#s20t').setAttribute('aria-label', 'Session timeline: observed blocks, one derived block and unobserved gaps'); }
  var BINS = ['<15m', '15–30', '30–60', '1–2h', '2–4h', '>4h'], DIST = { all: [3, 5, 9, 7, 4, 1], client: [1, 3, 7, 6, 3, 0] };
  function s20d(first) {
    var el = $('#s20d'), v = DIST[s20.r], mx = 10;
    if (first || !el.children.length) { el.innerHTML = v.map(function (n, i) { return '<div class="c" tabindex="0" aria-label="' + BINS[i] + ': ' + n + ' sessions"><span class="val">' + n + '</span><div class="col" style="--h:' + n / mx * 100 + '"></div></div>'; }).join(''); $('#s20dl').innerHTML = BINS.map(function (b) { return '<span>' + b + '</span>'; }).join(''); }
    else { $$('.c', el).forEach(function (c, i) { $('.val', c).textContent = v[i]; $('.col', c).style.setProperty('--h', v[i] / mx * 100); c.setAttribute('aria-label', BINS[i] + ': ' + v[i] + ' sessions'); }); }
  }
  SC.s20 = { reset: function () { s20.n = 6; s20.sp = [3.2, 4.1, 3.8, 5.0, 4.4, 2.6, 3.9, 4.8]; s20.r = 'all'; s20v(); s20s(false); s20t(); s20d(true); $$('#s20r button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.r === 'all'); }); } };
  ACT['s20.point'] = function () { if (s20.n >= 7) { say('All days shown'); return; } HRS.push(220); s20.n++; s20v(s20.n - 1); say('Sunday added: 3:40'); };
  ACT['s20.spark'] = function () { if (s20.sp.length >= 12) { s20.sp = s20.sp.slice(0, 8); s20s(false); return; } s20.sp.push(+(2 + Math.random() * 3.5).toFixed(1)); s20s(true); };

  /* ── 21 public ─────────────────────────────────────────────────────── */
  var io;
  SC.s21 = { reset: function () { var r = $('#s21r'); r.classList.remove('is-in'); nextFrame().then(function () { r.classList.add('is-in'); }); } };
  ACT['s21.replay'] = function () { SC.s21.reset(); };
  ACT['s21.close'] = function () { closeDialog($('#s21m')); };
  var coarse = window.matchMedia('(hover: none)');
  $$('.wf').forEach(function (w) { w.addEventListener('click', function () {
    if (coarse.matches && w.dataset.touch !== 'true') { $$('.wf').forEach(function (x) { delete x.dataset.touch; }); w.dataset.touch = 'true'; return; }
    var d = $('#s21m'); openDialog(d, w); $('#s21p').style.setProperty('--v', 0); $('#s21s').textContent = 'Loading poster…';
    nextFrame().then(function () { $('#s21p').style.setProperty('--v', 100); }); setTimeout(function () { $('#s21s').textContent = 'Poster ready · play is user-initiated (no autoplay)'; }, dur(500) + 200);
  }); });
  $('#s21c input').addEventListener('input', function (e) { $('#s21c').style.setProperty('--p', e.target.value); });
  if ('IntersectionObserver' in window) { io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } }); }, { threshold: .3 }); io.observe($('#s21r')); } else { $('#s21r').classList.add('is-in'); }

  /* ── dialog wiring (Esc + backdrop use the exit animation) ─────────── */
  $$('dialog.osm').forEach(function (d) {
    d.addEventListener('cancel', function (e) { e.preventDefault(); closeDialog(d); });
    d.addEventListener('click', function (e) { if (e.target === d) closeDialog(d); });
    d.addEventListener('close', function () { if (d._t && d._t.focus) d._t.focus(); });
  });

  /* ── global wiring ─────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-do]');
    if (b && b.getAttribute('aria-disabled') !== 'true' && ACT[b.dataset.do]) ACT[b.dataset.do](b, e);
    var r = e.target.closest('[data-reset]'); if (r && SC[r.dataset.reset]) SC[r.dataset.reset].reset();
    var seg = e.target.closest('.seg2 button');
    if (seg) { $$('button', seg.parentElement).forEach(function (x) { x.setAttribute('aria-pressed', x === seg); });
      if (seg.parentElement.id === 'm-treat') s5.mode = seg.dataset.vc;
      if (seg.parentElement.id === 's6win') { s6.w = seg.dataset.w; if (!s6.empty) s6update(false); }
      if (seg.parentElement.id === 's18m') s18.m = seg.dataset.m;
      if (seg.parentElement.id === 's20r') { s20.r = seg.dataset.r; s20d(false); } }
    var row = e.target.closest('#s6hb .r'); if (row) { var i = +row.dataset.i, on = s6.sel === i; s6.sel = on ? null : i; s6rows().forEach(function (x) { x.setAttribute('aria-pressed', +x.dataset.i === s6.sel); }); s6sel(); }
  });
  $('#s6sort').addEventListener('change', function () { s6flip(s6order); });
  $('#s6unk').addEventListener('change', function (e) { var u = s6rows().filter(function (r) { return r.dataset.source === 'unknown'; })[0]; if (!u) return; if (e.target.checked) { u.hidden = false; u.classList.remove('enter'); void u.offsetWidth; u.classList.add('enter'); } else u.hidden = true; });
  $('#s7gray').addEventListener('change', function (e) { $('#s7').querySelector('.stage').classList.toggle('gray', e.target.checked); });
  function setMotion(on) { root.dataset.motion = on ? 'reduced' : 'full'; var b = $('#motionToggle'); b.setAttribute('aria-pressed', on); b.textContent = 'Reduced motion: ' + (on ? 'on' : 'off'); }
  $('#motionToggle').addEventListener('click', function () { setMotion(!reduced()); });
  mql.addEventListener && mql.addEventListener('change', function () { setMotion(mql.matches); });
  $('#intensity').addEventListener('change', function (e) { document.body.dataset.intensity = e.target.value; });
  $('#toc').innerHTML = $$('.scene').map(function (s, i) { return '<a href="#' + s.id + '">' + (i + 1) + ' ' + s.dataset.title + '</a>'; }).join('');

  setMotion(mql.matches);
  Object.keys(SC).forEach(function (k) { SC[k].reset(); });
  tabs('#s12a', '#s12pa', ['Overview panel — large tables swap instantly; only the rule moves.', 'Videos panel', 'Evidence panel'], false);
  tabs('#s12b', '#s12pb', ['Notes panel', 'Links panel', 'Format panel'], true);
  document.body.dataset.ready = 'true';
  window.__lab = { SC: SC, ACT: ACT, setMotion: setMotion };  // for automated checks only
})();
