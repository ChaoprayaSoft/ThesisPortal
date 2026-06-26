"use client";

import { useEffect, useState } from "react";
import styles from "./admin.module.css";
import { getAllTheses } from "@/lib/db/theses";
import { getGroups } from "@/lib/db/groups";
import { getLecturers } from "@/lib/db/users";

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
          "Revise": 0,
          "Approved": 0
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
          // Status Breakdown
          if (breakdown[t.status] !== undefined) {
            breakdown[t.status]++;
          } else {
            breakdown[t.status] = 1;
          }

          // Field Breakdown
          const field = t.fieldOfStudy || "Not Specified";
          fieldBreakdown[field] = (fieldBreakdown[field] || 0) + 1;

          // Late Theses Calculation
          if (t.status !== "Approved") {
            let deadline = undefined;
            if (t.currentStage === 0 || t.status === "Revise" || t.status === "Preparing") deadline = t.deadlines?.advisor;
            else if (t.currentStage === 1) deadline = t.deadlines?.committee;
            else if (t.currentStage === 2) deadline = t.deadlines?.chairperson;

            if (deadline && Date.now() > deadline) {
              lateCount++;
            }
          }

          // Workload Calculation (only for non-approved theses, or all?)
          if (t.status !== "Approved") {
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
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel Thai chars
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
          <div key={idx} style={{ marginBottom: idx === theses.length - 1 ? 0 : "8px", borderBottom: idx === theses.length - 1 ? "none" : "1px solid rgba(255,255,255,0.1)", paddingBottom: idx === theses.length - 1 ? 0 : "8px", whiteSpace: "normal", textAlign: "left" }}>
            <div style={{ fontWeight: "bold", lineHeight: "1.2" }}>{t.title}</div>
            <div style={{ color: "#D6CEB8", fontSize: "0.75rem", marginTop: "4px" }}>Group: {t.group} | Year: {t.year}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px" }}>
        <h1 style={{ margin: 0 }}><span className={styles.gradientText}>Admin Dashboard</span></h1>
        <button 
          onClick={handleExportCSV}
          className={styles.btnPrimary}
          style={{ background: "#10b981", border: "1px solid #059669", padding: "10px 20px" }}
        >
          Export Data (CSV)
        </button>
      </div>
      
      {stats.loading ? (
        <div className={styles.loading}>Loading statistics...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
            <div 
              className={styles.card} 
              style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setActiveKpiModal("Theses")}
            >
              <div style={{ fontSize: "3rem", fontWeight: "bold", color: "#3b82f6" }}>{stats.totalTheses}</div>
              <div style={{ fontSize: "1.1rem", color: "#4A4238", fontWeight: "bold" }}>Total Theses</div>
            </div>
            <div 
              className={styles.card} 
              style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setActiveKpiModal("Groups")}
            >
              <div style={{ fontSize: "3rem", fontWeight: "bold", color: "#10b981" }}>{stats.totalGroups}</div>
              <div style={{ fontSize: "1.1rem", color: "#4A4238", fontWeight: "bold" }}>Student Groups</div>
            </div>
            <div 
              className={styles.card} 
              style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setActiveKpiModal("Lecturers")}
            >
              <div style={{ fontSize: "3rem", fontWeight: "bold", color: "#8b5cf6" }}>{stats.totalLecturers}</div>
              <div style={{ fontSize: "1.1rem", color: "#4A4238", fontWeight: "bold" }}>Total Lecturers</div>
            </div>
            <div 
              className={styles.card} 
              style={{ textAlign: "center", cursor: "pointer", transition: "transform 0.2s", border: "1px solid #fca5a5", background: "#fef2f2" }}
              onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.02)"}
              onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              onClick={() => setActiveKpiModal("Late")}
            >
              <div style={{ fontSize: "3rem", fontWeight: "bold", color: "#dc2626" }}>{stats.lateThesesCount}</div>
              <div style={{ fontSize: "1.1rem", color: "#991b1b", fontWeight: "bold" }}>LATE Theses</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 400px), 1fr))", gap: "20px" }}>
            <div className={styles.card}>
              <h2 style={{ marginBottom: "20px" }}>Thesis Status Overview</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {Object.entries(stats.statusBreakdown).map(([status, count]) => {
                  const percentage = stats.totalTheses === 0 ? 0 : Math.round((count / stats.totalTheses) * 100);
                  
                  let barColor = "#3b82f6";
                  if (status === "Approved") barColor = "#10b981";
                  if (status === "Revise") barColor = "#ef4444";
                  if (status === "Pending Chairperson") barColor = "#8b5cf6";

                  return (
                    <div 
                      key={status} 
                      onClick={() => setActiveStatusModal(status)}
                      style={{ display: "flex", alignItems: "center", gap: "15px", cursor: "pointer", padding: "8px", borderRadius: "8px", transition: "background 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#FDF9F1"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <div style={{ width: "150px", fontWeight: "bold", color: "#4A4238", fontSize: "0.9rem" }}>
                        {status}
                      </div>
                      <div style={{ flex: 1, background: "#EBE4D1", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, background: barColor, borderRadius: "6px", transition: "width 0.5s ease" }}></div>
                      </div>
                      <div style={{ width: "50px", textAlign: "right", color: "#7A7061", fontSize: "0.9rem", fontWeight: "bold" }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.card}>
              <h2 style={{ marginBottom: "20px" }}>Theses by Field of Study</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {Object.entries(stats.fieldBreakdown).sort((a,b) => b[1] - a[1]).map(([field, count]) => {
                  const percentage = stats.totalTheses === 0 ? 0 : Math.round((count / stats.totalTheses) * 100);
                  return (
                    <div key={field} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "8px" }}>
                      <div style={{ width: "200px", fontWeight: "bold", color: "#4A4238", fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={field}>
                        {field}
                      </div>
                      <div style={{ flex: 1, background: "#f1f5f9", height: "12px", borderRadius: "6px", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${percentage}%`, background: "#f59e0b", borderRadius: "6px" }}></div>
                      </div>
                      <div style={{ width: "40px", textAlign: "right", color: "#7A7061", fontSize: "0.9rem", fontWeight: "bold" }}>
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <h2 style={{ marginBottom: "20px" }}>Lecturer Workload Overview</h2>
            
            <div style={{ display: "flex", gap: "15px", marginBottom: "15px", flexWrap: "wrap" }}>
              <input 
                type="text" 
                placeholder="Search by name..." 
                value={workloadSearch} 
                onChange={(e) => setWorkloadSearch(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", flex: 1, fontFamily: "inherit", fontSize: "0.95rem" }}
              />
              <select 
                value={workloadFieldFilter} 
                onChange={(e) => setWorkloadFieldFilter(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontFamily: "inherit", fontSize: "0.95rem" }}
              >
                <option value="All">All Fields of Study</option>
                {workloadFields.map(f => <option key={f as string} value={f as string}>{f as string}</option>)}
              </select>
            </div>

            <div className={styles.tableResponsive}>
              <table className={styles.table} style={{ width: "100%", textAlign: "left", minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px" }}>Lecturer Name</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Advisor Role</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Committee Role</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Chairperson Role</th>
                    <th style={{ padding: "12px", textAlign: "center" }}>Total Active Theses</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWorkload.slice(0, 10).map((wl: any) => (
                    <tr key={wl.email} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "12px" }}>
                        <strong>{wl.name}</strong><br/>
                        <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{wl.fieldOfStudy}</span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.advisorCount > 0 ? "#dbeafe" : "#f1f5f9", color: wl.advisorCount > 0 ? "#1d4ed8" : "#94a3b8", padding: "4px 10px", borderRadius: "999px", fontWeight: "bold", cursor: wl.advisorCount > 0 ? "help" : "default" }}>
                            {wl.advisorCount}
                          </span>
                          {wl.advisorCount > 0 && renderTooltipHtml(wl.advisorTheses)}
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.committeeCount > 0 ? "#fef3c7" : "#f1f5f9", color: wl.committeeCount > 0 ? "#b45309" : "#94a3b8", padding: "4px 10px", borderRadius: "999px", fontWeight: "bold", cursor: wl.committeeCount > 0 ? "help" : "default" }}>
                            {wl.committeeCount}
                          </span>
                          {wl.committeeCount > 0 && renderTooltipHtml(wl.committeeTheses)}
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div className={styles.tooltipContainer}>
                          <span style={{ background: wl.chairpersonCount > 0 ? "#ede9fe" : "#f1f5f9", color: wl.chairpersonCount > 0 ? "#6d28d9" : "#94a3b8", padding: "4px 10px", borderRadius: "999px", fontWeight: "bold", cursor: wl.chairpersonCount > 0 ? "help" : "default" }}>
                            {wl.chairpersonCount}
                          </span>
                          {wl.chairpersonCount > 0 && renderTooltipHtml(wl.chairpersonTheses)}
                        </div>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <strong style={{ fontSize: "1.1rem", color: "#334155" }}>{wl.totalCount}</strong>
                      </td>
                    </tr>
                  ))}
                  {filteredWorkload.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "#64748b" }}>No workload data found for your search/filter.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredWorkload.length > 10 && (
              <p style={{ textAlign: "center", fontSize: "0.85rem", color: "#64748b", marginTop: "15px" }}>Showing top 10 lecturers by active thesis workload.</p>
            )}
          </div>

        </div>
      )}

      {/* Insights Modal */}
      {activeStatusModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#FDF9F1", width: "800px", maxWidth: "100%", maxHeight: "90vh", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            
            <div style={{ padding: "20px 30px", borderBottom: "1px solid #D6CEB8", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EBE4D1" }}>
              <h2 style={{ margin: 0, color: "#4A4238", fontSize: "1.4rem" }}>
                Theses marked as "{activeStatusModal}"
              </h2>
              <button 
                onClick={() => setActiveStatusModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#4A4238" }}
              >&times;</button>
            </div>

            <div style={{ padding: "30px", overflowY: "auto", flex: 1 }}>
              {allTheses.filter(t => t.status === activeStatusModal).length === 0 ? (
                <p style={{ color: "#7A7061", fontStyle: "italic", textAlign: "center" }}>No theses found with this status.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                  {allTheses.filter(t => t.status === activeStatusModal).map(t => {
                    const group = allGroups.find(g => g.id === t.groupId);
                    
                    let reviseBy = "";
                    if (t.status === "Revise") {
                      if (t.currentStage === 0) reviseBy = "Advisor";
                      else if (t.currentStage === 1) reviseBy = "Committee";
                      else if (t.currentStage === 2) reviseBy = "Chairperson";
                      else reviseBy = "Unknown";
                    }

                    return (
                      <div key={t.id} style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                        <div style={{ fontWeight: "bold", color: "#3b82f6", fontSize: "1.05rem", marginBottom: "8px" }}>Project: {t.title}</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", fontSize: "0.85rem", color: "#4A4238" }}>
                          <div><strong>Student Group:</strong> {group?.name || "-"}</div>
                          <div><strong>Field of Study:</strong> {group?.fieldOfStudy || t.fieldOfStudy || "-"}</div>
                          <div><strong>Advisor:</strong> {t.lecturerUids?.advisor || "None"}</div>
                          
                          {t.status === "Revise" && (
                            <div style={{ color: "#dc2626" }}><strong>Revise Requested By:</strong> {reviseBy}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}

      {/* KPI Insights Modal */}
      {activeKpiModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1200, padding: "20px" }}>
          <div style={{ background: "#FDF9F1", width: "800px", maxWidth: "100%", maxHeight: "90vh", borderRadius: "12px", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            
            <div style={{ padding: "20px 30px", borderBottom: "1px solid #D6CEB8", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#EBE4D1" }}>
              <h2 style={{ margin: 0, color: "#4A4238", fontSize: "1.4rem" }}>
                {activeKpiModal} Overview
              </h2>
              <button 
                onClick={() => setActiveKpiModal(null)}
                style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "#4A4238" }}
              >&times;</button>
            </div>

            <div style={{ padding: "30px", overflowY: "auto", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {activeKpiModal === "Theses" && allTheses.map(t => {
                  const group = allGroups.find(g => g.id === t.groupId);
                  return (
                    <div key={t.id} style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                      <div style={{ fontWeight: "bold", color: "#3b82f6", fontSize: "1.05rem", marginBottom: "8px" }}>{t.title}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", fontSize: "0.85rem", color: "#4A4238" }}>
                        <div><strong>Status:</strong> {t.status}</div>
                        <div><strong>Group:</strong> {group?.name || "-"}</div>
                        <div><strong>Advisor:</strong> {t.lecturerUids?.advisor || "None"}</div>
                      </div>
                    </div>
                  );
                })}

                {activeKpiModal === "Groups" && allGroups.map(g => (
                  <div key={g.id} style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                    <div style={{ fontWeight: "bold", color: "#10b981", fontSize: "1.05rem", marginBottom: "8px" }}>{g.name}</div>
                    <div style={{ fontSize: "0.85rem", color: "#4A4238" }}><strong>Field of Study:</strong> {g.fieldOfStudy || "-"}</div>
                  </div>
                ))}

                {activeKpiModal === "Lecturers" && allLecturers.map(l => (
                  <div key={l.id} style={{ background: "#fff", padding: "15px", borderRadius: "8px", border: "1px solid #D6CEB8" }}>
                    <div style={{ fontWeight: "bold", color: "#8b5cf6", fontSize: "1.05rem", marginBottom: "8px" }}>{l.name_en || l.name_th || "Unnamed"}</div>
                    <div style={{ fontSize: "0.85rem", color: "#4A4238", marginBottom: "5px" }}><strong>Email:</strong> {l.email}</div>
                    <div style={{ fontSize: "0.85rem", color: "#4A4238" }}><strong>Role:</strong> {l.role}</div>
                  </div>
                ))}

                {activeKpiModal === "Late" && allTheses.filter(t => {
                  if (t.status === "Approved") return false;
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
                    <div key={t.id} style={{ background: "#fef2f2", padding: "15px", borderRadius: "8px", border: "1px solid #fca5a5" }}>
                      <div style={{ fontWeight: "bold", color: "#dc2626", fontSize: "1.05rem", marginBottom: "8px" }}>{t.title}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", fontSize: "0.85rem", color: "#7f1d1d" }}>
                        <div><strong>Status:</strong> {t.status}</div>
                        <div><strong>Advisor:</strong> {t.lecturerUids?.advisor || "None"}</div>
                        <div><strong>Missed Deadline:</strong> {new Date(deadline).toLocaleString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({stageName})</div>
                      </div>
                    </div>
                  );
                })}

                {(activeKpiModal === "Theses" && allTheses.length === 0) || (activeKpiModal === "Groups" && allGroups.length === 0) || (activeKpiModal === "Lecturers" && allLecturers.length === 0) || (activeKpiModal === "Late" && stats.lateThesesCount === 0) ? (
                  <p style={{ color: "#7A7061", fontStyle: "italic", textAlign: "center" }}>No records found.</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
