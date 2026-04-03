import type { Metadata } from "next";
import "./globals.css";
import { FieldHelpPopup } from "@/components/ui/FieldHelpPopup";

export const metadata: Metadata = {
  title: "CLICK — מערכת ניהול משאבי אנוש",
  description: "CLICK HR SaaS Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-slate-50 antialiased">
        {children}
        <FieldHelpPopup />
      </body>
    </html>
  );
}
