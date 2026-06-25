import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import ScrollToTop from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Thesis Portal",
  description: "Manage your theses easily",
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
      <body className={inter.className} style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <AuthProvider>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            {children}
          </div>
          <footer className="global-footer" style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "0.9rem", borderTop: "1px solid #e2e8f0", width: "100%" }}>
            © 2026 ChaoprayaSoft, THAILAND
          </footer>
          <ScrollToTop />
        </AuthProvider>
      </body>
    </html>
  );
}
