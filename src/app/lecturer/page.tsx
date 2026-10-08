"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "./lecturer.module.css";
import { 
  getThesesByLecturer, 
  subscribeToThesesByLecturer, 
  approveThesis, 
  rejectThesis, 
  ThesisData, 
  getThesisActivities, 
  ThesisActivity, 
  logThesisActivity, 
  getDisplayStatus 
} from "@/lib/db/theses";
import { getCommentTemplates } from "@/lib/db/settings";
import { sendNotificationEmail } from "@/lib/actions/email";
import { getAllUsers } from "@/lib/db/users";
import { getGroups } from "@/lib/db/groups";
import { Bell, ExternalLink, Plus, X, Search, CheckCircle2, AlertCircle, FileEdit, Clock, BookOpen } from "lucide-react";
import ImportantNoteModal from "@/components/ImportantNoteModal";

export default function LecturerDashboard() {
  const { user, dbUser } = useAuth();
  const [theses, setTheses] = useState<ThesisData[]>([]);
  const [userMap, setUserMap] = useState<Record<string, string>>({});
  const [groupMap, setGroupMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Search & filter for All Assigned Theses
  const [assignedSearch, setAssignedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Review Workspace State
  const [activeWorkspace, setActiveWorkspace] = useState<{ thesis: ThesisData, role: string } | null>(null);
  const [activities, setActivities] = useState<ThesisActivity[]>([]);
  const [reviewComments, setReviewComments] = useState("");
  const [deadlineModalThesis, setDeadlineModalThesis] = useState<ThesisData | null>(null);

  // Abstract & Scope Edit State
  const [topicReviewThesis, setTopicReviewThesis] = useState<ThesisData | null>(null);
  const [topicReviewActionLoading, setTopicReviewActionLoading] = useState(false);

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

  const [commentTemplates, setCommentTemplates] = useState<string[]>([]);
  const [showTemplatesDropdown, setShowTemplatesDropdown] = useState(false);

  // Important Note Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [selectedNoteField, setSelectedNoteField] = useState<string>("");

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
    getAllUsers().then(users => {
      const map: Record<string, string> = {};
      users.forEach(u => map[u.email] = u.name_th || u.name_en || u.email);
      setUserMap(map);
    }).catch(console.error);

    getGroups().then(groups => {
      const map: Record<string, string> = {};
      groups.forEach(g => {
        if (g.id) map[g.id] = g.name;
      });
      setGroupMap(map);
    }).catch(console.error);

    getCommentTemplates().then(templates => {
      setCommentTemplates(templates);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (user?.email) {
      setLoading(true);
      const unsubscribe = subscribeToThesesByLecturer(user.email, (data) => {
        setTheses(data);
        setLoading(false);

        setActiveWorkspace(prev => {
          if (!prev) return null;
          const updatedThesis = data.find(t => t.id === prev.thesis.id);
          return updatedThesis ? { ...prev, thesis: updatedThesis } : prev;
        });
      });
      return () => unsubscribe();
    }
  }, [user]);

  const loadData = async () => {};

  const openWorkspace = async (thesis: ThesisData, role: string) => {
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

  const validateLinksBeforeAction = () => {
    const validLinks = reviewLinks.filter(l => l.url.trim() !== "");
    if (validLinks.length === 0) {
      setErrorDialog("Please provide at least one valid URL for your review materials.");
      return false;
    }
    const invalidUrl = validLinks.find(l => !l.url.trim().startsWith("http"));
    if (invalidUrl) {
      setErrorDialog("URLs must start with http:// or https://");
      return false;
    }
    return true;
  };

  const triggerApprove = () => {
    if (!user?.email || !activeWorkspace?.thesis.id) return;
    if (activeWorkspace.role !== "Equipment Checker" && !validateLinksBeforeAction()) return;
    setConfirmDialog({ type: "Approve", message: `Are you sure you want to approve this thesis as ${activeWorkspace.role}?` });
  };

  const triggerReject = () => {
    if (!user?.email || !activeWorkspace?.thesis.id) return;
    if (activeWorkspace.role !== "Equipment Checker" && !validateLinksBeforeAction()) return;
    setConfirmDialog({ type: "Revise", message: activeWorkspace.role === "Equipment Checker" ? "Are you sure you want to reject this equipment check request?" : "Are you sure you want to mark this thesis for revision? It will be returned to the student." });
  };

  const executeAction = async () => {
    if (!user?.email || !activeWorkspace?.thesis.id || !confirmDialog) return;

    let validLinks: any[] = [];
    if (activeWorkspace.role !== "Equipment Checker") {
      validLinks = reviewLinks.filter(l => l.url.trim() !== "");
      if (validLinks.length === 0) {
        setConfirmDialog(null);
        setErrorDialog("Please provide at least one valid URL for your review materials.");
        return;
      }
      const invalidUrl = validLinks.find(l => !l.url.trim().startsWith("http"));
      if (invalidUrl) {
        setConfirmDialog(null);
        setErrorDialog("URLs must start with http:// or https://");
        return;
      }
    }

    setActionLoading(activeWorkspace.thesis.id);
    const actionType = confirmDialog.type;
    setConfirmDialog(null);

    try {
      if (actionType === "Approve") {
        if (activeWorkspace.role === "Equipment Checker") {
          const { approveEquipmentCheck } = await import("@/lib/db/theses");
          await approveEquipmentCheck(activeWorkspace.thesis.id);
          await logThesisActivity({
            thesisId: activeWorkspace.thesis.id,
            type: "Equipment Check Approved",
            timestamp: Date.now(),
            actorEmail: user.email,
            actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
            actorRole: "Equipment Checker",
            description: "Lecturer approved equipment check."
          });
          if (activeWorkspace.thesis.studentUids?.length > 0) {
            for (const sEmail of activeWorkspace.thesis.studentUids) {
              await sendNotificationEmail({
                to: sEmail,
                subject: `Equipment Check Approved`,
                html: `<p>Your equipment check for <b>${activeWorkspace.thesis.title}</b> has been approved.</p><p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to continue submitting your materials.</p>`
              });
            }
          }
        } else {
          await approveThesis(activeWorkspace.thesis.id, user.email, activeWorkspace.role, activeWorkspace.thesis);
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
                html: `<p>Your thesis <b>${activeWorkspace.thesis.title}</b> has been approved by your ${activeWorkspace.role} (${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}).</p><p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to view the updated status.</p>`
              });
            }
          }
        }
      } else {
        if (activeWorkspace.role === "Equipment Checker") {
          const { rejectEquipmentCheck } = await import("@/lib/db/theses");
          await rejectEquipmentCheck(activeWorkspace.thesis.id);
          await logThesisActivity({
            thesisId: activeWorkspace.thesis.id,
            type: "Equipment Check Rejected",
            timestamp: Date.now(),
            actorEmail: user.email,
            actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
            actorRole: "Equipment Checker",
            description: reviewComments.trim() ? `Equipment check was rejected.\n\nReason: ${reviewComments.trim()}` : "Equipment check was rejected."
          });
          if (activeWorkspace.thesis.studentUids?.length > 0) {
            for (const sEmail of activeWorkspace.thesis.studentUids) {
              await sendNotificationEmail({
                to: sEmail,
                subject: `Equipment Check Rejected: ${activeWorkspace.thesis.title}`,
                html: `<p>Your equipment check request for <b>${activeWorkspace.thesis.title}</b> was rejected by your Equipment Checker (${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}).</p>${reviewComments.trim() ? `<p><b>Reason:</b><br/>${reviewComments.trim().replace(/\n/g, '<br/>')}</p>` : ""}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to re-request after resolving any issues.</p>`
              });
            }
          }
        } else {
          await rejectThesis(activeWorkspace.thesis.id);
          await logThesisActivity({
            thesisId: activeWorkspace.thesis.id,
            type: activeWorkspace.thesis.currentStage >= 3 ? "Signature Refused / Revision Requested" : "Revision Requested",
            timestamp: Date.now(),
            actorEmail: user.email,
            actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
            actorRole: activeWorkspace.role,
            description: reviewComments.trim() || (activeWorkspace.thesis.currentStage >= 3 ? "Lecturer refused signature and requested revision." : "Lecturer requested revision."),
            links: validLinks
          });

          if (activeWorkspace.thesis.studentUids?.length > 0) {
            const linksHtml = validLinks.length > 0 ? `<p><b>Feedback & Marked-up Attachments:</b></p><ul>${validLinks.map(l => `<li><a href="${l.url}">${l.type}</a></li>`).join('')}</ul>` : "";
            for (const sEmail of activeWorkspace.thesis.studentUids) {
              await sendNotificationEmail({
                to: sEmail,
                subject: `Revision Requested for: ${activeWorkspace.thesis.title}`,
                html: `<p>Your ${activeWorkspace.role} (${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}) has requested revisions for <b>${activeWorkspace.thesis.title}</b>.</p><p><b>Comments:</b> ${reviewComments || "Please review attached notes."}</p>${linksHtml}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to upload your revisions.</p>`
              });
            }
          }
        }
      }

      await loadData();
      setActiveWorkspace(null);
    } catch (err: any) {
      console.error(err);
      setErrorDialog("Failed to perform action: " + err.message);
    }
    setActionLoading(null);
  };

  const getActionableRoles = (t: ThesisData, email: string) => {
    const roles: string[] = [];
    if (t.lecturerUids.advisor === email && (t.status === "Pending Advisor" || t.status === "Pending Sign. Advisor")) roles.push("Advisor");
    const commIdx = t.lecturerUids.committees.indexOf(email);
    if (commIdx !== -1 && (
      (t.status === "Pending Committee" && !(t.committeeApprovals || []).includes(email)) ||
      (t.status === "Pending Sign. Committee" && !(t.committeeSignApprovals || []).includes(email))
    )) {
      if (t.lecturerUids.committees.length > 1) {
        roles.push(`Committee #${commIdx + 1}`);
      } else {
        roles.push("Committee");
      }
    }
    if (t.lecturerUids.chairperson === email && (t.status === "Pending Chairperson" || t.status === "Pending Sign. Chairperson")) roles.push("Chairperson");
    if (t.equipmentChecker === email && t.equipmentCheckStatus === "Requested") roles.push("Equipment Checker");
    
    return roles as any[];
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

  const handleApproveTopicEdits = async () => {
    if (!topicReviewThesis || !topicReviewThesis.id || !user?.email) return;
    setTopicReviewActionLoading(true);
    try {
      const { approveTopicEdits } = await import("@/lib/db/theses");
      await approveTopicEdits(topicReviewThesis.id, topicReviewThesis.pendingAbstract || "", topicReviewThesis.pendingScope || "");

      await logThesisActivity({
        thesisId: topicReviewThesis.id,
        type: "Abstract & Scope Edits Approved",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Advisor",
        description: "Advisor approved the proposed abstract and scope."
      });

      if (topicReviewThesis.studentUids?.length > 0) {
        for (const sEmail of topicReviewThesis.studentUids) {
          await sendNotificationEmail({
            to: sEmail,
            subject: `Abstract & Scope Edits Approved: ${topicReviewThesis.title}`,
            html: `<p>Your proposed Abstract & Scope edits for <b>${topicReviewThesis.title}</b> have been approved by your Advisor.</p><p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a>.</p>`
          });
        }
      }
      setTopicReviewThesis(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to approve edits: ${err.message}`);
    }
    setTopicReviewActionLoading(false);
  };

  const handleRejectTopicEdits = async () => {
    if (!topicReviewThesis || !topicReviewThesis.id || !user?.email) return;
    setTopicReviewActionLoading(true);
    try {
      const { rejectTopicEdits } = await import("@/lib/db/theses");
      await rejectTopicEdits(topicReviewThesis.id);

      await logThesisActivity({
        thesisId: topicReviewThesis.id,
        type: "Abstract & Scope Edits Rejected",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Advisor",
        description: "Advisor rejected the proposed abstract and scope."
      });

      if (topicReviewThesis.studentUids?.length > 0) {
        for (const sEmail of topicReviewThesis.studentUids) {
          await sendNotificationEmail({
            to: sEmail,
            subject: `Abstract & Scope Edits Rejected: ${topicReviewThesis.title}`,
            html: `<p>Your proposed Abstract & Scope edits for <b>${topicReviewThesis.title}</b> have been rejected by your Advisor.</p><p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to review.</p>`
          });
        }
      }
      setTopicReviewThesis(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to reject edits: ${err.message}`);
    }
    setTopicReviewActionLoading(false);
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
      <div style={{ fontSize: "0.78rem", marginTop: "4px" }}>
        <span style={{ color: "var(--text-light)" }}>Due: {dateStr} ({stageName})</span>
        {isLate && <span style={{ marginLeft: "6px", background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)", padding: "1px 6px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "0.72rem" }}>LATE</span>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading your assigned theses...</span>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: 0 }}>Faculty Workspace</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Review submissions, sign milestones, and manage deadlines</p>
        </div>
        <button 
          onClick={() => {
            setSelectedNoteField(dbUser?.fieldOfStudy || (theses.find(t => t.fieldOfStudy)?.fieldOfStudy) || "");
            setIsNoteModalOpen(true);
          }}
          className={styles.btnDanger}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Bell size={16} />
          Important Note
        </button>
      </div>

      {/* Action Required Card */}
      <div className={styles.card}>
        <h2>Action Required ({theses.filter(t => getActionableRoles(t, user?.email || "").length > 0).length})</h2>
        <p>Theses that are actively waiting for your approval or signature.</p>

        {theses.filter(t => getActionableRoles(t, user?.email || "").length > 0).length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", color: "var(--text-light)", fontStyle: "italic", fontSize: "0.92rem" }}>
            🎉 No theses are currently waiting for your approval.
          </div>
        ) : (
          <div className={styles.tableResponsive} style={{ marginTop: "16px" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: "38%" }}>Thesis Project</th>
                  <th style={{ width: "12%" }}>Year</th>
                  <th style={{ width: "20%" }}>Status</th>
                  <th style={{ width: "15%" }}>Role Required</th>
                  <th style={{ width: "15%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {theses.map(t => {
                  const roles = getActionableRoles(t, user?.email || "");
                  if (roles.length === 0) return null;

                  return (
                    <tr key={t.id}>
                      <td>
                        <strong style={{ color: "var(--text-main)", fontSize: "0.92rem" }}>{t.title}</strong>
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>{t.fieldOfStudy || "No Field"}</div>
                        {getDeadlineDisplay(t)}
                      </td>
                      <td>{t.year || "-"}</td>
                      <td>
                        <span style={{ padding: "3px 10px", background: "var(--primary-light)", borderRadius: "var(--radius-full)", fontSize: "0.8rem", color: "var(--primary-color)", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {getStageIcon(t.currentStage)} {getDisplayStatus(t)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--text-main)", fontSize: "0.88rem" }}>{roles.join(", ")}</span>
                      </td>
                      <td>
                        <button
                          className={styles.btnPrimary}
                          style={{ padding: "6px 14px", fontSize: "0.82rem" }}
                          onClick={() => openWorkspace(t, roles[0])}
                        >
                          Review
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

      {/* Abstract & Scope Proposals Card */}
      <div className={styles.card}>
        <h2>Abstract & Scope Edit Proposals</h2>
        <p>Theses where the student group has submitted proposed changes to the project abstract or scope.</p>

        {theses.filter(t => t.lecturerUids.advisor === user?.email && (t.pendingAbstract || t.pendingScope)).length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: "var(--text-light)", fontStyle: "italic", fontSize: "0.9rem" }}>
            No pending topic edit requests.
          </div>
        ) : (
          <div className={styles.tableResponsive} style={{ marginTop: "16px" }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: "45%" }}>Thesis Project</th>
                  <th style={{ width: "15%" }}>Year</th>
                  <th style={{ width: "22%" }}>Status</th>
                  <th style={{ width: "18%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {theses.filter(t => t.lecturerUids.advisor === user?.email && (t.pendingAbstract || t.pendingScope)).map(t => (
                  <tr key={`topic-${t.id}`}>
                    <td>
                      <strong style={{ color: "var(--text-main)", fontSize: "0.92rem" }}>{t.title}</strong>
                      <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>{t.fieldOfStudy || "No Field"}</div>
                    </td>
                    <td>{t.year || "-"}</td>
                    <td>
                      <span style={{ padding: "3px 10px", background: "var(--warning-bg)", color: "var(--warning-text)", borderRadius: "var(--radius-full)", fontSize: "0.78rem", border: "1px solid var(--warning-border)", fontWeight: 600 }}>
                        Pending Topic Changes
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.btnSecondary}
                        style={{ padding: "5px 12px", fontSize: "0.82rem" }}
                        onClick={() => setTopicReviewThesis(t)}
                      >
                        <FileEdit size={14} /> Review Edits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* All Assigned Theses Card */}
      <div className={styles.card}>
        <h2>All Assigned Theses</h2>
        <p>Complete index of projects where you are assigned as an Advisor, Committee member, or Chairperson.</p>

        {theses.length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "var(--text-light)" }}>You have no assigned theses.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginTop: "16px", marginBottom: "16px" }}>
              <div style={{ position: "relative", width: "320px", maxWidth: "100%" }}>
                <input
                  type="text"
                  placeholder="Search title, group, year..."
                  value={assignedSearch}
                  onChange={e => setAssignedSearch(e.target.value)}
                  style={{ padding: "8px 12px 8px 34px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", background: "#fff", color: "var(--text-main)", width: "100%", fontFamily: "inherit", outline: "none", fontSize: "0.88rem" }}
                />
                <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
              </div>

              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", background: "#fff", color: "var(--text-main)", width: "180px", fontFamily: "inherit", outline: "none", fontSize: "0.88rem" }}
              >
                <option value="">All Roles</option>
                <option value="Advisor">Advisor</option>
                <option value="Committee">Committee</option>
                <option value="Chairperson">Chairperson</option>
              </select>
            </div>

            <div className={styles.tableResponsive}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: "32%" }}>Title</th>
                    <th style={{ width: "16%" }}>Group</th>
                    <th style={{ width: "10%" }}>Year</th>
                    <th style={{ width: "16%" }}>Status</th>
                    <th style={{ width: "14%" }}>Your Roles</th>
                    <th style={{ width: "12%" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {theses
                    .filter(t => {
                      const myRoles: string[] = [];
                      if (t.lecturerUids.advisor === user?.email) myRoles.push("Advisor");
                      if (t.lecturerUids.committees.includes(user?.email || "")) myRoles.push("Committee");
                      if (t.lecturerUids.chairperson === user?.email) myRoles.push("Chairperson");

                      if (roleFilter && !myRoles.includes(roleFilter)) return false;

                      if (assignedSearch) {
                        const searchLower = assignedSearch.toLowerCase();
                        const groupName = groupMap[t.groupId] || "";
                        const matchesTitle = t.title.toLowerCase().includes(searchLower);
                        const matchesGroup = groupName.toLowerCase().includes(searchLower);
                        const matchesYear = (t.year || "").toLowerCase().includes(searchLower);

                        if (!matchesTitle && !matchesGroup && !matchesYear) return false;
                      }

                      return true;
                    })
                    .map(t => {
                      const myRoles = [];
                      if (t.lecturerUids.advisor === user?.email) myRoles.push("Advisor");
                      if (t.lecturerUids.committees.includes(user?.email || "")) myRoles.push("Committee");
                      if (t.lecturerUids.chairperson === user?.email) myRoles.push("Chairperson");

                      const groupName = groupMap[t.groupId] || "-";

                      return (
                        <tr key={t.id}>
                          <td>
                            <strong style={{ color: "var(--text-main)", fontSize: "0.9rem" }}>{t.title}</strong>
                            {getDeadlineDisplay(t)}
                            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "2px" }}>{t.fieldOfStudy || "No Field"}</div>
                          </td>
                          <td>{groupName}</td>
                          <td>{t.year || "-"}</td>
                          <td>
                            <span style={{ padding: "3px 8px", background: "var(--primary-lighter)", borderRadius: "var(--radius-full)", fontSize: "0.8rem", color: "var(--primary-color)", fontWeight: 600 }}>
                              {getStageIcon(t.currentStage)} {getDisplayStatus(t)}
                            </span>
                          </td>
                          <td style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>{myRoles.join(", ")}</td>
                          <td>
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className={styles.btnSecondary}
                                style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                                onClick={() => openWorkspace(t, "ViewOnly")}
                              >
                                Details
                              </button>
                              {t.lecturerUids.advisor === user?.email && (
                                <button
                                  className={styles.btnSecondary}
                                  style={{ padding: "4px 8px", fontSize: "0.8rem" }}
                                  title="Manage Deadlines"
                                  onClick={() => {
                                    setDeadlineAdvisor(formatDatetimeLocal(t.deadlines?.advisor));
                                    setDeadlineCommittee(formatDatetimeLocal(t.deadlines?.committee));
                                    setDeadlineChairperson(formatDatetimeLocal(t.deadlines?.chairperson));
                                    setDeadlineModalThesis(t);
                                  }}
                                >
                                  <Clock size={13} />
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
          </>
        )}
      </div>

      {/* Review Workspace Modal */}
      {activeWorkspace && (
        <div className={styles.modalOverlay} onClick={() => setActiveWorkspace(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "1150px", height: "88vh", padding: 0, display: "flex", flexDirection: "column" }}>

            {/* Modal Header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--primary-light)", color: "var(--primary-color)" }}>
              <div>
                <h2 style={{ margin: 0, color: "var(--primary-color)", fontSize: "1.15rem", fontWeight: 700 }}>Review Workspace</h2>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  <strong style={{ color: "var(--text-main)" }}>{activeWorkspace.thesis.title}</strong> · {activeWorkspace.role === "ViewOnly" ? "Viewing Details" : `Reviewing as: ${activeWorkspace.role}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  onClick={() => {
                    setSelectedNoteField(activeWorkspace.thesis.fieldOfStudy || dbUser?.fieldOfStudy || "");
                    setIsNoteModalOpen(true);
                  }}
                  className={styles.btnDanger}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", fontSize: "0.82rem" }}
                >
                  <Bell size={14} />
                  Important Note
                </button>
                <button
                  onClick={() => setActiveWorkspace(null)}
                  className={styles.modalClose}
                  style={{ float: "none", fontSize: "1.3rem" }}
                >&times;</button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={styles.workspaceBody}>

              {/* Left Column: Activity Log & Submissions */}
              <div className={activeWorkspace.role === "ViewOnly" ? styles.workspaceFull : styles.workspaceLeft} style={activeWorkspace.role === "ViewOnly" ? { width: "100%", borderRight: "none", padding: "28px", overflowY: "auto" } : {}}>
                {activeWorkspace.role === "ViewOnly" && (
                  <div style={{ marginBottom: "32px" }}>
                    <h3 style={{ margin: "0 0 14px 0", color: "var(--text-main)", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", fontWeight: 700, fontSize: "1.1rem" }}>Thesis Details</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", marginBottom: "18px" }}>
                      <div style={{ flex: "1 1 240px" }}>
                        <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Title</strong>
                        <div style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "1rem" }}>{activeWorkspace.thesis.title}</div>
                      </div>
                      <div style={{ flex: "1 1 240px" }}>
                        <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "2px" }}>Status</strong>
                        <div style={{ color: "var(--primary-color)", fontWeight: 700, fontSize: "0.92rem" }}>{getStageIcon(activeWorkspace.thesis.currentStage)} {getDisplayStatus(activeWorkspace.thesis)}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Abstract</strong>
                      <div style={{ color: "var(--text-main)", whiteSpace: "pre-wrap", background: "var(--bg-subtle)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", lineHeight: 1.6, fontSize: "0.9rem" }}>{activeWorkspace.thesis.abstract || "No abstract provided."}</div>
                    </div>

                    <div style={{ marginBottom: "16px" }}>
                      <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Scope</strong>
                      <div style={{ color: "var(--text-main)", whiteSpace: "pre-wrap", background: "var(--bg-subtle)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", lineHeight: 1.6, fontSize: "0.9rem" }}>{activeWorkspace.thesis.scope || "No scope provided."}</div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                      <div style={{ flex: "1 1 240px" }}>
                        <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Student Members</strong>
                        {activeWorkspace.thesis.studentUids?.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--text-main)", fontSize: "0.88rem" }}>
                            {activeWorkspace.thesis.studentUids.map(uid => <li key={uid}>{userMap[uid] || uid}</li>)}
                          </ul>
                        ) : <div style={{ color: "var(--text-muted)", fontSize: "0.88rem" }}>None</div>}
                      </div>
                      <div style={{ flex: "1 1 240px" }}>
                        <strong style={{ display: "block", color: "var(--text-light)", fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Faculty Committee</strong>
                        <ul style={{ margin: 0, paddingLeft: "18px", color: "var(--text-main)", fontSize: "0.88rem" }}>
                          <li><strong>Advisor:</strong> {userMap[activeWorkspace.thesis.lecturerUids.advisor] || activeWorkspace.thesis.lecturerUids.advisor || "None"}</li>
                          <li><strong>Chairperson:</strong> {userMap[activeWorkspace.thesis.lecturerUids.chairperson] || activeWorkspace.thesis.lecturerUids.chairperson || "None"}</li>
                          {activeWorkspace.thesis.lecturerUids.committees?.length > 0 && (
                            <li><strong>Committees:</strong>
                              <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px" }}>
                                {activeWorkspace.thesis.lecturerUids.committees.map((c, idx) => <li key={c}>{activeWorkspace.thesis.lecturerUids.committees.length > 1 ? `#${idx + 1}: ` : ""}{userMap[c] || c}</li>)}
                              </ul>
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <h3 style={{ margin: "0 0 16px 0", color: "var(--text-main)", fontWeight: 700, fontSize: "1.05rem" }}>Submission History & Audit Trail</h3>

                {activities.length === 0 ? (
                  <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>No activity recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {activities.map(act => (
                      <div key={act.id} style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <strong style={{ color: "var(--text-main)", fontSize: "0.88rem" }}>{act.type}</strong>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-light)" }}>{new Date(act.timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: "0 0 8px 0", fontSize: "0.88rem", color: "var(--text-main)", lineHeight: 1.5 }}>{act.description}</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.8rem", flexDirection: "column", gap: "6px" }}>
                          <span style={{ color: "var(--text-muted)" }}>By: {act.actorName || act.actorEmail} ({act.actorRole})</span>

                          {act.links && act.links.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", width: "100%", marginTop: "4px" }}>
                              {act.links.map((link, idx) => (
                                <a key={idx} href={link.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary-color)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "5px", background: "#ffffff", padding: "4px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.8rem" }}>
                                  <ExternalLink size={12} /> <span>{link.type}</span>
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

              {/* Right Column: Review Tools */}
              <div className={styles.workspaceRight} style={activeWorkspace.role === "ViewOnly" ? { display: "none" } : {}}>

                {activeWorkspace.role !== "ViewOnly" && activeWorkspace.role !== "Equipment Checker" && (
                  <>
                    <h3 style={{ margin: "0 0 16px 0", color: "var(--text-main)", fontWeight: 700, fontSize: "1.05rem" }}>Review & Feedback</h3>

                    <div style={{ marginBottom: "16px" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>Comments & Feedback</label>
                      <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="Provide your feedback, revision requests, or remarks..."
                        style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", minHeight: "130px", fontFamily: "inherit", background: "#fff", outline: "none", color: "var(--text-main)", fontSize: "0.88rem" }}
                      />
                      {commentTemplates.length > 0 && (
                        <div style={{ marginTop: "8px", position: "relative" }}>
                          <button
                            onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                            className={styles.btnSecondary}
                            style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                          >
                            Quick Feedback Sentence ▾
                          </button>
                          {showTemplatesDropdown && (
                            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "4px", background: "#fff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", zIndex: 10, minWidth: "300px", maxHeight: "180px", overflowY: "auto" }}>
                              {commentTemplates.map((template, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setReviewComments(prev => prev ? `${prev}\n${template}` : template);
                                    setShowTemplatesDropdown(false);
                                  }}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", border: "none", borderBottom: idx < commentTemplates.length - 1 ? "1px solid var(--border-subtle)" : "none", background: "transparent", cursor: "pointer", fontSize: "0.82rem", color: "var(--text-main)", fontFamily: "inherit" }}
                                  onMouseOver={e => e.currentTarget.style.background = "var(--primary-lighter)"}
                                  onMouseOut={e => e.currentTarget.style.background = "transparent"}
                                >
                                  {template}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: "24px" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px" }}>Attach Marked-up Materials</label>
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "8px", marginTop: 0 }}>Provide at least one external cloud link to your marked-up manuscript.</p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {reviewLinks.map((link, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "6px", alignItems: "center", background: "#fff", padding: "8px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)" }}>
                            <select
                              value={link.type}
                              onChange={e => handleLinkChange(idx, "type", e.target.value)}
                              style={{ padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "var(--bg-subtle)", fontSize: "0.8rem", fontFamily: "inherit", color: "var(--text-main)", outline: "none" }}
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
                              style={{ flex: 1, padding: "6px 8px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.8rem", outline: "none", fontFamily: "inherit" }}
                            />
                            {reviewLinks.length > 1 && (
                              <button
                                onClick={() => handleRemoveLink(idx)}
                                style={{ background: "var(--danger-bg)", color: "var(--danger-color)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-sm)", width: "26px", height: "26px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}
                                title="Remove"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        ))}

                        <button
                          onClick={handleAddLink}
                          className={styles.btnSecondary}
                          style={{ alignSelf: "flex-start", padding: "4px 10px", fontSize: "0.78rem" }}
                        >
                          <Plus size={12} /> Add link
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: "auto", paddingTop: "14px", borderTop: "1px solid var(--border-color)" }}>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          className={styles.btnPrimary}
                          style={{ flex: 1, padding: "10px", fontSize: "0.92rem", background: "var(--success-color)" }}
                          disabled={actionLoading === activeWorkspace.thesis.id}
                          onClick={triggerApprove}
                        >
                          {actionLoading === activeWorkspace.thesis.id ? "Processing..." : (activeWorkspace.thesis.currentStage >= 3 ? "Sign & Approve" : "Approve Manuscript")}
                        </button>
                        <button
                          className={styles.btnDanger}
                          style={{ flex: 1, padding: "10px", fontSize: "0.92rem" }}
                          disabled={actionLoading === activeWorkspace.thesis.id}
                          onClick={triggerReject}
                        >
                          {actionLoading === activeWorkspace.thesis.id ? "Processing..." : (activeWorkspace.thesis.currentStage >= 3 ? "Refuse Signature" : "Request Revision")}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {activeWorkspace.role === "Equipment Checker" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", alignItems: "center", textAlign: "center", background: "#fff", padding: "24px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
                    <h3 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontWeight: 700, fontSize: "1.1rem" }}>Equipment Clearance Request</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "20px", fontSize: "0.88rem", lineHeight: 1.5 }}>The student group has submitted a clearance request for borrowed laboratory equipment.</p>
                    
                    <div style={{ width: "100%", marginBottom: "20px", textAlign: "left" }}>
                      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>Remarks</label>
                      <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="Provide your feedback or reason for rejection..."
                        style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", minHeight: "90px", fontFamily: "inherit", background: "#fff", outline: "none", color: "var(--text-main)", fontSize: "0.88rem" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                      <button
                        className={styles.btnPrimary}
                        style={{ flex: 1, padding: "10px", background: "var(--success-color)" }}
                        disabled={actionLoading === activeWorkspace.thesis.id}
                        onClick={triggerApprove}
                      >
                        {actionLoading === activeWorkspace.thesis.id ? "Processing..." : "Approve Clearance"}
                      </button>
                      <button
                        className={styles.btnDanger}
                        style={{ flex: 1, padding: "10px" }}
                        disabled={actionLoading === activeWorkspace.thesis.id}
                        onClick={triggerReject}
                      >
                        {actionLoading === activeWorkspace.thesis.id ? "Processing..." : "Reject"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmDialog && (
        <div className={styles.modalOverlay} onClick={() => setConfirmDialog(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "420px", textAlign: "center", padding: "28px" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "1.25rem", fontWeight: 700 }}>Confirm {confirmDialog.type}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.92rem", marginBottom: "24px", lineHeight: 1.55 }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDialog(null)}
                className={styles.btnSecondary}
                style={{ flex: 1, padding: "10px" }}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                className={confirmDialog.type === "Approve" ? styles.btnPrimary : styles.btnDanger}
                style={{ flex: 1, padding: "10px", ...(confirmDialog.type === "Approve" ? { background: "var(--success-color)" } : {}) }}
              >
                Confirm {confirmDialog.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Deadlines Modal */}
      {deadlineModalThesis && (
        <div className={styles.modalOverlay} onClick={() => setDeadlineModalThesis(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "440px", padding: "28px" }}>
            <h2 style={{ margin: "0 0 18px 0", color: "var(--text-main)", fontSize: "1.2rem", fontWeight: 700 }}>Manage Stage Deadlines</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Advisor Review Deadline</label>
                <input type="datetime-local" value={deadlineAdvisor} onChange={e => setDeadlineAdvisor(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none", fontSize: "0.88rem" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Committee Review Deadline</label>
                <input type="datetime-local" value={deadlineCommittee} onChange={e => setDeadlineCommittee(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none", fontSize: "0.88rem" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>Chairperson Review Deadline</label>
                <input type="datetime-local" value={deadlineChairperson} onChange={e => setDeadlineChairperson(e.target.value)} style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none", fontSize: "0.88rem" }} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <button
                  onClick={() => setDeadlineModalThesis(null)}
                  className={styles.btnSecondary}
                  style={{ flex: 1, padding: "10px" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDeadlines}
                  disabled={savingDeadlines}
                  className={styles.btnPrimary}
                  style={{ flex: 1, padding: "10px" }}
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
        <div className={styles.modalOverlay} onClick={() => setErrorDialog(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "400px", borderRadius: "var(--radius-xl)", padding: "28px", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--danger-color)", fontSize: "1.25rem", fontWeight: 700 }}>Notice</h2>
            <p style={{ color: "var(--text-main)", fontSize: "0.92rem", marginBottom: "22px", lineHeight: 1.5 }}>
              {errorDialog}
            </p>
            <button
              onClick={() => setErrorDialog(null)}
              className={styles.btnPrimary}
              style={{ width: "100%", padding: "10px" }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Abstract & Scope Edit Review Modal */}
      {topicReviewThesis && (
        <div className={styles.modalOverlay} onClick={() => setTopicReviewThesis(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "860px" }}>
            <div style={{ padding: "0 0 16px 0", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h2 style={{ margin: 0, color: "var(--text-main)", fontSize: "1.25rem", fontWeight: 700 }}>Review Abstract & Scope Edits</h2>
                <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "2px" }}>
                  <strong>{topicReviewThesis.title}</strong>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => setTopicReviewThesis(null)}>&times;</button>
            </div>

            <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "60vh", overflowY: "auto" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ flex: "1 1 300px", background: "var(--bg-subtle)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>Current Abstract</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", color: "var(--text-main)", margin: 0, lineHeight: 1.6 }}>{topicReviewThesis.abstract || "No abstract provided."}</p>
                </div>
                <div style={{ flex: "1 1 300px", background: "var(--primary-light)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--primary-border)" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "var(--primary-color)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Proposed Abstract</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", color: "var(--text-main)", margin: 0, lineHeight: 1.6 }}>{topicReviewThesis.pendingAbstract || "No abstract provided."}</p>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                <div style={{ flex: "1 1 300px", background: "var(--bg-subtle)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "var(--text-muted)", fontSize: "0.85rem", fontWeight: 600, textTransform: "uppercase" }}>Current Scope</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", color: "var(--text-main)", margin: 0, lineHeight: 1.6 }}>{topicReviewThesis.scope || "No scope provided."}</p>
                </div>
                <div style={{ flex: "1 1 300px", background: "var(--primary-light)", padding: "14px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--primary-border)" }}>
                  <h3 style={{ margin: "0 0 8px 0", color: "var(--primary-color)", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase" }}>Proposed Scope</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.88rem", color: "var(--text-main)", margin: 0, lineHeight: 1.6 }}>{topicReviewThesis.pendingScope || "No scope provided."}</p>
                </div>
              </div>
            </div>

            <div style={{ padding: "16px 0 0 0", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                className={styles.btnDanger}
                onClick={handleRejectTopicEdits}
                disabled={topicReviewActionLoading}
              >
                {topicReviewActionLoading ? "Processing..." : "Reject Edits"}
              </button>
              <button
                className={styles.btnPrimary}
                onClick={handleApproveTopicEdits}
                disabled={topicReviewActionLoading}
              >
                {topicReviewActionLoading ? "Processing..." : "Approve Edits"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Important Note Modal */}
      <ImportantNoteModal 
        isOpen={isNoteModalOpen} 
        onClose={() => setIsNoteModalOpen(false)} 
        fieldOfStudy={selectedNoteField}
        showFieldSelect={true}
      />
    </div>
  );
}
