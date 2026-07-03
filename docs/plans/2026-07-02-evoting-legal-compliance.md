# E-közgyűlés — jogi megfelelőségi és biztonsági terv

_Készült: 2026-07-02 · Állapot: 🟡 Megvalósítás folyamatban_

## Megvalósítási napló (verifikálva a kód ellen 2026-07-02)

A tervben szereplő kód-szintű állítások kód-ellenőrzése után:

- ✅ **P0.1 — titkos szavazat audit-szivárgás — MEGOLDVA.** Megerősítve: a `ballotCast` titkos szavazásnál is naplózta a `unitIds`-t, sőt az `entityId` egy konkrét titkos `Ballot`-ra mutatott (aminek van `optionId`-ja) → a caster `userId` + join a szavazathoz vezetett. Javítva: titkos szavazásnál az audit csak részvételt rögzít (`entityType="Vote"`, `{ voteId, isSecret:true, isProxy, isOnBehalf, count }`), sem `unitIds`, sem ballot-hivatkozás. Nyílt szavazásnál változatlan. Teszt: `tests/integration/ballot-audit-secrecy.test.ts`.
  - ✅ **P0.1 tail — timing-korreláció + turnout — MEGOLDVA.** Titkos szavazásnál a `Ballot.createdAt` ÉS a turnout audit `createdAt` percre kvantált (a cast összes ballotja + az audit ugyanazt a percet kapja), így az audit (userId+idő) nem köthető egy konkrét ballot-sorhoz. `createAuditLog` opcionális `createdAt`-ot fogad. A turnout aggregátum most `count` + `weight` (összsúly), albetét-hivatkozás nélkül. Az OPEN-kori jogosult-albetét pillanatkép is kész: a szavazat létrehozásakor `Vote.eligibleUnitCount` + `eligibleUnitsHash` (rendezett albetét-id-k SHA-256) + `eligibleSnapshotAt` rögzül — a jogosult „elektorátus" bizonyítható a titkos szavazatoktól függetlenül. Teszt: `vote-eligible-snapshot.test.ts`. **P0.1 ezzel teljes.**
- ✅ **P0.2 — BALLOT_SECRET — lényegében kész volt.** Verifikálva: már `REQUIRED_VARS`-ban van, boot-időben ellenőrzött (≥32 kar., placeholder-tiltás, prod `process.exit(1)`), cast-időben is. Egyetlen hiány pótolva: **`.env.example`-be felvéve**.
- 🟡 **P0.3 — Adatvédelmi dokumentáció — TERVEZETEK KÉSZ (jogi átnézésre vár).** `docs/legal/`: DPIA (`dpia-e-kozgyules.md`), adatkezelési tájékoztató hu+en (`adatkezelesi-tajekoztato.md`), adatmegőrzési politika (`adatmegorzesi-politika.md`), README. A rendszer tényleges adatkörei/mezői alapján, „DRAFT / jogi átnézésre vár" jelöléssel. **Hátralévő:** ügyvédi véglegesítés; adatkezelő nevének kitöltése; Art. 28 szerződések; a tájékoztató beépítése az appba (belépés + beállítások); purge-automatizálás + Art. 15/17 folyamat.
- ✅ **P0.4 — SZMSZ-felhatalmazás gate — GATE MEGOLDVA (1. rész).** `Building.remoteVotingAuthorized` + `remoteVotingSzmszRef` + `remoteVotingParams` felvéve. A `live/route.ts` `start` akció ONLINE/HYBRID/DEVICE módot elutasít (403 `REMOTE_VOTING_NOT_AUTHORIZED`), ha nincs felhatalmazás; IN_PERSON+HANDS mindig mehet. Prezenter (`assembly-presenter.tsx`): felhatalmazás nélkül az online/hibrid/eszközös opciók letiltva + magyarázó sáv + link az Önkormányzás oldalra. Önkormányzás panel: „Elektronikus közgyűlés" **csak státusz** (nincs kézi kapcsoló). Tesztek: `remote-voting-start-gate.test.ts` + `assembly-live-route.test.ts` frissítve.
  > **Jogi korrekció (felhasználói visszajelzés):** a felhatalmazás NEM kézi jelölőnégyzet (az nem bizonyíték), és az SZMSZ módosítása közgyűlési szavazást igényel. Ezért a `remoteVotingAuthorized` csak bizonyíték alapján billen `true`-ra. A jelölőnégyzetes „declare" endpointot és UI-t elvetettük.
- ✅ **P0.4 — 2. rész: AI-felismerés — MEGOLDVA.** `legal-doc-extract.ts` FOUNDING_DEED/SZMSZ/COMBINED esetén `remoteVoting: { authorized, section }`-t is kiolvas (a prompt: csak explicit kikötésre `true`, „ne következtess a hallgatásból"). Az onboarding feltöltő (`legal-doc-ai-extract.tsx`) felismeréskor felajánlja a rögzítést → `POST /api/buildings/remote-voting/from-document` {documentId, versionId, section} a konkrét (elfogadott) SZMSZ-dokumentum-verzióra hivatkozva billenti `true`-ra (bylaws.modify-gated, auditált). Tesztek: `legal-doc-extract.test.ts` bővítve, `remote-voting-from-document.test.ts` (4).
- ✅ **P0.4 — 3. rész: SZMSZ-módosítás közgyűlési szavazással — MEGOLDVA.** `BylawsChangeProposal.authorizeRemoteVoting` + `remoteVotingClause` (a megszövegezett SZMSZ-passzus). `proposeBylawsChange` fogadja (clause kötelező); az Önkormányzás panel „Elektronikus közgyűlés engedélyezése (SZMSZ-módosítás)" opciója szerkeszthető SZMSZ-passzus-sablonnal + szavazási pontot hoz létre a kiválasztott közgyűlésre. `resolveBylawsProposal` a szavazat elfogadásakor billenti `remoteVotingAuthorized=true`-ra (ref = „Közgyűlési határozat (<voteId>)", a passzus a `remoteVotingParams`-ba). Tesztek: bylaws-proposal.test.ts bővítve (propose + resolve, pass/fail). Élőben verifikálva: a javaslat + szavazás létrejön.

**P0.4 KÉSZ (mindhárom rész): gate + AI-felismerés + közgyűlési SZMSZ-módosítás. A felhatalmazás mindig bizonyíték-alapú (elfogadott SZMSZ-dokumentum vagy közgyűlési határozat), sosem kézi kapcsoló.**
- 🟢 **P1.1 — proxy-ellenőrzés — nagyrészt kész.** Verifikálva: cast-időben már ellenőrzött `validFrom ≤ now` ÉS `relationship=OWNER`. Csak a kifejezett `proxy.createdAt < vote.createdAt` finomítás hiányzik.
- Azonosítás: TOTP **implementálva** (`auth-options.ts`); WebAuthn **nincs**; JWT-munkamenet (nincs DB-adapter).

---

_Eredeti terv (jogi átnézésre vár):_

## A vezérelv

A magyar társasházi online szavazás legnagyobb kockázata **nem technológiai, hanem bizonyíthatósági**: utólag, bíróság vagy hatóság (NAIH) előtt bizonyítható-e a teljes döntéshozatali lánc — jogszerű összehívás → azonosítás → tulajdoni hányad szerinti súlyozás → határozatképesség → szavazás → eredményközlés → jegyzőkönyv — **anélkül, hogy közben sérülne a titkosság és az adatvédelem**.

Ebből következik a rendszer legfontosabb architekturális szabálya:

> **Szét kell választani két adathalmazt: „ki jogosult / ki szavazott" (folyamat-audit) és „hogyan szavazott" (titkos tartalom). A kettő között az üzemeltető vagy a közös képviselő ne tudjon egyszerű úton visszakötni.**

Ez a dokumentum a jelenlegi kód állapotát méri fel e szabály és a NAIH-elvárások mentén, majd priorizált feladatlistát ad.

---

## Gap-analízis a hat kritikus pont mentén

| # | Kritikus pont | Jelenlegi állapot | Ítélet |
|---|---|---|---|
| 1 | Titkos szavazat szétválasztása | `Ballot.userId` titkos szavazásnál `null`; SHA-256 `receiptHash` létezik. **DE** a folyamat-audit (`ballotCast`) titkos szavazásnál is naplózza a `unitIds`-t → időbélyeg + jelenléti adat összevetésével visszaköthető | 🔴 **Súlyos hiány** |
| 2 | Azonosítás & képviselet | `ProxyAssignment` `validFrom/validUntil` + `createdAt`; cast-időben ellenőrzött. Nincs viszont ellenőrzés, hogy a meghatalmazás a szavazás létrejötte ELŐTT kelt-e, és hogy a meghatalmazó valóban tulajdonos-e a leadáskor | 🟠 **Közepes hiány** |
| 3 | Határozatképesség & súlyok | Tulajdoni hányad szerint súlyozott, valós időben újraszámolt; mind az 5 többségi típus a Tht. szerinti pontos törttel. Megismételt közgyűlés kezelve | 🟢 **Megfelel** |
| 4 | Folyamat-audit vs. titkos tartalom | Nyílt szavazásnál nem naplózza a leadott opciót (jó). Szavazat nyitás/zárás naplózva, proxy-grant naplózva. **DE** lásd #1 (unitIds szivárgás); proxy-visszavonáskor nincs benne a grantor/grantee; jegyzőkönyv tartalma nincs verziózva/hashelve | 🔴 **Súlyos** (a titkos-szivárgás miatt) |
| 5 | Eredményközlés & kézbesítés | `AnnouncementDelivery` per-címzett/csatorna, `hasLegallyEquivalentEmail()` és `isDeliveryOverdue()` (§40(3), 8 nap) implementálva. E-mail-küldés **worker-sorból megy** (PR #60–#61, Resend). Hiányzik: hirdetőtáblai kifüggesztés hiteles bizonyítéka (aláírás/fotó); a 8-napos túllépés-figyelő job | 🟠 **Részleges** |
| 6 | DPIA / adatvédelmi dokumentáció | Kódban Tht.- és GDPR-hivatkozások; `contactConsentAt` tenant-hozzájárulás; contractor Art. 15 export + DPA-mező; kamera 15-napos NAIH-megőrzés. **Hiányzik**: DPIA, adatkezelési tájékoztató, megőrzési politika, tulajdonos/lakó oldali Art. 15 export, törlési (Art. 17) folyamat, adatfeldolgozói (Art. 28) szerződések dokumentálása | 🔴 **Súlyos** (dokumentációs) |
| 7 | **SZMSZ felhatalmazás az e-részvételre** | `Meeting.voteMode` (DEVICE/HANDS) és `format` (ONLINE/HYBRID/IN_PERSON) szabadon választható; az egyetlen kényszer, hogy ONLINE → DEVICE. **Nincs épület-szintű ellenőrzés, hogy az SZMSZ egyáltalán engedélyezi-e** az elektronikus/hibrid részvételt és annak kötelező szabályait. Így egy SZMSZ-felhatalmazás nélküli társasház is indíthat eszközös online közgyűlést → a határozat támadható | 🔴 **Súlyos** (jogszerűségi) |

> ⚠️ A #4/#1 audit-szivárgás és a #2 proxy-ellenőrzés a subagent kódolvasásán alapul (`src/app/api/voting/votes/[id]/ballot/route.ts`, `src/lib/voting/events.ts`). Implementáció előtt **a konkrét sorokat verifikálni kell** — de a mintázat hihető és a legnagyobb üzleti kockázat.

---

## Priorizált munkacsomagok

### P0 — Blokkoló az éles, valós társasházi szavazás előtt

**P0.1 — Titkos szavazat audit-szivárgás megszüntetése** _(a legfontosabb tétel)_
- Titkos szavazásnál a `ballotCast` audit-esemény **ne** tartalmazza a `unitIds`-t. Naplózzon csak: `{ voteId, isProxy, isOnBehalf, isSecret: true, count }`.
- Bevezetni egy **részvételi (turnout) pillanatképet** külön a tartalomtól: „vote OPEN időpontban jogosult albetétek listája/hash-e" + „leadott szavazatok darabszáma/összsúlya" — anélkül, hogy egy-egy titkos szavazat konkrét albetéthez kötődne az auditban.
- Az audit-lekérdezés (`/api/audit-logs`) titkos szavazatok albetét-szintű bontását ne adja vissza board-tagoknak sem.
- Beszúrási sorrend / `createdAt` korreláció ellen: titkos szavazatokat **kötegelt beszúrással** és/vagy időbélyeg-kvantálással (pl. percre kerekítés a titkos ballotnál) rögzíteni.

**P0.2 — Ballot-titkosítás konfiguráció megerősítése**
- `BALLOT_SECRET`: felvenni `.env.example`-be, **indításkor** kikényszeríteni (min. 32 karakter), rotációs eljárás dokumentálása. Ne csak cast-időben, hanem boot-időben bukjon el, ha hiányzik/gyenge.

**P0.3 — Adatvédelmi alapdokumentáció (jogi launch-feltétel)**
- **DPIA** (GDPR 35. cikk) — a titkos e-szavazást magas kockázatú adatkezelésként kezelni; kockázatok + technikai/szervezési intézkedések. A NAIH e-szavazásnál kifejezetten hatásvizsgálatot (és bizonyos esetben előzetes konzultációt) vár.
- **Adatkezelési tájékoztató** (13/14. cikk) hu+en — jogalap, célok, videó/chat/jelenlét/IP/eszközadat/meghatalmazás/képernyőfelvétel kezelése, megőrzési idő, érintetti jogok. Bejelentkezéskor és a beállításokban elérhető.
- **Megőrzési politika** — per-entitás táblázat (pl. Ballot: elévülésig ~5 év; pénzügyi rekord: Számv. tv. §169 → 8 év; audit-napló: ~3–5 év; kamera: 15 nap; jelenléti/IP: közgyűlés bizonyíthatóságához szükséges minimum).

**P0.4 — SZMSZ-felhatalmazás mint az e-szavazás előfeltétele (gate + onboarding)** _(#7)_

Ha az SZMSZ nem tartalmaz elektronikus/hibrid részvételre vonatkozó szabályt, előbb **SZMSZ-módosítás szükséges** — az e-szavazás jogilag addig nem indítható. A rendszernek ezt ki kell kényszerítenie és az onboarding során kezelnie.

- **Épület-szintű állapot**: `Building.remoteVotingAuthorized: Boolean @default(false)` + `remoteVotingSzmszRef` (a felhatalmazó SZMSZ `Document`/verzió hivatkozása) + `remoteVotingParams: Json?` — az SZMSZ által kötelezően rögzítendő elemek pillanatképe: **platform, csatlakozás, azonosítás, meghatalmazás, szavazási mód, kapcsolatmegszakadás kezelése, hitelesítés módja** (a XIII. kerületi e-közgyűlés kisokos elvárásai).
- **Gate a szavazásindításnál**: a `POST /voting/meetings/[id]/live` `start` akció `format=ONLINE|HYBRID` vagy `voteMode=DEVICE` esetén **utasítsa el**, ha `remoteVotingAuthorized=false`. A prezenter UI (`assembly-presenter.tsx`) tiltsa le ezeket az opciókat, és mutasson magyarázatot + linket az SZMSZ-módosításhoz. (Ma csak az „ONLINE→DEVICE" kényszer van, engedély-ellenőrzés nincs.)
- **Onboarding — SZMSZ lépés bővítése** (`/dashboard/onboarding`):
  - Az **AI SZMSZ-kiolvasás** (`szmsz-extract`) ismerje fel az e-részvételt engedélyező kikötést és a fenti hét paramétert; töltse elő a `remoteVotingParams` javaslatot **emberi jóváhagyásra** (semmi nem íródik automatikusan).
  - Explicit ellenőrző kérdés a lépésben: „Az SZMSZ engedélyezi az elektronikus/hibrid közgyűlést, és szabályozza a platformot / azonosítást / meghatalmazást / szavazási módot / kapcsolatmegszakadást / hitelesítést?" → igen esetén `remoteVotingAuthorized=true` + a hivatkozott SZMSZ-verzió rögzítése; nem/hiányos esetén **az e-szavazás zárva marad**.
  - Hiányos SZMSZ esetén az onboarding **vezesse át a felhasználót az SZMSZ-módosítási folyamaton** a meglévő `BylawsChangeProposal` + szavazás mechanizmussal és a beépített **SZMSZ-szabálymintával** (lásd P3). A módosítás elfogadott közgyűlési határozatára `remoteVotingAuthorized` billenjen `true`-ra (a proposal apply-lépésében), a felhatalmazó jegyzőkönyv/verzió hivatkozásával.
- **Setup-checklist**: az „e-szavazás engedélyezve az SZMSZ-ben" új tétel legyen a dashboard beüzemelési listáján; amíg nincs kész, az élő közgyűlés eszközös módja letiltva marad.

### P1 — Jogszerűség és teljes bizonyíthatóság megerősítése

**P1.1 — Proxy- és jogosultság-ellenőrzés szigorítása** (#2)
- Ellenőrizni, hogy a meghatalmazás a szavazás létrejötte előtt kelt (`proxy.createdAt < vote.createdAt`), vagy vote-specifikus és a vote még nem nyílt meg.
- Leadáskor ellenőrizni, hogy a meghatalmazó **jelenleg is tulajdonos** (`UnitUser.relationship = OWNER`).
- A tulajdoni hányad / szavazati súly **befagyasztása** a szavazás idejére (a `ballot.weight` már pillanatkép — dokumentálni és validálni, hogy a nyitás utáni share-változás nem torzít).

**P1.2 — Audit-lánc teljessé tétele** (#4)
- Jelenlét check-in/check-out → explicit audit-bejegyzés (ma csak `MeetingAttendance` implicit).
- Proxy-visszavonás audit: tartalmazza a `grantorId`/`granteeId`-t és az okot.
- Szavazat létrehozásakor a **teljes opció-lista** naplózása; DRAFT után opció-módosítás tiltása.
- **Jegyzőkönyv verziózása + tartalom-hash** (a meglévő `GeneratedReport.contentHash` mintára) — legyen bizonyítható, mi és mikor került a jegyzőkönyvbe, ki hitelesítette (a `MeetingMinutesSignature` már megvan).

**P1.3 — Kézbesítési bizonyíték teljessé tétele** (#5)
- **Verifikálni**, hogy az e-mail worker (Resend, PR #60–#61) ténylegesen `QUEUED → DELIVERED/FAILED`-re állítja a `AnnouncementDelivery` sorokat, és eltárolja a szolgáltatói `externalId`-t (kézbesítési nyugta).
- **8-napos túllépés-figyelő** job (`isDeliveryOverdue()` már létezik → hívó/cron + board-értesítés).
- Hirdetőtáblai kifüggesztés hiteles bizonyítéka: `signedBy` (kifüggesztő) + `proofDocumentId` (fotó/szkennelt ív), és a `deliveredAt` a tényleges kifüggesztés ideje legyen.
- Írásbeli szavazás / online közgyűlés / e-mailes kézbesítés **külön jogintézmények** — a UI és az adatmodell egyértelműen válassza szét őket és az SZMSZ szerinti szabályaikat.

**P1.4 — Kapcsolatmegszakadás kezelése** (jogszerűségi, Élő közgyűlés)
- Az élő közgyűlésben szabályozott viselkedés reconnect/kilépés esetén: a jelenlét (és így a quorum) hogyan változik; szavazás közbeni kiesés kezelése; mindez naplózva és az SZMSZ-mintában rögzítve.

### P2 — Érintetti jogok és tartós működés

**P2.1 — Érintetti jog-folyamatok**
- Tulajdonos/lakó oldali **Art. 15 adatkivonat** (a contractor-export mintájára) — minden PII + kapcsolódó rekord.
- **Art. 17 törlés**: a meglévő `User.deletedAt`/`anonymizedAt` mezőkhöz tényleges anonimizáló/törlő folyamat, a megőrzési kötelezettségek tiszteletben tartásával (pl. pénzügyi rekord 8 év).

**P2.2 — Megőrzés kikényszerítése**
- Purge/anonimizáló **worker** a megőrzési politika szerint (kamera-retention cron már van → általánosítani más entitásokra).

**P2.3 — Adatfeldolgozók (Art. 28)**
- DPA-k dokumentálása: e-mail (Resend), tárolás (R2/S3, ha bevezetik), Stripe, valamint az SZMSZ-kiolvasáshoz használt AI szolgáltató (zero-retention/DPA — már jelezve a memóriában).

### P3 — Termékesített jogi védőréteg (értékesíthető funkció)

- **SZMSZ-szabályminták** elektronikus és hibrid közgyűléshez: platform, csatlakozás, azonosítás, meghatalmazás, szavazási mód, kapcsolatmegszakadás kezelése, hitelesítés módja — beépített, kitölthető sablon (a XIII. kerületi e-közgyűlés kisokos elvárásai szerint). Ha az SZMSZ még nem engedi az e-részvételt, a rendszer vezesse végig a módosításon (a meglévő `BylawsChangeProposal` + szavazás folyamattal). **Ez a sablon a P0.4 gate „megoldó" ága** — az onboarding és az élő közgyűlés zárolt eszközös módja is ide irányít.
- **Egy gombos jogi csomag** minden határozathoz: jegyzőkönyv + eredményközlés + kézbesítési bizonyíték automatikus, hiteles előállítása.

---

## Azonosítás és személyazonosság-igazolás (távszavazás) — a #2 pont kifejtése

### Vezérelv: az azonosítás módját az SZMSZ határozza meg (arányosság)

Közhatalmi választással szemben a **társasházi online szavazásnál nincs jogszabályi kényszer az állami szintű eID-re** (Tht. + a XIII. kerületi e-közgyűlés kisokos). Az „azonosítás módja" az **SZMSZ-ben szabályozandó, kötelezően rögzítendő paraméter** (lásd P0.4 `remoteVotingParams`). A mérce nem „állami eID", hanem **„bizonyíthatóan a jogosult tulajdonos/meghatalmazott szavazott"** — az arányosság a döntő. Ezért a DÁP/KAÜ **opció, nem előfeltétel.**

Az identitást három, egymástól elváló pillanatban kell kezelni — az állami eID (DÁP) csak a középsőt érinti:

1. **Beléptetés (enrollment)** — „ez a fiók = ez a valós tulajdonos" megállapítása (egyszer). **Az assurance nagy része innen jön**, és ezt már ma jól csináljuk: meghívó a tulajdonosi névjegyzékhez / tulajdoni hányadhoz kötve.
2. **Hitelesítés (authentication)** — a fiók újra-igazolása belépéskor (minden munkamenet).
3. **Megerősítés a szavazatnál (step-up)** — a konkrét szavazathoz kötött extra faktor (szavazatonként).

A beléptetés az igazi horgony; a belépés és a step-up csak visszaköti hozzá.

### Az azonosítási módszerek menüje (gyengébb → erősebb)

| Szint | Módszer | Mit igazol | Ráfordítás | Illeszkedés |
|---|---|---|---|---|
| **Alap (megvan)** | E-mail+jelszó, a fiókot a közös képviselő nyitja a névjegyzék ellen | Annyira erős, amennyire a beléptetés | — | Kis tét esetén OK; kötelező erejű szavazathoz önmagában gyenge |
| **+ Step-up faktor** | **Passkey/WebAuthn** vagy **TOTP** a szavazatnál | Regisztrált eszköz birtoklása | alacsony | ⭐ A legjobb ráfordítás/assurance arány. A **TOTP már ma megvan** (`auth-options.ts`) |
| **+ Élő videós azonosítás** | A levezető elnök vizuálisan igazol, rögzítve | Arc ↔ névjegyzék, rögzített bizonyíték | lásd lentebb | ⚠️ **Ma NINCS videó a rendszerben** (az „assembly stream" csak SSE állapot-szinkron, nem kamera). Külső platform (Zoom/Teams/Meet) az SZMSZ által megnevezett azonosítási színtérként, vagy jelentős fejlesztés (WebRTC + rögzítés + megőrzés, nagyobb DPIA-felület) |
| **Dokumentumos KYC beléptetéskor** | Igazolvány/szelfi vagy tulajdoni lap ellenőrzés vendorral | Egyszeri erős identitás-igazolás | közepes, díjas | A beléptetés opcionális megerősítése |
| **AVDH** | A tulajdonos KAÜ-vel azonosít, a szavazat/írásbeli nyilatkozat állami hitelesítésű aláírást kap | Állami identitás **a dokumentumon** | ingyenes, állami | ⭐ Ideális **írásbeli szavazáshoz** — a bizonyíthatóság vezérelvét közvetlenül szolgálja |
| **KAÜ** | Ügyfélkapu+/DÁP/eID-kártya egy kapun át | Központi állami assurance | magas (szerződés, SAML) | Legerősebb általános belépés; nehéz |
| **DÁP közvetlenül** | Mobil eID / adattárca (OpenID4VC, eIDAS 2.0) | Állami identitás | legmagasabb (DMÜ-szerződés) | Túllövés, kivéve ha jogszabály kötelezi |
| **eIDAS-notifikált eID** | Más EU-tagállam eID-je az eIDAS-csomóponton át | Határon átnyúló állami identitás | KAÜ-n át | Csak külföldi tulajdonosnál |

### Ajánlott megközelítés (rétegezés, nem csere)

1. **A beléptetés marad az identitás-horgony** — meghívó a `UnitUser` OWNER rekordhoz kötve. Ezt keményítsük (opcionális dok-ellenőrzés), ne eID-vel váltsuk ki.
2. **Step-up faktor a szavazatnál** — **passkey** (adathalászat-ellenálló, eszközhöz kötött), **TOTP-fallbackkel** (utóbbi már megvan). Ez a legnagyobb assurance-nyereség a legkisebb munkával, és közvetlenül a #2 hiányt orvosolja.
3. **Írásbeli szavazáshoz AVDH** — ingyenes, állami hitelesítésű, és az aláírás magára a szavazatra kerül.
4. **KAÜ/DÁP mint opcionális „erős azonosítás" szint**, amit egy épület bekapcsolhat, ha az SZMSZ-e megköveteli — nem alapértelmezés.

A step-up faktor kiválasztása **per-épület** kerüljön a P0.4 `remoteVotingParams`-ba (melyik módszert írja elő az adott SZMSZ), a P3 SZMSZ-sablon pedig **választólistaként** kínálja a fenti menüt egy arányossági megjegyzéssel.

### Passkey (WebAuthn) — működés és többeszközös kezelés

A passkey egy **WebAuthn hitelesítő**: a privát kulcs a felhasználó eszközének biztonságos enklávéjában / jelszókezelőjében (Face ID / Touch ID / Windows Hello / szinkronizált iCloud–Google kulcstár), a szerver csak a **publikus kulcsot** tárolja. A hitelesítés aláírt kihívás — nincs mit ellopni vagy visszajátszani.

- **Regisztráció (egyszer, a hitelesített tulajdonoshoz kötve):** a már belépett OWNER „eszköz regisztrálása" gombjára a böngésző `navigator.credentials.create()` kulcspárt generál (biometria), a szerver eltárolja a `credentialId`-t + publikus kulcsot a `userId`-hez. A bizalom onnan jön, hogy a személy a regisztrációkor **már** a névjegyzék szerint igazolt tulajdonos.
- **Step-up a szavazatnál:** friss véletlen kihívás → `navigator.credentials.get()` (biometria) → a szerver ellenőrzi az aláírást → a szavazat elfogadva, és a **folyamat-auditba** kerül egy step-up assertion (`userId`, `credentialId`, időbélyeg) — **nem a titkos ballotba** (a szétválasztás bal oldala).

**Többeszközös használat (laptop/mobil) — a normális, elvárt eset. Két mechanizmus fedi le:**

1. **Szinkronizált passkey (a gyakori eset, gyakran „csak működik"):** Apple iCloud Keychain / Google Password Manager / 1Password átszinkronizálja a kulcsot a felhasználó eszközei között. Egy iPhone-on regisztrált passkey **már elérhető a Macen is**. A WebAuthn **Backup-Eligible / Backup-State** flag megmondja, hogy egy adott passkey szinkronizált-e vagy egyeszközös — ezt érdemes az auditban rögzíteni (a „fiók-szintű" vs. „konkrét eszköz" birtoklás megkülönböztetéséhez).
2. **Több hitelesítő fiókonként (a modell lényege):** a WebAuthn eleve **egy felhasználó → sok credential**. Amit a szinkron nem fed le (pl. iPhone passkey + Windows laptop, hardveres kulcs), arra egy **„Eszközök kezelése"** felület: regisztrált credentialek listája (név, utolsó használat), **új eszköz hozzáadása** (már belépett munkamenetből), **visszavonás**.

**Új eszköz felvétele passkey nélkül:** (a) belépés a **fallbackkel** (jelszó + TOTP, már megvan) → majd passkey regisztrálása ott; vagy (b) **cross-device belépés (QR + Bluetooth):** a laptop QR-t mutat, a telefon beolvassa és Face ID-vel aláírja — a laptopra semmi nem települ, a telefon a hitelesítő (böngésző/OS beépített funkciója).

**Recovery — a rendszer valódi gyenge pontja (tervezendő):** ha a tulajdonos minden eszközét *és* a TOTP-jét elveszti, a helyreállításnak a **beléptetési horgonyhoz** kell visszanyúlnia (újra-meghívás a névjegyzék ellen, közös képviselői megerősítéssel). Társasházi szavazásnál arányos, de legyen **tudatos, naplózott folyamat**, ne utólagos ötlet.

### Stack-hatás (a #2/P0.4 megvalósításához)

- Jelenlegi állapot: **Auth.js v5, Credentials provider + JWT munkamenet, DB-adapter nélkül**; **TOTP már az `authorize()`-ban van**. **Nincs WebAuthn modell** (a séma `AUTHENTICATOR_1/2` a *hitelesítő emberek*, nem WebAuthn).
- Mivel nincs adapter, az Auth.js beépített WebAuthn providere nem drop-in. Hozzáadandó:
  - **`WebAuthnCredential` modell** — `User`-höz 1:N: `{ credentialId, publicKey, counter, transports, backupEligible, backupState, name, lastUsedAt }`.
  - Regisztráció / hitelesítés / step-up endpointok **`@simplewebauthn/server`**-rel (`verifyRegistrationResponse`, `generate/verifyAuthenticationResponse`), a meglévő JWT-munkamenetet és a TOTP-fallbacket újrahasználva.

---

## Adatmodell-elv (a szétválasztás rögzítése)

```
FOLYAMAT-AUDIT (ki, mikor, milyen jogosultsággal)      TITKOS TARTALOM (hogyan)
────────────────────────────────────────────────      ──────────────────────────
- meghívó kiküldve (címzett, időbélyeg)                 - Ballot: userId = NULL
- belépés / azonosítás (userId, időbélyeg, IP*)         - unitId szükséges a súlyhoz és a
- jelenlét check-in/out → quorum-hatás                    dupla-szavazás gátjához, DE
- proxy érvényessége a nyitáskor                          az auditból NEM vezethető ide vissza
- „X jogosult albetét nyitáskor" (hash/snapshot)        - receiptHash (SHA-256, BALLOT_SECRET)
- „Y leadott szavazat / Z összsúly"                     - opció csak összesítve jelenik meg
- vote open/close (ki zárta: ember/cron)
- jegyzőkönyv-hash + hitelesítő aláírások

*IP/eszközadat: csak a minimálisan szükséges, tájékoztatóban rögzítve, korlátozott megőrzéssel.
```

A cél: a bal oldal önmagában bizonyítja a folyamat integritását; a jobb oldal titkos marad; **a kettő közti visszakötés ne legyen triviális** sem az üzemeltető, sem a közös képviselő számára.

---

## Javasolt sorrend

1. **P0.1** (audit-szivárgás) — kis kód, nagy jogi hatás. Ez a „titkos, de auditálható" ígéret sarokköve.
2. **P0.4** (SZMSZ-felhatalmazás gate + onboarding) — e nélkül jogszerűtlen e-közgyűlés indítható; a gate önmagában kis kód, az onboarding-ág a P3 SZMSZ-sablonnal együtt teljes.
3. **P0.3** (DPIA + tájékoztató + megőrzés) — jogi launch-feltétel, párhuzamosan indítható (jogi tanácsadóval).
4. **P0.2**, majd **P1.1–P1.3**.
5. **P2**, **P3**.

Éles, valós társasházi szavazás **csak a P0 teljesítése után**, és a DPIA/tájékoztató külső jogi átnézésével induljon.

---

## Verifikálandó a megvalósítás első lépéseként

- `src/app/api/voting/votes/[id]/ballot/route.ts` — a titkos ág `unitIds`-naplózása (P0.1).
- `src/lib/voting/events.ts` — audit-esemény payloadok (P0.1, P1.2).
- E-mail worker processor — `AnnouncementDelivery` státuszfrissítés valós SMTP-nyugtával (P1.3).
- `env.ts` / `.env.example` — `BALLOT_SECRET` kikényszerítés (P0.2).
- `src/app/api/voting/meetings/[id]/live/route.ts` + `src/components/voting/assembly-presenter.tsx` — a `start` akció / mód-választó gate `remoteVotingAuthorized`-ra (P0.4).
- `src/lib/szmsz-extract.ts` + onboarding SZMSZ lépés — e-részvételi kikötés + a hét paraméter kiolvasása és jóváhagyása (P0.4).
