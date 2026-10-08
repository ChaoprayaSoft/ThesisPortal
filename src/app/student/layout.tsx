"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import styles from "./student.module.css";
import ProfileIcon from "@/components/ProfileIcon";
import { GraduationCap, ArrowUpRight, LogOut } from "lucide-react";

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
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading Student Portal...</span>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <main className={styles.mainContent}>
        <header className={styles.topHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 className={styles.headerTitle}>
              <GraduationCap size={22} />
              Student Portal
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className={styles.userInfo}>
              <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "0.88rem", letterSpacing: "-0.01em" }}>
                {dbUser?.name_th || user?.email}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--primary-color)", fontWeight: 600, background: "var(--primary-light)", padding: "1px 8px", borderRadius: "999px", display: "inline-block" }}>
                Student
              </div>
            </div>

            <ProfileIcon dbUser={dbUser} user={user} defaultLetter="S" size="36px" />

            {role === "Admin" && (
              <Link href="/admin" className={styles.adminLink}>
                <span>Admin Portal</span>
                <ArrowUpRight size={14} />
              </Link>
            )}

            <button 
              onClick={() => {
                import("@/lib/firebase").then(({ auth }) => auth.signOut());
              }}
              className={styles.logoutBtn}
              title="Sign Out"
            >
              <LogOut size={15} />
              <span>Logout</span>
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
