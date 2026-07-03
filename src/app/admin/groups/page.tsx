"use client";

import { useState, useEffect } from "react";
import styles from "../admin.module.css";
import { getGroups, updateGroup, deleteGroup, StudentGroup } from "@/lib/db/groups";
import { createUser, deleteUserByEmail, updateUserByEmail } from "@/lib/db/users";

export default function GroupsPage() {
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [groupName, setGroupName] = useState("");
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [filterField, setFilterField] = useState("");

  // Modal State
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [isEditingGroupInfo, setIsEditingGroupInfo] = useState(false);
  const [groupInfoEdit, setGroupInfoEdit] = useState({ name: "", fieldOfStudy: "" });
  
  // New Student Form
  const [newStudentId, setNewStudentId] = useState("");
  const [newStudentName, setNewStudentName] = useState("");
  const [newStudentNameEn, setNewStudentNameEn] = useState("");
  const [newStudentEmail, setNewStudentEmail] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit State
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editData, setEditData] = useState({ studentId: "", name: "", name_en: "", email: "" });
  const [studentSearch, setStudentSearch] = useState("");

  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    const data = await getGroups();
    setGroups(data);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !groupName) return;

    setConfirmAction({
      message: `Are you sure you want to process this Excel file and create the group "${groupName}"?`,
      onConfirm: async () => {
        setLoading(true);
        const formData = new FormData();
        formData.append("groupName", groupName);
        formData.append("fieldOfStudy", fieldOfStudy);
        formData.append("file", file);

        try {
          const res = await fetch("/api/upload-group", {
            method: "POST",
            body: formData,
          });
          
          if (!res.ok) {
            let errorMsg = `Server error: ${res.status}`;
            try {
              const errData = await res.json();
              errorMsg = errData.error || errorMsg;
            } catch (e) {
              const text = await res.text();
              errorMsg = text.substring(0, 100); // show a snippet if it's HTML
            }
            alert("Upload failed: " + errorMsg);
            setLoading(false);
            return;
          }

          const data = await res.json();
          if (data.success) {
            alert(`Group uploaded successfully! Extracted ${data.studentCount} students.`);
            setGroupName("");
            setFieldOfStudy("");
            setFile(null);
            setShowUploadForm(false);
            loadGroups();
          } else {
            alert("Upload failed: " + data.error);
          }
        } catch (err: any) {
          alert("Network or parsing error: " + err.message);
        }
        setLoading(false);
      }
    });
  };

  const openModal = (group: StudentGroup) => {
    setSelectedGroup(group);
    setEditingIndex(null);
    setIsEditingGroupInfo(false);
    setGroupInfoEdit({ name: group.name, fieldOfStudy: group.fieldOfStudy || "" });
    setStudentSearch("");
  };

  const closeModal = () => {
    setSelectedGroup(null);
    setEditingIndex(null);
    loadGroups(); // Refresh data just in case
  };

  const handleDeleteGroup = async () => {
    if (!selectedGroup || !selectedGroup.id) return;
    setConfirmAction({
      message: `Are you sure you want to completely delete the group "${selectedGroup.name}"?`,
      onConfirm: async () => {
        try {
          await deleteGroup(selectedGroup.id!);
          closeModal();
        } catch(err) {
          alert("Error deleting group.");
        }
      }
    });
  };

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedGroup.id) return;

    const newStudent = {
      studentId: newStudentId,
      name: newStudentName,
      name_en: newStudentNameEn,
      email: newStudentEmail
    };

    setConfirmAction({
      message: `Are you sure you want to manually add ${newStudentName} to this group?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          // Add to Group
          const updatedStudents = [...(selectedGroup.students || []), newStudent];
          await updateGroup(selectedGroup.id!, { students: updatedStudents });
          
          // Add to Users collection
          await createUser({
            email: newStudentEmail,
            name_th: newStudentName,
            name_en: newStudentNameEn,
            role: "Student",
            createdAt: Date.now()
          });

          // Update local state
          setSelectedGroup({ ...selectedGroup, students: updatedStudents });
          setNewStudentId(""); setNewStudentName(""); setNewStudentNameEn(""); setNewStudentEmail("");
          setShowAddForm(false);
        } catch (err) {
          alert("Error adding student");
          console.error(err);
        }
        setLoading(false);
      }
    });
  };

  const startEdit = (index: number, student: any) => {
    setEditingIndex(index);
    setEditData({ ...student });
  };

  const saveEdit = async (index: number) => {
    if (!selectedGroup || !selectedGroup.id) return;
    
    setConfirmAction({
      message: "Are you sure you want to save these changes?",
      onConfirm: async () => {
        const oldEmail = selectedGroup.students[index].email;
        const updatedStudents = [...selectedGroup.students];
        updatedStudents[index] = editData;

        try {
          await updateGroup(selectedGroup.id!, { students: updatedStudents });
          if (oldEmail) {
            await updateUserByEmail(oldEmail, {
              email: editData.email,
              name_th: editData.name,
              name_en: editData.name_en
            });
          }
          setSelectedGroup({ ...selectedGroup, students: updatedStudents });
          setEditingIndex(null);
        } catch (err: any) {
          console.error("Failed to save student edits:", err);
          alert("Error saving edits: " + err.message);
        }
      }
    });
  };

  const handleRemoveStudent = (index: number) => {
    if (!selectedGroup || !selectedGroup.id) return;
    const student = selectedGroup.students[index];
    
    setConfirmAction({
      message: `Are you sure you want to remove ${student.name} from this group?`,
      onConfirm: async () => {
        const updatedStudents = [...selectedGroup.students];
        updatedStudents.splice(index, 1);

        try {
          await updateGroup(selectedGroup.id!, { students: updatedStudents });
          if (student.email) {
            await deleteUserByEmail(student.email);
          }
          setSelectedGroup({ ...selectedGroup, students: updatedStudents });
        } catch (err) {
          alert("Error removing student");
        }
      }
    });
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>Manage Student Groups</h1>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showUploadForm ? "20px" : "0" }}>
          <div>
            <h2 style={{ margin: 0 }}>Create Group (Upload Excel)</h2>
            {showUploadForm && <p style={{ marginTop: "10px", marginBottom: 0 }}>Excel should have headers: รหัสนักศึกษา | ชื่อ-นามสกุล | Email</p>}
          </div>
          <button onClick={() => {
            if (showUploadForm) { setGroupName(""); setFieldOfStudy(""); setFile(null); }
            setShowUploadForm(!showUploadForm);
          }} className={styles.btnPrimary} style={{ margin: 0, background: showUploadForm ? "#64748b" : undefined }}>
            {showUploadForm ? "Cancel" : "Add New Group"}
          </button>
        </div>
        
        {showUploadForm && (
          <form onSubmit={handleUpload} style={{ marginTop: "20px" }}>
            <div className={styles.formGroup}>
              <label>Group Name</label>
              <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} required />
            </div>
            <div className={styles.formGroup}>
              <label>Field of Study (แขนงวิชา)</label>
              <select value={fieldOfStudy} onChange={e => setFieldOfStudy(e.target.value)} required>
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
              <label>Excel File (.xlsx)</label>
              <input type="file" accept=".xlsx, .xls" onChange={e => setFile(e.target.files?.[0] || null)} required />
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Uploading..." : "Create Group"}
            </button>
          </form>
        )}
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "20px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ flex: "1 1 300px" }}>
            <h2 style={{ marginBottom: "5px" }}>Existing Groups</h2>
            <p style={{ margin: 0 }}>Click on a group to view and edit its students.</p>
          </div>
          <select value={filterField} onChange={e => setFilterField(e.target.value)} style={{ padding: "8px", borderRadius: "4px", border: "1px solid #ccc", width: "250px", maxWidth: "100%", flex: "1 1 250px" }}>
            <option value="">All Fields of Study</option>
            <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
            <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
            <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
            <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
            <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
            <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
          </select>
        </div>
        
        <div className={styles.tableResponsive}>
          <table className={styles.table} style={{ width: "100%", minWidth: "700px" }}>
            <thead>
            <tr>
              <th>Group Name</th>
              <th>Field of Study</th>
              <th>Students Count</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {groups.filter(g => !filterField || g.fieldOfStudy === filterField).map(g => (
              <tr key={g.id} style={{ cursor: "pointer" }} onClick={() => openModal(g)}>
                <td>{g.name}</td>
                <td>{g.fieldOfStudy || "-"}</td>
                <td>{g.students?.length || 0}</td>
                <td><button className={styles.btnPrimary} style={{ padding: "6px 12px", fontSize: "0.8rem", marginTop: 0 }}>View / Edit</button></td>
              </tr>
            ))}
          </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      {selectedGroup && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              {isEditingGroupInfo ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginRight: "20px" }}>
                  <input 
                    type="text" 
                    value={groupInfoEdit.name} 
                    onChange={e => setGroupInfoEdit({...groupInfoEdit, name: e.target.value})} 
                    style={{ padding: "8px", fontSize: "1.2rem", fontWeight: "bold", border: "1px solid #ccc", borderRadius: "4px" }}
                  />
                  <select 
                    value={groupInfoEdit.fieldOfStudy} 
                    onChange={e => setGroupInfoEdit({...groupInfoEdit, fieldOfStudy: e.target.value})} 
                    style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px" }}
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
              ) : (
                <div style={{ flex: 1, marginRight: "20px" }}>
                  <h2 style={{ margin: "0 0 5px 0" }}>Group: {selectedGroup.name}</h2>
                  <div style={{ fontSize: "0.9rem", color: "#666" }}>{selectedGroup.fieldOfStudy || "No Field of Study Assigned"}</div>
                </div>
              )}
              
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {isEditingGroupInfo ? (
                  <>
                    <button 
                      onClick={async () => {
                        setConfirmAction({
                          message: "Are you sure you want to update the group info?",
                          onConfirm: async () => {
                            try {
                              await updateGroup(selectedGroup.id!, { 
                                name: groupInfoEdit.name, 
                                fieldOfStudy: groupInfoEdit.fieldOfStudy 
                              });
                              setSelectedGroup({ ...selectedGroup, name: groupInfoEdit.name, fieldOfStudy: groupInfoEdit.fieldOfStudy });
                              setIsEditingGroupInfo(false);
                            } catch (err) {
                              alert("Error updating group info");
                            }
                          }
                        });
                      }} 
                      className={styles.btnPrimary} 
                      style={{ padding: "6px 16px", fontSize: "0.9rem", margin: 0, background: "#10b981" }}
                    >
                      Save Info
                    </button>
                    <button 
                      onClick={() => setIsEditingGroupInfo(false)} 
                      style={{ padding: "6px 16px", fontSize: "0.9rem", margin: 0, background: "#ccc", color: "#000", border: "none", cursor: "pointer", borderRadius: "2px" }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditingGroupInfo(true)} 
                    style={{ padding: "6px 16px", fontSize: "0.9rem", margin: 0, background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", cursor: "pointer", borderRadius: "2px" }}
                  >
                    Edit Info
                  </button>
                )}
                
                <button 
                  onClick={() => setShowAddForm(!showAddForm)} 
                  className={styles.btnPrimary} 
                  style={{ padding: "6px 16px", fontSize: "0.9rem", margin: 0 }}
                >
                  {showAddForm ? "Cancel Add" : "Add Student"}
                </button>
                <button 
                  onClick={handleDeleteGroup}
                  style={{ padding: "6px 16px", fontSize: "0.9rem", margin: 0, background: "#dc2626", color: "white", border: "none", cursor: "pointer", borderRadius: "2px" }}
                >
                  Delete Group
                </button>
                <button className={styles.modalClose} onClick={closeModal} style={{ marginLeft: "10px" }}>&times;</button>
              </div>
            </div>

            {showAddForm && (
              <div style={{ background: "#f9f9f9", padding: "20px", borderRadius: "4px", marginBottom: "20px", border: "1px solid #eaeaea" }}>
                <h3 style={{ marginTop: 0, marginBottom: "15px", fontSize: "1rem" }}>Add New Student</h3>
                <form onSubmit={handleAddStudent} style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
                  <div className={styles.formGroup} style={{ margin: 0, flex: "1 1 120px" }}>
                    <label style={{ fontSize: "0.8rem" }}>Student ID</label>
                    <input type="text" value={newStudentId} onChange={e => setNewStudentId(e.target.value)} required style={{ padding: "8px" }} />
                  </div>
                  <div className={styles.formGroup} style={{ margin: 0, flex: "2 1 150px" }}>
                    <label style={{ fontSize: "0.8rem" }}>Name (TH)</label>
                    <input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} required style={{ padding: "8px" }} />
                  </div>
                  <div className={styles.formGroup} style={{ margin: 0, flex: "2 1 150px" }}>
                    <label style={{ fontSize: "0.8rem" }}>Name (EN)</label>
                    <input type="text" value={newStudentNameEn} onChange={e => setNewStudentNameEn(e.target.value)} style={{ padding: "8px" }} />
                  </div>
                  <div className={styles.formGroup} style={{ margin: 0, flex: "2 1 200px" }}>
                    <label style={{ fontSize: "0.8rem" }}>Email</label>
                    <input type="email" value={newStudentEmail} onChange={e => setNewStudentEmail(e.target.value)} required style={{ padding: "8px" }} />
                  </div>
                  <button type="submit" className={styles.btnPrimary} disabled={loading} style={{ margin: 0, padding: "9px 16px" }}>
                    {loading ? "..." : "Save"}
                  </button>
                </form>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
              <h3 style={{ margin: 0, fontSize: "1.1rem" }}>Students in Group</h3>
              <input
                type="text"
                placeholder="Search student name..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "4px", border: "1px solid #ccc", width: "250px", fontSize: "0.9rem" }}
              />
            </div>
            
            <div className={styles.tableResponsive}>
              <table className={styles.table} style={{ tableLayout: "fixed", width: "100%", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "20%" }}>ID</th>
                    <th style={{ width: "25%" }}>Name (TH)</th>
                    <th style={{ width: "20%" }}>Name (EN)</th>
                    <th style={{ width: "20%" }}>Email</th>
                    <th style={{ width: "15%" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedGroup.students?.map((s, idx) => {
                    const searchLower = studentSearch.toLowerCase();
                    const matchesSearch = s.name.toLowerCase().includes(searchLower) || 
                                          (s.name_en && s.name_en.toLowerCase().includes(searchLower)) ||
                                          (s.studentId && s.studentId.toLowerCase().includes(searchLower));
                    if (studentSearch && !matchesSearch && editingIndex !== idx) return null;
                    return (
                    <tr key={idx}>
                      {editingIndex === idx ? (
                        <>
                          <td><input type="text" value={editData.studentId} onChange={e => setEditData({...editData, studentId: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                          <td><input type="text" value={editData.name} onChange={e => setEditData({...editData, name: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                          <td><input type="text" value={editData.name_en || ''} onChange={e => setEditData({...editData, name_en: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                          <td><input type="text" value={editData.email} onChange={e => setEditData({...editData, email: e.target.value})} style={{width: "100%", padding: "4px"}}/></td>
                          <td>
                            <button onClick={() => saveEdit(idx)} className={styles.btnPrimary} style={{ padding: "4px 12px", fontSize: "0.8rem", margin: 0 }}>Save</button>
                            <button onClick={() => setEditingIndex(null)} style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", marginLeft: "8px", fontSize: "0.8rem" }}>Cancel</button>
                          </td>
                        </>
                      ) : (
                        <>
                          <td style={{ wordBreak: "break-word" }}>{s.studentId || "-"}</td>
                          <td style={{ wordBreak: "break-word" }}>{s.name}</td>
                          <td style={{ wordBreak: "break-word" }}>{s.name_en || "-"}</td>
                          <td style={{ wordBreak: "break-word" }}>{s.email}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button onClick={() => startEdit(idx, s)} style={{ background: "none", border: "1px solid #ccc", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}>Edit</button>
                              <button onClick={() => handleRemoveStudent(idx)} style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}>Delete</button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
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
