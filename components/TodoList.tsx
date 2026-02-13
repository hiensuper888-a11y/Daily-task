import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, ListFilter, Archive, TrendingUp, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, ArrowDown, ArrowUp, Minus, Search, SlidersHorizontal, Clock, MoreHorizontal, CalendarClock, Bell, BellOff, Flag } from 'lucide-react';
import { Task, Subtask, FilterType, Priority } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  // Specific Task Time State
  const [specificDate, setSpecificDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  
  // Filtering & Sorting
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View Navigation State
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { t, language } = useLanguage();

  // Helper: Format Date for Input (YYYY-MM-DDTHH:mm)
  const toLocalISOString = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Helper: Display nice time
  const formatDisplayTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-US', { hour: '2-digit', minute: '2-digit' });
  };

  // Sync specificDate when viewDate changes (Optional: resets the picker to currently viewed day at current time)
  useEffect(() => {
    const now = new Date();
    const target = new Date(viewDate);
    // If viewing today, use current time. If viewing other day, default to 9:00 AM
    if (target.toDateString() === now.toDateString()) {
        target.setHours(now.getHours(), now.getMinutes());
    } else {
        target.setHours(9, 0);
    }
    setSpecificDate(toLocalISOString(target));
  }, [viewDate]);

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
    
    // Logic: If user selected a specific time in the picker, use it.
    // Otherwise, default to the currently viewed date + current time.
    let finalDate = new Date(specificDate);
    if (isNaN(finalDate.getTime())) {
        finalDate = new Date(viewDate);
        const now = new Date();
        finalDate.setHours(now.getHours(), now.getMinutes());
    }

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: finalDate.toISOString(),
      archived: false,
      subtasks: [],
      priority: newPriority
    };

    setTasks([newTask, ...tasks]);
    setInputValue('');
    setIsDatePickerOpen(false);
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
        if (a.completed !== b.completed) return a.completed ? 1 : -1; // Completed last
        // Then by Priority
        const pMap = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'medium'];
        const pB = pMap[b.priority || 'medium'];
        if (pA !== pB) return pB - pA;
        // Then by Time
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
      
      {/* --- HEADER SECTION --- */}
      <div className="px-6 py-6 pb-4">
        <div className="flex flex-col gap-6">
            {/* Top Bar: Title & Stats */}
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

            {/* Date Navigation & Filters */}
            <div className="flex flex-col gap-4">
                {/* Date Card */}
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

                {/* Filter Pills */}
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
      <div className="flex-1 overflow-y-auto px-6 pb-32 custom-scrollbar">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <Archive size={32} className="opacity-30" />
                </div>
                <p className="text-sm font-medium">{t.emptyTasks}</p>
            </div>
        ) : (
            <div className="space-y-3">
                {filteredTasks.map((task) => {
                    const isOverdue = !task.completed && new Date(task.createdAt) < new Date() && !isToday(new Date(task.createdAt));
                    
                    return (
                        <div 
                            key={task.id}
                            className={`group bg-white rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/5 ${
                                task.completed 
                                ? 'border-slate-100 opacity-60' 
                                : isOverdue 
                                    ? 'border-red-100 bg-red-50/10' 
                                    : 'border-slate-100 hover:border-indigo-200'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Checkbox */}
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
                                            className={`text-sm sm:text-base font-semibold leading-relaxed cursor-pointer transition-all ${
                                                task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                            }`}
                                        >
                                            {task.text}
                                        </p>
                                        <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                                        {/* Time Badge */}
                                        <span className={`text-[10px] font-bold flex items-center gap-1 px-2 py-0.5 rounded-md border ${
                                            isOverdue && !task.completed
                                            ? 'bg-red-50 text-red-600 border-red-100' 
                                            : 'bg-slate-50 text-slate-500 border-slate-100'
                                        }`}>
                                            <Clock size={10} />
                                            {formatDisplayTime(task.createdAt)}
                                        </span>
                                        
                                        {/* Priority Badge */}
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 ${
                                            task.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                            task.priority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                            'bg-amber-50 text-amber-600 border-amber-100'
                                        }`}>
                                            <Flag size={10} fill="currentColor" /> {t[task.priority || 'medium']}
                                        </span>
                                    </div>

                                    {/* Slider */}
                                    {!task.completed && (
                                        <div className="mt-3 flex items-center gap-2 group/slider">
                                            <div className="relative flex-1 h-1.5 bg-slate-100 rounded-full">
                                                <div 
                                                    className="absolute h-full bg-indigo-500 rounded-full transition-all" 
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
                                            <span className="text-[10px] font-mono font-bold text-slate-400 w-6 text-right">{task.progress}%</span>
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

      {/* --- FLOATING INPUT BAR (Sticky Bottom) --- */}
      <div className="absolute bottom-4 left-0 right-0 px-4 z-20">
        <div className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xl rounded-[2rem] p-2 shadow-2xl shadow-indigo-900/10 border border-white/50 ring-1 ring-slate-900/5">
            <div className="flex items-center gap-2">
                <button 
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all ${
                        isDatePickerOpen ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                    }`}
                    onClick={() => {
                        setIsDatePickerOpen(!isDatePickerOpen);
                        setTimeout(() => dateInputRef.current?.showPicker(), 100);
                    }}
                >
                    <CalendarClock size={20} />
                </button>

                <div className="flex-1 relative">
                    <input 
                        type="text" 
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t.addTaskPlaceholder}
                        className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-800 placeholder:text-slate-400 h-10"
                    />
                    
                    {/* Priority Selector (Inline) */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex gap-1">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`w-2 h-2 rounded-full transition-all ${
                                    newPriority === p 
                                    ? (p === 'high' ? 'bg-rose-500 scale-125 ring-2 ring-rose-200' : p === 'medium' ? 'bg-amber-500 scale-125 ring-2 ring-amber-200' : 'bg-emerald-500 scale-125 ring-2 ring-emerald-200') 
                                    : 'bg-slate-200 hover:bg-slate-300'
                                }`}
                                title={p}
                            />
                        ))}
                    </div>
                </div>

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

            {/* Hidden Real Date Input for Logic */}
            <input 
                ref={dateInputRef}
                type="datetime-local" 
                value={specificDate}
                onChange={(e) => setSpecificDate(e.target.value)}
                className="absolute opacity-0 bottom-full left-4 pointer-events-none" 
            />
            
            {/* Feedback for selected time */}
            {isDatePickerOpen && (
                 <div className="absolute bottom-full left-6 mb-2 bg-indigo-900 text-white text-xs py-1 px-3 rounded-lg shadow-lg flex items-center gap-2 animate-fade-in">
                    <Clock size={12} className="text-indigo-300"/> 
                    {new Date(specificDate).toLocaleString()}
                </div>
            )}
        </div>
      </div>

    </div>
  );
};