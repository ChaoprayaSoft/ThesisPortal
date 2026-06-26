"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import styles from "./student.module.css";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const { user, dbUser, role, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user || (role !== "Student" && role !== "Admin")) {
        router.replace("/login");
      }
    }
  }, [user, role, loading, router]);

  if (loading || (role !== "Student" && role !== "Admin")) {
    return <div className={styles.loading}>Loading Student Dashboard...</div>;
  }

  return (
    <div className={styles.layout}>
      <main className={styles.mainContent} style={{ padding: 0 }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 40px", background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)" }}>
          <div>
            <h2 style={{ margin: 0, color: "var(--text-main)" }}>Student Portal</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "0.95rem" }}>{dbUser?.name_th || user?.email}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Student</div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--primary-color)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold", fontSize: "1.2rem" }}>
              {(dbUser?.name_th || user?.email || "S")[0].toUpperCase()}
            </div>
            {role === "Admin" && (
              <Link href="/admin" style={{ background: "transparent", color: "var(--primary-color)", border: "1px solid var(--primary-color)", padding: "6px 12px", borderRadius: "4px", fontSize: "0.85rem", fontWeight: "bold", textDecoration: "none", marginLeft: "15px" }}>
                Admin Portal ↗
              </Link>
            )}
            <button 
              onClick={() => {
                import("@/lib/firebase").then(({ auth }) => auth.signOut());
              }}
              style={{ background: "none", border: "1px solid var(--primary-color)", color: "var(--primary-color)", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem", marginLeft: "15px", fontWeight: "bold" }}
            >
              Logout
            </button>
          </div>
        </header>
        <div style={{ padding: "40px", maxWidth: "1000px", margin: "0 auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
