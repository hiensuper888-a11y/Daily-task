import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer, Edit2, Save, XCircle, Calculator, ListChecks, GripVertical, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Play, Pause } from 'lucide-react';
import { Task, FilterType, Priority, Subtask } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  // Enhanced Input States
  const [assignedDate, setAssignedDate] = useState<string>(''); 
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  const [showInputDetails, setShowInputDetails] = useState(false);

  // Sorting
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created'>('priority');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Edit Mode State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editCreatedAt, setEditCreatedAt] = useState('');
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');
  const [editEstimatedTime, setEditEstimatedTime] = useState<number | undefined>(undefined);

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

  const safeDateToInput = (isoString?: string) => {
      if (!isoString) return '';
      try {
          // Check if ISO string is valid
          const d = new Date(isoString);
          if (isNaN(d.getTime())) return '';
          return toLocalISOString(d);
      } catch (e) { return ''; }
  };

  const formatDisplayDate = (isoString?: string) => {
      if (!isoString) return null;
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString(language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
  };

  const formatEstimate = (mins: number) => {
      if (mins < 60) return `${mins} ${t.minutes}`;
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${hrs}h ${m}m` : `${hrs} ${t.hours}`;
  };

  const formatDeadline = (isoString: string) => {
      const target = new Date(isoString);
      const now = new Date();
      if(isNaN(target.getTime())) return null;

      const diffMs = target.getTime() - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      
      const isOverdue = diffMs < 0;
      const isSoon = diffHrs > 0 && diffHrs < 24;

      let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
      let colorClass = 'text-slate-500 bg-slate-50/50 border-slate-200';
      let icon = <CalendarClock size={12} />;

      if (isOverdue) {
          text = t.overdue;
          colorClass = 'text-rose-600 bg-rose-50 border-rose-200 font-bold animate-pulse';
          icon = <AlertCircle size={12} />;
      } else if (isSoon) {
          const hrsLeft = Math.ceil(diffHrs);
          text = `${hrsLeft}h left`;
          colorClass = 'text-amber-600 bg-amber-50 border-amber-200 font-bold';
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

  // --- TASK MANAGEMENT ---

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
    let createdDateStr = '';
    
    if (assignedDate) {
        createdDateStr = new Date(assignedDate).toISOString();
    } else {
        const now = new Date();
        let baseDate = new Date(viewDate);
        if (isToday(viewDate)) {
            createdDateStr = now.toISOString();
        } else {
            baseDate.setHours(9, 0, 0); 
            createdDateStr = baseDate.toISOString();
        }
    }

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: createdDateStr,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      estimatedTime: estimatedTime,
      archived: false,
      subtasks: [],
      priority: newPriority
    };

    setTasks([newTask, ...tasks]);
    setInputValue('');
    setDeadline('');
    setAssignedDate('');
    setEstimatedTime(undefined);
    setNewPriority('medium');
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditText(task.text);
    setEditDeadline(task.deadline ? safeDateToInput(task.deadline) : '');
    setEditCreatedAt(safeDateToInput(task.createdAt));
    setEditCompletedAt(task.completedAt ? safeDateToInput(task.completedAt) : '');
    setEditPriority(task.priority || 'medium');
    setEditEstimatedTime(task.estimatedTime);
  };

  const saveEdit = () => {
    if (editingTaskId) {
        setTasks(tasks.map(t => 
            t.id === editingTaskId 
            ? { 
                ...t, 
                text: editText, 
                deadline: editDeadline ? new Date(editDeadline).toISOString() : undefined,
                createdAt: editCreatedAt ? new Date(editCreatedAt).toISOString() : t.createdAt,
                completedAt: editCompletedAt ? new Date(editCompletedAt).toISOString() : t.completedAt,
                priority: editPriority,
                estimatedTime: editEstimatedTime
              } 
            : t
        ));
        setEditingTaskId(null);
    }
  };

  const cancelEdit = () => {
      setEditingTaskId(null);
  };

  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = !task.completed;
        if (newCompleted) playSuccessSound();
        const completionTime = newCompleted ? new Date().toISOString() : undefined;
        return { 
            ...task, 
            completed: newCompleted, 
            completedAt: completionTime,
            progress: newCompleted ? 100 : (task.subtasks?.length ? calculateProgressFromSubtasks(task.subtasks) : 0),
            subtasks: newCompleted 
                ? task.subtasks?.map(s => ({ ...s, completed: true })) 
                : task.subtasks 
        };
      }
      return task;
    }));
  };

  const calculateProgressFromSubtasks = (subtasks: Subtask[]) => {
      if (!subtasks || subtasks.length === 0) return 0;
      const completed = subtasks.filter(s => s.completed).length;
      return Math.round((completed / subtasks.length) * 100);
  };

  const updateProgress = (id: number, val: string) => {
    const progress = parseInt(val, 10);
    const isCompleted = progress === 100;
    
    setTasks(tasks.map(t => {
        if (t.id === id) {
            const newCompletedAt = isCompleted ? (t.completedAt || new Date().toISOString()) : undefined;
            return { ...t, progress, completed: isCompleted, completedAt: newCompletedAt };
        }
        return t;
    }));
    
    if (progress === 100) playSuccessSound();
  };

  const deleteTask = (id: number) => setTasks(tasks.filter(t => t.id !== id));

  const addSubtask = (taskId: number) => {
      const text = subtaskInputs[taskId]?.trim();
      if (!text) return;
      setTasks(tasks.map(t => {
          if (t.id === taskId) {
              const newSub = [...(t.subtasks || []), { id: Date.now(), text, completed: false }];
              const newProgress = calculateProgressFromSubtasks(newSub);
              return { 
                  ...t, 
                  subtasks: newSub, 
                  progress: newProgress,
                  completed: newProgress === 100 
                };
          }
          return t;
      }));
      setSubtaskInputs(prev => ({...prev, [taskId]: ''}));
  };

  const toggleSubtask = (taskId: number, subId: number) => {
      setTasks(tasks.map(t => {
          if (t.id === taskId && t.subtasks) {
              const newSub = t.subtasks.map(s => s.id === subId ? { ...s, completed: !s.completed } : s);
              const newProgress = calculateProgressFromSubtasks(newSub);
              const isCompleted = newProgress === 100;
              if (isCompleted && t.progress < 100) playSuccessSound();

              return { 
                  ...t, 
                  subtasks: newSub, 
                  progress: newProgress, 
                  completed: isCompleted,
                  completedAt: isCompleted ? (t.completedAt || new Date().toISOString()) : undefined 
                };
          }
          return t;
      }));
  };

  const deleteSubtask = (taskId: number, subId: number) => {
       setTasks(tasks.map(t => {
          if (t.id === taskId && t.subtasks) {
              const newSub = t.subtasks.filter(s => s.id !== subId);
              const newProgress = newSub.length > 0 ? calculateProgressFromSubtasks(newSub) : (t.completed ? 100 : t.progress);
              return { ...t, subtasks: newSub, progress: newProgress, completed: newProgress === 100 };
          }
          return t;
      }));
  };

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
        
        // Sorting Logic
        if (sortBy === 'deadline') {
            // Tasks with deadline first, then by priority fallback
            if (!a.deadline && !b.deadline) {
                 const pMap = { high: 3, medium: 2, low: 1 };
                 return (pMap[b.priority || 'medium'] || 2) - (pMap[a.priority || 'medium'] || 2);
            }
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } 
        
        if (sortBy === 'created') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        // Default: Priority
        const pMap = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'medium'];
        const pB = pMap[b.priority || 'medium'];
        if (pA !== pB) return pB - pA;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [tasks, viewDate, filterStatus, searchQuery, sortBy]);

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
      <div className="px-6 py-6 pb-2 relative z-10">
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start animate-fade-in">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight drop-shadow-sm">{t.todoHeader}</h1>
                    <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-2">
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-xs font-bold border border-indigo-100">
                           {stats.completed} / {stats.total} {t.items}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">{stats.progress}% {t.done}</span>
                    </p>
                </div>
                {/* Animated Circular Progress */}
                <div className="relative w-16 h-16 group cursor-pointer hover:scale-110 transition-transform">
                     <div className="absolute inset-0 bg-indigo-500 rounded-full opacity-10 blur-xl group-hover:opacity-20 transition-opacity"></div>
                     <svg className="w-full h-full -rotate-90 drop-shadow-md" viewBox="0 0 36 36">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className="text-indigo-600 transition-all duration-1000 ease-out" strokeDasharray={`${stats.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-indigo-600">
                        {stats.progress}%
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4 animate-fade-in" style={{animationDelay: '0.1s'}}>
                <div className="bg-white/60 backdrop-blur-md rounded-2xl p-2 shadow-sm border border-white flex items-center justify-between ring-1 ring-slate-100">
                    <button onClick={() => navigateDate(-1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm">
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
                        <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest mb-0.5 opacity-80 group-hover:opacity-100">
                            {isToday(viewDate) ? t.today : viewDate.toLocaleDateString(language, { weekday: 'long' })}
                        </span>
                        <span className="text-lg font-bold text-slate-800 flex items-center gap-2 group-hover:text-indigo-600 transition-colors">
                            {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
                            <CalendarIcon size={14} className="text-slate-300 group-hover:text-indigo-400 group-hover:-translate-y-0.5 transition-transform"/>
                        </span>
                    </div>

                    <button onClick={() => navigateDate(1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all shadow-none hover:shadow-sm">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pr-1">
                    {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                                filterStatus === f 
                                ? 'bg-slate-800 text-white shadow-lg shadow-slate-200 scale-105' 
                                : 'bg-white/50 text-slate-500 border border-transparent hover:bg-white hover:border-slate-100'
                            }`}
                        >
                            {t[f]}
                        </button>
                    ))}
                    
                    {/* Sorting Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className={`p-2 rounded-xl border transition-all ${showSortMenu ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white/50 text-slate-400 border-transparent hover:bg-white hover:text-slate-600'}`}
                            title={t.sortBy}
                        >
                            <ArrowUpDown size={16} />
                        </button>
                        {showSortMenu && (
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30 min-w-[120px] animate-fade-in">
                                {[
                                    { id: 'priority', icon: ArrowDownWideNarrow, label: t.sortPriority },
                                    { id: 'deadline', icon: Clock, label: t.deadline },
                                    { id: 'created', icon: CalendarDays, label: t.sortDate }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => { setSortBy(opt.id as any); setShowSortMenu(false); }}
                                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            sortBy === opt.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <opt.icon size={12} /> {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showSortMenu && <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)}></div>}
                    </div>

                    <div className="w-px h-6 bg-slate-200/50 mx-1 shrink-0"></div>
                    <div className="relative flex-1 group min-w-[100px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/50 border border-transparent hover:border-slate-100 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all"
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- TASK LIST --- */}
      <div className="flex-1 overflow-y-auto px-6 pb-40 custom-scrollbar z-0">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-scale-in">
                <div className="w-24 h-24 bg-gradient-to-br from-slate-50 to-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-slate-50">
                    <Archive size={36} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium opacity-60">{t.emptyTasks}</p>
            </div>
        ) : (
            <div className="space-y-4 pb-4">
                {filteredTasks.map((task, index) => {
                    const isEditing = editingTaskId === task.id;
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const isOverdue = deadlineInfo?.isOverdue && !task.completed;
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
                    const totalSubtasks = task.subtasks?.length || 0;
                    
                    return (
                        <div 
                            key={task.id}
                            style={{ animationDelay: `${index * 0.05}s` }}
                            className={`animate-fade-in group relative bg-white/80 backdrop-blur-sm rounded-2xl p-0 border transition-all duration-300 overflow-hidden ${
                                isEditing ? 'border-indigo-500 ring-4 ring-indigo-50 shadow-xl z-20 scale-[1.02]' :
                                task.completed 
                                ? 'border-slate-100 opacity-70 bg-slate-50/50 hover:opacity-100' 
                                : isOverdue 
                                    ? 'border-red-200 bg-red-50/10 shadow-red-100' 
                                    : 'border-white hover:border-indigo-200 hover:shadow-[0_8px_20px_-8px_rgba(99,102,241,0.2)] hover:-translate-y-0.5'
                            } shadow-sm`}
                        >
                            {/* Priority Strip */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                                task.priority === 'high' ? 'bg-rose-500' :
                                task.priority === 'low' ? 'bg-emerald-500' :
                                'bg-amber-500'
                            }`}></div>

                            <div className="p-4 pl-5">
                                <div className="flex items-start gap-3 relative z-10">
                                    <button 
                                        onClick={() => toggleTask(task.id)}
                                        className={`mt-1 shrink-0 transition-all duration-300 ${
                                            task.completed 
                                            ? 'text-emerald-500 scale-110' 
                                            : 'text-slate-300 hover:text-indigo-500 hover:scale-110'
                                        }`}
                                    >
                                        {task.completed ? <CheckCircle2 size={24} className="fill-emerald-50 drop-shadow-sm" /> : <Circle size={24} strokeWidth={2} />}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                        {isEditing ? (
                                            <div className="space-y-4">
                                                <input 
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    className="w-full text-lg font-bold text-slate-800 border-b border-indigo-200 focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
                                                    autoFocus
                                                />
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                    <div className="relative group/date bg-white rounded-xl p-2 border border-slate-200 hover:border-indigo-300 transition-all">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Start Date</label>
                                                        <div className="flex items-center gap-2">
                                                            <CalendarDays size={16} className="text-indigo-500"/>
                                                            <span className="text-xs font-semibold text-slate-700">
                                                                {editCreatedAt ? formatDisplayDate(editCreatedAt) : 'Set Date'}
                                                            </span>
                                                        </div>
                                                        <input 
                                                            type="datetime-local" 
                                                            value={editCreatedAt}
                                                            onChange={(e) => setEditCreatedAt(e.target.value)}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                    </div>

                                                    <div className="relative group/date bg-white rounded-xl p-2 border border-slate-200 hover:border-indigo-300 transition-all">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Deadline</label>
                                                        <div className="flex items-center gap-2">
                                                            <CalendarClock size={16} className="text-orange-500"/>
                                                            <span className="text-xs font-semibold text-slate-700">
                                                                {editDeadline ? formatDisplayDate(editDeadline) : 'No Deadline'}
                                                            </span>
                                                        </div>
                                                        <input 
                                                            type="datetime-local" 
                                                            value={editDeadline}
                                                            onChange={(e) => setEditDeadline(e.target.value)}
                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                        />
                                                    </div>
                                                </div>

                                                <div className="flex gap-3">
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Priority</label>
                                                        <div className="relative">
                                                            <select 
                                                                value={editPriority} 
                                                                onChange={(e) => setEditPriority(e.target.value as Priority)}
                                                                className="w-full bg-slate-50 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 border border-slate-200 focus:ring-0 appearance-none"
                                                            >
                                                                <option value="low">Low Priority</option>
                                                                <option value="medium">Medium Priority</option>
                                                                <option value="high">High Priority</option>
                                                            </select>
                                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                                                                <Flag size={12} className={editPriority === 'high' ? 'text-rose-500' : editPriority === 'medium' ? 'text-amber-500' : 'text-emerald-500'} fill="currentColor"/>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Est. Time (min)</label>
                                                        <div className="flex items-center bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                                                            <Hourglass size={12} className="text-violet-400 mr-2"/>
                                                            <input 
                                                                type="number"
                                                                value={editEstimatedTime || ''}
                                                                onChange={(e) => setEditEstimatedTime(parseInt(e.target.value) || undefined)}
                                                                className="bg-transparent w-full text-xs font-bold focus:outline-none"
                                                                placeholder="minutes"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                                    <button onClick={cancelEdit} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={20}/></button>
                                                    <button onClick={saveEdit} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"><Save size={16}/> Save</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-start gap-2">
                                                    <p 
                                                        onClick={() => toggleTask(task.id)}
                                                        className={`text-base font-semibold leading-relaxed cursor-pointer transition-all ${
                                                            task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                                        }`}
                                                    >
                                                        {task.text}
                                                    </p>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-200">
                                                        <button onClick={() => startEditing(task)} className="text-slate-300 hover:text-indigo-500 p-2 hover:bg-indigo-50 rounded-xl transition-colors">
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 p-2 hover:bg-red-50 rounded-xl transition-colors">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* Metadata Chips */}
                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border flex items-center gap-1.5 ${
                                                        task.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        task.priority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                        'bg-amber-50 text-amber-600 border-amber-100'
                                                    }`}>
                                                        <Flag size={10} fill="currentColor" /> {t[task.priority || 'medium']}
                                                    </span>

                                                    {/* Start Date Chip */}
                                                    <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-slate-50/50 text-slate-500 border-slate-100" title={`Created: ${formatDisplayDate(task.createdAt)}`}>
                                                        <CalendarDays size={10} />
                                                        {new Date(task.createdAt).toLocaleDateString(language, {day: 'numeric', month: 'numeric'})}
                                                    </span>

                                                    {task.estimatedTime && (
                                                        <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-violet-50 text-violet-600 border-violet-100" title="Estimated Time">
                                                            <Hourglass size={10} />
                                                            {formatEstimate(task.estimatedTime)}
                                                        </span>
                                                    )}

                                                    {deadlineInfo && (
                                                        <span className={`text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-lg border shadow-sm ${deadlineInfo.colorClass}`} title={deadlineInfo.fullDate}>
                                                            {deadlineInfo.icon}
                                                            {deadlineInfo.text}
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Progress Bar (Auto or Manual) */}
                                                {!task.completed && (
                                                    <div className="mt-4 flex items-center gap-2 group/slider">
                                                        {hasSubtasks && (
                                                            <div className="mr-1" title="Progress calculated from subtasks">
                                                                <Calculator size={12} className="text-indigo-400" />
                                                            </div>
                                                        )}
                                                        <div className="relative flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div 
                                                                className={`absolute h-full rounded-full transition-all duration-500 relative overflow-hidden ${isOverdue ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-400 to-purple-500'}`}
                                                                style={{width: `${task.progress}%`}}
                                                            >
                                                                {/* Shimmer Effect */}
                                                                <div className="absolute inset-0 animate-shimmer"></div>
                                                            </div>
                                                            {!hasSubtasks && (
                                                                <input 
                                                                    type="range" 
                                                                    min="0" max="100" 
                                                                    value={task.progress}
                                                                    onChange={(e) => updateProgress(task.id, e.target.value)}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                                />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">{task.progress}%</span>
                                                    </div>
                                                )}

                                                {/* Subtasks Section */}
                                                <div className="mt-2">
                                                    {(hasSubtasks || isEditing) && (
                                                        <div className="flex items-center gap-2 mt-4 mb-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-50 pb-1">
                                                            <ListChecks size={12} />
                                                            <span>{t.subtasks}</span>
                                                            {hasSubtasks && (
                                                                <span className="ml-auto bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">
                                                                    {completedSubtasks}/{totalSubtasks} • {Math.round((completedSubtasks/totalSubtasks)*100)}%
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    
                                                    {task.subtasks?.map(sub => (
                                                        <div key={sub.id} className="flex items-center gap-2 mb-2 group/sub pl-1">
                                                            <div className="text-slate-300">
                                                                <GripVertical size={12} className="opacity-0 group-hover/sub:opacity-50 cursor-grab" />
                                                            </div>
                                                            <button onClick={() => toggleSubtask(task.id, sub.id)} className={sub.completed ? 'text-emerald-500 transition-all scale-105' : 'text-slate-300 hover:text-slate-400 transition-all'}>
                                                                {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                                            </button>
                                                            <span className={`text-xs flex-1 transition-all ${sub.completed ? 'line-through text-slate-400' : 'text-slate-700 font-medium'}`}>{sub.text}</span>
                                                            <X 
                                                                size={14} 
                                                                className="text-slate-300 hover:text-red-500 cursor-pointer opacity-0 group-hover/sub:opacity-100 transition-opacity p-0.5"
                                                                onClick={() => deleteSubtask(task.id, sub.id)}
                                                            />
                                                        </div>
                                                    ))}
                                                    <div className="flex items-center gap-2 mt-2 pl-4 opacity-50 focus-within:opacity-100 transition-opacity">
                                                        <PlusCircle size={16} className="text-indigo-400" />
                                                        <input 
                                                            className="bg-transparent text-xs focus:outline-none w-full placeholder:text-slate-400 font-medium text-slate-700 py-1 border-b border-transparent focus:border-indigo-100 transition-all"
                                                            placeholder={t.addSubtask}
                                                            value={subtaskInputs[task.id] || ''}
                                                            onChange={(e) => setSubtaskInputs({...subtaskInputs, [task.id]: e.target.value})}
                                                            onKeyDown={(e) => {
                                                                if(e.key === 'Enter') addSubtask(task.id);
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
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
        <div className={`max-w-3xl mx-auto glass rounded-[2rem] transition-all duration-300 ${showInputDetails ? 'p-4 rounded-[1.5rem] shadow-2xl' : 'p-2 shadow-xl'}`}>
            
            {showInputDetails && (
                <div className="flex flex-wrap items-center gap-3 mb-3 animate-fade-in border-b border-white/50 pb-3">
                    {/* Assigned Date Picker */}
                    <div className={`relative group flex items-center rounded-xl border transition-all overflow-hidden ${assignedDate ? 'bg-indigo-50 border-indigo-200' : 'bg-white/50 border-white focus-within:border-indigo-300'}`}>
                        <div className="relative flex items-center">
                            <button 
                                type="button"
                                className={`flex items-center gap-2 pl-3 pr-2 py-2 text-xs font-bold transition-all ${assignedDate ? 'text-indigo-700' : 'text-slate-500'}`}
                            >
                                <CalendarDays size={14} className={assignedDate ? "text-indigo-600" : "text-slate-400"} /> 
                                <span>{assignedDate ? formatDisplayDate(assignedDate) : t.setAssignedDate || 'Start Date'}</span>
                            </button>
                            {/* Improved Date Picker Input */}
                            <input 
                                type="datetime-local" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                value={assignedDate}
                                onChange={(e) => setAssignedDate(e.target.value)}
                            />
                        </div>
                        {assignedDate && (
                            <button onClick={() => setAssignedDate('')} className="pr-2 pl-1 text-indigo-400 hover:text-red-500 relative z-20">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Deadline Picker */}
                    <div className={`relative group flex items-center rounded-xl border transition-all overflow-hidden ${deadline ? 'bg-orange-50 border-orange-200' : 'bg-white/50 border-white focus-within:border-indigo-300'}`}>
                        <div className="relative flex items-center">
                            <button 
                                type="button"
                                className={`flex items-center gap-2 pl-3 pr-2 py-2 text-xs font-bold transition-all ${deadline ? 'text-orange-700' : 'text-slate-500'}`}
                            >
                                <CalendarClock size={14} className={deadline ? "text-orange-600" : "text-slate-400"} /> 
                                <span>{deadline ? formatDisplayDate(deadline) : t.setDeadline}</span>
                            </button>
                            <input 
                                type="datetime-local" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                        {deadline && (
                            <button onClick={() => setDeadline('')} className="pr-2 pl-1 text-orange-400 hover:text-red-500 relative z-20">
                                <X size={12} />
                            </button>
                        )}
                    </div>

                    {/* Estimate Time */}
                    <div className={`flex items-center gap-1 border rounded-xl p-1 pl-3 transition-colors ${estimatedTime ? 'bg-violet-50 border-violet-200' : 'bg-white/50 border-white'}`}>
                        <Hourglass size={14} className={estimatedTime ? "text-violet-500" : "text-slate-400"}/>
                        <select 
                            className={`bg-transparent text-xs font-bold focus:outline-none py-1 cursor-pointer pr-2 ${estimatedTime ? 'text-violet-700' : 'text-slate-600'}`}
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
                             <button onClick={() => setEstimatedTime(undefined)} className="p-1 text-violet-400 hover:text-red-500"><X size={12} /></button>
                        )}
                    </div>

                     {/* Priority */}
                     <div className="flex gap-1 ml-auto">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => (
                            <button
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`w-8 h-8 rounded-full transition-all flex items-center justify-center border shadow-sm ${
                                    newPriority === p 
                                    ? (p === 'high' ? 'bg-rose-500 border-rose-600 text-white scale-110' : p === 'medium' ? 'bg-amber-500 border-amber-600 text-white scale-110' : 'bg-emerald-500 border-emerald-600 text-white scale-110') 
                                    : 'bg-white border-white text-transparent hover:bg-slate-100'
                                }`}
                                title={p}
                            >
                                <Flag size={14} fill={newPriority === p ? "currentColor" : "none"} className={newPriority === p ? "" : (p === 'high' ? 'text-rose-400' : p === 'medium' ? 'text-amber-400' : 'text-emerald-400')} />
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
                        ? 'bg-slate-800 text-white border-slate-800 rotate-90 shadow-lg' 
                        : 'bg-white/50 text-slate-500 border-white hover:border-indigo-300 hover:text-indigo-600 hover:bg-white'
                    }`}
                >
                    <SlidersHorizontal size={18} />
                </button>

                <input 
                    type="text" 
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                    placeholder={t.addTaskPlaceholder}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 h-10 px-2"
                />

                <button 
                    onClick={addTask}
                    disabled={!inputValue.trim()}
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                        inputValue.trim() 
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-110 hover:shadow-indigo-500/50 hover:-translate-y-0.5 active:scale-95' 
                        : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                >
                    <Plus size={22} strokeWidth={2.5} />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};