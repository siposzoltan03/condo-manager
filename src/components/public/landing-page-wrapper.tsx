"use client";

import dynamic from "next/dynamic";

const LandingPage = dynamic(
  () => import("./landing-page").then((mod) => mod.LandingPage),
  { ssr: false, loading: () => <div className="min-h-screen bg-white" /> }
);

export function LandingPageWrapper() {
  return <LandingPage />;
}
