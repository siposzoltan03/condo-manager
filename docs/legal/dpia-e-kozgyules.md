# Adatvédelmi hatásvizsgálat (DPIA) — elektronikus közgyűlés és e-szavazás

> **⚠️ TERVEZET — jogi átnézésre vár.** Ez a dokumentum a fejlesztőcsapat által
> készített első változat, a rendszer tényleges működése alapján. Éles, valós
> társasházi szavazás megkezdése előtt **adatvédelmi szakértő / ügyvéd
> felülvizsgálata és a társasház mint adatkezelő általi elfogadása szükséges.**
> Jogalap: GDPR 35. cikk. Készült: 2026-07-03.

## 1. Miért kötelező a hatásvizsgálat?

A GDPR 35. cikke szerint hatásvizsgálat kell, ha az adatkezelés az érintettek
jogaira nézve valószínűsíthetően magas kockázattal jár. A titkos elektronikus
szavazás több okból is ilyen:

- **titkosság vs. bizonyíthatóság feszültsége** — igazolni kell, hogy a jogosult
  szavazott, miközben *nem* deríthető ki, **hogyan** szavazott;
- **rendszeres, nagyszámú érintett** (a társasház összes tulajdonosa);
- **különösen érzékeny összefüggés**: a szavazási magatartás politikai/érdek­­
  képviseleti véleménynek minősülhet;
- **új technológia** (online részvétel, eszközös szavazás).

A NAIH gyakorlata az online/elektronikus szavazásnál kifejezetten
hatásvizsgálatot — indokolt esetben előzetes konzultációt — vár el.

## 2. Az adatkezelés leírása

| Elem | Leírás |
|---|---|
| **Adatkezelő** | a társasház (közösség), képviseletében a közös képviselő / intézőbizottság |
| **Adatfeldolgozó** | a szoftver üzemeltetője (SaaS) + alfeldolgozói (e-mail: Resend; AI-kiolvasás: OpenAI; tárhely; Stripe) |
| **Cél** | jogszerű társasházi döntéshozatal lebonyolítása és utólagos bizonyíthatósága (Tht.) |
| **Jogalap** | jogi kötelezettség (GDPR 6(1)(c) + Tht.), illetve a közösség jogos érdeke a döntés bizonyíthatóságához (6(1)(f)); a tulajdonosi névjegyzék a szerződéses/tagsági viszonyból ered |
| **Érintettek** | tulajdonostársak, meghatalmazottak; korlátozottan bérlők/használók |

### Kezelt adatkörök (a rendszer tényleges mezői alapján)

- **Azonosítás / fiók**: név, e-mail, jelszó-hash, opcionális telefon, másodlagos
  e-mail, állandó/levelezési cím; kétfaktoros (TOTP) titok *at-rest* tárolva.
- **Munkamenet / biztonság**: `/24` (IPv4) vagy `/48` (IPv6) szintre **csonkolt IP**,
  eszközcímke, opcionális város/ország, utolsó aktivitás.
- **Tulajdonosi jogosultság**: albetét, tulajdoni hányad (az alapító okiratból),
  tulajdonos/bérlő viszony.
- **Jelenlét**: közgyűlési check-in/check-out időpont (a határozatképességhez).
- **Meghatalmazás**: meghatalmazó/meghatalmazott, érvényesség.
- **Szavazat**:
  - *nyílt* szavazásnál: albetét ↔ leadott opció (a Tht. szerint nyílt);
  - *titkos* szavazásnál: **a szavazat nincs a személyhez kötve** (`Ballot.userId = null`),
    a nyugta HMAC-hash (`BALLOT_SECRET`).
- **Folyamat-audit**: ki, mikor, milyen jogosultsággal cselekedett — a *tartalomtól*
  elválasztva.
- **Kamera** (ha a társasház üzemeltet): felvételek, per-kamera megőrzési idővel.

**Videó/hang**: a rendszer beépített „élő közgyűlés" funkciója **nem tartalmaz
kamerát/hangot** — csak állapot-szinkronizálást (SSE). Ha a társasház külső
platformot (Zoom/Teams/Meet) használ vizuális azonosításra, az **önálló
adatkezelés**, saját jogalappal és tájékoztatóval; a jelen DPIA-t ki kell egészíteni.

## 3. A titkos szavazat védelmének architektúrája (a legfőbb kockázat kezelése)

Vezérelv: **a „ki jogosult / ki szavazott" (folyamat-audit) és a „hogyan
szavazott" (titkos tartalom) adathalmazokat szét kell választani, és a kettő
közti visszakötés ne legyen triviális sem az üzemeltető, sem a közös képviselő
számára.**

Megvalósított technikai intézkedések:

1. **A titkos szavazat nincs személyhez kötve** — `Ballot.userId = null`; a
   folyamat-audit titkos szavazásnál **nem** naplóz albetét-azonosítót vagy
   ballot-hivatkozást, csak részvételt (darabszám + összsúly).
2. **Nyugta-hash** — a szavazó a `BALLOT_SECRET`-tel képzett SHA-256 nyugtával
   ellenőrizheti, hogy szavazata beszámított, a tartalom felfedése nélkül.
3. **Időbélyeg-korreláció elleni védelem** — a titkos ballotok és a részvételi
   audit időbélyege **percre kvantált**, így az audit (ki + mikor) nem köthető
   egy konkrét ballot-sorhoz.
4. **`BALLOT_SECRET` kikényszerítése** — indításkor kötelező, min. 32 karakter,
   placeholder tiltva (éles környezetben a folyamat leáll, ha gyenge).
5. **Hozzáférés-szabályozás** — képesség-alapú jogosultság (`can()`), épületek
   közti szigorú elkülönítés; a titkos szavazatok albetét-szintű bontása
   auditban sem jelenik meg.

## 4. Kockázatok és intézkedések

| Kockázat | Valószínűség | Hatás | Intézkedés | Maradványkockázat |
|---|---|---|---|---|
| Titkos szavazat visszafejtése (audit/időbélyeg) | alacsony | magas | userId=null, nincs albetét/ballot-hivatkozás az auditban, percre kvantált időbélyeg, összesített turnout | alacsony (kis létszámú szavazásnál percen belüli korreláció maradhat — lásd 6.) |
| Jogosulatlan szavazás / megszemélyesítés | közepes | magas | névjegyzékhez kötött beléptetés, TOTP, cast-idői tulajdonos- és meghatalmazás-ellenőrzés | alacsony–közepes |
| SZMSZ-felhatalmazás hiánya → támadható határozat | — | magas | e-szavazás **kapuzva**: online/hibrid/eszközös mód csak SZMSZ-felhatalmazással indítható | alacsony |
| Nyugta-hash hamisítás | alacsony | közepes | erős, kikényszerített `BALLOT_SECRET` | alacsony |
| Túlzott adatgyűjtés (IP/eszköz) | közepes | közepes | IP csonkolva, csak a bizonyíthatósághoz szükséges minimum | alacsony |
| Alfeldolgozói adattovábbítás (AI/e-mail) | közepes | közepes | zero-retention megállapodás + adatfeldolgozói szerződés (Art. 28); az AI-kiolvasás eredménye emberi jóváhagyás előtt semmit nem ír a rendszerbe | közepes (szerződésfüggő — lásd nyitott pontok) |
| Túl hosszú megőrzés | közepes | közepes | megőrzési politika + törlő/anonimizáló folyamat (lásd külön dokumentum) | közepes (a purge-automatizálás részben hátralévő) |

## 5. Érintetti jogok

Hozzáférés (15.), helyesbítés (16.), törlés (17.), korlátozás (18.),
tiltakozás (21.). A rendszer tartalmaz `deletedAt`/`anonymizedAt` mezőket és
contractor-oldali Art. 15 exportot; a tulajdonos/lakó oldali export és a
törlési folyamat **kiépítés alatt** (lásd megőrzési politika + nyitott pontok).
A megőrzési kötelezettségek (pl. számviteli 8 év) a törlést felülírhatják →
ilyenkor korlátozás/zárolás alkalmazandó.

## 6. Nyitott pontok a jogi átnézéshez

- Kis létszámú titkos szavazásnál a percre kvantálás nem tünteti el teljesen az
  időkorrelációt — szükséges-e további intézkedés (pl. kötegelt zárás, késleltetett
  audit), vagy az arányosság alapján elfogadható?
- Külső videóplatform használata esetén külön jogalap + tájékoztató + a DPIA
  kiegészítése.
- Alfeldolgozói (Art. 28) szerződések és zero-retention igazolása (OpenAI, Resend, tárhely).
- Előzetes NAIH-konzultáció szükségessége (35(4)/36. cikk) — jogi megítélés kérdése.
- Az érintetti jogfolyamatok (Art. 15 export, Art. 17 törlés) automatizáltságának szintje.
