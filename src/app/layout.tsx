import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { StackProvider, StackTheme } from "@stackframe/stack";
import { stackServerApp } from "@/lib/stack";
import { BottomNav } from "@/components/bottom-nav";
import { RegisterServiceWorker } from "@/components/register-sw";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// BeyBuild always runs the neon/dark palette — passed as both the "light"
// and "dark" halves of Stack Auth's theme so /handler pages (sign-in, etc.)
// match the rest of the app regardless of the device's system theme.
const neonColors = {
  background: "#05060f",
  foreground: "#f1f4ff",
  card: "#0d1020",
  cardForeground: "#f1f4ff",
  popover: "#0d1020",
  popoverForeground: "#f1f4ff",
  primary: "#22e8f5",
  primaryForeground: "#05060f",
  secondary: "#131731",
  secondaryForeground: "#f1f4ff",
  muted: "#131731",
  mutedForeground: "#8b93b8",
  accent: "#c6ff3d",
  accentForeground: "#05060f",
  destructive: "#ff3b5c",
  destructiveForeground: "#f1f4ff",
  border: "#242844",
  input: "#242844",
  ring: "#22e8f5",
};

const stackNeonTheme = {
  light: neonColors,
  dark: neonColors,
  radius: "1rem",
};

export const metadata: Metadata = {
  title: "BeyBuild",
  description: "Your Beyblade X inventory and build companion",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BeyBuild",
  },
};

export const viewport: Viewport = {
  themeColor: "#05060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <div className="ambient-glow" />
        <StackProvider app={stackServerApp}>
          <StackTheme theme={stackNeonTheme}>
            <div className="flex flex-1 flex-col pb-16">{children}</div>
            <Suspense fallback={null}>
              <BottomNav />
            </Suspense>
          </StackTheme>
        </StackProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
