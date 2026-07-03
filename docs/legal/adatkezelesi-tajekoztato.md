# Adatkezelési tájékoztató — társasházi közgyűlés és e-szavazás

> **⚠️ TERVEZET — jogi átnézésre vár.** GDPR 13–14. cikk szerinti tájékoztató
> első változata a rendszer tényleges működése alapján. A társasház mint
> adatkezelő nevét/elérhetőségét, valamint a végleges megőrzési időket ki kell
> tölteni, és jogi tanácsadóval véglegesíteni kell. A megjelenítés a bejelentkezéskor
> és a beállításokban javasolt. Készült: 2026-07-03.

---

## Magyar változat

### 1. Az adatkezelő
A(z) **[társasház neve, címe]** társasházközösség, képviseletében a közös
képviselő / intézőbizottság. Kapcsolat: **[e-mail / cím]**. A szoftvert
adatfeldolgozóként a(z) **[üzemeltető]** biztosítja.

### 2. Milyen adatokat kezelünk és miért?

| Adatkör | Példák | Cél | Jogalap |
|---|---|---|---|
| Fiók / azonosítás | név, e-mail, jelszó (hash), telefon*, cím* | belépés, kapcsolattartás | tagsági viszony; 6(1)(f) |
| Kétfaktoros hitelesítés | TOTP-titok | fiókbiztonság | 6(1)(f) jogos érdek |
| Munkamenet-biztonság | **csonkolt IP** (/24, /48), eszközcímke, város/ország*, aktivitás | visszaélés-felismerés, biztonság | 6(1)(f) |
| Tulajdon | albetét, tulajdoni hányad, tulajdonos/bérlő viszony | szavazati súly, költségmegosztás | 6(1)(c) + Tht. |
| Jelenlét | közgyűlési be-/kijelentkezés ideje | határozatképesség igazolása | 6(1)(c) + Tht. |
| Meghatalmazás | meghatalmazó/-ott, érvényesség | képviselet igazolása | 6(1)(c) + Tht. |
| Szavazat | leadott opció, súly | döntéshozatal | 6(1)(c) + Tht. |
| Folyamat-napló | ki/mikor/mit tett | döntés bizonyíthatósága | 6(1)(f) |
| Kamera* | felvétel | vagyonvédelem | Tht. § 25 + NAIH |

\* opcionális / csak ha releváns.

**Titkos szavazás**: ha a szavazás titkos, a szavazatot **nem kötjük a
személyéhez** — utólag nem állapítható meg, ki hogyan szavazott. Csak azt
rögzítjük (részvételként), hogy Ön szavazott, és a nyugtájával ellenőrizheti,
hogy szavazata beszámított.

**Videó/hang**: az alkalmazás beépített „élő közgyűlés" funkciója **nem rögzít
kamera- vagy hangfelvételt** — csak a szavazás állapotát szinkronizálja. Ha a
társasház **külön videóplatformot** (pl. Zoom/Teams/Meet) használ azonosításra
vagy közvetítésre, arról az adott szolgáltató és a társasház **külön
tájékoztatót** ad.

### 3. Kiknek továbbítjuk (adatfeldolgozók)
E-mail-kézbesítés (Resend), tárhely, fizetés (Stripe), valamint az SZMSZ/alapító
okirat AI-kiolvasása (OpenAI) — utóbbinál zero-retention megállapodás mellett a
dokumentum a szolgáltatónál nem tárolódik, az eredményt ember hagyja jóvá.
Mindegyikkel adatfeldolgozói szerződés (GDPR 28.) van/lesz.

### 4. Meddig őrizzük?
A célhoz szükséges ideig, illetve amíg jogszabály kötelez — pl. pénzügyi
bizonylatok **8 év** (Számv. tv. § 169), kamerafelvétel **max ~15 nap** (NAIH),
szavazat/napló a határozat elévüléséig (~5 év). Részletek: *Adatmegőrzési politika*.

### 5. Az Ön jogai
Hozzáférés, helyesbítés, törlés, korlátozás, tiltakozás, adathordozhatóság
(GDPR 15–21.). Kérelmét a fenti elérhetőségen jelezheti. Panasz: **NAIH**
(1055 Budapest, Falk Miksa u. 9-11.; ugyfelszolgalat@naih.hu), illetve bíróság.
A megőrzési kötelezettség a törlést felülírhatja — ilyenkor az adatot zároljuk.

---

## English version

### 1. Controller
The condominium community **[name, address]**, represented by the property
manager / management board. Contact: **[email / address]**. The software is
provided as a processor by **[operator]**.

### 2. What data we process and why

| Category | Examples | Purpose | Legal basis |
|---|---|---|---|
| Account / identity | name, email, password (hash), phone*, address* | login, contact | membership; 6(1)(f) |
| Two-factor auth | TOTP secret | account security | 6(1)(f) |
| Session security | **truncated IP** (/24, /48), device label, city/country*, activity | abuse detection | 6(1)(f) |
| Ownership | unit, ownership share, owner/tenant status | vote weight, cost allocation | 6(1)(c) + Tht. |
| Attendance | meeting check-in/out time | quorum proof | 6(1)(c) + Tht. |
| Proxy | grantor/grantee, validity | representation proof | 6(1)(c) + Tht. |
| Ballot | chosen option, weight | decision-making | 6(1)(c) + Tht. |
| Process audit | who/when/what | decision provability | 6(1)(f) |
| Camera* | footage | property protection | Tht. § 25 + NAIH |

\* optional / only where relevant.

**Secret voting**: for a secret vote your ballot is **not linked to your
identity** — it cannot be established afterwards how you voted. We record only
that you participated, and you can verify with your receipt that your vote counted.

**Video/audio**: the built-in "live assembly" feature **records no camera or
audio** — it only synchronises voting state. If the condominium uses a **separate
video platform** (e.g. Zoom/Teams/Meet) for identification or streaming, that
provider and the condominium give a **separate notice**.

### 3. Recipients (processors)
Email delivery (Resend), storage, payments (Stripe), and AI extraction of the
SZMSZ / founding deed (OpenAI) — the latter under a zero-retention arrangement
(the document is not stored by the provider; a human approves the result). Each
is/will be covered by a Art. 28 data-processing agreement.

### 4. Retention
As long as necessary or legally required — e.g. financial records **8 years**
(Act on Accounting § 169), camera footage **max ~15 days** (NAIH), ballots/audit
until the resolution's limitation period (~5 years). See *Data Retention Policy*.

### 5. Your rights
Access, rectification, erasure, restriction, objection, portability (GDPR 15–21).
Contact us at the address above. Complaint: **NAIH** (Hungarian DPA) or a court.
A retention obligation may override erasure — in that case the data is restricted.
