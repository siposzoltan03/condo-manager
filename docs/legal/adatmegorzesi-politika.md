# Adatmegőrzési politika

> **⚠️ TERVEZET — jogi átnézésre vár.** A megőrzési időket a társasház mint
> adatkezelő a jogszabályi kötelezettségek és a bizonyíthatósági igény alapján,
> jogi tanácsadóval véglegesíti. Az itt szereplő értékek javaslatok, a rendszer
> tényleges entitásai alapján. Készült: 2026-07-03.

## Elv

Minden személyes adatot csak addig őrzünk, amíg a célja (jogszerű döntéshozatal,
elszámolás, bizonyíthatóság) indokolja, vagy amíg jogszabály kötelez. A
megőrzési idő lejártakor az adatot töröljük vagy anonimizáljuk; ahol a törlést
megőrzési kötelezettség gátolja (pl. számvitel), az adatot **zároljuk/korlátozzuk**
(GDPR 18. cikk), nem használjuk tovább.

## Per-entitás megőrzési táblázat

| Entitás | Adat | Javasolt megőrzés | Jogalap / indok | Kikényszerítés |
|---|---|---|---|---|
| `Ballot` (szavazat) | opció, súly, titkos nyugta-hash | ~5 év (Ptk. elévülés) a határozat jogerőre emelkedésétől | határozat megtámadhatóságának elévülése | ⬜ purge-job (tervezett) |
| `AuditLog` (folyamat-napló) | ki/mikor/mit | 3–5 év | döntési lánc bizonyíthatósága | ⬜ purge-job (tervezett) |
| `Vote` / `Meeting` / `MeetingAttendance` | szavazás, jelenlét, quorum | a jegyzőkönyvvel együtt (lásd lent) | határozat érvényességének igazolása | ⬜ |
| Jegyzőkönyv (`Document` + `MeetingMinutesSignature`) | jegyzőkönyv + hitelesítő aláírások | tartósan (a társasház fennállásáig ajánlott) | Tht. § 39 — a közösség alapdokumentuma | manuális/archív |
| Pénzügyi rekordok (`MonthlyCharge`, számlák, `Budget`) | közös költség, hátralék, bizonylat | **8 év** | **Számv. tv. § 169** | ⬜ (a 8 év a törlést felülírja) |
| `ProxyAssignment` (meghatalmazás) | meghatalmazó/-ott, érvényesség | a kapcsolódó szavazat megőrzéséig | a szavazat érvényességének igazolása | ⬜ |
| `UserSession` | csonkolt IP, eszköz, geo, aktivitás | rövid (pl. 90 nap az utolsó aktivitástól), lejárt munkamenet törölhető | biztonság, visszaélés-felismerés | ⬜ session-purge (tervezett) |
| Kamera-felvétel (`BuildingCamera`) | videó | **per-kamera `retentionDays` (NAIH: max ~15 nap)** | Tht. § 25 + NAIH iránymutatás | ✅ `camera-retention.ts` (cron, cutoff alapú törlés) |
| Tenant kapcsolati adat | telefon/e-mail | a bérleti/használati viszony végéig, hozzájárulás alapján | Tht. § 22(2) + GDPR 6(1)(a) | `contactConsentAt`; visszavonáskor törlés |
| `User` (fiók) | név, e-mail, cím, telefon, TOTP-titok | a tagsági viszony végéig; utána anonimizálás a megőrzési kötelezettségek tiszteletben tartásával | tagsági/kapcsolattartási cél | `deletedAt`/`anonymizedAt` (folyamat kiépítés alatt) |
| SZMSZ AI-kiolvasás bemenete | feltöltött PDF (tulajdonosneveket tartalmazhat) | zero-retention megállapodás mellett az AI-szolgáltatónál **nem tárolódik**; a rendszerben a dokumentum a Dokumentumok közt marad | Art. 28 + adatminimalizálás | szerződéses |

## Kikényszerítés jelenlegi állapota

- ✅ **Kamera**: automatikus, cutoff-alapú törlés per-kamera megőrzési idővel.
- ⬜ **Általánosított purge/anonimizáló worker** más entitásokra (Ballot, AuditLog,
  UserSession) — a kamera-retention mintájára **kiépítendő** (a megőrzési politika
  szerinti ütemezéssel). Amíg nincs kész, a megőrzés **kézi/eljárási** kontroll alatt áll.
- ⬜ **Art. 17 törlés / anonimizálás** a `User.deletedAt`/`anonymizedAt` mezőkhöz —
  tényleges folyamat kiépítés alatt, a 8 éves számviteli és egyéb kötelezettségek
  betartásával (zárolás, nem törlés, ahol kötelező).

## Nyitott pontok

- A pontos megőrzési évek jogi véglegesítése (különösen Ballot/AuditLog).
- A purge-automatizálás ütemezése és auditálása (mit, mikor, ki indította).
- A jegyzőkönyv „tartós" megőrzésének technikai módja (archív tárhely).
