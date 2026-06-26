"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./admin.module.css";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, dbUser, role, loading } = useAuth();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || role !== "Admin") {
        router.replace("/login");
      }
    }
  }, [user, role, loading, router]);

  if (loading || role !== "Admin") {
    return <div className={styles.loading}>Loading Admin Dashboard...</div>;
  }

  return (
    <div className={styles.layout}>
      {/* Decorative Blobs */}
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2>Admin Portal</h2>
          <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(false)}>&times;</button>
        </div>
        <nav className={styles.nav} onClick={() => setIsSidebarOpen(false)}>
          <Link href="/admin" className={styles.navLink}>Dashboard</Link>
          <Link href="/admin/lecturers" className={styles.navLink}>Lecturers</Link>
          <Link href="/admin/groups" className={styles.navLink}>Student Groups</Link>
          <Link href="/admin/thesis" className={styles.navLink}>Theses</Link>
          <div style={{ margin: "20px 0", borderBottom: "1px solid var(--border-color)" }}></div>
          <Link href="/lecturer" className={styles.navLink} style={{ color: "var(--text-muted)" }}>Lecturer Portal ↗</Link>
        </nav>
      </aside>
      
      {/* Overlay to close sidebar when clicking outside */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", zIndex: 1040 }}
        />
      )}

      <main className={styles.mainContent} style={{ padding: 0, width: "100%" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 40px", background: "var(--bg-app)", borderBottom: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(true)}>
              &#9776;
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "0.95rem" }}>{dbUser?.name_th || user?.email}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Administrator</div>
            </div>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "var(--primary-color)", color: "white", display: "flex", justifyContent: "center", alignItems: "center", fontWeight: "bold", fontSize: "1.2rem" }}>
              {(dbUser?.name_th || user?.email || "A")[0].toUpperCase()}
            </div>
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
        <div style={{ padding: "40px" }}>
          {children}
        </div>
      </main>
    </div>
  );
}
