"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import { getCommentTemplates, setCommentTemplates } from "@/lib/db/settings";
import styles from "../admin.module.css";
import { Plus, Trash2, Save, CheckCircle2, AlertCircle } from "lucide-react";

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
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading comment templates...</span>
      </div>
    );
  }

  return (
    <div className={styles.card} style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div className={styles.pageHeader} style={{ marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", margin: 0 }}>Comment Templates</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "0.9rem" }}>
            Configure quick-insert feedback sentences available to faculty members during review.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "16px" }}>
        {templates.map((template, index) => (
          <div key={index} style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <input
              type="text"
              value={template}
              onChange={(e) => handleTemplateChange(index, e.target.value)}
              placeholder="Enter feedback template..."
              style={{
                flex: 1,
                padding: "9px 13px",
                borderRadius: "var(--radius-sm)",
                border: "1.5px solid var(--border-color)",
                background: "#ffffff",
                color: "var(--text-main)",
                fontSize: "0.92rem",
                outline: "none",
                fontFamily: "inherit"
              }}
            />
            <button
              onClick={() => handleRemoveTemplate(index)}
              className={styles.btnDanger}
              style={{ padding: "8px 12px" }}
              title="Delete template"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "16px", marginBottom: "24px" }}>
        <button
          onClick={handleAddTemplate}
          className={styles.btnSecondary}
          style={{ padding: "8px 16px" }}
        >
          <Plus size={16} />
          Add Feedback Sentence
        </button>
      </div>

      <div style={{ paddingTop: "16px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end" }}>
        <button 
          className={styles.btnPrimary} 
          onClick={handleSave}
          disabled={saving}
          style={{ padding: "10px 24px" }}
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Templates"}
        </button>
      </div>

      {status && (
        <div style={{ 
          marginTop: "16px", 
          padding: "12px 16px", 
          borderRadius: "var(--radius-sm)",
          background: status.type === "success" ? "var(--success-bg)" : "var(--danger-bg)",
          color: status.type === "success" ? "var(--success-text)" : "var(--danger-text)",
          border: `1px solid ${status.type === "success" ? "var(--success-border)" : "var(--danger-border)"}`,
          fontSize: "0.9rem",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          {status.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
