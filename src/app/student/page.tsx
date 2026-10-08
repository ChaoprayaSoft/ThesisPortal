"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { 
  getThesesByStudent, 
  subscribeToThesesByStudent, 
  updateThesis, 
  logThesisActivity, 
  getThesisActivities, 
  ThesisData, 
  ThesisActivity, 
  updateThesisStatus, 
  getStatusForStage, 
  deleteThesisActivity, 
  getDisplayStatus, 
  requestEquipmentCheck 
} from "@/lib/db/theses";
import { getLecturers, UserData } from "@/lib/db/users";
import { sendNotificationEmail } from "@/lib/actions/email";
import styles from "./student.module.css";
import { Plus, X, ExternalLink, Bell, Clock, CheckCircle2, AlertTriangle, ShieldCheck, Wrench, FileText } from "lucide-react";
import ImportantNoteModal from "@/components/ImportantNoteModal";

const getStageLabel = (stage: number) => {
  switch (stage) {
    case 0: return "Advisor";
    case 1: return "Committee";
    case 2: return "Chairperson";
    case 3: return "Sign. Advisor";
    case 4: return "Sign. Committee";
    case 5: return "Sign. Chairperson";
    case 6: return "Graduate";
    default: return "Unknown";
  }
};

export default function StudentDashboard() {
  const { user, dbUser } = useAuth();
  const [thesis, setThesis] = useState<ThesisData | null>(null);
  const [activities, setActivities] = useState<ThesisActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editAbstract, setEditAbstract] = useState("");
  const [editScope, setEditScope] = useState("");
  const [submittingEdits, setSubmittingEdits] = useState(false);

  // Link Submission State
  const [submissionLinks, setSubmissionLinks] = useState<{ type: string, url: string }[]>([
    { type: "Manuscript", url: "" }
  ]);
  const [submittingLinks, setSubmittingLinks] = useState(false);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);
  const [requestingEquipmentCheck, setRequestingEquipmentCheck] = useState(false);
  const [showEquipmentCheckModal, setShowEquipmentCheckModal] = useState(false);
  const [equipmentCheckMessage, setEquipmentCheckMessage] = useState("");

  // Lecturers Map
  const [lecturersMap, setLecturersMap] = useState<Record<string, UserData>>({});

  // Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, minutes: number, seconds: number } | null>(null);
  const [isLate, setIsLate] = useState(false);

  useEffect(() => {
    if (user?.email) {
      const unsubscribe = subscribeToThesesByStudent(user.email, async (data) => {
        if (data.length > 0) {
          const myThesis = data[0];
          setThesis(myThesis);
          setEditAbstract(myThesis.pendingAbstract || myThesis.abstract);
          setEditScope(myThesis.pendingScope || myThesis.scope);

          const acts = await getThesisActivities(myThesis.id!);
          setActivities(acts);

          const allLecturers = await getLecturers();
          const map: Record<string, UserData> = {};
          allLecturers.forEach((l: any) => map[l.email] = l);
          setLecturersMap(map);
        } else {
          setThesis(null);
        }
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [user]);

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

  const getStatusBadgeStyle = (status: string) => {
    if (status === "Graduate") {
      return { background: "var(--success-bg)", color: "var(--success-text)", border: "1px solid var(--success-border)" };
    }
    if (status === "Revise") {
      return { background: "var(--danger-bg)", color: "var(--danger-text)", border: "1px solid var(--danger-border)" };
    }
    if (status.includes("Chairperson")) {
      return { background: "var(--info-bg)", color: "var(--info-text)", border: "1px solid var(--info-border)" };
    }
    if (status.includes("Committee")) {
      return { background: "var(--purple-bg)", color: "var(--purple-text)", border: "1px solid var(--purple-border)" };
    }
    return { background: "var(--warning-bg)", color: "var(--warning-text)", border: "1px solid var(--warning-border)" };
  };

  const loadData = async () => {};

  useEffect(() => {
    if (!thesis) return;

    let targetDeadline = undefined;
    if (thesis.currentStage === 0) targetDeadline = thesis.deadlines?.advisor;
    else if (thesis.currentStage === 1) targetDeadline = thesis.deadlines?.committee;
    else if (thesis.currentStage === 2) targetDeadline = thesis.deadlines?.chairperson;

    if (!targetDeadline) {
      setTimeLeft(null);
      setIsLate(false);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetDeadline! - now;
      if (diff <= 0) {
        setIsLate(true);
        setTimeLeft(null);
      } else {
        setIsLate(false);
        setTimeLeft({
          days: Math.floor(diff / (1000 * 60 * 60 * 24)),
          hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((diff / 1000 / 60) % 60),
          seconds: Math.floor((diff / 1000) % 60)
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [thesis]);

  const handleProposeEdits = async () => {
    if (!thesis?.id || !user?.email) return;
    setSubmittingEdits(true);
    try {
      await updateThesis(thesis.id, {
        pendingAbstract: editAbstract,
        pendingScope: editScope,
        statusUpdatedAt: Date.now()
      });
      await logThesisActivity({
        thesisId: thesis.id,
        type: "Topic Edit Proposed",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Student",
        description: "Student proposed edits to abstract and scope.",
      });
      setIsEditing(false);
      await loadData();

      if (thesis.lecturerUids?.advisor) {
        await sendNotificationEmail({
          to: thesis.lecturerUids.advisor,
          subject: `Thesis Edits Proposed: ${thesis.title}`,
          html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has proposed edits for the thesis <b>${thesis.title}</b>.</p><p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to review them.</p>`
        });
      }
    } catch (error) {
      alert("Failed to submit edits.");
    }
    setSubmittingEdits(false);
  };

  const handleAddLink = () => {
    setSubmissionLinks([...submissionLinks, { type: "Other documents", url: "" }]);
  };

  const handleRemoveLink = (index: number) => {
    const newLinks = [...submissionLinks];
    newLinks.splice(index, 1);
    setSubmissionLinks(newLinks);
  };

  const handleLinkChange = (index: number, field: "type" | "url", value: string) => {
    const newLinks = [...submissionLinks];
    newLinks[index][field] = value;
    setSubmissionLinks(newLinks);
  };

  const handleSubmitLinks = async () => {
    if (!thesis?.id || !user?.email) return;

    const validLinks = submissionLinks.filter(l => l.url.trim() !== "");
    if (validLinks.length === 0) {
      setErrorDialog("Please provide at least one valid URL.");
      return;
    }

    const invalidUrl = validLinks.find(l => !l.url.trim().startsWith("http"));
    if (invalidUrl) {
      setErrorDialog("URLs must start with http:// or https://");
      return;
    }

    setSubmittingLinks(true);
    try {
      await logThesisActivity({
        thesisId: thesis.id,
        type: thesis.status === "Preparing" ? "Initial Submission" : "Revision Resubmitted",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Student",
        description: `Student submitted thesis materials for review. (${getStageLabel(thesis.currentStage)})`,
        links: validLinks
      });

      if (thesis.status === "Revise" || thesis.status === "Preparing") {
        const nextStatus = getStatusForStage(thesis.currentStage);
        await updateThesisStatus(thesis.id, nextStatus, thesis.currentStage);

        const linksHtml = validLinks.length > 0 ? `<p><b>Attachments:</b></p><ul>${validLinks.map(l => `<li><a href="${l.url}">${l.type}</a></li>`).join('')}</ul>` : "";

        if ((thesis.currentStage === 0 || thesis.currentStage === 3) && thesis.lecturerUids?.advisor) {
          await sendNotificationEmail({
            to: thesis.lecturerUids.advisor,
            subject: `Thesis Materials Submitted: ${thesis.title}`,
            html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has submitted materials for <b>${thesis.title}</b> and it is now pending your review/signature.</p>${linksHtml}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a>.</p>`
          });
        } else if ((thesis.currentStage === 1 || thesis.currentStage === 4) && thesis.lecturerUids?.committees) {
          for (const comm of thesis.lecturerUids.committees) {
            await sendNotificationEmail({
              to: comm,
              subject: `Thesis Materials Updated: ${thesis.title}`,
              html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has submitted materials for <b>${thesis.title}</b>.</p>${linksHtml}<p>It is currently pending your review/signature. Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a>.</p>`
            });
          }
        } else if ((thesis.currentStage === 2 || thesis.currentStage === 5) && thesis.lecturerUids?.chairperson) {
          await sendNotificationEmail({
            to: thesis.lecturerUids.chairperson,
            subject: `Thesis Materials Updated: ${thesis.title}`,
            html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has submitted materials for <b>${thesis.title}</b>.</p>${linksHtml}<p>It is currently pending your review/signature. Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a>.</p>`
          });
        }
      }

      await updateThesis(thesis.id, { statusUpdatedAt: Date.now() });
      setSubmissionLinks([{ type: "Manuscript", url: "" }]);
      await loadData();
    } catch (err) {
      console.error(err);
      setErrorDialog("Failed to submit links.");
    }
    setSubmittingLinks(false);
  };

  const handleRequestEquipmentCheck = async () => {
    if (!thesis?.id || !user?.email) return;
    setRequestingEquipmentCheck(true);
    try {
      await requestEquipmentCheck(thesis.id);
      const advisorEmail = thesis.lecturerUids?.advisor;
      const advisorName = advisorEmail ? (lecturersMap[advisorEmail]?.name_th || lecturersMap[advisorEmail]?.name_en || advisorEmail) : "Unknown";
      await logThesisActivity({
        thesisId: thesis.id,
        type: "Equipment Check Requested",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Student",
        description: `Student requested equipment check for project "${thesis.title}" (Advisor: ${advisorName}).${equipmentCheckMessage.trim() ? `\n\nMessage: ${equipmentCheckMessage.trim()}` : ""}`
      });
      if (thesis.equipmentChecker) {
        await sendNotificationEmail({
          to: thesis.equipmentChecker,
          subject: `Equipment Check Request: ${thesis.title}`,
          html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has requested an equipment check for the thesis: <b>${thesis.title}</b>.</p>${equipmentCheckMessage.trim() ? `<p><b>Message:</b><br/>${equipmentCheckMessage.trim().replace(/\n/g, '<br/>')}</p>` : ""}<p>Please <a href="https://thesis-portal-roan.vercel.app/">log in to the Thesis Portal</a> to review the request.</p>`
        });
      }
      setShowEquipmentCheckModal(false);
      setEquipmentCheckMessage("");
      await loadData();
    } catch (err: any) {
      console.error(err);
      setErrorDialog("Failed to request equipment check: " + err.message);
    }
    setRequestingEquipmentCheck(false);
  };

  const handleCancelSubmission = async (activity: ThesisActivity) => {
    if (!thesis?.id || !user?.email || !activity.id) return;
    if (!confirm("Are you sure you want to cancel this submission? This will notify your lecturer.")) return;

    try {
      await logThesisActivity({
        thesisId: thesis.id,
        type: "Submission Cancelled",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorName: dbUser?.name_th || dbUser?.name_en || user.displayName || user.email,
        actorRole: "Student",
        description: "Student cancelled their recent submission.",
      });
      const revertStatus = activity.type === "Initial Submission" ? "Preparing" : "Revise";
      await updateThesis(thesis.id, { status: revertStatus, statusUpdatedAt: Date.now() });

      await sendNotificationEmail({
        to: user.email,
        subject: `Submission Cancelled: ${thesis.title}`,
        html: `<p>You have successfully cancelled your recent submission for <b>${thesis.title}</b>.</p><p>You can make a new submission when ready.</p>`
      });

      if ((thesis.currentStage === 0 || thesis.currentStage === 3) && thesis.lecturerUids?.advisor) {
        await sendNotificationEmail({
          to: thesis.lecturerUids.advisor,
          subject: `Submission Cancelled: ${thesis.title}`,
          html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has cancelled their recent submission for <b>${thesis.title}</b>.</p>`
        });
      } else if ((thesis.currentStage === 1 || thesis.currentStage === 4) && thesis.lecturerUids?.committees) {
        for (const comm of thesis.lecturerUids.committees) {
          await sendNotificationEmail({
            to: comm,
            subject: `Submission Cancelled: ${thesis.title}`,
            html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has cancelled their recent submission for <b>${thesis.title}</b>.</p>`
          });
        }
      } else if ((thesis.currentStage === 2 || thesis.currentStage === 5) && thesis.lecturerUids?.chairperson) {
        await sendNotificationEmail({
          to: thesis.lecturerUids.chairperson,
          subject: `Submission Cancelled: ${thesis.title}`,
          html: `<p>Student <b>${dbUser?.name_th || dbUser?.name_en || user.displayName || user.email}</b> has cancelled their recent submission for <b>${thesis.title}</b>.</p>`
        });
      }

      await loadData();
    } catch (err) {
      console.error(err);
      setErrorDialog("Failed to cancel submission.");
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.loadingSpinner}></div>
        <span>Loading your workspace...</span>
      </div>
    );
  }

  if (!thesis) {
    return (
      <div className={styles.card} style={{ textAlign: "center", padding: "48px 24px" }}>
        <h2 style={{ fontSize: "1.4rem", color: "var(--text-main)", marginBottom: "8px" }}>No Thesis Assigned</h2>
        <p style={{ color: "var(--text-muted)", margin: 0 }}>You have not been assigned to a thesis project yet. Please contact your faculty administrator.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
        <h1 style={{ margin: 0 }}>My Workspace</h1>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {thesis.equipmentChecker && thesis.currentStage >= 3 && (
            <button
              onClick={(!thesis.equipmentCheckStatus || thesis.equipmentCheckStatus === 'Pending Request') ? () => setShowEquipmentCheckModal(true) : undefined}
              className={styles.btnPrimary}
              style={{
                backgroundColor: thesis.equipmentCheckStatus === 'Approved' ? 'var(--success-color)' : (thesis.equipmentCheckStatus === 'Requested' ? 'var(--info-color)' : 'var(--warning-color)'),
                boxShadow: "none",
                cursor: (!thesis.equipmentCheckStatus || thesis.equipmentCheckStatus === 'Pending Request') ? 'pointer' : 'default',
              }}
              disabled={requestingEquipmentCheck || (thesis.equipmentCheckStatus !== undefined && thesis.equipmentCheckStatus !== 'Pending Request')}
            >
              <Wrench size={16} />
              {requestingEquipmentCheck ? "Requesting..." : (
                (!thesis.equipmentCheckStatus || thesis.equipmentCheckStatus === 'Pending Request') ? "Request Equipment Check" :
                thesis.equipmentCheckStatus === 'Requested' ? "Equipment Check: Pending Approval" :
                "Equipment Check: Approved"
              )}
            </button>
          )}
          <button 
            onClick={() => setIsNoteModalOpen(true)}
            className={styles.btnDanger}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Bell size={16} />
            Important Note
          </button>
        </div>
      </div>
      
      <ImportantNoteModal 
        isOpen={isNoteModalOpen} 
        onClose={() => setIsNoteModalOpen(false)} 
        fieldOfStudy={thesis.fieldOfStudy}
      />

      {showEquipmentCheckModal && (
        <div className={styles.modalOverlay} style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "480px", maxWidth: "100%", borderRadius: "var(--radius-xl)", padding: "28px", boxShadow: "var(--shadow-modal)", border: "1px solid var(--border-color)" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--text-main)", fontSize: "1.25rem", fontWeight: 700 }}>Request Equipment Check</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "18px", lineHeight: 1.5 }}>
              Submit a request to your assigned equipment inspector. You may include an optional note below.
            </p>
            <textarea
              value={equipmentCheckMessage}
              onChange={e => setEquipmentCheckMessage(e.target.value)}
              placeholder="Leave a message or list of borrowed items (optional)..."
              style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", minHeight: "90px", fontFamily: "inherit", background: "#fff", marginBottom: "20px", fontSize: "0.9rem", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowEquipmentCheckModal(false); setEquipmentCheckMessage(""); }}
                className={styles.btnSecondary}
              >
                Cancel
              </button>
              <button
                onClick={handleRequestEquipmentCheck}
                disabled={requestingEquipmentCheck}
                className={styles.btnPrimary}
              >
                {requestingEquipmentCheck ? "Confirming..." : "Confirm Request"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Thesis Header Card */}
      <div className={`${styles.card} ${styles.workspaceHeader}`}>
        <div>
          <h2 style={{ marginBottom: "8px", fontSize: "1.55rem", letterSpacing: "-0.025em" }}>{thesis.title}</h2>
          <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "0.88rem", flexWrap: "wrap" }}>
            <span><strong style={{ color: "var(--text-main)" }}>Year:</strong> {thesis.year || "-"}</span>
            <span><strong style={{ color: "var(--text-main)" }}>Field:</strong> {thesis.fieldOfStudy || "-"}</span>
          </div>
        </div>
        <div className={styles.statusBadge}>
          <div style={{ fontSize: "0.78rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600, marginBottom: "6px" }}>Current Status</div>
          <div style={{ padding: "6px 14px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "0.88rem", display: "inline-flex", alignItems: "center", gap: "6px", ...getStatusBadgeStyle(thesis.status) }}>
            <span>{getStageIcon(thesis.currentStage)}</span>
            <span>{getDisplayStatus(thesis)}</span>
          </div>
        </div>
      </div>

      {/* COUNTDOWN TIMER */}
      {(() => {
        let stageName = "";
        if (thesis.currentStage === 0) stageName = "Advisor";
        else if (thesis.currentStage === 1) stageName = "Committee";
        else if (thesis.currentStage === 2) stageName = "Chairperson";

        return thesis.currentStage < 3 && (timeLeft || isLate) && (
          <div style={{ 
            background: isLate ? "var(--danger-bg)" : "#1e293b", 
            borderRadius: "var(--radius-lg)", 
            padding: "20px 28px", 
            marginBottom: "24px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center", 
            flexWrap: "wrap",
            gap: "16px",
            boxShadow: "var(--shadow-card)", 
            border: isLate ? "1px solid var(--danger-border)" : "1px solid #334155" 
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: isLate ? "var(--danger-text)" : "var(--primary-light)", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>
                <Clock size={14} />
                <span>Stage Deadline ({stageName})</span>
              </div>
              <div style={{ color: isLate ? "var(--danger-text)" : "#f8fafc", fontSize: "1.15rem", fontWeight: 700, marginTop: "4px" }}>
                {isLate ? "Submission deadline has passed!" : "Time remaining before stage deadline"}
              </div>
            </div>

            {!isLate && timeLeft && (
              <div style={{ display: "flex", gap: "10px", color: "#fff", textAlign: "center" }}>
                {[
                  { label: "Days", val: timeLeft.days },
                  { label: "Hours", val: timeLeft.hours },
                  { label: "Mins", val: timeLeft.minutes },
                  { label: "Secs", val: timeLeft.seconds },
                ].map((item, i) => (
                  <div key={i} style={{ background: "rgba(255, 255, 255, 0.08)", padding: "8px 14px", borderRadius: "var(--radius-sm)", minWidth: "58px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                    <div style={{ fontSize: "1.45rem", fontWeight: 800, lineHeight: 1, color: "#ffffff" }}>{item.val}</div>
                    <div style={{ fontSize: "0.68rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "3px", fontWeight: 600 }}>{item.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      <div className={styles.dashboardGrid}>
        {/* LEFT COLUMN */}
        <div>
          {/* Abstract & Scope Card */}
          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0 }}>Abstract & Scope</h2>
              {!isEditing && (
                <button 
                  className={styles.btnSecondary} 
                  style={{ padding: "6px 14px", fontSize: "0.82rem" }} 
                  onClick={() => setIsEditing(true)}
                >
                  Propose Edits
                </button>
              )}
            </div>

            {(thesis.pendingAbstract || thesis.pendingScope) && !isEditing && (
              <div style={{ background: "var(--warning-bg)", padding: "10px 14px", borderRadius: "var(--radius-sm)", fontSize: "0.85rem", color: "var(--warning-text)", marginBottom: "18px", border: "1px solid var(--warning-border)", display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={16} />
                <span>You have proposed topic edits pending approval from your Advisor.</span>
              </div>
            )}

            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>Abstract</label>
                  <textarea
                    value={editAbstract}
                    onChange={e => setEditAbstract(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", minHeight: "130px", fontFamily: "inherit", fontSize: "0.92rem", outline: "none" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>Scope</label>
                  <textarea
                    value={editScope}
                    onChange={e => setEditScope(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", minHeight: "90px", fontFamily: "inherit", fontSize: "0.92rem", outline: "none" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button className={styles.btnSecondary} onClick={() => { setIsEditing(false); setEditAbstract(thesis.pendingAbstract || thesis.abstract); setEditScope(thesis.pendingScope || thesis.scope); }} disabled={submittingEdits}>
                    Cancel
                  </button>
                  <button className={styles.btnPrimary} onClick={handleProposeEdits} disabled={submittingEdits}>
                    {submittingEdits ? "Submitting..." : "Submit to Advisor"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div>
                  <h3 style={{ fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px 0", fontWeight: 700 }}>Abstract</h3>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-main)", fontSize: "0.92rem", lineHeight: 1.65 }}>{thesis.pendingAbstract || thesis.abstract || "No abstract provided."}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px 0", fontWeight: 700 }}>Scope</h3>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap", color: "var(--text-main)", fontSize: "0.92rem", lineHeight: 1.65 }}>{thesis.pendingScope || thesis.scope || "No scope provided."}</p>
                </div>
              </div>
            )}
          </div>

          {/* Activity & Reviews Card */}
          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0 }}>Activity & Review Trail</h2>
            </div>

            {activities.length === 0 ? (
              <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "24px 0" }}>No activity recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {activities.map(act => (
                  <div key={act.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <strong style={{ fontSize: "0.92rem", color: "var(--text-main)" }}>{act.type}</strong>
                      <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-light)" }}>
                          {new Date(act.timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {activities.indexOf(act) === 0 && act.actorEmail === user?.email && (act.type === "Initial Submission" || act.type === "Revision Resubmitted") && (
                          <button
                            onClick={() => handleCancelSubmission(act)}
                            className={styles.btnDanger}
                            style={{ padding: "3px 8px", fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <X size={12} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                    <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "var(--text-main)", lineHeight: 1.55 }}>{act.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.82rem", flexDirection: "column", gap: "8px" }}>
                      <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>By: {act.actorName || act.actorEmail} ({act.actorRole})</span>

                      {act.documentUrl && (
                        <a href={act.documentUrl} target="_blank" rel="noreferrer" style={{ color: "var(--primary-color)", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                          <ExternalLink size={14} /> View Document ({act.documentName || "PDF"})
                        </a>
                      )}

                      {act.links && act.links.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", marginTop: "4px" }}>
                          <span style={{ color: "var(--text-muted)", fontWeight: 600, fontSize: "0.8rem" }}>Submitted Links:</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                            {act.links.map((link, idx) => (
                              <a key={idx} href={link.url} target="_blank" rel="noreferrer" style={{ color: "var(--primary-color)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px", background: "#ffffff", padding: "5px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.82rem" }}>
                                <ExternalLink size={13} /> <span>{link.type}</span>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {thesis.currentStage >= 3 && thesis.equipmentCheckStatus !== 'Approved' && (
            <div className={styles.card} style={{ textAlign: "center", padding: "32px 20px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: "var(--warning-bg)", color: "var(--warning-color)", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                <Wrench size={22} />
              </div>
              <h3 style={{ color: "var(--text-main)", marginBottom: "8px", fontSize: "1.1rem" }}>Equipment Clearance Required</h3>
              <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                You must complete your borrowed equipment inspection before proceeding. Use the button at the top of the page.
              </p>
            </div>
          )}

          {!(thesis.currentStage >= 3 && thesis.equipmentCheckStatus !== 'Approved') && (
            <div className={styles.card}>
              <h2>Submit Materials</h2>
              <p style={{ fontSize: "0.88rem", marginBottom: "18px" }}>
                Provide cloud links to your manuscript, video demonstration, or supplementary project files.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "18px" }}>
                {submissionLinks.map((link, idx) => (
                  <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center", background: "var(--bg-subtle)", padding: "10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                    <select
                      value={link.type}
                      onChange={e => handleLinkChange(idx, "type", e.target.value)}
                      style={{ padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", background: "#fff", fontSize: "0.85rem", outline: "none", fontFamily: "inherit" }}
                    >
                      <option value="Manuscript">Manuscript</option>
                      <option value="Video Clip">Video Clip</option>
                      <option value="Other documents">Other documents</option>
                    </select>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={link.url}
                      onChange={e => handleLinkChange(idx, "url", e.target.value)}
                      style={{ flex: 1, padding: "7px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", fontSize: "0.85rem", outline: "none", fontFamily: "inherit", background: "#ffffff" }}
                    />
                    {submissionLinks.length > 1 && (
                      <button
                        onClick={() => handleRemoveLink(idx)}
                        style={{ background: "var(--danger-bg)", color: "var(--danger-color)", border: "1px solid var(--danger-border)", borderRadius: "var(--radius-sm)", width: "30px", height: "30px", display: "flex", justifyContent: "center", alignItems: "center", cursor: "pointer" }}
                        title="Remove Link"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={handleAddLink}
                  className={styles.btnSecondary}
                  style={{ alignSelf: "flex-start", padding: "6px 12px", fontSize: "0.82rem" }}
                >
                  <Plus size={14} /> Add link
                </button>
              </div>

              <button
                className={styles.btnPrimary}
                style={{ width: "100%", padding: "11px", fontSize: "0.95rem" }}
                onClick={handleSubmitLinks}
                disabled={submittingLinks}
              >
                {submittingLinks ? "Submitting..." : "Submit Materials"}
              </button>
            </div>
          )}

          {/* Assigned Lecturers Card */}
          <div className={styles.card}>
            <h2>Assigned Faculty</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Advisor</strong>
                {thesis.lecturerUids.advisor ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "0.92rem" }}>
                      {lecturersMap[thesis.lecturerUids.advisor]?.name_en || lecturersMap[thesis.lecturerUids.advisor]?.name_th || thesis.lecturerUids.advisor}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>{thesis.lecturerUids.advisor}</span>
                  </div>
                ) : <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>None</span>}
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Committee Members</strong>
                {thesis.lecturerUids.committees.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "6px" }}>
                    {thesis.lecturerUids.committees.map((c, idx) => (
                      <div key={c} style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "0.9rem" }}>
                          {thesis.lecturerUids.committees.length > 1 ? `#${idx + 1} ` : ""}{lecturersMap[c]?.name_en || lecturersMap[c]?.name_th || c}
                        </span>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>{c}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>None</span>
                )}
              </div>

              <div>
                <strong style={{ display: "block", fontSize: "0.75rem", color: "var(--text-light)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 700 }}>Chairperson</strong>
                {thesis.lecturerUids.chairperson ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "4px" }}>
                    <span style={{ color: "var(--text-main)", fontWeight: 600, fontSize: "0.92rem" }}>
                      {lecturersMap[thesis.lecturerUids.chairperson]?.name_en || lecturersMap[thesis.lecturerUids.chairperson]?.name_th || thesis.lecturerUids.chairperson}
                    </span>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-light)" }}>{thesis.lecturerUids.chairperson}</span>
                  </div>
                ) : <span style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>None</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Modal */}
      {errorDialog && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15, 23, 42, 0.45)", backdropFilter: "blur(8px)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#fff", width: "400px", maxWidth: "100%", borderRadius: "var(--radius-xl)", padding: "28px", boxShadow: "var(--shadow-modal)", textAlign: "center", border: "1px solid var(--border-color)" }}>
            <h2 style={{ margin: "0 0 10px 0", color: "var(--danger-color)", fontSize: "1.25rem", fontWeight: 700 }}>Notice</h2>
            <p style={{ color: "var(--text-main)", fontSize: "0.95rem", marginBottom: "24px", lineHeight: 1.5 }}>
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
    </div>
  );
}
