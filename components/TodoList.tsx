import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Calendar, ListFilter, Archive, TrendingUp, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, ArrowDown, ArrowUp, Minus, ArrowUpDown, Search, SlidersHorizontal, ArrowDownNarrowWide, ArrowUpNarrowWide, XCircle } from 'lucide-react';
import { Task, Subtask, FilterType, Priority } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
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

  const formattedSelectedDate = useMemo(() => {
    return selectedDate.toISOString().split('T')[0];
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      setSelectedDate(new Date(e.target.value));
    }
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
    const now = new Date();
    const taskDate = new Date(selectedDate);
    taskDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: taskDate.toISOString(),
      archived: false,
      subtasks: [],
      priority: newPriority
    };
    setTasks([newTask, ...tasks]);
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTask();
  };

  // ----- PRIORITY HELPER -----
  const getPriorityColor = (p?: Priority) => {
      switch(p) {
          case 'high': return 'bg-rose-50 text-rose-600 border-rose-200';
          case 'medium': return 'bg-amber-50 text-amber-600 border-amber-200';
          case 'low': return 'bg-emerald-50 text-emerald-600 border-emerald-200';
          default: return 'bg-slate-50 text-slate-500 border-slate-200';
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
    // 1. Initial filter by date and archive status
    let result = tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === selectedDate.toDateString() && !task.archived;
    });

    // 2. Filter by Status
    if (filterStatus === 'active') {
        result = result.filter(t => !t.completed);
    } else if (filterStatus === 'completed') {
        result = result.filter(t => t.completed);
    }

    // 3. Filter by Priority
    if (filterPriority !== 'all') {
        result = result.filter(t => t.priority === filterPriority);
    }

    // 4. Filter by Search Query
    if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        result = result.filter(t => t.text.toLowerCase().includes(q));
    }

    // 5. Sorting
    result.sort((a, b) => {
        // Always keep completed tasks at the bottom for better UX
        if (a.completed !== b.completed) return a.completed ? 1 : -1;

        let cmp = 0;
        if (sortBy === 'priority') {
            const pVal = { high: 3, medium: 2, low: 1, undefined: 0 };
            const valA = pVal[a.priority || 'undefined'] || 0;
            const valB = pVal[b.priority || 'undefined'] || 0;
            cmp = valA - valB;
        } else {
            // Sort by Date
            cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }

        return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tasks, selectedDate, filterStatus, filterPriority, searchQuery, sortBy, sortDirection]);

  // Statistics for the header
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

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-transparent">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-700 p-6 sm:p-8 pb-16 text-white shrink-0 shadow-lg md:rounded-t-[2.5rem] z-10 transition-all duration-500">
        <div className="absolute top-0 right-0 p-8 opacity-10 transform translate-x-10 -translate-y-10">
            <TrendingUp size={140} />
        </div>
        
        {/* Date Navigation */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
           <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-2xl p-1.5 pr-4 shadow-inner border border-white/20 w-fit">
              <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-white/10 rounded-xl text-blue-50 transition-colors active:scale-95" title={t.prevDay}>
                  <ChevronLeft size={20} />
              </button>
              
              <div className="relative group mx-1">
                 <input 
                    type="date" 
                    value={formattedSelectedDate}
                    onChange={handleDateChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                 />
                 <div className="flex flex-col items-center pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-blue-200 tracking-wider">
                        {isToday ? t.today : t.jumpToDate}
                    </span>
                    <div className="flex items-center gap-2 font-bold text-base whitespace-nowrap text-white">
                       <Calendar size={16} className="text-blue-200" />
                       {displayDate}
                    </div>
                 </div>
              </div>

              <button onClick={() => navigateDate(1)} className="p-2 hover:bg-white/10 rounded-xl text-blue-50 transition-colors active:scale-95" title={t.nextDay}>
                  <ChevronRight size={20} />
              </button>
           </div>
           
           {!isToday && (
              <button onClick={goToToday} className="absolute top-0 right-0 sm:relative sm:top-auto sm:right-auto text-xs font-bold bg-white/20 hover:bg-white/30 px-4 py-2 rounded-full transition-colors border border-white/10 backdrop-blur-md">
                  {t.today}
              </button>
           )}
        </div>

        <div className="flex items-end justify-between mb-2">
            <div>
                <div className="text-sm font-medium text-blue-100 mb-1">{t.dailyProgress}</div>
                <div className="text-4xl font-extrabold tracking-tight flex items-baseline gap-2">
                    {overallProgress}<span className="text-xl opacity-60">%</span>
                </div>
            </div>
            <div className="text-right">
                <div className="text-xs font-medium text-blue-200 mb-1">{t.done}</div>
                <div className="text-xl font-bold">{completedCount}/{totalTasks}</div>
            </div>
        </div>

        <div className="relative w-full h-3 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/5">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-emerald-400 to-cyan-300 shadow-[0_0_15px_rgba(52,211,153,0.6)] transition-all duration-700 ease-out rounded-full"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
      </div>

      {/* Floating Input & Filters Container */}
      <div className="px-4 sm:px-8 -mt-8 z-20 sticky top-0 md:relative">
         <div className="max-w-4xl mx-auto w-full flex flex-col gap-4">
            {/* Input Card */}
            <div className="bg-white p-2 rounded-3xl shadow-xl shadow-blue-900/5 border border-white/50 backdrop-blur-xl relative group">
                <div className="relative flex items-center">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 z-10 flex gap-1 bg-slate-100 p-1 rounded-xl transition-all duration-200">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => (
                            <button 
                                key={p}
                                onClick={() => setNewPriority(p)}
                                className={`w-5 h-5 rounded-lg transition-all flex items-center justify-center ${
                                    newPriority === p ? 'ring-2 ring-offset-1 ring-white scale-110 shadow-sm' : 'opacity-40 hover:opacity-100 scale-90 hover:scale-100'
                                } ${getPriorityDot(p)}`}
                                title={t[p]}
                            >
                                {newPriority === p && <CheckCircle size={12} className="text-white" strokeWidth={3} />}
                            </button>
                        ))}
                    </div>
                    <input
                        type="text"
                        placeholder={t.addTaskPlaceholder}
                        className="w-full pl-28 pr-14 py-4 bg-transparent rounded-2xl focus:outline-none text-slate-700 font-medium placeholder:text-slate-400 text-base"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        onClick={addTask}
                        disabled={!inputValue.trim()}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-2.5 rounded-xl transition-all shadow-md ${
                            inputValue.trim() 
                            ? 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105 active:scale-95' 
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                    >
                        <Plus size={22} strokeWidth={2.5} />
                    </button>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar py-1">
                    {/* Status Toggle */}
                    <div className="flex p-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm shrink-0">
                        {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
                            <button 
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all capitalize ${
                            filterStatus === f 
                            ? 'bg-white text-blue-600 shadow-sm ring-1 ring-black/5' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                            }`}
                        >
                            {f === 'all' ? t.all : f === 'active' ? t.active : t.completed}
                        </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Advanced Filters Toggle */}
                        <button 
                            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                            className={`p-2.5 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center justify-center ${
                                showAdvancedFilters || searchQuery || filterPriority !== 'all'
                                ? 'bg-white text-blue-600 border-blue-200'
                                : 'bg-white/60 text-slate-500 border-white/40 hover:bg-white'
                            }`}
                        >
                            <SlidersHorizontal size={18} />
                            {(searchQuery || filterPriority !== 'all') && (
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white translate-x-1 -translate-y-1"></span>
                            )}
                        </button>

                        {/* Sort Controls */}
                        <div className="flex items-center bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 shadow-sm p-1">
                            <button 
                                onClick={() => setSortBy(sortBy === 'priority' ? 'date' : 'priority')}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-white hover:text-blue-600 transition-all"
                            >
                                <span className="text-blue-600">{sortBy === 'priority' ? t.sortPriority : t.sortDate}</span>
                            </button>
                            <div className="w-px h-4 bg-slate-300 mx-1"></div>
                            <button
                                onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition-colors"
                            >
                                {sortDirection === 'asc' ? <ArrowUpNarrowWide size={16}/> : <ArrowDownNarrowWide size={16}/>}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Advanced Filters Drawer */}
                {showAdvancedFilters && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-2xl p-3 border border-white/50 shadow-sm animate-fade-in grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input 
                                type="text" 
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search tasks..." 
                                className="w-full pl-9 pr-8 py-2 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                                    <XCircle size={14} fill="currentColor" className="bg-white rounded-full"/>
                                </button>
                            )}
                        </div>
                        
                        <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-200 p-1">
                            <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Priority:</span>
                            {(['all', 'high', 'medium', 'low'] as const).map(p => (
                                <button
                                    key={p}
                                    onClick={() => setFilterPriority(p)}
                                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                                        filterPriority === p 
                                        ? (p === 'all' ? 'bg-slate-800 text-white' : p === 'high' ? 'bg-rose-500 text-white' : p === 'medium' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white')
                                        : 'text-slate-500 hover:bg-slate-50'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
         </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-4 custom-scrollbar space-y-4">
        <div className="max-w-4xl mx-auto w-full pb-24 md:pb-8">
            {processedTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="bg-slate-100 p-6 rounded-full mb-4 ring-8 ring-slate-50">
                    <ListFilter size={40} className="opacity-40" />
                </div>
                <p className="text-base font-medium text-slate-500">
                    {searchQuery ? "No matching tasks found." : t.emptyTasks}
                </p>
            </div>
            ) : (
            <ul className="space-y-4">
                {processedTasks.map((task) => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const priorityColor = getPriorityColor(task.priority);

                    return (
                        <li 
                            key={task.id} 
                            className={`group animate-fade-in p-4 sm:p-5 rounded-2xl transition-all duration-300 relative border ${
                            task.completed 
                                ? 'bg-slate-50 border-slate-100 opacity-75 grayscale-[0.5]' 
                                : 'bg-white border-white shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.08)] hover:-translate-y-1 hover:border-blue-100'
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-4 overflow-hidden w-full">
                                    <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex-shrink-0 transition-all duration-300 transform ${
                                        task.completed ? 'text-emerald-500 scale-110' : 'text-slate-300 hover:text-blue-500 hover:scale-110'
                                    }`}
                                    >
                                    {task.completed ? <CheckCircle size={26} className="fill-current" /> : <Circle size={26} strokeWidth={2} />}
                                    </button>
                                    <div className="flex-grow min-w-0">
                                        <span 
                                            className={`block truncate font-bold text-lg transition-all cursor-pointer ${
                                                task.completed ? 'line-through text-slate-400 decoration-2 decoration-slate-300' : 'text-slate-700'
                                            }`}
                                            onClick={() => toggleTask(task.id)}
                                        >
                                            {task.text}
                                        </span>
                                        {task.priority && (
                                            <div className="flex items-center mt-1">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1 w-fit ${priorityColor}`}>
                                                    {getPriorityIcon(task.priority)} {t[task.priority]}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <button 
                                    onClick={() => deleteTask(task.id)}
                                    className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>

                            {/* Subtasks Section */}
                            <div className="ml-10">
                                {hasSubtasks && (
                                    <ul className="space-y-2 mb-3 mt-2">
                                        {task.subtasks!.map(sub => (
                                            <li key={sub.id} className="flex items-center gap-3 group/sub">
                                                <button onClick={() => toggleSubtask(task.id, sub.id)} className={`text-slate-300 hover:text-blue-500 transition-colors ${sub.completed ? 'text-emerald-500' : ''}`}>
                                                    {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                                <span className={`text-sm flex-grow transition-colors ${sub.completed ? 'line-through text-slate-400' : 'text-slate-600 font-medium'}`}>{sub.text}</span>
                                                <button onClick={() => deleteSubtask(task.id, sub.id)} className="opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 p-1 transition-opacity">
                                                    <X size={14} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                
                                {/* Add Subtask Input */}
                                <div className="flex items-center gap-2 mt-3 group/add">
                                    <div className="relative flex-1">
                                        <input 
                                            type="text" 
                                            placeholder={t.addSubtask}
                                            value={subtaskInputs[task.id] || ''}
                                            onChange={(e) => setSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            onKeyDown={(e) => { if(e.key === 'Enter') addSubtask(task.id); }}
                                            className="w-full text-xs py-2 pl-3 pr-8 bg-slate-50 border border-transparent hover:border-slate-200 focus:bg-white focus:border-blue-300 rounded-lg focus:outline-none transition-all placeholder:text-slate-400"
                                        />
                                        <button 
                                            onClick={() => addSubtask(task.id)}
                                            className="absolute right-1 top-1 p-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                        >
                                            <PlusCircle size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pl-10 pr-2 border-t border-dashed border-slate-100 pt-4 mt-3">
                                <div className="relative flex-grow h-2 flex items-center group/slider cursor-pointer">
                                    <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${task.completed ? 'bg-emerald-400' : 'bg-blue-500'} rounded-full transition-all duration-300`} style={{width: `${task.progress}%`}}></div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={task.progress}
                                        onChange={(e) => updateProgress(task.id, e.target.value)}
                                        disabled={!!(hasSubtasks)}
                                        className={`absolute w-full h-6 -top-2 opacity-0 ${hasSubtasks ? 'cursor-not-allowed' : 'cursor-pointer'} z-10`}
                                    />
                                    <div 
                                        className={`w-4 h-4 rounded-full border-[3px] shadow-sm absolute pointer-events-none transition-all duration-200 ${
                                            task.completed ? 'bg-white border-emerald-500' : 'bg-white border-blue-600'
                                        }`}
                                        style={{left: `calc(${task.progress}% - 8px)`}}
                                    ></div>
                                </div>
                                <span className={`text-xs font-bold w-10 text-right font-mono ${
                                    task.completed ? 'text-emerald-600' : 'text-blue-600'
                                }`}>
                                    {task.progress}%
                                </span>
                            </div>
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
            className="pointer-events-auto bg-white/80 backdrop-blur-xl shadow-lg border border-white/50 text-slate-500 hover:text-red-600 hover:border-red-100 hover:bg-red-50 px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ring-1 ring-black/5"
          >
            <Archive size={16} /> {t.clearCompleted}
          </button>
        </div>
      )}
    </div>
  );
};