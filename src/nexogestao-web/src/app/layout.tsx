import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegistrarServiceWorker from "./_components/RegistrarServiceWorker";
import { SCRIPT_TEMA } from "../lib/tema";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NexoGestão",
  description: "Gestão simples para o seu negócio",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NexoGestão",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      // O script de tema troca a classe da <html> antes do React hidratar; isso é esperado.
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col">
        <RegistrarServiceWorker />
        {children}
      </body>
    </html>
  );
}
