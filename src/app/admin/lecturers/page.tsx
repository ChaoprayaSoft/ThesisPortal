"use client";

import { useState, useEffect } from "react";
import styles from "../admin.module.css";
import { createUser, getLecturers, deleteUserByEmail, updateUser, UserData } from "@/lib/db/users";
import { Plus, Search, Edit3, Trash2, CheckCircle2, UserPlus, X } from "lucide-react";

export default function LecturersPage() {
  const [lecturers, setLecturers] = useState<UserData[]>([]);
  const [nameTh, setNameTh] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [email, setEmail] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFieldOfStudy, setFilterFieldOfStudy] = useState("");

  // Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState({ name_th: "", name_en: "", email: "", fieldOfStudy: "" });

  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);

  useEffect(() => {
    loadLecturers();
  }, []);

  const loadLecturers = async () => {
    const data = await getLecturers();
    setLecturers(data);
  };

  const handleAddLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfirmAction({
      message: `Are you sure you want to register ${nameTh} as a faculty lecturer?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await createUser({
            email: email.trim(),
            name_th: nameTh.trim(),
            name_en: nameEn.trim(),
            role: "Lecturer",
            fieldOfStudy: fieldOfStudy.trim(),
            createdAt: Date.now()
          });
          setEmail(""); setNameTh(""); setNameEn(""); setFieldOfStudy("");
          setShowCreateForm(false);
          loadLecturers();
        } catch (err) {
          alert("Error adding lecturer");
        }
        setLoading(false);
      }
    });
  };

  const handleDelete = (lecturer: any) => {
    setConfirmAction({
      message: `Are you sure you want to permanently delete Lecturer ${lecturer.name_th}?`,
      onConfirm: async () => {
        try {
          await deleteUserByEmail(lecturer.email);
          loadLecturers();
        } catch (err) {
          alert("Error deleting lecturer");
        }
      }
    });
  };

  const startEdit = (lecturer: any) => {
    setEditingId(lecturer.id);
    setEditData({ name_th: lecturer.name_th, name_en: lecturer.name_en || "", email: lecturer.email, fieldOfStudy: lecturer.fieldOfStudy || "" });
  };

  const saveEdit = async (lecturer: any) => {
    if (!lecturer) return;
    setConfirmAction({
      message: `Save updated details for ${editData.name_th}?`,
      onConfirm: async () => {
        try {
          await updateUser(lecturer.id, editData);
          setEditingId(null);
          setLecturers(prev => prev.map(l => l.id === lecturer.id ? { ...l, ...editData } : l));
        } catch (err) {
          alert("Error saving edits");
        }
      }
    });
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: 0 }}>Faculty Lecturers</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Manage university faculty profiles, academic fields, and credentials</p>
        </div>
        <button 
          onClick={() => {
            if (showCreateForm) {
              setEmail(""); setNameTh(""); setNameEn(""); setFieldOfStudy("");
            }
            setShowCreateForm(!showCreateForm);
          }} 
          className={styles.btnPrimary}
        >
          {showCreateForm ? <X size={16} /> : <UserPlus size={16} />}
          <span>{showCreateForm ? "Cancel" : "Add Faculty Member"}</span>
        </button>
      </div>

      {showCreateForm && (
        <div className={styles.card} style={{ border: "1.5px solid var(--primary-border)", background: "var(--bg-card)" }}>
          <h2>Register New Faculty Member</h2>
          <form onSubmit={handleAddLecturer}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
              <div className={styles.formGroup}>
                <label>Name (Thai) *</label>
                <input type="text" placeholder="e.g. ผศ.ดร. สมชาย ใจดี" value={nameTh} onChange={e => setNameTh(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label>Name (English) *</label>
                <input type="text" placeholder="e.g. Asst. Prof. Dr. Somchai Jaidee" value={nameEn} onChange={e => setNameEn(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label>Field of Study</label>
                <select value={fieldOfStudy} onChange={e => setFieldOfStudy(e.target.value)}>
                  <option value="">-- Select Field of Study --</option>
                  <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
                  <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
                  <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
                  <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
                  <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
                  <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Institutional Email *</label>
                <input type="email" placeholder="lecturer@university.ac.th" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "14px" }}>
              <button type="button" className={styles.btnSecondary} onClick={() => setShowCreateForm(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.btnPrimary} disabled={loading}>
                {loading ? "Adding..." : "Register Lecturer"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
          <h2>Faculty Directory ({lecturers.length})</h2>
          <div style={{ display: "flex", gap: "10px", flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <div style={{ position: "relative", minWidth: "240px" }}>
              <input 
                type="text" 
                placeholder="Search faculty name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", background: "#fff", outline: "none", fontSize: "0.88rem" }}
              />
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
            </div>

            <select 
              value={filterFieldOfStudy} 
              onChange={e => setFilterFieldOfStudy(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", background: "#fff", fontSize: "0.88rem", outline: "none" }}
            >
              <option value="">All Fields of Study</option>
              {Array.from(new Set(lecturers.map(l => l.fieldOfStudy || "Not Specified"))).map(f => (
                <option key={f as string} value={f as string}>{f as string}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Field of Study Filter Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
          {Object.entries(
            lecturers.reduce((acc, l) => {
              const field = l.fieldOfStudy || "Not Specified";
              acc[field] = (acc[field] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          ).sort((a, b) => b[1] - a[1]).map(([field, count]) => {
            const isSelected = filterFieldOfStudy === field;
            return (
              <div 
                key={field} 
                style={{ 
                  background: isSelected ? "var(--primary-color)" : "var(--bg-subtle)", 
                  color: isSelected ? "#ffffff" : "var(--text-muted)", 
                  padding: "4px 12px", 
                  borderRadius: "var(--radius-full)", 
                  fontSize: "0.8rem", 
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                  border: isSelected ? "1px solid var(--primary-color)" : "1px solid var(--border-color)",
                  transition: "all 0.15s ease"
                }}
                onClick={() => setFilterFieldOfStudy(filterFieldOfStudy === field ? "" : field)}
              >
                {field}
                <span style={{ 
                  background: isSelected ? "rgba(255,255,255,0.25)" : "var(--border-color)", 
                  color: isSelected ? "#ffffff" : "var(--text-main)",
                  padding: "1px 6px", 
                  borderRadius: "var(--radius-full)",
                  fontSize: "0.72rem"
                }}>
                  {count as number}
                </span>
              </div>
            );
          })}
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: "22%" }}>Thai Name</th>
                <th style={{ width: "22%" }}>English Name</th>
                <th style={{ width: "24%" }}>Field of Study</th>
                <th style={{ width: "20%" }}>Email</th>
                <th style={{ width: "12%", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {lecturers
                .filter(l => {
                  const matchesSearch = (l.name_th.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                        (l.name_en && l.name_en.toLowerCase().includes(searchQuery.toLowerCase())));
                  const matchesField = filterFieldOfStudy 
                    ? (filterFieldOfStudy === "Not Specified" ? (!l.fieldOfStudy || l.fieldOfStudy.trim() === "") : l.fieldOfStudy === filterFieldOfStudy)
                    : true;
                  return matchesSearch && matchesField;
                })
                .map(l => (
                  <tr key={l.id}>
                    <td><strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>{l.name_th}</strong></td>
                    <td style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>{l.name_en || "-"}</td>
                    <td>
                      <span style={{ padding: "2px 8px", background: "var(--primary-lighter)", color: "var(--primary-color)", borderRadius: "var(--radius-sm)", fontSize: "0.8rem", fontWeight: 600 }}>
                        {l.fieldOfStudy || "Not Specified"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>{l.email}</td>
                    <td style={{ textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "6px" }}>
                        <button 
                          onClick={() => startEdit(l)} 
                          className={styles.btnSecondary}
                          style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                          title="Edit"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDelete(l)} 
                          className={styles.btnDanger}
                          style={{ padding: "4px 8px", fontSize: "0.78rem" }}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className={styles.modalOverlay} onClick={() => setEditingId(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", paddingBottom: "12px", borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-main)" }}>Edit Faculty Profile</h2>
              <button className={styles.modalClose} onClick={() => setEditingId(null)}>&times;</button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); saveEdit(lecturers.find(l => l.id === editingId)); }}>
              <div className={styles.formGroup}>
                <label>Name (Thai)</label>
                <input type="text" value={editData.name_th} onChange={e => setEditData({...editData, name_th: e.target.value})} required />
              </div>
              <div className={styles.formGroup}>
                <label>Name (English)</label>
                <input type="text" value={editData.name_en} onChange={e => setEditData({...editData, name_en: e.target.value})} required />
              </div>
              <div className={styles.formGroup}>
                <label>Field of Study</label>
                <select 
                  value={editData.fieldOfStudy} 
                  onChange={e => setEditData({...editData, fieldOfStudy: e.target.value})}
                >
                  <option value="">-- Select Field of Study --</option>
                  <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
                  <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
                  <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
                  <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
                  <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
                  <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label>Email</label>
                <input type="email" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} required />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setEditingId(null)}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay} onClick={() => setConfirmAction(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ maxWidth: "400px", textAlign: "center", padding: "28px" }}>
            <h3 style={{ marginTop: 0, marginBottom: "12px", color: "var(--text-main)", fontSize: "1.2rem" }}>Confirm Action</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.92rem", lineHeight: 1.55 }}>{confirmAction.message}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
              <button className={styles.btnSecondary} style={{ flex: 1, padding: "10px" }} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ flex: 1, padding: "10px" }} onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
