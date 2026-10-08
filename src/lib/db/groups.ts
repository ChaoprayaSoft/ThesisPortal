import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, deleteDoc, query, where, writeBatch } from "firebase/firestore";

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
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudentGroup));
}

export async function getGroupById(id: string) {
  const snapshot = await getDoc(doc(db, "studentGroups", id));
  if (snapshot.exists()) return { id: snapshot.id, ...snapshot.data() } as StudentGroup;
  return null;
}

export async function updateGroup(id: string, groupData: Partial<StudentGroup>) {
  await updateDoc(doc(db, "studentGroups", id), groupData);
}

export async function deleteGroup(id: string) {
  const groupRef = doc(db, "studentGroups", id);
  const groupSnap = await getDoc(groupRef);
  
  const batch = writeBatch(db);

  if (groupSnap.exists()) {
    const groupData = groupSnap.data() as StudentGroup;
    if (groupData.students && groupData.students.length > 0) {
      const emails = groupData.students.map(s => s.email?.trim()).filter(Boolean);
      
      if (emails.length > 0) {
        // Query users in chunks of 10 to utilize Firestore 'in' operator efficiently
        const chunkSize = 10;
        const userQueries = [];
        for (let i = 0; i < emails.length; i += chunkSize) {
          const chunk = emails.slice(i, i + chunkSize);
          userQueries.push(getDocs(query(collection(db, "users"), where("email", "in", chunk))));
        }

        const userSnapshots = await Promise.all(userQueries);
        userSnapshots.forEach(snap => {
          snap.docs.forEach(docSnap => {
            batch.delete(docSnap.ref);
          });
        });
      }
    }
  }

  batch.delete(groupRef);
  await batch.commit();
}


