import { db } from "../firebase";
import { collection, doc, setDoc, getDoc, getDocs, query, where, updateDoc, deleteDoc } from "firebase/firestore";

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
  // Using email as document ID or we can generate one. 
  // Wait, if it's pre-registered, we use email as doc ID or let them sign in and trigger a cloud function.
  // Actually, easiest is storing pre-registered users in 'users' with their email.
  const userRef = doc(collection(db, "users"));
  userData.uid = userRef.id;
  userData.createdAt = Date.now();
  await setDoc(userRef, userData);
  return userData;
}

export async function getUserByEmail(email: string) {
  const q = query(collection(db, "users"), where("email", "==", email));
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

export async function deleteUserByEmail(email: string) {
  const q = query(collection(db, "users"), where("email", "==", email));
  const snapshot = await getDocs(q);
  snapshot.forEach(async (d) => {
    await deleteDoc(d.ref);
  });
}

export async function updateUser(id: string, data: Partial<UserData>) {
  console.log("Updating user with ID:", id, "Data:", data);
  await updateDoc(doc(db, "users", id), data);
  console.log("User updated successfully!");
}

export async function updateUserByEmail(oldEmail: string, data: Partial<UserData>) {
  console.log("Updating user by email:", oldEmail, "Data:", data);
  const cleanEmail = oldEmail.trim();
  const q = query(collection(db, "users"), where("email", "==", cleanEmail));
  const snapshot = await getDocs(q);
  console.log("Found matching user documents:", snapshot.docs.length);
  
  for (const d of snapshot.docs) {
    console.log("Updating doc ID:", d.id);
    await updateDoc(d.ref, data);
  }
  console.log("Email update complete!");
}
