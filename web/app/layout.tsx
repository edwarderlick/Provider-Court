import type { Metadata } from "next";
import "./globals.css";
import { AppStateProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "PROVIDER COURT | Intelligent Escrow Protocol",
  description: "Intelligent Contract marketplace for AI-generated work.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light h-full">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col font-body-md text-body-md antialiased">
        <AppStateProvider>{children}</AppStateProvider>
      </body>
    </html>
  );
}
