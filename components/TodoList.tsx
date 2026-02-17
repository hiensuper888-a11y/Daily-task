import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Check, Trash2, Plus, Calendar, User, Users, CheckSquare, 
  X, SortAsc, Archive, Sparkles, Settings, Clock, Flag, AlertCircle, CalendarClock, PanelLeft, Send, Search, MoreHorizontal, Layout, Filter, Edit2, ArrowRight
} from 'lucide-react';
import { Task, Subtask, Group, Priority, SortOption, FilterType, UserProfile } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { generateSubtasksWithGemini, refineTaskTextWithGemini } from '../services/geminiService';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onToggleSidebar: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({ activeGroup, onOpenSettings, onOpenProfile, onToggleSidebar }) => {
  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  
  // Storage Logic
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup; 
  
  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { 
      name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false, uid: '' 
  });
  
  // --- Local State ---
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newAssignee, setNewAssignee] = useState<string>(''); 
  const [showAssigneeList, setShowAssigneeList] = useState(false);

  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('date_new'); 
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset input state when switching groups
  useEffect(() => {
      setNewAssignee('');
      setNewPriority('medium');
      setNewDeadline('');
      setIsInputExpanded(false);
      setShowAssigneeList(false);
  }, [activeGroup?.id]);

  // --- Handlers ---

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;

    const newTask: Task = {
      id: Date.now(),
      text: newTaskText,
      completed: false,
      progress: 0,
      createdAt: new Date().toISOString(),
      deadline: newDeadline || undefined,
      priority: newPriority,
      subtasks: [],
      createdBy: currentUserId,
      assignedTo: activeGroup ? (newAssignee || currentUserId) : undefined, 
      groupId: activeGroup?.id
    };

    setTasks(prev => [newTask, ...prev]);
    
    // Reset form
    setNewTaskText('');
    setNewDeadline('');
    setNewPriority('medium');
    setNewAssignee('');
    setShowAssigneeList(false);
    playSuccessSound(); 
    
    // Keep focus for rapid entry
    inputRef.current?.focus();
  };

  const handleToggleTask = (taskId: number) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const newCompleted = !task.completed;
        const now = new Date().toISOString();
        if (newCompleted) playSuccessSound();
        return { 
          ...task, 
          completed: newCompleted, 
          progress: newCompleted ? 100 : (task.subtasks?.length ? task.progress : 0),
          completedAt: newCompleted ? now : undefined,
          completedBy: newCompleted ? currentUserId : undefined
        };
      }
      return task;
    }));
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm(t.deleteTaskConfirm)) {
        setTasks(prev => prev.filter(t => t.id !== taskId));
        if (editingTask?.id === taskId) setEditingTask(null);
    }
  };

  const handleArchiveCompleted = () => {
      setTasks(prev => prev.map(t => t.completed ? { ...t, archived: true } : t));
  };

  // --- AI Handlers ---

  const handleAiRefine = async () => {
      if (!editingTask) return;
      setIsAiProcessing(true);
      try {
          const refined = await refineTaskTextWithGemini(editingTask.text);
          setEditingTask(prev => prev ? { ...prev, text: refined } : null);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const handleAiSubtasks = async () => {
      if (!editingTask) return;
      setIsAiProcessing(true);
      try {
          const steps = await generateSubtasksWithGemini(editingTask.text);
          const newSubtasks: Subtask[] = steps.map((s, i) => ({
              id: Date.now() + i,
              text: s,
              completed: false
          }));
          setEditingTask(prev => prev ? { ...prev, subtasks: [...(prev.subtasks || []), ...newSubtasks] } : null);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const handleSaveEdit = () => {
      if (!editingTask) return;
      setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
      setEditingTask(null);
  };

  // --- Sorting & Filtering Logic ---

  const cyclePriority = () => {
      if (newPriority === 'medium') setNewPriority('high');
      else if (newPriority === 'high') setNewPriority('low');
      else setNewPriority('medium');
  };

  const cycleSort = () => {
      setSort(current => {
          if (current === 'date_new') return 'priority';
          if (current === 'priority') return 'deadline';
          return 'date_new';
      });
  };

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.archived); 

    if (filter === 'active') result = result.filter(t => !t.completed);
    else if (filter === 'completed') result = result.filter(t => t.completed);
    else if (filter === 'assigned_to_me' && activeGroup) result = result.filter(t => t.assignedTo === currentUserId);

    if (sort === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        result.sort((a, b) => {
            const pA = priorityOrder[a.priority || 'medium'];
            const pB = priorityOrder[b.priority || 'medium'];
            if (pA !== pB) return pB - pA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    } else if (sort === 'deadline') {
        result.sort((a, b) => {
            if (!a.deadline) return 1; 
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
    } else if (sort === 'date_new') {
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [tasks, filter, sort, activeGroup, currentUserId]);

  const stats = useMemo(() => {
      const total = tasks.filter(t => !t.archived).length;
      const completed = tasks.filter(t => !t.archived && t.completed).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { total, completed, percent };
  }, [tasks]);

  // --- Theming ---
  
  const memberSettings = useMemo(() => {
      if (!activeGroup) return null;
      return activeGroup.members.find(m => m.id === currentUserId);
  }, [activeGroup, currentUserId]);

  const headerStyle = useMemo(() => {
      let bg = '';
      if (memberSettings?.headerBackground) bg = memberSettings.headerBackground;
      else if (activeGroup?.background) bg = activeGroup.background;
      return bg ? { background: bg, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  }, [memberSettings, activeGroup]);
  
  const isCustomTheme = !!(memberSettings?.headerBackground || activeGroup?.background);

  // --- Render ---

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      
      {/* 1. Header Section */}
      <div className="shrink-0 z-10 transition-all duration-500">
          <div className={`pt-4 pb-6 px-6 transition-all duration-500 ${isCustomTheme ? 'bg-black/40 backdrop-blur-xl rounded-b-[2.5rem] shadow-2xl mx-2 mt-2 text-white border-b border-white/10' : 'bg-white/80 backdrop-blur-xl border-b border-slate-200/50'}`} style={headerStyle}>
            
            {/* Top Row: Navigation & Actions */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onToggleSidebar} className={`p-2.5 rounded-2xl transition-all active:scale-95 ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-indigo-50 text-indigo-900 shadow-sm ring-1 ring-indigo-50'}`}>
                        <PanelLeft size={20} />
                    </button>
                    
                    <div onClick={activeGroup ? onOpenSettings : onOpenProfile} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <div className={`w-11 h-11 rounded-2xl shadow-lg overflow-hidden ring-2 transition-all ${isCustomTheme ? 'ring-white/30' : 'ring-white'}`}>
                                <img src={activeGroup ? (activeGroup.avatar || `https://ui-avatars.com/api/?name=${activeGroup.name}`) : (userProfile.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default")} alt="Avatar" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"/>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white shadow-sm"></div>
                        </div>
                        <div className="flex flex-col">
                            <h1 className={`text-lg font-black leading-none truncate max-w-[150px] lg:max-w-xs ${isCustomTheme ? 'text-white' : 'text-slate-800'}`}>{activeGroup ? activeGroup.name : t.todoHeader}</h1>
                            <span className={`text-[11px] font-bold uppercase tracking-widest mt-1 opacity-70 ${isCustomTheme ? 'text-white' : 'text-slate-500'}`}>{new Date().toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {activeGroup && (
                        <button onClick={onOpenSettings} className={`p-2.5 rounded-2xl transition-all active:scale-95 ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-100'}`}>
                            <Settings size={20}/>
                        </button>
                    )}
                    <button onClick={handleArchiveCompleted} className={`p-2.5 rounded-2xl transition-all active:scale-95 group ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white hover:bg-slate-50 text-slate-500 shadow-sm ring-1 ring-slate-100'}`} title={t.clearCompleted}>
                        <Archive size={20} className="group-hover:text-indigo-500 transition-colors"/>
                    </button>
                </div>
            </div>

            {/* Bottom Row: Progress & Filters */}
            <div className="space-y-4">
                 <div className="flex items-center gap-4">
                     <div className="flex-1 relative h-3 bg-slate-200/30 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
                         <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${isCustomTheme ? 'from-white/80 to-white' : 'from-indigo-500 to-fuchsia-500'}`} style={{ width: `${stats.percent}%` }}>
                             <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                         </div>
                     </div>
                     <span className={`text-sm font-black min-w-[3rem] text-right ${isCustomTheme ? 'text-white' : 'text-indigo-600'}`}>{stats.percent}%</span>
                 </div>

                 <div className="flex justify-between items-center gap-2">
                     <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100/50 backdrop-blur-sm">
                        {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                            <button 
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 ${
                                    filter === f 
                                    ? 'bg-white text-indigo-600 shadow-sm scale-105' 
                                    : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                                }`}
                            >
                                {t[f]}
                            </button>
                        ))}
                     </div>
                     <button 
                        onClick={cycleSort} 
                        className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 ${
                            isCustomTheme 
                            ? 'bg-white/20 text-white hover:bg-white/30' 
                            : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-100'
                        }`}
                    >
                        {sort === 'priority' ? <Flag size={14} className="text-amber-500"/> : sort === 'deadline' ? <Clock size={14} className="text-rose-500"/> : <SortAsc size={14}/>}
                        <span className="hidden lg:inline">{sort === 'date_new' ? t.newest : sort === 'priority' ? t.priority : t.deadline}</span>
                    </button>
                 </div>
            </div>
          </div>
      </div>

      {/* 2. Task List */}
      <div className="flex-1 overflow-y-auto px-3 pb-32 pt-4 custom-scrollbar space-y-3">
          {filteredTasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-fade-in">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] flex items-center justify-center mb-4 shadow-sm ring-1 ring-indigo-50">
                      <Sparkles size={40} className="text-indigo-200 animate-pulse"/>
                  </div>
                  <p className="font-bold text-sm text-slate-400">{t.emptyTasks}</p>
                  <p className="text-xs font-semibold text-slate-300 mt-1">{t.emptyChill}</p>
              </div>
          ) : (
              <div className="space-y-3">
                  {filteredTasks.map((task, index) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        index={index}
                        onToggle={() => handleToggleTask(task.id)}
                        onEdit={() => setEditingTask(task)}
                        activeGroup={activeGroup}
                      />
                  ))}
              </div>
          )}
      </div>

      {/* 3. Floating Input Bar */}
      {/* Overlay to close expanded input */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[90] transition-opacity duration-300 ${isInputExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { setIsInputExpanded(false); setShowAssigneeList(false); }}
      ></div>

      <div className={`fixed bottom-0 left-0 right-0 z-[100] pb-safe transition-transform duration-500 cubic-bezier(0.32,0.72,0,1) ${isInputExpanded ? 'translate-y-0' : 'translate-y-0'}`}>
          <div className={`mx-auto transition-all duration-300 ${isInputExpanded ? 'max-w-2xl px-4 pb-4' : 'max-w-xl px-4 pb-4 lg:pb-8'}`}>
              <div 
                className={`bg-white/90 backdrop-blur-xl shadow-float border border-white/50 transition-all duration-300 overflow-hidden relative group ${
                    isInputExpanded ? 'rounded-[2.5rem] p-4 ring-1 ring-black/5' : 'rounded-full p-2 pr-3 flex items-center gap-3 cursor-text hover:scale-[1.01]'
                }`}
                onClick={() => !isInputExpanded && setIsInputExpanded(true)}
              >
                  {!isInputExpanded && (
                      <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 group-hover:rotate-90 transition-transform duration-500">
                          <Plus size={24} />
                      </div>
                  )}

                  <div className="flex-1 min-w-0">
                      <input
                          ref={inputRef}
                          value={newTaskText}
                          onChange={(e) => setNewTaskText(e.target.value)}
                          onFocus={() => setIsInputExpanded(true)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
                          placeholder={t.addTaskPlaceholder}
                          className={`w-full bg-transparent outline-none text-slate-800 placeholder-slate-400 font-bold ${isInputExpanded ? 'text-xl px-2 pt-1 pb-3' : 'text-base'}`}
                      />
                      
                      {isInputExpanded && (
                          <div className="flex items-center gap-2 mt-4 px-1 overflow-x-auto scrollbar-none pb-1 animate-slide-up">
                              {/* Date Picker Button */}
                              <div className="relative shrink-0 group/date">
                                  <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newDeadline ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>
                                      <CalendarClock size={16} className={newDeadline ? "text-indigo-500" : "text-slate-400"} />
                                      {newDeadline ? new Date(newDeadline).toLocaleDateString(language, {day: 'numeric', month: 'short', hour: '2-digit'}) : t.deadline}
                                  </button>
                                  <input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                              </div>

                              {/* Priority Pill Selector */}
                              <button onClick={cyclePriority} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newPriority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : newPriority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                  <Flag size={16} fill="currentColor" className="opacity-50" /> {t[newPriority]}
                              </button>

                              {/* Assignee Selector */}
                              {activeGroup && (
                                  <button onClick={() => setShowAssigneeList(!showAssigneeList)} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newAssignee ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>
                                      {newAssignee ? (<><img src={activeGroup.members.find(m => m.id === newAssignee)?.avatar} className="w-4 h-4 rounded-full" alt=""/><span className="max-w-[80px] truncate">{activeGroup.members.find(m => m.id === newAssignee)?.name}</span></>) : (<><User size={16} /> {t.assignTask}</>)}
                                  </button>
                              )}
                          </div>
                      )}
                  </div>

                  {isInputExpanded && (
                      <button onClick={handleAddTask} disabled={!newTaskText.trim()} className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-xl ${newTaskText.trim() ? 'bg-slate-900 text-white hover:bg-slate-800 hover:scale-105 hover:rotate-[-10deg]' : 'bg-slate-100 text-slate-300 cursor-not-allowed'}`}>
                          <Send size={24} className={newTaskText.trim() ? "ml-0.5" : ""} />
                      </button>
                  )}
              </div>

              {/* Expanded Assignee List */}
              {isInputExpanded && showAssigneeList && activeGroup && (
                  <div className="mt-4 bg-white/90 backdrop-blur-xl border border-white rounded-[2rem] p-4 shadow-2xl animate-slide-up overflow-x-auto">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 px-1">{t.memberList}</h4>
                      <div className="flex gap-4">
                          {activeGroup.members.map(member => (
                              <button key={member.id} onClick={() => { setNewAssignee(newAssignee === member.id ? '' : member.id); setShowAssigneeList(false); }} className={`flex flex-col items-center gap-2 shrink-0 transition-all ${newAssignee === member.id ? 'opacity-100 scale-110' : 'opacity-60 hover:opacity-100'}`}>
                                  <div className={`w-12 h-12 rounded-2xl p-0.5 border-2 shadow-sm ${newAssignee === member.id ? 'border-indigo-600' : 'border-transparent'}`}>
                                      <img src={member.avatar} className="w-full h-full rounded-[0.9rem] object-cover bg-slate-100" alt={member.name} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 max-w-[60px] truncate">{member.name}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* 4. Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[85vh] shadow-2xl animate-scale-in flex flex-col overflow-hidden relative ring-1 ring-white/50">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit2 size={20} className="text-indigo-500"/> {t.editTask}</h2>
                    <div className="flex gap-2">
                        <button onClick={() => handleDeleteTask(editingTask.id)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={20}/></button>
                        <button onClick={() => setEditingTask(null)} className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 bg-slate-50/50">
                    {/* Task Content Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.taskContent}</label>
                            <button onClick={handleAiRefine} disabled={isAiProcessing} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm">
                                <Sparkles size={12}/> {t.optimizeAi}
                            </button>
                        </div>
                        <textarea 
                            value={editingTask.text}
                            onChange={(e) => setEditingTask({ ...editingTask, text: e.target.value })}
                            className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-lg outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all min-h-[140px] resize-none shadow-sm"
                        />
                    </div>

                    {/* Meta Data Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Deadline */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t.deadline}</label>
                            <div className="relative">
                                <input 
                                    type="datetime-local"
                                    value={editingTask.deadline || ''}
                                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all"
                                />
                                <CalendarClock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>

                        {/* Priority Selection - PILL STYLE */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t.priority}</label>
                            <div className="flex gap-2">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                                    const isActive = editingTask.priority === p;
                                    let activeClass = '';
                                    if (p === 'high') activeClass = 'bg-rose-500 text-white shadow-lg shadow-rose-200 ring-2 ring-rose-200 ring-offset-1';
                                    else if (p === 'medium') activeClass = 'bg-amber-500 text-white shadow-lg shadow-amber-200 ring-2 ring-amber-200 ring-offset-1';
                                    else activeClass = 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-200 ring-offset-1';

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setEditingTask({ ...editingTask, priority: p })}
                                            className={`flex-1 py-3 rounded-full text-xs font-bold capitalize transition-all duration-300 ${isActive ? activeClass : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            {t[p]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-3">
                         <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.subtasksHeader}</label>
                            <button onClick={handleAiSubtasks} disabled={isAiProcessing} className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-fuchsia-100 transition-colors border border-fuchsia-100 shadow-sm">
                                <Sparkles size={12}/> {t.breakdownAi}
                            </button>
                        </div>
                        <div className="bg-white rounded-3xl p-2 space-y-1 border border-slate-200 shadow-sm">
                             {editingTask.subtasks?.map((st, i) => (
                                 <div key={st.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 rounded-2xl transition-colors">
                                     <button 
                                        onClick={() => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].completed = !newSt[i].completed;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500 text-white scale-110' : 'bg-transparent border-slate-300 text-transparent'}`}
                                     >
                                         <Check size={14} strokeWidth={3}/>
                                     </button>
                                     <input 
                                        value={st.text}
                                        onChange={(e) => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].text = e.target.value;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`flex-1 bg-transparent text-sm font-semibold outline-none ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                     />
                                     <button onClick={() => {
                                         const newSt = editingTask.subtasks?.filter((_, idx) => idx !== i);
                                         setEditingTask({ ...editingTask, subtasks: newSt });
                                     }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-rose-50 rounded-lg"><X size={14}/></button>
                                 </div>
                             ))}
                             <button onClick={() => setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), { id: Date.now(), text: '', completed: false }] })} className="w-full py-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-dashed border-slate-200 hover:border-indigo-200">
                                 <Plus size={14}/> {t.add}
                             </button>
                        </div>
                    </div>
                </div>
                
                {/* Save Button */}
                <div className="p-6 border-t border-slate-100 bg-white z-10">
                    <button onClick={handleSaveEdit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98] hover:scale-[1.01]">
                        {t.saveChanges}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- Task Item Component ---

const TaskItem: React.FC<{ task: Task; index: number; onToggle: () => void; onEdit: () => void; activeGroup: Group | null; }> = ({ task, index, onToggle, onEdit, activeGroup }) => {
    const { t, language } = useLanguage();
    
    // Calculate deadline status
    const deadlineInfo = useMemo(() => {
        if (!task.deadline) return null;
        const now = new Date();
        const d = new Date(task.deadline);
        const diff = d.getTime() - now.getTime();
        const isOverdue = diff < 0;
        const minsLeft = Math.floor(Math.abs(diff) / (1000 * 60));
        const hoursLeft = Math.floor(minsLeft / 60);
        const daysLeft = Math.floor(hoursLeft / 24);
        
        let text = '';
        if (isOverdue) text = hoursLeft < 24 ? `${hoursLeft}h overdue` : `${daysLeft}d overdue`;
        else text = minsLeft < 60 ? `${minsLeft}m left` : hoursLeft < 24 ? `${hoursLeft}h left` : `${daysLeft}d left`;

        return { isOverdue, text, dateStr: d.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    }, [task.deadline, language]);

    // Priority Styling
    const priorityColors = {
        high: { bg: 'bg-rose-50', text: 'text-rose-600', border: 'border-rose-100' },
        medium: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-100' },
        low: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-100' }
    };
    
    const pStyle = priorityColors[task.priority || 'medium'];
    const assignee = activeGroup && task.assignedTo ? activeGroup.members.find(m => m.id === task.assignedTo) : null;

    // Card Base Classes
    const baseClasses = "group relative p-5 rounded-[2rem] transition-all duration-300 cursor-pointer mb-3 transform-gpu animate-slide-up hover:scale-[1.01] active:scale-[0.99] border-2";
    const stateClasses = task.completed 
        ? "bg-slate-50 border-slate-100 opacity-60 grayscale-[0.5]"
        : `bg-white border-transparent shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] hover:shadow-xl hover:border-indigo-100 ${deadlineInfo?.isOverdue ? 'ring-2 ring-rose-100 bg-rose-50/20' : ''}`;

    return (
        <div 
            onClick={onEdit}
            className={`${baseClasses} ${stateClasses}`}
        >
            <div className="flex items-start gap-4">
                {/* Custom Animated Checkbox */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className={`w-7 h-7 mt-0.5 rounded-xl border-2 flex items-center justify-center transition-all duration-300 shrink-0 z-10 hover:scale-110 shadow-sm ${
                        task.completed 
                        ? 'bg-slate-800 border-slate-800 text-white animate-check-bounce' 
                        : 'bg-white border-slate-200 text-transparent hover:border-indigo-300'
                    }`}
                >
                    <Check size={16} strokeWidth={4} />
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <h3 className={`text-base font-bold leading-snug transition-all mb-2 break-words ${task.completed ? 'text-slate-400 line-through decoration-slate-300 decoration-2' : 'text-slate-800'}`}>
                            {task.text}
                        </h3>
                    </div>

                    <div className="flex items-center flex-wrap gap-2">
                         {/* Deadline Badge */}
                         {deadlineInfo && !task.completed && (
                            <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg flex items-center gap-1.5 border ${deadlineInfo.isOverdue ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                {deadlineInfo.isOverdue ? <AlertCircle size={10} strokeWidth={3}/> : <Clock size={10} strokeWidth={3}/>} {deadlineInfo.text}
                            </span>
                        )}
                        
                        {/* Priority Badge - COLOURED PILL */}
                        {!task.completed && (
                            <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg border flex items-center gap-1 ${pStyle.bg} ${pStyle.text} ${pStyle.border}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                                {t[task.priority || 'medium']}
                            </span>
                        )}
                        
                        {/* Assignee Badge */}
                        {assignee && (
                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 rounded-lg border border-indigo-100 pr-3">
                                <img src={assignee.avatar} className="w-4 h-4 rounded-md object-cover" alt=""/>
                                <span className="text-[10px] font-bold text-indigo-700 truncate max-w-[80px]">{assignee.name}</span>
                            </div>
                        )}
                        
                        {/* Subtasks Count */}
                        {task.subtasks && task.subtasks.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 px-2 py-1 rounded-lg bg-slate-50 border border-slate-100">
                                <Layout size={10} />
                                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Arrow hint on hover */}
                <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                    <ArrowRight size={16} className="text-slate-300"/>
                </div>
            </div>
        </div>
    );
};