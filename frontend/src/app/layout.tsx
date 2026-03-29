import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import AttendanceGuard from "@/components/AttendanceGuard";
import { VenueProvider } from "@/components/VenueContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VERUM — Control Operativo",
  description: "Sistema de gestión operativa para restaurantes y empresas de servicios",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <I18nProvider>
            <VenueProvider>
              <AttendanceGuard>
                {children}
              </AttendanceGuard>
            </VenueProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
