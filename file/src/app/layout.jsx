import PluginInit from "@/helper/PluginInit";
import PWASetup from "@/components/shared/PWASetup";
import "./font.css";
import "./globals.css";

export const metadata = {
  title: "Botmakers CRM",
  description: "Internal CRM for BotMakers Inc.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Botmakers CRM",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  themeColor: "#033457",
};

export default function RootLayout({ children }) {
  return (
    <html lang='en' data-theme='dark'>
      <head>
        <link rel='apple-touch-icon' href='/icons/apple-touch-icon.png' />
      </head>
      <body suppressHydrationWarning={true} className='dark'>
        <PluginInit />
        {children}
        <PWASetup />
      </body>
    </html>
  );
}
