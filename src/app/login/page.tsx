"use client";

import { useState, useEffect } from "react";
import { signInWithPopup, GoogleAuthProvider, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import styles from "./login.module.css";

export default function LoginPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // Let AuthProvider handle the auth state. Wait a bit then redirect.
      // Ideally we check role and redirect
      // Since it's async, we'll use a timeout or useEffect for redirect.
    } catch (err: any) {
      setError(err.message);
    }
  };

  useEffect(() => {
    if (user && role) {
      if (role === "Admin") router.push("/admin");
      else if (role === "Lecturer") router.push("/lecturer");
      else if (role === "Student") router.push("/student");
    }
  }, [user, role, router]);

  if (loading) return <div className={styles.container}>Loading...</div>;

  return (
    <div className={styles.container}>
      {/* Decorative Blobs */}
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      
      <div className={styles.card}>
        <h1><span className={styles.gradientText}>Thesis Portal</span></h1>
        <p>Login to access your dashboard</p>
        {error && <div className={styles.error}>{error}</div>}
        
        {user && !role ? (
          <div>
            <p style={{ color: "#ef4444" }}>Your account is not registered. Please contact the administrator.</p>
            <button onClick={() => signOut(auth)} className={styles.btn}>Sign Out</button>
          </div>
        ) : (
          <button onClick={handleLogin} className={styles.btnGoogle}>
            Sign in with Google
          </button>
        )}
      </div>
    </div>
  );
}
