import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer, Edit2, Save, XCircle, Calculator, ListChecks, GripVertical } from 'lucide-react';
import { Task, FilterType, Priority, Subtask } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  // Enhanced Input States
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  const [showInputDetails, setShowInputDetails] = useState(false);

  // Edit Mode State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [editDeadline, setEditDeadline] = useState('');
  const [editCreatedAt, setEditCreatedAt] = useState('');
  const [editCompletedAt, setEditCompletedAt] = useState('');
  const [editPriority, setEditPriority] = useState<Priority>('medium');

  // Filtering & Sorting
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View Navigation State
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  const { t, language } = useLanguage();

  // Helper: Format Date for Input (datetime-local expects YYYY-MM-DDTHH:mm)
  const toLocalISOString = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  // Helper safely convert ISO string to input format
  const safeDateToInput = (isoString?: string) => {
      if (!isoString) return '';
      try {
          return toLocalISOString(new Date(isoString));
      } catch (e) { return ''; }
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
      let colorClass = 'text-slate-500 bg-slate-50 border-slate-200';
      let icon = <CalendarClock size={12} />;

      if (isOverdue) {
          text = t.overdue;
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

  // --- TASK MANAGEMENT ---

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
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
    setInputValue('');
    setDeadline('');
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
                priority: editPriority 
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
        
        // Capture exact completion time when checked
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

  // Helper to calculate % based on subtasks
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
            // If dragging to 100%, set completedAt if not already set
            const newCompletedAt = isCompleted ? (t.completedAt || new Date().toISOString()) : undefined;
            return { ...t, progress, completed: isCompleted, completedAt: newCompletedAt };
        }
        return t;
    }));
    
    if (progress === 100) playSuccessSound();
  };

  const deleteTask = (id: number) => setTasks(tasks.filter(t => t.id !== id));

  // --- SUBTASKS ---
  const addSubtask = (taskId: number) => {
      const text = subtaskInputs[taskId]?.trim();
      if (!text) return;
      setTasks(tasks.map(t => {
          if (t.id === taskId) {
              const newSub = [...(t.subtasks || []), { id: Date.now(), text, completed: false }];
              // Auto-update progress
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
        const pMap = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'medium'];
        const pB = pMap[b.priority || 'medium'];
        if (pA !== pB) return pB - pA;
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
                    const isEditing = editingTaskId === task.id;
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const isOverdue = deadlineInfo?.isOverdue && !task.completed;
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
                    const totalSubtasks = task.subtasks?.length || 0;
                    
                    return (
                        <div 
                            key={task.id}
                            className={`group bg-white rounded-2xl p-4 border transition-all duration-300 hover:shadow-lg ${
                                isEditing ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-xl z-10' :
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
                                    {/* Edit Mode vs View Mode */}
                                    {isEditing ? (
                                        <div className="space-y-3 animate-fade-in">
                                            <input 
                                                value={editText}
                                                onChange={(e) => setEditText(e.target.value)}
                                                className="w-full text-base font-semibold text-slate-800 border-b border-indigo-200 focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
                                                autoFocus
                                            />
                                            
                                            {/* Date Editing Grid */}
                                            <div className="grid grid-cols-2 gap-3 mt-2">
                                                <div className="relative group">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Assigned</label>
                                                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded text-xs font-medium text-slate-600 border border-transparent focus-within:border-indigo-300">
                                                        <CalendarDays size={12}/>
                                                        {editCreatedAt ? new Date(editCreatedAt).toLocaleString() : 'Set Date'}
                                                    </div>
                                                    <input 
                                                        type="datetime-local" 
                                                        value={editCreatedAt}
                                                        onChange={(e) => setEditCreatedAt(e.target.value)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>

                                                <div className="relative group">
                                                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Deadline</label>
                                                    <div className="flex items-center gap-1 bg-slate-100 px-2 py-1.5 rounded text-xs font-medium text-slate-600 border border-transparent focus-within:border-indigo-300">
                                                        <CalendarClock size={12}/>
                                                        {editDeadline ? new Date(editDeadline).toLocaleString() : 'No Deadline'}
                                                    </div>
                                                    <input 
                                                        type="datetime-local" 
                                                        value={editDeadline}
                                                        onChange={(e) => setEditDeadline(e.target.value)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                            </div>

                                            {/* Completed At Editing (Only if completed) */}
                                            {task.completed && (
                                                <div className="relative group mt-1">
                                                     <label className="text-[10px] uppercase font-bold text-emerald-500 block mb-1">Completed At</label>
                                                     <div className="flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded text-xs font-medium text-emerald-700 border border-transparent focus-within:border-emerald-300">
                                                        <CheckCircle2 size={12}/>
                                                        {editCompletedAt ? new Date(editCompletedAt).toLocaleString() : 'Not set'}
                                                    </div>
                                                    <input 
                                                        type="datetime-local" 
                                                        value={editCompletedAt}
                                                        onChange={(e) => setEditCompletedAt(e.target.value)}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                                                <select 
                                                    value={editPriority} 
                                                    onChange={(e) => setEditPriority(e.target.value as Priority)}
                                                    className="bg-slate-50 px-2 py-1 rounded text-xs font-medium text-slate-600 border border-slate-200 focus:ring-0"
                                                >
                                                    <option value="low">Low Priority</option>
                                                    <option value="medium">Medium Priority</option>
                                                    <option value="high">High Priority</option>
                                                </select>

                                                <div className="flex gap-2">
                                                    <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={18}/></button>
                                                    <button onClick={saveEdit} className="p-1.5 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-full transition-colors"><Save size={18}/></button>
                                                </div>
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
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => startEditing(task)} className="text-slate-300 hover:text-indigo-500 p-1">
                                                        <Edit2 size={14} />
                                                    </button>
                                                    <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 p-1">
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {/* Metadata Chips */}
                                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                {/* Priority */}
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border flex items-center gap-1.5 ${
                                                    task.priority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    task.priority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                    <Flag size={10} fill="currentColor" /> {t[task.priority || 'medium']}
                                                </span>

                                                {/* Assigned Date (Created At) */}
                                                <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border bg-slate-50 text-slate-500 border-slate-100" title={`Assigned: ${new Date(task.createdAt).toLocaleString()}`}>
                                                    <CalendarDays size={10} />
                                                    {new Date(task.createdAt).toLocaleDateString(language, {day: 'numeric', month: 'numeric', hour:'2-digit', minute:'2-digit'})}
                                                </span>

                                                {/* Deadline */}
                                                {deadlineInfo && (
                                                    <span className={`text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border ${deadlineInfo.colorClass}`} title={deadlineInfo.fullDate}>
                                                        {deadlineInfo.icon}
                                                        {deadlineInfo.text}
                                                    </span>
                                                )}

                                                {/* Completed At Timestamp (Only if done) */}
                                                {task.completed && task.completedAt && (
                                                    <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-1 rounded-md border bg-emerald-50 text-emerald-600 border-emerald-100 animate-fade-in" title={`Finished: ${new Date(task.completedAt).toLocaleString()}`}>
                                                        <CheckCircle2 size={10} />
                                                        {new Date(task.completedAt).toLocaleTimeString(language, {hour:'2-digit', minute:'2-digit'})}
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
                                                            className={`absolute h-full rounded-full transition-all duration-500 ${isOverdue ? 'bg-red-500' : 'bg-indigo-500'}`}
                                                            style={{width: `${task.progress}%`}}
                                                        ></div>
                                                        {/* Only allow manual sliding if NO subtasks */}
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
                                                {/* Subtasks Header - Shows count and percentage */}
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
                                                <div className="flex items-center gap-2 mt-2 pl-4">
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
                    {/* Deadline Picker */}
                    <div className="relative group flex items-center bg-slate-50 rounded-full border border-slate-200 focus-within:border-indigo-300 focus-within:bg-indigo-50 transition-colors">
                        <div className="relative flex items-center">
                            <button 
                                type="button"
                                className={`flex items-center gap-1.5 pl-3 pr-2 py-1.5 text-xs font-bold transition-all ${deadline ? 'text-indigo-700' : 'text-slate-500'}`}
                            >
                                <CalendarClock size={14} className={deadline ? "text-indigo-600" : "text-slate-400"} /> 
                                <span>{deadline ? new Date(deadline).toLocaleString(language, {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : t.setDeadline}</span>
                            </button>
                            
                            <input 
                                type="datetime-local" 
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                            />
                        </div>
                        
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
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') addTask();
                    }}
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