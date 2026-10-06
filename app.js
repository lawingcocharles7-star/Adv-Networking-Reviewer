/* App logic. Lessons come from data/lessons.js (LESSONS array, in class order). */
const $ = (s, el = document) => el.querySelector(s);
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem('anr_' + k)) ?? d; } catch { return d; } },
  set: (k, v) => localStorage.setItem('anr_' + k, JSON.stringify(v)) };
const tabs = [['notes', '📖 Notes'], ['cards', '🃏 Flashcards'], ['quiz', '📝 Quiz'], ['calc', '🧮 Calculators'], ['exam', '⏱️ Mock Exam']];
let state = { tab: store.get('tab', 'notes'), lesson: store.get('lesson', 0) };
const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

function renderNav() {
  $('#nav').innerHTML = tabs.map(([k, l]) => `<button class="${state.tab === k ? 'active' : ''}" data-t="${k}">${l}</button>`).join('');
  $('#nav').onclick = e => { const t = e.target.dataset.t; if (t) { state.tab = t; store.set('tab', t); render(); } };
}
function lessonSide(allowAll) {
  const done = store.get('done', {});
  return `<div class="side">${allowAll ? `<button data-l="all" class="${state.lesson === 'all' ? 'active' : ''}">★ All lessons</button>` : ''}` +
    LESSONS.map((l, i) => `<button data-l="${i}" class="${state.lesson == i ? 'active' : ''} ${done[l.id] ? 'done' : ''}">${i + 1}. ${esc(l.title)}</button>`).join('') + '</div>';
}
function bindSide() {
  document.querySelectorAll('.side button').forEach(b => b.onclick = () => {
    state.lesson = b.dataset.l === 'all' ? 'all' : +b.dataset.l; store.set('lesson', state.lesson); render(); window.scrollTo(0, 0); });
}
function pool(kind) {
  if (state.lesson === 'all') return LESSONS.flatMap(l => (l[kind] || []).map(x => ({ ...x, _l: l.title })));
  return (LESSONS[state.lesson][kind] || []);
}

/* ---------- Notes ---------- */
function viewNotes() {
  if (state.lesson === 'all') state.lesson = 0;
  const l = LESSONS[state.lesson], done = store.get('done', {});
  $('#app').innerHTML = `<div class="layout">${lessonSide(false)}<div><div class="card"><h2>${esc(l.title)}</h2>${l.notes}
    <div class="row"><button class="btn" id="mk">${done[l.id] ? '✓ Marked as reviewed' : 'Mark as reviewed'}</button>
    ${state.lesson < LESSONS.length - 1 ? '<button class="btn alt" id="nx">Next lesson →</button>' : ''}</div></div></div></div>`;
  bindSide();
  $('#mk').onclick = () => { done[l.id] = !done[l.id]; store.set('done', done); render(); };
  if ($('#nx')) $('#nx').onclick = () => { state.lesson++; store.set('lesson', state.lesson); render(); window.scrollTo(0, 0); };
}

/* ---------- Flashcards ---------- */
function viewCards() {
  const deck = shuffle(pool('cards')); let i = 0, shown = false;
  $('#app').innerHTML = `<div class="layout">${lessonSide(true)}<div id="fc"></div></div>`; bindSide();
  const draw = () => {
    if (!deck.length) { $('#fc').innerHTML = '<div class="card">No flashcards for this lesson yet.</div>'; return; }
    const c = deck[i];
    $('#fc').innerHTML = `<div class="muted">Card ${i + 1} / ${deck.length} ${c._l ? '• ' + esc(c._l) : ''}</div>
      <div class="bar"><div style="width:${(i + 1) / deck.length * 100}%"></div></div><br>
      <div class="flash" id="card">${shown ? esc(c.a) : esc(c.q)}</div>
      <p class="muted" style="text-align:center">${shown ? 'Answer' : 'Question'} — click card to flip</p>
      <div class="row" style="justify-content:center"><button class="btn alt" id="pv">← Prev</button><button class="btn" id="fl">Flip</button><button class="btn alt" id="nt">Next →</button></div>`;
    const flip = () => { shown = !shown; draw(); };
    $('#card').onclick = flip; $('#fl').onclick = flip;
    $('#pv').onclick = () => { i = (i - 1 + deck.length) % deck.length; shown = false; draw(); };
    $('#nt').onclick = () => { i = (i + 1) % deck.length; shown = false; draw(); };
  };
  draw();
}

/* ---------- Quiz (shared engine for Quiz + Exam) ---------- */
function runQuiz(items, mount, opts = {}) {
  let i = 0, score = 0, answered = false; const missed = [];
  const draw = () => {
    if (i >= items.length) {
      const pct = Math.round(score / items.length * 100);
      mount.innerHTML = `<div class="card"><h2>Result: ${score} / ${items.length} (${pct}%)</h2>
        <p>${pct >= 80 ? '🎉 Solid! You\'re exam-ready on this set.' : pct >= 60 ? '👍 Getting there — review the missed items.' : '📚 Keep studying, then retry.'}</p>
        ${missed.length ? '<h3>Review these</h3>' + missed.map(m => `<div class="tip"><b>${esc(m.q)}</b><br>✔ ${esc(m.o[m.a])}<br><span class="muted">${esc(m.e || '')}</span></div>`).join('') : ''}
        <button class="btn" id="rt">Try again</button></div>`;
      $('#rt', mount).onclick = () => opts.restart(); if (opts.onDone) opts.onDone(score, items.length); return;
    }
    const q = items[i]; answered = false;
    const order = shuffle(q.o.map((t, k) => k));
    mount.innerHTML = `<div class="muted">Question ${i + 1} / ${items.length} • Score ${score} ${q._l ? '• ' + esc(q._l) : ''}</div>
      <div class="bar"><div style="width:${i / items.length * 100}%"></div></div>
      <div class="card"><h3 style="margin-top:0;color:var(--ink);white-space:pre-wrap">${esc(q.q)}</h3>
      ${order.map(k => `<button class="opt" data-k="${k}">${esc(q.o[k])}</button>`).join('')}
      <div id="fb"></div></div>`;
    mount.querySelectorAll('.opt').forEach(b => b.onclick = () => {
      if (answered) return; answered = true; const k = +b.dataset.k;
      mount.querySelectorAll('.opt').forEach(x => { if (+x.dataset.k === q.a) x.classList.add('right'); });
      if (k === q.a) score++; else { b.classList.add('wrong'); missed.push(q); }
      $('#fb', mount).innerHTML = `<p>${k === q.a ? '<span class="ok">Correct!</span>' : '<span class="bad">Not quite.</span>'} ${esc(q.e || '')}</p><button class="btn qz-next-btn">${i + 1 < items.length ? 'Next' : 'Finish'}</button>`;
      const nextBtn = mount.querySelector('.qz-next-btn');
      if (nextBtn) {
        nextBtn.onclick = () => { i++; draw(); };
      }
    });
  };
  draw();
}
/* Auto-generated subnetting questions so friends can drill endlessly. */
function genQuestions(n) {
  const out = [], r = a => a[Math.floor(Math.random() * a.length)];
  const make = (q, correct, wrongs, e) => { const o = shuffle([...new Set([correct, ...wrongs.map(String)])]); while (o.length < 4) o.push(String(Math.floor(Math.random() * 500))); const opts = o.slice(0, 4); if (!opts.includes(String(correct))) opts[0] = String(correct); out.push({ q, o: opts, a: opts.indexOf(String(correct)), e, _l: 'Generated drill' }); };
  for (let k = 0; k < n; k++) {
    const t = Math.floor(Math.random() * 4), p = 20 + Math.floor(Math.random() * 11);
    if (t === 0) { const u = Math.pow(2, 32 - p) - 2; make(`How many usable hosts are in a /${p} network?`, u, [u * 2 + 2, u / 2 - 1, Math.pow(2, 32 - p)], `2^${32 - p} − 2 = ${u}.`); }
    else if (t === 1) { const m = Calc.ipv4('10.0.0.0', p).mask; make(`What is the subnet mask for /${p}?`, m, [Calc.ipv4('10.0.0.0', p - 1).mask, Calc.ipv4('10.0.0.0', p + 1).mask, Calc.ipv4('10.0.0.0', p + 2).mask], `/${p} = ${m}.`); }
    else if (t === 2) { const ip = `192.168.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 254) + 1}`, c = 24 + Math.floor(Math.random() * 6), x = Calc.ipv4(ip, c);
      const w = [Calc.ipv4(ip, c + 1).network, Calc.ipv4(ip, c - 1).network, x.broadcast]; make(`What is the network address of ${ip}/${c}?`, x.network, w, `AND the IP with the mask ${x.mask}. Block size ${x.block}.`); }
    else { const h = r([10, 25, 50, 100, 200, 500, 1000]); let b = 2; while (Math.pow(2, b) - 2 < h) b++; make(`Smallest prefix that fits ${h} hosts (VLSM)?`, '/' + (32 - b), ['/' + (32 - b + 1), '/' + (32 - b - 1), '/' + (32 - b + 2)], `Need 2^h − 2 ≥ ${h} → h = ${b} host bits → /${32 - b}.`); }
  }
  return out;
}
function viewQuiz() {
  $('#app').innerHTML = `<div class="layout">${lessonSide(true)}<div id="qz"></div></div>`; bindSide();
  const start = () => {
    const items = shuffle(pool('quiz'));
    if (!items.length) { $('#qz').innerHTML = '<div class="card">No quiz for this lesson yet.</div>'; return; }
    runQuiz(items, $('#qz'), { restart: start });
  }; start();
}
function viewExam() {
  const root = $('#app'); const hist = store.get('exam', []);
  root.innerHTML = `<div class="card"><h2>⏱️ Mock Exam</h2><p>Random questions from <b>all lessons</b> plus generated subnetting drills.</p>
    <div class="row"><label>Questions <select id="n"><option>10</option><option selected>20</option><option>30</option><option>40</option></select></label>
    <label>Minutes <select id="m"><option>10</option><option selected>20</option><option>30</option><option>45</option></select></label>
    <button class="btn" id="start-exam-btn">Start exam</button></div>
    ${hist.length ? '<h3>Past attempts</h3>' + hist.slice(-5).reverse().map(h => `<div class="muted">${h.d}: ${h.s}/${h.t}</div>`).join('') : ''}</div><div id="ex"></div>`;
  $('#start-exam-btn').onclick = () => {
    const n = +$('#n').value, mins = +$('#m').value;
    const bank = LESSONS.flatMap(l => (l.quiz || []).map(x => ({ ...x, _l: l.title })));
    const items = shuffle([...shuffle(bank).slice(0, Math.ceil(n * .7)), ...genQuestions(n)]).slice(0, n);
    let left = mins * 60; const mount = $('#ex'); mount.innerHTML = '<div id="tm" class="card" style="font-weight:700"></div><div id="qb"></div>';
    const tm = setInterval(() => { left--; const e = $('#tm'); if (!e) return clearInterval(tm);
      e.textContent = `⏳ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; if (left <= 0) { clearInterval(tm); e.textContent = "⌛ Time's up! Refresh to retry."; $('#qb').innerHTML = ''; } }, 1000);
    runQuiz(items, $('#qb'), { restart: viewExam, onDone: (s, t) => { clearInterval(tm); const h = store.get('exam', []); h.push({ d: new Date().toLocaleString(), s, t }); store.set('exam', h); } });
  };
}

/* ---------- Calculators ---------- */
function viewCalc() {
  $('#app').innerHTML = `
  <div class="card"><h2>IPv4 Subnet Calculator</h2><div class="row"><input id="ip" value="200.200.200.10" placeholder="IP"><span>/</span><input id="cd" type="number" min="0" max="32" value="27" style="width:80px"><button class="btn" id="b1">Calculate</button></div><div id="o1"></div></div>
  <div class="card"><h2>VLSM Calculator</h2><p class="muted">Starting block and one requirement per line as <code>Name, hosts</code> (or just a number).</p>
    <div class="row"><input id="vb" value="192.168.50.0/24"></div><textarea id="vr">Game Development, 55\nEsports Operations, 27\nPlayer Support, 13\nExecutive Suite, 4\nPoint-to-point link, 2</textarea>
    <div class="row"><button class="btn" id="b2">Calculate VLSM</button></div><div id="o2"></div></div>
  <div class="card"><h2>IPv6 Subnet Calculator</h2><div class="row"><input id="v6" value="2001:db8:1234::" style="width:260px"><span>/</span><input id="f6" type="number" value="48" style="width:80px"><span>→ /</span><input id="t6" type="number" value="52" style="width:80px"><button class="btn" id="b3">Calculate</button></div><div id="o3"></div></div>`;
  const run = (id, fn) => { try { $(id).innerHTML = fn(); } catch (e) { $(id).innerHTML = `<p class="bad">${esc(e.message)}</p>`; } };
  const tbl = (h, rows) => `<table><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>`;
  $('#b1').onclick = () => run('#o1', () => { const x = Calc.ipv4($('#ip').value, $('#cd').value);
    return tbl(['Class', 'Mask', 'Network', 'First usable', 'Last usable', 'Broadcast', 'Usable hosts', 'Block size'], [[x.class, x.mask, x.network, x.first, x.last, x.broadcast, x.usable, x.block]]); });
  $('#b2').onclick = () => run('#o2', () => { const reqs = $('#vr').value.split('\n').map(s => s.trim()).filter(Boolean).map((s, i) => { const p = s.split(','); return p.length > 1 ? { name: p[0].trim(), hosts: +p[1] } : { name: 'Subnet ' + (i + 1), hosts: +p[0] }; });
    return tbl(['Subnet', 'Need', 'Network ID', 'Mask', 'Usable range', '# Usable', 'Broadcast'], Calc.vlsm($('#vb').value, reqs).map(r => r.error ? [r.name, r.need, r.error, '', '', '', ''] : [r.name, r.need, r.network, r.prefix + ' (' + r.mask + ')', r.first + ' - ' + r.last, r.usable, r.broadcast])); });
  $('#b3').onclick = () => run('#o3', () => { const x = Calc.ipv6($('#v6').value, $('#f6').value, $('#t6').value);
    return `<p>Borrowed bits: <b>${x.borrowed}</b> • Subnets: <b>${x.count}</b> • Increment: <code>${x.increment}</code> • /64s per subnet: <b>${x.slash64}</b> ${x.shown < +x.count ? `<br><span class="muted">(showing first ${x.shown})</span>` : ''}</p>` +
      tbl(['#', 'Subnet prefix', 'First address', 'Last address'], x.rows.map(r => [r.n, r.prefix, r.first, r.lastFull])); });
  $('#b1').click(); $('#b2').click(); $('#b3').click();
}

function render() {
  renderNav();
  ({ notes: viewNotes, cards: viewCards, quiz: viewQuiz, calc: viewCalc, exam: viewExam })[state.tab]();
}
if (state.lesson !== 'all' && !LESSONS[state.lesson]) state.lesson = 0;
render();
