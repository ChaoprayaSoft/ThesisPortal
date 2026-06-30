import { db } from "../firebase";
import { collection, doc, setDoc, getDocs, getDoc, updateDoc, query, where, orderBy, onSnapshot, deleteField, deleteDoc } from "firebase/firestore";

export type ThesisStatus = "Preparing" | "Pending Advisor" | "Pending Committee" | "Pending Chairperson" | "Pending Sign. Advisor" | "Pending Sign. Committee" | "Pending Sign. Chairperson" | "Graduate" | "Revise";

export interface ThesisData {
  id?: string;
  title: string;
  abstract: string;
  scope: string;
  year?: string;
  fieldOfStudy?: string;
  groupId: string;
  studentUids: string[]; // student emails or UIDs
  lecturerUids: {
    advisor: string; // email or UID
    committees: string[];
    chairperson: string;
  };
  committeeApprovals?: string[];
  committeeSignApprovals?: string[];
  pendingAbstract?: string;
  pendingScope?: string;
  status: ThesisStatus;
  currentStage: number; // 0=Adv, 1=Comm, 2=Chair, 3=Sign.Adv, 4=Sign.Comm, 5=Sign.Chair, 6=Graduate
  createdAt: number;
  statusUpdatedAt?: number;
  deadlines?: {
    advisor?: number | null;
    committee?: number | null;
    chairperson?: number | null;
  };
}

export interface ThesisActivity {
  id?: string;
  thesisId: string;
  type: string; // e.g., "Manuscript Submitted", "Reviewed"
  timestamp: number;
  actorEmail: string;
  actorName?: string; // Add optional actorName for backward compatibility
  actorRole: string; // e.g., "Student", "Advisor"
  description: string;
  documentUrl?: string; // Kept for lecturer backwards compatibility
  documentName?: string;
  links?: { type: string, url: string }[]; // Student submitted external links
}

export async function createThesis(thesis: ThesisData) {
  const thesisRef = doc(collection(db, "theses"));
  thesis.id = thesisRef.id;
  thesis.createdAt = Date.now();
  thesis.statusUpdatedAt = Date.now();
  thesis.committeeApprovals = [];
  await setDoc(thesisRef, thesis);
  return thesis;
}

export async function getThesesByStudent(studentIdOrEmail: string) {
  const q = query(collection(db, "theses"), where("studentUids", "array-contains", studentIdOrEmail));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => d.data() as ThesisData);
}

export async function getThesesByLecturer(email: string) {
  const snapshot = await getDocs(collection(db, "theses"));
  const allTheses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ThesisData));
  return allTheses.filter(t => 
    t.lecturerUids.advisor === email || 
    t.lecturerUids.committees.includes(email) || 
    t.lecturerUids.chairperson === email
  );
}

export async function getAllTheses() {
  const snapshot = await getDocs(collection(db, "theses"));
  return snapshot.docs.map(d => d.data() as ThesisData);
}

export function subscribeToThesesByStudent(studentIdOrEmail: string, callback: (theses: ThesisData[]) => void) {
  const q = query(collection(db, "theses"), where("studentUids", "array-contains", studentIdOrEmail));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ThesisData)));
  });
}

export function subscribeToThesesByLecturer(email: string, callback: (theses: ThesisData[]) => void) {
  return onSnapshot(collection(db, "theses"), (snapshot) => {
    const allTheses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ThesisData));
    const filtered = allTheses.filter(t => 
      t.lecturerUids.advisor === email || 
      t.lecturerUids.committees.includes(email) || 
      t.lecturerUids.chairperson === email
    );
    callback(filtered);
  });
}

export async function deleteThesis(id: string) {
  const { deleteDoc, collection, query, where, getDocs } = await import("firebase/firestore");
  
  // 1. Delete all activity logs associated with this thesis
  const activitiesQuery = query(collection(db, "thesisActivities"), where("thesisId", "==", id));
  const activitiesSnapshot = await getDocs(activitiesQuery);
  for (const docSnap of activitiesSnapshot.docs) {
    await deleteDoc(docSnap.ref);
  }

  // 2. Try to delete legacy storage folders (manuscripts and reviews)
  try {
    const { ref, listAll, deleteObject } = await import("firebase/storage");
    const { storage } = await import("../firebase");
    
    // Helper to delete all files in a folder
    const deleteFolder = async (folderPath: string) => {
      const folderRef = ref(storage, folderPath);
      const res = await listAll(folderRef);
      for (const itemRef of res.items) {
        await deleteObject(itemRef);
      }
    };
    
    await deleteFolder(`manuscripts/${id}`);
    await deleteFolder(`reviews/${id}`);
  } catch (err) {
    console.log("No legacy storage files found or error deleting them:", err);
  }

  // 3. Delete the thesis itself
  await deleteDoc(doc(db, "theses", id));
}

export async function updateThesis(id: string, data: Partial<ThesisData>) {
  await updateDoc(doc(db, "theses", id), data);
}

export async function updateThesisStatus(thesisId: string, status: ThesisStatus, stage: number) {
  await updateDoc(doc(db, "theses", thesisId), { status, currentStage: stage, statusUpdatedAt: Date.now() });
}

export async function approveThesis(thesisId: string, userEmail: string, role: "Advisor" | "Committee" | "Chairperson", currentThesis: ThesisData) {
  let newStatus = currentThesis.status;
  let newStage = currentThesis.currentStage;
  let newCommitteeApprovals = currentThesis.committeeApprovals || [];
  let newCommitteeSignApprovals = currentThesis.committeeSignApprovals || [];

  if (role === "Advisor" && currentThesis.status === "Pending Advisor") {
    newStatus = "Pending Committee";
    newStage = 1;
  } else if (role === "Committee" && currentThesis.status === "Pending Committee") {
    if (!newCommitteeApprovals.includes(userEmail)) {
      newCommitteeApprovals.push(userEmail);
    }
    const allApproved = currentThesis.lecturerUids.committees.every(email => newCommitteeApprovals.includes(email));
    if (allApproved) {
      newStatus = "Pending Chairperson";
      newStage = 2;
    }
  } else if (role === "Chairperson" && currentThesis.status === "Pending Chairperson") {
    newStatus = "Pending Sign. Advisor";
    newStage = 3;
  } else if (role === "Advisor" && currentThesis.status === "Pending Sign. Advisor") {
    newStatus = "Pending Sign. Committee";
    newStage = 4;
  } else if (role === "Committee" && currentThesis.status === "Pending Sign. Committee") {
    if (!newCommitteeSignApprovals.includes(userEmail)) {
      newCommitteeSignApprovals.push(userEmail);
    }
    const allApproved = currentThesis.lecturerUids.committees.every(email => newCommitteeSignApprovals.includes(email));
    if (allApproved) {
      newStatus = "Pending Sign. Chairperson";
      newStage = 5;
    }
  } else if (role === "Chairperson" && currentThesis.status === "Pending Sign. Chairperson") {
    newStatus = "Graduate";
    newStage = 6;
  } else {
    throw new Error("Invalid approval step.");
  }

  await updateDoc(doc(db, "theses", thesisId), {
    status: newStatus,
    currentStage: newStage,
    committeeApprovals: newCommitteeApprovals,
    committeeSignApprovals: newCommitteeSignApprovals,
    statusUpdatedAt: Date.now()
  });
}

export function getStatusForStage(stage: number): ThesisStatus {
  switch (stage) {
    case 0: return "Pending Advisor";
    case 1: return "Pending Committee";
    case 2: return "Pending Chairperson";
    case 3: return "Pending Sign. Advisor";
    case 4: return "Pending Sign. Committee";
    case 5: return "Pending Sign. Chairperson";
    case 6: return "Graduate";
    default: return "Pending Advisor";
  }
}

export async function rejectThesis(thesisId: string) {
  await updateDoc(doc(db, "theses", thesisId), {
    status: "Revise"
  });
}

export async function logThesisActivity(activity: Omit<ThesisActivity, "id">) {
  const actRef = doc(collection(db, "thesisActivities"));
  const fullActivity = { ...activity, id: actRef.id };
  await setDoc(actRef, fullActivity);
  return fullActivity;
}

export async function getThesisActivities(thesisId: string) {
  const q = query(collection(db, "thesisActivities"), where("thesisId", "==", thesisId));
  const snapshot = await getDocs(q);
  // Sort descending by timestamp (newest first)
  const activities = snapshot.docs.map(d => d.data() as ThesisActivity);
  return activities.sort((a, b) => b.timestamp - a.timestamp);
}

export async function approveTopicEdits(thesisId: string, newAbstract: string, newScope: string) {
  await updateDoc(doc(db, "theses", thesisId), {
    abstract: newAbstract,
    scope: newScope,
    pendingAbstract: deleteField(),
    pendingScope: deleteField(),
    statusUpdatedAt: Date.now()
  });
}

export async function rejectTopicEdits(thesisId: string) {
  await updateDoc(doc(db, "theses", thesisId), {
    pendingAbstract: deleteField(),
    pendingScope: deleteField(),
    statusUpdatedAt: Date.now()
  });
}

export async function deleteThesisActivity(activityId: string) {
  await deleteDoc(doc(db, "thesisActivities", activityId));
}
