import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, PieChart, FileSpreadsheet, FileText, FileCode, Presentation, Share2, PenSquare, ArrowUpRight, User, Users, Trophy, Medal, Crown, Table2, CheckCircle2, Circle, Download } from 'lucide-react';
import { Task, ReflectionMap, Group } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
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
        <div className="absolute right-0 bottom-0 opacity-10 p-4 animate-float"><PieChart size={120} /></div>
        
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
                    <button onClick={() => setViewMode('group')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'group' ? 'bg-white text-emerald-600 shadow-md' : 'text-white/70 hover