import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import BackendStatus from "@/components/BackendStatus";

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FraudGuard - Real-Time Transaction Risk Scoring",
  description:
    "Explore a calibrated XGBoost fraud model with 26 encoded features, an interactive transaction scorecard, and transparent evaluation on synthetic data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="antialiased">
        <a
          href="#main"
          className="focus-ring sr-only z-[100] rounded-lg bg-brand px-4 py-2 text-sm font-medium text-[#04130d] focus:not-sr-only focus:absolute focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <Sidebar />
        <div className="lg:pl-60">
          <main
            id="main"
            className="mx-auto min-h-dvh max-w-[1440px] px-5 pb-12 pt-20 sm:px-8 lg:px-10 lg:pt-0 xl:px-12"
          >
            <div className="mb-8 flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line py-4 lg:mb-10 lg:min-h-20">
              <div className="flex items-center gap-2 text-xs text-fg-subtle">
                <span className="font-medium text-fg-muted">Research workspace</span>
                <span aria-hidden>/</span>
                <span>Synthetic-data demo</span>
              </div>
              <BackendStatus />
            </div>
            {children}
            <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-5 text-[11px] text-fg-subtle">
              <span>FraudGuard · Foundations of Artificial Intelligence</span>
              <span>Designed to explore. Evaluated transparently.</span>
            </footer>
          </main>
        </div>
      </body>
    </html>
  );
}
