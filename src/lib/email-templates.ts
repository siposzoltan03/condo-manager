/**
 * Branded email templates for Condo Manager.
 * All templates return { subject, html } for use with sendEmail().
 * Uses inline CSS only for maximum email client compatibility.
 */

// ---------------------------------------------------------------------------
// Base layout
// ---------------------------------------------------------------------------

function baseLayout(content: string, footerNote?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Condo Manager</title>
</head>
<body style="margin:0;padding:0;background-color:#f2f3ff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f3ff;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:24px 0 20px 0;">
              <span style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:bold;color:#002045;letter-spacing:-0.5px;">
                &#127970; Condo Manager
              </span>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background-color:#ffffff;border-radius:12px;padding:40px 40px 32px 40px;">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 0 8px 0;">
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin:0 0 8px 0;">
                Condo Manager &mdash; Modern Condo Management
              </p>
              ${footerNote ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin:0;">${footerNote}</p>` : ""}
              <p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin:8px 0 0 0;">
                <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/settings/notifications" style="color:#002045;text-decoration:underline;">Notification settings</a>
                &nbsp;&middot;&nbsp;
                <a href="${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/settings/notifications" style="color:#002045;text-decoration:underline;">Unsubscribe</a>
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

function ctaButton(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px auto;">
    <tr>
      <td align="center" style="border-radius:8px;background-color:#002045;">
        <a href="${href}" target="_blank" style="display:inline-block;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:8px;">${label}</a>
      </td>
    </tr>
  </table>`;
}

function headline(text: string): string {
  return `<h1 style="font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:bold;color:#002045;margin:0 0 16px 0;">${text}</h1>`;
}

function bodyText(text: string): string {
  return `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#515f74;line-height:1.6;margin:0 0 12px 0;">${text}</p>`;
}

function noteText(text: string): string {
  return `<p style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999999;margin:16px 0 0 0;">${text}</p>`;
}

function divider(): string {
  return `<hr style="border:none;border-top:1px solid #f2f3ff;margin:24px 0;" />`;
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

  const greeting = recipientName
    ? `Hi ${recipientName},`
    : "Hi there,";

  const content = `
    ${headline("You're Invited!")}
    ${bodyText(greeting)}
    ${bodyText(`You've been invited to join <strong style="color:#002045;">${buildingName}</strong> as a <strong style="color:#002045;">${roleName}</strong>.`)}
    ${bodyText("Click the button below to set up your account and access your building portal.")}
    ${ctaButton("Accept Invitation", inviteLink)}
    ${divider()}
    ${noteText(`This invitation expires in ${expiryHours} hour${expiryHours !== 1 ? "s" : ""}.`)}
    ${noteText("If you didn't expect this invitation, you can safely ignore this email.")}
  `;

  return {
    subject: `You're invited to join ${buildingName}`,
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

  const greeting = recipientName
    ? `Hi ${recipientName},`
    : "Hi there,";

  const content = `
    ${headline("Invitation Reminder")}
    ${bodyText(greeting)}
    ${bodyText(`You've been invited to join <strong style="color:#002045;">${buildingName}</strong> as a <strong style="color:#002045;">${roleName}</strong>.`)}
    ${bodyText("Click the button below to set up your account and access your building portal.")}
    ${ctaButton("Accept Invitation", inviteLink)}
    ${divider()}
    ${noteText("This is a new invitation link. Any previous links are no longer valid.")}
    ${noteText(`This invitation expires in ${expiryHours} hour${expiryHours !== 1 ? "s" : ""}.`)}
    ${noteText("If you didn't expect this invitation, you can safely ignore this email.")}
  `;

  return {
    subject: `Reminder: You're invited to join ${buildingName}`,
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
    ${headline("Password Reset")}
    ${bodyText(`Hi ${recipientName},`)}
    ${bodyText("We received a request to reset your Condo Manager password.")}
    ${bodyText("Click the button below to choose a new password. If you didn't make this request, you can safely ignore this email.")}
    ${ctaButton("Reset Password", resetLink)}
    ${divider()}
    ${noteText("This link expires in 1 hour. If you didn't request this, ignore this email.")}
  `;

  return {
    subject: "Reset your Condo Manager password",
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
    ${headline("Welcome aboard!")}
    ${bodyText(`Hi ${recipientName},`)}
    ${bodyText(`Your account has been set up for <strong style="color:#002045;">${buildingName}</strong>.`)}
    ${bodyText("You can now access your building portal to view announcements, manage maintenance requests, and stay up to date with everything happening in your building.")}
    ${ctaButton("Go to Dashboard", loginLink)}
    ${divider()}
    ${noteText("If you have any questions, contact your building administrator.")}
  `;

  return {
    subject: `Welcome to ${buildingName}!`,
    html: baseLayout(content),
  };
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
}

export function notificationEmail(params: NotificationEmailParams): {
  subject: string;
  html: string;
} {
  const { recipientName, title, body, actionLink, actionLabel } = params;

  const content = `
    ${headline(title)}
    ${bodyText(`Hi ${recipientName},`)}
    ${bodyText(body)}
    ${actionLink && actionLabel ? ctaButton(actionLabel, actionLink) : ""}
    ${divider()}
    ${noteText("You are receiving this email because you are a member of a building on Condo Manager.")}
  `;

  return {
    subject: title,
    html: baseLayout(content),
  };
}
