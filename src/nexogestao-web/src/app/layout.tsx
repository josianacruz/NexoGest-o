import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegistrarServiceWorker from "./_components/RegistrarServiceWorker";

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

// Roda antes da primeira pintura pra não "piscar" o tema errado. Por padrão
// segue a preferência do sistema (igual antes); só força claro quando o
// próprio navegador já sabe (via Nav) que a empresa logada pediu modo claro.
const SCRIPT_TEMA = `
(function () {
  try {
    var claroForcado = localStorage.getItem("nexo_tema_claro_forcado") === "1";
    var prefereEscuro = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (!claroForcado && prefereEscuro) {
      document.documentElement.classList.add("dark");
    }
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
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
