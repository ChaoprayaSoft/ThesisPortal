import { db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const SETTINGS_COLLECTION = "settings";
const IMPORTANT_NOTE_DOC = "important_note";

export async function getImportantNote(fieldOfStudy: string): Promise<string> {
  try {
    if (!fieldOfStudy) return "";
    const docRef = doc(db, SETTINGS_COLLECTION, IMPORTANT_NOTE_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data()[fieldOfStudy] || "";
    }
    return "";
  } catch (error) {
    console.error("Error getting important note:", error);
    return "";
  }
}

export async function setImportantNote(content: string, fieldOfStudy: string): Promise<boolean> {
  try {
    if (!fieldOfStudy) return false;
    const docRef = doc(db, SETTINGS_COLLECTION, IMPORTANT_NOTE_DOC);
    await setDoc(docRef, { [fieldOfStudy]: content, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error setting important note:", error);
    return false;
  }
}
