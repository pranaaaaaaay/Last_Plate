const $ = s => document.querySelector(s);
const S = { donations: [], speed: 30, sel: null, draft: null, tab: 'intake', newId: null, nums: {} };
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const NG = {
  'Seva Kitchen': { x: 30, y: 20, km: 2, cap: 20, acc: 'cooked, bakery, produce, packaged', ic: 'cooked' },
  'Hope Shelter': { x: 62, y: 16, km: 5, cap: 12, acc: 'cooked, bakery, dairy', ic: 'bakery' },
  'Annapurna Trust': { x: 80, y: 42, km: 8, cap: 40, acc: 'all food types', ic: 'produce' },
  'City Food Bank': { x: 52, y: 54, km: 12, cap: 80, acc: 'all food types', ic: 'packaged' } };
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = h => { const m = Math.round(Math.max(0, h) * 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`; };
const col = f => f > .6 ? '#5EE0E0' : f > .35 ? '#5EE0A0' : f > .15 ? '#FFB02E' : '#FF5B49';
const left = d => d.status === 'confirmed' ? d.confirmedLeft : d.hrs - (Date.now() - d.created) / 3.6e6 * S.speed;
const cur = () => S.donations.find(d => d.id === S.sel);
const ico = (c, s = 30) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><use href="#f-${c}"/></svg>`;

async function api(p, body) {
  const r = await fetch('/api' + p, { signal: AbortSignal.timeout(25000), ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Something went wrong. Try again.'); return j;
}
let tt; function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200); }
function wash(type, e) { const w = $('#wash'); if (e && e.clientX != null) { w.style.setProperty('--x', e.clientX + 'px'); w.style.setProperty('--y', e.clientY + 'px'); } w.className = type; void w.offsetWidth; w.className = type + ' go'; }
function num(id, v, dec = 0) { const el = document.getElementById(id); if (!el) return; const from = S.nums[id] || 0; S.nums[id] = v;
  if (RM || from === v) { el.textContent = v.toFixed(dec); return; } const t0 = performance.now();
  (function f(t) { const p = Math.min(1, (t - t0) / 800), e = 1 - Math.pow(1 - p, 3); el.textContent = (from + (v - from) * e).toFixed(dec); if (p < 1) requestAnimationFrame(f); })(t0); }
function confetti() { const c = $('#clock'); if (!c || RM) return;
  for (let i = 0; i < 18; i++) { const s = document.createElement('i'); s.className = 'cf'; const a = i / 18 * 6.28, r = 90 + Math.random() * 70;
    s.style.cssText = `--dx:${Math.cos(a) * r}px;--dy:${Math.sin(a) * r}px;background:${['#5EE0A0', '#FFB02E', '#F6EEDF'][i % 3]}`; c.appendChild(s); setTimeout(() => s.remove(), 1200); } }

async function load() {
  const s = await api('/state'); S.donations = s.donations; S.speed = s.speed;
  $('#badges').innerHTML = `<span class="badge ${s.demo ? 'warn' : ''}">${s.demo ? 'Demo mode: no Gemini key' : 'Gemini live'}</span><span class="badge">${s.firebase ? 'Firestore on' : 'In-memory store'}</span><span class="badge">Demo clock ${s.speed}x</span>`;
  $('#audit').innerHTML = s.audit.map(e => `<li class="${e.level}">${esc(e.event)}<code>${new Date(e.ts).toLocaleTimeString()} · ${e.hash.slice(0, 10)}</code></li>`).join('');
  const m = s.metrics, i = s.impact;
  $('#metrics').innerHTML = `<h3>Rescued so far</h3><div class="big"><span id="n-meals">0</span> meals</div><dl><dt>Food</dt><dd><span id="n-kg">0</span> kg</dd><dt>CO2e avoided (est.)</dt><dd><span id="n-co2">0</span> kg</dd><dt>Pickups</dt><dd><span id="n-pick">0</span></dd></dl>
  <h3>AI performance</h3><dl><dt>Last analysis</dt><dd>${m.lastMs} ms</dd><dt>Average</dt><dd>${m.avgMs} ms</dd><dt>Cache hits</dt><dd>${m.hits}</dd><dt>Est. cost</dt><dd>$${m.cost}</dd></dl>`;
  num('n-meals', i.meals); num('n-kg', i.kg, 1); num('n-co2', i.co2, 1); num('n-pick', i.pickups);
  renderQueue(); if (S.tab === 'donation') stageDonation();
}
function renderQueue() {
  const ds = [...S.donations].sort((a, b) => (a.status === 'confirmed') - (b.status === 'confirmed') || left(a) - left(b));
  $('#queue').innerHTML = ds.length ? ds.map(d => `<li><button data-id="${d.id}" class="${d.id === S.newId ? 'fresh' : ''}" ${d.id === S.sel && S.tab === 'donation' ? 'aria-current="true"' : ''}><svg class="mini" viewBox="0 0 36 36" aria-hidden="true"><circle class="tr" cx="18" cy="18" r="14"/><circle class="mr" data-r="${d.id}" cx="18" cy="18" r="14"/></svg><span><b>${esc(d.items[0].name)}${d.items.length > 1 ? ' +' + (d.items.length - 1) : ''}</b><small data-t="${d.id}"></small></span>${d.id === S.newId ? '<em>New</em>' : ''}</button></li>`).join('')
    : '<li class="empty">No donations yet. Add the first one.</li>';
  document.querySelectorAll('#queue button').forEach(b => b.onclick = () => { S.sel = b.dataset.id; S.tab = 'donation'; renderQueue(); stageDonation(); });
  tickQueue();
}
function tickQueue() { S.donations.forEach(d => { const r = document.querySelector(`[data-r="${d.id}"]`), t = document.querySelector(`[data-t="${d.id}"]`); if (!r || !t) return;
  const f = Math.max(0, Math.min(1, left(d) / d.hrs)); r.style.strokeDasharray = 88; r.style.strokeDashoffset = 88 * (1 - f);
  r.style.stroke = d.status === 'confirmed' ? '#5EE0A0' : d.status === 'quarantined' ? '#FF5B49' : col(f);
  t.textContent = `${d.kg} kg · ` + (d.status === 'confirmed' ? 'handed off' : d.status === 'quarantined' ? 'quarantined' : fmt(left(d)) + ' left'); }); }

function stageIntake() {
  S.tab = 'intake'; renderQueue();
  $('#stage').innerHTML = `<div class="intake"><div class="orbit" aria-hidden="true"><span class="o">${ico('bakery', 56)}</span><span class="o">${ico('dairy', 56)}</span><span class="o">${ico('produce', 56)}</span><span class="o">${ico('packaged', 56)}</span><span class="c">${ico('cooked', 120)}</span></div>
  <h2>What food is left tonight?</h2><p>Add a photo. We read it, find who can take it in time, and watch the clock with you.</p>
  <label class="drop" id="drop" tabindex="0">Drop a photo here or choose one<input type="file" id="file" accept="image/jpeg,image/png,image/webp" hidden></label>
  <button class="primary" id="sample">Use sample photo</button></div>`;
  const f = $('#file'), dz = $('#drop');
  dz.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), f.click());
  f.onchange = () => f.files[0] && readFile(f.files[0]);
  dz.ondragover = e => (e.preventDefault(), dz.classList.add('over')); dz.ondragleave = () => dz.classList.remove('over');
  dz.ondrop = e => { e.preventDefault(); dz.classList.remove('over'); e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]); };
  $('#sample').onclick = () => analyze({ sample: true });
}
function readFile(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast('Use a JPG, PNG or WebP photo.');
  if (file.size > 4e6) return toast('That photo is over 4 MB. Choose a smaller one.');
  const url = URL.createObjectURL(file), im = new Image(); // shrink to 1024px JPEG: faster upload, cheaper Gemini call
  im.onload = () => { const k = Math.min(1, 1024 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', .82); URL.revokeObjectURL(url); analyze({ image: data.split(',')[1], mime: 'image/jpeg', preview: data }); };
  im.onerror = () => { URL.revokeObjectURL(url); toast('That photo could not be read. Try another.'); };
  im.src = url;
}
async function analyze(o) {
  $('#stage').innerHTML = `<div class="intake"><h2>Reading your photo</h2><p>Gemini is counting items and estimating how long each stays safe.</p><div class="skel"></div><div class="skel"></div><div class="skel"></div></div>`;
  try { S.draft = { ...(await api('/analyze', { image: o.image, mime: o.mime, sample: o.sample })), preview: o.preview }; stageDraft(); }
  catch (e) { toast(e.message); stageIntake(); }
}
function stageDraft() {
  const d = S.draft;
  $('#stage').innerHTML = `<div class="draft"><div>${d.preview ? `<img src="${d.preview}" alt="Your donation photo">` : `<div class="pic" role="img" aria-label="Sample food">${ico('cooked', 110)}</div>`}</div>
  <div><h2>We found ${d.items.length} items</h2><p class="meta">Read in ${d.ms} ms${d.cached ? ' (from cache)' : ''}${d.demo ? ' · sample data' : ''}</p>
  <ul class="items">${d.items.map((i, n) => `<li style="--i:${n}"><span>${ico(i.category, 38)}<span><b>${esc(i.name)}</b><br><small>${i.kg} kg · ${esc(i.category)}</small></span></span><span>safe for ${fmt(i.safe_hours_left)}</span></li>`).join('')}</ul>
  <label class="note">Note for the recipient (optional)<input id="note" maxlength="200" placeholder="Pickup at the back door"></label>
  <button class="primary" id="go">Find a recipient</button></div></div>`;
  $('#go').onclick = async e => { e.target.disabled = true;
    try { const n = await api('/donations', { items: d.items, note: $('#note').value }); S.draft = null; S.sel = n.id; S.tab = 'donation'; S.newId = n.id; setTimeout(() => { S.newId = null; renderQueue(); }, 7000);
      await load(); $('#stage').scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' });
      if (n.status === 'quarantined') { wash('red'); toast('Security tripwire fired. Check the log.'); } else if (n.status === 'unplaceable') wash('amber'); }
    catch (er) { toast(er.message); e.target.disabled = false; } };
}

function mapHTML(d) {
  const a = d.assigned;
  const mk = Object.entries(NG).map(([n, g]) => { const x = d.cancelled.includes(n), best = a && a.name === n;
    return `<g class="mk ${x ? 'x' : ''} ${best ? 'best' : ''}" tabindex="0" role="button" data-n="${esc(n)}" aria-label="${esc(n)}, ${g.km} km"><circle class="halo" cx="${g.x}" cy="${g.y}" r="4.6"/><circle cx="${g.x}" cy="${g.y}" r="3.4" fill="#0C262D" stroke="${x ? '#FF5B49' : best ? '#FFB02E' : '#5EE0E0'}" stroke-width=".7"/><svg x="${g.x - 2.2}" y="${g.y - 2.2}" width="4.4" height="4.4" viewBox="0 0 48 48"><use href="#f-${g.ic}"/></svg>${x ? `<path d="M${g.x - 1.8} ${g.y - 1.8}l3.6 3.6m0-3.6l-3.6 3.6" stroke="#FF5B49" stroke-width="1"/>` : ''}<text x="${g.x}" y="${g.y + 7.2}" text-anchor="middle">${esc(n)}</text></g>`; }).join('');
  let route = '';
  if (a) { const mx = (10 + a.x) / 2, my = Math.min(a.y, 36) - 12, p = `M10 36 Q ${mx} ${my} ${a.x} ${a.y}`;
    route = `<path class="flow" d="${p}"/><text class="eta" x="${mx}" y="${my + 1}" text-anchor="middle">${fmt(a.eta)} away</text><g>${RM ? '' : `<animateMotion dur="3.4s" repeatCount="indefinite" path="${p}"/>`}<circle r="2.8" fill="#FFB02E" opacity=".25"/><svg x="-2.4" y="-2.4" width="4.8" height="4.8" viewBox="0 0 48 48"><use href="#f-${d.items[0].category}"/></svg></g>`; }
  return `<div class="mapwrap"><svg id="map" viewBox="0 0 100 62" role="img" aria-label="Map of donor and recipients"><defs><pattern id="blk" width="6" height="6" patternUnits="userSpaceOnUse"><rect x="1" y="1" width="4" height="4" rx=".8" fill="#0E2B33"/></pattern></defs>
  <rect width="100" height="62" fill="#0A2128"/><rect width="100" height="62" fill="url(#blk)"/>
  <path class="river" d="M-2 49 C 20 40, 30 58, 55 46 S 90 30, 102 36"/>
  <rect x="38" y="24" width="14" height="9" rx="3" fill="#0F3B35"/><text x="45" y="29.5" text-anchor="middle">Green Park</text>
  <rect x="66" y="4" width="12" height="7" rx="3" fill="#0F3B35"/><rect x="4" y="46" width="14" height="9" rx="3" fill="#0F3B35"/>
  <path d="M0 36H100M0 14H100M0 56H100M20 0V62M44 0V62M70 0V62" stroke="#16404A" stroke-width="1.2" fill="none"/><path d="M0 62L100 8" stroke="#2a5a4e" stroke-width="1.6" fill="none"/>
  <text x="3" y="12">Old Market</text><text x="72" y="60">Riverside</text><text x="22" y="34">Station Road</text>
  ${route}<g><circle class="pulse" cx="10" cy="36" r="3"/><circle cx="10" cy="36" r="2" fill="#FFB02E"/><text x="10" y="42" text-anchor="middle" style="fill:#F6EEDF;font-weight:700">You</text></g>${mk}</svg>
  <div class="mapctl"><button id="zi" aria-label="Zoom in">+</button><button id="zo" aria-label="Zoom out">−</button><button id="zr" aria-label="Reset map">⌂</button></div>
  <div class="legend">Drag to pan · Ctrl + scroll to zoom · tap a marker</div><div id="tip" role="status"></div></div>`;
}
function wireMap(d) {
  const svg = $('#map'), wrap = $('.mapwrap'), tip = $('#tip'); let vb = { x: 0, y: 0, w: 100, h: 62 };
  const set = v => { vb = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); };
  const clamp = v => { v.w = Math.min(100, Math.max(25, v.w)); v.h = v.w * .62; v.x = Math.min(100 - v.w, Math.max(0, v.x)); v.y = Math.min(62 - v.h, Math.max(0, v.y)); return v; };
  const go = to => { to = clamp({ ...to }); if (RM) return set(to); const f = { ...vb }, t0 = performance.now();
    (function s(t) { const p = Math.min(1, (t - t0) / 550), e = 1 - Math.pow(1 - p, 3); set({ x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e, w: f.w + (to.w - f.w) * e, h: f.h + (to.h - f.h) * e }); if (p < 1) requestAnimationFrame(s); })(t0); };
  const pt = e => { const r = svg.getBoundingClientRect(); return { x: vb.x + (e.clientX - r.left) / r.width * vb.w, y: vb.y + (e.clientY - r.top) / r.height * vb.h }; };
  const zoom = (k, c) => go({ x: c.x - (c.x - vb.x) * k, y: c.y - (c.y - vb.y) * k, w: vb.w * k, h: vb.h * k });
  const mid = () => ({ x: vb.x + vb.w / 2, y: vb.y + vb.h / 2 });
  $('#zi').onclick = () => zoom(.7, mid()); $('#zo').onclick = () => zoom(1.4, mid()); $('#zr').onclick = () => (go({ x: 0, y: 0, w: 100, h: 62 }), tip.classList.remove('show'));
  svg.addEventListener('wheel', e => { if (!(e.ctrlKey || e.metaKey)) return; e.preventDefault(); zoom(e.deltaY < 0 ? .85 : 1.18, pt(e)); }, { passive: false });
  let drag = null; svg.onpointerdown = e => { if (e.target.closest('.mk')) return; drag = { sx: e.clientX, sy: e.clientY, v: { ...vb } }; svg.setPointerCapture(e.pointerId); tip.classList.remove('show'); };
  svg.onpointermove = e => { if (!drag) return; const r = svg.getBoundingClientRect(); set(clamp({ x: drag.v.x - (e.clientX - drag.sx) / r.width * drag.v.w, y: drag.v.y - (e.clientY - drag.sy) / r.height * drag.v.h, w: drag.v.w })); };
  svg.onpointerup = () => { drag = null; };
  const show = n => { const g = NG[n], c = d.candidates.find(x => x.name === n), r = svg.getBoundingClientRect();
    tip.innerHTML = `<b>${esc(n)}</b>${g.km} km away · takes up to ${g.cap} kg<br>Accepts ${esc(g.acc)}<br>${c ? `Arrives with ${fmt(c.slack)} to spare` : d.cancelled.includes(n) ? 'Cancelled this donation' : 'Cannot arrive in time'}`;
    tip.style.left = Math.min(r.width - 120, Math.max(120, (g.x - vb.x) / vb.w * r.width)) + 'px'; tip.style.top = (g.y - vb.y) / vb.h * r.height + 'px'; tip.classList.add('show'); };
  svg.querySelectorAll('.mk').forEach(m => { const n = m.dataset.n, g = NG[n];
    m.onmouseenter = m.onfocus = () => show(n); m.onmouseleave = m.onblur = () => tip.classList.remove('show');
    m.onclick = () => { go({ x: g.x - 20, y: g.y - 12.4, w: 40, h: 24.8 }); setTimeout(() => show(n), RM ? 0 : 580); };
    m.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), m.onclick()); });
}

function stageDonation() {
  const d = cur(); if (!d) return stageIntake();
  S.tab = 'donation'; const C = 2 * Math.PI * 100;
  const verdict = { proposed: d.safe ? ['Ready to hand off', 'ok'] : ['Waiting for your safety check', ''], confirmed: ['Handed off', 'ok'], unplaceable: ['No safe recipient in time', 'bad'], quarantined: ['Quarantined', 'bad'] }[d.status];
  const matches = d.candidates.length ? d.candidates.map((c, i) => `<div class="match ${i ? '' : 'first'}"><b>${esc(c.name)}${i ? '' : ' (best match)'}</b><span>${esc(c.reason)}</span></div>`).join('') : '<p class="empty">No recipient is left who can take this in time.</p>';
  let act = '';
  if (d.status === 'proposed' && !d.safe) act = `<button class="primary" id="safe">Confirm food is safe</button><button class="danger" id="cancel">Recipient cancelled</button>`;
  if (d.status === 'proposed' && d.safe) act = `<div class="slide" id="slide"><span>Slide to confirm handoff</span><button class="knob" aria-label="Confirm handoff">›</button></div><button class="danger" id="cancel">Recipient cancelled</button>`;
  if (d.status === 'unplaceable') act = `<button class="primary" id="reset">Reopen cancelled recipients</button>`;
  $('#stage').innerHTML = `<div class="hero" id="hero"><div class="clock" id="clock"><svg viewBox="0 0 220 220" aria-hidden="true"><circle class="track" cx="110" cy="110" r="100" fill="none" stroke-width="14"/><circle id="arc" cx="110" cy="110" r="100" fill="none" stroke-width="14" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg><div class="mid"><b id="ct">--</b><span id="cs">safe time left</span></div></div>
  <div><h2>${esc(d.items.map(i => i.name).join(', '))}</h2><p class="sub">${d.kg} kg · ${d.assigned ? 'heading to ' + esc(d.assigned.name) : 'no destination yet'}</p><span class="status ${verdict[1]}">${verdict[0]}</span><div class="actions">${act}</div></div></div>
  ${d.status === 'quarantined' ? `<div class="warnbox"><b>Tripwire fired.</b> The donor note tried to make the agent call a tool it should never touch. The note was ignored and nothing was released.</div>` : ''}
  ${mapHTML(d)}
  <div class="cols"><div><h3>Who can take it</h3>${matches}</div><div><h3>What the agent did</h3><ol class="tl">${d.timeline.map(t => `<li><time>${new Date(t.t).toLocaleTimeString()}</time>${esc(t.text)}</li>`).join('')}</ol></div></div>`;
  wireMap(d);
  const run = (p, msg, w) => async ev => { try { const n = await api(`/donations/${d.id}/${p}`, {}); await load();
    if (w) wash(n.status === 'unplaceable' ? 'amber' : w, ev); if (p === 'cancel') { const h = $('#hero'); h && !RM && h.classList.add('shake'); }
    if (p === 'confirm') confetti(); toast(n.status === 'unplaceable' ? 'No safe recipient in time.' : msg); } catch (e) { toast(e.message); } };
  $('#safe') && ($('#safe').onclick = run('safe', 'Safety confirmed. Slide to confirm the handoff.'));
  $('#cancel') && ($('#cancel').onclick = run('cancel', 'Cancelled. Replanned with the next recipient.', 'red'));
  $('#reset') && ($('#reset').onclick = run('reset', 'Reopened. Replanned.'));
  if ($('#slide')) slider($('#slide'), run('confirm', 'Handoff confirmed. Meals rescued.', 'green'));
  tick();
}
function slider(el, done) {
  const k = el.querySelector('.knob'); let x0 = null, x = 0; const max = () => el.clientWidth - k.clientWidth - 8;
  k.onpointerdown = e => { x0 = e.clientX; k.setPointerCapture(e.pointerId); k.style.transition = 'none'; };
  k.onpointermove = e => { if (x0 === null) return; x = Math.min(max(), Math.max(0, e.clientX - x0)); k.style.transform = `translateX(${x}px)`; };
  k.onpointerup = e => { if (x0 === null) return; x0 = null; k.style.transition = 'transform .25s'; if (x >= max() * .9) { k.style.transform = `translateX(${max()}px)`; done(e); } else { x = 0; k.style.transform = ''; } };
  k.onkeydown = e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), done(e));
}
function tick() {
  const d = cur(), arc = $('#arc'); if (!d || !arc) return;
  const L = left(d), f = Math.max(0, Math.min(1, L / d.hrs)), C = 2 * Math.PI * 100, c = d.status === 'confirmed' ? '#5EE0A0' : d.status === 'quarantined' ? '#FF5B49' : col(f);
  arc.style.strokeDashoffset = C * (1 - f); arc.style.stroke = c; $('#clock').style.setProperty('--clock', c);
  $('#ct').textContent = d.status === 'confirmed' ? 'Saved' : d.status === 'quarantined' ? 'Held' : L <= 0 ? 'Spoiled' : fmt(L);
  $('#cs').textContent = d.status === 'confirmed' ? 'handed off with ' + fmt(L) + ' to spare' : d.status === 'quarantined' ? 'waiting for review' : 'safe time left';
  $('#clock').classList.toggle('low', f < .15 && d.status === 'proposed');
}
setInterval(() => { if (!document.hidden) { tick(); tickQueue(); } }, 1000); // idle tabs do no work
addEventListener('scroll', () => { $('#top').classList.toggle('sc', scrollY > 8); if (!RM) $('#fl').style.transform = `translateY(${scrollY * -.12}px)`; }, { passive: true });
document.querySelectorAll('.tile').forEach(t => t.onclick = () => t.setAttribute('aria-expanded', t.getAttribute('aria-expanded') !== 'true'));
$('#new').onclick = stageIntake;
$('#verify').onclick = async () => { const v = await api('/audit/verify'); toast(v.ok ? `Log intact: ${v.entries} entries verified.` : `Tampering detected at entry ${v.at}.`); };
load().then(stageIntake).catch(() => { toast('Cannot reach the server. Is it running?'); stageIntake(); });
