---
theme: default
title: Közös — Belső bemutató
info: |
  Belső bemutató a vezetői csapatnak — 30 perc.
  CEO + Product lead. Cél: zöld lámpa a következő fázishoz.
author: Sipos Zoltán
class: cover
highlighter: shiki
lineNumbers: false
drawings:
  persist: false
transition: fade
mdc: true
defaults:
  layout: default
vite:
  server:
    fs:
      strict: false
      allow:
        - '..'
        - '../..'
---

<div class="h-full flex flex-col justify-center items-start">

<div class="eyebrow-light">Belső bemutató · 2026</div>

<div class="wordmark mt-6">Közös</div>

<div class="tagline mt-6">A magyar társasházak<br/>platform-ja.</div>

</div>

---
layout: default
---

<div class="h-full flex flex-col justify-center">

<div class="eyebrow">A horog</div>

<h1 class="mt-2 max-w-3xl">Mit lehetne kezdeni az utolsó <span class="num text-[var(--color-moss)]">4 órányi</span> közgyűlés-utómunkával?</h1>

<div class="mt-8 text-xl text-[var(--color-ink-soft)] max-w-2xl">
Jelenléti ív → határozatképesség → szavazás → jegyzőkönyv.
</div>

<div class="mt-3 text-2xl font-semibold text-[var(--color-moss)]">
30 perc, kézi munka nélkül.
</div>

</div>

---
layout: default
---

<div class="eyebrow">A probléma</div>

<h1>Egy közös képviselő ma egy teljes munkahetet veszít havonta.</h1>

<div class="row row-2 mt-4">

<div class="tile">
<h3>Ma — Excel + Word + papír</h3>
<ul class="mt-2 text-[0.88rem]">
<li>Közgyűlés-utómunka: <span class="num">4–6 óra</span></li>
<li>Befizetés-egyeztetés: <span class="num">1 nap / hó</span></li>
<li>Maintenance-koordináció: fejből</li>
<li>3 párhuzamos rendszer, 0 átjárás</li>
</ul>
</div>

<div class="tile">
<h3>Amit csinálni szeretne</h3>
<ul class="mt-2 text-[0.88rem]">
<li>Megoldani a lakók problémáit</li>
<li>Időben hazaérni</li>
<li>Profibban kinézni</li>
<li>Több épületet vinni ugyanannyi időben</li>
</ul>
</div>

</div>

<div class="mt-5 text-center text-lg text-[var(--color-ink)]">

<span class="num text-[var(--color-moss)] font-semibold">20 épület × 8 óra</span> adminisztráció / hó <span class="text-[var(--color-muted)]">=</span> <span class="font-semibold">1 munkahét</span>

</div>

---
layout: default
---

<div class="eyebrow">A célpiac</div>

<h1>Ők fizetnek. A lakók ingyen használják.</h1>

<div class="row row-3 mt-4">

<div class="tile-moss">
<div class="text-[0.7rem] uppercase tracking-widest opacity-70">Elsődleges</div>
<h3 class="mt-1">Közös képviselő</h3>
<ul class="mt-2 text-[0.85rem]">
<li>5–20 épület</li>
<li><span class="num">~3 000–5 000</span> fő Magyarországon</li>
<li>Egyéni vállalkozó vagy kis cég</li>
</ul>
</div>

<div class="tile">
<div class="text-[0.7rem] uppercase tracking-widest text-[var(--color-muted)]">Másodlagos</div>
<h3 class="mt-1">Kezelő cég</h3>
<ul class="mt-2 text-[0.85rem]">
<li>20–200 épület</li>
<li><span class="num">~500–1 000</span> cég Magyarországon</li>
<li>Már fizet szoftverért</li>
</ul>
</div>

<div class="tile">
<div class="text-[0.7rem] uppercase tracking-widest text-[var(--color-muted)]">Harmadlagos</div>
<h3 class="mt-1">Önkezelő társasház</h3>
<ul class="mt-2 text-[0.85rem]">
<li>Intézőbizottság-vezetésű</li>
<li>Árérzékeny</li>
<li>Ingyenes alap-csomag passzol</li>
</ul>
</div>

</div>

<div class="mt-5 text-center text-[var(--color-muted)] text-sm italic">
…a lakók lesznek a legjobb értékesítési csatornánk.
</div>

---
layout: section
class: section
---

<div class="h-full flex flex-col justify-center items-start">

<div class="eyebrow-light">A nagy kifogás</div>

<h1 class="mt-2">„Nem kicsi a magyar piac?"</h1>

<h2 class="mt-6">De. És nem baj.</h2>

</div>

---
layout: default
---

<div class="eyebrow">A piac, számokban</div>

<h1>Magyarországi társasházi szoftverpiac</h1>

<div class="row row-3 mt-5">

<div class="tile">
<div class="stat-label">Teljes piacméret</div>
<div class="stat">~580M Ft</div>
<div class="text-[0.8rem] text-[var(--color-muted)] mt-2">éves bevétel, ha mind a 10 ezer társasházat elérnénk</div>
</div>

<div class="tile-moss">
<div class="stat-label">500 épület, 18 hónap alatt</div>
<div class="stat">~30M Ft</div>
<div class="text-[0.8rem] mt-2">a teljes piac 5%-a — csak a condo-előfizetésből</div>
</div>

<div class="tile">
<div class="stat-label">V4 + Balkán</div>
<div class="stat">~5×</div>
<div class="text-[0.8rem] text-[var(--color-muted)] mt-2">akkora elérhető épület-állomány</div>
</div>

</div>

<div class="mt-5 text-[0.92rem] text-[var(--color-ink-soft)] max-w-3xl">
<em>A keskeny, vertikális piacokon nem a piacméret számít — a gyenge verseny és a magas ügyfél-megtartás (lock-in) számít.</em>
<span class="text-[var(--color-muted)]"> Veeva, Toast, Procore. Mindegyik szűk piacon kezdett.</span>
</div>

<div class="mt-3 text-center">
<strong>Magyarország a bizonyítási piac, nem a célpiac.</strong>
</div>

---
layout: default
---

<div class="eyebrow">Versenyelőny</div>

<h1>Miért épp ez nyer?</h1>

<div class="row row-2 mt-4">

<div class="tile">
<h3><span class="num text-[var(--color-moss)]">01</span> &nbsp; Közös — ágazati platform</h3>
<p class="mt-1 text-[0.82rem]">AIme-hoz és banki/biztosítói rendszerekhez csatlakoztatható alaprétegen építve.</p>
</div>

<div class="tile">
<h3><span class="num text-[var(--color-moss)]">02</span> &nbsp; Kétoldali piactér</h3>
<p class="mt-1 text-[0.82rem]">Vállalkozói felület a prototípusban. A kínálati oldal kiépítése a következő szakasz — szakterületi indulás budapesti pilot-épületekkel.</p>
</div>

<div class="tile">
<h3><span class="num text-[var(--color-moss)]">03</span> &nbsp; AIme — beépítés és cross-sell</h3>
<p class="mt-1 text-[0.82rem]">A Közös az AIme első property-management ágazati ügyfele. Kétirányú érték — a Közös okosabb, az AIme új domain-t nyer.</p>
</div>

<div class="tile">
<h3><span class="num text-[var(--color-moss)]">04</span> &nbsp; Bank- és biztosító-csatorna</h3>
<p class="mt-1 text-[0.82rem]">A Danubius portfólió kapcsolatai egy új ágazatban. Beépített broker-modul a Közösben. Harmadik bevételi forrás.</p>
</div>

</div>

<!--
A 4 versenyelőny-pillér: platform · piactér · AIme · bank+biztosító.
Tht.-compliance: feature, nem pillér.
-->

---
layout: section
class: section
---

<div class="h-full flex flex-col justify-center items-start">

<div class="eyebrow-light">Bemutató</div>

<h1 class="mt-2">Petőfi Sándor utca 23.</h1>

<h2 class="mt-4">
24 lakás · Budapest V. ker. · 1923-as polgári ház<br/>
közgyűlés holnapután
</h2>

</div>

---
layout: default
---

<div class="eyebrow">A bemutató menete</div>

<h1>Mit fogtok látni</h1>

<div class="text-[0.95rem] text-[var(--color-ink-soft)] -mt-1 mb-3">A kulcsfunkció lépésről lépésre</div>

<div class="row row-2 mt-3">

<div>
<h3 class="text-[var(--color-moss)]">Amit mutatok</h3>
<ol class="mt-2 text-[0.88rem] list-decimal pl-5 [&_li]:mb-1">
<li>Áttekintés — közös képviselő bejelentkezve</li>
<li>Soron következő közgyűlés — napirend, részvételi visszajelzések, tervezet szavazások</li>
<li><strong>Határozatképesség élőben</strong> — tulajdoni hányad szerint</li>
<li><strong>Szavazás indítása</strong> — 5 többségi típus</li>
<li><strong>Lakói szavazat</strong> — telefonról</li>
<li>Automatikus zárás, eredmények</li>
<li><strong>Jegyzőkönyv</strong> — egy gomb</li>
</ol>
</div>

<div>
<h3 class="text-[var(--color-muted)]">Amit nem</h3>
<ul class="mt-2 text-[0.85rem]">
<li>Maintenance</li>
<li>Pénzügy részletek</li>
<li>Hirdetőtábla</li>
<li>Vállalkozói portál (külön slide-okon)</li>
</ul>
<p class="mt-4 text-[0.82rem] text-[var(--color-muted)] italic">
Mindezek a következő slide-okon és a tényleges termékben is. A kulcsfunkció itt a szavazási folyamat — ott töltsünk időt.
</p>
</div>

</div>

---
layout: default
---

<div class="eyebrow">01 — Áttekintés</div>
<h1>Mit lát egy közös képviselő reggel</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/01-dashboard.png" /></div>

<div class="caption">Pénzügyi áttekintés · 2 nyitott bejelentés (1 sürgős) · 137 ezer Ft hátralék 5 lakáson · 3 teendő</div>

---
layout: default
---

<div class="eyebrow">02 — Közgyűlés</div>
<h1>Napirend · jelenléti ív · 2 tervezet szavazás · határozatképesség</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/02-meeting-upcoming.png" /></div>

<div class="caption">NEM HATÁROZATKÉPES 0% (még nincs senki érkeztetve) · 18 igen / 2 nem / 2 meghatalmazás · 6 napirendi pont · 2 tervezet szavazás</div>

---
layout: default
---

<div class="eyebrow">03 — A kulcsfunkció</div>
<h1>Szavazás indítása · minősített többség (2/3)</h1>

<div class="row row-2 mt-3">

<div class="shot"><img src="./public/screenshots/pitch/02b-meeting-votes.png" /></div>

<div class="pt-2">

<h3>A háttérben</h3>
<ul class="mt-2 text-[0.85rem]">
<li>2/2026. közös költség — <span class="num">egyszerű többség</span></li>
<li>3/2026. kapuvideófon (2,4 M Ft) — <span class="num">minősített többség 2/3</span></li>
<li>A küszöböt a rendszer választja a határozat fajtája szerint</li>
<li>Audit napló minden mozdulatról</li>
</ul>

<div class="mt-5 tile-warm text-[0.9rem]">
<strong>Excelben: 20 perc.</strong><br/>
Itt: a rendszer már tudja a 2003. évi CXXXIII. tv. szerinti küszöböt.
</div>

</div>

</div>

---
layout: default
---

<div class="eyebrow">04 — A lakó oldala</div>
<h1>30 másodperc. Otthonról. Hitelesen.</h1>

<div class="row row-3 mt-4 max-w-[640px] mx-auto">

<div class="shot-phone"><img src="./public/screenshots/pitch/13-mobile-dashboard.png" /></div>

<div class="shot-phone"><img src="./public/screenshots/pitch/14-mobile-voting.png" /></div>

<div class="shot-phone"><img src="./public/screenshots/pitch/15-mobile-meeting.png" /></div>

</div>

<div class="caption mt-4">Áttekintés telefonról · „Titkos, auditálható, bíróság előtt megáll" · ugyanaz a hitelesség, mint az asztalin</div>

---
layout: default
---

<div class="eyebrow">05 — Szavazási áttekintés</div>
<h1>Előzmények · közelgő közgyűlés · részvétel</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/04-voting-list.png" /></div>

<div class="caption">1/2026. lift modernizáció ELFOGADVA — 95% igen · május 17-i közgyűlés készenlétben · titkos ballot szabályok a panelen</div>

---
layout: default
---

<div class="eyebrow">06 — Jegyzőkönyv</div>
<h1>Lezárt közgyűlés, automatikus eredmény, kész jegyzőkönyv</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/03b-meeting-minutes.png" /></div>

<div class="caption">1/2026. határozat ELFOGADVA — 95.3% igen / 4.7% nem · minősített többség (2/3) · 19 leadott szavazat</div>

---
layout: default
---

<div class="eyebrow">A többi modul</div>
<h1>Mindezek élnek — egyszer megnézzük</h1>

<div class="row row-3 mt-3">

<div>
<div class="shot"><img src="./public/screenshots/pitch/05-finance-building.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Pénzügy — épület</div>
</div>

<div>
<div class="shot"><img src="./public/screenshots/pitch/07-maintenance-list.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Maintenance</div>
</div>

<div>
<div class="shot"><img src="./public/screenshots/pitch/09-documents.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Dokumentumtár</div>
</div>

<div>
<div class="shot"><img src="./public/screenshots/pitch/10-announcements.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Hirdetőtábla</div>
</div>

<div>
<div class="shot"><img src="./public/screenshots/pitch/11-forum.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Fórum</div>
</div>

<div>
<div class="shot"><img src="./public/screenshots/pitch/12-complaints.png" /></div>
<div class="text-[0.75rem] text-[var(--color-muted)] mt-1 text-center">Panaszok</div>
</div>

</div>

---
layout: section
class: section
---

<div class="h-full flex flex-col justify-center items-start">

<div class="eyebrow-light">Amiről eddig nem esett szó</div>

<h1 class="mt-2">A vállalkozói piactér</h1>

<h2 class="mt-4">Második oldal, második bevétel.</h2>

</div>

---
layout: default
---

<div class="eyebrow">Piactér</div>
<h1>Maintenance → meghirdetés → ajánlat 48 órán belül</h1>

<div class="row row-2 mt-4">

<div class="tile">
<h3>Társasház oldal</h3>
<ul class="mt-2 text-[0.85rem]">
<li>Jegy → piactéri meghirdetés</li>
<li>Anonim ajánlatok, illeszkedési pontszám</li>
<li>Anonim üzenetváltás</li>
<li>Nyertes kiválasztása</li>
</ul>
</div>

<div class="tile">
<h3>Vállalkozói oldal</h3>
<ul class="mt-2 text-[0.85rem]">
<li>Ingyenes / Profi / Prémium csomag</li>
<li>Földrajzilag szűrt ajánlatlista</li>
<li>Ajánlat + üzenet a társasháznak</li>
<li>Hírnév / értékelések</li>
</ul>
</div>

</div>

<div class="mt-5 tile-ochre text-[0.95rem]">
<strong>Két új bevételi forrás.</strong> Hálózati hatás. Adat, amit más nem birtokol.
</div>

---
layout: default
---

<div class="eyebrow">07 — Vállalkozói portál</div>
<h1>„Találd meg a hozzád illő munkákat"</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/17-contractor-marketplace.png" /></div>

<div class="caption">3 nyitott hirdetés (lift, lépcsőházi LED, karbantartási szerződés) · sürgősség és régió szerinti szűrés · 1011 Budapest</div>

---
layout: default
---

<div class="eyebrow">08 — Egy ajánlat élőben</div>
<h1>Ajánlat-űrlap, referencia árak, anonim üzenetek</h1>

<div class="shot mt-3"><img src="./public/screenshots/pitch/18-contractor-listing.png" /></div>

<div class="caption">Liftvezérlő panel — 1011 Budapest · Sürgős, 48 óra · ár / kivitelezési idő / megjegyzés · anonim üzenetváltás döntésig</div>

---
layout: default
---

<div class="eyebrow">Üzleti modell</div>
<h1>Három bevételi forrás</h1>

<div class="row row-3 mt-5">

<div class="tile">
<div class="stat-label">1 — Condo előfizetés</div>
<div class="stat mt-1">~30M Ft</div>
<div class="text-[0.78rem] text-[var(--color-muted)] mt-1">/ év</div>
<p class="mt-3 text-[0.82rem]">Per-albetét, eHÁZ Classic-paritáson. 500 épület célzottan.</p>
</div>

<div class="tile-moss">
<div class="stat-label">2 — Vállalkozói marketplace</div>
<div class="stat mt-1">~31M Ft</div>
<div class="text-[0.78rem] mt-1">/ év</div>
<p class="mt-3 text-[0.82rem]">FREE / PRO / PREMIUM csomag a vállalkozói oldalon.</p>
</div>

<div class="tile">
<div class="stat-label">3 — Bank + biztosító</div>
<div class="stat mt-1">~10-15M Ft</div>
<div class="text-[0.78rem] text-[var(--color-muted)] mt-1">/ év</div>
<p class="mt-3 text-[0.82rem]">Broker-jutalék, Danubius portfólió kapcsolatain keresztül.</p>
</div>

</div>

<div class="mt-6 text-center text-[1rem]">
<strong>~75-80M Ft / év</strong> 18 hónap múlva, <span class="num">500</span> épülettel.
<span class="text-[var(--color-muted)]"> &nbsp;Megtérülés ~35 épület körül.</span>
</div>

---
layout: default
---

<div class="eyebrow">Hol tartunk</div>
<h1>Prototípus szinten kész — mi kell az élesüzemhez</h1>

<div class="row row-2 mt-3">

<div class="tile">
<h3 class="text-[var(--color-good)]">Prototípus szinten kész</h3>
<ul class="mt-2 text-[0.78rem] [&_li]:mb-0.5">
<li>Közös platform-mag (multi-building, audit napló)</li>
<li>Kommunikáció, dokumentumok, maintenance, panaszok</li>
<li>Pénzügy — kettős könyvvitel, főkönyv, költségvetés, közös költség</li>
<li><strong>Szavazási modul</strong> (Tht. szerinti jelenléti ív, jegyzőkönyv)</li>
<li>Vállalkozói portál + piactér</li>
<li>Stripe-számlázás alapfolyamata (checkout, webhook, customer portal)</li>
</ul>
</div>

<div class="tile-warm">
<h3 class="text-[var(--color-ochre)]">Élesüzemhez szükséges</h3>
<ul class="mt-2 text-[0.78rem] [&_li]:mb-0.5">
<li>AIme integráció</li>
<li>PSD2 + NAV csatlakozás (Stripe ↔ NAV bridge a magyar számlázáshoz)</li>
<li>Mobil — natív vagy PWA döntés</li>
<li>Vállalkozói oldal — kínálati oldal kiépítése</li>
<li>Bank/biztosító broker-modul aktiválása</li>
<li>Tht.-compliance csomag (SZMSZ-sablon + ügyvédi opinion)</li>
</ul>
</div>

</div>

<div class="mt-3 tile text-[0.82rem]">
<strong>Stratégiai megerősítés — a versenyelőny mélyítése</strong>
&nbsp;&nbsp;Public API + fejlesztői portál &nbsp;·&nbsp; SZMSZ-felkészítő modul &nbsp;·&nbsp; 3+ biztosító preferred partner-megállapodás
</div>

---
layout: section
class: section
---

<div class="h-full flex flex-col justify-center items-start">

<div class="eyebrow-light">Az ajánlatom</div>

<h1 class="mt-2">Két kérdés a vezetőség felé.</h1>

</div>

---
layout: default
---

<div class="eyebrow">Az ajánlatom</div>
<h1>Két kérdés a vezetőség felé</h1>

<div class="mt-6 row row-2">

<div class="tile">
<div class="stat-label">01</div>
<h3 class="mt-1 text-[1.1rem]">Láttok-e ebben Danubius-szintű ágazati potenciált?</h3>
<p class="mt-3 text-[0.82rem] text-[var(--color-ink-soft)]">A platform, a piactér, az AIme-szinergia és a bank/biztosító csatorna — együtt ágazati súlyú befektetést jelentenek.</p>
</div>

<div class="tile-moss">
<div class="stat-label">02</div>
<h3 class="mt-1 text-[1.1rem]">Hajlandóak vagytok foglalkozni vele a következő szakaszban?</h3>
<p class="mt-3 text-[0.82rem]">A prototípus megvan. Az irány világos. A formátumot — kit, mit, mikor — közösen rakjuk össze, ha igen.</p>
</div>

</div>

---
layout: cover
class: qa cover
---

<div class="h-full flex flex-col justify-center items-center text-center">

<h1>Kérdés?</h1>

<div class="tagline mt-12">Az egyetlen társasházkezelő,<br/>ami ismeri a magyar jogot.</div>

<div class="eyebrow-light mt-10">Sipos Zoltán · sipos.zoltan@danubiusinfo.hu</div>

</div>
