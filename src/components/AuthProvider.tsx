"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  role: "Admin" | "Lecturer" | "Student" | null;
  dbUser: any | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, role: null, dbUser: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<"Admin" | "Lecturer" | "Student" | null>(null);
  const [dbUser, setDbUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        // Fetch user role from Firestore by email
        const q = query(collection(db, "users"), where("email", "==", firebaseUser.email));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          setDbUser({ id: userDoc.id, ...userData });
          setRole(userData.role);
        } else {
          // Fallback or handle unregistered user
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
        setDbUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 3-Hour Session Timeout
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (user) {
        // 3 hours = 3 * 60 * 60 * 1000 ms
        timeoutId = setTimeout(() => {
          signOut(auth);
          alert("Your session has expired due to 3 hours of inactivity. Please log in again.");
        }, 3 * 60 * 60 * 1000);
      }
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    // Only attach listeners if running in browser
    if (typeof window !== 'undefined') {
      events.forEach(event => window.addEventListener(event, resetTimer));
      resetTimer();
    }

    return () => {
      clearTimeout(timeoutId);
      if (typeof window !== 'undefined') {
        events.forEach(event => window.removeEventListener(event, resetTimer));
      }
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, dbUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
