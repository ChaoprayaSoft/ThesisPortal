"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { getThesesByStudent, subscribeToThesesByStudent, updateThesis, logThesisActivity, getThesisActivities, ThesisData, ThesisActivity, updateThesisStatus } from "@/lib/db/theses";
import { getLecturers, UserData } from "@/lib/db/users";
import { sendNotificationEmail } from "@/lib/actions/email";
import styles from "./student.module.css";
import { Plus, X, ExternalLink } from "lucide-react";

export default function StudentDashboard() {
  const { user } = useAuth();
  const [thesis, setThesis] = useState<ThesisData | null>(null);
  const [activities, setActivities] = useState<ThesisActivity[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editAbstract, setEditAbstract] = useState("");
  const [editScope, setEditScope] = useState("");
  const [submittingEdits, setSubmittingEdits] = useState(false);

  // Link Submission State
  const [submissionLinks, setSubmissionLinks] = useState<{type: string, url: string}[]>([
    { type: "Manuscript", url: "" }
  ]);
  const [submittingLinks, setSubmittingLinks] = useState(false);
  const [errorDialog, setErrorDialog] = useState<string | null>(null);

  // Lecturers Map
  const [lecturersMap, setLecturersMap] = useState<Record<string, UserData>>({});

  // Countdown Timer State
  const [timeLeft, setTimeLeft] = useState<{days: number, hours: number, minutes: number, seconds: number} | null>(null);
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

          // Load lecturers for names
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

  const loadData = async () => {
    // left empty for backwards compatibility
  };

  useEffect(() => {
    if (!thesis) return;
    
    let targetDeadline = undefined;
    if (thesis.currentStage === 0 || thesis.status === "Revise") targetDeadline = thesis.deadlines?.advisor;
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

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [thesis]);

  const handleProposeEdits = async () => {
    if (!thesis?.id || !user?.email) return;
    setSubmittingEdits(true);
    try {
      await updateThesis(thesis.id, {
        pendingAbstract: editAbstract,
        pendingScope: editScope
      });
      await logThesisActivity({
        thesisId: thesis.id,
        type: "Edits Proposed",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorRole: "Student",
        description: "Student proposed edits to the Abstract and Scope."
      });
      setIsEditing(false);
      await loadData();

      if (thesis.lecturerUids?.advisor) {
        await sendNotificationEmail({
          to: thesis.lecturerUids.advisor,
          subject: `Thesis Edits Proposed: ${thesis.title}`,
          html: `<p>Student <b>${user.email}</b> has proposed edits for the thesis <b>${thesis.title}</b>.</p><p>Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a> to review them.</p>`
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

    // Validation
    const validLinks = submissionLinks.filter(l => l.url.trim() !== "");
    if (validLinks.length === 0) {
      setErrorDialog("Please provide at least one valid URL.");
      return;
    }

    // Check if URLs are somewhat valid (start with http)
    const invalidUrl = validLinks.find(l => !l.url.trim().startsWith("http"));
    if (invalidUrl) {
      setErrorDialog("URLs must start with http:// or https://");
      return;
    }

    setSubmittingLinks(true);
    try {
      await logThesisActivity({
        thesisId: thesis.id,
        type: "Materials Submitted",
        timestamp: Date.now(),
        actorEmail: user.email,
        actorRole: "Student",
        description: "Student submitted external material links for review.",
        links: validLinks
      });

      if (thesis.status === "Revise" || thesis.status === "Preparing") {
        await updateThesisStatus(thesis.id, "Pending Advisor", 0);
        if (thesis.lecturerUids?.advisor) {
          await sendNotificationEmail({
            to: thesis.lecturerUids.advisor,
            subject: `Thesis Materials Submitted: ${thesis.title}`,
            html: `<p>Student <b>${user.email}</b> has submitted materials for <b>${thesis.title}</b> and it is now pending your Advisor review.</p><p>Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a>.</p>`
          });
        }
      } else if (thesis.status === "Pending Committee" && thesis.lecturerUids?.committees) {
        for (const comm of thesis.lecturerUids.committees) {
          await sendNotificationEmail({
            to: comm,
            subject: `Thesis Materials Updated: ${thesis.title}`,
            html: `<p>Student <b>${user.email}</b> has submitted materials for <b>${thesis.title}</b>.</p><p>It is currently pending your Committee review. Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a>.</p>`
          });
        }
      } else if (thesis.status === "Pending Chairperson" && thesis.lecturerUids?.chairperson) {
        await sendNotificationEmail({
          to: thesis.lecturerUids.chairperson,
          subject: `Thesis Materials Updated: ${thesis.title}`,
          html: `<p>Student <b>${user.email}</b> has submitted materials for <b>${thesis.title}</b>.</p><p>It is currently pending your Chairperson review. Please <a href="https://thesisportal.vercel.app">log in to the Thesis Portal</a>.</p>`
        });
      }

      setSubmissionLinks([{ type: "Manuscript", url: "" }]);
      await loadData();
    } catch (err) {
      console.error(err);
      setErrorDialog("Failed to submit links.");
    }
    setSubmittingLinks(false);
  };

  if (loading) {
    return <div className={styles.loading}>Loading your workspace...</div>;
  }

  if (!thesis) {
    return (
      <div className={styles.card} style={{ textAlign: "center" }}>
        <h2>No Thesis Assigned</h2>
        <p>You have not been assigned to a thesis project yet. Please contact your administrator.</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <h1>My Workspace</h1>
      </div>

      <div className={`${styles.card} ${styles.workspaceHeader}`}>
        <div>
          <h2 style={{ marginBottom: "10px", fontSize: "1.8rem" }}>{thesis.title}</h2>
          <div style={{ display: "flex", gap: "20px", color: "#7A7061", fontSize: "0.95rem", flexWrap: "wrap" }}>
            <span><strong>Year:</strong> {thesis.year || "-"}</span>
            <span><strong>Field:</strong> {thesis.fieldOfStudy || "-"}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }} className={styles.statusBadge}>
          <div style={{ fontSize: "0.85rem", color: "#7A7061", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "8px" }}>Current Status</div>
          <div style={{ padding: "8px 16px", background: "#EBE4D1", borderRadius: "999px", fontWeight: "bold", color: "#4A4238", border: "1px solid #D6CEB8", display: "inline-block" }}>
            {thesis.status}
          </div>
        </div>
      </div>

      {/* COUNTDOWN TIMER */}
      {(() => {
        let stageName = "";
        if (thesis.currentStage === 0 || thesis.status === "Revise" || thesis.status === "Preparing") stageName = "Advisor";
        else if (thesis.currentStage === 1) stageName = "Committee";
        else if (thesis.currentStage === 2) stageName = "Chairperson";

        return thesis.status !== "Approved" && (timeLeft || isLate) && (
        <div style={{ background: isLate ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)" : "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", borderRadius: "12px", padding: "20px 30px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", border: isLate ? "1px solid #fca5a5" : "1px solid #334155" }}>
          <div>
            <h3 style={{ margin: 0, color: isLate ? "#991b1b" : "#94a3b8", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "1px" }}>Current Stage Deadline ({stageName})</h3>
            <div style={{ color: isLate ? "#dc2626" : "#f8fafc", fontSize: "1.2rem", fontWeight: "bold", marginTop: "5px" }}>
              {isLate ? "Submission is LATE!" : "Time Remaining for Submission"}
            </div>
          </div>
          
          {!isLate && timeLeft && (
            <div style={{ display: "flex", gap: "15px", color: "#fff", textAlign: "center" }}>
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 15px", borderRadius: "8px", minWidth: "70px" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", lineHeight: "1" }}>{timeLeft.days}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "4px" }}>Days</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 15px", borderRadius: "8px", minWidth: "70px" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", lineHeight: "1" }}>{timeLeft.hours}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "4px" }}>Hours</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 15px", borderRadius: "8px", minWidth: "70px" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", lineHeight: "1" }}>{timeLeft.minutes}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "4px" }}>Mins</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.1)", padding: "10px 15px", borderRadius: "8px", minWidth: "70px" }}>
                <div style={{ fontSize: "1.8rem", fontWeight: "bold", lineHeight: "1" }}>{timeLeft.seconds}</div>
                <div style={{ fontSize: "0.7rem", color: "#94a3b8", textTransform: "uppercase", marginTop: "4px" }}>Secs</div>
              </div>
            </div>
          )}
        </div>
        );
      })()}

      <div className={styles.dashboardGrid}>
        
        {/* LEFT COLUMN */}
        <div>
          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>Abstract & Scope</h2>
              {!isEditing && (
                <button className={styles.btnPrimary} style={{ margin: 0, padding: "6px 12px", fontSize: "0.85rem" }} onClick={() => setIsEditing(true)}>
                  Propose Edits
                </button>
              )}
            </div>
            
            {thesis.pendingAbstract && !isEditing && (
              <div style={{ background: "#fef3c7", padding: "10px 15px", borderRadius: "6px", fontSize: "0.85rem", color: "#92400e", marginBottom: "20px", border: "1px solid #fcd34d" }}>
                <strong>Note:</strong> You have proposed edits pending approval from your Advisor.
              </div>
            )}

            {isEditing ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", color: "#4A4238", marginBottom: "5px" }}>Abstract</label>
                  <textarea 
                    value={editAbstract} 
                    onChange={e => setEditAbstract(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid #D6CEB8", minHeight: "150px", fontFamily: "inherit" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.9rem", fontWeight: "bold", color: "#4A4238", marginBottom: "5px" }}>Scope</label>
                  <textarea 
                    value={editScope} 
                    onChange={e => setEditScope(e.target.value)}
                    style={{ width: "100%", padding: "12px", borderRadius: "6px", border: "1px solid #D6CEB8", minHeight: "100px", fontFamily: "inherit" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                  <button className={styles.btnDanger} onClick={() => { setIsEditing(false); setEditAbstract(thesis.pendingAbstract || thesis.abstract); setEditScope(thesis.pendingScope || thesis.scope); }} disabled={submittingEdits}>Cancel</button>
                  <button className={styles.btnPrimary} style={{ margin: 0 }} onClick={handleProposeEdits} disabled={submittingEdits}>
                    {submittingEdits ? "Submitting..." : "Submit to Advisor"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                <div>
                  <h3 style={{ fontSize: "1rem", color: "#4A4238", margin: "0 0 5px 0" }}>Abstract</h3>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{thesis.pendingAbstract || thesis.abstract || "No abstract provided."}</p>
                </div>
                <div>
                  <h3 style={{ fontSize: "1rem", color: "#4A4238", margin: "0 0 5px 0" }}>Scope</h3>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{thesis.pendingScope || thesis.scope || "No scope provided."}</p>
                </div>
              </div>
            )}
          </div>

          <div className={styles.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ margin: 0 }}>Activity & Reviews</h2>
            </div>
            
            {activities.length === 0 ? (
              <p style={{ color: "#7A7061", fontStyle: "italic" }}>No activity recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {activities.map(act => (
                  <div key={act.id} style={{ background: "#FDF9F1", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <strong>{act.type}</strong>
                      <span style={{ fontSize: "0.8rem", color: "#7A7061" }}>{new Date(act.timestamp).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ margin: "0 0 10px 0", fontSize: "0.95rem" }}>{act.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", fontSize: "0.85rem", flexDirection: "column", gap: "10px" }}>
                      <span style={{ color: "#7A7061" }}>By: {act.actorEmail} ({act.actorRole})</span>
                      
                      {act.documentUrl && (
                        <a href={act.documentUrl} target="_blank" rel="noreferrer" style={{ color: "#3b82f6", fontWeight: "bold", textDecoration: "none", display: "flex", alignItems: "center", gap: "5px" }}>
                          <ExternalLink size={14} /> View Document ({act.documentName || "PDF"})
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
        </div>

        {/* RIGHT COLUMN */}
        <div>
          <div className={styles.card}>
            <h2 style={{ marginBottom: "20px" }}>Submit Materials</h2>
            <p style={{ fontSize: "0.9rem", marginBottom: "20px", color: "#7A7061" }}>
              Provide links to your manuscript, video clips, or other external resources.
            </p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "15px", marginBottom: "20px" }}>
              {submissionLinks.map((link, idx) => (
                <div key={idx} style={{ display: "flex", gap: "10px", alignItems: "center", background: "#FDF9F1", padding: "10px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                  <select 
                    value={link.type} 
                    onChange={e => handleLinkChange(idx, "type", e.target.value)}
                    style={{ padding: "8px", borderRadius: "4px", border: "1px solid #C6BFA5", background: "#fff", fontSize: "0.85rem" }}
                  >
                    <option value="Manuscript">Manuscript</option>
                    <option value="Video Clip">Video Clip</option>
                    <option value="Other documents">Other documents</option>
                  </select>
                  <input 
                    type="url" 
                    placeholder="https://..." 
                    value={link.url} 
                    onChange={e => handleLinkChange(idx, "url", e.target.value)}
                    style={{ flex: 1, padding: "8px", borderRadius: "4px", border: "1px solid #C6BFA5", fontSize: "0.85rem" }}
                  />
                  {submissionLinks.length > 1 && (
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
                <Plus size={16} /> Add another link
              </button>
            </div>

            <button 
              className={styles.btnPrimary} 
              style={{ width: "100%", margin: 0, padding: "12px", fontSize: "1rem" }} 
              onClick={handleSubmitLinks}
              disabled={submittingLinks}
            >
              {submittingLinks ? "Submitting..." : "Submit Materials"}
            </button>
          </div>

          <div className={styles.card}>
            <h2 style={{ marginBottom: "20px" }}>Assigned Lecturers</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
              <div>
                <strong style={{ display: "block", fontSize: "0.85rem", color: "#7A7061", textTransform: "uppercase", letterSpacing: "1px" }}>Chairperson</strong>
                {thesis.lecturerUids.chairperson ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "2px" }}>
                    <span style={{ color: "#4A4238" }}>{lecturersMap[thesis.lecturerUids.chairperson]?.name_en || lecturersMap[thesis.lecturerUids.chairperson]?.name_th || thesis.lecturerUids.chairperson}</span>
                    {(lecturersMap[thesis.lecturerUids.chairperson]?.name_en || lecturersMap[thesis.lecturerUids.chairperson]?.name_th) && (
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{thesis.lecturerUids.chairperson}</span>
                    )}
                  </div>
                ) : <span style={{ color: "#4A4238" }}>None</span>}
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "0.85rem", color: "#7A7061", textTransform: "uppercase", letterSpacing: "1px" }}>Committee</strong>
                {thesis.lecturerUids.committees.length > 0 ? (
                  <ul style={{ margin: "5px 0 0 0", paddingLeft: "20px", color: "#4A4238", display: "flex", flexDirection: "column", gap: "8px" }}>
                    {thesis.lecturerUids.committees.map(c => (
                      <li key={c}>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{lecturersMap[c]?.name_en || lecturersMap[c]?.name_th || c}</span>
                          {(lecturersMap[c]?.name_en || lecturersMap[c]?.name_th) && (
                            <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{c}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span style={{ color: "#4A4238" }}>None</span>
                )}
              </div>
              <div>
                <strong style={{ display: "block", fontSize: "0.85rem", color: "#7A7061", textTransform: "uppercase", letterSpacing: "1px" }}>Advisor</strong>
                {thesis.lecturerUids.advisor ? (
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "2px" }}>
                    <span style={{ color: "#4A4238" }}>{lecturersMap[thesis.lecturerUids.advisor]?.name_en || lecturersMap[thesis.lecturerUids.advisor]?.name_th || thesis.lecturerUids.advisor}</span>
                    {(lecturersMap[thesis.lecturerUids.advisor]?.name_en || lecturersMap[thesis.lecturerUids.advisor]?.name_th) && (
                      <span style={{ fontSize: "0.85rem", color: "#64748b" }}>{thesis.lecturerUids.advisor}</span>
                    )}
                  </div>
                ) : <span style={{ color: "#4A4238" }}>None</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

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
