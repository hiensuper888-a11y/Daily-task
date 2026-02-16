import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Check, Trash2, Plus, Calendar, User, Users, CheckSquare, 
  X, SortAsc, Archive, Sparkles, Settings, Clock, Flag, AlertCircle, ChevronDown, CalendarClock, PanelLeft, Send, Hash
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
  
  // Storage key depends on whether we are in a group or personal mode
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup; 
  
  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { 
      name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false, uid: '' 
  });
  
  // --- Creation State ---
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newAssignee, setNewAssignee] = useState<string>(''); // For groups
  const [showAssigneeList, setShowAssigneeList] = useState(false);

  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('manual'); 
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset creation state when switching groups
  useEffect(() => {
      setNewAssignee('');
      setNewPriority('medium');
      setNewDeadline('');
      setIsInputExpanded(false);
      setShowAssigneeList(false);
  }, [activeGroup?.id]);

  // --- Actions ---

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
      assignedTo: activeGroup ? (newAssignee || currentUserId) : undefined, // Default to self in group if not selected
      groupId: activeGroup?.id
    };

    setTasks(prev => [newTask, ...prev]);
    
    // Reset Form
    setNewTaskText('');
    setNewDeadline('');
    setNewPriority('medium');
    setNewAssignee('');
    // Keep expanded for rapid entry, but close assignee list
    setShowAssigneeList(false);
    playSuccessSound(); 
    
    // Focus back on input
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

  // --- AI Features ---

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

  const cyclePriority = () => {
      if (newPriority === 'medium') setNewPriority('high');
      else if (newPriority === 'high') setNewPriority('low');
      else setNewPriority('medium');
  };

  // --- Filtering & Sorting ---

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.archived); 

    if (filter === 'active') result = result.filter(t => !t.completed);
    else if (filter === 'completed') result = result.filter(t => t.completed);
    else if (filter === 'assigned_to_me' && activeGroup) result = result.filter(t => t.assignedTo === currentUserId);

    // Sort
    if (sort === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        result.sort((a, b) => (priorityOrder[b.priority || 'medium'] - priorityOrder[a.priority || 'medium']));
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
      return { total, completed, percent: total === 0 ? 0 : Math.round((completed / total) * 100) };
  }, [tasks]);

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {/* Header Area */}
      <div className="px-6 pt-6 pb-4 shrink-0 z-10">
          
          {/* Top Bar: Navigation & Identity */}
          <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                  <button 
                    onClick={onToggleSidebar}
                    className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-500 hover:text-indigo-600 hover:bg-slate-50 transition-colors"
                  >
                      <PanelLeft size={20} />
                  </button>

                  <div 
                    onClick={activeGroup ? onOpenSettings : onOpenProfile}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                      <div className="relative">
                           <div className="w-11 h-11 rounded-full border-2 border-white shadow-md overflow-hidden bg-white group-hover:shadow-lg transition-all">
                               <img 
                                 src={activeGroup ? (activeGroup.avatar || `https://ui-avatars.com/api/?name=${activeGroup.name}`) : (userProfile.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default")} 
                                 alt="Avatar" 
                                 className="w-full h-full object-cover"
                               />
                           </div>
                           <div className={`absolute -bottom-1 -right-1 p-0.5 rounded-full border-2 border-white shadow-sm ${activeGroup ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-white'}`}>
                               {activeGroup ? <Users size={10}/> : <User size={10}/>}
                           </div>
                      </div>
                      
                      <div className="hidden sm:block">
                           <h1 className="text-lg font-black text-slate-800 leading-tight truncate max-w-[150px]">
                               {activeGroup ? activeGroup.name : t.todoHeader}
                           </h1>
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                               {new Date().toLocaleDateString(language, { weekday: 'short', day: 'numeric' })}
                           </span>
                      </div>
                  </div>
              </div>

              <div className="flex gap-2">
                 {activeGroup && (
                     <button onClick={onOpenSettings} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title={t.groupName}>
                        <Settings size={20}/>
                     </button>
                 )}
                 <button onClick={handleArchiveCompleted} className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm text-slate-400 hover:text-indigo-600 hover:bg-slate-50 transition-colors" title={t.clearCompleted}>
                     <Archive size={20}/>
                 </button>
                 <button onClick={() => setSort(s => s === 'priority' ? 'date_new' : 'priority')} className={`p-3 border rounded-xl shadow-sm transition-all ${sort === 'priority' ? 'bg-indigo-50 text-indigo-600 border-indigo-200' : 'bg-white text-slate-400 border-slate-100 hover:text-indigo-600'}`}>
                     <SortAsc size={20}/>
                 </button>
              </div>
          </div>

          {/* Progress Bar (Compact) */}
          <div className="bg-white/60 backdrop-blur-md rounded-2xl p-4 border border-white shadow-sm mb-4">
               <div className="flex justify-between items-end mb-2">
                   <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t.dailyProgress}</span>
                   <span className="text-xl font-black text-indigo-600">{stats.percent}%</span>
               </div>
               <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                   <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.percent}%` }}></div>
               </div>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                  <button 
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filter === f ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}
                  >
                      {t[f]}
                  </button>
              ))}
              {activeGroup && (
                  <button 
                    onClick={() => setFilter('assigned_to_me')} 
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${filter === 'assigned_to_me' ? 'bg-slate-800 text-white shadow-md' : 'bg-white text-slate-500 border border-slate-100'}`}
                  >
                      {t.assigned_to_me}
                  </button>
              )}
          </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-6 pb-48 custom-scrollbar space-y-3">
          {filteredTasks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400 mt-10">
                  <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                      <CheckSquare size={32} className="opacity-20"/>
                  </div>
                  <p className="font-bold text-sm text-slate-300">{t.emptyTasks}</p>
              </div>
          ) : (
              filteredTasks.map((task, index) => (
                  <TaskItem 
                    key={task.id} 
                    task={task} 
                    index={index}
                    onToggle={() => handleToggleTask(task.id)}
                    onEdit={() => setEditingTask(task)}
                    activeGroup={activeGroup}
                  />
              ))
          )}
      </div>

      {/* --- NEW TASK CREATION UI (Modern Bar) --- */}
      
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-[90] transition-opacity duration-300 ${isInputExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { setIsInputExpanded(false); setShowAssigneeList(false); }}
      ></div>

      <div 
        className={`fixed bottom-0 left-0 right-0 z-[100] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${isInputExpanded ? 'translate-y-0' : 'translate-y-0'}`}
      >
          <div className={`mx-auto transition-all duration-300 ${isInputExpanded ? 'max-w-2xl px-4 pb-6' : 'max-w-xl px-4 pb-6 lg:pb-10'}`}>
              <div 
                className={`bg-white shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/50 backdrop-blur-xl transition-all duration-300 overflow-hidden ${
                    isInputExpanded ? 'rounded-[2rem] p-4' : 'rounded-[2rem] p-2 pr-3 flex items-center gap-3 cursor-text hover:shadow-xl'
                }`}
                onClick={() => !isInputExpanded && setIsInputExpanded(true)}
              >
                  {/* Plus Icon (Collapsed Only) */}
                  {!isInputExpanded && (
                      <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
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
                          className={`w-full bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-medium ${isInputExpanded ? 'text-lg px-2 pt-1 pb-3' : 'text-base'}`}
                      />
                      
                      {/* Expanded Tools Row */}
                      {isInputExpanded && (
                          <div className="flex items-center gap-2 mt-2 px-1 overflow-x-auto scrollbar-none pb-1">
                              {/* Date Picker Button */}
                              <div className="relative">
                                  <button className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${newDeadline ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}>
                                      <CalendarClock size={14} />
                                      {newDeadline ? new Date(newDeadline).toLocaleDateString(language, {day: 'numeric', month: 'short'}) : t.deadline}
                                  </button>
                                  <input 
                                      type="datetime-local" 
                                      value={newDeadline}
                                      onChange={(e) => setNewDeadline(e.target.value)}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                  />
                              </div>

                              {/* Priority Button */}
                              <button 
                                onClick={cyclePriority}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                                    newPriority === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                    newPriority === 'low' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                                    'bg-amber-50 text-amber-600 border-amber-100'
                                }`}
                              >
                                  <Flag size={14} fill="currentColor" className="opacity-50" />
                                  {t[newPriority]}
                              </button>

                              {/* Assignee Button (Group Only) */}
                              {activeGroup && (
                                  <button 
                                    onClick={() => setShowAssigneeList(!showAssigneeList)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${newAssignee ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100 hover:bg-slate-100'}`}
                                  >
                                      {newAssignee ? (
                                          <>
                                            <img src={activeGroup.members.find(m => m.id === newAssignee)?.avatar} className="w-4 h-4 rounded-full" alt=""/>
                                            <span className="max-w-[60px] truncate">{activeGroup.members.find(m => m.id === newAssignee)?.name}</span>
                                          </>
                                      ) : (
                                          <>
                                            <User size={14} /> {t.assignTask}
                                          </>
                                      )}
                                  </button>
                              )}
                          </div>
                      )}
                  </div>

                  {/* Send/Add Button */}
                  {isInputExpanded && (
                      <button 
                          onClick={handleAddTask}
                          disabled={!newTaskText.trim()}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-md ${
                              newTaskText.trim() 
                              ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 hover:shadow-indigo-200' 
                              : 'bg-slate-100 text-slate-300 cursor-not-allowed'
                          }`}
                      >
                          <Send size={20} className={newTaskText.trim() ? "ml-0.5" : ""} />
                      </button>
                  )}
              </div>

              {/* Assignee Selection Drawer (Shows below input when active) */}
              {isInputExpanded && showAssigneeList && activeGroup && (
                  <div className="mt-3 bg-white/90 backdrop-blur-xl border border-white rounded-2xl p-3 shadow-xl animate-slide-up overflow-x-auto">
                      <div className="flex gap-3">
                          {activeGroup.members.map(member => (
                              <button 
                                  key={member.id}
                                  onClick={() => { setNewAssignee(newAssignee === member.id ? '' : member.id); setShowAssigneeList(false); }}
                                  className={`flex flex-col items-center gap-1 shrink-0 transition-all ${newAssignee === member.id ? 'opacity-100 scale-105' : 'opacity-60 hover:opacity-100'}`}
                              >
                                  <div className={`w-10 h-10 rounded-full p-0.5 border-2 ${newAssignee === member.id ? 'border-indigo-600' : 'border-transparent'}`}>
                                      <img src={member.avatar} className="w-full h-full rounded-full object-cover bg-slate-100" alt={member.name} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 max-w-[60px] truncate">{member.name}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* Edit Modal (Existing code reused but simplified logic for brevity) */}
      {editingTask && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[85vh] shadow-2xl animate-scale-in flex flex-col overflow-hidden relative">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                    <h2 className="text-xl font-black text-slate-800">{t.editTask}</h2>
                    <div className="flex gap-2">
                        <button onClick={() => handleDeleteTask(editingTask.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-full transition-colors"><Trash2 size={20}/></button>
                        <button onClick={() => setEditingTask(null)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                    {/* Task Text & AI Refine */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.taskContent}</label>
                            <button onClick={handleAiRefine} disabled={isAiProcessing} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-indigo-100 transition-colors">
                                <Sparkles size={10}/> {t.optimizeAi}
                            </button>
                        </div>
                        <textarea 
                            value={editingTask.text}
                            onChange={(e) => setEditingTask({ ...editingTask, text: e.target.value })}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-lg outline-none focus:ring-2 focus:ring-indigo-200 min-h-[100px] resize-none"
                        />
                    </div>

                    {/* Metadata Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.deadline}</label>
                            <div className="relative">
                                <Calendar size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <input 
                                    type="datetime-local"
                                    value={editingTask.deadline || ''}
                                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                                    className="w-full pl-10 pr-3 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-100"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.priority}</label>
                            <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-200">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setEditingTask({ ...editingTask, priority: p })}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${editingTask.priority === p ? getPriorityColor(p) + ' shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {t[p]}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-3">
                         <div className="flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.subtasksHeader}</label>
                                {/* Progress Indicator */}
                                {(editingTask.subtasks?.length || 0) > 0 && (
                                    <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-lg">
                                        <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                            <div 
                                                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                                                style={{ width: `${Math.round((editingTask.subtasks!.filter(s => s.completed).length / editingTask.subtasks!.length) * 100)}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500">
                                            {Math.round((editingTask.subtasks!.filter(s => s.completed).length / editingTask.subtasks!.length) * 100)}%
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button onClick={handleAiSubtasks} disabled={isAiProcessing} className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-fuchsia-100 transition-colors">
                                <Sparkles size={10}/> {t.breakdownAi}
                            </button>
                        </div>
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-2 border border-slate-100">
                             {editingTask.subtasks?.map((st, i) => (
                                 <div key={st.id} className="flex items-center gap-3 group">
                                     <button 
                                        onClick={() => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].completed = !newSt[i].completed;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${st.completed ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-white border-slate-300'}`}
                                     >
                                         {st.completed && <Check size={12}/>}
                                     </button>
                                     <input 
                                        value={st.text}
                                        onChange={(e) => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].text = e.target.value;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`flex-1 bg-transparent text-sm font-medium outline-none ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                     />
                                     <button onClick={() => {
                                         const newSt = editingTask.subtasks?.filter((_, idx) => idx !== i);
                                         setEditingTask({ ...editingTask, subtasks: newSt });
                                     }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><X size={14}/></button>
                                 </div>
                             ))}
                             <button 
                                onClick={() => setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), { id: Date.now(), text: '', completed: false }] })}
                                className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mt-2"
                             >
                                 <Plus size={14}/> {t.add}
                             </button>
                        </div>
                    </div>
                </div>
                
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <button onClick={handleSaveEdit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]">
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

const TaskItem: React.FC<{ 
    task: Task; 
    index: number; 
    onToggle: () => void; 
    onEdit: () => void;
    activeGroup: Group | null;
}> = ({ task, index, onToggle, onEdit, activeGroup }) => {
    const { t } = useLanguage();
    
    // Check deadline status
    const deadlineInfo = useMemo(() => {
        if (!task.deadline) return null;
        const now = new Date();
        const d = new Date(task.deadline);
        const diff = d.getTime() - now.getTime();
        const isOverdue = diff < 0;
        const hoursLeft = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
        const daysLeft = Math.floor(hoursLeft / 24);
        
        let text = '';
        if (isOverdue) text = `${hoursLeft}h overdue`;
        else if (hoursLeft < 24) text = `${hoursLeft}h left`;
        else text = `${daysLeft}d left`;

        return { isOverdue, text, dateStr: d.toLocaleDateString() };
    }, [task.deadline]);

    // Priority Styling
    const priorityColor = task.priority === 'high' ? 'bg-rose-500' : task.priority === 'medium' ? 'bg-amber-500' : 'bg-emerald-500';
    const priorityLight = task.priority === 'high' ? 'bg-rose-50 border-rose-100' : task.priority === 'medium' ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100';

    // Assignee Info
    const assignee = activeGroup && task.assignedTo ? activeGroup.members.find(m => m.id === task.assignedTo) : null;

    return (
        <div 
            onClick={onEdit}
            className={`group relative p-5 rounded-[1.5rem] transition-all duration-300 cursor-pointer mb-3 border transform-gpu animate-slide-up hover:scale-[1.01] active:scale-[0.99]
                ${task.completed 
                    ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' 
                    : `bg-white border-white shadow-sm hover:shadow-lg hover:border-slate-100 ${deadlineInfo?.isOverdue ? 'ring-1 ring-rose-200' : ''}`
                }
            `}
            style={{ animationDelay: `${Math.min(index * 50, 600)}ms`, animationFillMode: 'both' }}
        >
            {/* Priority Indicator Stripe */}
            <div className={`absolute left-0 top-6 bottom-6 w-1.5 rounded-r-full ${priorityColor} opacity-70`}></div>

            <div className="flex items-start gap-4 pl-3">
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className={`w-6 h-6 mt-1 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0 z-10
                        ${task.completed 
                            ? 'bg-indigo-500 border-indigo-500 text-white scale-110' 
                            : 'bg-transparent border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                        }
                    `}
                >
                    {task.completed && <Check size={14} strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        {/* Tags Row */}
                        <div className="flex items-center gap-2">
                            {deadlineInfo && !task.completed && (
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md flex items-center gap-1 border ${deadlineInfo.isOverdue ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                    {deadlineInfo.isOverdue ? <AlertCircle size={10}/> : <Clock size={10}/>}
                                    {deadlineInfo.text}
                                </span>
                            )}
                            
                            {!task.completed && task.priority && (
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md border ${priorityLight} text-slate-600`}>
                                    {task.priority}
                                </span>
                            )}
                        </div>

                        {/* Assignee Avatar (Group Only) */}
                        {assignee && (
                            <div className="flex items-center gap-1.5 pl-2">
                                <img src={assignee.avatar} className="w-5 h-5 rounded-full object-cover border border-white shadow-sm" alt={assignee.name}/>
                                <span className="text-[10px] font-bold text-slate-400 truncate max-w-[60px]">{assignee.name}</span>
                            </div>
                        )}
                    </div>

                    <h3 className={`text-base font-bold leading-snug transition-all ${task.completed ? 'text-slate-400 line-through decoration-2 decoration-slate-300' : 'text-slate-800'}`}>
                        {task.text}
                    </h3>
                    
                    {/* Subtask Progress Bar */}
                    {task.subtasks && task.subtasks.length > 0 && (
                        <div className="mt-3 flex items-center gap-2">
                             <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                 <div 
                                    className={`h-full rounded-full ${task.completed ? 'bg-slate-400' : 'bg-indigo-500'}`} 
                                    style={{ width: `${(task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100}%` }}
                                 ></div>
                             </div>
                             <span className="text-[10px] font-bold text-slate-400">
                                 {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                             </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const getPriorityColor = (p: Priority) => {
    switch(p) {
        case 'high': return 'bg-rose-100 text-rose-700 border-rose-200';
        case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'low': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
};