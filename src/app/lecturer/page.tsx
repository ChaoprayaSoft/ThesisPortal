"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "./lecturer.module.css";
import { getThesesByLecturer, subscribeToThesesByLecturer, approveThesis, rejectThesis, ThesisData, getThesisActivities, ThesisActivity, logThesisActivity } from "@/lib/db/theses";
import { sendNotificationEmail } from "@/lib/actions/email";
import { ExternalLink, Plus, X } from "lucide-react";

export default function LecturerDashboard() {
  const { user, dbUser } = useAuth();
  const [theses, setTheses] = useState<ThesisData[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Review Workspace State
  const [activeWorkspace, setActiveWorkspace] = useState<{ thesis: ThesisData, role: "Advisor" | "Committee" | "Chairperson" | "ViewOnly" } | null>(null);
  const [activities, setActivities] = useState<ThesisActivity[]>([]);
  const [reviewComments, setReviewComments] = useState("");
  const [deadlineModalThesis, setDeadlineModalThesis] = useState<ThesisData | null>(null);

  // Link Submission State
  const [reviewLinks, setReviewLinks] = useState<{ type: string, url: string }[]>([
    { type: "Marked-up Manuscript", url: "" }
  ]);

  // Custom Confirm Modal State
  const [confirmDialog, setConfirmDialog] = useState<{ type: "Approve" | "Revise", message: string } | null>(null);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  // Deadline Management
  const [deadlineAdvisor, setDeadlineAdvisor] = useState("");
  const [deadlineCommittee, setDeadlineCommittee] = useState("");
  const [deadlineChairperson, setDeadlineChairperson] = useState("");
  const [savingDeadlines, setSavingDeadlines] = useState(false);

  const formatDatetimeLocal = (ts?: number | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
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

  useEffect(() => {
    if (user?.email) {
      setLoading(true);
      const unsubscribe = subscribeToThesesByLecturer(user.email, (data) => {
        setTheses(data);
        setLoading(false);

        // If a workspace is active, update the active thesis data so it reflects new state
        setActiveWorkspace(prev => {
          if (!prev) return null;
          const updatedThesis = data.find(t => t.id === prev.thesis.id);
          return updatedThesis ? { ...prev, thesis: updatedThesis } : prev;
        });
      });
      return () => unsubscribe();
    }
  }, [user]);

  const loadData = async () => {
    // Left empty for backwards compatibility with any manual reloads in the file,
    // though real-time listener handles state updates automatically now.
  };

  const openWorkspace = async (thesis: ThesisData, role: "Advisor" | "Committee" | "Chairperson" | "ViewOnly") => {
    setActiveWorkspace({ thesis, role });
    setReviewComments("");
    setReviewLinks([{ type: "Marked-up Manuscript", url: "" }]);
    setDeadlineAdvisor(formatDatetimeLocal(thesis.deadlines?.advisor));
    setDeadlineCommittee(formatDatetimeLocal(thesis.deadlines?.committee));
    setDeadlineChairperson(formatDatetimeLocal(thesis.deadlines?.chairperson));
    if (thesis.id) {
      const acts = await getThesisActivities(thesis.id);
      setActivities(acts);
    }
  };

  const handleAddLink = () => {
    setReviewLinks([...reviewLinks, { type: "Other documents", url: "" }]);
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = [...reviewLinks];
    newLinks.splice(index, 1);
    setReviewLinks(newLinks);
  };

  const handleLinkChange = (index: number, field: "type" | "url", value: string) => {
    const newLinks = [...reviewLinks];
    newLinks[index][field] = value;
    setReviewLinks(newLinks);
  };

  const triggerApprove = () => {
    if (!user?.email || !activeWorkspace?.thesis.id) return;
    setConfirmDialog({ type: "Approve", message: `Are you sure you want to approve this thesis as ${activeWorkspace.role}?` });
  };

  const triggerReject = () => {
    if (!user?.email || !activeWorkspace?.thesis.id) return;
    setConfirmDialog({ type: "Revise", message: "Are you sure you want to mark this thesis for revision? It will be returned to the student." });
  };

  const executeAction = async () => {
    if (!user?.email || !activeWorkspace?.thesis.id || !confirmDialog) return;

    // Validation
    const validLinks = reviewLinks.filter(l => l.url.trim() !== "");
    const invalidUrl = validLinks.find(l => !l.url.trim().startsWith("http"));
    if (invalidUrl) {
      setConfirmDialog(null);
      setErrorDialog("URLs must start with http:// or https://");
      return;
    }

    setActionLoading(activeWorkspace.thesis.id);
    const actionType = confirmDialog.type;
    setConfirmDialog(null); // Close the modal immediately

    try {
      if (actionType === "Approve") {
        await approveThesis(activeWorkspace.thesis.id, user.email, activeWorkspace.role as "Advisor" | "Committee" | "Chairperson", activeWorkspace.thesis);
        await logThesisActivity({
          thesisId: activeWorkspace.thesis.id,
          type: activeWorkspace.thesis.currentStage >= 3 ? "Signature Approved" : "Manuscript Approved",
          timestamp: Date.now(),
          actorEmail: user.email,
          actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
          actorRole: activeWorkspace.role,
          description: reviewComments.trim() || (activeWorkspace.thesis.currentStage >= 3 ? "Lecturer signed off on thesis." : "Lecturer approved manuscript."),
          links: validLinks
        });

        if (activeWorkspace.thesis.studentUids?.length > 0) {
          for (const sEmail of activeWorkspace.thesis.studentUids) {
            await sendNotificationEmail({
              to: sEmail,
              subject: `Thesis Approved by ${activeWorkspace.role}`,
              html: `<p>Your thesis <b>${activeWorkspace.thesis.title}</b> has been approved by your ${activeWorkspace.role} (${dbUser?.name_en || dbUser?.name_th || user.displayName || user.email}).</p><p>Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a> to view the updated status.</p>`
            });
          }
        }
      } else {
        await rejectThesis(activeWorkspace.thesis.id);
        await logThesisActivity({
          thesisId: activeWorkspace.thesis.id,
          type: activeWorkspace.thesis.currentStage >= 3 ? "Signature Refused" : "Revision Requested",
          timestamp: Date.now(),
          actorEmail: user.email,
          actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
          actorRole: activeWorkspace.role,
          description: reviewComments.trim() || "Lecturer requested revision.",
          links: validLinks
        });

        if (activeWorkspace.thesis.studentUids?.length > 0) {
          const linksHtml = validLinks.length > 0 ? `<p><b>Attachments:</b></p><ul>${validLinks.map(l => `<li><a href="${l.url}">${l.type}</a></li>`).join('')}</ul>` : "";
          for (const sEmail of activeWorkspace.thesis.studentUids) {
            await sendNotificationEmail({
              to: sEmail,
              subject: `Thesis Revision Required`,
              html: `<p>Your thesis <b>${activeWorkspace.thesis.title}</b> requires revision. Your ${activeWorkspace.role} (${dbUser?.name_en || dbUser?.name_th || user.displayName || user.email}) has requested changes.</p>${reviewComments ? `<p><b>Comments:</b> ${reviewComments}</p>` : ""}${linksHtml}<p>Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a> to propose edits.</p>`
            });
          }
        }
      }

      setActiveWorkspace(null);
      await loadData();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to ${actionType.toLowerCase()} thesis. Error: ${err.message || err}`);
    }
    setActionLoading(null);
  };

  // Helper to determine what actionable role the current user has for a given thesis
  const getActionableRoles = (t: ThesisData, email: string) => {
    const roles: ("Advisor" | "Committee" | "Chairperson")[] = [];
    if (t.lecturerUids.advisor === email && (t.status === "Pending Advisor" || t.status === "Pending Sign. Advisor")) roles.push("Advisor");
    if (t.lecturerUids.committees.includes(email) && (
      (t.status === "Pending Committee" && !(t.committeeApprovals || []).includes(email)) ||
      (t.status === "Pending Sign. Committee" && !(t.committeeSignApprovals || []).includes(email))
    )) roles.push("Committee");
    if (t.lecturerUids.chairperson === email && (t.status === "Pending Chairperson" || t.status === "Pending Sign. Chairperson")) roles.push("Chairperson");
    return roles;
  };

  const handleSaveDeadlines = async () => {
    if (!deadlineModalThesis?.id) return;
    setSavingDeadlines(true);
    try {
      const { updateThesis } = await import("@/lib/db/theses");
      const dData = {
        advisor: deadlineAdvisor ? new Date(deadlineAdvisor).getTime() : null,
        committee: deadlineCommittee ? new Date(deadlineCommittee).getTime() : null,
        chairperson: deadlineChairperson ? new Date(deadlineChairperson).getTime() : null
      };
      await updateThesis(deadlineModalThesis.id, { deadlines: dData });

      // Update local state to reflect new deadlines without needing a full reload immediately
      if (activeWorkspace?.thesis.id === deadlineModalThesis.id) {
        setActiveWorkspace(prev => prev ? { ...prev, thesis: { ...prev.thesis, deadlines: dData } } : null);
      }
      setDeadlineModalThesis(null);
      await loadData();
    } catch (err) {
      alert("Failed to update deadlines.");
    }
    setSavingDeadlines(false);
  };

  const getDeadlineDisplay = (thesis: ThesisData) => {
    if (thesis.status === "Graduate" || thesis.currentStage >= 3) return null;
    let deadline = undefined;
    let stageName = "";
    if (thesis.currentStage === 0 || thesis.status === "Revise" || thesis.status === "Preparing") {
      deadline = thesis.deadlines?.advisor;
      stageName = "Advisor";
    } else if (thesis.currentStage === 1) {
      deadline = thesis.deadlines?.committee;
      stageName = "Committee";
    } else if (thesis.currentStage === 2) {
      deadline = thesis.deadlines?.chairperson;
      stageName = "Chairperson";
    }

    if (!deadline) return null;
    const isLate = Date.now() > deadline;
    const dateStr = new Date(deadline).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });

    return (
      <div style={{ fontSize: "0.8rem", marginTop: "6px" }}>
        <span style={{ color: "#64748b" }}>Due: {dateStr} ({stageName})</span>
        {isLate && <span style={{ marginLeft: "8px", background: "#fee2e2", color: "#dc2626", padding: "2px 6px", borderRadius: "4px", fontWeight: "bold", fontSize: "0.75rem" }}>LATE</span>}
      </div>
    );
  };

  if (loading) {
    return <div className={styles.loading}>Loading your theses...</div>;
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>My Assigned Theses</h1>
      </div>

      <div className={styles.card}>
        <h2>Action Required</h2>
        <p>Theses that are currently waiting for your review and approval.</p>

        {theses.filter(t => getActionableRoles(t, user?.email || "").length > 0).length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "#C6BFA5" }}>No theses are currently waiting for your approval.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table} style={{ marginTop: "20px", minWidth: "800px" }}>
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Title</th>
                  <th style={{ width: "15%" }}>Year</th>
                  <th style={{ width: "15%" }}>Status</th>
                  <th style={{ width: "15%" }}>Role Required</th>
                  <th style={{ width: "20%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {theses.map(t => {
                  const roles = getActionableRoles(t, user?.email || "");
                  if (roles.length === 0) return null;

                  return (
                    <tr key={t.id}>
                      <td>
                        <strong>{t.title}</strong>
                        <div style={{ fontSize: "0.85rem", color: "#7A7061", marginTop: "4px" }}>{t.fieldOfStudy || "No Field of Study"}</div>
                        {getDeadlineDisplay(t)}
                      </td>
                      <td>{t.year || "-"}</td>
                      <td>
                        <span style={{ padding: "4px 8px", background: "#FDF9F1", borderRadius: "4px", fontSize: "0.85rem", border: "1px solid #D6CEB8", whiteSpace: "nowrap" }}>{getStageIcon(t.currentStage)} {t.status}</span>
                      </td>
                      <td>{roles.join(", ")}</td>
                      <td>
                        <button
                          className={styles.btnPrimary}
                          style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem", background: "#3b82f6" }}
                          onClick={() => openWorkspace(t, roles[0])}
                        >
                          Open Workspace
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2>All Assigned Theses</h2>
        <p>All theses where you are listed as an Advisor, Committee member, or Chairperson.</p>

        {theses.length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "#C6BFA5" }}>You have no assigned theses.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table} style={{ marginTop: "20px", minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={{ width: "35%" }}>Title</th>
                  <th style={{ width: "15%" }}>Year</th>
                  <th style={{ width: "20%" }}>Status</th>
                  <th style={{ width: "15%" }}>Your Roles</th>
                  <th style={{ width: "15%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {theses.map(t => {
                  const myRoles = [];
                  if (t.lecturerUids.advisor === user?.email) myRoles.push("Advisor");
                  if (t.lecturerUids.committees.includes(user?.email || "")) myRoles.push("Committee");
                  if (t.lecturerUids.chairperson === user?.email) myRoles.push("Chairperson");

                  return (
                    <tr key={t.id}>
                      <td style={{ wordBreak: "break-all" }}>
                        <strong>{t.title}</strong>
                        {getDeadlineDisplay(t)}
                        <div style={{ fontSize: "0.85rem", color: "#7A7061", marginTop: "4px" }}>{t.fieldOfStudy || "No Field of Study"}</div>
                      </td>
                      <td>{t.year || "-"}</td>
                      <td>
                        <span style={{ padding: "4px 8px", background: "#FDF9F1", borderRadius: "4px", fontSize: "0.85rem", border: "1px solid #D6CEB8", whiteSpace: "nowrap" }}>{getStageIcon(t.currentStage)} {t.status}</span>
                      </td>
                      <td>{myRoles.join(", ")}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            className={styles.btnPrimary}
                            style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem", background: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1" }}
                            onClick={() => openWorkspace(t, "ViewOnly")}
                          >
                            View Details
                          </button>
                          {t.lecturerUids.advisor === user?.email && (
                            <button
                              className={styles.btnPrimary}
                              style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem", background: "#f59e0b", color: "#fff", border: "1px solid #d97706" }}
                              onClick={() => {
                                setDeadlineAdvisor(formatDatetimeLocal(t.deadlines?.advisor));
                                setDeadlineCommittee(formatDatetimeLocal(t.deadlines?.committee));
                                setDeadlineChairperson(formatDatetimeLocal(t.deadlines?.chairperson));
                                setDeadlineModalThesis(t);
                              }}
                            >
                              Manage Deadlines
                            </button>
                          )}
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

      {/* Workspace Modal */}
      {activeWorkspace && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ background: "#FDF9F1", width: "1200px", maxWidth: "100%", height: "90vh", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>

            {/* Modal Header */}
            <div style={{ padding: "20px 30px", borderBottom: "1px solid #D6CEB8", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EBE4D1" }}>
              <div>
                <h2 style={{ margin: 0, color: "#4A4238", fontSize: "1.4rem" }}>Review Workspace</h2>
                <div style={{ fontSize: "0.9rem", color: "#7A7061", marginTop: "5px" }}>
                  <strong>{activeWorkspace.thesis.title}</strong> • {activeWorkspace.role === "ViewOnly" ? "Viewing Details" : `Reviewing as: ${activeWorkspace.role}`}
                </div>
              </div>
              <button
                onClick={() => setActiveWorkspace(null)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#4A4238" }}
              >&times;</button>
            </div>

            {/* Modal Body */}
            <div className={styles.workspaceBody}>

              {/* Left Column: Activity Log & Submissions */}
              <div className={activeWorkspace.role === "ViewOnly" ? styles.workspaceFull : styles.workspaceLeft} style={activeWorkspace.role === "ViewOnly" ? { width: "100%", borderRight: "none", padding: "30px" } : {}}>
                <h3 style={{ margin: "0 0 20px 0", color: "#4A4238" }}>Submission History</h3>

                {activities.length === 0 ? (
                  <p style={{ color: "#7A7061", fontStyle: "italic" }}>No activity recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {activities.map(act => (
                      <div key={act.id} style={{ background: "#FDF9F1", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <strong style={{ color: "#4A4238" }}>{act.type}</strong>
                          <span style={{ fontSize: "0.8rem", color: "#7A7061" }}>{new Date(act.timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "#4A4238" }}>{act.description}</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.85rem", flexDirection: "column", gap: "10px" }}>
                          <span style={{ color: "#7A7061" }}>By: {act.actorName || act.actorEmail} ({act.actorRole})</span>

                          {act.documentUrl && (
                            <a href={act.documentUrl} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                              <ExternalLink size={14} /> Download {act.documentName || "Document"}
                            </a>
                          )}

                          {act.links && act.links.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%", marginTop: "5px" }}>
                              <strong style={{ color: "#4A4238" }}>Submitted Links:</strong>
                              {act.links.map((link, idx) => (
                                <a key={idx} href={link.url} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px", background: "#fff", padding: "6px 12px", borderRadius: "6px", border: "1px solid #D6CEB8", width: "fit-content" }}>
                                  <ExternalLink size={14} /> <span>{link.type}</span>
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column: Review Tools & Deadlines */}
              <div className={styles.workspaceRight} style={activeWorkspace.role === "ViewOnly" ? { display: "none" } : {}}>

                {activeWorkspace.role !== "ViewOnly" && (
                  <>
                    <h3 style={{ margin: "0 0 20px 0", color: "#4A4238" }}>Your Review</h3>

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", color: "#4A4238", marginBottom: "8px" }}>Review Comments / Notes</label>
                      <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="Provide your feedback, requested revisions, or approval notes here..."
                        style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid #D6CEB8", minHeight: "150px", fontFamily: "inherit", background: "#fff" }}
                      />
                    </div>

                    <div style={{ marginBottom: "30px" }}>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", color: "#4A4238", marginBottom: "8px" }}>Attach Materials (Optional)</label>
                      <p style={{ fontSize: "0.85rem", color: "#7A7061", marginBottom: "10px", marginTop: 0 }}>Provide links to your marked-up manuscript or external references.</p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {reviewLinks.map((link, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", background: "#fff", padding: "10px", borderRadius: "6px", border: "1px dashed #D6CEB8" }}>
                            <select
                              value={link.type}
                              onChange={e => handleLinkChange(idx, "type", e.target.value)}
                              style={{ padding: "8px", borderRadius: "4px", border: "1px solid #C6BFA5", background: "#FDF9F1", fontSize: "0.85rem" }}
                            >
                              <option value="Marked-up Manuscript">Marked-up Manuscript</option>
                              <option value="Reference Link">Reference Link</option>
                              <option value="Other documents">Other documents</option>
                            </select>
                            <input
                              type="url"
                              placeholder="https://..."
                              value={link.url}
                              onChange={e => handleLinkChange(idx, "url", e.target.value)}
                              style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #C6BFA5", fontSize: "0.85rem" }}
                            />
                            {reviewLinks.length > 1 && (
                              <button
                                onClick={() => handleRemoveLink(idx)}
                                style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: "4px", width: "32px", height: "32px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}
                                title="Remove Link"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={handleAddLink}
                          style={{ alignSelf: "flex-start", background: "#EBE4D1", border: "1px solid #D6CEB8", color: "#4A4238", padding: "6px 12px", borderRadius: "4px", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontWeight: "bold" }}
                        >
                          <Plus size={14} /> Add another link
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: "auto" }}>
                      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          className={styles.btnPrimary}
                          style={{ flex: 1, margin: 0, background: "#10b981", fontSize: "1rem", padding: "12px" }}
                          disabled={actionLoading === activeWorkspace.thesis.id}
                          onClick={triggerApprove}
                        >
                          {actionLoading === activeWorkspace.thesis.id ? "Processing..." : (activeWorkspace.thesis.currentStage >= 3 ? "Sign & Approve" : "Approve Manuscript")}
                        </button>
                        <button
                          className={styles.btnDanger}
                          style={{ flex: 1, margin: 0, fontSize: "1rem", padding: "12px", background: "#dc2626", color: "#fff" }}
                          disabled={actionLoading === activeWorkspace.thesis.id}
                          onClick={triggerReject}
                        >
                          {actionLoading === activeWorkspace.thesis.id ? "Processing..." : (activeWorkspace.thesis.currentStage >= 3 ? "Refuse Signature / Request Revision" : "Request Revision")}
                        </button>
                      </div>
                      <p style={{ fontSize: "0.8rem", color: "#7A7061", marginTop: "10px", textAlign: "center" }}>
                        Both actions will send your comments and attached file back to the student.
                      </p>
                    </div>
                  </>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "450px", maxWidth: "100%", borderRadius: "12px", padding: "30px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 15px 0", color: "#4A4238", fontSize: "1.5rem" }}>Confirm {confirmDialog.type}</h2>
            <p style={{ color: "#7A7061", fontSize: "1.05rem", marginBottom: "30px", lineHeight: "1.5" }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: "15px", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: "12px", borderRadius: "6px", background: "#EBE4D1", border: "none", color: "#4A4238", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                style={{ flex: 1, padding: "12px", borderRadius: "6px", background: confirmDialog.type === "Approve" ? "#10b981" : "#dc2626", border: "none", color: "#fff", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}
              >
                Confirm {confirmDialog.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Deadlines Modal */}
      {deadlineModalThesis && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "450px", maxWidth: "100%", borderRadius: "12px", padding: "30px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)" }}>
            <h2 style={{ margin: "0 0 20px 0", color: "#334155", fontSize: "1.4rem" }}>Manage Deadlines</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "4px" }}>Advisor Review Deadline</label>
                <input type="datetime-local" value={deadlineAdvisor} onChange={e => setDeadlineAdvisor(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "4px" }}>Committee Review Deadline</label>
                <input type="datetime-local" value={deadlineCommittee} onChange={e => setDeadlineCommittee(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "#475569", marginBottom: "4px" }}>Chairperson Review Deadline</label>
                <input type="datetime-local" value={deadlineChairperson} onChange={e => setDeadlineChairperson(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button
                  onClick={() => setDeadlineModalThesis(null)}
                  style={{ flex: 1, padding: "12px", borderRadius: "6px", background: "#f1f5f9", border: "none", color: "#475569", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDeadlines}
                  disabled={savingDeadlines}
                  style={{ flex: 1, padding: "12px", borderRadius: "6px", background: "#3b82f6", border: "none", color: "#fff", fontSize: "1rem", fontWeight: "bold", cursor: "pointer", opacity: savingDeadlines ? 0.7 : 1 }}
                >
                  {savingDeadlines ? "Saving..." : "Save Deadlines"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Modal */}
      {errorDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "400px", maxWidth: "100%", borderRadius: "12px", padding: "30px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 15px 0", color: "#dc2626", fontSize: "1.5rem" }}>Upload Error</h2>
            <p style={{ color: "#4A4238", fontSize: "1.05rem", marginBottom: "30px", lineHeight: "1.5" }}>
              {errorDialog}
            </p>
            <button
              onClick={() => setErrorDialog(null)}
              style={{ width: "100%", padding: "12px", borderRadius: "6px", background: "#EBE4D1", border: "none", color: "#4A4238", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
