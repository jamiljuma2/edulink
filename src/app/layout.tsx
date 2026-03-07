import type { Metadata } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/pwa/PwaRegister";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduLink Writers",
  description: "Where students meet trusted academic writers worldwide.",
  manifest: "/manifest.webmanifest",
  applicationName: "EduLink Writers",
  appleWebApp: {
    capable: true,
    title: "EduLink Writers",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${poppins.variable} antialiased`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
