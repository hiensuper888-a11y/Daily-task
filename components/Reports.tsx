import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, PieChart, FileSpreadsheet, FileText, FileCode, Presentation, Share2, PenSquare, ArrowUpRight } from 'lucide-react';
import { Task, ReflectionMap, Group } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
// @ts-ignore
import PptxGenJS from 'pptxgenjs';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

interface ReportsProps {
    activeGroup?: Group | null;
}

export const Reports: React.FC<ReportsProps> = ({ activeGroup }) => {
  const taskStorageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const reflectionStorageKey = activeGroup ? `group_${activeGroup.id}_reflections` : 'reflections';
  const isGlobal = !!activeGroup;

  const [tasks] = useRealtimeStorage<Task[]>(taskStorageKey, [], isGlobal);
  const [reflections, setReflections] = useRealtimeStorage<ReflectionMap>(reflectionStorageKey, {}, isGlobal);
  
  const [period, setPeriod] = useState<Period>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  // State for chart interactivity
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  
  const { t, language } = useLanguage();

  const getDateRange = () => {
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
  };

  const currentReflectionKey = useMemo(() => {
     const { end } = getDateRange();
     return end.toISOString().split('T')[0];
  }, [period, customEnd, customStart]); 

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
        prevPoints
    };
  }, [tasks, period, customStart, customEnd]);

  const diff = chartData.currentScore - chartData.prevScore;
  const isPositive = diff >= 0;

  const getFilteredTasks = () => {
    const { start, end } = getDateRange();
    return tasks.filter(t => {
      const tDate = new Date(t.createdAt);
      return tDate >= start && tDate <= end;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

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

  // Helper for text sanitization in XML/HTML
  const sanitize = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const exportToExcel = () => {
    const data = getFilteredTasks();
    const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
    let csvContent = "\uFEFF"; 
    csvContent += `Report Period,${period}\n`;
    csvContent += `Score,${chartData.currentScore}%\n`;
    csvContent += `Comparison vs Prev,${diff}%\n\n`;
    csvContent += `Self Evaluation,"${reflection.evaluation ? reflection.evaluation.replace(/"/g, '""') : 'N/A'}"\n`;
    csvContent += `Needs Improvement,"${reflection.improvement ? reflection.improvement.replace(/"/g, '""') : 'N/A'}"\n\n`;
    csvContent += `${t.dateTime},${t.taskContent},${t.status},${t.progress},${t.subtasks}\n`;
    data.forEach(task => {
        const d = new Date(task.createdAt);
        const subtasksStr = task.subtasks?.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ') || '';
        csvContent += `${d.toLocaleString(language)},"${task.text.replace(/"/g, '""')}",${task.completed ? t.completed : t.active},${task.progress}%,"${subtasksStr.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `nano-report-${period}.csv`);
  };

  const exportToWord = () => {
      const data = getFilteredTasks();
      const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
      
      let html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset='utf-8'><title>Report</title></head><body>`;
      html += `<h1>${t.reportHeader} - ${period.toUpperCase()}</h1>`;
      html += `<h2>Summary</h2><p>Score: ${chartData.currentScore}% | Tasks: ${chartData.currentCount}</p>`;
      html += `<h3>Reflection</h3><p><strong>Evaluation:</strong> ${sanitize(reflection.evaluation || "N/A")}</p>`;
      html += `<p><strong>Improvement:</strong> ${sanitize(reflection.improvement || "N/A")}</p>`;
      html += `<h3>Tasks</h3><table border="1" style="border-collapse:collapse;width:100%"><tr><th>Time</th><th>Task</th><th>Status</th><th>Progress</th></tr>`;
      data.forEach(t => {
         const d = new Date(t.createdAt);
         html += `<tr><td>${d.toLocaleString()}</td><td>${sanitize(t.text)}</td><td>${t.completed ? "Done" : "Active"}</td><td>${t.progress}%</td></tr>`;
      });
      html += `</table></body></html>`;
      
      const blob = new Blob([html], { type: 'application/msword' });
      downloadFile(blob, `nano-report-${period}.doc`);
  };

  const exportToXML = () => {
      const data = getFilteredTasks();
      const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<report>\n';
      xml += `  <meta>\n    <period>${period}</period>\n    <score>${chartData.currentScore}</score>\n    <totalTasks>${chartData.currentCount}</totalTasks>\n  </meta>\n`;
      xml += `  <reflection>\n    <evaluation>${sanitize(reflection.evaluation || "")}</evaluation>\n    <improvement>${sanitize(reflection.improvement || "")}</improvement>\n  </reflection>\n`;
      xml += `  <tasks>\n`;
      data.forEach(t => {
          xml += `    <task id="${t.id}">\n      <text>${sanitize(t.text)}</text>\n      <status>${t.completed ? 'completed' : 'active'}</status>\n      <progress>${t.progress}</progress>\n      <created>${t.createdAt}</created>\n    </task>\n`;
      });
      xml += `  </tasks>\n</report>`;
      const blob = new Blob([xml], { type: 'text/xml' });
      downloadFile(blob, `nano-report-${period}.xml`);
  };

  const exportToPowerPoint = async () => {
      const pres = new PptxGenJS();
      const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
      
      let slide = pres.addSlide();
      slide.addText(`Productivity Report - ${period.toUpperCase()}`, { x: 1, y: 1, fontSize: 24, bold: true, color: '363636' });
      slide.addText(`Score: ${chartData.currentScore}%`, { x: 1, y: 2, fontSize: 18, color: '00CC99' });
      slide.addText(`Tasks Completed: ${chartData.currentCount}`, { x: 1, y: 2.5, fontSize: 18 });

      slide = pres.addSlide();
      slide.addText("Self Reflection", { x: 0.5, y: 0.5, fontSize: 20, bold: true, color: '6366F1' });
      slide.addText(`Evaluation: ${reflection.evaluation || "N/A"}`, { x: 0.5, y: 1.5, fontSize: 14, w: 8 });
      slide.addText(`Improvement: ${reflection.improvement || "N/A"}`, { x: 0.5, y: 3.5, fontSize: 14, w: 8 });

      pres.writeFile({ fileName: `nano-report-${period}.pptx` });
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

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-transparent relative">
      {/* Header */}
      <div className={`relative overflow-hidden bg-gradient-to-r p-8 text-white shrink-0 shadow-lg md:rounded-t-[2.5rem] z-10 ${activeGroup ? 'from-emerald-600 to-teal-600' : 'from-indigo-600 to-violet-600'}`}>
        <div className="absolute right-0 bottom-0 opacity-10 p-4 animate-float"><PieChart size={120} /></div>
        <h1 className="text-3xl font-black flex items-center gap-3 relative z-10 tracking-tight">
          <BarChart3 size={32} className={activeGroup ? "text-emerald-200" : "text-indigo-200"} />
          {t.reportHeader}
        </h1>
        <p className={`${activeGroup ? "text-emerald-100" : "text-indigo-100"} text-sm mt-2 font-medium opacity-90 relative z-10 tracking-wide`}>
            {activeGroup ? `${t.reportSubHeader} - ${activeGroup.name}` : t.reportSubHeader}
        </p>
      </div>

      {/* Content Wrapper */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar pb-28 md:pb-8">
        <div className="max-w-6xl mx-auto w-full space-y-6">
            
            {/* Period Selector */}
            <div className="flex bg-white/70 backdrop-blur-md p-1.5 rounded-2xl shadow-sm border border-white overflow-x-auto ring-1 ring-slate-100/50">
            {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
                <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 min-w-[70px] py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                    period === p 
                    ? (activeGroup ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-indigo-500 to-violet-600') + ' text-white shadow-md shadow-indigo-500/20' 
                    : 'text-slate-500 hover:bg-white hover:text-slate-700'
                }`}
                >
                {t[p as keyof typeof t]}
                </button>
            ))}
            </div>

            {period === 'custom' && (
                <div className="glass-card p-6 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">{t.startDate}</label>
                        <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full border-none ring-1 ring-slate-200 p-3 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all outline-none font-medium" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-2 block uppercase tracking-wider">{t.endDate}</label>
                        <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full border-none ring-1 ring-slate-200 p-3 rounded-xl text-sm bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200 transition-all outline-none font-medium" />
                    </div>
                </div>
            )}

            {/* Today's Special Report */}
            {period === 'day' && (
                <div className={`relative rounded-[2.5rem] p-8 text-white shadow-2xl overflow-hidden animate-scale-in group ${activeGroup ? 'bg-emerald-600' : 'bg-indigo-600'}`}>
                    {/* Modern mesh background for the card */}
                    <div className={`absolute inset-0 bg-gradient-to-br opacity-90 ${activeGroup ? 'from-emerald-500 via-teal-600 to-green-700' : 'from-indigo-500 via-purple-600 to-violet-700'}`}></div>
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-30 mix-blend-overlay"></div>
                    
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-8">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2 mb-1 opacity-90 tracking-tight"><Calendar size={22}/> {t.reportToday}</h2>
                                <p className="text-white/70 text-sm font-medium">{new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                <TrendingUp size={24} className="text-white"/>
                            </div>
                        </div>
                        
                        <div className="flex flex-wrap gap-4">
                             <div className="flex-1 bg-white/10 p-5 rounded-2xl backdrop-blur-lg border border-white/20 group-hover:bg-white/20 transition-all duration-500">
                                 <p className="text-[10px] uppercase font-bold tracking-widest mb-2 text-white/60">Productivity Score</p>
                                 <p className="text-5xl font-black tracking-tighter">{chartData.currentScore}%</p>
                             </div>
                             <div className="flex-1 bg-white/10 p-5 rounded-2xl backdrop-blur-lg border border-white/20 group-hover:bg-white/20 transition-all duration-500 delay-75">
                                 <p className="text-[10px] uppercase font-bold tracking-widest mb-2 text-white/60">Tasks Completed</p>
                                 <p className="text-5xl font-black tracking-tighter">{chartData.currentCount}</p>
                             </div>
                        </div>
                    </div>
                    <ArrowUpRight className="absolute -right-8 -top-8 text-white/10 w-64 h-64 rotate-12 group-hover:rotate-45 group-hover:scale-110 transition-all duration-700" />
                </div>
            )}

            {/* Area Chart Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-card rounded-[2.5rem] p-8 animate-fade-in flex flex-col justify-between" style={{animationDelay: '0.1s'}}>
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                                <TrendingUp size={18} className={activeGroup ? "text-teal-500" : "text-indigo-500"}/>
                                {t.comparison}
                            </h3>
                            <p className="text-xs text-slate-400 font-bold mt-1 uppercase tracking-wide">{t.vsPrev}</p>
                        </div>
                        <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
                            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300"></span> {t.periodPrev}</div>
                            <div className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-full ${activeGroup ? 'bg-teal-500' : 'bg-indigo-500'}`}></span> {t.periodCurrent}</div>
                        </div>
                    </div>
                    
                    {/* SVG Chart */}
                    <div className="w-full h-56 relative group/chart">
                        <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            <defs>
                                <linearGradient id="gradientCurrent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={activeGroup ? "#2dd4bf" : "#818cf8"} stopOpacity="0.4" />
                                    <stop offset="100%" stopColor={activeGroup ? "#2dd4bf" : "#818cf8"} stopOpacity="0" />
                                </linearGradient>
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                                    <feMerge>
                                        <feMergeNode in="coloredBlur"/>
                                        <feMergeNode in="SourceGraphic"/>
                                    </feMerge>
                                </filter>
                            </defs>

                            {/* Previous Period (Dotted) */}
                            <path d={generateAreaPath(chartData.prevPoints, 100, 50)} fill="#f1f5f9" />
                            <path d={generateLinePath(chartData.prevPoints, 100, 50)} fill="none" stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3,3" />
                            
                            {/* Current Period (Animated) */}
                            <path d={generateAreaPath(chartData.currentPoints, 100, 50)} fill="url(#gradientCurrent)" opacity="0.9" className="animate-fade-in" />
                            <path 
                                key={`line-${period}-${activeGroup?.id}`}
                                d={generateLinePath(chartData.currentPoints, 100, 50)} 
                                fill="none" 
                                stroke={activeGroup ? "#14b8a6" : "#6366f1"} 
                                strokeWidth="2" 
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="animate-draw-path"
                            />

                            {/* Interaction Layer & Tooltips */}
                            {chartData.currentPoints.map((point, index) => {
                                const x = index * (100 / (chartData.currentPoints.length - 1));
                                const y = 50 - (point.value / 100) * 50;
                                const isHovered = hoveredIndex === index;

                                return (
                                    <g key={index} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)}>
                                        {/* Invisible Trigger Zone */}
                                        <rect 
                                            x={x - 5} 
                                            y="0" 
                                            width="10" 
                                            height="50" 
                                            fill="transparent" 
                                            className="cursor-crosshair"
                                        />
                                        
                                        {/* Tooltip Elements (Only show when hovered) */}
                                        {isHovered && (
                                            <>
                                                {/* Vertical Line */}
                                                <line 
                                                    x1={x} y1={y} x2={x} y2="50" 
                                                    stroke={activeGroup ? "#14b8a6" : "#6366f1"} 
                                                    strokeWidth="0.5" 
                                                    strokeDasharray="2,2" 
                                                    opacity="0.6"
                                                />
                                                
                                                {/* Glowing Dot */}
                                                <circle 
                                                    cx={x} cy={y} r="2.5" 
                                                    fill="white" 
                                                    stroke={activeGroup ? "#14b8a6" : "#6366f1"} 
                                                    strokeWidth="1.5"
                                                    filter="url(#glow)"
                                                />

                                                {/* Tooltip Box */}
                                                <g transform={`translate(${index > 4 ? x - 25 : x - 10}, ${y - 12})`}>
                                                    <rect 
                                                        x="0" y="0" width="35" height="14" rx="3" 
                                                        fill="white" 
                                                        stroke={activeGroup ? "#ccfbf1" : "#e0e7ff"}
                                                        strokeWidth="0.5"
                                                        filter="drop-shadow(0 2px 4px rgb(0 0 0 / 0.1))"
                                                    />
                                                    <text x="17.5" y="6" textAnchor="middle" fontSize="3" fontWeight="bold" fill="#334155">
                                                        {point.value}%
                                                    </text>
                                                    <text x="17.5" y="10" textAnchor="middle" fontSize="2.5" fill="#94a3b8">
                                                        {point.date.getDate()}/{point.date.getMonth() + 1}
                                                    </text>
                                                </g>
                                            </>
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-slate-300 font-bold pt-4 border-t border-slate-50">
                             <span>Start</span>
                             <span>Middle</span>
                             <span>End</span>
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-center gap-3 text-sm bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        <span className="text-slate-500 font-bold uppercase text-[10px] tracking-widest">{t.productivityTrend}</span>
                        <span className={`font-black text-lg flex items-center ${isPositive ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isPositive ? <TrendingUp size={20} className="mr-1.5"/> : <TrendingDown size={20} className="mr-1.5"/>}
                            {diff > 0 ? '+' : ''}{diff}%
                        </span>
                    </div>
                </div>

                {/* Reflection Area */}
                <div className="glass-card rounded-[2.5rem] p-8 flex flex-col animate-fade-in" style={{animationDelay: '0.2s'}}>
                    <h3 className="text-base font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <PenSquare size={18} className="text-orange-500"/>
                        {t.selfEval}
                    </h3>
                    <div className="flex-1 space-y-6">
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block group-focus-within:text-orange-500 transition-colors">{t.selfEval} (Required)</label>
                            <textarea 
                                className="w-full h-32 p-4 bg-slate-50 hover:bg-white border-none ring-1 ring-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-200 focus:bg-white resize-none placeholder:text-slate-400 transition-all shadow-inner"
                                placeholder={t.writeReflection}
                                value={(reflections[currentReflectionKey] || {}).evaluation || ''}
                                onChange={(e) => handleReflectionChange('evaluation', e.target.value)}
                            />
                        </div>
                        <div className="group">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block group-focus-within:text-blue-500 transition-colors">{t.improve} (Required)</label>
                            <textarea 
                                className="w-full h-32 p-4 bg-slate-50 hover:bg-white border-none ring-1 ring-slate-200 rounded-2xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-200 focus:bg-white resize-none placeholder:text-slate-400 transition-all shadow-inner"
                                placeholder={t.writeImprovement}
                                value={(reflections[currentReflectionKey] || {}).improvement || ''}
                                onChange={(e) => handleReflectionChange('improvement', e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Export & Share */}
            <div className="glass-card rounded-[2.5rem] p-8 animate-fade-in" style={{animationDelay: '0.3s'}}>
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