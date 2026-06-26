"use client";

import { useState, useEffect } from "react";
import styles from "../admin.module.css";
import { createUser, getLecturers, deleteUserByEmail, updateUser, UserData } from "@/lib/db/users";

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
      message: `Are you sure you want to add ${nameTh} as a Lecturer?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await createUser({
            email,
            name_th: nameTh,
            name_en: nameEn,
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
      message: `Are you sure you want to completely delete Lecturer ${lecturer.name_th}?`,
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
    setConfirmAction({
      message: `Are you sure you want to save changes for ${editData.name_th}?`,
      onConfirm: async () => {
        try {
          await updateUser(lecturer.id, editData);
          setEditingId(null);
          loadLecturers();
        } catch (err) {
          alert("Error saving edits");
        }
      }
    });
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>Manage Lecturers</h1>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCreateForm ? "20px" : "0" }}>
          <h2 style={{ margin: 0 }}>Add New Lecturer</h2>
          <button onClick={() => {
            if (showCreateForm) {
              setEmail(""); setNameTh(""); setNameEn(""); setFieldOfStudy("");
            }
            setShowCreateForm(!showCreateForm);
          }} className={styles.btnPrimary} style={{ margin: 0, background: showCreateForm ? "#64748b" : undefined }}>
            {showCreateForm ? "Cancel" : "Add Lecturer"}
          </button>
        </div>
        
        {showCreateForm && (
          <form onSubmit={handleAddLecturer}>
            <div className={styles.formGroup}>
              <label>Name (Thai)</label>
              <input type="text" value={nameTh} onChange={e => setNameTh(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label>Name (English)</label>
              <input type="text" value={nameEn} onChange={e => setNameEn(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label>Field of Study (Optional)</label>
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
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Adding..." : "Add Lecturer"}
            </button>
          </form>
        )}
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>Lecturer List</h2>
          <div style={{ display: "flex", gap: "10px", flex: 1, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <input 
              type="text" 
              placeholder="Search by name (TH/EN)..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #D6CEB8", background: "#fff", minWidth: "250px" }}
            />
            <select 
              value={filterFieldOfStudy} 
              onChange={e => setFilterFieldOfStudy(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #D6CEB8", background: "#fff" }}
            >
              <option value="">All Fields of Study</option>
              {Array.from(new Set(lecturers.map(l => l.fieldOfStudy).filter(Boolean))).map(f => (
                <option key={f as string} value={f as string}>{f as string}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.tableResponsive}>
          <table className={styles.table} style={{ tableLayout: "fixed", width: "100%", minWidth: "900px" }}>
            <thead>
            <tr>
              <th style={{ width: "20%" }}>Name (TH)</th>
              <th style={{ width: "20%" }}>Name (EN)</th>
              <th style={{ width: "20%" }}>Field of Study</th>
              <th style={{ width: "25%" }}>Email</th>
              <th style={{ width: "15%" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {lecturers
              .filter(l => {
                const matchesSearch = (l.name_th.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                      (l.name_en && l.name_en.toLowerCase().includes(searchQuery.toLowerCase())));
                const matchesField = filterFieldOfStudy ? l.fieldOfStudy === filterFieldOfStudy : true;
                return matchesSearch && matchesField;
              })
              .map(l => (
              <tr key={l.id}>
                {editingId === l.id ? (
                  <>
                    <td><input type="text" value={editData.name_th} onChange={e => setEditData({...editData, name_th: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                    <td><input type="text" value={editData.name_en} onChange={e => setEditData({...editData, name_en: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                    <td>
                      <select 
                        value={editData.fieldOfStudy} 
                        onChange={e => setEditData({...editData, fieldOfStudy: e.target.value})} 
                        style={{width: "100%", padding: "4px"}}
                      >
                        <option value="">-- Select --</option>
                        <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
                        <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
                        <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
                        <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
                        <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
                        <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
                      </select>
                    </td>
                    <td><input type="text" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => saveEdit(l)} className={styles.btnPrimary} style={{ padding: "4px 12px", fontSize: "0.8rem", margin: 0 }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: "0.8rem" }}>Cancel</button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td>{l.name_th}</td>
                    <td>{l.name_en || "-"}</td>
                    <td>{l.fieldOfStudy || "-"}</td>
                    <td style={{ wordBreak: "break-all" }}>{l.email}</td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => startEdit(l)} style={{ background: "none", border: "1px solid #ccc", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}>Edit</button>
                        <button onClick={() => handleDelete(l)} style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}>Delete</button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
          <div className={styles.modalContent} style={{ width: "400px", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px" }}>Confirm Action</h3>
            <p style={{ color: "#666", marginBottom: "30px" }}>{confirmAction.message}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "20px" }}>
              <button className={styles.btnPrimary} style={{ margin: 0, background: "#ccc", color: "#000", border: "1px solid #ccc" }} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ margin: 0 }} onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}>Yes, proceed</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
