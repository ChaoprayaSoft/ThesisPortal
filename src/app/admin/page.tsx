"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  ArrowLeft,
  FolderKanban,
  Mail,
  ExternalLink
} from "lucide-react";
import StatusBadge from "@/components/StatusBadge";

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
  const [kpiModalSearch, setKpiModalSearch] = useState("");
  
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
        <div className={styles.modalOverlay} onClick={() => { setActiveStatusModal(null); setKpiModalSearch(""); }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", paddingBottom: "14px", borderBottom: "1px solid var(--border-color)" }}>
              <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: "10px" }}>
                <span>Theses marked as:</span>
                <StatusBadge status={activeStatusModal} size="md" />
              </h2>
              <button className={styles.modalClose} onClick={() => { setActiveStatusModal(null); setKpiModalSearch(""); }}>&times;</button>
            </div>

            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
              <input
                type="text"
                placeholder="Search theses by title, group, advisor..."
                value={kpiModalSearch}
                onChange={e => setKpiModalSearch(e.target.value)}
                style={{ width: "100%", padding: "9px 12px 9px 36px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", background: "#ffffff" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto" }}>
              {(() => {
                const query = kpiModalSearch.toLowerCase().trim();
                const filtered = allTheses.filter(t => t.status === activeStatusModal).filter(t => {
                  if (!query) return true;
                  const group = allGroups.find(g => g.id === t.groupId);
                  const titleMatch = (t.title || "").toLowerCase().includes(query);
                  const groupMatch = (group?.name || "").toLowerCase().includes(query);
                  const advMatch = t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor).toLowerCase().includes(query) : false;
                  return titleMatch || groupMatch || advMatch;
                });

                if (filtered.length === 0) {
                  return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No theses found matching this status and search.</p>;
                }

                return filtered.map(t => {
                  const group = allGroups.find(g => g.id === t.groupId);
                  return (
                    <div key={t.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary-color)", fontSize: "0.95rem" }}>{t.title}</div>
                        <Link href="/admin/thesis" className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                          View ➔
                        </Link>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        <div><strong style={{ color: "var(--text-main)" }}>Group:</strong> {group?.name || "-"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Field:</strong> {group?.fieldOfStudy || t.fieldOfStudy || "-"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Year:</strong> {t.year || "-"}</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* KPI Insights Modal */}
      {activeKpiModal && (
        <div className={styles.modalOverlay} onClick={() => { setActiveKpiModal(null); setKpiModalSearch(""); }}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", paddingBottom: "14px", borderBottom: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ 
                  width: "36px", 
                  height: "36px", 
                  borderRadius: "var(--radius-sm)", 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center",
                  background: activeKpiModal === "Theses" ? "var(--primary-light)" : activeKpiModal === "Groups" ? "var(--success-bg)" : activeKpiModal === "Lecturers" ? "var(--purple-bg)" : "var(--danger-bg)",
                  color: activeKpiModal === "Theses" ? "var(--primary-color)" : activeKpiModal === "Groups" ? "var(--success-color)" : activeKpiModal === "Lecturers" ? "var(--purple-color)" : "var(--danger-color)"
                }}>
                  {activeKpiModal === "Theses" && <BookOpen size={20} />}
                  {activeKpiModal === "Groups" && <Users size={20} />}
                  {activeKpiModal === "Lecturers" && <UserCheck size={20} />}
                  {activeKpiModal === "Late" && <Clock size={20} />}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.25rem", color: "var(--text-main)" }}>
                    {activeKpiModal === "Theses" && "Total Theses Overview"}
                    {activeKpiModal === "Groups" && "Student Groups Overview"}
                    {activeKpiModal === "Lecturers" && "Faculty Lecturers Overview"}
                    {activeKpiModal === "Late" && "Overdue Projects Overview"}
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {activeKpiModal === "Theses" && `Showing ${allTheses.length} registered thesis projects`}
                    {activeKpiModal === "Groups" && `Showing ${allGroups.length} cohorts with roster details`}
                    {activeKpiModal === "Lecturers" && `Showing ${allLecturers.length} academic committee members`}
                    {activeKpiModal === "Late" && `Projects that have exceeded their designated stage deadlines`}
                  </p>
                </div>
              </div>
              <button className={styles.modalClose} onClick={() => { setActiveKpiModal(null); setKpiModalSearch(""); }}>&times;</button>
            </div>

            {/* Instant Search Bar */}
            <div style={{ position: "relative", marginBottom: "16px" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-light)" }} />
              <input
                type="text"
                placeholder={
                  activeKpiModal === "Theses" ? "Search by thesis title, advisor, or group..." :
                  activeKpiModal === "Groups" ? "Search by group name, student ID, student name, or major..." :
                  activeKpiModal === "Lecturers" ? "Search by faculty name, email, or department..." :
                  "Search overdue projects..."
                }
                value={kpiModalSearch}
                onChange={e => setKpiModalSearch(e.target.value)}
                style={{ width: "100%", padding: "10px 14px 10px 38px", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--border-color)", fontSize: "0.88rem", outline: "none", boxSizing: "border-box", background: "#ffffff" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "60vh", overflowY: "auto" }}>
              {/* 1. THESES KPI MODAL */}
              {activeKpiModal === "Theses" && (() => {
                const query = kpiModalSearch.toLowerCase().trim();
                const filtered = allTheses.filter(t => {
                  if (!query) return true;
                  const group = allGroups.find(g => g.id === t.groupId);
                  const titleMatch = (t.title || "").toLowerCase().includes(query);
                  const groupMatch = (group?.name || "").toLowerCase().includes(query);
                  const advMatch = t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor).toLowerCase().includes(query) : false;
                  return titleMatch || groupMatch || advMatch;
                });

                if (filtered.length === 0) {
                  return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No theses match your search.</p>;
                }

                return filtered.map(t => {
                  const group = allGroups.find(g => g.id === t.groupId);
                  return (
                    <div key={t.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ fontWeight: 700, color: "var(--primary-color)", fontSize: "0.95rem" }}>{t.title}</div>
                        <Link href="/admin/thesis" className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                          View ➔
                        </Link>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><strong style={{ color: "var(--text-main)" }}>Status:</strong> <StatusBadge status={t.status} stage={t.currentStage} size="sm" /></div>
                        <div><strong style={{ color: "var(--text-main)" }}>Group:</strong> {group?.name || "-"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                        <div><strong style={{ color: "var(--text-main)" }}>Year:</strong> {t.year || "-"}</div>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* 2. STUDENT GROUPS KPI MODAL */}
              {activeKpiModal === "Groups" && (() => {
                const query = kpiModalSearch.toLowerCase().trim();
                const filtered = allGroups.filter(g => {
                  if (!query) return true;
                  const nameMatch = (g.name || "").toLowerCase().includes(query);
                  const fieldMatch = (g.fieldOfStudy || "").toLowerCase().includes(query);
                  const studentMatch = (g.students || []).some((s: any) => 
                    (s.name || "").toLowerCase().includes(query) ||
                    (s.name_en || "").toLowerCase().includes(query) ||
                    (s.studentId || "").toLowerCase().includes(query) ||
                    (s.email || "").toLowerCase().includes(query)
                  );
                  return nameMatch || fieldMatch || studentMatch;
                });

                if (filtered.length === 0) {
                  return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No student groups match your search.</p>;
                }

                return filtered.map(g => {
                  const thesis = allTheses.find(t => t.groupId === g.id);
                  return (
                    <div key={g.id} style={{ background: "var(--bg-subtle)", padding: "16px 20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "8px" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--text-main)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "8px" }}>
                            <FolderKanban size={16} style={{ color: "var(--success-color)" }} />
                            <span>{g.name}</span>
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "3px" }}>
                            <strong>Field of Study:</strong> {g.fieldOfStudy || "-"}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 600, padding: "3px 9px", borderRadius: "var(--radius-full)", background: "var(--success-bg)", color: "var(--success-color)" }}>
                            👥 {g.students?.length || 0} Students
                          </span>
                          <Link href="/admin/groups" className={styles.btnSecondary} style={{ padding: "4px 10px", fontSize: "0.78rem" }}>
                            Manage ➔
                          </Link>
                        </div>
                      </div>

                      {/* Linked Thesis Information */}
                      {thesis ? (
                        <div style={{ background: "#ffffff", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "10px", fontSize: "0.82rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: "200px" }}>
                            <BookOpen size={14} style={{ color: "var(--primary-color)" }} />
                            <span style={{ fontWeight: 600, color: "var(--primary-color)" }}>{thesis.title}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <StatusBadge status={thesis.status} stage={thesis.currentStage} size="sm" />
                            <span style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                              Advisor: <strong>{thesis.lecturerUids?.advisor ? getLecturerNameTh(thesis.lecturerUids.advisor) : "None"}</strong>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8rem", color: "var(--text-light)", fontStyle: "italic" }}>
                          No thesis record linked to this group yet.
                        </div>
                      )}

                      {/* Student Roster Chips */}
                      {g.students && g.students.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "2px" }}>
                          {g.students.map((s: any, idx: number) => (
                            <span key={idx} style={{ background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", padding: "3px 8px", fontSize: "0.75rem", color: "var(--text-main)", display: "inline-flex", alignItems: "center", gap: "5px" }}>
                              <span style={{ fontWeight: 600, color: "var(--primary-color)" }}>{s.studentId || "-"}</span>
                              <span>{s.name || s.name_en || s.email}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                });
              })()}

              {/* 3. LECTURERS KPI MODAL */}
              {activeKpiModal === "Lecturers" && (() => {
                const query = kpiModalSearch.toLowerCase().trim();
                const filtered = allLecturers.filter(l => {
                  if (!query) return true;
                  const nameTh = (l.name_th || "").toLowerCase().includes(query);
                  const nameEn = (l.name_en || "").toLowerCase().includes(query);
                  const emailMatch = (l.email || "").toLowerCase().includes(query);
                  const fieldMatch = (l.fieldOfStudy || "").toLowerCase().includes(query);
                  return nameTh || nameEn || emailMatch || fieldMatch;
                });

                if (filtered.length === 0) {
                  return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No lecturers match your search.</p>;
                }

                return filtered.map(l => {
                  const wl = stats.lecturerWorkload.find(w => w.email === l.email) || { advisorCount: 0, committeeCount: 0, chairpersonCount: 0, totalCount: 0 };
                  return (
                    <div key={l.id} style={{ background: "var(--bg-subtle)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--purple-color)", fontSize: "0.95rem" }}>
                            {l.name_th ? `${l.name_th} (${l.name_en || "-"})` : (l.name_en || l.email)}
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                            <Mail size={12} />
                            <span>{l.email}</span>
                            <span>&bull;</span>
                            <span>{l.fieldOfStudy || "No Department"}</span>
                          </div>
                        </div>
                        <Link href="/admin/lecturers" className={styles.btnSecondary} style={{ padding: "4px 8px", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                          Manage ➔
                        </Link>
                      </div>

                      {/* Workload badges */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "0.78rem", paddingTop: "4px" }}>
                        <span style={{ background: "var(--primary-light)", color: "var(--primary-color)", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600 }}>
                          Advisor: {wl.advisorCount}
                        </span>
                        <span style={{ background: "var(--purple-bg)", color: "var(--purple-text)", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600 }}>
                          Committee: {wl.committeeCount}
                        </span>
                        <span style={{ background: "var(--info-bg)", color: "var(--info-text)", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 600 }}>
                          Chairperson: {wl.chairpersonCount}
                        </span>
                        <span style={{ background: "#ffffff", border: "1px solid var(--border-color)", color: "var(--text-main)", padding: "2px 8px", borderRadius: "var(--radius-full)", fontWeight: 700 }}>
                          Total: {wl.totalCount}
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}

              {/* 4. OVERDUE PROJECTS MODAL */}
              {activeKpiModal === "Late" && (() => {
                const lateTheses = allTheses.filter(t => {
                  if (t.status === "Graduate") return false;
                  let deadline = undefined;
                  if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") deadline = t.deadlines?.advisor;
                  else if (t.currentStage === 1) deadline = t.deadlines?.committee;
                  else if (t.currentStage === 2) deadline = t.deadlines?.chairperson;
                  return deadline && Date.now() > deadline;
                });

                const query = kpiModalSearch.toLowerCase().trim();
                const filtered = lateTheses.filter(t => {
                  if (!query) return true;
                  const group = allGroups.find(g => g.id === t.groupId);
                  const titleMatch = (t.title || "").toLowerCase().includes(query);
                  const groupMatch = (group?.name || "").toLowerCase().includes(query);
                  const advMatch = t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor).toLowerCase().includes(query) : false;
                  return titleMatch || groupMatch || advMatch;
                });

                if (filtered.length === 0) {
                  return <p style={{ color: "var(--text-light)", fontStyle: "italic", textAlign: "center", padding: "30px 0" }}>No overdue projects found matching your search.</p>;
                }

                return filtered.map(t => {
                  const group = allGroups.find(g => g.id === t.groupId);
                  let deadline: any = undefined;
                  let stageName = "";
                  if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") { deadline = t.deadlines?.advisor; stageName = "Advisor Stage"; }
                  else if (t.currentStage === 1) { deadline = t.deadlines?.committee; stageName = "Committee Stage"; }
                  else if (t.currentStage === 2) { deadline = t.deadlines?.chairperson; stageName = "Chairperson Stage"; }
                  
                  const daysOverdue = Math.floor((Date.now() - deadline) / (1000 * 60 * 60 * 24));

                  return (
                    <div key={t.id} style={{ background: "var(--danger-bg)", padding: "16px 18px", borderRadius: "var(--radius-md)", border: "1px solid var(--danger-border)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div style={{ fontWeight: 700, color: "var(--danger-color)", fontSize: "0.95rem" }}>{t.title}</div>
                        <span style={{ background: "var(--danger-color)", color: "#ffffff", padding: "3px 8px", borderRadius: "var(--radius-full)", fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}>
                          ⚠️ Overdue by {daysOverdue} {daysOverdue === 1 ? "day" : "days"}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", fontSize: "0.82rem", color: "var(--danger-text)" }}>
                        <div><strong>Group:</strong> {group?.name || "-"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><strong>Status:</strong> <StatusBadge status={t.status} stage={t.currentStage} size="sm" /></div>
                        <div><strong>Advisor:</strong> {t.lecturerUids?.advisor ? getLecturerNameTh(t.lecturerUids.advisor) : "None"}</div>
                        <div><strong>Deadline:</strong> {new Date(deadline).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({stageName})</div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Field Modal */}
      {activeFieldModal && (
        <div className={styles.modalOverlay} onClick={() => setActiveFieldModal(null)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
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
