import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ClientLayout from "./ClientLayout";

export const metadata: Metadata = {
  title: "QuizRush",
  description: "Speed thinking or face the chase!",
};

const zombiefont2Font = localFont({
  src: "../fonts/zombiefont2.ttf",
  variable: "--font-zombiefont2",
  display: "swap",
});


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${zombiefont2Font.variable} antialiased`}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
