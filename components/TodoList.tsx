import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer } from 'lucide-react';
import { Task, FilterType, Priority } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  // Enhanced Input States
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined); // in minutes
  const [showInputDetails, setShowInputDetails] = useState(false);

  // Filtering & Sorting
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View Navigation State
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  const { t, language } = useLanguage();

  // Helper: Format Date for Input (YYYY-MM-DDTHH:mm)
  const toLocalISOString = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Helper: Format Estimated Time display
  const formatEstimate = (mins: number) => {
      if (mins < 60) return `${mins} ${t.minutes}`;
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${hrs}h ${m}m` : `${hrs} ${t.hours}`;
  };

  // Helper: Format Deadline Display (Relative & Status)
  const formatDeadline = (isoString: string) => {
      const target = new Date(isoString);
      const now = new Date();
      if(isNaN(target.getTime())) return null;

      const diffMs = target.getTime() - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      
      const isOverdue = diffMs < 0;
      const isSoon = diffHrs > 0 && diffHrs < 24;

      let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
      let colorClass = 'text-slate-500 bg-slate-50 border-slate-200';
      let icon = <CalendarClock size={12} />;

      if (isOverdue) {
          text = t.overdue; // Or show specific date
          colorClass = 'text-red-600 bg-red-50 border-red-200 font-bold';
          icon = <AlertCircle size={12} />;
      } else if (isSoon) {
          const hrsLeft = Math.ceil(diffHrs);
          text = `${hrsLeft}h left`;
          colorClass = 'text-orange-600 bg-orange-50 border-orange-200 font-bold';
          icon = <Timer size={12} />;
      }

      return { text, fullDate: target.toLocaleString(), colorClass, icon, isOverdue };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
  };

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
    // Created Date logic
    let createdDate = new Date(viewDate);
    const now = new Date();
    if (isToday(viewDate)) {
        createdDate = now;
    } else {
        createdDate.setHours(9, 0, 0); 
    }

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: createdDate.toISOString(),
      deadline: deadline || undefined,
      estimatedTime: estimatedTime,
      archived: false,
      subtasks: [],
      priority: newPriority
    };

    setTasks([newTask, ...tasks]);
    
    // Reset inputs
    setInputValue('');
    setDeadline('');
    setEstimatedTime(undefined);
    // Don't close details immediately to allow rapid entry
    setNewPriority('medium');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTask();
  };

  // --- ACTIONS ---
  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = !task.completed;
        if (newCompleted) playSuccessSound();
        return { 
            ...task, 
            completed: newCompleted, 
            progress: newCompleted ? 100 : 0,
            subtasks: task.subtasks?.map(s => ({ ...s, completed: newCompleted }))
        };
      }
      return task;
    }));
  };

  const updateProgress = (id: number, val: string) => {
    const progress = parseInt(val, 10);
    setTasks(tasks.map(t => t.id === id ? { ...t, progress, completed: progress === 100 } : t));
    if (progress === 100) playSuccessSound();
  };

  const deleteTask = (id: number) => setTasks(tasks.filter(t => t.id !== id));

  // Subtasks
  const addSubtask = (taskId: number) => {
      const text = subtaskInputs[taskId]?.trim();
      if (!text) return;
      setTasks(tasks.map(t => {
          if (t.id === taskId) {
              const newSub = [...(t.subtasks || []), { id: Date.now(), text, completed: false }];
              const progress = Math.round((newSub.filter(s => s.completed).length / newSub.length) * 100);
              return { ...t, subtasks: newSub, progress, completed: progress === 100 };
          }
          return t;
      }));
      setSubtaskInputs(prev => ({...prev, [taskId]: ''}));
  };

  const toggleSubtask = (taskId: number, subId: number) => {
      setTasks(tasks.map(t => {
          if (t.id === taskId && t.subtasks) {
              const newSub = t.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
              const progress = Math.round((newSub.filter(s => s.completed).length / newSub.length) * 100);
              return { ...t, subtasks: newSub, progress, completed: progress === 100 };
          }
          return t;
      }));
  };

  // --- FILTERING ---
  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const tDate = new Date(t.createdAt);
        const isSameDay = tDate.getDate() === viewDate.getDate() &&
                          tDate.getMonth() === viewDate.getMonth() &&
                          tDate.getFullYear() === viewDate.getFullYear();
        if (!isSameDay || t.archived) return false;
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        // Priority
        const pMap = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'medium'];
        const pB = pMap[b.priority || 'medium'];
        if (pA !== pB) return pB - pA;
        // Time
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [tasks, viewDate, filterStatus, searchQuery]);

  const stats = useMemo(() => {
      const dayTasks = tasks.filter(t => !t.archived && new Date(t.createdAt).toDateString() === viewDate.toDateString());
      return {
          total: dayTasks.length,
          completed: dayTasks.filter(t => t.completed).length,
          progress: dayTasks.length ? Math.round(dayTasks.reduce((acc, t) => acc + t.progress, 0) / dayTasks.length) : 0
      };
  }, [tasks, viewDate]);

  return (
    <div className="flex flex-col h-full relative">
      
      {/* --- HEADER --- */}
      <div className="px-6 py-6 pb-2">
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">{t.todoHeader}</h1>
                    <p className="text-slate-400 font-medium text-sm mt-1">
                        {stats.completed} / {stats.total} {t.items} • {stats.progress}% {t.done}
                    </p>
                </div>
                <div className="relative w-14 h-14">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-indigo-600 transition-all duration-1000 ease-out" strokeDasharray={`${stats.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-600">
                        {stats.progress}%
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="bg-white rounded-2xl p-2 shadow-sm border border-slate-100 flex items-center justify-between">
                    <button onClick={() => navigateDate(-1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex flex-col items-center cursor-pointer group relative">
                        <input 
                            type="date" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                                if(e.target.value) setViewDate(new Date(e.target.value));
                            }}
                            value={toLocalISOString(viewDate).split('T')[0]}
                        />
                        <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-0.5">
                            {isToday(viewDate) ? t.today : viewDate.toLocaleDateString(language, { weekday: 'long' })}
                        </span>
                        <span className="text-lg font-bold text-slate-800 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                            {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
                            <CalendarIcon size={14} className="text-slate-300 group-hover:text-indigo-400"/>
                        </span>
                    </div>

                    <button onClick={() => navigateDate(1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                                filterStatus === f 
                                ? 'bg-slate-800 text-white shadow-md shadow-slate-200' 
                                : 'bg-white text-slate-500 border border-slate-100 hover:bg-slate-50'
                            }`}
                        >
                            {t[f]}
                        </button>
                    ))}
                    <div className="w-px h-6 bg-slate-200 mx-1 shrink-0"></div>
                    <div className="relative flex-1">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white border border-slate-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- TASK LIST --- */}
      <div className="flex-1 overflow-y-auto px-6 pb-40 custom-scrollbar">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Archive size={32} className="opacity-30" />
                </div>
                <p className="text-sm font-medium">{t.emptyTasks}</p>
            </div>
        ) : (
            <div className="space-y-4">
                {filteredTasks.map((task) => {
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const isOverdue = deadlineInfo?.isOverdue && !task.completed;
                    
                    return (
                        <div 
                            key={task.id}
                            className={`group bg-white rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 ${
                                task.completed 
                                ? 'border-slate-100 opacity-60 bg-slate-50/50' 
                                : isOverdue 
                                    ? 'border-red-200 bg-red-50/10' 
                                    : 'border-slate-100 hover:border-indigo-200'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`mt-1 shrink-0 transition-colors ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}
                                >
                                    {task.completed ? <CheckCircle2 size={24} className="fill-emerald-50" /> : <Circle size={24} strokeWidth={2} />}
                                </button>
                                
                                <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <p 
                                            onClick={() => toggleTask(task.id)}
                                            className={`text-base font-semibold leading-relaxed cursor-pointer transition-all ${
                                                task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                            }`}
                                        >
                                            {task.text}
                                        </p>
                                        <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    
                                    {/* Task Info Chips */}
                                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                                        {/* Priority */}
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border flex items-center gap-1.5 ${
                                            task.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            task.priority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                            <Flag size={10} fill="currentColor" /> {t[task.priority || 'medium']}
                                        </span>

                                        {/* Assigned Date */}
                                        <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border bg-slate-50 text-slate-500 border-slate-100" title={new Date(task.createdAt).toLocaleString()}>
                                            <CalendarDays size={10} />
                                            {t.assignedDate}: {new Date(task.createdAt).toLocaleDateString(language, {day: 'numeric', month: 'numeric'})}
                                        </span>

                                        {/* Estimate */}
                                        {task.estimatedTime && (
                                            <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border bg-indigo-50 text-indigo-600 border-indigo-100">
                                                <Hourglass size={10} />
                                                {formatEstimate(task.estimatedTime)}
                                            </span>
                                        )}

                                        {/* Deadline */}
                                        {deadlineInfo && (
                                            <span className={`text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border ${deadlineInfo.colorClass}`} title={deadlineInfo.fullDate}>
                                                {deadlineInfo.icon}
                                                {deadlineInfo.text}
                                            </span>
                                        )}
                                    </div>

                                    {!task.completed && (
                                        <div className="mt-4 flex items-center gap-2 group/slider">
                                            <div className="relative flex-1 h-1.5 bg-slate-100 rounded-full">
                                                <div 
                                                    className={`absolute h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : 'bg-indigo-500'}`}
                                                    style={{width: `${task.progress}%`}}
                                                ></div>
                                                <input 
                                                    type="range" 
                                                    min="0" max="100" 
                                                    value={task.progress}
                                                    onChange={(e) => updateProgress(task.id, e.target.value)}
                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                />
                                            </div>
                                            <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">{task.progress}%</span>
                                        </div>
                                    )}

                                    {/* Subtasks */}
                                    {(task.subtasks && task.subtasks.length > 0 || subtaskInputs[task.id]) && (
                                        <div className="mt-3 pt-3 border-t border-slate-50">
                                            {task.subtasks?.map(sub => (
                                                <div key={sub.id} className="flex items-center gap-2 mb-2 group/sub">
                                                    <button onClick={() => toggleSubtask(task.id, sub.id)} className={sub.completed ? 'text-emerald-500' : 'text-slate-300'}>
                                                        {sub.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    </button>
                                                    <span className={`text-xs flex-1 ${sub.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}>{sub.text}</span>
                                                    <X 
                                                        size={12} 
                                                        className="text-slate-300 hover:text-red-500 cursor-pointer opacity-0 group-hover/sub:opacity-100"
                                                        onClick={() => {
                                                            const newSub = task.subtasks?.filter(s => s.id !== sub.id);
                                                            const newProg = newSub?.length ? Math.round((newSub.filter(s => s.completed).length / newSub.length) * 100) : task.progress;
                                                            setTasks(tasks.map(t => t.id === task.id ? { ...t, subtasks: newSub, progress: newProg } : t));
                                                        }}
                                                    />
                                                </div>
                                            ))}
                                            <div className="flex items-center gap-2">
                                                <PlusCircle size={14} className="text-indigo-400" />
                                                <input 
                                                    className="bg-transparent text-xs focus:outline-none w-full placeholder:text-slate-300"
                                                    placeholder={t.addSubtask}
                                                    value={subtaskInputs[task.id] || ''}
                                                    onChange={(e) => setSubtaskInputs({...subtaskInputs, [task.id]: e.target.value})}
                                                    onKeyDown={(e) => {
                                                        if(e.key === 'Enter') addSubtask(task.id);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {/* --- SMART INPUT BAR --- */}
      <div className="absolute bottom-4 left-0 right-0 px-4 z-30">
        <div className={`max-w-3xl mx-auto bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl shadow-indigo-900/15 border border-white/50 ring-1 ring-slate-900/5 transition-all duration-300 ${showInputDetails ? 'p-4 rounded-[1.5rem]' : 'p-2'}`}>
            
            {/* Quick Actions (Expanded) */}
            {showInputDetails && (
                <div className="flex flex-wrap items-center gap-3 mb-3 animate-fade-in border-b border-slate-100 pb-3">
                    {/* Reliable Deadline Picker */}
                    <div className="relative group flex items-center bg-slate-50 rounded-full border border-slate-200 focus-within:border-indigo-300 focus-within:bg-indigo-50 transition-colors">
                        <div className="relative flex items-center">
                            <button 
                                type="button"
                                className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-bold transition-all ${deadline ? 'text-indigo-700' : 'text-slate-500'}`}
                            >
                                <CalendarClock size={14} className={deadline ? "text-indigo-600" : "text-slate-400"} /> 
                                <span>{deadline ? new Date(deadline).toLocaleString(language, {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : t.setDeadline}</span>
                            </button>
                            
                            {/* Input Overlay - The Fix */}
                            <input 
                                type="datetime-local" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                        
                        {/* Clear Button */}
                        {deadline && (
                            <button 
                                onClick={() => setDeadline('')}
                                className="mr-1 p-1 text-slate-400 hover:text-red-500 rounded-full hover:bg-white transition-colors z-20"
                                title="Clear Deadline"
                            >
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Estimate Time */}
                    <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-full p-1 pl-3">
                        <Hourglass size={14} className="text-slate-400"/>
                        <select 
                            className="bg-transparent text-xs font-bold text-slate-600 focus:outline-none py-1 cursor-pointer pr-2"
                            value={estimatedTime || ''}
                            onChange={(e) => setEstimatedTime(e.target.value ? parseInt(e.target.value) : undefined)}
                        >
                            <option value="">{t.setEstimate}</option>
                            <option value="15">15 {t.minutes}</option>
                            <option value="30">30 {t.minutes}</option>
                            <option value="45">45 {t.minutes}</option>
                            <option value="60">1 {t.hours}</option>
                            <option value="120">2 {t.hours}</option>
                            <option value="240">4 {t.hours}</option>
                        </select>
                        {estimatedTime && (
                             <button 
                                onClick={() => setEstimatedTime(undefined)}
                                className="p-1 text-slate-400 hover:text-red-500"
                             >
                                 <X size={12} />
                             </button>
                        )}
                    </div>

                     {/* Priority */}
                     <div className="flex gap-1 ml-auto">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`w-6 h-6 rounded-full transition-all flex items-center justify-center border ${
                                    newPriority === p 
                                    ? (p === 'high' ? 'bg-rose-500 border-rose-600 text-white scale-110' : p === 'medium' ? 'bg-amber-500 border-amber-600 text-white scale-110' : 'bg-emerald-500 border-emerald-600 text-white scale-110') 
                                    : 'bg-white border-slate-200 text-transparent hover:bg-slate-100'
                                }`}
                                title={p}
                            >
                                <CheckCircle2 size={12} strokeWidth={3} className={newPriority === p ? "opacity-100" : "opacity-0"} />
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Row */}
            <div className="flex items-center gap-2">
                <button 
                    onClick={() => setShowInputDetails(!showInputDetails)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all border ${
                        showInputDetails 
                        ? 'bg-slate-800 text-white border-slate-800 rotate-90' 
                        : 'bg-white text-slate-400 border-slate-200 hover:border-indigo-300 hover:text-indigo-600'
                    }`}
                >
                    <SlidersHorizontal size={18} />
                </button>

                <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t.addTaskPlaceholder}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-800 placeholder:text-slate-400 h-10 px-2"
                />

                <button 
                    onClick={addTask}
                    disabled={!inputValue.trim()}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        inputValue.trim() 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95' 
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                >
                    <Plus size={22} />
                </button>
            </div>
        </div>
      </div>

    </div>
  );
};