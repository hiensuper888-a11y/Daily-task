import React, { useState, useMemo } from 'react';
import { Plus, Trash2, CheckCircle, Circle, Calendar, ListFilter, Archive, TrendingUp, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Flag, AlertCircle, ArrowDown, ArrowUp, Minus, ArrowUpDown } from 'lucide-react';
import { Task, Subtask, FilterType, Priority } from '../types';
import { useRealtimeStorage } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

export const TodoList: React.FC = () => {
  const [tasks, setTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<'priority' | 'date'>('priority');
  
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

  const tasksForSelectedDate = useMemo(() => {
    return tasks.filter(task => {
        const taskDate = new Date(task.createdAt);
        return taskDate.toDateString() === selectedDate.toDateString();
    });
  }, [tasks, selectedDate]);

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
    // Keep priority selection or reset? Let's keep it for rapid entry.
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') addTask();
  };

  // ----- PRIORITY HELPER (UPDATED COLORS) -----
  // Green (Low) - Yellow/Amber (Medium) - Red (High)
  
  const getPriorityColor = (p?: Priority) => {
      switch(p) {
          case 'high': return 'bg-red-100 text-red-700 border-red-200';
          case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
          case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
          default: return 'bg-slate-100 text-slate-600 border-slate-200';
      }
  };

  const getPriorityDot = (p?: Priority) => {
    switch(p) {
        case 'high': return 'bg-red-500';
        case 'medium': return 'bg-amber-500';
        case 'low': return 'bg-emerald-500';
        default: return 'bg-slate-400';
    }
  };
  
  const getPriorityBorder = (p?: Priority) => {
      switch(p) {
          case 'high': return 'border-l-red-500';
          case 'medium': return 'border-l-amber-500';
          case 'low': return 'border-l-emerald-500';
          default: return 'border-l-slate-300';
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
    const idsToArchive = filteredTasks.filter(t => t.completed).map(t => t.id);
    setTasks(tasks.map(task => idsToArchive.includes(task.id) ? { ...task, archived: true } : task));
  };

  const visibleTasks = tasksForSelectedDate.filter(t => !t.archived);
  
  // Sorting: Active first, then by priority (High > Medium > Low) or date depending on sort mode, then by time
  visibleTasks.sort((a, b) => {
      if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
      }

      if (sortBy === 'priority') {
          const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1, undefined: 0 };
          const pA = priorityOrder[a.priority || 'undefined'];
          const pB = priorityOrder[b.priority || 'undefined'];
          if (pA !== pB) return pB - pA; // Descending priority
      }

      // Default fallback: Newest first (by ID which is timestamp)
      return b.id - a.id;
  });

  const totalTasks = visibleTasks.length;
  const totalProgressSum = visibleTasks.reduce((sum, task) => sum + task.progress, 0);
  const overallProgress = totalTasks === 0 ? 0 : Math.round(totalProgressSum / totalTasks);
  const completedCount = visibleTasks.filter(t => t.completed).length;

  const filteredTasks = visibleTasks.filter(task => {
    if (filter === 'active') return !task.completed;
    if (filter === 'completed') return task.completed;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-slate-50/50 md:bg-white md:rounded-3xl">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-6 sm:p-8 text-white shrink-0 shadow-lg">
        <div className="absolute top-0 right-0 p-4 opacity-10">
            <TrendingUp size={100} />
        </div>
        
        {/* Date Navigation */}
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
           <div className="flex items-center gap-2 bg-blue-800/30 backdrop-blur-md rounded-xl p-1 pr-3 shadow-inner border border-blue-400/20 w-fit">
              <button onClick={() => navigateDate(-1)} className="p-2 hover:bg-white/10 rounded-lg text-blue-100 transition-colors" title={t.prevDay}>
                  <ChevronLeft size={20} />
              </button>
              
              <div className="relative group">
                 <input 
                    type="date" 
                    value={formattedSelectedDate}
                    onChange={handleDateChange}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                 />
                 <div className="flex flex-col items-center px-1 pointer-events-none">
                    <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider">
                        {isToday ? t.today : t.jumpToDate}
                    </span>
                    <div className="flex items-center gap-1.5 font-bold text-sm sm:text-base whitespace-nowrap">
                       <Calendar size={14} className="text-blue-200" />
                       {displayDate}
                    </div>
                 </div>
              </div>

              <button onClick={() => navigateDate(1)} className="p-2 hover:bg-white/10 rounded-lg text-blue-100 transition-colors" title={t.nextDay}>
                  <ChevronRight size={20} />
              </button>
           </div>
           
           {!isToday && (
              <button onClick={goToToday} className="absolute top-0 right-0 sm:relative sm:top-auto sm:right-auto text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-colors border border-white/10">
                  {t.today}
              </button>
           )}

           <div className="text-right ml-auto">
             <div className="text-3xl sm:text-4xl font-bold tracking-tighter">{overallProgress}%</div>
             <p className="text-[10px] text-blue-100 uppercase tracking-widest font-semibold opacity-80">{t.dailyProgress}</p>
           </div>
        </div>

        <div className="relative w-full h-2 bg-blue-900/40 rounded-full overflow-hidden backdrop-blur-sm">
          <div 
            className="absolute top-0 left-0 h-full bg-gradient-to-r from-cyan-300 to-blue-200 shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-all duration-700 ease-out rounded-full"
            style={{ width: `${overallProgress}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-xs text-blue-100 mt-3 font-medium">
          <span>{t.done}: {completedCount}/{totalTasks} {t.items}</span>
          <span>{overallProgress === 100 && totalTasks > 0 ? t.greatJob : t.keepGoing}</span>
        </div>
      </div>

      {/* Input */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 shrink-0 bg-white shadow-sm z-10 sticky top-0 md:relative">
         <div className="max-w-4xl mx-auto w-full relative group">
          <div className="relative">
            {/* Priority Selector inside Input */}
            <div className="absolute left-3 top-2.5 z-10 flex gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                    <button 
                        key={p}
                        onClick={() => setNewPriority(p)}
                        className={`w-4 h-4 rounded-md transition-all flex items-center justify-center ${
                             newPriority === p ? 'ring-2 ring-offset-1 ring-slate-300 scale-110 shadow-sm' : 'opacity-40 hover:opacity-100'
                        } ${getPriorityDot(p)}`}
                        title={t[p]}
                    >
                        {newPriority === p && <CheckCircle size={10} className="text-white/90" />}
                    </button>
                ))}
            </div>
            <input
                type="text"
                placeholder={t.addTaskPlaceholder}
                className="w-full pl-24 pr-14 py-3 sm:py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:outline-none focus:bg-white focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium placeholder:text-slate-400 text-slate-700 text-sm sm:text-base"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
            />
          </div>
          <button
            onClick={addTask}
            className="absolute right-3 top-2.5 sm:top-3 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-105 active:scale-95"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* Filters and Sort */}
      <div className="px-4 sm:px-6 pt-2 pb-2 shrink-0 bg-white/50 backdrop-blur-sm border-b border-slate-100 sticky top-[76px] md:top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto w-full">
            <div className="flex space-x-2">
            {(['all', 'active', 'completed'] as FilterType[]).map((f) => (
                <button 
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all capitalize ${
                filter === f 
                ? 'bg-blue-100 text-blue-700 shadow-sm ring-1 ring-blue-200' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
            >
                {f === 'all' ? t.all : f === 'active' ? t.active : t.completed}
            </button>
            ))}
            </div>

            {/* Sort Toggle */}
            <button 
                onClick={() => setSortBy(prev => prev === 'priority' ? 'date' : 'priority')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all shadow-sm group"
            >
                <ArrowUpDown size={12} className="text-slate-400 group-hover:text-blue-500"/>
                <span className="hidden sm:inline text-slate-500">{t.sortBy}:</span>
                <span className="text-blue-600 font-bold">{sortBy === 'priority' ? t.sortPriority : t.sortDate}</span>
            </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 custom-scrollbar space-y-3">
        <div className="max-w-4xl mx-auto w-full">
            {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-60 text-slate-400">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                <ListFilter size={32} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">{t.emptyTasks}</p>
            </div>
            ) : (
            <ul className="space-y-4 pb-24 md:pb-6">
                {filteredTasks.map((task) => {
                    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
                    const priorityColor = getPriorityColor(task.priority);
                    const borderClass = getPriorityBorder(task.priority);

                    return (
                        <li 
                            key={task.id} 
                            className={`group animate-fade-in p-3 sm:p-5 rounded-2xl border-t border-r border-b border-l-[6px] transition-all duration-300 relative ${
                            task.completed 
                                ? 'bg-slate-50/80 border-t-slate-100 border-r-slate-100 border-b-slate-100 border-l-slate-300 opacity-80' 
                                : `bg-white border-t-slate-100 border-r-slate-100 border-b-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_12px_rgba(37,99,235,0.08)] ${borderClass}`
                            }`}
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3 overflow-hidden w-full">
                                    <button 
                                    onClick={() => toggleTask(task.id)}
                                    className={`flex-shrink-0 transition-all duration-300 transform ${
                                        task.completed ? 'text-green-500 scale-110' : 'text-slate-300 hover:text-blue-500 hover:scale-110'
                                    }`}
                                    >
                                    {task.completed ? <CheckCircle size={24} className="fill-current" /> : <Circle size={24} strokeWidth={2} />}
                                    </button>
                                    <span 
                                    className={`truncate font-medium text-base transition-all select-none cursor-pointer flex-grow ${
                                        task.completed ? 'line-through text-slate-400 decoration-2 decoration-slate-300' : 'text-slate-700'
                                    }`}
                                    onClick={() => toggleTask(task.id)}
                                    >
                                    {task.text}
                                    </span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {task.priority && (
                                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border flex items-center ${priorityColor}`}>
                                            {getPriorityIcon(task.priority)} {t[task.priority]}
                                        </span>
                                    )}
                                    <button 
                                        onClick={() => deleteTask(task.id)}
                                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            {/* Subtasks Section */}
                            <div className="ml-9 mb-3">
                                {hasSubtasks && (
                                    <ul className="space-y-2 mb-3">
                                        {task.subtasks!.map(sub => (
                                            <li key={sub.id} className="flex items-center gap-2 group/sub">
                                                <button onClick={() => toggleSubtask(task.id, sub.id)} className={`text-slate-400 hover:text-blue-500 ${sub.completed ? 'text-green-500' : ''}`}>
                                                    {sub.completed ? <CheckSquare size={16} /> : <Square size={16} />}
                                                </button>
                                                <span className={`text-sm flex-grow ${sub.completed ? 'line-through text-slate-400' : 'text-slate-600'}`}>{sub.text}</span>
                                                <button onClick={() => deleteSubtask(task.id, sub.id)} className="opacity-0 group-hover/sub:opacity-100 text-slate-300 hover:text-red-500 p-1">
                                                    <X size={12} />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                
                                {/* Add Subtask Input */}
                                <div className="flex items-center gap-2 mt-2">
                                    <div className="relative flex-1">
                                        <input 
                                            type="text" 
                                            placeholder={t.addSubtask}
                                            value={subtaskInputs[task.id] || ''}
                                            onChange={(e) => setSubtaskInputs(prev => ({ ...prev, [task.id]: e.target.value }))}
                                            onKeyDown={(e) => { if(e.key === 'Enter') addSubtask(task.id); }}
                                            className="w-full text-xs py-1.5 pl-2 pr-8 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-300"
                                        />
                                        <button 
                                            onClick={() => addSubtask(task.id)}
                                            className="absolute right-1 top-1 text-slate-400 hover:text-blue-600 p-0.5"
                                        >
                                            <PlusCircle size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 pl-9 pr-1 border-t border-slate-50 pt-3">
                                <div className="relative flex-grow h-5 flex items-center group/slider">
                                    <div className="absolute w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className={`h-full ${task.completed ? 'bg-green-200' : 'bg-blue-200'} rounded-full transition-all duration-300`} style={{width: `${task.progress}%`}}></div>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={task.progress}
                                        onChange={(e) => updateProgress(task.id, e.target.value)}
                                        disabled={!!(hasSubtasks)} // Disable manual slider if subtasks exist
                                        className={`absolute w-full h-full opacity-0 ${hasSubtasks ? 'cursor-not-allowed' : 'cursor-pointer'} z-10 touch-none`}
                                    />
                                    <div 
                                        className={`w-3 h-3 rounded-full border-2 shadow-sm absolute pointer-events-none transition-all duration-200 ${
                                            task.completed ? 'bg-white border-green-500' : 'bg-white border-blue-600'
                                        }`}
                                        style={{left: `calc(${task.progress}% - 6px)`}}
                                    ></div>
                                </div>
                                <span className={`text-xs font-bold w-9 text-right font-mono ${
                                    task.completed ? 'text-green-600' : 'text-blue-600'
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
        <div className="absolute bottom-4 sm:bottom-6 left-0 right-0 flex justify-center pointer-events-none z-20">
          <button 
            onClick={archiveCompleted}
            className="pointer-events-auto bg-white/90 backdrop-blur-md shadow-lg border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-100 px-4 py-2 rounded-full text-xs font-semibold flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <Archive size={14} /> {t.clearCompleted}
          </button>
        </div>
      )}
    </div>
  );
};