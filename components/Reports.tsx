import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, PieChart as PieChartIcon, FileSpreadsheet, FileText, FileCode, Presentation, Share2, PenSquare, ArrowUpRight, User, Users, Trophy, Medal, Crown, Table2, CheckCircle2, Circle, Download } from 'lucide-react';
import { Task, ReflectionMap, Group } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';
type ViewMode = 'personal' | 'group';

interface ReportsProps {
    activeGroup?: Group | null;
}

export const Reports: React.FC<ReportsProps> = ({ activeGroup }) => {
  const [viewMode, setViewMode] = useState<ViewMode>(activeGroup ? 'group' : 'personal');
  
  // Logic to determine if user is leader of active group
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  const isLeader = activeGroup?.leaderId === currentUserId;

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
     return end.toLocaleDateString('en-CA');
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

  const exportToExcel = () => {
    const data = chartData.filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
    const contextName = getReportContextName();
    const contextType = isGroupView ? 'Group' : 'Personal';
    
    let csvContent = "\uFEFF"; 
    csvContent += `Report Type,${contextType}\n`;
    csvContent += `Context Name,${contextName}\n`;
    csvContent += `Period,${period}\n`;
    csvContent += `Overall Score,${chartData.currentScore}%\n`;
    csvContent += `Total Tasks,${chartData.currentCount}\n\n`;
    
    if (!isGroupView) {
        csvContent += `Self Evaluation,"${reflection.evaluation ? reflection.evaluation.replace(/"/g, '""') : 'N/A'}"\n`;
        csvContent += `Needs Improvement,"${reflection.improvement ? reflection.improvement.replace(/"/g, '""') : 'N/A'}"\n\n`;
    }
    
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
    
    const fileName = isGroupView 
        ? `Report-Group-${contextName.replace(/\s+/g, '_')}-${period}.csv`
        : `Report-Personal-${period}.csv`;
        
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, fileName);
  };

  const exportToWord = () => {
      const data = chartData.filteredTasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
      const contextName = getReportContextName();
      
      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Report</title>
      <style>body{font-family:Arial,sans-serif;} table{width:100%;border-collapse:collapse;margin-top:20px;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background-color:#f2f2f2;}</style>
      </head><body>`;
      
      html += `<h1>${t.reportHeader} - ${period.toUpperCase()}</h1>`;
      html += `<h2>${isGroupView ? 'Group' : 'Personal'}: ${contextName}</h2>`;
      html += `<h3>Summary</h3><p>Score: ${chartData.currentScore}% | Tasks Completed: ${chartData.currentCount}</p>`;
      
      if (!isGroupView) {
        html += `<h3>Reflection</h3><p><strong>Evaluation:</strong> ${sanitize(reflection.evaluation || "N/A")}</p>`;
        html += `<p><strong>Improvement:</strong> ${sanitize(reflection.improvement || "N/A")}</p>`;
      }

      html += `<h3>Tasks Details</h3><table><tr><th>Date</th><th>Task</th><th>Status</th><th>Progress</th><th>Assigned To</th></tr>`;
      data.forEach(t => {
         const d = new Date(t.createdAt);
         const assignee = isGroupView && activeGroup ? (activeGroup.members.find(m => m.id === t.assignedTo)?.name || 'Unassigned') : 'Me';
         html += `<tr><td>${d.toLocaleString()}</td><td>${sanitize(t.text)}</td><td>${t.completed ? "Done" : "Active"}</td><td>${t.progress}%</td><td>${assignee}</td></tr>`;
      });
      html += `</table></body></html>`;
      
      const fileName = isGroupView 
        ? `Report-Group-${contextName.replace(/\s+/g, '_')}-${period}.doc`
        : `Report-Personal-${period}.doc`;

      const blob = new Blob([html], { type: 'application/msword' });
      downloadFile(blob, fileName);
  };

  const exportToXML = () => {
      const data = chartData.filteredTasks;
      const contextName = getReportContextName();
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<report>\n';
      xml += `  <meta>\n    <type>${isGroupView ? 'Group' : 'Personal'}</type>\n    <context>${sanitize(contextName)}</context>\n    <period>${period}</period>\n  </meta>\n`;
      xml += `  <tasks>\n`;
      data.forEach(t => {
          xml += `    <task id="${t.id}">\n      <text>${sanitize(t.text)}</text>\n      <status>${t.completed ? 'completed' : 'active'}</status>\n      <progress>${t.progress}</progress>\n    </task>\n`;
      });
      xml += `  </tasks>\n</report>`;
      
      const fileName = isGroupView 
        ? `Report-Group-${contextName.replace(/\s+/g, '_')}-${period}.xml`
        : `Report-Personal-${period}.xml`;

      const blob = new Blob([xml], { type: 'text/xml' });
      downloadFile(blob, fileName);
  };

  const exportToPowerPoint = async () => {
      const pres = new PptxGenJS();
      const contextName = getReportContextName();
      
      let slide = pres.addSlide();
      slide.addText(t.reportHeader, { x: 1, y: 1, fontSize: 24, bold: true, color: '363636' });
      slide.addText(`${isGroupView ? 'Group' : 'Personal'}: ${contextName}`, { x: 1, y: 1.5, fontSize: 18, color: '6366F1' });
      slide.addText(`Period: ${period.toUpperCase()}`, { x: 1, y: 2, fontSize: 14, color: '888888' });
      
      slide = pres.addSlide();
      slide.addText('Performance Overview', { x: 0.5, y: 0.5, fontSize: 18, bold: true });
      slide.addText(`Productivity Score: ${chartData.currentScore}%`, { x: 1, y: 1.5, fontSize: 16 });
      slide.addText(`Tasks Completed: ${chartData.currentCount}`, { x: 1, y: 2.0, fontSize: 16 });
      
      const fileName = isGroupView 
        ? `Report-Group-${contextName.replace(/\s+/g, '_')}-${period}.pptx`
        : `Report-Personal-${period}.pptx`;

      pres.writeFile({ fileName: fileName });
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
      URL.revokeObjectURL(url);
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
    <div className="flex flex-col h-full bg-transparent relative">
      <div className={`relative overflow-hidden bg-gradient-to-r p-8 text-white shrink-0 shadow-lg md:rounded-b-[2.5rem] z-10 transition-colors duration-500 ${isGroupView ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-violet-600'}`}>
        <div className="absolute right-0 bottom-0 opacity-10 p-4 animate-float"><PieChartIcon size={120} /></div>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
                <h1 className="text-3xl font-black flex items-center gap-3 tracking-tight">
                    <BarChart3 size={32} className={isGroupView ? "text-emerald-200" : "text-indigo-200"} />
                    {t.reportHeader}
                </h1>
                <p className={`${isGroupView ? "text-emerald-100" : "text-indigo-100"} text-sm mt-2 font-medium opacity-90 tracking-wide`}>
                    {getReportContextName()}
                </p>
            </div>
            
            {activeGroup && (
                <div className="bg-black/20 backdrop-blur-md p-1 rounded-xl flex items-center self-start md:self-center border border-white/10 shadow-inner">
                    <button onClick={() => setViewMode('personal')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'personal' ? 'bg-white text-indigo-600 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                        <User size={14} /> {t.personal}
                    </button>
                    <button onClick={() => setViewMode('group')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'group' ? 'bg-white text-emerald-600 shadow-md' : 'text-white/70 hover:text-white hover:bg-white/10'}`}>
                        <Users size={14} /> {t.groupView}
                    </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-2 mt-8 overflow-x-auto pb-2 scrollbar-none mask-gradient-x relative z-10">
             {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
                <button 
                    key={p} 
                    onClick={() => setPeriod(p)} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${period === p ? 'bg-white text-slate-900 border-white shadow-lg' : 'bg-white/10 text-white border-white/10 hover:bg-white/20'}`}
                >
                    {t[p]}
                </button>
            ))}
        </div>

        {period === 'custom' && (
            <div className="flex items-center gap-4 mt-4 animate-fade-in relative z-10">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{t.startDate}</label>
                    <input 
                        type="date" 
                        value={customStart} 
                        onChange={(e) => setCustomStart(e.target.value)} 
                        className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:bg-white/20 transition-colors"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest">{t.endDate}</label>
                    <input 
                        type="date" 
                        value={customEnd} 
                        onChange={(e) => setCustomEnd(e.target.value)} 
                        className="bg-white/10 border border-white/20 rounded-xl px-3 py-2 text-white text-xs font-bold outline-none focus:bg-white/20 transition-colors"
                    />
                </div>
            </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-32 custom-scrollbar space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{t.productivityScore}</span>
                  <div className="text-4xl font-black text-indigo-600">{chartData.currentScore}%</div>
                  <div className={`flex items-center text-[10px] font-bold mt-1 ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isPositive ? <TrendingUp size={12} className="mr-1"/> : <TrendingDown size={12} className="mr-1"/>}
                      {Math.abs(diff)}% {t.vsPrev}
                  </div>
              </div>
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{t.totalTasks}</span>
                  <div className="text-4xl font-black text-slate-800">{chartData.currentCount}</div>
              </div>
              
              {isGroupView && groupStats?.topPerformer ? (
                  <div className="col-span-2 bg-gradient-to-br from-amber-100 to-orange-50 p-5 rounded-2xl shadow-sm border border-amber-200 flex items-center gap-4 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-8 bg-white opacity-40 rounded-full blur-xl -translate-y-4 translate-x-4"></div>
                      <div className="relative">
                          <img src={groupStats.topPerformer.avatar} className="w-14 h-14 rounded-2xl shadow-md border-2 border-white bg-white object-cover" alt="" />
                          <div className="absolute -bottom-2 -right-2 bg-amber-500 text-white p-1 rounded-full shadow-sm"><Trophy size={12} fill="currentColor"/></div>
                      </div>
                      <div className="flex-1 relative z-10">
                          <span className="text-amber-700 text-[10px] font-bold uppercase tracking-widest">{t.topPerformer}</span>
                          <h3 className="text-lg font-black text-slate-800 leading-tight">{groupStats.topPerformer.name}</h3>
                          <p className="text-xs font-bold text-amber-600 mt-0.5">{groupStats.topPerformer.score}% {t.completionRate}</p>
                      </div>
                  </div>
              ) : (
                  <div className="col-span-2 bg-gradient-to-br from-indigo-50 to-white p-5 rounded-2xl shadow-sm border border-indigo-100 flex flex-col justify-center">
                      <span className="text-indigo-600 text-xs font-bold uppercase tracking-wider mb-1">{t.productivityTrend}</span>
                      <p className="text-sm font-medium text-slate-600 leading-snug">
                          {isPositive ? t.greatJob : t.keepGoing} {t.productivityScore} {isPositive ? "increased" : "changed"} by {Math.abs(diff)}% this {period}.
                      </p>
                  </div>
              )}
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><ArrowUpRight size={20} className="text-indigo-500"/> {t.productivityTrend}</h3>
              <div className="h-48 w-full relative flex items-end justify-between px-2">
                  <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none">
                      <defs>
                          <linearGradient id="gradientArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={isGroupView ? "#10b981" : "#6366f1"} stopOpacity="0.2" />
                              <stop offset="100%" stopColor={isGroupView ? "#10b981" : "#6366f1"} stopOpacity="0" />
                          </linearGradient>
                      </defs>
                      <path d={generateAreaPath(chartData.currentPoints, 100, 100)} fill="url(#gradientArea)" vectorEffect="non-scaling-stroke" transform="scale(1, 0.8) translate(0, 20)" />
                      <path d={generateLinePath(chartData.currentPoints, 100, 100)} fill="none" stroke={isGroupView ? "#10b981" : "#6366f1"} strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" className="animate-draw-path" transform="scale(1, 0.8) translate(0, 20)" />
                  </svg>
                  
                  {chartData.currentPoints.map((p, i) => (
                      <div 
                        key={i} 
                        className="relative group flex flex-col items-center justify-end h-full w-8"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                      >
                          <div 
                            className={`w-3 h-3 rounded-full border-2 transition-all z-10 ${hoveredIndex === i ? (isGroupView ? 'bg-emerald-500 border-white scale-125' : 'bg-indigo-600 border-white scale-125') : (isGroupView ? 'bg-white border-emerald-500' : 'bg-white border-indigo-500')}`}
                            style={{ marginBottom: `${p.value * 0.8}%` }}
                          ></div>
                          
                          {/* Tooltip */}
                          <div className={`absolute bottom-full mb-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-lg whitespace-nowrap transition-all ${hoveredIndex === i ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
                              {p.value}% - {p.date.toLocaleDateString(language, { day: 'numeric', month: 'short' })}
                          </div>
                          
                          <div className="h-full w-px bg-slate-100 absolute top-0 -z-10 group-hover:bg-slate-200 transition-colors"></div>
                      </div>
                  ))}
              </div>
          </div>

          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 relative overflow-hidden">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><PieChartIcon size={20} className="text-indigo-500"/> Task Distribution</h3>
              <div className="h-64 w-full">
                  {chartData.filteredTasks.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                              <Pie
                                  data={[
                                      { name: t.completed, value: chartData.filteredTasks.filter(t => t.completed).length, color: '#10b981' },
                                      { name: t.active, value: chartData.filteredTasks.filter(t => !t.completed).length, color: '#6366f1' }
                                  ]}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                              >
                                  {[
                                      { name: t.completed, value: chartData.filteredTasks.filter(t => t.completed).length, color: '#10b981' },
                                      { name: t.active, value: chartData.filteredTasks.filter(t => !t.completed).length, color: '#6366f1' }
                                  ].map((entry, index) => (
                                      <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                              </Pie>
                              <Tooltip 
                                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px -10px rgba(0,0,0,0.1)' }}
                                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                              />
                              <Legend 
                                  verticalAlign="bottom" 
                                  height={36}
                                  iconType="circle"
                                  wrapperStyle={{ fontSize: '12px', fontWeight: 'bold', paddingTop: '20px' }}
                              />
                          </PieChart>
                      </ResponsiveContainer>
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm font-bold">
                          No tasks found for this period
                      </div>
                  )}
              </div>
          </div>

          {/* Group: Leaderboard */}
          {isGroupView && groupStats && (
              <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2"><Medal size={20} className="text-amber-500"/> {t.leaderboard}</h3>
                  <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                      {groupStats.memberStats.map((member, index) => (
                          <div key={member.id} className="flex items-center p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors gap-4">
                              <div className="font-black text-slate-300 w-6 text-center text-sm">{index + 1}</div>
                              <img src={member.avatar} className="w-10 h-10 rounded-xl bg-slate-100 object-cover" alt="" />
                              <div className="flex-1 min-w-0">
                                  <h4 className="text-sm font-bold text-slate-800 truncate">{member.name}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                      <div className="h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500 rounded-full" style={{width: `${member.completionRate}%`}}></div>
                                      </div>
                                      <span className="text-[10px] font-bold text-slate-400">{member.completionRate}%</span>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="text-sm font-black text-slate-800">{member.score}</div>
                                  <div className="text-[10px] font-bold text-slate-400 uppercase">Score</div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          {/* Personal: Reflection */}
          {!isGroupView && (
              <div className="space-y-4">
                  <div className="bg-gradient-to-br from-indigo-50 to-white p-6 rounded-[2rem] border border-indigo-100 shadow-sm space-y-4">
                      <h3 className="text-sm font-bold text-indigo-800 uppercase tracking-widest flex items-center gap-2"><PenSquare size={16}/> {t.reportToday}</h3>
                      <div className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-slate-400 ml-2 mb-1 block">{t.selfEval}</label>
                              <textarea 
                                  value={reflections[currentReflectionKey]?.evaluation || ''}
                                  onChange={(e) => handleReflectionChange('evaluation', e.target.value)}
                                  placeholder={t.writeReflection}
                                  className="w-full p-4 bg-white border border-indigo-50 focus:border-indigo-300 rounded-2xl text-sm font-medium text-slate-700 outline-none transition-all resize-none shadow-sm h-24 placeholder:text-slate-300"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-slate-400 ml-2 mb-1 block">{t.improve}</label>
                              <textarea 
                                  value={reflections[currentReflectionKey]?.improvement || ''}
                                  onChange={(e) => handleReflectionChange('improvement', e.target.value)}
                                  placeholder={t.writeImprovement}
                                  className="w-full p-4 bg-white border border-indigo-50 focus:border-indigo-300 rounded-2xl text-sm font-medium text-slate-700 outline-none transition-all resize-none shadow-sm h-24 placeholder:text-slate-300"
                              />
                          </div>
                      </div>
                  </div>
              </div>
          )}

          {/* Export Actions - Shown if Personal or if Group Leader */}
          {(!isGroupView || isLeader) && (
              <div className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 px-2 flex items-center gap-2"><Share2 size={20} className="text-indigo-500"/> {t.export}</h3>
                  <div className="grid grid-cols-2 gap-3">
                      <button onClick={exportToExcel} className="p-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center gap-2 transition-all">
                          <FileSpreadsheet size={24}/>
                          <span className="text-xs font-bold">Excel</span>
                      </button>
                      <button onClick={exportToPowerPoint} className="p-4 bg-orange-50 hover:bg-orange-100 text-orange-700 rounded-2xl border border-orange-100 flex flex-col items-center justify-center gap-2 transition-all">
                          <Presentation size={24}/>
                          <span className="text-xs font-bold">PowerPoint</span>
                      </button>
                      <button onClick={exportToWord} className="p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-2xl border border-blue-100 flex flex-col items-center justify-center gap-2 transition-all">
                          <FileText size={24}/>
                          <span className="text-xs font-bold">Word</span>
                      </button>
                      <button onClick={exportToXML} className="p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-2 transition-all">
                          <FileCode size={24}/>
                          <span className="text-xs font-bold">XML</span>
                      </button>
                  </div>
              </div>
          )}
      </div>
    </div>
  );
};