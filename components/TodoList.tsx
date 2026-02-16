import React, { useState, useMemo } from 'react';
import { 
  Check, Trash2, Plus, Calendar, User, CheckSquare, 
  X, SortAsc, Archive, Sparkles
} from 'lucide-react';
import { Task, Subtask, Group, Priority, SortOption, FilterType } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { generateSubtasksWithGemini, refineTaskTextWithGemini } from '../services/geminiService';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({ activeGroup, onOpenSettings, onOpenProfile }) => {
  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  
  // Storage key depends on whether we are in a group or personal mode
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup; 
  
  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);
  
  const [newTaskText, setNewTaskText] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('manual'); 
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);

  // --- Actions ---

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskText.trim()) return;

    const newTask: Task = {
      id: Date.now(),
      text: newTaskText,
      completed: false,
      progress: 0,
      createdAt: new Date().toISOString(),
      priority: 'medium',
      subtasks: [],
      createdBy: currentUserId,
      assignedTo: activeGroup ? currentUserId : undefined, 
      groupId: activeGroup?.id
    };

    setTasks(prev => [newTask, ...prev]);
    setNewTaskText('');
    playSuccessSound(); 
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
      <div className="px-6 pt-6 pb-2 shrink-0 z-10">
          <div className="flex justify-between items-start mb-4">
              <div>
                  <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                      {t.todoHeader}
                      {activeGroup && <span className="px-2 py-1 rounded-lg bg-indigo-100 text-indigo-700 text-xs font-bold tracking-wider uppercase">Group</span>}
                  </h1>
                  <p className="text-slate-400 font-bold text-sm mt-1">{new Date().toLocaleDateString(language, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-2">
                   <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 font-bold text-xs cursor-pointer hover:bg-slate-50 transition-colors" onClick={onOpenProfile}>
                        <User size={18}/>
                   </div>
              </div>
          </div>

          {/* Progress Card */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-[2rem] p-6 shadow-xl shadow-indigo-200 text-white relative overflow-hidden mb-6">
               <div className="absolute top-0 right-0 p-12 bg-white opacity-10 rounded-full blur-2xl -translate-y-6 translate-x-6"></div>
               <div className="relative z-10 flex justify-between items-end">
                   <div>
                       <p className="text-indigo-100 font-bold text-xs uppercase tracking-widest mb-1">{t.dailyProgress}</p>
                       <h2 className="text-4xl font-black">{stats.percent}%</h2>
                   </div>
                   <div className="text-right">
                       <p className="text-indigo-100 font-medium text-sm">{stats.completed}/{stats.total} {t.items}</p>
                       <p className="text-white font-bold text-sm">{stats.percent === 100 ? t.greatJob : t.keepGoing}</p>
                   </div>
               </div>
               <div className="mt-4 h-2 bg-black/20 rounded-full overflow-hidden backdrop-blur-sm">
                   <div className="h-full bg-white rounded-full transition-all duration-1000 ease-out" style={{ width: `${stats.percent}%` }}></div>
               </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none">
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100 shrink-0">
                  {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                      <button 
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === f ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                      >
                          {t[f]}
                      </button>
                  ))}
                  {activeGroup && (
                      <button 
                        onClick={() => setFilter('assigned_to_me')} 
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${filter === 'assigned_to_me' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                      >
                          {t.assigned_to_me}
                      </button>
                  )}
              </div>

              <div className="ml-auto flex gap-2">
                 <button onClick={handleArchiveCompleted} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 border border-slate-100 shadow-sm" title={t.clearCompleted}>
                     <Archive size={18}/>
                 </button>
                 <button onClick={() => setSort(s => s === 'priority' ? 'date_new' : 'priority')} className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 border border-slate-100 shadow-sm">
                     <SortAsc size={18}/>
                 </button>
              </div>
          </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto px-6 pb-32 custom-scrollbar">
          {filteredTasks.length === 0 ? (
              <div className="h-40 flex flex-col items-center justify-center text-slate-400">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <CheckSquare size={24} className="opacity-30"/>
                  </div>
                  <p className="font-bold text-sm">{t.emptyTasks}</p>
              </div>
          ) : (
              <div className="space-y-4">
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

      {/* Quick Add Input (Floating) */}
      <div className="fixed bottom-[90px] lg:bottom-6 left-4 right-4 lg:left-[300px] z-[40] pb-safe flex justify-center pointer-events-none">
          <div className="w-full max-w-2xl bg-white/90 backdrop-blur-2xl rounded-[2rem] p-2 pl-3 shadow-premium ring-1 ring-white/60 animate-slide-up flex items-center gap-2 pointer-events-auto">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Plus size={20} />
                </div>
                <input
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
                    placeholder={t.addTaskPlaceholder}
                    className="flex-1 bg-transparent border-none px-2 py-3 text-[16px] font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 outline-none"
                />
                <button 
                    onClick={() => handleAddTask()}
                    disabled={!newTaskText.trim()}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 shadow-lg ${
                        !newTaskText.trim()
                        ? 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
                        : 'bg-slate-900 text-white hover:scale-110 active:scale-95'
                    }`}
                >
                    <Plus size={24} />
                </button>
          </div>
      </div>

      {/* Edit Modal */}
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
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.subtasksHeader}</label>
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
        const hoursLeft = Math.floor(diff / (1000 * 60 * 60));
        
        return { isOverdue, hoursLeft };
    }, [task.deadline]);

    return (
        <div 
            onClick={onEdit}
            className={`group relative p-5 rounded-[1.5rem] transition-all duration-300 cursor-pointer mb-3 border transform-gpu animate-slide-up hover:scale-[1.01] active:scale-[0.99]
                ${task.completed 
                    ? 'bg-slate-50 border-slate-100 opacity-60 grayscale' 
                    : `bg-white border-white shadow-sm hover:shadow-lg ${deadlineInfo?.isOverdue ? 'ring-2 ring-rose-100' : ''}`
                }
            `}
            style={{ animationDelay: `${Math.min(index * 50, 600)}ms`, animationFillMode: 'both' }}
        >
            <div className="flex items-start gap-4">
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className={`w-6 h-6 mt-1 rounded-full border-2 flex items-center justify-center transition-all duration-300 shrink-0
                        ${task.completed 
                            ? 'bg-indigo-500 border-indigo-500 text-white scale-110' 
                            : 'bg-transparent border-slate-300 hover:border-indigo-400 hover:bg-indigo-50'
                        }
                    `}
                >
                    {task.completed && <Check size={14} strokeWidth={3} />}
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        {task.priority === 'high' && <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>}
                        {task.priority === 'medium' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>}
                        {task.priority === 'low' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
                        
                        {deadlineInfo && !task.completed && (
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-md ${deadlineInfo.isOverdue ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>
                                {deadlineInfo.isOverdue ? t.overdue : `${deadlineInfo.hoursLeft}h`}
                            </span>
                        )}
                        
                        {activeGroup && task.assignedTo && (
                            <div className="ml-auto flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-full">
                                <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">
                                    {activeGroup.members.find(m => m.id === task.assignedTo)?.name || 'Unknown'}
                                </span>
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
        case 'high': return 'bg-rose-100 text-rose-700';
        case 'medium': return 'bg-amber-100 text-amber-700';
        case 'low': return 'bg-emerald-100 text-emerald-700';
        default: return 'bg-slate-100 text-slate-600';
    }
};