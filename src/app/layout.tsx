import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ScrollToTop from "@/components/ScrollToTop";
import { Analytics } from "@vercel/analytics/react";

const fontSans = Plus_Jakarta_Sans({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thesis Portal - Academic Management System",
  description: "A modern, elegant platform for students and faculty to track, review, and manage academic theses.",
  icons: {
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🎓</text></svg>',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={fontSans.className} style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--bg-app)" }}>
        <AuthProvider>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
          <footer 
            style={{ 
              textAlign: "center", 
              padding: "20px 24px", 
              color: "var(--text-light)", 
              fontSize: "0.85rem", 
              borderTop: "1px solid var(--border-color)", 
              width: "100%",
              background: "rgba(255, 255, 255, 0.6)",
              backdropFilter: "blur(8px)",
              letterSpacing: "0.02em"
            }}
          >
            © 2026 Thesis Portal · ChaoprayaSoft, THAILAND
          </footer>
          <ScrollToTop />
          <Analytics />
        </AuthProvider>
      </body>
    </html>
  );
}
