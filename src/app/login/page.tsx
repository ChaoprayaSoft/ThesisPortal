"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { checkIsInAppBrowser } from "@/components/InAppBrowserHandler";
import styles from "./login.module.css";
import { GraduationCap, AlertCircle, LogOut, ExternalLink, Globe } from "lucide-react";

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [inAppInfo, setInAppInfo] = useState<{ isInApp: boolean; isLine: boolean; isIOS: boolean; isAndroid: boolean }>({
    isInApp: false,
    isLine: false,
    isIOS: false,
    isAndroid: false
  });

  useEffect(() => {
    setInAppInfo(checkIsInAppBrowser());
  }, []);

  const handleOpenExternalBrowser = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("openExternalBrowser", "1");
      window.location.href = url.toString();
    } catch {
      window.location.href = window.location.href + "?openExternalBrowser=1";
    }
  };

  const handleLogin = async () => {
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      if (err.message?.includes("disallowed_useragent") || err.code === "auth/disallowed-useragent") {
        setError("Google blocks sign-in inside in-app browsers (LINE, Messenger, etc.). Please tap 'Open in External Browser' below.");
      } else if (err.code === "auth/popup-blocked" || err.message?.includes("popup")) {
        setError("Sign-in popup was blocked by your browser. Please tap 'Open in External Browser' or allow popups.");
      } else {
        setError(err.message || "An unexpected error occurred during sign-in.");
      }
    }
  };

  useEffect(() => {
    if (user && role) {
      if (role === "Admin") router.push("/admin");
      else if (role === "Lecturer") router.push("/lecturer");
      else if (role === "Student") router.push("/student");
    }
  }, [user, role, router]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Soft Pastel Aurora Background Orbs */}
      <div className={styles.aurora1}></div>
      <div className={styles.aurora2}></div>

      <div className={styles.card}>
        <div className={styles.logoBadge}>
          <GraduationCap size={28} className={styles.logoIcon} />
        </div>

        <h1 className={styles.title}>
          Welcome to <span className={styles.brandText}>Thesis Portal</span>
        </h1>
        <p className={styles.subtitle}>Sign in with your university Google account to access your workspace</p>

        {inAppInfo.isInApp && (
          <div style={{
            background: "var(--warning-light, #fef3c7)",
            border: "1.5px solid var(--warning-border, #fbbf24)",
            borderRadius: "var(--radius-md)",
            padding: "14px 16px",
            marginBottom: "20px",
            textAlign: "left"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--warning-text, #92400e)", fontWeight: 700, fontSize: "0.88rem", marginBottom: "4px" }}>
              <ExternalLink size={16} />
              <span>In-App Browser Detected</span>
            </div>
            <p style={{ margin: "0 0 10px 0", fontSize: "0.82rem", color: "var(--warning-text, #92400e)", lineHeight: 1.5 }}>
              Google blocks authentication inside in-app browsers (LINE, Messenger, Instagram). Please open in <strong>Safari</strong> or <strong>Chrome</strong> to sign in.
            </p>
            <button
              onClick={handleOpenExternalBrowser}
              style={{
                width: "100%",
                padding: "8px 14px",
                background: "var(--warning-color, #f59e0b)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px"
              }}
            >
              <Globe size={15} />
              Open in Default Browser
            </button>
          </div>
        )}

        {error && (
          <div className={styles.error}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {user && !role ? (
          <div className={styles.unregisteredBox}>
            <p>Your account is not registered in the system yet. Please contact your faculty administrator.</p>
            <button onClick={() => signOut(auth)} className={styles.btnSecondary}>
              <LogOut size={16} />
              Sign Out
            </button>
          </div>
        ) : (
          <button onClick={handleLogin} className={styles.btnGoogle}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
