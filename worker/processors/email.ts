import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: parseInt(process.env.SMTP_PORT ?? "587", 10),
  secure: parseInt(process.env.SMTP_PORT ?? "587", 10) === 465,
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const from = process.env.SMTP_FROM ?? "noreply@condo-manager.local";

  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });

  console.log(`Email sent to ${to}: ${subject}`);
}
