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

const COMMENT_TEMPLATES_DOC = "comment_templates";

export const DEFAULT_COMMENT_TEMPLATES = [
  "ส่งกรรมการท่านต่อไป",
  "แก้ไขตามคำแนะนำ",
  "ไม่เรียบร้อย แก้ไขแล้วส่งมาอีกครั้ง",
  "ส่งเอกสารไม่ครบ, อ่าน Important notes, แล้วส่งมาใหม่"
];

export async function getCommentTemplates(): Promise<string[]> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, COMMENT_TEMPLATES_DOC);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data().templates || DEFAULT_COMMENT_TEMPLATES;
    }
    return DEFAULT_COMMENT_TEMPLATES;
  } catch (error) {
    console.error("Error getting comment templates:", error);
    return DEFAULT_COMMENT_TEMPLATES;
  }
}

export async function setCommentTemplates(templates: string[]): Promise<boolean> {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, COMMENT_TEMPLATES_DOC);
    await setDoc(docRef, { templates, updatedAt: new Date().toISOString() }, { merge: true });
    return true;
  } catch (error) {
    console.error("Error setting comment templates:", error);
    return false;
  }
}
