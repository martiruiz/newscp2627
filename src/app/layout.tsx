import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";
import { LanguageProvider } from "@/contexts/LanguageContext";
import RegisterSW from "@/components/RegisterSW";
import CommandPalette from "@/components/CommandPalette";
import SuperAdminPlanSwitcher from "@/components/SuperAdminPlanSwitcher";
import ThemeScheduler from "@/components/ThemeScheduler";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Sports Content Playbook",
  description: "Discover and save the best sports content from social media",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SCP Nova",
  },
  icons: {
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0f1724",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${montserrat.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Apply stored theme before paint to avoid flash */}
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            var raw = localStorage.getItem('scp-theme-schedule');
            if (raw) {
              var sched = JSON.parse(raw);
              if (sched && sched.enabled) {
                var now = new Date();
                var cur = now.getHours() * 60 + now.getMinutes();
                var lsp = (sched.lightStart || '08:00').split(':');
                var lep = (sched.lightEnd || '20:00').split(':');
                var ls = parseInt(lsp[0]) * 60 + parseInt(lsp[1] || 0);
                var le = parseInt(lep[0]) * 60 + parseInt(lep[1] || 0);
                var isLight = ls < le ? (cur >= ls && cur < le) : (cur >= ls || cur < le);
                if (!isLight) document.documentElement.setAttribute('data-theme', 'blue');
              } else {
                var t2 = localStorage.getItem('scp-theme');
                if (t2) document.documentElement.setAttribute('data-theme', t2);
              }
            } else {
              var t = localStorage.getItem('scp-theme');
              if (t) document.documentElement.setAttribute('data-theme', t);
            }
          } catch(e) {}
        `}} />
      </head>
      <body className="min-h-full">
        <LanguageProvider>
          <LayoutShell>{children}</LayoutShell>
        </LanguageProvider>
        <ThemeScheduler />
        <RegisterSW />
        <CommandPalette />
        <SuperAdminPlanSwitcher />
      </body>
    </html>
  );
}
