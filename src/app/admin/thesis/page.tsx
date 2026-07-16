"use client";

import { useState, useEffect } from "react";
import styles from "../admin.module.css";
import { getLecturers, UserData } from "@/lib/db/users";
import { getGroups, StudentGroup } from "@/lib/db/groups";
import { createThesis, getAllTheses, deleteThesis, updateThesis, getDisplayStatus, getThesisActivities } from "@/lib/db/theses";

export default function AdminThesisPage() {
  const [lecturers, setLecturers] = useState<UserData[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [theses, setTheses] = useState<any[]>([]);

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

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>Manage Theses</h1>
      </div>

      <div className={styles.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: showCreateForm ? "20px" : "0" }}>
          <h2 style={{ margin: 0 }}>{editThesisId ? "Edit Thesis" : "Create New Thesis"}</h2>
          <button onClick={() => {
            if (showCreateForm) {
              // Canceling
              setTitle(""); setAbstract(""); setScope("");
              setYear((new Date().getFullYear() + 543).toString()); setFieldOfStudy("");
              setSelectedGroup(""); setSelectedStudents([]); setStudentToAdd("");
              setAdvisor(""); setCommittees([]); setChairperson("");
              setDeadlineAdvisor(""); setDeadlineCommittee(""); setDeadlineChairperson("");
              setEditThesisId(null);
            }
            setShowCreateForm(!showCreateForm);
          }} className={styles.btnPrimary} style={{ margin: 0, background: showCreateForm ? "#64748b" : undefined }}>
            {showCreateForm ? "Cancel" : "Add New Thesis"}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label>Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>

            <div className={styles.formGroup}>
              <label>Abstract</label>
              <textarea rows={4} value={abstract} onChange={e => setAbstract(e.target.value)} required />
            </div>

            <div className={styles.formGroup}>
              <label>Project Scope</label>
              <textarea rows={4} value={scope} onChange={e => setScope(e.target.value)} required />
            </div>

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

            <hr style={{ margin: "30px 0", border: "0", borderTop: "1px solid #ddd" }} />
            <h3 style={{ marginBottom: "20px" }}>Assign Students</h3>

            <div className={styles.formGroup}>
              <label>Select Student Group</label>
              <select value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}>
                <option value="">-- Select Group --</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {currentGroup && (
              <div className={styles.formGroup}>
                <label>Assign Students</label>

                <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                  <select
                    value={studentToAdd}
                    onChange={e => setStudentToAdd(e.target.value)}
                    style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                  >
                    <option value="">-- Select Student from Group --</option>
                    {currentGroup.students
                      .filter(s => !selectedStudents.includes(s.email))
                      .map(s => <option key={s.email} value={s.email}>{s.studentId} - {s.name}</option>)}
                  </select>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    style={{ margin: 0, padding: "10px 20px" }}
                    onClick={() => {
                      if (studentToAdd) {
                        setSelectedStudents([...selectedStudents, studentToAdd]);
                        setStudentToAdd("");
                      }
                    }}
                  >
                    Add
                  </button>
                </div>

                {selectedStudents.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 5px 0", fontWeight: "bold", textTransform: "uppercase" }}>Assigned Students ({selectedStudents.length})</p>
                    {selectedStudents.map(email => {
                      const s = currentGroup.students.find(st => st.email === email);
                      if (!s) {
                        return (
                          <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", border: "1px solid #fca5a5", padding: "12px 16px", borderRadius: "6px" }}>
                            <div>
                              <span style={{ fontWeight: 600, color: "#991b1b", marginRight: "10px" }}>Unknown/Modified Student</span>
                              <span style={{ fontSize: "0.85rem", color: "#b91c1c" }}>{email}</span>
                            </div>
                            <button type="button" onClick={() => setSelectedStudents(selectedStudents.filter(e => e !== email))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Remove</button>
                          </div>
                        );
                      }
                      return (
                        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: "6px" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#1e293b", marginRight: "10px" }}>{s.name} {s.name_en ? `(${s.name_en})` : ''}</span>
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{s.studentId} • {s.email}</span>
                          </div>
                          <button type="button" onClick={() => setSelectedStudents(selectedStudents.filter(e => e !== email))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Remove</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <hr style={{ margin: "30px 0", border: "0", borderTop: "1px solid #ddd" }} />
            <h3 style={{ marginBottom: "20px" }}>Assign Lecturers</h3>

            <div className={styles.formGroup}>
              <label>Advisor</label>
              <select value={advisor} onChange={e => setAdvisor(e.target.value)} required>
                <option value="">-- Select Advisor --</option>
                {lecturers.map(l => <option key={l.uid} value={l.email}>{l.name_th} ({l.email})</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Committees</label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
                <select
                  value={committeeToAdd}
                  onChange={e => setCommitteeToAdd(e.target.value)}
                  style={{ flex: 1, padding: "10px", borderRadius: "4px", border: "1px solid #ccc" }}
                >
                  <option value="">-- Select Committee Member --</option>
                  {lecturers
                    .filter(l => !committees.includes(l.email))
                    .map(l => <option key={l.uid} value={l.email}>{l.name_th} ({l.email})</option>)}
                </select>
                <button
                  type="button"
                  className={styles.btnPrimary}
                  style={{ margin: 0, padding: "10px 20px" }}
                  onClick={() => {
                    if (committeeToAdd) {
                      setCommittees([...committees, committeeToAdd]);
                      setCommitteeToAdd("");
                    }
                  }}
                >
                  Add
                </button>
              </div>

              {committees.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 5px 0", fontWeight: "bold", textTransform: "uppercase" }}>Assigned Committees ({committees.length})</p>
                  {committees.map(email => {
                    const l = lecturers.find(lec => lec.email === email);
                    if (!l) {
                      return (
                        <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fef2f2", border: "1px solid #fca5a5", padding: "12px 16px", borderRadius: "6px" }}>
                          <div>
                            <span style={{ fontWeight: 600, color: "#991b1b", marginRight: "10px" }}>Unknown/Modified Lecturer</span>
                            <span style={{ fontSize: "0.85rem", color: "#b91c1c" }}>{email}</span>
                          </div>
                          <button type="button" onClick={() => setCommittees(committees.filter(e => e !== email))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Remove</button>
                        </div>
                      );
                    }
                    return (
                      <div key={email} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", border: "1px solid #e2e8f0", padding: "12px 16px", borderRadius: "6px" }}>
                        <div>
                          <span style={{ fontWeight: 600, color: "#1e293b", marginRight: "10px" }}>{l.name_th} {l.name_en ? `(${l.name_en})` : ''}</span>
                          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{l.email}</span>
                        </div>
                        <button type="button" onClick={() => setCommittees(committees.filter(e => e !== email))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>Remove</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Chairperson</label>
              <select value={chairperson} onChange={e => setChairperson(e.target.value)} required>
                <option value="">-- Select Chairperson --</option>
                {lecturers.map(l => <option key={l.uid} value={l.email}>{l.name_th} ({l.email})</option>)}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Equipment Checker (Optional)</label>
              <select value={equipmentChecker} onChange={e => setEquipmentChecker(e.target.value)}>
                <option value="">-- Select Equipment Checker --</option>
                {lecturers.map(l => <option key={l.uid} value={l.email}>{l.name_th} ({l.email})</option>)}
              </select>
            </div>

            <hr style={{ margin: "30px 0", border: "0", borderTop: "1px solid #ddd" }} />
            <h3 style={{ marginBottom: "20px" }}>Stage Deadlines (Optional)</h3>

            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
              <div className={styles.formGroup} style={{ flex: "1 1 200px" }}>
                <label>Advisor Deadline</label>
                <input type="datetime-local" value={deadlineAdvisor} onChange={e => setDeadlineAdvisor(e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ flex: "1 1 200px" }}>
                <label>Committee Deadline</label>
                <input type="datetime-local" value={deadlineCommittee} onChange={e => setDeadlineCommittee(e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ flex: "1 1 200px" }}>
                <label>Chairperson Deadline</label>
                <input type="datetime-local" value={deadlineChairperson} onChange={e => setDeadlineChairperson(e.target.value)} />
              </div>
            </div>

            <button type="submit" className={styles.btnPrimary} disabled={loading}>
              {loading ? "Saving..." : (editThesisId ? "Save Changes" : "Create Thesis & Assign Roles")}
            </button>
          </form>
        )}
      </div>

      <div className={styles.card}>
        <h2>All Theses</h2>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}>
          <input
            type="text"
            placeholder="Search by title..."
            value={searchTitle}
            onChange={e => setSearchTitle(e.target.value)}
            style={{ flex: "1 1 200px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <select value={filterGroup} onChange={e => setFilterGroup(e.target.value)} style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
            <option value="">All Groups</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ flex: "1 1 150px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}>
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
            style={{ flex: "1 1 120px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc" }}
          />
          <select value={filterField} onChange={e => setFilterField(e.target.value)} style={{ flex: "1 1 200px", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", maxWidth: "100%" }}>
            <option value="">All Fields</option>
            <option value="แขนงวิชาโทรคมนาคม">แขนงวิชาโทรคมนาคม</option>
            <option value="แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์">แขนงวิชาคอมพิวเตอร์และปัญญาประดิษฐ์</option>
            <option value="แขนงวิชาเครื่องมือวัดและควบคุม">แขนงวิชาเครื่องมือวัดและควบคุม</option>
            <option value="แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย">แขนงวิชาบรอดแคสต์และดิจิทัลมีเดีย</option>
            <option value="ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์">ระบบสมองกลฝังตัวและการออกแบบอิเล็กทรอนิกส์</option>
            <option value="สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์">สาขาวิชาเทคโนโลยีวิศวกรรมอิเล็กทรอนิกส์ประยุกต์</option>
          </select>
        </div>

        {filteredTheses.length === 0 ? (
          <p style={{ color: "#666", textAlign: "center", padding: "20px" }}>No theses found matching your criteria.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table} style={{ tableLayout: "fixed", width: "100%", minWidth: "900px" }}>
              <thead>
              <tr>
                <th style={{ width: "25%" }}>Title</th>
                <th style={{ width: "15%" }}>Group</th>
                <th style={{ width: "10%" }}>Year</th>
                <th style={{ width: "15%" }}>Field</th>
                <th style={{ width: "15%" }}>Status</th>
                <th style={{ width: "20%" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTheses.map((t) => {
                const groupName = groups.find(g => g.id === t.groupId)?.name || "Unknown Group";
                return (
                  <tr key={t.id}>
                    <td style={{ wordBreak: "break-all" }}>
                      <strong>{t.title}</strong>
                      {getDeadlineDisplay(t)}
                    </td>
                    <td>{groupName}</td>
                    <td>{t.year || "-"}</td>
                    <td>{t.fieldOfStudy || "-"}</td>
                    <td><span style={{ padding: "4px 8px", background: "#f1f5f9", borderRadius: "4px", fontSize: "0.85rem", whiteSpace: "nowrap" }}>{getStageIcon(t.currentStage)} {getDisplayStatus(t)}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
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
                          style={{ background: "none", border: "1px solid #3b82f6", color: "#3b82f6", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}
                        >
                          View Detail
                        </button>
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
                          style={{ background: "none", border: "1px solid #dc2626", color: "#dc2626", padding: "4px 12px", borderRadius: "2px", cursor: "pointer", fontSize: "0.8rem" }}
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
        )}
      </div>

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

      {/* Info Modal */}
      {infoMessage && (
        <div className={styles.modalOverlay} style={{ zIndex: 1200 }}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "400px", textAlign: "center" }}>
            <h3 style={{ marginTop: 0, marginBottom: "20px", color: "#0f172a" }}>Notification</h3>
            <p style={{ color: "#64748b", marginBottom: "30px" }}>{infoMessage}</p>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <button className={styles.btnPrimary} style={{ margin: 0 }} onClick={() => setInfoMessage(null)}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* View Detail Modal */}
      {viewThesis && (
        <div className={styles.modalOverlay} style={{ zIndex: 1050 }}>
          <div className={styles.modalContent} style={{ width: "100%", maxWidth: "600px", maxHeight: "80vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
              <h2 style={{ margin: 0 }}>Thesis Details</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button className={styles.btnPrimary} style={{ margin: 0, background: "#3b82f6", padding: "8px 16px", fontSize: "0.9rem" }} onClick={() => {
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
                }}>Edit Thesis</button>
                <button className={styles.btnPrimary} style={{ margin: 0, background: "#64748b", padding: "8px 16px", fontSize: "0.9rem" }} onClick={() => setViewThesis(null)}>Close Details</button>
              </div>
            </div>
            <div style={{ marginBottom: "15px" }}><strong>Title:</strong> {viewThesis.title}</div>
            <div style={{ marginBottom: "15px" }}><strong>Group:</strong> {groups.find(g => g.id === viewThesis.groupId)?.name}</div>
            <div style={{ marginBottom: "15px" }}><strong>Status:</strong> <span style={{ padding: "2px 8px", background: "#f1f5f9", borderRadius: "4px", fontSize: "0.85rem" }}>{getDisplayStatus(viewThesis)}</span></div>
            <div style={{ marginBottom: "15px" }}><strong>Year:</strong> {viewThesis.year || "-"}</div>
            <div style={{ marginBottom: "15px" }}><strong>Field of Study:</strong> {viewThesis.fieldOfStudy || "-"}</div>
            {(viewThesis.deadlines?.advisor || viewThesis.deadlines?.committee || viewThesis.deadlines?.chairperson) && (
              <div style={{ marginBottom: "15px" }}>
                <strong>Deadlines:</strong>
                <ul style={{ paddingLeft: "20px", marginTop: "5px", color: "#475569" }}>
                  {viewThesis.deadlines.advisor && <li><strong>Advisor:</strong> {new Date(viewThesis.deadlines.advisor).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>}
                  {viewThesis.deadlines.committee && <li><strong>Committee:</strong> {new Date(viewThesis.deadlines.committee).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>}
                  {viewThesis.deadlines.chairperson && <li><strong>Chairperson:</strong> {new Date(viewThesis.deadlines.chairperson).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</li>}
                </ul>
              </div>
            )}
            <div style={{ marginBottom: "15px" }}><strong>Abstract:</strong> <p style={{ whiteSpace: "pre-wrap", margin: "5px 0", background: "#f8fafc", padding: "10px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>{viewThesis.abstract}</p></div>
            <div style={{ marginBottom: "15px" }}><strong>Scope:</strong> <p style={{ whiteSpace: "pre-wrap", margin: "5px 0", background: "#f8fafc", padding: "10px", borderRadius: "4px", border: "1px solid #e2e8f0" }}>{viewThesis.scope}</p></div>

            <hr style={{ margin: "20px 0", border: "0", borderTop: "1px solid #ddd" }} />

            <div style={{ marginBottom: "15px" }}>
              <strong>Assigned Students ({viewThesis.studentUids.length}):</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "5px", color: "#475569" }}>
                {viewThesis.studentUids.map((email: string) => {
                  const s = groups.find(g => g.id === viewThesis.groupId)?.students.find(st => st.email === email);
                  return <li key={email}>{s ? `${s.name} ${s.name_en ? `(${s.name_en})` : ''} - ` : ''}{email}</li>;
                })}
              </ul>
            </div>

            <div style={{ marginBottom: "15px" }}>
              <strong>Assigned Lecturers:</strong>
              <ul style={{ paddingLeft: "20px", marginTop: "5px", color: "#475569" }}>
                <li>
                  <strong>Chairperson:</strong> {lecturers.find(l => l.email === viewThesis.lecturerUids.chairperson)?.name_th || ""} - {viewThesis.lecturerUids.chairperson}
                </li>
                <li>
                  <strong>Committees:</strong>
                  <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
                    {viewThesis.lecturerUids.committees.map((email: string, idx: number) => (
                      <li key={email}>{viewThesis.lecturerUids.committees.length > 1 ? `Committee #${idx + 1}: ` : ""}{lecturers.find(l => l.email === email)?.name_th || ""} - {email}</li>
                    ))}
                  </ul>
                </li>
                <li>
                  <strong>Advisor:</strong> {lecturers.find(l => l.email === viewThesis.lecturerUids.advisor)?.name_th || ""} - {viewThesis.lecturerUids.advisor}
                </li>
              </ul>
            </div>

            <hr style={{ margin: "20px 0", border: "0", borderTop: "1px solid #ddd" }} />
            
            <div style={{ marginBottom: "15px" }}>
              <strong>Activity History:</strong>
              {loadingActivities ? (
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "10px" }}>Loading activities...</p>
              ) : thesisActivities.length === 0 ? (
                <p style={{ color: "#64748b", fontSize: "0.9rem", marginTop: "10px" }}>No activity history found.</p>
              ) : (
                <div style={{ marginTop: "15px", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {thesisActivities.map(act => (
                    <div key={act.id} style={{ padding: "10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <strong style={{ color: "#334155" }}>{act.type}</strong>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{new Date(act.timestamp).toLocaleString('th-TH')}</span>
                      </div>
                      <div style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "5px" }}>
                        By: {act.actorName || act.actorEmail} ({act.actorRole})
                      </div>
                      <div style={{ fontSize: "0.9rem" }}>{act.description}</div>
                      {act.documentUrl && (
                        <div style={{ marginTop: "5px" }}>
                          <a href={act.documentUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", fontSize: "0.85rem", textDecoration: "underline" }}>
                            {act.documentName || "View Document"}
                          </a>
                        </div>
                      )}
                      {act.links && act.links.map((lnk: any, idx: number) => (
                        <div key={idx} style={{ marginTop: "5px" }}>
                          <a href={lnk.url} target="_blank" rel="noopener noreferrer" style={{ color: "#3b82f6", fontSize: "0.85rem", textDecoration: "underline" }}>
                            {lnk.type} Link
                          </a>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
