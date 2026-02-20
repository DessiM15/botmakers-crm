import PluginInit from "@/helper/PluginInit";
import "./font.css";
import "./globals.css";

export const metadata = {
  title: "Botmakers CRM",
  description: "Internal CRM for BotMakers Inc.",
};

export default function RootLayout({ children }) {
  return (
    <html lang='en' data-theme='dark'>
      <body suppressHydrationWarning={true} className='dark'>
        <PluginInit />
        {children}
      </body>
    </html>
  );
}
