import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Calendar, ListFilter, Archive, TrendingUp, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, ArrowDown, ArrowUp, Minus, Search, SlidersHorizontal, ArrowDownNarrowWide, ArrowUpNarrowWide, XCircle, CalendarDays, ChevronsLeft, ChevronsRight, SkipBack, SkipForward, Clock, MoreHorizontal, CalendarClock } from 'lucide-react';
import { Task, Subtask, FilterType, Priority } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [taskDateTime, setTaskDateTime] = useState<string>('');
  
  // Advanced Filtering & Sorting State
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  
  // State for subtask input [taskId]: value
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  const { t, language } = useLanguage();

  // Helper to format Date to YYYY-MM-DDTHH:mm for input type="datetime-local"
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Sync task creation time with selected view date (navigating updates default creation time)
  useEffect(() => {
    const now = new Date();
    // Default the task time to the selected date but with current clock time
    // If selected date is today, use current time. If future/past, preserve clock time.
    const newDateTime = new Date(selectedDate);
    newDateTime.setHours(now.getHours(), now.getMinutes());
    setTaskDateTime(formatDateTimeLocal(newDateTime));
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  const displayDate = useMemo(() => {
    return selectedDate.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }, [selectedDate, language]);

  const isToday = useMemo(() => {
    const today = new Date();
    return today.toDateString() === selectedDate.toDateString();
  }, [selectedDate]);

  const navigateDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const navigateMonth = (months: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(selectedDate.getMonth() + months);
    setSelectedDate(newDate);
  };

  const navigateYear = (years: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(selectedDate.getFullYear() + years);
    setSelectedDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      setSelectedDate(newDate);
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
    // Use the explicit datetime picker value
    const creationDate = taskDateTime ? new Date(taskDateTime) : new Date();

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: creationDate.toISOString(),
      archived: false,
      subtasks: [],
      priority: newPriority
    };
    setTasks([newTask, ...tasks]);
    setInputValue('');
    
    // Reset date picker to match current view to avoid stale dates
    const now = new Date();
    const resetDate = new Date(selectedDate);
    resetDate.setHours(now.getHours(), now.getMinutes());
    setTaskDateTime(formatDateTimeLocal(resetDate));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTask();
  };

  // ----- PRIORITY HELPER -----
  const getPriorityColor = (p?: Priority) => {
      switch(p) {
          case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
          case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  const getPriorityDot = (p?: Priority) => {
    switch(p) {
        case 'high': return 'bg-rose-500 shadow-rose-200';
        case 'medium': return 'bg-amber-500 shadow-amber-200';
        case 'low': return 'bg-emerald-500 shadow-emerald-200';
        default: return 'bg-slate-300';
    }
  };

  const getPriorityIcon = (p?: Priority) => {
      switch(p) {
          case 'high': return <ArrowUp size={12} className="mr-1" />;
          case 'medium': return <Minus size={12} className="mr-1" />;
          case 'low': return <ArrowDown size={12} className="mr-1" />;
          default: return null;
      }
  };

  // ----- SUBTASK LOGIC -----
  const calculateProgress = (subtasks: Subtask[]) => {
      if (!subtasks || subtasks.length === 0) return 0;
      const completedCount = subtasks.filter(s => s.completed).length;
      return Math.round((completedCount / subtasks.length) * 100);
  };

  const addSubtask = (taskId: number) => {
      const text = subtaskInputs[taskId]?.trim();
      if (!text) return;

      setTasks(tasks.map(task => {
          if (task.id === taskId) {
              const currentSubtasks = task.subtasks || [];
              const newSubtasks = [...currentSubtasks, { id: Date.now(), text, completed: false }];
              const newProgress = calculateProgress(newSubtasks);
              
              setSubtaskInputs(prev => ({ ...prev, [taskId]: '' }));
              
              return { 
                  ...task, 
                  subtasks: newSubtasks, 
                  progress: newProgress,
                  completed: newProgress === 100
              };
          }
          return task;
      }));
  };

  const toggleSubtask = (taskId: number, subtaskId: number) => {
      setTasks(tasks.map(task => {
          if (task.id === taskId && task.subtasks) {
              const newSubtasks = task.subtasks.map(s => 
                  s.id === subtaskId ? { ...s, completed: !s.completed } : s
              );
              const newProgress = calculateProgress(newSubtasks);
              return { 
                  ...task, 
                  subtasks: newSubtasks, 
                  progress: newProgress,
                  completed: newProgress === 100
              };
          }
          return task;
      }));
  };

  const deleteSubtask = (taskId: number, subtaskId: number) => {
      setTasks(tasks.map(task => {
          if (task.id === taskId && task.subtasks) {
              const newSubtasks = task.subtasks.filter(s => s.id !== subtaskId);
              const newProgress = newSubtasks.length > 0 ? calculateProgress(newSubtasks) : task.progress;
              return { 
                  ...task, 
                  subtasks: newSubtasks, 
                  progress: newProgress,
                  completed: newProgress === 100
              };
          }
          return task;
      }));
  };

  // ----- MAIN TASK LOGIC -----
  const toggleTask = (id: number) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = !task.completed;
        if (newCompleted) playSuccessSound();

        let updatedSubtasks = task.subtasks;
        if (task.subtasks && task.subtasks.length > 0) {
            updatedSubtasks = task.subtasks.map(s => ({ ...s, completed: newCompleted }));
        }

        return { 
            ...task, 
            completed: newCompleted, 
            progress: newCompleted ? 100 : 0,
            subtasks: updatedSubtasks
        };
      }
      return task;
    }));
  };

  const updateProgress = (id: number, newProgress: string) => {
    setTasks(tasks.map(task => {
        if (task.id === id) {
            if (task.subtasks && task.subtasks.length > 0) return task;
            const progressVal = parseInt(newProgress, 10);
            if (progressVal === 100 && !task.completed) playSuccessSound();
            return { ...task, progress: progressVal, completed: progressVal === 100 };
        }
        return task;
    }));
  };

  const deleteTask = (id: number) => {
    setTasks(tasks.filter(task => task.id !== id));
  };

  const archiveCompleted = () => {
    const idsToArchive = processedTasks.filter(t => t.completed).map(t => t.id);
    setTasks(tasks.map(task => idsToArchive.includes(task.id) ? { ...task, archived: true } : task));
  };

  // ----- FILTERING & SORTING LOGIC -----
  const processedTasks = useMemo(() => {
    let result = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === selectedDate.toDateString() && !task.archived;
    });

    if (filterStatus === 'active') {
        result = result.filter(t => !t.completed);
    } else if (filterStatus === 'completed') {
        result = result.filter(t => t.completed);
    }

    if (filterPriority !== 'all') {
        result = result.filter(t => t.priority === filterPriority);
    }

    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(t => t.text.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        let cmp = 0;
        if (sortBy === 'priority') {
            const pVal = { high: 3, medium: 2, low: 1, undefined: 0 };
            const valA = pVal[a.priority || 'undefined'] || 0;
            const valB = pVal[b.priority || 'undefined'] || 0;
            cmp = valA - valB;
        } else {
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
        return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, selectedDate, filterStatus, filterPriority, searchQuery, sortBy, sortDirection]);

  // Statistics
  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === selectedDate.toDateString() && !task.archived;
    });
  }, [tasks, selectedDate]);

  const totalTasks = tasksForSelectedDate.length;
  const totalProgressSum = tasksForSelectedDate.reduce((sum, task) => sum + task.progress, 0);
  const overallProgress = totalTasks === 0 ? 0 : Math.round(totalProgressSum / totalTasks);
  const completedCount = tasksForSelectedDate.filter(t => t.completed).length;

  // Header Component
  const NavigationButton = ({ onClick, icon: Icon, title, secondary }: any) => (
      <button 
        onClick={onClick} 
        className={`p-1.5 rounded-lg transition-all active:scale-95 flex items-center justify-center ${
            secondary 
            ? 'text-indigo-200 hover:bg-white/10 hover:text-white' 
            : 'text-white hover:bg-white/20'
        }`} 
        title={title}
      >
          <Icon size={secondary ? 14 : 18} />
      </button>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-transparent">
      {/* PROFESSIONAL HEADER */}
      <div className="relative overflow-hidden bg-slate-900 text-white shrink-0 shadow-xl md:rounded-t-[2.5rem] z-10">
        {/* Background Decor */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600 rounded-full blur-[80px] opacity-40 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500 rounded-full blur-[80px] opacity-30 -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
        
        <div className="relative z-10 p-6 sm:p-8">
            {/* Top Bar: Long Range Nav & Stats */}
            <div className="flex items-start justify-between mb-6">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="p-1.5 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                            <TrendingUp size={16} className="text-indigo-300" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-200">{t.dailyProgress}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                         <span className="text-4xl font-black tracking-tight text-white">{overallProgress}%</span>
                         <span className="text-sm font-medium text-indigo-300">completed</span>
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    {/* Quick Year/Month Nav */}
                    <div className="flex items-center gap-1 bg-white/5 backdrop-blur-md rounded-lg p-1 border border-white/10 mb-2">
                        <NavigationButton onClick={() => navigateYear(-1)} icon={SkipBack} title={t.prevYear} secondary />
                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                        <NavigationButton onClick={() => navigateMonth(-1)} icon={ChevronsLeft} title={t.prevMonth} secondary />
                        <span className="text-[10px] font-bold px-2 text-indigo-200 uppercase min-w-[60px] text-center">
                            {selectedDate.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', year: 'numeric' })}
                        </span>
                        <NavigationButton onClick={() => navigateMonth(1)} icon={ChevronsRight} title={t.nextMonth} secondary />
                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                        <NavigationButton onClick={() => navigateYear(1)} icon={SkipForward} title={t.nextYear} secondary />
                    </div>
                    <div className="text-xs font-medium text-indigo-300">
                        {completedCount} / {totalTasks} {t.items} {t.done}
                    </div>
                </div>
            </div>

            {/* Main Date Display & Navigation */}
            <div className="flex items-center justify-between bg-white/10 backdrop-blur-xl rounded-2xl p-2 border border-white/10 shadow-lg">
                <button onClick={() => navigateDate(-1)} className="p-3 hover:bg-white/10 rounded-xl transition-all active:scale-95 group">
                    <ChevronLeft size={24} className="text-indigo-200 group-hover:text-white" />
                </button>

                <div className="flex-1 flex flex-col items-center justify-center relative group cursor-pointer py-1">
                     {/* Hidden Native Date Input */}
                     <input 
                        type="date" 
                        value={formattedSelectedDate}
                        onChange={handleDateChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                        title={t.jumpToDate}
                     />
                     
                     <div className="flex items-center gap-2 mb-1 opacity-70 group-hover:opacity-100 transition-opacity">
                         <CalendarDays size={12} className="text-indigo-300" />
                         <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                             {isToday ? t.today : t.jumpToDate}
                         </span>
                     </div>
                     <div className="text-lg sm:text-xl font-bold text-white text-center leading-none group-hover:scale-105 transition-transform duration-200">
                         {displayDate}
                     </div>
                </div>

                <button onClick={() => navigateDate(1)} className="p-3 hover:bg-white/10 rounded-xl transition-all active:scale-95 group">
                    <ChevronRight size={24} className="text-indigo-200 group-hover:text-white" />
                </button>
            </div>
            
            {/* Progress Bar Line */}
            <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-800">
                <div 
                    className="h-full bg-gradient-to-r from-indigo-500 via-blue-500 to-cyan-400 shadow-[0_0_10px_rgba(59,130,246,0.5)] transition-all duration-700 ease-out"
                    style={{ width: `${overallProgress}%` }}
                ></div>
            </div>
        </div>
      </div>

      {/* Floating Input & Filters Container */}
      <div className="px-4 sm:px-8 -mt-6 z-20 sticky top-0 md:relative">
         <div className="max-w-4xl mx-auto w-full flex flex-col gap-3">
            {/* Input Card */}
            <div className="bg-white p-2 rounded-2xl shadow-xl shadow-indigo-900/5 border border-slate-200/60 backdrop-blur-xl">
                <div className="relative flex items-center">
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 z-10 flex gap-1 bg-slate-100 p-1 rounded-lg">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => (
                            <button 
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`w-6 h-6 rounded-md transition-all flex items-center justify-center ${
                                    newPriority === p ? 'ring-2 ring-offset-1 ring-white scale-110 shadow-sm' : 'opacity-40 hover:opacity-100 scale-90 hover:scale-100'
                                } ${getPriorityDot(p)}`}
                                title={t[p]}
                            >
                                {newPriority === p && <CheckCircle size={14} className="text-white" strokeWidth={3} />}
                            </button>
                        ))}
                    </div>
                    
                    {/* Task Text Input */}
                    <input
                        type="text"
                        placeholder={t.addTaskPlaceholder}
                        className="w-full pl-28 pr-24 py-3.5 bg-transparent rounded-xl focus:outline-none text-slate-700 font-medium placeholder:text-slate-400 text-sm sm:text-base"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />

                    {/* Date Time Picker Trigger */}
                    <div className="absolute right-12 top-1/2 -translate-y-1/2 z-10">
                         <div className="relative group/time">
                            <input
                                type="datetime-local"
                                value={taskDateTime}
                                onChange={(e) => setTaskDateTime(e.target.value)}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                                title={t.selectTaskDate}
                            />
                            <button 
                                className={`p-2 rounded-lg transition-all flex items-center justify-center ${
                                    taskDateTime.split('T')[0] !== formattedSelectedDate 
                                    ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
                                    : 'text-slate-300 hover:text-indigo-500 hover:bg-slate-50'
                                }`}
                            >
                                <CalendarClock size={20} strokeWidth={2} />
                            </button>
                            
                            {/* Optional: Simple Indicator dot if time is set to non-default */}
                            {taskDateTime && (
                                <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 border-2 border-white rounded-full"></div>
                            )}
                         </div>
                    </div>

                    <button
                        onClick={addTask}
                        disabled={!inputValue.trim()}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all shadow-sm z-20 ${
                            inputValue.trim() 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95' 
                            : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                        }`}
                    >
                        <Plus size={20} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Quick Filters */}
            <div className="flex items-center justify-between">
                 <div className="flex gap-2 overflow-x-auto custom-scrollbar pb-1">
                    {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
                        <button 
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize border ${
                            filterStatus === f 
                            ? 'bg-white text-indigo-600 border-indigo-100 shadow-sm' 
                            : 'bg-transparent border-transparent text-slate-500 hover:bg-white/50 hover:text-slate-700'
                            }`}
                        >
                            {f === 'all' ? t.all : f === 'active' ? t.active : t.completed}
                        </button>
                    ))}
                 </div>

                 <button 
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-white transition-all ${showAdvancedFilters ? 'bg-white text-indigo-600 shadow-sm' : ''}`}
                 >
                     <SlidersHorizontal size={16} />
                 </button>
            </div>

            {/* Advanced Filters Drawer */}
            {showAdvancedFilters && (
                <div className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tasks..." 
                            className="w-full pl-8 pr-8 py-2 bg-slate-50 rounded-lg border-none text-xs focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-400"
                        />
                         {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                <XCircle size={12} fill="currentColor" className="bg-white rounded-full"/>
                            </button>
                        )}
                    </div>
                    
                    <div className="flex gap-2">
                        <div className="flex bg-slate-50 rounded-lg p-1 flex-1">
                             {(['all', 'high', 'medium', 'low'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilterPriority(p)}
                                    className={`flex-1 rounded-md text-[10px] font-bold uppercase transition-all py-1 ${
                                        filterPriority === p 
                                        ? 'bg-white shadow-sm text-slate-800'
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                                >
                                    {p === 'all' ? 'All' : p[0]}
                                </button>
                            ))}
                        </div>
                        <button 
                            onClick={() => setSortBy(sortBy === 'priority' ? 'date' : 'priority')}
                            className="px-3 py-1 bg-slate-50 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 flex items-center gap-1"
                        >
                            {sortBy === 'priority' ? 'Pri' : 'Date'}
                            <ArrowDownNarrowWide size={12}/>
                        </button>
                    </div>
                </div>
            )}
         </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 custom-scrollbar">
        <div className="max-w-4xl mx-auto w-full pb-24 md:pb-8">
            {processedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                <div className="bg-slate-100 p-4 rounded-full mb-3">
                    <ListFilter size={32} className="opacity-40" />
                </div>
                <p className="text-sm font-medium text-slate-500">
                    {searchQuery ? "No matching tasks found." : t.emptyTasks}
                </p>
                {!isToday && !searchQuery && (
                    <button onClick={goToToday} className="mt-4 text-xs font-bold text-indigo-600 hover:underline">
                        Go to Today
                    </button>
                )}
            </div>
            ) : (
            <ul className="space-y-3">
                {processedTasks.map((task) => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const priorityColor = getPriorityColor(task.priority);

                    return (
                        <li 
                            key={task.id} 
                            className={`group animate-fade-in bg-white rounded-xl transition-all duration-200 border ${
                            task.completed 
                                ? 'border-slate-100 opacity-60' 
                                : 'border-slate-200/60 shadow-sm hover:shadow-md hover:border-indigo-200'
                            }`}
                        >
                            {/* Main Task Row */}
                            <div className="p-4 flex items-start gap-3">
                                <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`mt-0.5 shrink-0 transition-all duration-200 ${
                                        task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'
                                    }`}
                                >
                                    {task.completed ? <CheckCircle size={22} className="fill-current" /> : <Circle size={22} strokeWidth={2} />}
                                </button>
                                
                                <div className="flex-grow min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <span 
                                            className={`block text-base font-semibold leading-tight cursor-pointer transition-all ${
                                                task.completed ? 'line-through text-slate-400' : 'text-slate-800'
                                            }`}
                                            onClick={() => toggleTask(task.id)}
                                        >
                                            {task.text}
                                        </span>
                                        <button 
                                            onClick={() => deleteTask(task.id)}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2 mt-2">
                                        {task.priority && (
                                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-1 border ${priorityColor}`}>
                                                {getPriorityIcon(task.priority)} {t[task.priority]}
                                            </span>
                                        )}
                                        {task.createdAt && (
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <Clock size={10} />
                                                {new Date(task.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                        )}
                                    </div>
                                    
                                    {/* Slider & Progress */}
                                    <div className="mt-3 flex items-center gap-3">
                                        <div className="relative flex-grow h-1.5 bg-slate-100 rounded-full group/slider cursor-pointer">
                                            <div className={`absolute h-full rounded-full transition-all duration-500 ${task.completed ? 'bg-emerald-400' : 'bg-indigo-500'}`} style={{width: `${task.progress}%`}}></div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="100"
                                                value={task.progress}
                                                onChange={(e) => updateProgress(task.id, e.target.value)}
                                                disabled={!!(hasSubtasks)}
                                                className={`absolute inset-0 w-full h-full opacity-0 z-10 ${hasSubtasks ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                            />
                                            {/* Thumb Indicator */}
                                            {!task.completed && !hasSubtasks && (
                                                <div 
                                                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white border-2 border-indigo-500 rounded-full shadow-sm pointer-events-none transition-all duration-200 opacity-0 group-hover/slider:opacity-100"
                                                    style={{left: `calc(${task.progress}% - 5px)`}}
                                                ></div>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-bold font-mono w-8 text-right ${task.completed ? 'text-emerald-600' : 'text-slate-400'}`}>
                                            {task.progress}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Subtasks Section (Collapsible feel) */}
                            {(hasSubtasks || subtaskInputs[task.id]) && (
                                <div className="bg-slate-50/50 border-t border-slate-100 p-3 pl-11 rounded-b-xl">
                                    {hasSubtasks && (
                                        <ul className="space-y-2 mb-2">
                                            {task.subtasks!.map(sub => (
                                                <li key={sub.id} className="flex items-center gap-2 group/sub">
                                                    <button onClick={() => toggleSubtask(task.id, sub.id)} className={`transition-colors ${sub.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                                                        {sub.completed ? <CheckSquare size={14} /> : <Square size={14} />}
                                                    </button>
                                                    <span className={`text-xs flex-grow transition-colors ${sub.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                                        {sub.text}
                                                    </span>
                                                    <button onClick={() => deleteSubtask(task.id, sub.id)} className="opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 transition-opacity">
                                                        <X size={12} />
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <PlusCircle size={14} className="text-slate-300" />
                                        <input 
                                            type="text" 
                                            placeholder={t.addSubtask}
                                            value={subtaskInputs[task.id] || ''}
                                            onChange={(e) => setSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            onKeyDown={(e) => { if(e.key === 'Enter') addSubtask(task.id); }}
                                            className="w-full bg-transparent text-xs focus:outline-none placeholder:text-slate-400 text-slate-700"
                                        />
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            )}
        </div>
      </div>

      {completedCount > 0 && (
        <div className="absolute bottom-6 left-0 right-0 flex justify-center pointer-events-none z-30">
          <button 
            onClick={archiveCompleted}
            className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-lg border border-white/50 text-slate-600 hover:text-red-600 hover:bg-red-50 px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ring-1 ring-black/5"
          >
            <Archive size={14} /> {t.clearCompleted}
          </button>
        </div>
      )}
    </div>
  );
};