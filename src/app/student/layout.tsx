"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import styles from "./student.module.css";
import ProfileIcon from "@/components/ProfileIcon";

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
        <header className={styles.topHeader}>
          <div>
            <h2 className={styles.headerTitle}>Student Portal</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <div className={styles.userInfo}>
              <div style={{ fontWeight: "bold", color: "var(--text-main)", fontSize: "0.95rem" }}>{dbUser?.name_th || user?.email}</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Student</div>
            </div>
            <ProfileIcon dbUser={dbUser} user={user} defaultLetter="S" />
            {role === "Admin" && (
              <Link href="/admin" className={styles.adminLink}>
                Admin Portal ↗
              </Link>
            )}
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
