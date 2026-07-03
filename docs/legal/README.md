# Legal & data-protection documents (DRAFTS)

E-voting compliance work package **P0.3**. These are **developer-authored first
drafts**, grounded in what the system actually processes — **not legal advice**.
Before any real condominium assembly runs on the platform, they must be
**reviewed and finalised by a data-protection lawyer** and adopted by each
condominium as data controller.

| Document | Purpose | GDPR |
|---|---|---|
| [`dpia-e-kozgyules.md`](./dpia-e-kozgyules.md) | Data Protection Impact Assessment for secret e-voting — risks + technical/organisational measures | Art. 35 |
| [`adatkezelesi-tajekoztato.md`](./adatkezelesi-tajekoztato.md) | Data-processing notice (HU + EN) — what we process, why, how long, your rights | Art. 13–14 |
| [`adatmegorzesi-politika.md`](./adatmegorzesi-politika.md) | Per-entity retention policy | Art. 5(1)(e) |

## Status / what's still needed

- **Legal review** of all three (the primary gate before live voting).
- Fill in each controller's **name/contact** in the notice.
- Finalise the **retention periods** (esp. ballots / audit log).
- **Art. 28 processor agreements** + zero-retention confirmations (OpenAI, Resend, storage, Stripe).
- Decide whether a **prior NAIH consultation** (Art. 36) is required.
- Wire the notice into the app (login + settings) — implementation follow-up.

See the technical plan: [`../plans/2026-07-02-evoting-legal-compliance.md`](../plans/2026-07-02-evoting-legal-compliance.md).
