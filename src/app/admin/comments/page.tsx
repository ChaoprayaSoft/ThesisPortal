"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getCommentTemplates, setCommentTemplates } from "@/lib/db/settings";
import styles from "../admin.module.css";

export default function CommentTemplatesPage() {
  const [templates, setTemplates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  
  const { role, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && role !== "Admin") {
      router.replace("/login");
    }
  }, [role, authLoading, router]);

  useEffect(() => {
    async function loadTemplates() {
      setLoading(true);
      const data = await getCommentTemplates();
      setTemplates(data);
      setLoading(false);
    }
    loadTemplates();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    const success = await setCommentTemplates(templates);
    if (success) {
      setStatus({ type: "success", message: "Comment templates saved successfully!" });
      setTimeout(() => setStatus(null), 3000);
    } else {
      setStatus({ type: "error", message: "Failed to save comment templates." });
    }
    setSaving(false);
  };

  const handleTemplateChange = (index: number, value: string) => {
    const newTemplates = [...templates];
    newTemplates[index] = value;
    setTemplates(newTemplates);
  };

  const handleAddTemplate = () => {
    setTemplates([...templates, ""]);
  };

  const handleRemoveTemplate = (index: number) => {
    const newTemplates = [...templates];
    newTemplates.splice(index, 1);
    setTemplates(newTemplates);
  };

  if (authLoading || loading) {
    return <div className={styles.loading}>Loading comment templates...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: "bold", marginBottom: "5px" }}>Pre-defined Comment Templates</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Manage sentences that lecturers can easily insert when reviewing a thesis.</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
        {templates.map((template, index) => (
          <div key={index} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={template}
              onChange={(e) => handleTemplateChange(index, e.target.value)}
              placeholder="Enter comment sentence..."
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                background: "var(--bg-main)",
                color: "var(--text-main)",
                fontSize: "1rem"
              }}
            />
            <button
              onClick={() => handleRemoveTemplate(index)}
              style={{
                padding: "10px 15px",
                background: "#ff4d4f",
                color: "white",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "15px", marginBottom: "30px" }}>
        <button
          onClick={handleAddTemplate}
          style={{
            padding: "10px 15px",
            background: "var(--primary-color)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontWeight: "bold",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          + Add New Sentence
        </button>
      </div>

      <div className={styles.footer} style={{ marginTop: "20px", paddingTop: "20px", borderTop: "1px solid var(--border-color)" }}>
        <button 
          className={styles.saveBtn} 
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: "12px 24px",
            background: "var(--primary-color)",
            color: "white",
            border: "none",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            fontWeight: "bold",
            fontSize: "1rem"
          }}
        >
          {saving ? "Saving..." : "Save Templates"}
        </button>
      </div>

      {status && (
        <div style={{ 
          marginTop: "15px", 
          padding: "10px", 
          borderRadius: "var(--radius-sm)",
          background: status.type === "success" ? "#d4edda" : "#f8d7da",
          color: status.type === "success" ? "#155724" : "#721c24",
          border: `1px solid ${status.type === "success" ? "#c3e6cb" : "#f5c6cb"}`
        }}>
          {status.message}
        </div>
      )}
    </div>
  );
}
