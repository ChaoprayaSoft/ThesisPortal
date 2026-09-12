"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import styles from "./lecturer.module.css";
import { getThesesByLecturer, subscribeToThesesByLecturer, approveThesis, rejectThesis, ThesisData, getThesisActivities, ThesisActivity, logThesisActivity, getDisplayStatus } from "@/lib/db/theses";
import { getCommentTemplates } from "@/lib/db/settings";
import { sendNotificationEmail } from "@/lib/actions/email";
import { getAllUsers } from "@/lib/db/users";
import { getGroups } from "@/lib/db/groups";
import { Bell, ExternalLink, Plus, X } from "lucide-react";
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

    // Validation
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
    setConfirmDialog(null); // Close the modal immediately

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
            description: reviewComments.trim() || "Lecturer rejected equipment check."
          });

          if (activeWorkspace.thesis.studentUids?.length > 0) {
            for (const sEmail of activeWorkspace.thesis.studentUids) {
              await sendNotificationEmail({
                to: sEmail,
                subject: `Equipment Check Rejected`,
                html: `<p>Your equipment check for <b>${activeWorkspace.thesis.title}</b> has been rejected.</p>${reviewComments ? `<p><b>Reason:</b> ${reviewComments}</p>` : ""}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to review and re-request when ready.</p>`
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
              html: `<p>Your thesis <b>${activeWorkspace.thesis.title}</b> requires revision. Your ${activeWorkspace.role} (${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}) has requested changes.</p>${reviewComments ? `<p><b>Comments:</b> ${reviewComments}</p>` : ""}${linksHtml}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to propose edits.</p>`
            });
          }
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
    
    // Add Equipment Checker Role
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
      <div className={styles.pageHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ margin: 0 }}>My Assigned Theses</h1>
        <button 
          onClick={() => {
            setSelectedNoteField(dbUser?.fieldOfStudy || (theses.find(t => t.fieldOfStudy)?.fieldOfStudy) || "");
            setIsNoteModalOpen(true);
          }}
          className={styles.btnPrimary}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--danger-color)', borderColor: 'var(--danger-color)', margin: 0 }}
        >
          <Bell size={18} />
          Important Note
        </button>
      </div>



      <div className={styles.card}>
        <h2>Action Required</h2>
        <p>Theses that are currently waiting for your review and approval.</p>

        {theses.filter(t => getActionableRoles(t, user?.email || "").length > 0).length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "var(--text-light)" }}>No theses are currently waiting for your approval.</p>
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
                        <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>{t.fieldOfStudy || "No Field of Study"}</div>
                        {getDeadlineDisplay(t)}
                      </td>
                      <td>{t.year || "-"}</td>
                      <td>
                        <span style={{ padding: "4px 10px", background: "var(--primary-lighter)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", border: "1px solid var(--border-strong)", whiteSpace: "nowrap", color: "var(--primary-color)", fontWeight: 500 }}>{getStageIcon(t.currentStage)} {getDisplayStatus(t)}</span>
                      </td>
                      <td>{roles.join(", ")}</td>
                      <td>
                        <button
                          className={styles.btnPrimary}
                          style={{ margin: 0, padding: "6px 14px", fontSize: "0.85rem" }}
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
        <h2>Abstract & Scope Edit Proposals</h2>
        <p>Theses where the student has proposed changes to the Abstract or Scope.</p>

        {theses.filter(t => t.lecturerUids.advisor === user?.email && (t.pendingAbstract || t.pendingScope)).length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "var(--text-light)" }}>No pending Abstract & Scope edits.</p>
        ) : (
          <div className={styles.tableResponsive}>
            <table className={styles.table} style={{ marginTop: "20px", minWidth: "800px" }}>
              <thead>
                <tr>
                  <th style={{ width: "40%" }}>Title</th>
                  <th style={{ width: "20%" }}>Year</th>
                  <th style={{ width: "20%" }}>Status</th>
                  <th style={{ width: "20%" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {theses.filter(t => t.lecturerUids.advisor === user?.email && (t.pendingAbstract || t.pendingScope)).map(t => (
                  <tr key={`topic-${t.id}`}>
                    <td>
                      <strong>{t.title}</strong>
                      <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>{t.fieldOfStudy || "No Field of Study"}</div>
                    </td>
                    <td>{t.year || "-"}</td>
                    <td>
                      <span style={{ padding: "4px 8px", background: "#fef3c7", color: "#92400e", borderRadius: "4px", fontSize: "0.85rem", border: "1px solid #fcd34d", whiteSpace: "nowrap", fontWeight: "bold" }}>Pending Abstract & Scope Edits</span>
                    </td>
                    <td>
                      <button
                        className={styles.btnPrimary}
                        style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem", background: "#f59e0b", color: "#fff", border: "1px solid #d97706" }}
                        onClick={() => setTopicReviewThesis(t)}
                      >
                        Review Edits
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <h2>All Assigned Theses</h2>
        <p>All theses where you are listed as an Advisor, Committee member, or Chairperson.</p>

        {theses.length === 0 ? (
          <p style={{ marginTop: "20px", fontStyle: "italic", color: "var(--text-light)" }}>You have no assigned theses.</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "15px", marginBottom: "15px" }}>
              <input
                type="text"
                placeholder="Search title, group, year..."
                value={assignedSearch}
                onChange={e => setAssignedSearch(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", background: "#fff", color: "var(--text-main)", width: "300px", maxWidth: "100%", fontFamily: "inherit", outline: "none" }}
              />
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                style={{ padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", background: "#fff", color: "var(--text-main)", width: "200px", fontFamily: "inherit", outline: "none" }}
              >
                <option value="">All Roles</option>
                <option value="Advisor">Advisor</option>
                <option value="Committee">Committee</option>
                <option value="Chairperson">Chairperson</option>
              </select>
            </div>

            <div className={styles.tableResponsive}>
              <table className={styles.table} style={{ marginTop: "20px", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th style={{ width: "30%" }}>Title</th>
                    <th style={{ width: "15%" }}>Group</th>
                    <th style={{ width: "10%" }}>Year</th>
                    <th style={{ width: "15%" }}>Status</th>
                    <th style={{ width: "15%" }}>Your Roles</th>
                    <th style={{ width: "15%" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {theses
                    .filter(t => {
                      const myRoles: string[] = [];
                      if (t.lecturerUids.advisor === user?.email) myRoles.push("Advisor");
                      if (t.lecturerUids.committees.includes(user?.email || "")) myRoles.push("Committee");
                      if (t.lecturerUids.chairperson === user?.email) myRoles.push("Chairperson");

                      // Filter by Role
                      if (roleFilter && !myRoles.includes(roleFilter)) return false;

                      // Filter by Search (Title, Group, Year)
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
                          <td style={{ wordBreak: "break-all" }}>
                            <strong>{t.title}</strong>
                            {getDeadlineDisplay(t)}
                            <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>{t.fieldOfStudy || "No Field of Study"}</div>
                          </td>
                          <td>{groupName}</td>
                          <td>{t.year || "-"}</td>
                          <td>
                            <span style={{ padding: "4px 10px", background: "var(--primary-lighter)", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", border: "1px solid var(--border-strong)", whiteSpace: "nowrap", color: "var(--primary-color)", fontWeight: 500 }}>{getStageIcon(t.currentStage)} {getDisplayStatus(t)}</span>
                          </td>
                          <td>{myRoles.join(", ")}</td>
                          <td>
                            <div style={{ display: "flex", gap: "8px" }}>
                              <button
                                className={styles.btnPrimary}
                                style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem", background: "var(--border-color)", color: "var(--text-main)", border: "1.5px solid var(--border-color)" }}
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
          </>
        )}
      </div>

      {/* Workspace Modal */}
      {activeWorkspace && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1100, padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", width: "1200px", maxWidth: "100%", height: "90vh", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>

            {/* Modal Header */}
            <div style={{ padding: "18px 28px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, var(--primary-color), #6d28d9)", color: "#fff" }}>
              <div>
                <h2 style={{ margin: 0, color: "#fff", fontSize: "1.25rem", fontWeight: 700 }}>Review Workspace</h2>
                <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                  <strong>{activeWorkspace.thesis.title}</strong> • {activeWorkspace.role === "ViewOnly" ? "Viewing Details" : `Reviewing as: ${activeWorkspace.role}`}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <button
                  onClick={() => {
                    setSelectedNoteField(activeWorkspace.thesis.fieldOfStudy || dbUser?.fieldOfStudy || "");
                    setIsNoteModalOpen(true);
                  }}
                  className={styles.btnPrimary}
                  style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--danger-color)", borderColor: "var(--danger-color)", margin: 0, padding: "8px 14px", fontSize: "0.85rem" }}
                >
                  <Bell size={16} />
                  Important Note
                </button>
                <button
                  onClick={() => setActiveWorkspace(null)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", cursor: "pointer", color: "#fff" }}
                >&times;</button>
              </div>
            </div>

            {/* Modal Body */}
            <div className={styles.workspaceBody}>

              {/* Left Column: Activity Log & Submissions */}
              <div className={activeWorkspace.role === "ViewOnly" ? styles.workspaceFull : styles.workspaceLeft} style={activeWorkspace.role === "ViewOnly" ? { width: "100%", borderRight: "none", padding: "30px", overflowY: "auto" } : {}}>
                {activeWorkspace.role === "ViewOnly" && (
                  <div style={{ marginBottom: "40px" }}>
                    <h3 style={{ margin: "0 0 15px 0", color: "var(--text-main)", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px", fontWeight: 700 }}>Thesis Details</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", marginBottom: "20px" }}>
                      <div style={{ flex: "1 1 250px" }}>
                        <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Title</strong>
                        <div style={{ color: "var(--text-main)", fontWeight: 700, fontSize: "1.05rem" }}>{activeWorkspace.thesis.title}</div>
                      </div>
                      <div style={{ flex: "1 1 250px" }}>
                        <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "4px" }}>Status</strong>
                        <div style={{ color: "var(--primary-color)", fontWeight: 700 }}>{getStageIcon(activeWorkspace.thesis.currentStage)} {getDisplayStatus(activeWorkspace.thesis)}</div>
                      </div>
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                      <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Abstract</strong>
                      <div style={{ color: "var(--text-main)", whiteSpace: "pre-wrap", background: "var(--primary-lighter)", padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", lineHeight: 1.65 }}>{activeWorkspace.thesis.abstract || "No abstract provided."}</div>
                    </div>

                    <div style={{ marginBottom: "20px" }}>
                      <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Scope</strong>
                      <div style={{ color: "var(--text-main)", whiteSpace: "pre-wrap", background: "var(--primary-lighter)", padding: "14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", lineHeight: 1.65 }}>{activeWorkspace.thesis.scope || "No scope provided."}</div>
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                      <div style={{ flex: "1 1 250px", minWidth: 0 }}>
                        <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Members (Students)</strong>
                        {activeWorkspace.thesis.studentUids?.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-main)", wordBreak: "break-all" }}>
                            {activeWorkspace.thesis.studentUids.map(uid => <li key={uid}>{userMap[uid] || uid}</li>)}
                          </ul>
                        ) : <div style={{ color: "var(--text-muted)" }}>None</div>}
                      </div>
                      <div style={{ flex: "1 1 250px", minWidth: 0 }}>
                        <strong style={{ display: "block", color: "var(--text-muted)", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: "6px" }}>Committees & Advisors</strong>
                        <ul style={{ margin: 0, paddingLeft: "20px", color: "var(--text-main)", wordBreak: "break-word" }}>
                          <li><strong>Chairperson:</strong> {userMap[activeWorkspace.thesis.lecturerUids.chairperson] || activeWorkspace.thesis.lecturerUids.chairperson || "None"}</li>
                          {activeWorkspace.thesis.lecturerUids.committees?.length > 0 ? (
                            <li><strong>Committees:</strong>
                              <ul style={{ margin: "5px 0 0 0", paddingLeft: "20px", wordBreak: "break-all" }}>
                                {activeWorkspace.thesis.lecturerUids.committees.map((c, idx) => <li key={c}>{activeWorkspace.thesis.lecturerUids.committees.length > 1 ? `Committee #${idx + 1}: ` : ""}{userMap[c] || c}</li>)}
                              </ul>
                            </li>
                          ) : <li><strong>Committees:</strong> None</li>}
                          <li><strong>Advisor:</strong> {userMap[activeWorkspace.thesis.lecturerUids.advisor] || activeWorkspace.thesis.lecturerUids.advisor || "None"}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)", fontWeight: 700, borderBottom: activeWorkspace.role === "ViewOnly" ? "1px solid var(--border-color)" : "none", paddingBottom: activeWorkspace.role === "ViewOnly" ? "10px" : "0" }}>Submission History</h3>

                {activities.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontStyle: "italic" }}>No activity recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                    {activities.map(act => (
                      <div key={act.id} style={{ background: "var(--primary-lighter)", padding: "15px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                          <strong style={{ color: "var(--text-main)" }}>{act.type}</strong>
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{new Date(act.timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: "0 0 10px 0", fontSize: "0.95rem", color: "var(--text-main)" }}>{act.description}</p>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.85rem", flexDirection: "column", gap: "10px" }}>
                          <span style={{ color: "var(--text-muted)", wordBreak: "break-word" }}>By: {act.actorName || act.actorEmail} ({act.actorRole})</span>

                          {act.documentUrl && (
                            <a href={act.documentUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary-color)", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                              <ExternalLink size={14} /> Download {act.documentName || "Document"}
                            </a>
                          )}

                          {act.links && act.links.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px", width: "100%", marginTop: "5px" }}>
                              <strong style={{ color: "var(--text-main)" }}>Submitted Links:</strong>
                              {act.links.map((link, idx) => (
                                <a key={idx} href={link.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary-color)", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "6px", background: "#fff", padding: "6px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", width: "fit-content", maxWidth: "100%", wordBreak: "break-all" }}>
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

                {activeWorkspace.role !== "ViewOnly" && activeWorkspace.role !== "Equipment Checker" && (
                  <>
                    <h3 style={{ margin: "0 0 20px 0", color: "var(--text-main)", fontWeight: 700 }}>Your Review</h3>

                    <div style={{ marginBottom: "20px" }}>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>Review Comments / Notes</label>
                      <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="Provide your feedback, requested revisions, or approval notes here..."
                        style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", minHeight: "150px", fontFamily: "inherit", background: "#fff", outline: "none", color: "var(--text-main)" }}
                      />
                      {commentTemplates.length > 0 && (
                        <div style={{ marginTop: "10px", position: "relative" }}>
                          <button
                            onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                            style={{ background: "var(--primary-lighter)", border: "1.5px solid var(--border-strong)", color: "var(--primary-color)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                          >
                            Insert Pre-defined Sentence ▾
                          </button>
                          {showTemplatesDropdown && (
                            <div style={{ position: "absolute", top: "100%", left: 0, marginTop: "5px", background: "#fff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", zIndex: 10, minWidth: "300px", maxHeight: "200px", overflowY: "auto" }}>
                              {commentTemplates.map((template, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setReviewComments(prev => prev ? `${prev}\n${template}` : template);
                                    setShowTemplatesDropdown(false);
                                  }}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 15px", border: "none", borderBottom: idx < commentTemplates.length - 1 ? "1px solid var(--border-color)" : "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-main)", fontFamily: "inherit" }}
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

                    <div style={{ marginBottom: "30px" }}>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>Attach Materials (Required)</label>
                      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "10px", marginTop: 0 }}>You must provide at least one link to your marked-up manuscript or external references.</p>

                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        {reviewLinks.map((link, idx) => (
                          <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", background: "#fff", padding: "10px", borderRadius: "var(--radius-md)", border: "1.5px dashed var(--border-strong)" }}>
                            <select
                              value={link.type}
                              onChange={e => handleLinkChange(idx, "type", e.target.value)}
                              style={{ padding: "8px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", background: "var(--primary-lighter)", fontSize: "0.85rem", fontFamily: "inherit", color: "var(--text-main)", outline: "none" }}
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
                              style={{ flex: 1, padding: "8px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontSize: "0.85rem", outline: "none", fontFamily: "inherit" }}
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
                          style={{ alignSelf: "flex-start", background: "var(--primary-lighter)", border: "1.5px solid var(--border-strong)", color: "var(--primary-color)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "5px", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
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
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "10px", textAlign: "center" }}>
                        Both actions will send your comments and attached file back to the student.
                      </p>
                    </div>
                  </>
                )}

                {activeWorkspace.role === "Equipment Checker" && (
                  <div style={{ display: "flex", flexDirection: "column", height: "100%", justifyContent: "center", alignItems: "center", textAlign: "center", background: "#fff", padding: "30px", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)" }}>
                    <h3 style={{ margin: "0 0 15px 0", color: "var(--text-main)", fontWeight: 700 }}>Equipment Check Request</h3>
                    <p style={{ color: "var(--text-muted)", marginBottom: "25px", fontSize: "0.95rem" }}>The student has requested an equipment check before proceeding to the signing step.</p>
                    
                    <div style={{ width: "100%", marginBottom: "20px", textAlign: "left" }}>
                      <label style={{ display: "block", fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>Reason / Comments</label>
                      <textarea
                        value={reviewComments}
                        onChange={e => setReviewComments(e.target.value)}
                        placeholder="Provide your feedback or reason for rejection here..."
                        style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", minHeight: "100px", fontFamily: "inherit", background: "#fff", outline: "none", color: "var(--text-main)" }}
                      />
                      {commentTemplates.length > 0 && (
                        <div style={{ marginTop: "10px", position: "relative" }}>
                          <button
                            onClick={() => setShowTemplatesDropdown(!showTemplatesDropdown)}
                            style={{ background: "var(--primary-lighter)", border: "1.5px solid var(--border-strong)", color: "var(--primary-color)", padding: "6px 12px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", cursor: "pointer", fontWeight: 600, fontFamily: "inherit" }}
                          >
                            Insert Pre-defined Sentence ▾
                          </button>
                          {showTemplatesDropdown && (
                            <div style={{ position: "absolute", bottom: "100%", left: 0, marginBottom: "5px", background: "#fff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-md)", zIndex: 10, minWidth: "300px", maxHeight: "200px", overflowY: "auto" }}>
                              {commentTemplates.map((template, idx) => (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    setReviewComments(prev => prev ? `${prev}\n${template}` : template);
                                    setShowTemplatesDropdown(false);
                                  }}
                                  style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 15px", border: "none", borderBottom: idx < commentTemplates.length - 1 ? "1px solid var(--border-color)" : "none", background: "transparent", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-main)", fontFamily: "inherit" }}
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

                    <div style={{ display: "flex", gap: "10px", width: "100%", flexWrap: "wrap" }}>
                      <button
                        className={styles.btnPrimary}
                        style={{ flex: 1, margin: 0, background: "#10b981", fontSize: "1rem", padding: "12px 24px" }}
                        disabled={actionLoading === activeWorkspace.thesis.id}
                        onClick={triggerApprove}
                      >
                        {actionLoading === activeWorkspace.thesis.id ? "Processing..." : "Approve Equipment Check"}
                      </button>
                      <button
                        className={styles.btnDanger}
                        style={{ flex: 1, margin: 0, fontSize: "1rem", padding: "12px 24px", background: "#dc2626", color: "#fff" }}
                        disabled={actionLoading === activeWorkspace.thesis.id}
                        onClick={triggerReject}
                      >
                        {actionLoading === activeWorkspace.thesis.id ? "Processing..." : "Reject Check"}
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "450px", maxWidth: "100%", borderRadius: "var(--radius-xl)", padding: "32px", boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 15px 0", color: "var(--text-main)", fontSize: "1.4rem", fontWeight: 700 }}>Confirm {confirmDialog.type}</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "1rem", marginBottom: "28px", lineHeight: "1.6" }}>
              {confirmDialog.message}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setConfirmDialog(null)}
                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", background: "var(--border-color)", border: "none", color: "var(--text-main)", fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
              <button
                onClick={executeAction}
                style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", background: confirmDialog.type === "Approve" ? "#10b981" : "#dc2626", border: "none", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Confirm {confirmDialog.type}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Deadlines Modal */}
      {deadlineModalThesis && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "460px", maxWidth: "100%", borderRadius: "var(--radius-xl)", padding: "32px", boxShadow: "var(--shadow-lg)" }}>
            <h2 style={{ margin: "0 0 20px 0", color: "var(--text-main)", fontSize: "1.3rem", fontWeight: 700 }}>Manage Deadlines</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", fontWeight: 500 }}>Advisor Review Deadline</label>
                <input type="datetime-local" value={deadlineAdvisor} onChange={e => setDeadlineAdvisor(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", fontWeight: 500 }}>Committee Review Deadline</label>
                <input type="datetime-local" value={deadlineCommittee} onChange={e => setDeadlineCommittee(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "5px", fontWeight: 500 }}>Chairperson Review Deadline</label>
                <input type="datetime-local" value={deadlineChairperson} onChange={e => setDeadlineChairperson(e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: "var(--radius-md)", border: "1.5px solid var(--border-color)", fontFamily: "inherit", outline: "none" }} />
              </div>
              <div style={{ display: "flex", gap: "10px", marginTop: "15px" }}>
                <button
                  onClick={() => setDeadlineModalThesis(null)}
                  style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", background: "var(--border-color)", border: "none", color: "var(--text-main)", fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDeadlines}
                  disabled={savingDeadlines}
                  style={{ flex: 1, padding: "12px", borderRadius: "var(--radius-md)", background: "var(--primary-color)", border: "none", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer", opacity: savingDeadlines ? 0.7 : 1, fontFamily: "inherit" }}
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
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "420px", maxWidth: "100%", borderRadius: "var(--radius-xl)", padding: "32px", boxShadow: "var(--shadow-lg)", textAlign: "center" }}>
            <h2 style={{ margin: "0 0 15px 0", color: "var(--danger-color)", fontSize: "1.4rem", fontWeight: 700 }}>Notice</h2>
            <p style={{ color: "var(--text-main)", fontSize: "1rem", marginBottom: "28px", lineHeight: "1.6" }}>
              {errorDialog}
            </p>
            <button
              onClick={() => setErrorDialog(null)}
              style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-md)", background: "var(--primary-color)", border: "none", color: "#fff", fontSize: "1rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Okay
            </button>
          </div>
        </div>
      )}

      {/* Abstract & Scope Edit Review Modal */}
      {topicReviewThesis && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(30,27,75,0.5)", backdropFilter: "blur(6px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "var(--bg-card)", width: "900px", maxWidth: "100%", maxHeight: "90vh", borderRadius: "var(--radius-xl)", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>

            <div style={{ padding: "18px 28px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, var(--primary-color), #6d28d9)" }}>
              <div>
                <h2 style={{ margin: 0, color: "#fff", fontSize: "1.25rem", fontWeight: 700 }}>Review Abstract & Scope Edits</h2>
                <div style={{ fontSize: "0.875rem", color: "rgba(255,255,255,0.8)", marginTop: "4px" }}>
                  <strong>{topicReviewThesis.title}</strong>
                </div>
              </div>
              <button
                onClick={() => setTopicReviewThesis(null)}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "50%", width: "34px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem", cursor: "pointer", color: "#fff" }}
              >&times;</button>
            </div>

            <div style={{ padding: "30px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: "1 1 300px", background: "#fff", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.95rem", fontWeight: 600 }}>Current Abstract</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", color: "var(--text-main)", margin: 0, lineHeight: 1.65 }}>{topicReviewThesis.abstract || "No abstract provided."}</p>
                </div>
                <div style={{ flex: "1 1 300px", background: "var(--primary-lighter)", padding: "16px", borderRadius: "var(--radius-md)", border: "2px solid var(--primary-color)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "var(--primary-color)", fontSize: "0.95rem", fontWeight: 600 }}>Proposed Abstract</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", color: "var(--text-main)", margin: 0, lineHeight: 1.65 }}>{topicReviewThesis.pendingAbstract || "No abstract provided."}</p>
                </div>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
                <div style={{ flex: "1 1 300px", background: "#fff", padding: "16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "var(--text-muted)", fontSize: "0.95rem", fontWeight: 600 }}>Current Scope</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", color: "var(--text-main)", margin: 0, lineHeight: 1.65 }}>{topicReviewThesis.scope || "No scope provided."}</p>
                </div>
                <div style={{ flex: "1 1 300px", background: "var(--primary-lighter)", padding: "16px", borderRadius: "var(--radius-md)", border: "2px solid var(--primary-color)" }}>
                  <h3 style={{ margin: "0 0 10px 0", color: "var(--primary-color)", fontSize: "0.95rem", fontWeight: 600 }}>Proposed Scope</h3>
                  <p style={{ whiteSpace: "pre-wrap", fontSize: "0.95rem", color: "var(--text-main)", margin: 0, lineHeight: 1.65 }}>{topicReviewThesis.pendingScope || "No scope provided."}</p>
                </div>
              </div>
            </div>

            <div style={{ padding: "18px 28px", borderTop: "1px solid var(--border-color)", display: "flex", justifyContent: "flex-end", gap: "12px", background: "var(--primary-lighter)" }}>
              <button
                className={styles.btnDanger}
                style={{ margin: 0, padding: "10px 20px" }}
                onClick={handleRejectTopicEdits}
                disabled={topicReviewActionLoading}
              >
                {topicReviewActionLoading ? "Processing..." : "Reject Edits"}
              </button>
              <button
                className={styles.btnPrimary}
                style={{ margin: 0, padding: "10px 20px" }}
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
