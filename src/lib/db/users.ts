import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc, writeBatch } from "firebase/firestore";

export type UserRole = "Admin" | "Lecturer" | "Student";

export interface UserData {
  id?: string;
  uid?: string;
  email: string;
  name_th: string;
  name_en: string;
  role: UserRole;
  fieldOfStudy?: string;
  profileImageUrl?: string;
  createdAt: number;
}

export async function createUser(userData: UserData) {
  const userRef = doc(collection(db, "users"));
  userData.uid = userRef.id;
  userData.createdAt = Date.now();
  await setDoc(userRef, userData);
  return userData;
}

export async function getUserByEmail(email: string) {
  const q = query(collection(db, "users"), where("email", "==", email.trim()));
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as unknown as UserData;
  }
  return null;
}

export async function getLecturers() {
  const q = query(collection(db, "users"), where("role", "in", ["Lecturer", "Admin"]));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserData));
}

export async function getAllUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as unknown as UserData));
}

export async function deleteUserByEmail(email: string) {
  const cleanEmail = email.trim();
  const q = query(collection(db, "users"), where("email", "==", cleanEmail));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;
  
  const batch = writeBatch(db);
  snapshot.docs.forEach(d => {
    batch.delete(d.ref);
  });
  await batch.commit();
}

export async function updateUser(id: string, data: Partial<UserData>) {
  await updateDoc(doc(db, "users", id), data);
}

export async function updateUserByEmail(oldEmail: string, data: Partial<UserData>) {
  const cleanEmail = oldEmail.trim();
  const q = query(collection(db, "users"), where("email", "==", cleanEmail));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return;

  const batch = writeBatch(db);
  snapshot.docs.forEach(d => {
    batch.update(d.ref, data);
  });
  await batch.commit();
}
