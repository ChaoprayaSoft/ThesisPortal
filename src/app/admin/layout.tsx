"use client";

import { useAuth } from "@/components/AuthProvider";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./admin.module.css";
import ProfileIcon from "@/components/ProfileIcon";
import { 
  LayoutDashboard, 
  Users, 
  FolderKanban, 
  BookOpen, 
  FileText, 
  MessageSquareQuote, 
  ArrowUpRight, 
  Menu, 
  X,
  LogOut,
  GraduationCap
} from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, dbUser, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading) {
      if (!user || role !== "Admin") {
        router.replace("/login");
      }
    }
  }, [user, role, loading, router]);

  if (loading || role !== "Admin") {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading Admin Portal...</span>
      </div>
    );
  }

  const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { href: "/admin/lecturers", label: "Lecturers", icon: Users },
    { href: "/admin/groups", label: "Student Groups", icon: FolderKanban },
    { href: "/admin/thesis", label: "Theses", icon: BookOpen },
    { href: "/admin/note", label: "Important Note", icon: FileText },
    { href: "/admin/comments", label: "Comment Templates", icon: MessageSquareQuote },
  ];

  return (
    <div className={styles.layout}>
      {/* Decorative Pastel Ambient Orbs */}
      <div className={styles.aurora1}></div>
      <div className={styles.aurora2}></div>

      <aside className={`${styles.sidebar} ${isSidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.sidebarHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div className={styles.sidebarLogoIcon}>
              <GraduationCap size={20} />
            </div>
            <h2 className={styles.sidebarTitle}>Admin Portal</h2>
          </div>
          <button className={styles.closeSidebarBtn} onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
            <X size={20} />
          </button>
        </div>

        <nav className={styles.nav} onClick={() => setIsSidebarOpen(false)}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link 
                key={item.href} 
                href={item.href} 
                className={`${styles.navLink} ${isActive ? styles.navLinkActive : ""}`}
              >
                <Icon size={18} className={styles.navIcon} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className={styles.navDivider}></div>

          <Link href="/lecturer" className={styles.navLinkSubtle}>
            <span>Lecturer Portal</span>
            <ArrowUpRight size={16} />
          </Link>
        </nav>
      </aside>
      
      {/* Overlay to close sidebar when clicking outside on mobile */}
      {isSidebarOpen && (
        <div 
          onClick={() => setIsSidebarOpen(false)}
          className={styles.sidebarOverlay}
        />
      )}

      <main className={styles.mainContent}>
        <header className={styles.topHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button className={styles.hamburgerBtn} onClick={() => setIsSidebarOpen(true)} aria-label="Open menu">
              <Menu size={20} />
            </button>
            <span className={styles.portalTag}>Thesis Management System</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{dbUser?.name_th || user?.email}</div>
              <div className={styles.userRoleBadge}>Administrator</div>
            </div>
            <ProfileIcon dbUser={dbUser} user={user} defaultLetter="A" size="36px" />
            <button 
              onClick={() => {
                import("@/lib/firebase").then(({ auth }) => auth.signOut());
              }}
              className={styles.logoutBtn}
              title="Sign Out"
            >
              <LogOut size={16} />
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
