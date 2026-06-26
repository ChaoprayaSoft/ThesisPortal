"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./admin.module.css";
import ProfileIcon from "@/components/ProfileIcon";

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
        <header className={styles.topHeader}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(true)}>
              &#9776;
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div className={styles.userInfo}>
              <div style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "0.95rem" }}>{dbUser?.name_th || user?.email}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Administrator</div>
            </div>
            <ProfileIcon dbUser={dbUser} user={user} defaultLetter="A" />
            <button 
              onClick={() => {
                import("@/lib/firebase").then(({ auth }) => auth.signOut());
              }}
              className={styles.logoutBtn}
            >
              Logout
            </button>
          </div>
        </header>
        <div className={styles.pageContainer}>
          {children}
        </div>
      </main>
    </div>
  );
}
