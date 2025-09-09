"use client";

import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientProviders from "./ClientProviders";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { i18n } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedLang = localStorage.getItem("language");
    if (savedLang && i18n.language !== savedLang) {
      i18n.changeLanguage(savedLang);
    }
  }, [i18n]);

  // Update HTML lang attribute when language changes
  useEffect(() => {
    if (isClient) {
      document.documentElement.lang = i18n.language;
    }
  }, [i18n.language, isClient]);

  return (
    <html lang={isClient ? i18n.language : "en"}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <ClientProviders>{children}</ClientProviders>
        </AuthProvider>
      </body>
    </html>
  );
}