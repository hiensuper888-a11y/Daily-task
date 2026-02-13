import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Calendar, PieChart, FileSpreadsheet, FileText, FileCode, Presentation, Share2, PenSquare, ArrowUpRight, Minus } from 'lucide-react';
import { Task, ReflectionMap } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import PptxGenJS from 'pptxgenjs';

type Period = 'day' | 'week' | 'month' | 'year' | 'custom';

export const Reports: React.FC = () => {
  const [tasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [reflections, setReflections] = useRealtimeStorage<ReflectionMap>('reflections', {});
  const [period, setPeriod] = useState<Period>('day');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
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

    // Calculate score helpers
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
        // Add Subtasks as a semicolon separated list in the last column
        const subtasksStr = task.subtasks?.map(s => `[${s.completed ? 'x' : ' '}] ${s.text}`).join('; ') || '';
        
        csvContent += `${d.toLocaleString(language)},"${task.text.replace(/"/g, '""')}",${task.completed ? t.completed : t.active},${task.progress}%,"${subtasksStr.replace(/"/g, '""')}"\n`;
    });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    downloadFile(blob, `nano-report-${period}.csv`);
  };

  const exportToWord = () => {
    const data = getFilteredTasks();
    const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
    const htmlContent = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><meta charset="utf-8"><title>Report</title></head>
      <body style="font-family: Arial, sans-serif;">
        <h1 style="color:#059669">${t.reportHeader} - ${t[period]}</h1>
        <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
        <h2 style="background:#f0fdf4; padding:5px;">Overview</h2>
        <ul>
            <li>Completion Rate: <strong>${chartData.currentScore}%</strong></li>
            <li>Total Tasks: ${chartData.currentCount}</li>
            <li>Vs Previous Period: ${diff > 0 ? '+' : ''}${diff}%</li>
        </ul>
        <h2 style="background:#fff7ed; padding:5px;">Reflection</h2>
        <p><strong>${t.selfEval}:</strong><br/>${reflection.evaluation || '---'}</p>
        <p><strong>${t.improve}:</strong><br/>${reflection.improvement || '---'}</p>
        <h2 style="background:#eff6ff; padding:5px;">Task Details</h2>
        <table border="1" style="border-collapse:collapse;width:100%">
          <thead><tr style="background:#f1f5f9"><th>${t.dateTime}</th><th>${t.taskContent}</th><th>${t.status}</th><th>${t.progress}</th></tr></thead>
          <tbody>
            ${data.map(tTask => {
                let subtasksHtml = '';
                if (tTask.subtasks && tTask.subtasks.length > 0) {
                    subtasksHtml = '<ul style="margin:5px 0; padding-left:20px; font-size:0.9em; color:#666;">' + 
                        tTask.subtasks.map(s => `<li>${s.completed ? '☑' : '☐'} ${s.text}</li>`).join('') + 
                        '</ul>';
                }
                return `<tr>
                    <td>${new Date(tTask.createdAt).toLocaleString(language)}</td>
                    <td><b>${tTask.text}</b>${subtasksHtml}</td>
                    <td>${tTask.completed ? t.completed : t.active}</td>
                    <td>${tTask.progress}%</td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </body></html>
    `;
    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    downloadFile(blob, `nano-report-${period}.doc`);
  };

  const exportToXML = () => {
    const data = getFilteredTasks();
    const reflection = reflections[currentReflectionKey] || { evaluation: '', improvement: '' };
    let xmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<report period="${period}">\n`;
    xmlContent += `  <summary>\n    <score>${chartData.currentScore}</score>\n    <diff>${diff}</diff>\n  </summary>\n`;
    xmlContent += `  <reflection>\n    <evaluation>${reflection.evaluation || ''}</evaluation>\n    <improvement>${reflection.improvement || ''}</improvement>\n  </reflection>\n`;
    data.forEach(task => {
      let subtasksXml = '';
      if (task.subtasks && task.subtasks.length > 0) {
          subtasksXml = '\n    <subtasks>\n' + 
              task.subtasks.map(s => `      <item completed="${s.completed}">${s.text.replace(/&/g, '&amp;')}</item>`).join('\n') + 
              '\n    </subtasks>';
      }
      xmlContent += `  <task>\n    <dateTime>${new Date(task.createdAt).toLocaleString(language)}</dateTime>\n    <content>${task.text.replace(/&/g, '&amp;')}</content>\n    <status>${task.completed ? 'completed' : 'active'}</status>\n    <progress>${task.progress}</progress>${subtasksXml}\n  </task>\n`;
    });
    xmlContent += `</report>`;
    const blob = new Blob([xmlContent], { type: 'text/xml;charset=utf-8;' });
    downloadFile(blob, `nano-report-${period}.xml`);
  }

  const exportToPowerPoint = async () => {
      try {
        const pres = new PptxGenJS();
        const slide = pres.addSlide();
        slide.addText(`${t.reportHeader} - ${t[period]}`, { x: 0.5, y: 0.5, fontSize: 18, bold: true });
        slide.addText(`Score: ${chartData.currentScore}%`, { x: 0.5, y: 1.0, fontSize: 14 });
        await pres.writeFile({ fileName: `nano-report-${period}.pptx` });
      } catch(e) { console.error(e) }
  }

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
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-white md:rounded-3xl">
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 p-8 text-white shrink-0 shadow-lg">
        <div className="absolute right-0 bottom-0 opacity-10 p-4"><PieChart size={100} /></div>
        <h1 className="text-2xl font-bold flex items-center gap-3 relative z-10">
          <BarChart3 size={28} className="text-emerald-200" />
          {t.reportHeader}
        </h1>
        <p className="text-emerald-100 text-sm mt-2 font-medium opacity-90 relative z-10">{t.reportSubHeader}</p>
      </div>

      {/* Content Wrapper */}
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar pb-24 md:pb-6">
        <div className="max-w-6xl mx-auto w-full space-y-6">
            
            {/* Period Selector */}
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            {(['day', 'week', 'month', 'year', 'custom'] as Period[]).map((p) => (
                <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`flex-1 min-w-[60px] py-2 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-wide transition-all ${
                    period === p ? 'bg-emerald-100 text-emerald-700 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
                >
                {t[p]}
                </button>
            ))}
            </div>

            {period === 'custom' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.startDate}</label>
                        <input type="datetime-local" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 mb-1 block">{t.endDate}</label>
                        <input type="datetime-local" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-full border p-2 rounded-lg text-sm" />
                    </div>
                </div>
            )}

            {/* Today's Special Report */}
            {period === 'day' && (
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-md relative overflow-hidden animate-fade-in">
                    <div className="relative z-10">
                        <h2 className="text-lg font-bold flex items-center gap-2 mb-1"><Calendar size={20}/> {t.reportToday}</h2>
                        <p className="text-indigo-100 text-sm mb-4">{new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        <div className="flex items-center gap-4">
                             <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm min-w-[100px]">
                                 <p className="text-xs text-indigo-100 uppercase font-bold">Score</p>
                                 <p className="text-3xl font-black">{chartData.currentScore}%</p>
                             </div>
                             <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm min-w-[100px]">
                                 <p className="text-xs text-indigo-100 uppercase font-bold">Tasks</p>
                                 <p className="text-3xl font-black">{chartData.currentCount}</p>
                             </div>
                        </div>
                    </div>
                    <ArrowUpRight className="absolute -right-4 -top-4 text-white/10 w-32 h-32" />
                </div>
            )}

            {/* Area Chart Comparison */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                            <TrendingUp size={16} className="text-emerald-500"/>
                            {t.comparison} ({t.vsPrev})
                        </h3>
                        <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider">
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300"></span> {t.periodPrev}</div>
                            <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> {t.periodCurrent}</div>
                        </div>
                    </div>
                    
                    {/* SVG Chart */}
                    <div className="w-full h-48 relative">
                        <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                            {/* Previous Period Area */}
                            <path 
                                d={generateAreaPath(chartData.prevPoints, 100, 50)} 
                                fill="#e2e8f0" 
                                opacity="0.6"
                            />
                            {/* Current Period Area */}
                            <path 
                                d={generateAreaPath(chartData.currentPoints, 100, 50)} 
                                fill="url(#gradientCurrent)" 
                                opacity="0.8"
                            />
                            {/* Lines for cleaner look */}
                            <path d={generateLinePath(chartData.prevPoints, 100, 50)} fill="none" stroke="#94a3b8" strokeWidth="0.5" strokeDasharray="2,2" />
                            <path d={generateLinePath(chartData.currentPoints, 100, 50)} fill="none" stroke="#10b981" strokeWidth="1" />

                            <defs>
                                <linearGradient id="gradientCurrent" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#34d399" stopOpacity="0.5" />
                                    <stop offset="100%" stopColor="#34d399" stopOpacity="0.1" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Axis Labels (Simplified) */}
                        <div className="absolute inset-x-0 bottom-0 flex justify-between text-[10px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                             <span>Start</span>
                             <span>Middle</span>
                             <span>End</span>
                        </div>
                    </div>

                    <div className="mt-4 flex items-center justify-center gap-2 text-sm">
                        <span className="text-slate-500 font-medium">{t.productivityTrend}:</span>
                        <span className={`font-bold flex items-center ${isPositive ? 'text-emerald-600' : 'text-red-500'}`}>
                            {isPositive ? <TrendingUp size={14} className="mr-1"/> : <TrendingDown size={14} className="mr-1"/>}
                            {diff > 0 ? '+' : ''}{diff}%
                        </span>
                        {diff === 0 && <span className="text-slate-400 font-bold flex items-center"><Minus size={14} className="mr-1"/> 0%</span>}
                    </div>
                </div>

                {/* Reflection Area */}
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                        <PenSquare size={16} className="text-orange-500"/>
                        {t.selfEval}
                    </h3>
                    <div className="flex-1 space-y-4">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t.selfEval} (Required)</label>
                            <textarea 
                                className="w-full h-20 p-3 bg-orange-50/30 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-200 resize-none placeholder:text-slate-400"
                                placeholder={t.writeReflection}
                                value={(reflections[currentReflectionKey] || {}).evaluation || ''}
                                onChange={(e) => handleReflectionChange('evaluation', e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">{t.improve} (Required)</label>
                            <textarea 
                                className="w-full h-20 p-3 bg-blue-50/30 border border-blue-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 resize-none placeholder:text-slate-400"
                                placeholder={t.writeImprovement}
                                value={(reflections[currentReflectionKey] || {}).improvement || ''}
                                onChange={(e) => handleReflectionChange('improvement', e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400 italic text-right">* {t.export} will include these notes.</p>
                    </div>
                </div>
            </div>

            {/* Export & Share */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Share2 size={16} className="text-emerald-500"/> {t.export}
                </h3>
                <div className="grid grid-cols-4 gap-3">
                    <button onClick={exportToExcel} className="flex flex-col items-center p-3 border hover:bg-green-50 rounded-xl transition-colors">
                        <FileSpreadsheet size={20} className="text-green-600 mb-1"/>
                        <span className="text-[10px] font-bold">Excel</span>
                    </button>
                    <button onClick={exportToWord} className="flex flex-col items-center p-3 border hover:bg-blue-50 rounded-xl transition-colors">
                        <FileText size={20} className="text-blue-600 mb-1"/>
                        <span className="text-[10px] font-bold">Word</span>
                    </button>
                     <button onClick={exportToPowerPoint} className="flex flex-col items-center p-3 border hover:bg-orange-50 rounded-xl transition-colors">
                        <Presentation size={20} className="text-orange-600 mb-1"/>
                        <span className="text-[10px] font-bold">PPTX</span>
                    </button>
                    <button onClick={exportToXML} className="flex flex-col items-center p-3 border hover:bg-purple-50 rounded-xl transition-colors">
                        <FileCode size={20} className="text-purple-600 mb-1"/>
                        <span className="text-[10px] font-bold">XML</span>
                    </button>
                </div>
            </div>
            
        </div>
      </div>
    </div>
  );
};