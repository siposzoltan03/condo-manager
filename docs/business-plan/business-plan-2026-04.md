# Condo Manager — Business Plan
### Üzleti terv és árazási stratégia
**2026. április**

---

# 1. Vezetői összefoglaló

A Condo Manager egy all-in-one társasházkezelő SaaS platform, amely egyedülálló módon implementálja a magyar társasházi törvényt (2003. évi CXXXIII. tv.). Az üzleti modell B2B SaaS: a **közös képviselők és kezelő cégek** fizetnek havi előfizetést lakásszám alapján, míg a **lakók ingyen** használják a portált.

**Kulcsszámok:**
- Célár: 79-169 Ft/lakás/hó
- Break-even: ~35 épület (~1 400 lakás)
- Célpiac mérete: Magyarországon ~65 000 társasház, ~1,5M lakás

---

# 2. Célpiac

## 2.1 Piaci méret (Magyarország)

| Szegmens | Darabszám | Forrás |
|---|---|---|
| Társasházak összesen | ~65 000 | KSH |
| Ebből 10+ lakásos | ~40 000 | Becslés |
| Professzionális kezelővel | ~15 000-20 000 | Becslés |
| Potenciálisan elérhető (SAM) | ~10 000 | Becslés |
| Reális 3 éves cél (SOM) | 500-1 000 | Terv |

## 2.2 Célcsoport prioritás

### Elsődleges: Közös képviselők (5-20 épület)
- ~3 000-5 000 fő Magyarországon
- Általában egyéni vállalkozók vagy kis cégek
- Fájdalom: sok manuális munka, közgyűlés-szervezés időigényes
- Motiváció: időmegtakarítás, professzionálisabb szolgáltatás

### Másodlagos: Kezelő cégek (20-200 épület)
- ~500-1 000 cég
- Már használnak valamilyen szoftvert (eHÁZ, OnlineHáz)
- Fájdalom: szavazás/közgyűlés kézzel, több rendszer párhuzamosan
- Motiváció: all-in-one, jogi megfelelőség

### Harmadlagos: Önkezelő társasházak
- Kisebb épületek, ahol az IB maga kezeli az ügyeket
- Árérzékeny, de a freemium modell ideális nekik
- Motiváció: egyszerűség, lakói kommunikáció

---

# 3. Értékajánlat (Value Proposition)

## 3.1 Közös képviselőknek / kezelő cégeknek

> **"Az egyetlen társasházkezelő, ami ismeri a magyar jogot."**

| Érték | Részletek | Időmegtakarítás |
|---|---|---|
| Automatikus határozatképesség | Jelenléti ív → azonnali quórum számítás | ~30 perc / közgyűlés |
| Szavazási típusok | 5 törvényi típus automatikusan | ~15 perc / szavazás |
| Megismételt közgyűlés kezelés | Automatikus szabályok | Hibák elkerülése |
| Jegyzőkönyv alapadatok | Szavazási eredmények automatikusan | ~1-2 óra / közgyűlés |
| All-in-one | Nem kell 3 külön rendszer | ~5 óra / hét |

**Becsült megtakarítás:** ~8-10 óra/hó/épület → 20 épületnél ~160-200 óra/hó

## 3.2 Lakóknak (ingyenes)

> **"Végre látod, mi történik a házadban."**

- Szavazás mobilról
- Közös költség befizetések nyomon követése
- Karbantartási kérelmek beküldése
- Közgyűlési dokumentumok elérése
- Hirdetőtábla, közösségi kommunikáció

---

# 4. Üzleti modell

## 4.1 Árazási struktúra — Tiered SaaS

> Lásd: `diagrams.drawio.xml` — **"Árazási struktúra"** lap

```
┌─────────────────────────────────────────────────────────────────┐
│  LAKÓI PORTÁL — INGYENES                                       │
│  Szavazás, befizetések, karbantartás, dokumentumok, chat       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────┬──────────────────┬──────────────────────────┐
│  ALAP             │  PROFI            │  PRÉMIUM                │
│  79 Ft/lakás/hó   │  119 Ft/lakás/hó  │  169 Ft/lakás/hó        │
│  + ÁFA            │  + ÁFA            │  + ÁFA                  │
├──────────────────┼──────────────────┼──────────────────────────┤
│  Könyvelés        │  Minden az        │  Minden a Profiban      │
│  Kommunikáció     │  Alapban, plusz:  │  plusz:                 │
│  Dokumentumok     │                   │                         │
│  Karbantartás     │  Szavazási modul  │  Bank szinkron (PSD2)   │
│  Hirdetőtábla     │  Közgyűlés-kezelés│  NAV bejövő számlák     │
│  Mérőállás        │  Jelenléti ív     │  Automatikus párosítás  │
│                   │  5 többségi típus │  Emelt támogatás        │
│                   │  Titkos szavazás  │  API hozzáférés         │
│                   │  Proxy kezelés    │                         │
│                   │  Jegyzőkönyv      │                         │
└──────────────────┴──────────────────┴──────────────────────────┘
```

## 4.2 Kedvezmények

| Feltétel | Kedvezmény |
|---|---|
| Éves előfizetés (havi helyett) | -15% (2 hónap ingyen) |
| 10+ épület (kezelő cég) | -10% |
| 20+ épület | -15% |
| 50+ épület | -20% + dedikált account manager |
| Első 2 épület | Örökre ingyenes (referencia program) |
| Első 3 hónap | Ingyenes próbaidő (bármely csomag) |

## 4.3 Miért ez az ár?

| Szempont | Indoklás |
|---|---|
| **79 Ft alap** | Az eHÁZ START (60 Ft) felett, de kommunikációval + dokumentumokkal — több érték |
| **119 Ft profi** | Az eHÁZ CLASSIC (125 Ft) alatt, de teljes szavazási modullal — egyértelműen jobb ár/érték |
| **169 Ft prémium** | Az eHÁZ felett, de bank szinkronnal + NAV-val — megéri a különbözetet, mert megspórolja a külön rendszereket |
| **Lakók ingyen** | Adoptáció maximalizálása — a lakói bázis a moat |

## 4.4 Példa árak épületméret szerint

| Épület méret | Alap (79 Ft) | Profi (119 Ft) | Prémium (169 Ft) |
|---|---|---|---|
| 15 lakás (kis ház) | 1 185 Ft/hó | 1 785 Ft/hó | 2 535 Ft/hó |
| 30 lakás (átlagos) | 2 370 Ft/hó | 3 570 Ft/hó | 5 070 Ft/hó |
| 50 lakás (nagy) | 3 950 Ft/hó | 5 950 Ft/hó | 8 450 Ft/hó |
| 80 lakás (nagyon nagy) | 6 320 Ft/hó | 9 520 Ft/hó | 13 520 Ft/hó |

**Kontextusban:** Egy 30 lakásos ház Profi csomagja (3 570 Ft/hó) = egy villanyszerelő 1 óra díja, vagy lakóra lebontva 119 Ft/hó (egy zsemle ára).

---

# 5. Bevételi előrejelzés

## 5.1 Növekedési szcenáriók (3 év)

> Lásd: `diagrams.drawio.xml` — **"Bevételi előrejelzés"** lap

### Konzervatív szcenárió

| | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Épületek | 20 | 60 | 200 | 400 |
| Lakások | 800 | 2 400 | 8 000 | 16 000 |
| Átlag ár (Ft/lakás) | 79 | 99 | 119 | 129 |
| **MRR (Ft)** | **63 200** | **237 600** | **952 000** | **2 064 000** |
| **MRR (EUR)** | **~160** | **~600** | **~2 400** | **~5 200** |
| ARR (EUR) | ~1 920 | ~7 200 | ~28 800 | ~62 400 |

### Optimista szcenárió

| | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Épületek | 50 | 150 | 500 | 1 000 |
| Lakások | 2 000 | 6 000 | 20 000 | 40 000 |
| Átlag ár (Ft/lakás) | 99 | 119 | 129 | 139 |
| **MRR (Ft)** | **198 000** | **714 000** | **2 580 000** | **5 560 000** |
| **MRR (EUR)** | **~500** | **~1 800** | **~6 500** | **~14 000** |
| ARR (EUR) | ~6 000 | ~21 600 | ~78 000 | ~168 000 |

## 5.2 Költségstruktúra

### Fix költségek

| Tétel | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Hosting (Vercel/VPS + DB) | EUR 30 | EUR 50 | EUR 100 | EUR 200 |
| Domain + email | EUR 10 | EUR 10 | EUR 10 | EUR 10 |
| Monitoring + misc | EUR 10 | EUR 20 | EUR 30 | EUR 50 |
| **Fix összesen** | **EUR 50** | **EUR 80** | **EUR 140** | **EUR 260** |

### Változó költségek

| Tétel | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Bank szinkron (finAPI) | EUR 0 | EUR 0 | EUR 350 | EUR 500 |
| NAV API | EUR 0 | EUR 0 | EUR 0 | EUR 0 |
| SMS/push értesítések | EUR 10 | EUR 30 | EUR 80 | EUR 150 |
| **Változó összesen** | **EUR 10** | **EUR 30** | **EUR 430** | **EUR 650** |

### Profit (konzervatív szcenárió)

| | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Bevétel | EUR 160 | EUR 600 | EUR 2 400 | EUR 5 200 |
| Költség | EUR 60 | EUR 110 | EUR 570 | EUR 910 |
| **Profit** | **EUR 100** | **EUR 490** | **EUR 1 830** | **EUR 4 290** |
| **Margin** | 63% | 82% | 76% | 82% |

**Break-even:** ~1 400 lakás a Profi csomagban = **~35 épület**

### Profit (optimista szcenárió)

| | Hó 6 | Hó 12 | Hó 24 | Hó 36 |
|---|---|---|---|---|
| Bevétel | EUR 500 | EUR 1 800 | EUR 6 500 | EUR 14 000 |
| Költség | EUR 80 | EUR 150 | EUR 700 | EUR 1 200 |
| **Profit** | **EUR 420** | **EUR 1 650** | **EUR 5 800** | **EUR 12 800** |
| **Margin** | 84% | 92% | 89% | 91% |

---

# 6. Go-to-Market stratégia

## 6.1 Fázis 1 — Validáció (Hó 1-6)

### Cél: 20 épület, product-market fit

**Akciók:**
1. **5 pilot társasház** keresése személyes networkből
   - Ingyenes használat cserébe feedback-ért
   - Közgyűlés-szezonban (ősz/tavasz) indítani

2. **Landing page** (condomanager.hu)
   - USP: "Az egyetlen app ami ismeri a magyar jogot"
   - Email lista gyűjtés
   - Demo videó a szavazási modullal

3. **Közös képviselő fórumok / Facebook csoportok**
   - "Társasházi közös képviselők" csoport (~5 000 tag)
   - Értékes tartalom: "Így változott a társasházi törvény 2025-ben"
   - Nem direkt értékesítés, hanem szakértői pozícionálás

4. **MITOE (Magyar Ingatlan- és Társasház-kezelők Országos Egyesülete)**
   - Kapcsolatfelvétel, esetleg partneri megállapodás
   - eHÁZ is MITOE partneren keresztül értékesít

### KPI-k:
- 5 aktív pilot épület
- 20 regisztrált közös képviselő
- 1 sikeres közgyűlés a rendszeren keresztül

## 6.2 Fázis 2 — Növekedés (Hó 7-18)

### Cél: 60-150 épület, bevétel indítás

**Akciók:**
1. **Fizetős csomagok bevezetése** (3 hónap ingyenes próba után)
2. **Referencia program:** "Hozz egy társasházat, kapj 1 hónap ingyen"
3. **Kezelő cégek megkeresése** (top 50 kezelő Budapesten)
4. **Tartalom marketing:**
   - Blog: "Közgyűlési kisokos", "Határozatképesség kalkulátor"
   - YouTube: közgyűlés-kezelés demo
5. **SEO:** "társasház kezelő szoftver", "közgyűlés szavazás online"

### KPI-k:
- 60+ fizető épület
- EUR 600+ MRR
- <5% havi churn

## 6.3 Fázis 3 — Skálázás (Hó 19-36)

### Cél: 200-1 000 épület, profitabilitás

**Akciók:**
1. **Prémium csomag** bevezetése (bank szinkron, NAV)
2. **Kezelő cég partnerségek** (white-label lehetőség?)
3. **Vidéki terjeszkedés** (Budapest után: Debrecen, Szeged, Pécs, Győr)
4. **Esetleg:** CEE terjeszkedés (Szlovákia, Románia — hasonló társasházi jog)

---

# 7. Ki fizet? — Részletes elemzés

## 7.1 Fizetési flow

> Lásd: `diagrams.drawio.xml` — **"Fizetési flow"** lap

```
┌─────────────────────────────────┐
│  Közös képviselő / Kezelő cég  │
│  (döntéshozó + fizető)          │
│                                 │
│  Havi előfizetés:               │
│  épületek × lakások × ár       │
│  Bankkártya / átutalás          │
└──────────────┬──────────────────┘
               │
               │ A költséget beépíti a
               │ kezelési díjba
               ▼
┌─────────────────────────────────┐
│  Társasház (közös költség)       │
│  A közgyűlés jóváhagyja a       │
│  kezelési díjat, amiben benne   │
│  van a szoftver költsége         │
│                                 │
│  40 lakás × 119 Ft = 4 760 Ft/hó│
│  = ~119 Ft/lakás/hó extra a     │
│  közös költségben                │
└──────────────┬──────────────────┘
               │
               │ Lakók fizetik a
               │ közös költséget
               ▼
┌─────────────────────────────────┐
│  Lakók                           │
│  NEM fizetnek közvetlenül        │
│  A portált INGYEN használják     │
│                                 │
│  Közvetett költség:              │
│  ~119 Ft/hó a közös költségben  │
│  (egy zsemle ára havonta)        │
└─────────────────────────────────┘
```

## 7.2 Miért NEM a lakók fizetnek közvetlenül?

1. **Adoptáció:** Ha a lakóknak fizetni kell, a legtöbben nem fogják telepíteni → a szavazási modul értéktelen lesz quórum nélkül
2. **Döntési frikció:** Minden lakó egyéni döntést hoz → lassú, bizonytalan
3. **Precedens:** Egyik versenytárs sem kér a lakóktól (eHÁZ, OnlineHáz, Társasház App mind a kezelő fizet)
4. **A lakói bázis a moat:** Minél több lakó használja, annál nehezebb a képviselőnek váltani

## 7.3 Árérzékenység elemzés

**119 Ft/lakás/hó (Profi) mit jelent a gyakorlatban?**

| Perspektíva | Összeg | Kontextus |
|---|---|---|
| 1 lakónak | 119 Ft/hó | Egy zsemle ára |
| 30 lakásos ház | 3 570 Ft/hó | Egy villanyszerelő 1 óra díja |
| 40 lakásos ház | 4 760 Ft/hó | Kevesebb mint egy vízkő-mentesítés |
| Közös képviselő (20 ház, 800 lakás) | 95 200 Ft/hó | ~1/2 minimálbér → ROI ha havi 20 órát spórol |
| Kezelő cég (100 ház, 4 000 lakás) | 476 000 Ft/hó | ~1 alkalmazott bére → ROI ha 1 FTE-t spórol |

**A kezelő cég szempontjából:** Ha a szoftver havi 20-40 óra adminisztrációt spórol meg épületenként, az 1-2 FTE munkáját váltja ki → **az ár nagyon könnyen megtérül**.

---

# 8. Versenystratégia

## 8.1 Pozícionálás az árskálán

```
Olcsó                                                           Drága
 │                                                                │
 │  TApp  OnlineHáz  eHÁZ START  ★ CM PROFI ★  eHÁZ CLASSIC     │
 │  39Ft    49Ft       60Ft          119Ft         125Ft          │
 │                                                                │
 │  nincs szavazás                   TELJES         nincs         │
 │                                   szavazás       szavazás      │
```

Az eHÁZ CLASSIC **alatt** vagyunk, de **sokkal több funkcióval** (szavazás, jelenléti ív, jogi compliance). Az eHÁZ-ról váltók számára egyértelmű upgrade.

## 8.2 Kompetitív válaszok

| Ha a versenytárs... | Mi a válasz? |
|---|---|
| **eHÁZ szavazási modult fejleszt** | Ők könyvelés-first — a szavazás sosem lesz a core termékük. Mi voting-first + könyvelés. |
| **Társasház App mélyíti a szavazást** | A mi jogi implementációnk teljesebb (5 típus, jelenléti ív, tartózkodás). |
| **Honline all-in-one lesz** | Ők szavazás-only, könyvelést nulláról kéne építeniük. |
| **Nemzetközi szereplő belép** | Magyar jog lokalizáció évekbe telne nekik. |
| **Árháború indul** | Ingyenes tier + lakói bázis mint moat. |

---

# 9. Kockázatok és mitigáció

| Kockázat | Valószínűség | Hatás | Mitigáció |
|---|---|---|---|
| Lassú adoptáció | Magas | Magas | Ingyenes tier, pilot program, MITOE partnerség |
| eHÁZ szavazási modult ad ki | Közepes | Közepes | Mélyebb jogi compliance, jobb UX |
| Alacsony fizetési hajlandóság | Magas | Közepes | Alacsony belépési ár (79 Ft), ROI kommunikáció, ingyenes próba |
| Idős lakók nem használják | Közepes | Alacsony | A képviselő kezeli a rendszert, lakónak opcionális |
| Jogszabály-változás | Alacsony | Közepes | Moduláris szavazási logika, gyors adaptáció |
| Bank szinkron költsége túl magas | Közepes | Alacsony | Saját AISP adapter mint backup terv |

---

# 10. Mérföldkövek és KPI-k

| Mérföldkő | Cél dátum | KPI |
|---|---|---|
| MVP kész (jelenlegi állapot) | ✅ Kész | Működő app |
| 5 pilot társasház | +2 hónap | 5 aktív épület, 1 közgyűlés lebonyolítva |
| Landing page + marketing indítás | +3 hónap | 100 regisztráció |
| Fizetős csomagok bevezetése | +6 hónap | 20 fizető épület |
| Break-even | +10 hónap | 35 fizető épület, EUR 600+ MRR |
| Bank szinkron (Prémium) | +18 hónap | 10 Prémium ügyfél |
| 500 épület | +30 hónap | EUR 4 500+ MRR |

---

# 11. Összefoglaló

| Kérdés | Válasz |
|---|---|
| **Termék** | All-in-one társasházkezelő, magyar jog-kompatibilis szavazással |
| **Célcsoport** | Közös képviselők és kezelő cégek |
| **Ki fizet?** | Közös képviselő / kezelő cég (lakók ingyen) |
| **Árazás** | 79-169 Ft/lakás/hó, 3 csomag |
| **Business model** | B2B SaaS, havi előfizetés |
| **Break-even** | ~35 épület (~1 400 lakás) |
| **3 éves cél** | 400-1 000 épület, EUR 5 200-14 000 MRR |
| **USP** | Egyetlen platform ami automatizálja a magyar társasházi törvényt |

---

*Készült: 2026. április*
*Verzió: 1.0*
