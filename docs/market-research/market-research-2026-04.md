# Condo Manager — Piackutatás
### Társasházkezelő szoftverek versenyelemzése
**2026. április**

---

# 1. Vezetői összefoglaló

A magyar társasházkezelő szoftverek piaca **fragmentált**: a megoldások vagy könyvelés-központúak, vagy szavazás-fókuszúak. Egyetlen platform sem nyújt integrált, all-in-one megoldást, és **egyik sem automatizálja a magyar társasházi törvény (2003. évi CXXXIII. tv.) szavazási szabályait**.

A Condo Manager egyedülálló pozíciót foglalhat el:
- Jogszabály-kompatibilis szavazási motor
- Integrált könyvelés + szavazás + kommunikáció
- Modern, mobil-first felhasználói élmény

> A diagramokat tartalmazó fájl: `diagrams.drawio.xml` (megnyitható draw.io-ban vagy VS Code draw.io bővítménnyel)

---

# 2. Magyar piac

## 2.1 Piaci térkép

> Lásd: `diagrams.drawio.xml` — **"Magyar piac — Pozícionálás"** lap

### Könyvelés-központú megoldások

| Platform | Lakásszám | Ár (Ft/lakás/hó) | Mobil | Szavazás |
|---|---|---|---|---|
| **eHÁZ** (ehaz.hu) | ~13 000 társasház | 60-125 + ÁFA | iOS + Android | Nincs |
| **OnlineHáz** (onlinehaz.hu) | ~3 000 társasház | 49 + ÁFA (1. év ingyenes) | iOS + Android | Nincs |
| **Társasház App** (tarsashaz.app) | N/A | 39 + ÁFA (50-ig ingyenes) | iOS + Android | Részleges |
| **Érték Rendszerház** (ertek.hu) | N/A | 5 900-59 400/hó fix | Web | Közgyűlés-kezelés |
| **Novitax HÁZAK** | N/A | N/A | Nincs | Nincs |
| **NetHáz** (nethaz.com) | ~300 kezelő | N/A | Web | Nincs |

**Erősségek:** NAV integráció, banki szinkron, éves beszámoló generálás
**Gyengeségek:** Nincs valódi szavazási modul, elavult UI, lakó-oldali funkciók minimálisak

### Szavazás-központú megoldások

| Platform | Fókusz | Jogi érvényesség | Tulajdoni hányad |
|---|---|---|---|
| **Honline** (honline.hu) | Online közgyűlés + szavazás | Állítólag igen | Nem megerősített |
| **eKözgyűlés** (ekozgyules.com) | Online szavazás + jegyzőkönyv | Állítólag igen | Nem megerősített |
| **WHM Cloud** (whmcloud.hu) | Admin + online szavazás | N/A | Nem megerősített |

**Erősségek:** Online szavazás létezik
**Gyengeségek:** Nem integrált, nincs könyvelés, a jogi megfelelőség nem igazolt

### Egyéb szereplők

- **Profi Multihaz** (scha.hu) — Windows + web, teljes könyvelés
- **Thaz-SofT SQL** — PostgreSQL alapú, modern
- **HomeGo** (homego.hu) — Egyszerű, kis portfóliókhoz
- **OPENLAK** — Lakásszövetkezet + társasház

---

## 2.2 Magyar piac — Részletes profilok

### eHÁZ — Piacvezető (könyvelés)

- **Piaci pozíció:** Legnagyobb szereplő, ~13 000 társasház
- **Díjak:** Forbes Cloud TOP50 2022, Business Ethics Award 2023
- **Fő funkciók:**
  - Egyszeres + kettős könyvelés
  - PSD2 banki szinkron
  - NAV Online Számla integráció
  - AI asszisztens
  - Többnyelvű értesítések
  - Jogi ügyek kezelése
- **Ami hiányzik:** Szavazás, közgyűlés-kezelés, lakói közösségi funkciók
- **Értékelés:** Könyvelésben erős, de nem all-in-one

### Társasház App — Legközelebbi versenytárs

- **Piaci pozíció:** Újabb szereplő, agresszív árazás (50 lakásig ingyenes)
- **Fő funkciók:**
  - Egyszeres + kettős könyvelés
  - Banki szinkron, NAV integráció
  - Közgyűlés-támogatás: **tulajdoni hányad figyelembe vétele**
  - Dokumentumkezelés
  - Lakói + IB portál
  - Push értesítések
- **Ami hiányzik:** Határozatképesség automatizálása, minősített többség, megismételt közgyűlés
- **Értékelés:** A legközelebbi versenytárs, de a szavazási logika nem teljes

### Honline — Online közgyűlés specialista

- **Piaci pozíció:** Niche — kizárólag online szavazásra fókuszál
- **Fő funkciók:**
  - Fórum-alapú vita + szavazás
  - Android app push értesítésekkel
  - Jogilag érvényes döntéshozatal (állítólag)
- **Ami hiányzik:** Könyvelés, karbantartás, dokumentumkezelés — nem integrált
- **Értékelés:** Jó koncepció, de elszigetelt megoldás

---

# 3. Nemzetközi piac

## 3.1 Észak-amerikai full-service platformok

| Platform | Ár | Méret | Szavazás | Erősség |
|---|---|---|---|---|
| **Condo Control** | $49/hó-tól | 1M+ felhasználó | e-voting modul | 40+ modul, legjobb funkció-lefedettség |
| **Buildium** | $58-375/hó | <500 lakás | Korlátozott | Legjobb kis társasházakhoz |
| **AppFolio** | $1.40-3/lakás/hó | 50+ lakás min. | Korlátozott | AI automatizálás |
| **Vantaca** | Egyedi | Nagyvállalat | Korlátozott | AI workflow (HOAi) |
| **TownSq** | Egyedi | N/A | Digitális szavazás | Közösségi funkciók |
| **PayHOA** | $54-109/hó | Kis HOA-k | Korlátozott | Egyszerűség |

**Közös jellemző:** Amerikai HOA jogra épülnek. Európai/magyar jogot egyik sem ismeri.

## 3.2 Európai platformok

| Platform | Piac | Megjegyzés |
|---|---|---|
| **Impower** (impower.de) | Németország/Ausztria | GDPR-kompatibilis, de német WEG jogra épül |
| **Planon** (planon.com) | NL, DE, UK | Enterprise IWMS, nem társasház-specifikus |
| **Urbanise** (urbanise.com) | 18 ország (AU) | AI-alapú strata management |

**Egyik sem lokalizált a CEE/magyar piacra.**

## 3.3 Szavazás-specifikus nemzetközi platformok

| Platform | Súlyozott szavazás | Quorum | Proxy | Ár |
|---|---|---|---|---|
| **GetQuorum** | Nem megerősített | Igen (300%+ növelés) | Igen | Egyedi |
| **ElectionBuddy** | **Igen** | Igen | Igen | ~$99/szavazás |
| **CondoVoter** | Nem megerősített | Igen | Igen | Egyedi |
| **Simply Voting** | Igen | Igen | Igen | Egyedi |

**ElectionBuddy** a legjobban konfigurálható, de:
- Per-szavazás árazás (nem előfizetéses)
- Magyar jogi specifikumokat nem ismeri
- Nem integrált (önálló szavazó platform)

---

# 4. Funkció-összehasonlítás

> Lásd: `diagrams.drawio.xml` — **"Funkció-összehasonlítás"** lap

## 4.1 Feature matrix

| Funkció | eHÁZ | Társasház App | Honline | Condo Control | ElectionBuddy | **Condo Manager** |
|---|---|---|---|---|---|---|
| Könyvelés | +++ | ++ | - | ++ | - | ++ |
| NAV integráció | +++ | ++ | - | - | - | + |
| Online szavazás | - | + | ++ | ++ | +++ | +++ |
| Tulajdoni hányad súlyozás | - | + | ? | - | ++ | +++ |
| Határozatképesség (jelenlét) | - | - | - | - | - | **+++** |
| Megismételt közgyűlés | - | - | - | - | - | **+++** |
| Minősített többség (2/3, 4/5) | - | - | - | - | + | **+++** |
| Egyhangúság kezelése | - | - | - | - | - | **+++** |
| Tartózkodás kezelése | - | - | - | - | - | **+++** |
| Jelenléti ív | - | - | - | - | - | **+++** |
| Proxy szavazás | - | - | - | + | ++ | ++ |
| Titkos szavazás | - | - | - | + | ++ | ++ |
| Jegyzőkönyv generálás | - | - | + | - | - | ++ |
| Karbantartás kezelés | - | + | - | ++ | - | ++ |
| Kommunikáció (fórum, chat) | - | + | + | ++ | - | ++ |
| Dokumentumkezelés | + | + | - | ++ | - | ++ |
| Mobil app | ++ | ++ | + | ++ | + | ++ |
| Magyar nyelv | +++ | +++ | +++ | - | - | +++ |
| GDPR megfelelőség | + | + | + | - | + | ++ |

**Jelmagyarázat:** +++ kiváló, ++ jó, + alap, - nincs, ? nem megerősített

---

# 5. Jogszabályi megfelelőség

> Lásd: `diagrams.drawio.xml` — **"Szavazási logika — Döntési fa"** lap

## 5.1 Magyar társasházi törvény (2003. évi CXXXIII. tv.) — szavazási szabályok

### Határozatképesség
- Közgyűlés határozatképes, ha az **összes tulajdoni hányad >50%-a jelen van**
- A jelenlét és a szavazás **két külön fogalom**
- Minden szavazás előtt ellenőrizni kell

### Megismételt közgyűlés
- Ha az első nem határozatképes → 15 napon belül megismételt közgyűlés
- **Mindig határozatképes**, létszámtól függetlenül
- DE: minősített többséget igénylő döntések csak akkor hozhatók, ha a küszöböt elérik

### Szavazási típusok

| Típus | Alap | Küszöb | Megismételt közgyűlésen |
|---|---|---|---|
| Egyszerű többség | Jelenlévők hányada | >50% | Igen, korlát nélkül |
| Minősített 2/3 | Összes tulajdoni hányad | ≥66,67% | Csak ha elérik |
| Minősített 4/5 | Összes tulajdoni hányad | ≥80% | Csak ha elérik |
| Egyhangúság | Összes tulajdonos | 100% | Nem hozható |
| Relatív többség | Jelenlévők | Legtöbb szavazat | Igen |

### Melyik döntéshez melyik típus?

| Döntés | Típus |
|---|---|
| Költségvetés, beszámoló, közös képviselő | Egyszerű többség |
| SZMSZ elfogadás/módosítás | Egyszerű többség |
| Alapító okirat módosítás (közös tul. elidegenítés) | 2/3 (2025-től!) |
| Kamerarendszer létesítése | 2/3 |
| Dohányzás tiltása zárt közös helyiségben | 4/5 |
| Alapító okirat módosítás (főszabály) | Egyhangúság |
| Rendes gazdálkodást meghaladó kiadás | Egyhangúság |

## 5.2 Melyik platform felel meg a törvénynek?

**Egyetlen sem.** A Condo Manager az első és egyetlen platform, amely implementálja:
- Jelenléti ív (jelenlét ≠ szavazás)
- Határozatképesség jelenlét alapján
- Megismételt közgyűlés speciális szabályai
- 5 különböző többségi típus
- Tartózkodás helyes kezelése (nem számít nemnek)

---

# 6. Árazási térkép

> Lásd: `diagrams.drawio.xml` — **"Árazási pozícionálás"** lap

## 6.1 Magyar piac árazása

| Szegmens | Ár/lakás/hó | Példák |
|---|---|---|
| Alacsony | 39-49 Ft | Társasház App, OnlineHáz |
| Közép | 60-125 Ft | eHÁZ |
| Magas | Fix díjas (5 900+ Ft/hó) | Érték Rendszerház |
| Szavazás-only | Egyedi / per alkalom | Honline, eKözgyűlés |

## 6.2 Nemzetközi árazás

| Szegmens | Ár/lakás/hó | Példák |
|---|---|---|
| Entry | $0.50-1.00 | PayHOA, Yardi Breeze |
| Mid | $1.00-3.00 | AppFolio, Buildium |
| Enterprise | Egyedi | Vantaca, CINC Systems |
| Per-szavazás | $99-500/alkalom | ElectionBuddy, GetQuorum |

## 6.3 Javasolt pozícionálás

**Condo Manager: 79-99 Ft/lakás/hó + ÁFA**
- A könyvelés-only megoldásoknál olcsóbb, mint az eHÁZ
- Drágább, mint a Társasház App, de lényegesen több funkcióval
- Az all-in-one jelleg megspórolja a külön szavazási platform díját

---

# 7. Hiányosságok és lehetőségek

> Lásd: `diagrams.drawio.xml` — **"Piaci rések"** lap

## 7.1 Kritikus hiányosságok a magyar piacon

1. **Nincs integrált megoldás** — Könyvelés VAGY szavazás, de nem mindkettő
2. **Senki nem automatizálja a magyar jogot** — Határozatképesség, megismételt közgyűlés, minősített többség
3. **Gyenge lakói élmény** — A legtöbb platform kezelő-oldali, a lakók számára minimális funkció
4. **Nincs hibrid közgyűlés-támogatás** — Személyes + online egyidejű részvétel
5. **Elavult design** — A legtöbb magyar megoldás 2010-es évek designt használ

## 7.2 Lehetőségek

1. **Jogi megfelelőség mint USP** — Egyedülálló a piacon
2. **Mobil-first megközelítés** — Idős lakók számára is egyszerű
3. **Hibrid közgyűlés** — Post-COVID igény, törvényileg is támogatott
4. **Több nyelv egy társasházon belül** — Külföldi tulajdonosok kiszolgálása
5. **Automatikus jegyzőkönyv** — Időmegtakarítás az IB tagoknak

---

# 8. SWOT elemzés — Condo Manager

> Lásd: `diagrams.drawio.xml` — **"SWOT"** lap

| | Pozitív | Negatív |
|---|---|---|
| **Belső** | **Erősségek:** Magyar jog-kompatibilis szavazás (egyedülálló), modern tech stack (Next.js), all-in-one platform, mobil-first design, többnyelvű | **Gyengeségek:** Új a piacon (nincs brand), könyvelési modul kevésbé érett mint eHÁZ, nincs még NAV integráció |
| **Külső** | **Lehetőségek:** Fragmentált piac, nincs domináns all-in-one, növekvő igény online közgyűlésre, 2025-ös jogszabály-módosítások | **Veszélyek:** eHÁZ szavazási modult fejleszthet, alacsony fizetési hajlandóság, lassú technológia-adaptáció idős lakóknál |

---

# 9. Go-to-market stratégia javaslat

## 9.1 Célcsoport prioritás

1. **Első fázis:** Közös képviselők, akik már digitálisan dolgoznak (eHÁZ, OnlineHáz felhasználók) — nekik a szavazási modul az új érték
2. **Második fázis:** Kis társasházak (10-30 lakás), ahol az IB maga kezeli az ügyeket — nekik az egyszerűség az érték
3. **Harmadik fázis:** Professzionális ingatlankezelő cégek — nekik a skálázhatóság az érték

## 9.2 Differenciáció

**Fő üzenet:** "Az egyetlen társasházkezelő, ami ismeri a magyar jogot."

**Három pillér:**
1. **Jogszabály-kompatibilis szavazás** — határozatképesség, minősített többség, megismételt közgyűlés
2. **Minden egy helyen** — könyvelés + szavazás + kommunikáció + karbantartás
3. **Modern élmény** — mobilon is használható, lakók is szeretik

---

# 10. Következő lépések

- [ ] NAV Online Számla integráció tervezése (a könyvelési modul versenyképességéhez)
- [ ] Hibrid közgyűlés funkció specifikálása
- [ ] Automatikus jegyzőkönyv generálás tervezése
- [ ] Árazási modell véglegesítése és tesztelése
- [ ] Első pilot társasház keresése
- [ ] Marketing landing page elkészítése

---

*Készült: 2026. április | Forrás: Nyilvános weboldalak, termékleírások, árazási oldalak elemzése*
