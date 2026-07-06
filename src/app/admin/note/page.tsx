"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { getImportantNote, setImportantNote } from "@/lib/db/settings";
import styles from "./note.module.css";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";

const FIELDS_OF_STUDY = [
  "แขนงวิชาโทรคมนาคม",
  "แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์",
  "แขนงวิชาเครื่องมือวัดและควบคุม",
  "แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย"
];

export default function ImportantNotePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [selectedField, setSelectedField] = useState(FIELDS_OF_STUDY[0]);
  
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && role !== "Admin") {
      router.replace("/login");
    }
  }, [role, authLoading, router]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: styles.editorContent,
      },
    },
  });

  useEffect(() => {
    async function loadNote() {
      setLoading(true);
      const note = await getImportantNote(selectedField);
      if (editor) {
        editor.commands.setContent(note);
      }
      setLoading(false);
    }
    if (editor) {
      loadNote();
    }
  }, [editor, selectedField]);

  const handleSave = async () => {
    if (!editor) return;
    
    setSaving(true);
    setStatus(null);
    const htmlContent = editor.getHTML();
    
    const success = await setImportantNote(htmlContent, selectedField);
    if (success) {
      setStatus({ type: "success", message: `Note saved successfully for ${selectedField}!` });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: "error", message: "Failed to save note." });
    }
    setSaving(false);
  };

  if (authLoading) {
    return <div className={styles.container}>Loading editor...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Important Note</h1>
        <p>Edit the important note that will be displayed to students. Notes are specific to each Field of Study.</p>
        
        <div style={{ marginTop: "15px" }}>
          <label style={{ fontWeight: "bold", marginRight: "10px" }}>Field of Study:</label>
          <select 
            value={selectedField} 
            onChange={(e) => setSelectedField(e.target.value)}
            style={{ padding: "8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "1rem" }}
          >
            {FIELDS_OF_STUDY.map(field => (
              <option key={field} value={field}>{field}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.editorContainer} style={{ opacity: loading ? 0.5 : 1, pointerEvents: loading ? "none" : "auto" }}>
        {editor && (
          <div className={styles.toolbar}>
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive("bold") ? styles.active : ""}
            >
              Bold
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive("italic") ? styles.active : ""}
            >
              Italic
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive("heading", { level: 1 }) ? styles.active : ""}
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive("heading", { level: 2 }) ? styles.active : ""}
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? styles.active : ""}
            >
              Bullet List
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive("orderedList") ? styles.active : ""}
            >
              Ordered List
            </button>
            <button
              onClick={() => {
                const url = window.prompt("Enter link URL");
                if (url) {
                  editor.chain().focus().setLink({ href: url }).run();
                }
              }}
              className={editor.isActive("link") ? styles.active : ""}
            >
              Link
            </button>
            <button
              onClick={() => editor.chain().focus().unsetLink().run()}
              disabled={!editor.isActive("link")}
            >
              Unlink
            </button>
            <button onClick={() => editor.chain().focus().undo().run()}>
              Undo
            </button>
            <button onClick={() => editor.chain().focus().redo().run()}>
              Redo
            </button>
          </div>
        )}
        
        <EditorContent editor={editor} />
      </div>

      <div className={styles.footer}>
        <button 
          className={styles.saveBtn} 
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Note"}
        </button>
      </div>

      {status && (
        <div className={`${styles.statusMessage} ${status.type === "success" ? styles.statusSuccess : styles.statusError}`}>
          {status.message}
        </div>
      )}
    </div>
  );
}
