import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ConditionalNavigation from "@/components/ConditionalNavigation";
import { ModeProvider } from "@/components/ModeContext";
import ModeContent from "@/components/ModeContent";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NCAA Calcutta Auction",
  description: "Manage your NCAA tournament Calcutta auction",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ModeProvider>
          <ConditionalNavigation />
          <main className="min-h-screen bg-[#0d0d14]">
            <ModeContent>{children}</ModeContent>
          </main>
        </ModeProvider>
      </body>
    </html>
  );
}
