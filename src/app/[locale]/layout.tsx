import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Space_Grotesk, IBM_Plex_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SessionProvider } from "@/components/layout/session-provider";
import { AppShell } from "@/components/layout/app-shell";
import { ConfirmProvider } from "@/components/shared/confirm-dialog";
import { Toaster } from "sonner";
import "@/app/globals.css";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-inter",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Condo Manager",
    template: "%s | Condo Manager",
  },
  description: "Self-hosted condominium management platform",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Condo Manager",
  },
};

export const viewport: Viewport = {
  themeColor: "#002045",
  width: "device-width",
  initialScale: 1,
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// Dynamic rendering — don't prerender locale pages during build (avoids DB/Redis connections)
export const dynamic = "force-dynamic";

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "hu" | "en")) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Condo Manager" />
      </head>
      <body className={`${inter.variable} ${manrope.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} font-sans`}>
        <SessionProvider>
          <NextIntlClientProvider messages={messages}>
            <ConfirmProvider>
              <AppShell>{children}</AppShell>
              <Toaster
                position="top-right"
                richColors
                closeButton
                toastOptions={{
                  duration: 4000,
                  style: {
                    fontFamily: "var(--font-inter)",
                  },
                }}
              />
            </ConfirmProvider>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
