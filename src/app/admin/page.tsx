"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";
import { getAllTheses } from "@/lib/db/theses";
import { getGroups } from "@/lib/db/groups";
import { getLecturers } from "@/lib/db/users";
import { 
  BookOpen, 
  Users, 
  UserCheck, 
  Clock, 
  Download, 
  Search, 
  ChevronRight, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ArrowLeft 
} from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalTheses: 0,
    statusBreakdown: {} as Record<string, number>,
    fieldBreakdown: {} as Record<string, number>,
    totalGroups: 0,
    totalLecturers: 0,
    lateThesesCount: 0,
    lecturerWorkload: [] as any[],
    loading: true
  });
  const [allTheses, setAllTheses] = useState<any[]>([]);
  const [allGroups, setAllGroups] = useState<any[]>([]);
  const [allLecturers, setAllLecturers] = useState<any[]>([]);
  const [activeStatusModal, setActiveStatusModal] = useState<string | null>(null);
  const [activeKpiModal, setActiveKpiModal] = useState<"Theses" | "Groups" | "Lecturers" | "Late" | null>(null);
  
  const getLecturerNameTh = (email: string) => {
    const l = allLecturers.find(l => l.email === email);
    return l ? (l.name_th || l.name_en || email) : email;
  };
  
  const [activeFieldModal, setActiveFieldModal] = useState<string | null>(null);
  const [fieldSearch, setFieldSearch] = useState("");
  const [fieldYear, setFieldYear] = useState("All");
  const [selectedFieldThesis, setSelectedFieldThesis] = useState<any | null>(null);
  
  const [workloadSearch, setWorkloadSearch] = useState("");
  const [workloadFieldFilter, setWorkloadFieldFilter] = useState("All");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [theses, groups, lecturers] = await Promise.all([
          getAllTheses(),
          getGroups(),
          getLecturers()
        ]);
        
        const breakdown: Record<string, number> = {
          "Preparing": 0,
          "Pending Advisor": 0,
          "Pending Committee": 0,
          "Pending Chairperson": 0,
          "Pending Sign. Advisor": 0,
          "Pending Sign. Committee": 0,
          "Pending Sign. Chairperson": 0,
          "Revise": 0,
          "Graduate": 0
        };

        const fieldBreakdown: Record<string, number> = {};
        let lateCount = 0;
        const workloadMap: Record<string, { email: string, name: string, fieldOfStudy: string, advisorCount: number, committeeCount: number, chairpersonCount: number, totalCount: number, advisorTheses: any[], committeeTheses: any[], chairpersonTheses: any[] }> = {};

        lecturers.forEach(l => {
          workloadMap[l.email] = {
            email: l.email,
            name: l.name_th || l.name_en || l.email,
            fieldOfStudy: l.fieldOfStudy || "-",
            advisorTheses: [],
            committeeTheses: [],
            chairpersonTheses: [],
            advisorCount: 0,
            committeeCount: 0,
            chairpersonCount: 0,
            totalCount: 0
          };
        });

        theses.forEach(t => {
          if (breakdown[t.status] !== undefined) {
            breakdown[t.status]++;
          } else {
            breakdown[t.status] = 1;
          }

          const field = t.fieldOfStudy || "Not Specified";
          fieldBreakdown[field] = (fieldBreakdown[field] || 0) + 1;

          if (t.currentStage < 3 && t.status !== "Graduate") {
            let deadline = undefined;
            if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") deadline = t.deadlines?.advisor;
            else if (t.currentStage === 1) deadline = t.deadlines?.committee;
            else if (t.currentStage === 2) deadline = t.deadlines?.chairperson;

            if (deadline && Date.now() > deadline) {
              lateCount++;
            }
          }

          if (t.status !== "Graduate") {
            const adv = t.lecturerUids?.advisor;
            const chair = t.lecturerUids?.chairperson;
            const comms = t.lecturerUids?.committees || [];

            const thesisSummary = {
              title: t.title,
              group: groups.find((g: any) => g.id === t.groupId)?.name || "Unknown Group",
              year: t.year || "-"
            };

            if (adv && workloadMap[adv]) { 
              workloadMap[adv].advisorCount++; 
              workloadMap[adv].totalCount++; 
              workloadMap[adv].advisorTheses.push(thesisSummary);
            }
            if (chair && workloadMap[chair]) { 
              workloadMap[chair].chairpersonCount++; 
              workloadMap[chair].totalCount++; 
              workloadMap[chair].chairpersonTheses.push(thesisSummary);
            }
            comms.forEach((c: string) => {
              if (workloadMap[c]) { 
                workloadMap[c].committeeCount++; 
                workloadMap[c].totalCount++; 
                workloadMap[c].committeeTheses.push(thesisSummary);
              }
            });
          }
        });

        const sortedWorkload = Object.values(workloadMap).sort((a, b) => b.totalCount - a.totalCount);

        setAllTheses(theses);
        setAllGroups(groups);
        setAllLecturers(lecturers);
        setStats({
          totalTheses: theses.length,
          statusBreakdown: breakdown,
          fieldBreakdown: fieldBreakdown,
          totalGroups: groups.length,
          totalLecturers: lecturers.length,
          lateThesesCount: lateCount,
          lecturerWorkload: sortedWorkload,
          loading: false
        });
      } catch (err) {
        console.error("Failed to load dashboard stats", err);
        setStats(prev => ({ ...prev, loading: false }));
      }
    };
    fetchStats();
  }, []);

  const handleExportCSV = () => {
    let csv = "Title,Status,Group,Field of Study,Advisor,Committee,Chairperson\n";
    allTheses.forEach(t => {
      const groupName = allGroups.find(g => g.id === t.groupId)?.name || "Unknown";
      const field = t.fieldOfStudy || allGroups.find(g => g.id === t.groupId)?.fieldOfStudy || "Unknown";
      const title = `"${t.title.replace(/"/g, '""')}"`;
      csv += `${title},${t.status},${groupName},${field},${t.lecturerUids?.advisor || ""},${t.lecturerUids?.committees?.join(";") || ""},${t.lecturerUids?.chairperson || ""}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "theses_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const workloadFields = Array.from(new Set(stats.lecturerWorkload.map(wl => wl.fieldOfStudy).filter(f => f && f !== "-")));
  
  const filteredWorkload = stats.lecturerWorkload.filter(wl => {
    const matchesSearch = wl.name.toLowerCase().includes(workloadSearch.toLowerCase());
    const matchesField = workloadFieldFilter === "All" || wl.fieldOfStudy === workloadFieldFilter;
    return matchesSearch && matchesField;
  });

  const renderTooltipHtml = (theses: any[]) => {
    if (!theses || theses.length === 0) return null;
    return (
      <div className={styles.tooltipContent}>
        {theses.map((t, idx) => (
          <div key={idx} style={{ marginBottom: idx === theses.length - 1 ? 0 : "8px", borderBottom: idx === theses.length - 1 ? "none" : "1px solid rgba(255,255,255,0.15)", paddingBottom: idx === theses.length - 1 ? 0 : "8px", whiteSpace: "normal", textAlign: "left" }}>
            <div style={{ fontWeight: 600, lineHeight: "1.25" }}>{t.title}</div>
            <div style={{ color: "#cbd5e1", fontSize: "0.72rem", marginTop: "3px" }}>Group: {t.group} · Year: {t.year}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: 0 }}>Executive Dashboard</h1>
          <p style={{ color: "var(--text-muted)", margin: "4px 0 0 0", fontSize: "0.9rem" }}>Real-time overview of theses, milestones, and faculty workload</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className={styles.btnSecondary}
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>
      
      {stats.loading ? (
        <div className={styles.loading}>
          <div className={styles.loadingSpinner}></div>
          <span>Loading metrics...</span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* KPI Metric Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px" }}>
            <div 
              className={styles.card} 
              style={{ padding: "22px 24px", cursor: "pointer", background: "var(--bg-card)", borderColor: "var(--primary-border)" }}
              onClick={() => setActiveKpiModal("Theses")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Total Theses</span>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--primary-light)", color: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <BookOpen size={18} />
                </div>
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--primary-color)", lineHeight: 1 }}>{stats.totalTheses}</div>
            </div>

            <div 
              className={styles.card} 
              style={{ padding: "22px 24px", cursor: "pointer", background: "var(--bg-card)", borderColor: "var(--success-border)" }}
              onClick={() => setActiveKpiModal("Groups")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Student Groups</span>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--success-bg)", color: "var(--success-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Users size={18} />
                </div>
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--success-color)", lineHeight: 1 }}>{stats.totalGroups}</div>
            </div>

            <div 
              className={styles.card} 
              style={{ padding: "22px 24px", cursor: "pointer", background: "var(--bg-card)", borderColor: "var(--purple-border)" }}
              onClick={() => setActiveKpiModal("Lecturers")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 600 }}>Faculty Lecturers</span>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--purple-bg)", color: "var(--purple-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <UserCheck size={18} />
                </div>
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--purple-color)", lineHeight: 1 }}>{stats.totalLecturers}</div>
            </div>

            <div 
              className={styles.card} 
              style={{ padding: "22px 24px", cursor: "pointer", background: "var(--bg-card)", borderColor: "var(--danger-border)" }}
              onClick={() => setActiveKpiModal("Late")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--danger-text)", fontWeight: 700 }}>Overdue Projects</span>
                <div style={{ width: "36px", height: "36px", borderRadius: "var(--radius-sm)", background: "var(--danger-bg)", color: "var(--danger-color)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={18} />
                </div>
              </div>
              <div style={{ fontSize: "2.4rem", fontWeight: 800, color: "var(--danger-color)", lineHeight: 1 }}>{stats.lateThesesCount}</div>
            </div>
          </div>

          {/* Breakdown Section */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: "20px" }}>
            
            {/* Thesis Status Overview */}
            <div className={styles.card}>
              <h2>Review Stage Overview</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(stats.statusBreakdown)
                  .filter(([status]) => ["Preparing", "Pending Advisor", "Pending Committee", "Pending Chairperson", "Revise", "Graduate"].includes(status))
                  .map(([status, count]) => {
                  const percentage = stats.totalTheses === 0 ? 0 : Math.round((count / stats.totalTheses) * 100);
                  
                  let barColor = "var(--primary-color)";
                  if (status === "Graduate") barColor = "var(--success-color)";
                  else if (status === "Revise") barColor = "var(--danger-color)";
                  else if (status === "Pending Chairperson") barColor = "var(--info-color)";
                  else if (status === "Pending Committee") barColor = "var(--purple-color)";
                  else if (status === "Pending Advisor") barColor = "var(--warning-color)";

                  let icon = "📄";
                  if (status === "Pending Advisor") icon = "📝";
                  if (status === "Pending Committee") icon = "👥";
                  if (status === "Pending Chairperson") icon = "👨‍⚖️";
                  if (status === "Graduate") icon = "🎓";

                  return (
                    <div 
                      key={status} 
                      onClick={() => setActiveStatusModal(status)}
                      style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "8px 10px", borderRadius: "var(--radius-sm)", transition: "all 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-lighter)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ width: "170px", fontWeight: 600, color: "var(--text-main)", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {icon} {status}
                      </div>
                      <div style={{ flex: 1, background: "var(--bg-subtle)", height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, background: barColor, borderRadius: "999px", transition: "width 0.4s ease" }}></div>
                      </div>
                      <div style={{ width: "36px", textAlign: "right", color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: 700 }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Signature Stage Overview */}
            <div className={styles.card}>
              <h2>Signature Stage Overview</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(stats.statusBreakdown)
                  .filter(([status]) => ["Pending Sign. Advisor", "Pending Sign. Committee", "Pending Sign. Chairperson"].includes(status))
                  .map(([status, count]) => {
                  const percentage = stats.totalTheses === 0 ? 0 : Math.round((count / stats.totalTheses) * 100);
                  
                  let barColor = "var(--warning-color)";
                  if (status === "Pending Sign. Committee") barColor = "var(--purple-color)";
                  else if (status === "Pending Sign. Chairperson") barColor = "var(--info-color)";

                  let icon = "✒️";
                  if (status === "Pending Sign. Committee") icon = "🖊️";
                  if (status === "Pending Sign. Chairperson") icon = "🖋️";

                  return (
                    <div 
                      key={status} 
                      onClick={() => setActiveStatusModal(status)}
                      style={{ display: "flex", alignItems: "center", gap: "12px", cursor: "pointer", padding: "8px 10px", borderRadius: "var(--radius-sm)", transition: "all 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-lighter)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ width: "190px", fontWeight: 600, color: "var(--text-main)", fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {icon} {status}
                      </div>
                      <div style={{ flex: 1, background: "var(--bg-subtle)", height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, background: barColor, borderRadius: "999px", transition: "width 0.4s ease" }}></div>
                      </div>
                      <div style={{ width: "36px", textAlign: "right", color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: 700 }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Theses by Field of Study */}
            <div className={styles.card}>
              <h2>Theses by Field of Study</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {Object.entries(stats.fieldBreakdown).sort((a,b) => b[1] - a[1]).map(([field, count]) => {
                  const percentage = stats.totalTheses === 0 ? 0 : Math.round((count / stats.totalTheses) * 100);
                  return (
                    <div 
                      key={field} 
                      onClick={() => setActiveFieldModal(field)}
                      style={{ display: "flex", alignItems: "center", gap: "12px", padding: "8px 10px", cursor: "pointer", borderRadius: "var(--radius-sm)", transition: "all 0.15s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-lighter)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ width: "190px", fontWeight: 600, color: "var(--text-main)", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={field}>
                        {field}
                      </div>
                      <div style={{ flex: 1, background: "var(--bg-subtle)", height: "8px", borderRadius: "999px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, background: "var(--primary-color)", borderRadius: "999px" }}></div>
                      </div>
                      <div style={{ width: "36px", textAlign: "right", color: "var(--text-muted)", fontSize: "0.88rem", fontWeight: 700 }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lecturer Workload Table */}
          <div className={styles.card}>
            <h2>Faculty Workload Balance Matrix</h2>
            
            <div style={{ display: "flex", gap: "12px", marginBottom: "18px", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <input 
                  type="text" 
                  placeholder="Search faculty by name..." 
                  value={workloadSearch} 
                  onChange={(e) => setWorkloadSearch(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px 8px 36px", border: "1.5px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontFamily: "inherit", fontSize: "0.9rem", outline: "none", background: "#ffffff" }}
                />
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
              </div>
              <select 
                value={workloadFieldFilter} 
                onChange={(e) => setWorkloadFieldFilter(e.target.value)}
                style={{ padding: "8px 14px", border: "1.5px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontFamily: "inherit", fontSize: "0.9rem", background: "#ffffff", outline: "none" }}
              >
                <option value="All">All Fields of Study</option>
                {workloadFields.map(f => <option key={f as string} value={f as string}>{f as string}</option>)}
              </select>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Faculty Member</th>
                    <th style={{ textAlign: "center" }}>Advisor Role</th>
                    <th style={{ textAlign: "center" }}>Committee Role</th>
                    <th style={{ textAlign: "center" }}>Chairperson Role</th>
                    <th style={{ textAlign: "center" }}>Total Active</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkload.slice(0, 10).map((wl: any) => (
                    <tr key={wl.email}>
                      <td>
                        <strong style={{ color: "var(--text-main)", fontSize: "0.92rem" }}>{wl.name}</strong><br/>
                        <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{wl.fieldOfStudy}</span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.advisorCount > 0 ? "var(--primary-light)" : "var(--bg-subtle)", color: wl.advisorCount > 0 ? "var(--primary-color)" : "var(--text-light)", padding: "3px 10px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "0.82rem", cursor: wl.advisorCount > 0 ? "help" : "default" }}>
                            {wl.advisorCount}
                          </span>
                          {wl.advisorCount > 0 && renderTooltipHtml(wl.advisorTheses)}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.committeeCount > 0 ? "var(--purple-bg)" : "var(--bg-subtle)", color: wl.committeeCount > 0 ? "var(--purple-text)" : "var(--text-light)", padding: "3px 10px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "0.82rem", cursor: wl.committeeCount > 0 ? "help" : "default" }}>
                            {wl.committeeCount}
                          </span>
                          {wl.committeeCount > 0 && renderTooltipHtml(wl.committeeTheses)}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.chairpersonCount > 0 ? "var(--info-bg)" : "var(--bg-subtle)", color: wl.chairpersonCount > 0 ? "var(--info-text)" : "var(--text-light)", padding: "3px 10px", borderRadius: "var(--radius-full)", fontWeight: 700, fontSize: "0.82rem", cursor: wl.chairpersonCount > 0 ? "help" : "default" }}>
                            {wl.chairpersonCount}
                          </span>
                          {wl.chairpersonCount > 0 && renderTooltipHtml(wl.chairpersonTheses)}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <strong style={{ fontSize: "1rem", color: "var(--text-main)" }}>{wl.totalCount}</strong>
                      </td>
                    </tr>
                  ))}
                  {filteredWorkload.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-light)" }}>No workload records match your criteria.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Insights Modal */}
      {activeStatusModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveStatusModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "760px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)" }}>
                Theses marked as "{activeStatusModal}"
              </h2>
              <button className={styles.modalClose} onClick={() => setActiveStatusModal(null)}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "65vh", overflowY: "auto" }}>
              {allTheses.filter(t => t.status === activeStatusModal).length === 0 ? (
                <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No theses found with this status.</p>
              ) : (
                allTheses.filter(t => t.status === activeStatusModal).map(t => {
                  const group = allGroups.find(g => g.id === t.groupId);
                  return (
                    <div key={t.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                      <div style={{ fontWeight: 700, color: "var(--primary-color)", fontSize: "0.95rem", marginBottom: "6px" }}>{t.title}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        <div><strong style={{ color: "var(--text-main)" }}>Group:</strong> {group?.name || "-"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Field:</strong> {group?.fieldOfStudy || t.fieldOfStudy || "-"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Insights Modal */}
      {activeKpiModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveKpiModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "760px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)" }}>
                {activeKpiModal} Overview
              </h2>
              <button className={styles.modalClose} onClick={() => setActiveKpiModal(null)}>&times;</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "65vh", overflowY: "auto" }}>
              {activeKpiModal === "Theses" && allTheses.map(t => {
                const group = allGroups.find(g => g.id === t.groupId);
                return (
                  <div key={t.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontWeight: 700, color: "var(--primary-color)", fontSize: "0.95rem", marginBottom: "6px" }}>{t.title}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      <div><strong style={{ color: "var(--text-main)" }}>Status:</strong> {t.status}</div>
                      <div><strong style={{ color: "var(--text-main)" }}>Group:</strong> {group?.name || "-"}</div>
                      <div><strong style={{ color: "var(--text-main)" }}>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                    </div>
                  </div>
                );
              })}

              {activeKpiModal === "Groups" && allGroups.map(g => (
                <div key={g.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontWeight: 700, color: "var(--success-color)", fontSize: "0.95rem", marginBottom: "4px" }}>{g.name}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}><strong style={{ color: "var(--text-main)" }}>Field of Study:</strong> {g.fieldOfStudy || "-"}</div>
                </div>
              ))}

              {activeKpiModal === "Lecturers" && allLecturers.map(l => (
                <div key={l.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontWeight: 700, color: "var(--purple-color)", fontSize: "0.95rem", marginBottom: "4px" }}>{l.name_en || l.name_th || "Unnamed"}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "2px" }}><strong style={{ color: "var(--text-main)" }}>Email:</strong> {l.email}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}><strong style={{ color: "var(--text-main)" }}>Role:</strong> {l.role}</div>
                </div>
              ))}

              {activeKpiModal === "Late" && allTheses.filter(t => {
                if (t.status === "Graduate") return false;
                let deadline = undefined;
                if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") deadline = t.deadlines?.advisor;
                else if (t.currentStage === 1) deadline = t.deadlines?.committee;
                else if (t.currentStage === 2) deadline = t.deadlines?.chairperson;
                return deadline && Date.now() > deadline;
              }).map(t => {
                const group = allGroups.find(g => g.id === t.groupId);
                let deadline = undefined;
                let stageName = "";
                if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") { deadline = t.deadlines?.advisor; stageName = "Advisor"; }
                else if (t.currentStage === 1) { deadline = t.deadlines?.committee; stageName = "Committee"; }
                else if (t.currentStage === 2) { deadline = t.deadlines?.chairperson; stageName = "Chairperson"; }
                
                return (
                  <div key={t.id} style={{ background: "var(--danger-bg)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--danger-border)" }}>
                    <div style={{ fontWeight: 700, color: "var(--danger-color)", fontSize: "0.95rem", marginBottom: "6px" }}>{t.title}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.82rem", color: "var(--danger-text)" }}>
                      <div><strong>Status:</strong> {t.status}</div>
                      <div><strong>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                      <div><strong>Missed Deadline:</strong> {new Date(deadline).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({stageName})</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Field Modal */}
      {activeFieldModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveFieldModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()} style={{ width: "840px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", paddingBottom: "14px", borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px" }}>
                {selectedFieldThesis ? (
                  <>
                    <button onClick={() => setSelectedFieldThesis(null)} className={styles.btnSecondary} style={{ padding: "4px 10px", fontSize: "0.82rem" }}>
                      <ArrowLeft size={14} /> Back
                    </button>
                    <span>Thesis Details</span>
                  </>
                ) : (
                  `Theses in: ${activeFieldModal}`
                )}
              </h2>
              <button className={styles.modalClose} onClick={() => { setActiveFieldModal(null); setSelectedFieldThesis(null); }}>&times;</button>
            </div>

            <div>
              {selectedFieldThesis ? (
                <div style={{ background: "var(--bg-subtle)", padding: "22px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)" }}>
                  <h3 style={{ margin: "0 0 14px 0", color: "var(--primary-color)", fontSize: "1.2rem" }}>{selectedFieldThesis.title}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", fontSize: "0.88rem" }}>
                    <div><strong>Status:</strong> <span style={{ padding: "3px 8px", background: "#fff", border: "1px solid var(--border-color)", borderRadius: "4px", fontSize: "0.8rem", fontWeight: 600 }}>{selectedFieldThesis.status}</span></div>
                    <div><strong>Year:</strong> {selectedFieldThesis.year || "-"}</div>
                    <div><strong>Group:</strong> {allGroups.find(g => g.id === selectedFieldThesis.groupId)?.name || "-"}</div>
                    <div><strong>Field:</strong> {selectedFieldThesis.fieldOfStudy || "-"}</div>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px", marginBottom: "14px" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Abstract</h4>
                    <p style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-main)", margin: 0 }}>{selectedFieldThesis.abstract || "No abstract provided."}</p>
                  </div>
                  <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                    <h4 style={{ margin: "0 0 6px 0", fontSize: "0.9rem", color: "var(--text-muted)", textTransform: "uppercase" }}>Scope</h4>
                    <p style={{ fontSize: "0.9rem", lineHeight: 1.6, whiteSpace: "pre-wrap", color: "var(--text-main)", margin: 0 }}>{selectedFieldThesis.scope || "No scope provided."}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
                    <input 
                      type="text" 
                      placeholder="Search by title..." 
                      value={fieldSearch}
                      onChange={e => setFieldSearch(e.target.value)}
                      style={{ flex: 1, padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontSize: "0.9rem", outline: "none", background: "#ffffff" }}
                    />
                    <select 
                      value={fieldYear}
                      onChange={e => setFieldYear(e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontSize: "0.9rem", background: "#ffffff", outline: "none" }}
                    >
                      <option value="All">All Years</option>
                      {Array.from(new Set(allTheses.map(t => t.year).filter(y => y))).sort().reverse().map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const filtered = allTheses.filter(t => {
                      const tField = t.fieldOfStudy || allGroups.find(g => g.id === t.groupId)?.fieldOfStudy;
                      if (tField !== activeFieldModal) return false;
                      const matchesSearch = t.title.toLowerCase().includes(fieldSearch.toLowerCase());
                      const matchesYear = fieldYear === "All" || t.year === fieldYear;
                      return matchesSearch && matchesYear;
                    });

                    if (filtered.length === 0) return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No matching theses found.</p>;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "55vh", overflowY: "auto" }}>
                        {filtered.map(t => (
                          <div 
                            key={t.id} 
                            onClick={() => setSelectedFieldThesis(t)}
                            style={{ background: "var(--bg-subtle)", padding: "14px 16px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", cursor: "pointer", transition: "all 0.15s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary-color)"; e.currentTarget.style.backgroundColor = "var(--primary-lighter)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border-color)"; e.currentTarget.style.backgroundColor = "var(--bg-subtle)"; }}
                          >
                            <div style={{ fontWeight: 700, color: "var(--primary-color)", fontSize: "0.92rem", marginBottom: "4px" }}>{t.title}</div>
                            <div style={{ display: "flex", gap: "14px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                              <div><strong style={{ color: "var(--text-main)" }}>Year:</strong> {t.year || "-"}</div>
                              <div><strong style={{ color: "var(--text-main)" }}>Status:</strong> {t.status}</div>
                              <div><strong style={{ color: "var(--text-main)" }}>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
