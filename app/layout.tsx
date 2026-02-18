import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/providers/AuthProvider";
import AdminAiReviewFloatingAlert from "@/components/AdminAiReviewFloatingAlert";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SchoolBOJ",
  description: "School Competitive Programming Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

  return (
    <html lang="ko">
      <body className={`${inter.className} bg-neutral-900`} suppressHydrationWarning={true}>
        {adsenseClient ? (
          <Script
            id="adsbygoogle-init"
            strategy="afterInteractive"
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <AuthProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <AdminAiReviewFloatingAlert />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
