/**
 * Branded email templates for Közös.
 * All templates return { subject, html } for use with sendEmail().
 *
 * Inline CSS only — email clients ignore <style> blocks in many cases.
 * The visual language tracks the in-app Tiles design system: oat bg
 * (#eeeae2), white card with subtle ink/8 border, ink (#16181a) display
 * type for headings, ink-soft (#3a3d42) for body, ink CTA on bg, and
 * mono-style brand stamp.
 *
 * Tiles tokens used (hex-frozen here since CSS vars don't reach email):
 *   bg     #eeeae2  oat surface
 *   card   #ffffff
 *   ink    #16181a  primary text + CTA
 *   ink-soft #3a3d42  body copy
 *   muted  #7a7e86  small print
 *   moss   #4a5a3e  accent (links in body)
 *   tile-a #d8d1c2  hairline borders
 *
 * Fonts are restricted to web-safe stacks. Tiles' Space Grotesk / Manrope
 * / IBM Plex Mono aren't reliably rendered in email clients, so we fall
 * back to a tight sans-serif stack that evokes the same feel.
 */

const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO =
  "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace";

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------

function baseLayout(content: string, footerNote?: string): string {
  const settingsLink = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/settings`;
  return `<!DOCTYPE html>
<html lang="hu">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Közös</title>
</head>
<body style="margin:0;padding:0;background-color:#eeeae2;font-family:${SANS};color:#16181a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#eeeae2;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header / brand stamp -->
          <tr>
            <td align="left" style="padding:0 4px 18px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#16181a;color:#eeeae2;width:32px;height:32px;text-align:center;vertical-align:middle;font-family:${SANS};font-size:15px;font-weight:600;border-radius:8px;">
                    K
                  </td>
                  <td style="padding-left:10px;font-family:${SANS};font-size:18px;font-weight:600;letter-spacing:-0.01em;color:#16181a;">
                    Közös
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background-color:#ffffff;border:1px solid #d8d1c2;border-radius:14px;padding:36px 40px 32px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:22px 12px 8px 12px;">
              <p style="font-family:${MONO};font-size:10px;color:#7a7e86;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 6px 0;">
                Közös &middot; Társasházkezelő
              </p>
              ${footerNote ? `<p style="font-family:${SANS};font-size:12px;color:#7a7e86;margin:0 0 6px 0;">${footerNote}</p>` : ""}
              <p style="font-family:${SANS};font-size:11px;color:#7a7e86;margin:0;">
                <a href="${settingsLink}" style="color:#3a3d42;text-decoration:underline;">Értesítési beállítások</a>
                &nbsp;&middot;&nbsp;
                <a href="${settingsLink}" style="color:#3a3d42;text-decoration:underline;">Leiratkozás</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function eyebrow(text: string): string {
  return `<p style="font-family:${MONO};font-size:10.5px;color:#7a7e86;letter-spacing:0.12em;text-transform:uppercase;margin:0 0 10px 0;">${text}</p>`;
}

function headline(text: string): string {
  return `<h1 style="font-family:${SANS};font-size:24px;font-weight:600;line-height:1.25;letter-spacing:-0.02em;color:#16181a;margin:0 0 16px 0;">${text}</h1>`;
}

function bodyText(text: string): string {
  return `<p style="font-family:${SANS};font-size:15px;color:#3a3d42;line-height:1.6;margin:0 0 12px 0;">${text}</p>`;
}

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 8px 0;">
    <tr>
      <td style="border-radius:10px;background-color:#16181a;">
        <a href="${href}" target="_blank" style="display:inline-block;font-family:${SANS};font-size:14px;font-weight:600;color:#eeeae2;text-decoration:none;padding:13px 22px;border-radius:10px;letter-spacing:-0.005em;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function noteText(text: string): string {
  return `<p style="font-family:${SANS};font-size:12.5px;color:#7a7e86;line-height:1.55;margin:14px 0 0 0;">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #eeeae2;margin:24px 0;" />`;
}

// ---------------------------------------------------------------------------
// 1. Invitation email
// ---------------------------------------------------------------------------

export interface InvitationEmailParams {
  recipientName?: string;
  buildingName: string;
  roleName: string;
  inviteLink: string;
  expiryHours: number;
}

export function invitationEmail(params: InvitationEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, buildingName, roleName, inviteLink, expiryHours } = params;

  const greeting = recipientName ? `Szia ${recipientName},` : "Üdvözöljük,";

  const content = `
    ${eyebrow("Meghívó")}
    ${headline("Csatlakozzon a társasházhoz")}
    ${bodyText(greeting)}
    ${bodyText(`Meghívást kapott a <strong style="color:#16181a;">${buildingName}</strong> társasházba <strong style="color:#16181a;">${roleName}</strong> szerepben.`)}
    ${bodyText("Kattintson a gombra a fiók beállításához és a portál eléréséhez.")}
    ${ctaButton("Meghívó elfogadása →", inviteLink)}
    ${divider()}
    ${noteText(`Ez a meghívó <strong>${expiryHours} órán belül</strong> érvényes.`)}
    ${noteText("Ha nem várt erre a meghívóra, nyugodtan figyelmen kívül hagyhatja ezt az e-mailt.")}
  `;

  return {
    subject: `Meghívó: ${buildingName}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 2. Invitation resend email
// ---------------------------------------------------------------------------

export function invitationResendEmail(params: InvitationEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, buildingName, roleName, inviteLink, expiryHours } = params;

  const greeting = recipientName ? `Szia ${recipientName},` : "Üdvözöljük,";

  const content = `
    ${eyebrow("Meghívó · emlékeztető")}
    ${headline("Új meghívó link")}
    ${bodyText(greeting)}
    ${bodyText(`Új meghívó link készült a <strong style="color:#16181a;">${buildingName}</strong> társasházhoz, <strong style="color:#16181a;">${roleName}</strong> szerepben.`)}
    ${bodyText("Kattintson a gombra a fiók beállításához.")}
    ${ctaButton("Meghívó elfogadása →", inviteLink)}
    ${divider()}
    ${noteText("Ez egy új meghívó link — a korábbi linkek már nem érvényesek.")}
    ${noteText(`A meghívó <strong>${expiryHours} órán belül</strong> érvényes.`)}
    ${noteText("Ha nem várt erre a meghívóra, nyugodtan figyelmen kívül hagyhatja ezt az e-mailt.")}
  `;

  return {
    subject: `Emlékeztető: meghívó a(z) ${buildingName} társasházhoz`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 3. Password reset email
// ---------------------------------------------------------------------------

export interface PasswordResetEmailParams {
  recipientName: string;
  resetLink: string;
}

export function passwordResetEmail(params: PasswordResetEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, resetLink } = params;

  const content = `
    ${eyebrow("Biztonság")}
    ${headline("Jelszó visszaállítása")}
    ${bodyText(`Szia ${recipientName},`)}
    ${bodyText("Jelszó-visszaállítási kérés érkezett a Közös fiókodhoz.")}
    ${bodyText("Kattints a gombra új jelszó megadásához. Ha nem te kezdeményezted a kérést, nyugodtan hagyd figyelmen kívül ezt az e-mailt.")}
    ${ctaButton("Jelszó visszaállítása →", resetLink)}
    ${divider()}
    ${noteText("Ez a link 1 órán belül érvényes.")}
  `;

  return {
    subject: "Jelszó visszaállítása — Közös",
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 4. Welcome email
// ---------------------------------------------------------------------------

export interface WelcomeEmailParams {
  recipientName: string;
  buildingName: string;
  loginLink: string;
}

export function welcomeEmail(params: WelcomeEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, buildingName, loginLink } = params;

  const content = `
    ${eyebrow("Üdvözöljük")}
    ${headline("Készen áll a fiókja")}
    ${bodyText(`Szia ${recipientName},`)}
    ${bodyText(`A fiókja elkészült a <strong style="color:#16181a;">${buildingName}</strong> társasházhoz.`)}
    ${bodyText("Beléphet a portálra, ahol megtekintheti a hirdetményeket, kezelheti a karbantartási kéréseket, és követheti a társasház életét.")}
    ${ctaButton("Vágjunk bele →", loginLink)}
    ${divider()}
    ${noteText("Ha bármi kérdése van, forduljon a közös képviselethez.")}
  `;

  return {
    subject: `Üdvözöljük a Közösben — ${buildingName}`,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 4b. Email verification (self-serve registration)
// ---------------------------------------------------------------------------

export interface VerificationEmailParams {
  recipientName: string;
  verificationLink: string;
  expiryHours: number;
  locale?: "hu" | "en";
}

export function verificationEmail(params: VerificationEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, verificationLink, expiryHours, locale = "hu" } = params;

  const t =
    locale === "hu"
      ? {
          subject: "Erősítse meg az e-mail címét — Közös",
          eyebrowText: "Regisztráció",
          h1: "Egy lépés van hátra",
          greet: `Szia ${recipientName},`,
          intro:
            "Kattintson a gombra az e-mail cím megerősítéséhez. Ezután beléphet a Közösbe és elkezdheti kezelni a társasházat.",
          cta: "E-mail megerősítése →",
          expiryNote: `A link <strong>${expiryHours} órán belül</strong> érvényes. Ha lejárt, a belépéskor új linket kérhet.`,
          ignoreNote:
            "Ha nem Ön regisztrált a Közösbe, nyugodtan hagyja figyelmen kívül ezt az e-mailt.",
        }
      : {
          subject: "Confirm your email — Közös",
          eyebrowText: "Sign-up",
          h1: "One step left",
          greet: `Hi ${recipientName},`,
          intro:
            "Click the button below to confirm your email address. Then you can sign in to Közös and start managing your building.",
          cta: "Confirm email →",
          expiryNote: `The link is valid for <strong>${expiryHours} hours</strong>. If it expires, you can request a new one from the sign-in page.`,
          ignoreNote:
            "If you didn't sign up for Közös, you can safely ignore this email.",
        };

  const content = `
    ${eyebrow(t.eyebrowText)}
    ${headline(t.h1)}
    ${bodyText(t.greet)}
    ${bodyText(t.intro)}
    ${ctaButton(t.cta, verificationLink)}
    ${noteText(t.expiryNote)}
    ${divider()}
    ${noteText(t.ignoreNote)}
  `;

  return {
    subject: t.subject,
    html: baseLayout(content),
  };
}

// ---------------------------------------------------------------------------
// 4c. Contractor welcome email — after onboarding auto-activates
// ---------------------------------------------------------------------------

export interface ContractorWelcomeParams {
  recipientName: string;
  orgName: string;
  loginLink: string;
  locale?: "hu" | "en";
}

export function contractorWelcomeEmail(params: ContractorWelcomeParams): {
  subject: string;
  html: string;
} {
  const { recipientName, orgName, loginLink, locale = "hu" } = params;
  const t =
    locale === "hu"
      ? {
          subject: `Üdvözöljük a Közös piactéren — ${orgName}`,
          eyebrowText: "Aktiválva",
          h1: "Készen áll a piactéren",
          greet: `Szia ${recipientName},`,
          intro: `A <strong style="color:#16181a;">${orgName}</strong> profilja aktiválva. Mostantól láthatod a társasházak nyitott munkáit, és licitálhatsz rájuk.`,
          tipsTitle: "Mit érdemes most megnézni:",
          tip1: "A piactéren a hozzád illő munkák kerülnek előre.",
          tip2: "A Pro próbaidőszak alatt korlátlanul licitálhatsz.",
          tip3: "A profilodat a Beállítások oldalon bármikor finomíthatod.",
          cta: "Vágjunk bele →",
        }
      : {
          subject: `Welcome to the Közös marketplace — ${orgName}`,
          eyebrowText: "Activated",
          h1: "You're live on the marketplace",
          greet: `Hi ${recipientName},`,
          intro: `<strong style="color:#16181a;">${orgName}</strong> is active. You can now see open condo jobs and bid on them.`,
          tipsTitle: "What to check next:",
          tip1: "The marketplace surfaces best-fit jobs at the top.",
          tip2: "Your Pro trial gives you unlimited bids — no card needed.",
          tip3: "You can fine-tune your profile from Settings any time.",
          cta: "Get started →",
        };

  const tipsHtml = `
    <p style="margin:0 0 8px;color:#16181a;font-size:14px;font-weight:500;">${t.tipsTitle}</p>
    <ul style="margin:0 0 16px;padding-left:18px;color:#3a3d3f;font-size:14px;line-height:1.6;">
      <li>${t.tip1}</li>
      <li>${t.tip2}</li>
      <li>${t.tip3}</li>
    </ul>
  `;

  const content = `
    ${eyebrow(t.eyebrowText)}
    ${headline(t.h1)}
    ${bodyText(t.greet)}
    ${bodyText(t.intro)}
    ${tipsHtml}
    ${ctaButton(t.cta, loginLink)}
    ${divider()}
    ${noteText("Közös · contractor marketplace")}
  `;

  return { subject: t.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 4d. Marketplace — new bid landed on a publication
// ---------------------------------------------------------------------------

export interface MarketplaceBidNotifyParams {
  recipientName: string;
  publicationTitle: string;
  bidCount: number;
  reviewUrl: string;
  locale?: "hu" | "en";
}

export function marketplaceBidNotifyEmail(params: MarketplaceBidNotifyParams): {
  subject: string;
  html: string;
} {
  const { recipientName, publicationTitle, bidCount, reviewUrl, locale = "hu" } =
    params;
  const t =
    locale === "hu"
      ? {
          subject: `Új ajánlat érkezett — ${publicationTitle}`,
          eyebrowText: "Piactéri ajánlat",
          h1: "Új ajánlat érkezett",
          greet: `Szia ${recipientName},`,
          intro: `Új ajánlat érkezett a <strong>${publicationTitle}</strong> hirdetésre. Jelenlegi ajánlatok száma: <strong>${bidCount}</strong>.`,
          cta: "Ajánlatok megtekintése →",
        }
      : {
          subject: `New bid received — ${publicationTitle}`,
          eyebrowText: "Marketplace bid",
          h1: "New bid received",
          greet: `Hi ${recipientName},`,
          intro: `A new bid landed on the <strong>${publicationTitle}</strong> listing. Total bids so far: <strong>${bidCount}</strong>.`,
          cta: "Review bids →",
        };

  const content = `
    ${eyebrow(t.eyebrowText)}
    ${headline(t.h1)}
    ${bodyText(t.greet)}
    ${bodyText(t.intro)}
    ${ctaButton(t.cta, reviewUrl)}
  `;
  return { subject: t.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 4e. Marketplace — bid won (winner gets the deal)
// ---------------------------------------------------------------------------

export interface BidWonEmailParams {
  recipientName: string;
  publicationTitle: string;
  fullAddress: string | null;
  unitNumber: string | null;
  ownerPhone: string | null;
  boardContactEmail: string;
  boardContactPhone: string | null;
  projectsUrl: string;
  locale?: "hu" | "en";
}

export function bidWonEmail(params: BidWonEmailParams): {
  subject: string;
  html: string;
} {
  const {
    recipientName,
    publicationTitle,
    fullAddress,
    unitNumber,
    ownerPhone,
    boardContactEmail,
    boardContactPhone,
    projectsUrl,
    locale = "hu",
  } = params;
  const t =
    locale === "hu"
      ? {
          subject: `Megnyerted a munkát — ${publicationTitle}`,
          eyebrowText: "Munka odaítélve",
          h1: "Megnyerted a munkát",
          greet: `Szia ${recipientName},`,
          intro: `A <strong>${publicationTitle}</strong> hirdetést neked ítélték oda. Az alábbiak az ügyfél kapcsolatfelvételi adatai — kezeld bizalmasan.`,
          listTitle: "Kontakt és helyszín",
          addressLabel: "Cím",
          unitLabel: "Lakás",
          ownerPhoneLabel: "Lakó telefonja",
          boardEmailLabel: "Kapcsolattartó e-mail",
          boardPhoneLabel: "Kapcsolattartó telefon",
          hidden: "Nem osztották meg",
          cta: "Projektek megtekintése →",
        }
      : {
          subject: `You won the job — ${publicationTitle}`,
          eyebrowText: "Awarded",
          h1: "You won the job",
          greet: `Hi ${recipientName},`,
          intro: `<strong>${publicationTitle}</strong> was awarded to you. The fields below are the client's contact info — handle them confidentially.`,
          listTitle: "Contact + location",
          addressLabel: "Address",
          unitLabel: "Unit",
          ownerPhoneLabel: "Owner phone",
          boardEmailLabel: "Contact email",
          boardPhoneLabel: "Contact phone",
          hidden: "Not shared",
          cta: "Open projects →",
        };

  function row(label: string, value: string | null): string {
    const cell = value ?? `<em style="color:#888;">${t.hidden}</em>`;
    return `<tr>
      <td style="padding:6px 12px 6px 0;color:#888;font-size:13px;width:160px;">${label}</td>
      <td style="padding:6px 0;color:#16181a;font-size:14px;">${cell}</td>
    </tr>`;
  }

  const tableHtml = `
    <p style="margin:0 0 8px;color:#16181a;font-size:14px;font-weight:500;">${t.listTitle}</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:16px;">
      ${row(t.addressLabel, fullAddress)}
      ${row(t.unitLabel, unitNumber)}
      ${row(t.ownerPhoneLabel, ownerPhone)}
      ${row(t.boardEmailLabel, boardContactEmail)}
      ${row(t.boardPhoneLabel, boardContactPhone)}
    </table>
  `;

  const content = `
    ${eyebrow(t.eyebrowText)}
    ${headline(t.h1)}
    ${bodyText(t.greet)}
    ${bodyText(t.intro)}
    ${tableHtml}
    ${ctaButton(t.cta, projectsUrl)}
  `;
  return { subject: t.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 4f. Marketplace — bid rejected (loser, P2B Art. 4)
// ---------------------------------------------------------------------------

export interface BidRejectedEmailParams {
  recipientName: string;
  publicationTitle: string;
  reason: string;
  marketplaceUrl: string;
  locale?: "hu" | "en";
}

export function bidRejectedEmail(params: BidRejectedEmailParams): {
  subject: string;
  html: string;
} {
  const {
    recipientName,
    publicationTitle,
    reason,
    marketplaceUrl,
    locale = "hu",
  } = params;
  const t =
    locale === "hu"
      ? {
          subject: `Az ajánlatod nem nyert — ${publicationTitle}`,
          eyebrowText: "Nem nyertes",
          h1: "Az ajánlatod nem nyert",
          greet: `Szia ${recipientName},`,
          intro: `Köszönjük, hogy ajánlatot tettél a <strong>${publicationTitle}</strong> hirdetésre. A megbízó másik kivitelezőt választott.`,
          reasonLabel: "Indoklás",
          legal:
            "Ezt az e-mailt a Platform-Business 2019/1150 EU rendelet 4. cikke alapján kell kapnod (visszautasítás írásos indoklása).",
          cta: "Más munkák a piactéren →",
        }
      : {
          subject: `Your bid wasn't selected — ${publicationTitle}`,
          eyebrowText: "Not selected",
          h1: "Your bid wasn't selected",
          greet: `Hi ${recipientName},`,
          intro: `Thanks for bidding on <strong>${publicationTitle}</strong>. The publisher chose a different contractor.`,
          reasonLabel: "Reason",
          legal:
            "You receive this email per Platform-to-Business Regulation 2019/1150 Art. 4 (written reasoned rejection).",
          cta: "Other open jobs →",
        };

  const reasonHtml = `
    <p style="margin:0 0 4px;color:#888;font-size:12px;text-transform:uppercase;letter-spacing:0.06em;">${t.reasonLabel}</p>
    <p style="margin:0 0 16px;color:#16181a;font-size:14px;line-height:1.55;">${reason}</p>
  `;

  const content = `
    ${eyebrow(t.eyebrowText)}
    ${headline(t.h1)}
    ${bodyText(t.greet)}
    ${bodyText(t.intro)}
    ${reasonHtml}
    ${ctaButton(t.cta, marketplaceUrl)}
    ${divider()}
    ${noteText(t.legal)}
  `;
  return { subject: t.subject, html: baseLayout(content) };
}

// ---------------------------------------------------------------------------
// 5. Generic notification email
// ---------------------------------------------------------------------------

export interface NotificationEmailParams {
  recipientName: string;
  title: string;
  body: string;
  actionLink?: string;
  actionLabel?: string;
  /** Mono eyebrow above the headline. Defaults to "Értesítés". */
  eyebrowLabel?: string;
}

export function notificationEmail(params: NotificationEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, title, body, actionLink, actionLabel } = params;
  const eyebrowText = params.eyebrowLabel ?? "Értesítés";

  const content = `
    ${eyebrow(eyebrowText)}
    ${headline(title)}
    ${bodyText(`Szia ${recipientName},`)}
    ${bodyText(body)}
    ${actionLink && actionLabel ? ctaButton(actionLabel, actionLink) : ""}
    ${divider()}
    ${noteText("Ezt az e-mailt azért kapja, mert tagja egy társasháznak a Közös rendszerben.")}
  `;

  return {
    subject: title,
    html: baseLayout(content),
  };
}
