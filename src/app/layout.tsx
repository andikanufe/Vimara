import type { Metadata } from "next";
import "./globals.css";
import { UIProvider } from "@/providers/UIProvider";

export const metadata: Metadata = {
  title: "Vimara — Sarana Latihan Online",
  description: "Platform sarana latihan online untuk siswa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <link rel="icon" href="/vimara-logo.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <UIProvider>
          {children}
        </UIProvider>
      </body>
    </html>
  );
}
