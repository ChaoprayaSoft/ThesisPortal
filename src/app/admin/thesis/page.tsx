"use client";

import { useState, useEffect } from "react";
import styles from "../admin.module.css";
import { useAuth } from "@/components/AuthProvider";
import { getLecturers, UserData } from "@/lib/db/users";
import { getGroups, StudentGroup } from "@/lib/db/groups";
import { createThesis, getAllTheses, deleteThesis, updateThesis, getDisplayStatus, getThesisActivities, logThesisActivity } from "@/lib/db/theses";

export default function AdminThesisPage() {
  const { user, dbUser } = useAuth();
  const [lecturers, setLecturers] = useState<UserData[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [theses, setTheses] = useState<any[]>([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Graduation State
  const [showGraduateModal, setShowGraduateModal] = useState(false);
  const [graduateThesisId, setGraduateThesisId] = useState<string | null>(null);
  const [graduateReason, setGraduateReason] = useState("");

  // Form State
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [scope, setScope] = useState("");
  const [year, setYear] = useState((new Date().getFullYear() + 543).toString());
  const [fieldOfStudy, setFieldOfStudy] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [studentToAdd, setStudentToAdd] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [committees, setCommittees] = useState<string[]>([]);
  const [committeeToAdd, setCommitteeToAdd] = useState("");
  const [chairperson, setChairperson] = useState("");
  const [equipmentChecker, setEquipmentChecker] = useState("");
  const [loading, setLoading] = useState(false);

  // User Selection Modal State
  const [showUserModal, setShowUserModal] = useState<{
    type: "student" | "advisor" | "committee" | "chairperson" | "equipmentChecker",
    isOpen: boolean
  }>({ type: "student", isOpen: false });
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Deadlines State
  const [deadlineAdvisor, setDeadlineAdvisor] = useState("");
  const [deadlineCommittee, setDeadlineCommittee] = useState("");
  const [deadlineChairperson, setDeadlineChairperson] = useState("");

  const formatDatetimeLocal = (ts?: number | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
  };

  // List State
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterGroup, setFilterGroup] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterField, setFilterField] = useState("");
  const [searchTitle, setSearchTitle] = useState("");
  const [viewThesis, setViewThesis] = useState<any>(null);
  const [thesisActivities, setThesisActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [editThesisId, setEditThesisId] = useState<string | null>(null);

  // Confirmation Modal
  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLecturers(await getLecturers());
      setGroups(await getGroups());
      setTheses(await getAllTheses());
    }
    loadData();
  }, []);

  const loadTheses = async () => {
    setTheses(await getAllTheses());
  };

  const getStageIcon = (stage: number) => {
    switch (stage) {
      case 0: return "📝";
      case 1: return "👥";
      case 2: return "👨‍⚖️";
      case 3: return "✒️";
      case 4: return "🖊️";
      case 5: return "🖋️";
      case 6: return "🎓";
      default: return "📄";
    }
  };

  const getDeadlineDisplay = (thesis: any) => {
    if (thesis.status === "Graduate") return null;
    let targetDeadline = undefined;
    let stageName = "";
    if (thesis.currentStage === 0) {
      targetDeadline = thesis.deadlines?.advisor;
      stageName = "Advisor";
    } else if (thesis.currentStage === 1) {
      targetDeadline = thesis.deadlines?.committee;
      stageName = "Committee";
    } else if (thesis.currentStage === 2) {
      targetDeadline = thesis.deadlines?.chairperson;
      stageName = "Chairperson";
    }
    
    if (thesis.currentStage >= 3) return null; // no deadlines for signatures

    if (!targetDeadline) return null;
    const isLate = Date.now() > targetDeadline;
    const dateStr = new Date(targetDeadline).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
      <div style={{ fontSize: "0.8rem", marginTop: "6px" }}>
        <span style={{ color: "#64748b" }}>Due: {dateStr} ({stageName})</span>
        {isLate && <span style={{ marginLeft: "8px", background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.75rem" }}>LATE</span>}
      </div>
    );
  };

  const handleGroupChange = (groupId: string) => {
    setSelectedGroup(groupId);
    setSelectedStudents([]); // reset
    setStudentToAdd("");
  };

  const currentGroup = groups.find(g => g.id === selectedGroup);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || selectedStudents.length === 0 || !advisor || committees.length === 0 || !chairperson) {
      return setInfoMessage("Please fill all required assignments (Group, Students, Advisor, Committees, Chairperson).");
    }

    setConfirmAction({
      message: editThesisId
        ? `Are you sure you want to save changes to "${title}"?`
        : `Are you sure you want to create the thesis "${title}" and assign all selected roles?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const thesisData = {
            title,
            abstract,
            scope,
            year,
            fieldOfStudy,
            groupId: selectedGroup,
            studentUids: selectedStudents,
            lecturerUids: {
              advisor,
              committees,
              chairperson
            },
            equipmentChecker,
            deadlines: {
              advisor: deadlineAdvisor ? new Date(deadlineAdvisor).getTime() : null,
              committee: deadlineCommittee ? new Date(deadlineCommittee).getTime() : null,
              chairperson: deadlineChairperson ? new Date(deadlineChairperson).getTime() : null
            }
          };

          if (editThesisId) {
            await updateThesis(editThesisId, thesisData);
            setInfoMessage("Thesis Updated Successfully!");
          } else {
            await createThesis({
              ...thesisData,
              status: "Preparing",
              currentStage: 0,
              createdAt: Date.now()
            });
            setInfoMessage("Thesis Created Successfully!");
          }

          // Reset form
          setTitle(""); setAbstract(""); setScope("");
          setYear((new Date().getFullYear() + 543).toString()); setFieldOfStudy("");
          setSelectedGroup(""); setSelectedStudents([]); setStudentToAdd("");
          setAdvisor(""); setCommittees([]); setChairperson(""); setEquipmentChecker("");
          setDeadlineAdvisor(""); setDeadlineCommittee(""); setDeadlineChairperson("");
          setEditThesisId(null);
          setShowCreateForm(false);
          loadTheses();
        } catch (err: any) {
          setInfoMessage(`Error ${editThesisId ? "updating" : "creating"} thesis: ` + err.message);
        }
        setLoading(false);
      }
    });
  };

  const filteredTheses = theses.filter(t => {
    if (filterGroup && t.groupId !== filterGroup) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterYear && t.year !== filterYear) return false;
    if (filterField && t.fieldOfStudy !== filterField) return false;
    if (searchTitle && !t.title.toLowerCase().includes(searchTitle.toLowerCase())) return false;
    return true;
  });

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterGroup, filterStatus, filterYear, filterField, searchTitle]);

  const totalItems = filteredTheses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const activePage = Math.min(currentPage, totalPages);
  const startIndex = (activePage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedTheses = filteredTheses.slice(startIndex, startIndex + itemsPerPage);

  const handleGraduateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!graduateThesisId) return;

    setLoading(true);
    try {
      const targetThesis = theses.find(t => t.id === graduateThesisId);
      const thesisTitle = targetThesis ? targetThesis.title : "Thesis";

      await updateThesis(graduateThesisId, {
        status: "Graduate",
        currentStage: 6,
        graduateComment: graduateReason,
        statusUpdatedAt: Date.now()
      });

      await logThesisActivity({
        thesisId: graduateThesisId,
        type: "Status Override",
        timestamp: Date.now(),
        actorEmail: user?.email || "admin@thesisportal.com",
        actorName: dbUser?.name_th || dbUser?.name_en || user?.email || "Administrator",
        actorRole: "Admin",
        description: `Admin forced status to Graduate. Reason: ${graduateReason}`
      });

      setInfoMessage(`Successfully marked "${thesisTitle}" as Graduate.`);
      setShowGraduateModal(false);
      setGraduateThesisId(null);
      setGraduateReason("");
      loadTheses();
    } catch (err: any) {
      setInfoMessage("Error marking thesis as Graduate: " + err.message);
    }
    setLoading(false);
  };

  const getStageBadgeStyle = (status: string, stage: number) => {
    if (status === "Graduate") return { bg: "var(--success-light)", text: "var(--success-color)", border: "var(--mint-border)" };
    if (status === "Revise") return { bg: "var(--danger-light)", text: "var(--danger-color)", border: "var(--rose-border)" };
    if (stage === 0) return { bg: "var(--primary-light)", text: "var(--primary-color)", border: "var(--primary-border)" };
    if (stage === 1) return { bg: "var(--purple-light)", text: "var(--purple-color)", border: "var(--lilac-border)" };
    if (stage === 2) return { bg: "var(--info-light)", text: "var(--info-color)", border: "var(--sky-border)" };
    if (stage >= 3 && stage <= 5) return { bg: "var(--warning-light)", text: "var(--warning-color)", border: "var(--peach-border)" };
    return { bg: "var(--bg-subtle)", text: "var(--text-muted)", border: "var(--border-color)" };
  };

  const renderUserModal = () => {
    if (!showUserModal.isOpen) return null;

    let list: any[] = [];
    if (showUserModal.type === "student") {
      list = currentGroup ? currentGroup.students.filter(s => !selectedStudents.includes(s.email)) : [];
    } else if (showUserModal.type === "committee") {
      list = lecturers.filter(l => !committees.includes(l.email));
    } else {
      list = lecturers;
    }

    const filteredList = list.filter(item => {
      const search = userSearchQuery.toLowerCase();
      if (showUserModal.type === "student") {
        return item.name.toLowerCase().includes(search) || item.studentId.includes(search) || item.email.toLowerCase().includes(search);
      } else {
        return (item.name_th || "").toLowerCase().includes(search) || (item.name_en || "").toLowerCase().includes(search) || item.email.toLowerCase().includes(search);
      }
    });

    const handleSelect = (email: string) => {
      if (showUserModal.type === "student") {
        setSelectedStudents([...selectedStudents, email]);
      } else if (showUserModal.type === "advisor") {
        setAdvisor(email);
      } else if (showUserModal.type === "committee") {
        setCommittees([...committees, email]);
      } else if (showUserModal.type === "chairperson") {
        setChairperson(email);
      } else if (showUserModal.type === "equipmentChecker") {
        setEquipmentChecker(email);
      }
      setShowUserModal({ ...showUserModal, isOpen: false });
      setUserSearchQuery("");
    };

    return (
      <div className={styles.modalOverlay} style={{ zIndex: 1100 }} onClick={() => { setShowUserModal({ ...showUserModal, isOpen: false }); setUserSearchQuery(""); }}>
        <div className={styles.modalContent} style={{ width: "540px", maxWidth: "100%", maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)" }}>
              {showUserModal.type === "student" ? "Select Student" : `Select ${showUserModal.type.charAt(0).toUpperCase() + showUserModal.type.slice(1)}`}
            </h3>
            <button
              type="button"
              onClick={() => { setShowUserModal({ ...showUserModal, isOpen: false }); setUserSearchQuery(""); }}
              className={styles.modalClose}
            >
              &times;
            </button>
          </div>
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={userSearchQuery}
            onChange={e => setUserSearchQuery(e.target.value)}
            style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", marginBottom: "16px", fontSize: "0.95rem", background: "var(--bg-subtle)" }}
            autoFocus
          />
          <div style={{ flex: 1, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "10px", background: "var(--bg-card)" }}>
            {filteredList.map(item => (
              <div
                key={item.email}
                onClick={() => handleSelect(item.email)}
                style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--primary-light)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.95rem" }}>
                  {showUserModal.type === "student" ? `${item.studentId} - ${item.name}` : `${item.name_th || item.name_en || item.email}`}
                </div>
                <div style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "2px" }}>{item.email}</div>
              </div>
            ))}
            {filteredList.length === 0 && (
              <div style={{ padding: "28px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>No matching members found.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderUserModal()}
      <div className={styles.pageHeader}>
        <div>
          <h1>Manage Theses</h1>
          <p className={styles.subtitle}>Supervise student thesis projects, assign committee panels, and track milestone workflows.</p>
        </div>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCreateForm ? "24px" : "0" }}>
          <div>
            <h2 style={{ margin: 0 }}>{editThesisId ? "Edit Thesis" : "Create New Thesis"}</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              {editThesisId ? "Update thesis metadata, deadlines, and panel assignments" : "Initialize a new project and assign student candidates and reviewer panels"}
            </p>
          </div>
          <button onClick={() => {
            if (showCreateForm) {
              setTitle(""); setAbstract(""); setScope("");
              setYear((new Date().getFullYear() + 543).toString()); setFieldOfStudy("");
              setSelectedGroup(""); setSelectedStudents([]); setStudentToAdd("");
              setAdvisor(""); setCommittees([]); setChairperson("");
              setDeadlineAdvisor(""); setDeadlineCommittee(""); setDeadlineChairperson("");
              setEditThesisId(null);
            }
            setShowCreateForm(!showCreateForm);
          }} className={showCreateForm ? styles.btnSecondary : styles.btnPrimary} style={{ margin: 0 }}>
            {showCreateForm ? "Cancel" : "＋ Add New Thesis"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter full thesis title in English or Thai" required />
            </div>

            <div className={styles.formGroup}>
              <label>Abstract</label>
              <textarea rows={4} value={abstract} onChange={e => setAbstract(e.target.value)} placeholder="Overview and summary of the research..." required />
            </div>

            <div className={styles.formGroup}>
              <label>Project Scope</label>
              <textarea rows={4} value={scope} onChange={e => setScope(e.target.value)} placeholder="Key boundaries, deliverables, and methodology..." required />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
              <div className={styles.formGroup}>
                <label>Thesis Year (พ.ศ.)</label>
                <input type="number" min="2500" max="2600" value={year} onChange={e => setYear(e.target.value)} required />
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
            </div>

            <hr style={{ margin: "28px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
            <h3 style={{ marginBottom: "16px", color: "var(--text-main)", fontSize: "1.1rem" }}>👥 Assign Students</h3>

            <div className={styles.formGroup}>
              <label>Select Student Group</label>
              <select value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}>
                <option value="">-- Select Group --</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {currentGroup && (
              <div className={styles.formGroup}>
                <label>Assigned Group Students</label>

                <div style={{ marginBottom: "14px" }}>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    style={{ margin: 0, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "8px" }}
                    onClick={() => setShowUserModal({ type: "student", isOpen: true })}
                  >
                    🔍 Search & Add Student
                  </button>
                </div>

                {selectedStudents.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 4px 0", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Selected Students ({selectedStudents.length})</p>
                    {selectedStudents.map(email => {
                      const s = currentGroup.students.find(st => st.email === email);
                      if (!s) {
                        return (
                          <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--danger-light)", border: "1px solid var(--rose-border)", padding: "12px 16px", borderRadius: "10px" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "var(--danger-color)", marginRight: "10px" }}>Unknown/Modified Student</span>
                              <span style={{ fontSize: "0.85rem", color: "var(--danger-color)" }}>{email}</span>
                            </div>
                            <button type="button" onClick={() => setSelectedStudents(selectedStudents.filter(e => e !== email))} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Remove</button>
                          </div>
                        );
                      }
                      return (
                        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--text-main)", marginRight: "10px" }}>{s.name} {s.name_en ? `(${s.name_en})` : ''}</span>
                            <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{s.studentId} • {s.email}</span>
                          </div>
                          <button type="button" onClick={() => setSelectedStudents(selectedStudents.filter(e => e !== email))} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <hr style={{ margin: "28px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
            <h3 style={{ marginBottom: "16px", color: "var(--text-main)", fontSize: "1.1rem" }}>🎓 Assign Faculty Panel</h3>

            <div className={styles.formGroup}>
              <label>Advisor</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", color: advisor ? "var(--text-main)" : "var(--text-muted)", fontSize: "0.95rem" }}>
                  {advisor ? (() => {
                    const l = lecturers.find(lec => lec.email === advisor);
                    return l ? `${l.name_th} (${l.email})` : advisor;
                  })() : "No Advisor Selected"}
                </div>
                <button type="button" className={styles.btnSecondary} style={{ margin: 0, padding: "10px 16px" }} onClick={() => setShowUserModal({ type: "advisor", isOpen: true })}>Search & Select</button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Committees</label>
              <div style={{ marginBottom: "12px" }}>
                <button type="button" className={styles.btnSecondary} style={{ margin: 0, padding: "8px 16px", display: "inline-flex", alignItems: "center", gap: "8px" }} onClick={() => setShowUserModal({ type: "committee", isOpen: true })}>
                  🔍 Search & Add Committee
                </button>
              </div>

              {committees.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: "0 0 4px 0", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em" }}>Assigned Committees ({committees.length})</p>
                  {committees.map(email => {
                    const l = lecturers.find(lec => lec.email === email);
                    if (!l) {
                      return (
                        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--danger-light)", border: "1px solid var(--rose-border)", padding: "12px 16px", borderRadius: "10px" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--danger-color)", marginRight: "10px" }}>Unknown/Modified Lecturer</span>
                            <span style={{ fontSize: "0.85rem", color: "var(--danger-color)" }}>{email}</span>
                          </div>
                          <button type="button" onClick={() => setCommittees(committees.filter(e => e !== email))} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Remove</button>
                        </div>
                      );
                    }
                    return (
                      <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-subtle)", border: "1px solid var(--border-color)", padding: "12px 16px", borderRadius: "10px" }}>
                        <div>
                          <span style={{ fontWeight: 600, color: "var(--text-main)", marginRight: "10px" }}>{l.name_th} {l.name_en ? `(${l.name_en})` : ''}</span>
                          <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{l.email}</span>
                        </div>
                        <button type="button" onClick={() => setCommittees(committees.filter(e => e !== email))} style={{ background: "none", border: "none", color: "var(--danger-color)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Remove</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Chairperson</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", color: chairperson ? "var(--text-main)" : "var(--text-muted)", fontSize: "0.95rem" }}>
                  {chairperson ? (() => {
                    const l = lecturers.find(lec => lec.email === chairperson);
                    return l ? `${l.name_th} (${l.email})` : chairperson;
                  })() : "No Chairperson Selected"}
                </div>
                <button type="button" className={styles.btnSecondary} style={{ margin: 0, padding: "10px 16px" }} onClick={() => setShowUserModal({ type: "chairperson", isOpen: true })}>Search & Select</button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label>Equipment Checker (Optional)</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", color: equipmentChecker ? "var(--text-main)" : "var(--text-muted)", fontSize: "0.95rem" }}>
                  {equipmentChecker ? (() => {
                    const l = lecturers.find(lec => lec.email === equipmentChecker);
                    return l ? `${l.name_th} (${l.email})` : equipmentChecker;
                  })() : "No Equipment Checker Selected"}
                </div>
                <button type="button" className={styles.btnSecondary} style={{ margin: 0, padding: "10px 16px" }} onClick={() => setShowUserModal({ type: "equipmentChecker", isOpen: true })}>Search & Select</button>
              </div>
            </div>

            <hr style={{ margin: "28px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
            <h3 style={{ marginBottom: "16px", color: "var(--text-main)", fontSize: "1.1rem" }}>⏳ Stage Deadlines (Optional)</h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", marginBottom: "24px" }}>
              <div className={styles.formGroup}>
                <label>Advisor Deadline</label>
                <input type="datetime-local" value={deadlineAdvisor} onChange={e => setDeadlineAdvisor(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Committee Deadline</label>
                <input type="datetime-local" value={deadlineCommittee} onChange={e => setDeadlineCommittee(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label>Chairperson Deadline</label>
                <input type="datetime-local" value={deadlineChairperson} onChange={e => setDeadlineChairperson(e.target.value)} />
              </div>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={loading} style={{ width: "100%", padding: "14px" }}>
              {loading ? "Saving..." : (editThesisId ? "💾 Save Changes" : "✨ Create Thesis & Assign Roles")}
            </button>
          </form>
        )}
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0 }}>All Theses</h2>
            <p style={{ margin: "4px 0 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>Filter and oversee all departmental thesis projects</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.875rem", color: "var(--text-muted)" }}>
            <span>Show</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", fontWeight: 600, color: "var(--text-main)" }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span>entries</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="🔍 Search title..."
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)" }}
          />
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)" }}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)" }}>
            <option value="">All Statuses</option>
            <option value="Preparing">Preparing</option>
            <option value="Pending Advisor">Pending Advisor</option>
            <option value="Pending Committee">Pending Committee</option>
            <option value="Pending Chairperson">Pending Chairperson</option>
            <option value="Pending Sign. Advisor">Pending Sign. Advisor</option>
            <option value="Pending Sign. Committee">Pending Sign. Committee</option>
            <option value="Pending Sign. Chairperson">Pending Sign. Chairperson</option>
            <option value="Graduate">Graduate</option>
            <option value="Revise">Revise</option>
          </select>
          <input
            type="number"
            placeholder="Year (e.g. 2569)"
            value={filterYear}
            onChange={e => setFilterYear(e.target.value)}
            style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)" }}
          />
          <select value={filterField} onChange={e => setFilterField(e.target.value)} style={{ padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "var(--bg-subtle)" }}>
            <option value="">All Fields</option>
            <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
            <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
            <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
            <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
            <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
            <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
          </select>
        </div>

        {totalItems === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text-muted)", background: "var(--bg-subtle)", borderRadius: "12px" }}>
            <p style={{ margin: 0, fontSize: "1rem" }}>No theses match the current criteria.</p>
          </div>
        ) : (
          <div>
            <div className={styles.tableResponsive}>
              <table className={`${styles.table} ${styles.thesisTable}`}>
                <thead>
                <tr>
                  <th style={{ width: "26%" }}>Title</th>
                  <th style={{ width: "12%" }}>Group</th>
                  <th style={{ width: "8%" }}>Year</th>
                  <th style={{ width: "18%" }}>Field</th>
                  <th style={{ width: "18%" }}>Status</th>
                  <th style={{ width: "18%" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTheses.map((t) => {
                  const groupName = groups.find(g => g.id === t.groupId)?.name || "Unknown Group";
                  const badgeStyle = getStageBadgeStyle(t.status, t.currentStage);
                  return (
                    <tr key={t.id}>
                      <td data-label="Title" style={{ wordBreak: "break-word" }}>
                        <strong style={{ color: "var(--text-main)", fontSize: "0.95rem" }}>{t.title}</strong>
                        {getDeadlineDisplay(t)}
                      </td>
                      <td data-label="Group"><span style={{ fontWeight: 500 }}>{groupName}</span></td>
                      <td data-label="Year">{t.year || "-"}</td>
                      <td data-label="Field" style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{t.fieldOfStudy || "-"}</td>
                      <td data-label="Status">
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 10px",
                          background: badgeStyle.bg,
                          color: badgeStyle.text,
                          border: `1px solid ${badgeStyle.border}`,
                          borderRadius: "999px",
                          fontSize: "0.8rem",
                          fontWeight: 600
                        }}>
                          {getStageIcon(t.currentStage)} {getDisplayStatus(t)}
                        </span>
                        {t.status === "Graduate" && t.graduateComment && (
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px", fontStyle: "italic" }}>
                            Reason: {t.graduateComment}
                          </div>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button
                            onClick={async () => {
                              setViewThesis(t);
                              setLoadingActivities(true);
                              try {
                                const acts = await getThesisActivities(t.id);
                                setThesisActivities(acts);
                              } catch (err) {
                                console.error(err);
                              }
                              setLoadingActivities(false);
                            }}
                            className={styles.btnSecondary}
                            style={{ padding: "4px 10px", fontSize: "0.775rem", margin: 0 }}
                          >
                            Details
                          </button>
                          {t.status !== "Graduate" && (
                            <button
                              onClick={() => {
                                setGraduateThesisId(t.id);
                                setGraduateReason("");
                                setShowGraduateModal(true);
                              }}
                              style={{
                                background: "var(--success-light)",
                                color: "var(--success-color)",
                                border: "1px solid var(--mint-border)",
                                padding: "4px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "0.775rem",
                                fontWeight: 600
                              }}
                            >
                              Graduate
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setConfirmAction({
                                message: `Are you sure you want to completely delete the thesis "${t.title}"?`,
                                onConfirm: async () => {
                                  try {
                                    await deleteThesis(t.id);
                                    loadTheses();
                                  } catch (err) {
                                    setInfoMessage("Error deleting thesis");
                                  }
                                }
                              });
                            }}
                            style={{
                              background: "var(--danger-light)",
                              color: "var(--danger-color)",
                              border: "1px solid var(--rose-border)",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "0.775rem",
                              fontWeight: 600
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                </tbody>
              </table>
            </div>
            {totalItems > 0 && (
              <div className={styles.paginationContainer} style={{ justifyContent: "space-between" }}>
                <span className={styles.paginationInfo}>
                  Showing {startIndex + 1}-{endIndex} of {totalItems} (Page {activePage} of {totalPages})
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.paginationBtn}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={activePage === 1}
                    aria-label="Previous Page"
                  >
                    &larr; Prev
                  </button>
                  <button
                    className={styles.paginationBtn}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={activePage === totalPages}
                    aria-label="Next Page"
                  >
                    Next &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className={styles.modalOverlay} style={{ zIndex: 1100 }} onClick={() => setConfirmAction(null)}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "420px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>⚠️</div>
            <h3 style={{ marginTop: 0, marginBottom: "12px", color: "var(--text-main)" }}>Confirm Action</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.95rem" }}>{confirmAction.message}</p>
            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button className={styles.btnSecondary} style={{ margin: 0 }} onClick={() => setConfirmAction(null)}>Cancel</button>
              <button className={styles.btnPrimary} style={{ margin: 0 }} onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}>Yes, proceed</button>
            </div>
          </div>
        </div>
      )}

      {/* Info Modal */}
      {infoMessage && (
        <div className={styles.modalOverlay} style={{ zIndex: 1200 }} onClick={() => setInfoMessage(null)}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "400px", textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: "2rem", marginBottom: "8px" }}>✨</div>
            <h3 style={{ marginTop: 0, marginBottom: "12px", color: "var(--text-main)" }}>Notification</h3>
            <p style={{ color: "var(--text-muted)", marginBottom: "24px", fontSize: "0.95rem" }}>{infoMessage}</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className={styles.btnPrimary} style={{ margin: 0, minWidth: "120px" }} onClick={() => setInfoMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewThesis && (
        <div className={styles.modalOverlay} style={{ zIndex: 1050 }} onClick={() => setViewThesis(null)}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "680px", maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "16px", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px 0", fontSize: "1.3rem" }}>Thesis Details</h2>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>ID: {viewThesis.id}</span>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className={styles.btnPrimary} style={{ margin: 0, padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => {
                  setTitle(viewThesis.title);
                  setAbstract(viewThesis.abstract);
                  setScope(viewThesis.scope);
                  setYear(viewThesis.year || (new Date().getFullYear() + 543).toString());
                  setFieldOfStudy(viewThesis.fieldOfStudy || "");
                  setSelectedGroup(viewThesis.groupId);
                  setSelectedStudents(viewThesis.studentUids);
                  setAdvisor(viewThesis.lecturerUids.advisor);
                  setCommittees(viewThesis.lecturerUids.committees);
                  setChairperson(viewThesis.lecturerUids.chairperson);
                  setEquipmentChecker(viewThesis.equipmentChecker || "");
                  setDeadlineAdvisor(formatDatetimeLocal(viewThesis.deadlines?.advisor));
                  setDeadlineCommittee(formatDatetimeLocal(viewThesis.deadlines?.committee));
                  setDeadlineChairperson(formatDatetimeLocal(viewThesis.deadlines?.chairperson));
                  
                  setEditThesisId(viewThesis.id);
                  setShowCreateForm(true);
                  setViewThesis(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>✏️ Edit</button>
                <button className={styles.btnSecondary} style={{ margin: 0, padding: "8px 14px", fontSize: "0.85rem" }} onClick={() => setViewThesis(null)}>Close</button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", fontSize: "0.95rem" }}>
              <div>
                <strong style={{ color: "var(--text-main)", display: "block", marginBottom: "4px" }}>Title:</strong>
                <span style={{ color: "var(--text-main)", fontWeight: 500 }}>{viewThesis.title}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><strong>Group:</strong> <span style={{ color: "var(--text-muted)" }}>{groups.find(g => g.id === viewThesis.groupId)?.name}</span></div>
                <div><strong>Year:</strong> <span style={{ color: "var(--text-muted)" }}>{viewThesis.year || "-"}</span></div>
                <div><strong>Field of Study:</strong> <span style={{ color: "var(--text-muted)" }}>{viewThesis.fieldOfStudy || "-"}</span></div>
                <div><strong>Status:</strong> <span style={{ padding: "2px 8px", background: "var(--primary-light)", color: "var(--primary-color)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600 }}>{getDisplayStatus(viewThesis)}</span></div>
              </div>

              {(viewThesis.deadlines?.advisor || viewThesis.deadlines?.committee || viewThesis.deadlines?.chairperson) && (
                <div style={{ background: "var(--warning-light)", padding: "12px 16px", borderRadius: "10px", border: "1px solid var(--peach-border)" }}>
                  <strong style={{ color: "var(--warning-color)", fontSize: "0.875rem" }}>⏳ Stage Deadlines:</strong>
                  <ul style={{ paddingLeft: "18px", margin: "6px 0 0 0", color: "var(--text-main)", fontSize: "0.85rem" }}>
                    {viewThesis.deadlines.advisor && <li><strong>Advisor:</strong> {new Date(viewThesis.deadlines.advisor).toLocaleString('th-TH')}</li>}
                    {viewThesis.deadlines.committee && <li><strong>Committee:</strong> {new Date(viewThesis.deadlines.committee).toLocaleString('th-TH')}</li>}
                    {viewThesis.deadlines.chairperson && <li><strong>Chairperson:</strong> {new Date(viewThesis.deadlines.chairperson).toLocaleString('th-TH')}</li>}
                  </ul>
                </div>
              )}

              <div>
                <strong style={{ color: "var(--text-main)" }}>Abstract:</strong>
                <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0 0", background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {viewThesis.abstract}
                </p>
              </div>

              <div>
                <strong style={{ color: "var(--text-main)" }}>Scope:</strong>
                <p style={{ whiteSpace: "pre-wrap", margin: "6px 0 0 0", background: "var(--bg-subtle)", padding: "12px 14px", borderRadius: "10px", border: "1px solid var(--border-color)", fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {viewThesis.scope}
                </p>
              </div>

              <hr style={{ margin: "16px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />

              <div>
                <strong style={{ color: "var(--text-main)" }}>👥 Assigned Students ({viewThesis.studentUids.length}):</strong>
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  {viewThesis.studentUids.map((email: string) => {
                    const s = groups.find(g => g.id === viewThesis.groupId)?.students.find(st => st.email === email);
                    return (
                      <div key={email} style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "8px", fontSize: "0.875rem", display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontWeight: 600 }}>{s ? `${s.name} ${s.name_en ? `(${s.name_en})` : ''}` : email}</span>
                        <span style={{ color: "var(--text-muted)" }}>{s?.studentId || email}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <strong style={{ color: "var(--text-main)" }}>🎓 Assigned Lecturers:</strong>
                <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "8px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--primary-color)", fontWeight: 700 }}>Advisor:</span> {lecturers.find(l => l.email === viewThesis.lecturerUids.advisor)?.name_th || viewThesis.lecturerUids.advisor}
                  </div>
                  {viewThesis.lecturerUids.committees.map((email: string, idx: number) => (
                    <div key={email} style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "8px", fontSize: "0.875rem" }}>
                      <span style={{ color: "var(--purple-color)", fontWeight: 700 }}>Committee #{idx + 1}:</span> {lecturers.find(l => l.email === email)?.name_th || email}
                    </div>
                  ))}
                  <div style={{ padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "8px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--info-color)", fontWeight: 700 }}>Chairperson:</span> {lecturers.find(l => l.email === viewThesis.lecturerUids.chairperson)?.name_th || viewThesis.lecturerUids.chairperson}
                  </div>
                </div>
              </div>

              <hr style={{ margin: "16px 0", border: "0", borderTop: "1px solid var(--border-color)" }} />
              
              <div>
                <strong style={{ color: "var(--text-main)" }}>📜 Activity History:</strong>
                {loadingActivities ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "8px" }}>Loading activities...</p>
                ) : thesisActivities.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "8px" }}>No activity recorded yet.</p>
                ) : (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {thesisActivities.map(act => (
                      <div key={act.id} style={{ padding: "10px 14px", background: "var(--bg-subtle)", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ color: "var(--text-main)", fontSize: "0.875rem" }}>{act.type}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{new Date(act.timestamp).toLocaleString('th-TH')}</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                          By: {act.actorName || act.actorEmail} ({act.actorRole})
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "var(--text-main)" }}>{act.description}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Graduate Modal */}
      {showGraduateModal && (
        <div className={styles.modalOverlay} style={{ zIndex: 1150 }} onClick={() => { setShowGraduateModal(false); setGraduateThesisId(null); setGraduateReason(""); }}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "480px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "14px", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "1.2rem", color: "var(--text-main)" }}>🎓 Mark Thesis as Graduate</h2>
              <button
                type="button"
                onClick={() => { setShowGraduateModal(false); setGraduateThesisId(null); setGraduateReason(""); }}
                className={styles.modalClose}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleGraduateSubmit}>
              <p style={{ marginBottom: "16px", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                Overriding will conclude all reviewer approval milestones and grant completion status.
              </p>
              
              <div className={styles.formGroup}>
                <label>Graduation Reason / Notes</label>
                <textarea
                  rows={4}
                  value={graduateReason}
                  onChange={(e) => setGraduateReason(e.target.value)}
                  placeholder="e.g. Passed final oral defense with minor revisions approved..."
                  required
                />
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  style={{ margin: 0 }}
                  onClick={() => { setShowGraduateModal(false); setGraduateThesisId(null); setGraduateReason(""); }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  style={{ margin: 0, background: "var(--success-color)", borderColor: "var(--success-color)" }}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Confirm Graduation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
