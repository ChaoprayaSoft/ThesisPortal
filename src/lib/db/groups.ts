import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where } from "firebase/firestore";

export interface StudentGroup {
  id?: string;
  name: string;
  fieldOfStudy?: string;
  students: {
    studentId: string;
    name: string;
    name_en?: string;
    email: string;
  }[];
}

export async function createGroup(group: StudentGroup) {
  const groupRef = doc(collection(db, "studentGroups"));
  group.id = groupRef.id;
  await setDoc(groupRef, group);
  return group;
}

export async function getGroups() {
  const snapshot = await getDocs(collection(db, "studentGroups"));
  return snapshot.docs.map(d => d.data() as StudentGroup);
}

export async function getGroupById(id: string) {
  const snapshot = await getDoc(doc(db, "studentGroups", id));
  if(snapshot.exists()) return snapshot.data() as StudentGroup;
  return null;
}

export async function updateGroup(id: string, groupData: Partial<StudentGroup>) {
  await updateDoc(doc(db, "studentGroups", id), groupData);
}

export async function deleteGroup(id: string) {
  const groupSnap = await getDoc(doc(db, "studentGroups", id));
  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as StudentGroup;
    if (groupData.students && groupData.students.length > 0) {
      const emails = groupData.students.map(s => s.email).filter(Boolean);
      // Delete users with these emails
      if (emails.length > 0) {
        // We have to batch delete or query then delete
        // Firestore 'in' queries are limited to 10 at a time, so we iterate
        for (const email of emails) {
          const q = query(collection(db, "users"), where("email", "==", email));
          const snap = await getDocs(q);
          snap.forEach(async (d) => {
            await deleteDoc(d.ref);
          });
        }
      }
    }
  }
  await deleteDoc(doc(db, "studentGroups", id));
}

