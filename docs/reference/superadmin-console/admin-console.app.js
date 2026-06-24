// ============================================================
// Condo Manager — Superadmin console: data + render + interactions
// ============================================================

// ---- Modules ----
const MODULES = {
  voting:        { name: 'Szavazás',       gloss: 'Voting',        glyph: 'Sz' },
  finance:       { name: 'Pénzügy',        gloss: 'Finance',       glyph: 'Pé' },
  maintenance:   { name: 'Karbantartás',   gloss: 'Maintenance',   glyph: 'Ka' },
  documents:     { name: 'Dokumentumok',   gloss: 'Documents',     glyph: 'Do' },
  communication: { name: 'Kommunikáció',   gloss: 'Communication', glyph: 'Ko' },
  audit:         { name: 'Audit',          gloss: 'Audit',         glyph: 'Au' },
  ai:            { name: 'MI / AI',        gloss: 'AI',            glyph: 'AI' },
  integrations:  { name: 'Integrációk',    gloss: 'Integrations',  glyph: 'In' },
};
const MODULE_ORDER = ['voting','finance','maintenance','documents','communication','audit','ai','integrations'];
const PLANS = [
  { slug: 'kezdo',  name: 'Kezdő',        gloss: 'Starter',  price: '9 900' },
  { slug: 'kepv',   name: 'Képviselő',    gloss: 'Manager',  price: '24 900', featured: true },
  { slug: 'iroda',  name: 'Kezelő iroda', gloss: 'Agency',   price: 'Egyedi' },
];

// flag: 'plan' (PER_PLAN) | 'force' (FORCE_ON) | 'kill' (KILL)
// plans: which plan slugs include it by default
// deps: prerequisite slugs
const FEATURES = [
  { slug:'voting.basic', mod:'voting', name:'Alapszavazás', gloss:'Basic voting', desc:'Egyszerű igen/nem/tartózkodom határozathozatal, tulajdoni hányad szerinti súlyozással.', active:true, flag:'plan', plans:['kepv','iroda'], deps:[], by:'Kovács A.', when:'2026.05.02' },
  { slug:'voting.proxy', mod:'voting', name:'Meghatalmazott szavazás', gloss:'Proxy', desc:'Lakó meghatalmazhat mást a szavazásra, időszakra vagy egy határozatra.', active:true, flag:'plan', plans:['kepv','iroda'], deps:['voting.basic'], by:'Kovács A.', when:'2026.04.18' },
  { slug:'voting.secret', mod:'voting', name:'Titkos szavazás', gloss:'Secret ballot', desc:'Hash-alapú anonim jegy, a leadott szavazat nem köthető személyhez.', active:true, flag:'plan', plans:['kepv','iroda'], deps:['voting.basic'], by:'Nagy P.', when:'2026.03.30' },
  { slug:'finance.ledger', mod:'finance', name:'Főkönyv', gloss:'Ledger', desc:'Kettős könyvelés, kategóriák, költségvetés vs. tény kimutatás.', active:true, flag:'plan', plans:['kezdo','kepv','iroda'], deps:[], by:'Rendszer', when:'2026.02.11' },
  { slug:'finance.bank-csv', mod:'finance', name:'Banki CSV import', gloss:'Bank CSV', desc:'Tranzakciók beolvasása CSV-ből, automatikus párosítás a főkönyvi tételekhez.', active:true, flag:'plan', plans:['kepv','iroda'], deps:['finance.ledger'], by:'Kovács A.', when:'2026.04.27' },
  { slug:'finance.bank-sync-live', mod:'finance', name:'Élő bankszinkron (PSD2)', gloss:'Live bank sync', desc:'Valós idejű banki adatkapcsolat PSD2 API-n át. Külön költséggel jár (finAPI).', active:true, flag:'plan', plans:['iroda'], deps:['finance.bank-csv'], by:'Nagy P.', when:'2026.05.09' },
  { slug:'maintenance.basic', mod:'maintenance', name:'Hibabejelentés', gloss:'Tickets', desc:'Lakói hibabejelentés fotóval, állapotkövetés a kész állapotig.', active:true, flag:'plan', plans:['kezdo','kepv','iroda'], deps:[], by:'Rendszer', when:'2026.02.11' },
  { slug:'maintenance.marketplace', mod:'maintenance', name:'Vállalkozói piactér', gloss:'Marketplace', desc:'Ellenőrzött vállalkozók, zárt borítékos ajánlattétel, lakó-értékelés.', active:true, flag:'plan', plans:['kepv','iroda'], deps:['maintenance.basic'], by:'Kovács A.', when:'2026.06.01' },
  { slug:'documents.vault', mod:'documents', name:'Dokumentumtár', gloss:'Document vault', desc:'Verziózott archív, kategóriafa, jogosultság-alapú láthatóság.', active:true, flag:'plan', plans:['kezdo','kepv','iroda'], deps:[], by:'Rendszer', when:'2026.02.11' },
  { slug:'communication.announcements', mod:'communication', name:'Hirdetmények', gloss:'Announcements', desc:'Célzott értesítés lakásnak, emeletnek vagy a háznak, olvasottság-jelentéssel.', active:true, flag:'force', plans:['kezdo','kepv','iroda'], deps:[], by:'Nagy P.', when:'2026.06.10' },
  { slug:'audit.export', mod:'audit', name:'Audit export', gloss:'Audit export', desc:'Teljes audit-napló PDF/CSV export, közgyűlési és jogi felhasználásra.', active:true, flag:'plan', plans:['iroda'], deps:[], by:'Kovács A.', when:'2026.05.21' },
  { slug:'ai.bid-ranking', mod:'ai', name:'MI ajánlat-rangsor', gloss:'AI bid ranking', desc:'A beérkezett vállalkozói ajánlatok automatikus best-fit rangsorolása (ár × értékelés × ETA).', active:true, flag:'force', plans:['iroda'], deps:['maintenance.marketplace'], by:'Nagy P.', when:'2026.06.15', beta:true },
  { slug:'ai.anomaly', mod:'ai', name:'Pénzügyi anomália-figyelő', gloss:'Anomaly detection', desc:'Szokatlan kiadások és duplikált tételek jelzése a főkönyvben. Kísérleti.', active:false, flag:'kill', plans:[], deps:['finance.bank-sync-live'], by:'Nagy P.', when:'2026.06.20', beta:true },
];

// ---- Building (override screen) ----
const BUILDING = {
  name:'Duna Residence', initials:'DR', addr:'1138 BUDAPEST · MARGITSZIGET RAKPART 47.',
  plan:'kepv', planName:'Képviselő', units:84, sub:'Aktív · megújul 2026.09.01',
};
// override: 'inherit' | 'grant' | 'revoke'
const OVERRIDES = {
  'finance.bank-sync-live': { state:'grant',  reason:'Pilot ügyfél — korai bankszinkron-hozzáférés', expiry:'2026-12-31' },
  'finance.bank-csv':       { state:'revoke', reason:'Ügyfél kérésére kikapcsolva (adatvédelmi audit)', expiry:'' },
  'voting.secret':          { state:'revoke', reason:'IB döntés: minden szavazás nyílt 2026-ban', expiry:'2026-12-31' },
};

// ============================================================ helpers
const ICON = {
  chev:'<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6"/></svg>',
  lock:'<svg class="lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  edit:'<svg class="edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>',
  link:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  check:'<svg class="ck" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M20 6L9 17l-5-5"/></svg>',
  clock:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  warn:'<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  kill:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.4 5.6a9 9 0 1 1-12.8 0"/><path d="M12 2v8"/></svg>',
};
function effBadge(kind) {
  const map = {
    plan:     { cls:'plan',     gl:'◷', txt:'Terv' },
    force:    { cls:'force',    gl:'▲', txt:'Mindenkinek be' },
    kill:     { cls:'kill',     gl:'⏻', txt:'Kill-switch' },
    override: { cls:'override', gl:'✎', txt:'Felülírás' },
  };
  const m = map[kind];
  return `<span class="eff ${m.cls}"><span class="gl">${m.gl}</span>${m.txt}</span>`;
}
function depNames(deps) { return deps.map(d => d).join(', '); }
function isAvailableInPlan(f, planSlug) { return f.plans.includes(planSlug); }

// ============================================================ SCREEN 1 — Feature Catalog
function renderCatalog() {
  let html = '';
  for (const mod of MODULE_ORDER) {
    const feats = FEATURES.filter(f => f.mod === mod);
    const m = MODULES[mod];
    const onCount = feats.filter(f => f.active && f.flag !== 'kill').length;
    html += `<div class="mod-group${mod==='audit'?' collapsed':''}" data-mod="${mod}">
      <div class="mod-head" onclick="toggleMod(this)">
        ${ICON.chev}
        <div class="mglyph">${m.glyph}</div>
        <div>
          <div class="mtitle">${m.name}</div>
          <div class="mslug mono">${mod} · ${m.gloss}</div>
        </div>
        <div class="mcount mono">${feats.length ? `<span class="on-n">${onCount} aktív</span> · ${feats.length} funkció` : 'üres'}</div>
      </div>
      <div class="mod-body">`;
    if (feats.length === 0) {
      html += `<div class="empty">
        <div class="eglyph"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h3"/></svg></div>
        <h4>Nincs funkció ebben a modulban</h4>
        <p>Az ${m.name} modul kódszinten regisztrált, de még nincs hozzá publikált funkció. A fejlesztés során itt jelennek meg.</p>
        <button class="btn btn-ghost btn-sm">Modul-dokumentáció megnyitása</button>
      </div>`;
    } else {
      for (const f of feats) {
        html += featureRow(f);
      }
    }
    html += `</div></div>`;
  }
  document.getElementById('catalog-body').innerHTML = html;
}
function featureRow(f) {
  const depHint = f.deps.length
    ? `<span class="dep-hint">${ICON.link}Igényli: ${depNames(f.deps)}</span>` : '';
  const planTags = `<span class="plan-tags"><span class="lbl">Csomag:</span>${PLANS.map(p =>
    `<span class="pt${isAvailableInPlan(f,p.slug)?'':' off'}">${p.name}</span>`).join('')}</span>`;
  const flagNote = f.flag === 'force'
    ? '<span class="flag-note warn">▲ Felülírja a csomag-beállítást — minden épületnél bekapcsol.</span>'
    : f.flag === 'kill'
    ? '<span class="flag-note warn">⏻ Globálisan kikapcsolva minden épületnél.</span>'
    : '<span class="flag-note">A csomag szerint öröklődik az épületekre.</span>';
  return `<div class="frow" data-slug="${f.slug}">
    <div class="f-id">
      <span class="slug mono">${ICON.lock}${f.slug}</span>
      <div class="name">${f.name}${f.beta?' <span class="pt" style="background:var(--ochre-soft);color:var(--ochre-deep)">BÉTA</span>':''} ${ICON.edit}</div>
      <div class="desc">${f.desc}</div>
      <div class="meta">${depHint}${planTags}</div>
      <div class="meta"><span class="audit-line">${ICON.clock}Módosította: ${f.by} · ${f.when}</span></div>
    </div>
    <div class="f-active">
      <div class="sw ${f.active?'on':''} ${f.flag==='kill'?'dis':''}" role="switch" aria-checked="${f.active}" aria-label="isActive — ${f.name}" onclick="toggleActive(this)"></div>
      <span class="sw-lbl">${f.active?'<b>Aktív</b>':'Inaktív'} · isActive</span>
    </div>
    <div class="flag-ctl">
      <div class="seg" role="radiogroup" aria-label="Globális jelző — ${f.name}">
        <button class="plan ${f.flag==='plan'?'on':''}" role="radio" aria-checked="${f.flag==='plan'}" onclick="setFlag(this,'plan','${f.slug}')"><span class="d"></span>Terv szerint</button>
        <button class="force ${f.flag==='force'?'on':''}" role="radio" aria-checked="${f.flag==='force'}" onclick="setFlag(this,'force','${f.slug}')"><span class="d"></span>Mindenkinek be</button>
        <button class="kill ${f.flag==='kill'?'on':''}" role="radio" aria-checked="${f.flag==='kill'}" onclick="confirmKill('${f.slug}')"><span class="d"></span>Kill-switch</button>
      </div>
      ${flagNote}
    </div>
  </div>`;
}

// ============================================================ SCREEN 2 — Plan Editor matrix
function renderMatrix() {
  let rows = '';
  for (const mod of MODULE_ORDER) {
    const feats = FEATURES.filter(f => f.mod === mod);
    if (!feats.length) continue;
    rows += `<tr class="mx-mod-row"><td colspan="4">${MODULES[mod].name} · ${mod}</td></tr>`;
    for (const f of feats) {
      const dep = f.deps.length ? `<div class="dep mono">${ICON.link} ${depNames(f.deps)}</div>` : '';
      let cells = '';
      for (const p of PLANS) {
        const on = isAvailableInPlan(f, p.slug);
        // does any enabled feature in this plan depend on f? then disabling is blocked
        const blockers = FEATURES.filter(x => x.deps.includes(f.slug) && isAvailableInPlan(x, p.slug));
        const blocked = on && blockers.length > 0;
        cells += `<td class="mx-cell">
          <span class="tip">
            <span class="cbx ${on?'on':''} ${blocked?'locked':''}" role="checkbox" aria-checked="${on}"
              aria-label="${f.name} — ${p.name}" tabindex="0"
              onclick="toggleMatrix(this,'${f.slug}','${p.slug}',${blocked})">${ICON.check}</span>
            ${blocked?`<span class="tip-body">Nem kapcsolható ki: <b>${blockers[0].name}</b> még igényli ezt a csomagban.</span>`:''}
          </span>
        </td>`;
      }
      rows += `<tr class="mx-row" data-slug="${f.slug}">
        <td class="mx-feat"><div class="nm">${f.name}</div><div class="sl mono">${f.slug}</div>${dep}</td>
        ${cells}
      </tr>`;
    }
  }
  document.getElementById('matrix-body').innerHTML = rows;
}

// ============================================================ SCREEN 3 — Building overrides
function resolveEffective(f) {
  // precedence: kill > override > force > plan
  if (f.flag === 'kill') return { source:'kill', available:false };
  const ov = OVERRIDES[f.slug];
  if (ov && ov.state !== 'inherit') {
    if (ov.state === 'revoke') return { source:'override', available:false, ovState:'revoke' };
    // grant — check deps effective
    return { source:'override', available:true, ovState:'grant' };
  }
  if (f.flag === 'force') return { source:'force', available:true };
  const inPlan = isAvailableInPlan(f, BUILDING.plan);
  return { source:'plan', available:inPlan };
}
function depsEffective(f) {
  // are all prereqs effective for this building?
  return f.deps.every(dslug => {
    const df = FEATURES.find(x => x.slug === dslug);
    if (!df) return true;
    return resolveEffective(df).available;
  });
}
function renderOverrides() {
  let rows = '';
  for (const mod of MODULE_ORDER) {
    const feats = FEATURES.filter(f => f.mod === mod);
    if (!feats.length) continue;
    for (const f of feats) {
      const eff = resolveEffective(f);
      const ov = OVERRIDES[f.slug] || { state:'inherit', reason:'', expiry:'' };
      const depsOk = depsEffective(f);
      // cascade warning when granted (or available) but deps not effective
      const cascade = eff.available && f.deps.length && !depsOk;
      const missingDeps = f.deps.filter(d => { const df=FEATURES.find(x=>x.slug===d); return df && !resolveEffective(df).available; });

      const availChip = eff.available && !cascade
        ? `<span class="avail-chip"><span class="avail-dot on"></span>Elérhető</span>`
        : `<span class="avail-chip off"><span class="avail-dot off"></span>${cascade?'Hatástalan':'Nem elérhető'}</span>`;

      rows += `<div class="ov-row${cascade?' warned':''}" data-slug="${f.slug}">
        <div class="ov-feat">
          <div class="nm">${f.name}</div>
          <div class="sl mono">${f.slug}${f.deps.length?` · igényli: ${depNames(f.deps)}`:''}</div>
          <div class="why-source" style="margin-top:8px">${effBadge(eff.source)}${availChip}</div>
        </div>
        <div class="ov-state">
          <div class="tri" role="radiogroup" aria-label="Felülírás — ${f.name}">
            <button class="inherit ${ov.state==='inherit'?'on':''}" onclick="setOverride(this,'${f.slug}','inherit')">Öröklés</button>
            <button class="grant ${ov.state==='grant'?'on':''}" onclick="setOverride(this,'${f.slug}','grant')">Engedélyezés</button>
            <button class="revoke ${ov.state==='revoke'?'on':''}" onclick="setOverride(this,'${f.slug}','revoke')">Tiltás</button>
          </div>
        </div>
        <div class="ov-detail">
          <div class="ov-override-fields${ov.state!=='inherit'?' show':''}">
            <div class="ff"><label>Indok (audit)</label><input type="text" value="${ov.reason||''}" placeholder="Pl. pilot ügyfél, IB döntés…"></div>
            <div class="row2">
              <div class="ff"><label>Lejárat</label><input type="date" value="${ov.expiry||''}"></div>
              <div class="ff"><label>&nbsp;</label><span class="audit-line" style="padding-top:8px">${ICON.clock}Kovács A.</span></div>
            </div>
          </div>
          ${cascade?`<div class="cascade-warn">${ICON.warn}<div><b>A függőség nem elérhető.</b> Az engedély hatástalan, amíg a(z) <b>${depNames(missingDeps)}</b> prerekvizit nem aktív ezen az épületen (jelenleg le van tiltva vagy nincs a csomagban).</div></div>`:''}
          ${ov.state==='inherit' && !cascade?`<span class="audit-line">${eff.source==='plan'?(eff.available?'A Képviselő csomag tartalmazza':'A Képviselő csomag nem tartalmazza'):eff.source==='force'?'Globálisan bekapcsolva (rollout)':eff.source==='kill'?'Globális kill-switch alatt':''}</span>`:''}
        </div>
      </div>`;
    }
  }
  document.getElementById('overrides-body').innerHTML = rows;
}

// ============================================================ INTERACTIONS
function toggleMod(head) { head.closest('.mod-group').classList.toggle('collapsed'); }
function toggleActive(el) {
  if (el.classList.contains('dis')) return;
  el.classList.toggle('on');
  const on = el.classList.contains('on');
  el.setAttribute('aria-checked', on);
  el.nextElementSibling.innerHTML = (on?'<b>Aktív</b>':'Inaktív') + ' · isActive';
  toast(on?'Funkció aktiválva':'Funkció inaktiválva', false);
}
function setFlag(btn, flag, slug) {
  const seg = btn.closest('.seg');
  seg.querySelectorAll('button').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-checked','false'); });
  btn.classList.add('on'); btn.setAttribute('aria-checked','true');
  const note = btn.closest('.flag-ctl').querySelector('.flag-note');
  if (flag==='force') { note.className='flag-note warn'; note.innerHTML='▲ Felülírja a csomag-beállítást — minden épületnél bekapcsol.'; toast('Globális jelző: Mindenkinek be',false); }
  else { note.className='flag-note'; note.innerHTML='A csomag szerint öröklődik az épületekre.'; toast('Globális jelző: Terv szerint',false); }
  const fobj = FEATURES.find(f=>f.slug===slug); if (fobj) fobj.flag = flag;
}
let pendingKill = null;
function confirmKill(slug) {
  pendingKill = slug;
  const f = FEATURES.find(x=>x.slug===slug);
  document.getElementById('kill-feature').textContent = f.name;
  document.getElementById('kill-slug').textContent = f.slug;
  // count affected — buildings that currently have it available
  const affected = f.plans.length ? '~' + ({kezdo:118,kepv:241,iroda:53})[f.plans[f.plans.length-1]] : '0';
  document.getElementById('kill-buildings').textContent = (f.plans.includes('kezdo')?'412':f.plans.includes('kepv')?'294':'53') + ' épület';
  document.getElementById('kill-confirm-input').value = '';
  document.getElementById('kill-go').disabled = true;
  document.getElementById('kill-overlay').classList.add('on');
}
function killInputCheck(el) {
  document.getElementById('kill-go').disabled = el.value.trim().toUpperCase() !== 'KILL';
}
function doKill() {
  const f = FEATURES.find(x=>x.slug===pendingKill);
  if (f) { f.flag='kill'; f.active=false; }
  closeKill();
  renderCatalog();
  toast('Kill-switch bekapcsolva — ' + (f?f.slug:''), true);
}
function closeKill() { document.getElementById('kill-overlay').classList.remove('on'); pendingKill=null; }

function toggleMatrix(el, slug, plan, blocked) {
  if (blocked) { toast('Előbb a függő funkciót kell kikapcsolni ebben a csomagban', true); return; }
  const f = FEATURES.find(x=>x.slug===slug);
  const idx = f.plans.indexOf(plan);
  if (idx >= 0) {
    f.plans.splice(idx,1);
  } else {
    f.plans.push(plan);
    // auto-enable prerequisites
    f.deps.forEach(d => { const df=FEATURES.find(x=>x.slug===d); if (df && !df.plans.includes(plan)) { df.plans.push(plan); } });
  }
  renderMatrix();
  // flash newly-auto cells
  if (idx < 0 && f.deps.length) {
    f.deps.forEach(d => {
      const cell = document.querySelector(`.mx-row[data-slug="${d}"] .mx-cell:nth-child(${PLANS.findIndex(p=>p.slug===plan)+2}) .cbx`);
      if (cell) { cell.classList.add('auto','flash'); }
    });
    toast('Prerekvizitek automatikusan bekapcsolva', false);
  }
}
function setOverride(btn, slug, state) {
  const tri = btn.closest('.tri');
  tri.querySelectorAll('button').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  OVERRIDES[slug] = OVERRIDES[slug] || { reason:'', expiry:'' };
  OVERRIDES[slug].state = state;
  renderOverrides();
  toast(state==='inherit'?'Felülírás törölve — öröklés':state==='grant'?'Funkció engedélyezve ennél az épületnél':'Funkció letiltva ennél az épületnél', state==='revoke');
}

let toastTimer;
function toast(msg, danger) {
  const t = document.getElementById('toast');
  t.querySelector('span').textContent = msg;
  t.classList.toggle('danger', !!danger);
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('on'), 2600);
}

// states demo (catalog)
function setState(btn, state) {
  btn.closest('.states-bar').querySelectorAll('button').forEach(b=>b.classList.remove('on'));
  btn.classList.add('on');
  const body = document.getElementById('catalog-body');
  const skel = document.getElementById('catalog-skel');
  if (state==='loading') { body.style.display='none'; skel.style.display='block'; }
  else { body.style.display='block'; skel.style.display='none'; }
}

// router
function route() {
  const hash = (location.hash||'#features').slice(1);
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.dataset.route===hash));
  document.querySelectorAll('.nav-item[data-route]').forEach(n => n.classList.toggle('on', n.dataset.route===hash));
  window.scrollTo(0,0);
}
window.addEventListener('hashchange', route);

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
  renderMatrix();
  renderOverrides();
  route();
});
