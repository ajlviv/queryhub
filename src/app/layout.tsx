import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalRequestLoader } from "@/components/global-request-loader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Questionnaire",
  description: "Multi-tenant questionnaires for teams and participants",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <GlobalRequestLoader />
      </body>
    </html>
  );
}
