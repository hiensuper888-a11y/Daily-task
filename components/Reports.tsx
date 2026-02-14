import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, PieChart, FileSpreadsheet, FileText, FileCode, Presentation, Share2, PenSquare, ArrowUpRight, User, Users, Trophy, Medal, Crown, Table2, CheckCircle2, Circle } from 'lucide-react';
import { Task, ReflectionMap, Group } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
type ViewMode = 'personal' | 'group';

interface ReportsProps {
    activeGroup?: Group | null;
}

export const Reports: React.FC<ReportsProps> = ({ activeGroup }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(activeGroup ? 'group' : 'personal');

  useEffect(() => {
      if (activeGroup) {
          setViewMode('group');
      } else {
          setViewMode('personal');
      }
  }, [activeGroup?.id]);

  const isGroupView = viewMode === 'group' && !!activeGroup;
  
  const taskStorageKey = isGroupView ? `group_${activeGroup?.id}_tasks` : 'daily_tasks';
  const reflectionStorageKey = isGroupView ? `group_${activeGroup?.id}_reflections` : 'reflections';
  const isGlobalStorage = isGroupView;

  const [tasks] = useRealtimeStorage<Task[]>(taskStorageKey, [], isGlobalStorage);
  const [reflections, setReflections] = useRealtimeStorage<ReflectionMap>(reflectionStorageKey, {}, isGlobalStorage);
  
  const [period, setPeriod] = useState<Period>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const { t, language } = useLanguage();

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (period === 'day') {
      start.setHours(0,0,0,0);
    } else if (period === 'week') {
      start.setDate(now.getDate() - 7);
      start.setHours(0,0,0,0);
    } else if (period === 'month') {
      start.setMonth(now.getMonth() - 1);
      start.setHours(0,0,0,0);
    } else if (period === 'year') {
      start.setFullYear(now.getFullYear() - 1);
      start.setHours(0,0,0,0);
    } else if (period === 'custom') {
       if (customStart && customEnd) {
           start = new Date(customStart);
           end = new Date(customEnd);
       } else {
           start.setHours(0,0,0,0);
       }
    }
    return { start, end };
  }, [period, customStart, customEnd]);

  const currentReflectionKey = useMemo(() => {
     const { end } = getDateRange();
     return end.toISOString().split('T')[0];
  }, [getDateRange]); 

  const handleReflectionChange = (field: 'evaluation' | 'improvement', value: string) => {
     setReflections(prev => ({
         ...prev,
         [currentReflectionKey]: {
             ...(prev[currentReflectionKey] || { evaluation: '', improvement: '' }),
             [field]: value
         }
     }));
  };

  const chartData = useMemo(() => {
    const { start: currStart, end: currEnd } = getDateRange();
    const duration = currEnd.getTime() - currStart.getTime();
    
    const prevEnd = new Date(currStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - duration);

    const getTasksInRange = (s: Date, e: Date) => tasks.filter(t => {
        const d = new Date(t.createdAt);
        return d >= s && d <= e;
    });

    const calculateScore = (taskList: Task[]) => 
        taskList.length ? Math.round(taskList.reduce((acc, cur) => acc + cur.progress, 0) / taskList.length) : 0;

    const currentTasks = getTasksInRange(currStart, currEnd);
    const prevTasks = getTasksInRange(prevStart, prevEnd);
    
    const currentScore = calculateScore(currentTasks);
    const prevScore = calculateScore(prevTasks);

    const generatePoints = (s: Date, totalDuration: number) => {
        const points = [];
        const stepTime = totalDuration / 6; 
        
        for (let i = 0; i <= 6; i++) {
             const tStart = new Date(s.getTime() + (stepTime * i));
             const tEnd = new Date(tStart.getTime() + stepTime); 
             
             const sliceTasks = tasks.filter(t => {
                 const d = new Date(t.createdAt);
                 return d >= tStart && d < tEnd;
             });
             
             const val = calculateScore(sliceTasks);
             points.push({ value: val, date: tStart });
        }
        return points;
    };

    const safeDuration = duration > 0 ? duration : 24 * 60 * 60 * 1000;
    
    const currentPoints = generatePoints(currStart, safeDuration);
    const prevPoints = generatePoints(prevStart, safeDuration);

    return { 
        currentScore, 
        prevScore, 
        currentCount: currentTasks.length, 
        prevCount: prevTasks.length,
        currentPoints,
        prevPoints,
        filteredTasks: currentTasks 
    };
  }, [tasks, getDateRange]);

  const groupStats = useMemo(() => {
      if (!isGroupView || !activeGroup) return null;

      const memberStats = activeGroup.members.map(member => {
          const memberTasks = chartData.filteredTasks.filter(t => t.assignedTo === member.id);
          const total = memberTasks.length;
          const completed = memberTasks.filter(t => t.completed).length;
          const avgProgress = total > 0 
              ? Math.round(memberTasks.reduce((acc, curr) => acc + curr.progress, 0) / total) 
              : 0;
          
          return {
              ...member,
              totalTasks: total,
              completedTasks: completed,
              completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
              score: avgProgress
          };
      }).sort((a, b) => b.completedTasks - a.completedTasks || b.score - a.score);

      const topPerformer = memberStats.length > 0 && memberStats[0].totalTasks > 0 ? memberStats[0] : null;

      return { memberStats, topPerformer };
  }, [isGroupView, activeGroup, chartData.filteredTasks]);

  const diff = chartData.currentScore - chartData.prevScore;
  const isPositive = diff >= 0;

  const generateAreaPath = (points: {value: number}[], width: number, height: number) => {
      if (points.length < 2) return "";
      const stepX = width / (points.length - 1);
      let path = `M 0,${height} `; 
      points.forEach((p, i) => {
          const x = i * stepX;
          const y = height - (p.value / 100) * height;
          path += `L ${x},${y} `;
      });
      path += `L ${width},${height} Z`;
      return path;
  };

  const generateLinePath = (points: {value: number}[], width: number, height: number) => {
      if (points.length < 2) return "";
      const stepX = width / (points.length - 1);
      let path = "";
      points.forEach((p, i) => {
          const x = i * stepX;
          const y = height - (p.value / 100) * height;
          path += `${i === 0 ? 'M' : 'L'} ${x},${y} `;
      });
      return path;
  };

  const sanitize = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const getReportContextName = () => isGroupView && activeGroup ? activeGroup.name : t.personal;

  // --- EXPORT FUNCTIONS WITH GROUP SUPPORT ---
  const exportToExcel = () => {
    const data = chartData.filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
    const contextName = getReportContextName();
    
    let csvContent = "\uFEFF"; 
    csvContent += `Report Context,${contextName}\n`;
    csvContent += `Report Period,${period}\n`;
    csvContent += `Score,${chartData.currentScore}%\n`;
    csvContent += `Comparison vs Prev,${diff}%\n\n`;
    csvContent += `Self Evaluation,"${reflection.evaluation ? reflection.evaluation.replace(/"/g, '""') : 'N/A'}"\n`;
    csvContent += `Needs Improvement,"${reflection.improvement ? reflection.improvement.replace(/"/g, '""') : 'N/A'}"\n\n`;
    
    // Header Row
    csvContent += `${t.dateTime},${t.taskContent},${t.status},${t.progress},${t.subtasksHeader},${t.assignedTo},${t.completedBy}\n`;
    
    data.forEach(task => {
        const d = new Date(task.createdAt);
        const subtasksStr = task.subtasks?.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ') || '';
        
        let assigneeName = 'Me';
        let completerName = '';
        if (isGroupView && activeGroup) {
            assigneeName = activeGroup.members.find(m => m.id === task.assignedTo)?.name || 'Unassigned';
            completerName = task.completedBy ? (activeGroup.members.find(m => m.id === task.completedBy)?.name || 'Unknown') : '';
        }

        csvContent += `${d.toLocaleString(language)},"${task.text.replace(/"/g, '""')}",${task.completed ? t.completed : t.active},${task.progress}%,"${subtasksStr.replace(/"/g, '""')}",${assigneeName},${completerName}\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `daily-task-report-${contextName.replace(/\s+/g, '-')}-${period}.csv`);
  };

  const exportToWord = () => {
      const data = chartData.filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
      const contextName = getReportContextName();
      
      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Report</title>
      <style>body{font-family:Arial,sans-serif;} table{width:100%;border-collapse:collapse;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;}</style>
      </head><body>`;
      html += `<h1>${t.reportHeader} - ${period.toUpperCase()}</h1>`;
      html += `<h2>Context: ${contextName}</h2>`;
      html += `<h3>Summary</h3><p>Score: ${chartData.currentScore}% | Tasks: ${chartData.currentCount}</p>`;
      
      if (!isGroupView) {
        html += `<h3>Reflection</h3><p><strong>Evaluation:</strong> ${sanitize(reflection.evaluation || "N/A")}</p>`;
        html += `<p><strong>Improvement:</strong> ${sanitize(reflection.improvement || "N/A")}</p>`;
      }

      html += `<h3>Tasks</h3><table><tr><th>Time</th><th>Task</th><th>Status</th><th>Progress</th><th>Assigned To</th></tr>`;
      data.forEach(t => {
         const d = new Date(t.createdAt);
         const assignee = isGroupView && activeGroup ? (activeGroup.members.find(m => m.id === t.assignedTo)?.name || 'Unassigned') : 'Me';
         html += `<tr><td>${d.toLocaleString()}</td><td>${sanitize(t.text)}</td><td>${t.completed ? "Done" : "Active"}</td><td>${t.progress}%</td><td>${assignee}</td></tr>`;
      });
      html += `</table></body></html>`;
      
      const blob = new Blob([html], { type: 'application/msword' });
      downloadFile(blob, `daily-task-report-${contextName.replace(/\s+/g, '-')}-${period}.doc`);
  };

  // Keep XML and PPTX logic similar but less critical for the prompt's request
  const exportToXML = () => {
      const data = chartData.filteredTasks;
      const contextName = getReportContextName();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<report>\n';
      xml += `  <meta>\n    <context>${sanitize(contextName)}</context>\n    <period>${period}</period>\n  </meta>\n`;
      xml += `  <tasks>\n`;
      data.forEach(t => {
          xml += `    <task id="${t.id}">\n      <text>${sanitize(t.text)}</text>\n      <status>${t.completed ? 'completed' : 'active'}</status>\n    </task>\n`;
      });
      xml += `  </tasks>\n</report>`;
      const blob = new Blob([xml], { type: 'text/xml' });
      downloadFile(blob, `daily-task-report-${period}.xml`);
  };

  const exportToPowerPoint = async () => {
      const pres = new PptxGenJS();
      const contextName = getReportContextName();
      let slide = pres.addSlide();
      slide.addText(`Report - ${contextName}`, { x: 1, y: 1, fontSize: 24, bold: true, color: '363636' });
      slide.addText(`Tasks: ${chartData.currentCount}`, { x: 1, y: 2, fontSize: 18 });
      pres.writeFile({ fileName: `daily-task-report-${period}.pptx` });
  };

  const downloadFile = (blob: Blob, fileName: string) => {
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  React.useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes draw-path { from { stroke-dashoffset: 1000; } to { stroke-dashoffset: 0; } }
      .animate-draw-path { stroke-dasharray: 1000; stroke-dashoffset: 1000; animation: draw-path 2s cubic-bezier(0.4, 0, 0.2, 1) forwards; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-transparent relative">
      {/* Header */}
      <div className={`relative overflow-hidden bg-gradient-to-r p-8 text-white shrink-0 shadow-lg md:rounded-t-[2.5rem] z-10 transition-colors duration-500 ${isGroupView ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-violet-600'}`}>
        <div className="absolute right-0 bottom-0 opacity-10 p-4 animate-float"><PieChart size={120} /></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
                <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight">
                    <BarChart3 size={32} className={isGroupView ? "text-emerald-200" : "text-indigo-200"} />
                    {t.reportHeader}
                </h1>
                <p className={`${isGroupView ? "text-emerald-100" : "text-indigo-100"} text-sm mt-2 font-medium opacity-90 tracking-wide`}>
                    {isGroupView ? activeGroup?.name : t.personal}
                </p>
            </div>
            {activeGroup && (
                <div className="bg-black/20 backdrop-blur-md p-1 rounded-xl flex items-center self-start md:self-center border border-white/10">
                    <button onClick={() => setViewMode('personal')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                        <User size={14} /> {t.personal}
                    </button>
                    <button onClick={() => setViewMode('group')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'group' ? 'bg-white text-emerald-600 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                        <Users size={14} /> {t.groupView}
                    </button>
                </div>
            )}
        </div>
      </div>

      {/* Content Wrapper */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-28 md:pb-8">
        <div className="max-w-6xl mx-auto w-full space-y-6">
            
            {/* Period Selector */}
            <div className="flex bg-white/70 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-white overflow-x-auto ring-1 ring-slate-100/50">
            {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`flex-1 min-w-[70px] py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${period === p ? (isGroupView ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-violet-600') + ' text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:bg-white hover:text-slate-700'}`}>
                {t[p as keyof typeof t]}
                </button>
            ))}
            </div>

            {/* Area Chart Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-[2.5rem] p-8 animate-fade-in flex flex-col justify-between shadow-premium" style={{animationDelay: '0.1s'}}>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp size={18} className={isGroupView ? "text-teal-500" : "text-indigo-500"}/>
                                {t.comparison}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wide">{t.vsPrev}</p>
                        </div>
                        <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> {t.periodPrev}</div>
                            <div className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${isGroupView ? 'bg-teal-500' : 'bg-indigo-500'}`}></span> {t.periodCurrent}</div>
                        </div>
                    </div>
                    
                    {/* SVG Chart */}
                    <div className="w-full h-56 relative group/chart">
                        <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <linearGradient id="gradientCurrent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={isGroupView ? "#2dd4bf" : "#818cf8"} stopOpacity="0.5" />
                                    <stop offset="100%" stopColor={isGroupView ? "#2dd4bf" : "#818cf8"} stopOpacity="0" />
                                </linearGradient>
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                                    <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
                                </filter>
                            </defs>
                            <path d={generateAreaPath(chartData.prevPoints, 100, 50)} fill="#f1f5f9" opacity="0.5" />
                            <path d={generateLinePath(chartData.prevPoints, 100, 50)} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                            <path d={generateAreaPath(chartData.currentPoints, 100, 50)} fill="url(#gradientCurrent)" className="animate-fade-in" style={{animationDuration: '1.5s'}} />
                            <path key={`line-${period}-${isGroupView}-${activeGroup?.id}`} d={generateLinePath(chartData.currentPoints, 100, 50)} fill="none" stroke={isGroupView ? "#14b8a6" : "#6366f1"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-path" filter="url(#glow)"/>
                            
                            {chartData.currentPoints.map((point, index) => {
                                const x = index * (100 / (chartData.currentPoints.length - 1));
                                const y = 50 - (point.value / 100) * 50;
                                const isHovered = hoveredIndex === index;
                                const isRightSide = index > 4;
                                return (
                                    <g key={index} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                                        <rect x={x - 8} y="0" width="16" height="50" fill="transparent" className="cursor-crosshair"/>
                                        {isHovered && (
                                            <>
                                                <line x1={x} y1={y} x2={x} y2="50" stroke={isGroupView ? "#14b8a6" : "#6366f1"} strokeWidth="1" strokeDasharray="2,2" opacity="0.6"/>
                                                <circle cx={x} cy={y} r="3" fill="white" stroke={isGroupView ? "#14b8a6" : "#6366f1"} strokeWidth="2" filter="url(#glow)"/>
                                                <g transform={`translate(${isRightSide ? x - 35 : x - 10}, ${y - 15})`} className="drop-shadow-lg">
                                                    <rect x="0" y="0" width="45" height="16" rx="4" fill="white" fillOpacity="0.95" stroke={isGroupView ? "#ccfbf1" : "#e0e7ff"} strokeWidth="0.5"/>
                                                    <text x="22.5" y="7" textAnchor="middle" fontSize="3.5" fontWeight="bold" fill="#334155" fontFamily="Plus Jakarta Sans">{point.value}%</text>
                                                    <text x="22.5" y="12" textAnchor="middle" fontSize="2.5" fontWeight="500" fill="#94a3b8" fontFamily="Plus Jakarta Sans">{point.date.getDate()}/{point.date.getMonth() + 1}</text>
                                                </g>
                                            </>
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                    </div>
                </div>

                {/* Leaderboard or Reflection */}
                {isGroupView && groupStats ? (
                    <div className="glass-card rounded-[2.5rem] p-8 flex flex-col animate-fade-in shadow-premium" style={{animationDelay: '0.2s'}}>
                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <Trophy size={18} className="text-amber-500"/>
                            {t.leaderboard}
                        </h3>
                        <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar pr-2 max-h-[350px]">
                            {groupStats.memberStats.map((member, idx) => {
                                const isTop = idx === 0 && member.totalTasks > 0;
                                return (
                                    <div key={member.id} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${isTop ? 'bg-gradient-to-r from-amber-50 to-white border-amber-200 shadow-sm' : 'bg-white border-slate-100'}`}>
                                        <div className="relative shrink-0">
                                            <img src={member.avatar} className="w-10 h-10 rounded-xl bg-slate-100 object-cover" alt={member.name}/>
                                            {isTop && <div className="absolute -top-1.5 -right-1.5 bg-amber-400 text-white w-5 h-5 rounded-full flex items-center justify-center border-2 border-white text-[10px]"><Crown size={10} fill="currentColor"/></div>}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <h4 className="text-sm font-bold text-slate-700 truncate">{member.name}</h4>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${member.completionRate >= 80 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{member.completionRate}%</span>
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className={`h-full rounded-full ${isTop ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{width: `${member.completionRate}%`}}></div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                ) : (
                     <div className="glass-card rounded-[2.5rem] p-8 flex flex-col animate-fade-in shadow-premium" style={{animationDelay: '0.2s'}}>
                        <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                            <PenSquare size={18} className="text-orange-500"/>
                            {t.selfEval}
                        </h3>
                        <div className="flex-1 space-y-6">
                            <textarea className="w-full h-32 p-4 bg-slate-50 border-none ring-1 ring-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-orange-200 focus:bg-white resize-none transition-all" placeholder={t.writeReflection} value={(reflections[currentReflectionKey] || {}).evaluation || ''} onChange={(e) => handleReflectionChange('evaluation', e.target.value)} />
                        </div>
                    </div>
                )}
            </div>

            {/* DETAILED TASK TABLE */}
            <div className="glass-card rounded-[2.5rem] p-8 animate-fade-in shadow-premium" style={{animationDelay: '0.2s'}}>
                 <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                        <Table2 size={18} className="text-indigo-500"/> {t.taskDetails}
                    </h3>
                    <div className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full">{chartData.filteredTasks.length} {t.items}</div>
                 </div>
                 
                 <div className="overflow-x-auto">
                     <table className="w-full text-left border-collapse">
                         <thead>
                             <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                 <th className="py-3 px-2">{t.dateTime}</th>
                                 <th className="py-3 px-2">{t.taskContent}</th>
                                 <th className="py-3 px-2">{t.status}</th>
                                 {isGroupView && <th className="py-3 px-2">{t.assignedTo}</th>}
                             </tr>
                         </thead>
                         <tbody className="text-sm font-medium text-slate-600">
                             {chartData.filteredTasks.length === 0 ? (
                                 <tr><td colSpan={4} className="py-8 text-center text-slate-400 italic">{t.noData}</td></tr>
                             ) : (
                                 chartData.filteredTasks.slice(0, 10).map(task => { // Show top 10 preview
                                     const member = isGroupView ? activeGroup?.members.find(m => m.id === task.assignedTo) : null;
                                     return (
                                        <tr key={task.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                            <td className="py-3 px-2 whitespace-nowrap text-xs text-slate-400">{new Date(task.createdAt).toLocaleDateString()}</td>
                                            <td className="py-3 px-2 max-w-[200px] truncate">{task.text}</td>
                                            <td className="py-3 px-2">
                                                {task.completed 
                                                    ? <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] font-bold"><CheckCircle2 size={10}/> {t.completed}</span>
                                                    : <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full text-[10px] font-bold"><Circle size={10}/> {t.active}</span>
                                                }
                                            </td>
                                            {isGroupView && (
                                                <td className="py-3 px-2">
                                                    {member ? (
                                                        <div className="flex items-center gap-2">
                                                            <img src={member.avatar} className="w-5 h-5 rounded-full bg-slate-200" alt=""/>
                                                            <span className="text-xs truncate max-w-[80px]">{member.name}</span>
                                                        </div>
                                                    ) : <span className="text-xs text-slate-400 italic">Unassigned</span>}
                                                </td>
                                            )}
                                        </tr>
                                     )
                                 })
                             )}
                         </tbody>
                     </table>
                     {chartData.filteredTasks.length > 10 && <div className="text-center text-xs text-slate-400 mt-4 italic">...and {chartData.filteredTasks.length - 10} more items (visible in export)</div>}
                 </div>
            </div>

            {/* Export & Share */}
            <div className="glass-card rounded-[2.5rem] p-8 animate-fade-in shadow-premium" style={{animationDelay: '0.3s'}}>
                <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Share2 size={18} className="text-emerald-500"/> {t.export}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button onClick={exportToExcel} className="flex flex-col items-center p-5 bg-white border border-slate-100 hover:bg-emerald-50 hover:border-emerald-200 rounded-[1.5rem] transition-all hover:-translate-y-1 hover:shadow-lg group">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <FileSpreadsheet size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-emerald-700">Excel</span>
                    </button>
                    <button onClick={exportToWord} className="flex flex-col items-center p-5 bg-white border border-slate-100 hover:bg-blue-50 hover:border-blue-200 rounded-[1.5rem] transition-all hover:-translate-y-1 hover:shadow-lg group">
                        <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <FileText size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-blue-700">Word</span>
                    </button>
                     <button onClick={exportToPowerPoint} className="flex flex-col items-center p-5 bg-white border border-slate-100 hover:bg-orange-50 hover:border-orange-200 rounded-[1.5rem] transition-all hover:-translate-y-1 hover:shadow-lg group">
                        <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <Presentation size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-orange-700">PPTX</span>
                    </button>
                    <button onClick={exportToXML} className="flex flex-col items-center p-5 bg-white border border-slate-100 hover:bg-purple-50 hover:border-purple-200 rounded-[1.5rem] transition-all hover:-translate-y-1 hover:shadow-lg group">
                        <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                            <FileCode size={24} />
                        </div>
                        <span className="text-xs font-bold text-slate-600 group-hover:text-purple-700">XML</span>
                    </button>
                </div>
            </div>
            
        </div>
      </div>
    </div>
  );
};