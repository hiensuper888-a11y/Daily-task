import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, 
  Edit3, CheckSquare, Square, ListChecks,
  PlusCircle, Sun, Moon, Sunrise, Sunset, Users, User,
  Layers, Zap, ArrowRightCircle, Check
} from 'lucide-react';
import { Task, FilterType, Priority, Group, UserProfile, Attachment, Subtask } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
}

const PriorityBadge = React.memo(({ priority }: { priority: Priority }) => {
    const configs = {
      high: { color: 'bg-rose-100 text-rose-700 ring-rose-200', label: 'Cao' },
      medium: { color: 'bg-amber-100 text-amber-700 ring-amber-200', label: 'TB' },
      low: { color: 'bg-emerald-100 text-emerald-700 ring-emerald-200', label: 'Thấp' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ring-1 ${config.color}`}>
        {config.label}
      </span>
    );
});

// MEMOIZED TASK ITEM COMPONENT TO PREVENT RE-RENDERS OF ENTIRE LIST
const TaskItem = React.memo(({ 
  task, 
  index,
  language, 
  activeGroup, 
  lastCheckedId, 
  onToggle, 
  onDelete, 
  onEdit 
}: { 
  task: Task, 
  index: number,
  language: string, 
  activeGroup: Group | null, 
  lastCheckedId: number | null, 
  onToggle: (task: Task, e?: React.MouseEvent) => void,
  onDelete: (id: number, e?: React.MouseEvent) => void,
  onEdit: (task: Task) => void
}) => {
    
    // Helper within item to avoid re-calculating on parent
    const formatDeadline = (isoString: string) => {
        const target = new Date(isoString);
        if (isNaN(target.getTime())) return null;
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        const isOverdue = diffMs < 0;
        const isSoon = diffHrs > 0 && diffHrs < 24;

        let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        let colorClass = 'text-slate-500 bg-slate-100';
        let icon = <CalendarClock size={12} />;

        if (isOverdue) {
            text = 'Quá hạn';
            colorClass = 'text-rose-600 bg-rose-50 font-bold';
            icon = <AlertCircle size={12} />;
        } else if (isSoon) {
            text = `${Math.ceil(diffHrs)}h nữa`;
            colorClass = 'text-amber-600 bg-amber-50 font-bold';
            icon = <Timer size={12} />;
        }
        return { text, colorClass, icon, isOverdue };
    };

    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
    const subtasksCount = task.subtasks?.length || 0;
    const subtasksCompleted = task.subtasks?.filter(s => s.completed).length || 0;
    const assignedMember = activeGroup?.members?.find(m => m.id === task.assignedTo);

    return (
        <div 
            onClick={() => onEdit(task)}
            className={`glass-card group relative px-6 py-5 rounded-[1.8rem] transition-all duration-300 cursor-pointer border border-white/60 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 ${
                task.completed ? 'opacity-60 grayscale-[0.5]' : 'bg-white/80'
            }`}
            style={{ animationDelay: `${Math.min(index * 50, 500)}ms`, animationFillMode: 'both' }}
        >
            <div className="flex items-start gap-4">
                <button onClick={(e) => onToggle(task, e)} className={`mt-0.5 transition-all btn-press duration-300 ${lastCheckedId === task.id ? 'animate-check' : ''} ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                    {task.completed ? <CheckCircle2 size={28} strokeWidth={2.5} fill="currentColor" className="text-emerald-100" /> : <Circle size={28} strokeWidth={2} />}
                </button>
                <div className="flex-1 min-w-0">
                    <p className={`text-[17px] font-bold tracking-tight leading-snug mb-2.5 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{task.text}</p>
                    <div className="flex flex-wrap items-center gap-2">
                        {task.priority !== 'medium' && <PriorityBadge priority={task.priority || 'medium'} />}
                        {deadlineInfo && <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${deadlineInfo.colorClass}`}>{deadlineInfo.icon} {deadlineInfo.text}</span>}
                        {subtasksCount > 0 && <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200"><ListChecks size={10}/> {subtasksCompleted}/{subtasksCount}</span>}
                        {assignedMember && <img src={assignedMember.avatar} className="w-5 h-5 rounded-full border border-white shadow-sm ml-auto ring-1 ring-slate-100" alt="assignee"/>}
                    </div>
                </div>
                {!task.completed && <button onClick={(e) => onDelete(task.id, e)} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-2 text-slate-400 hover:text-rose-500 bg-white/80 backdrop-blur-sm rounded-xl transition-all shadow-sm hover:shadow-md hover:bg-rose-50"><Trash2 size={18} /></button>}
            </div>
        </div>
    );
});

export const TodoList: React.FC<TodoListProps> = ({ activeGroup }) => {
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobal = !!activeGroup;

  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobal);
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'Người dùng', email: '', avatar: '', provider: null, isLoggedIn: false });

  // Creation State
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [assignedDate, setAssignedDate] = useState<string>(''); 
  const [deadline, setDeadline] = useState<string>('');
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(''); 
  const [newAttachments, setNewAttachments] = useState<Attachment[]>([]);

  // Editing State
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  // UI State
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [lastCheckedId, setLastCheckedId] = useState<number | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const isLeader = !activeGroup || activeGroup.leaderId === currentUserId;

  const currentMember = activeGroup?.members?.find(m => m.id === currentUserId);

  useEffect(() => {
      setInputValue('');
      setNewPriority('medium');
      setAssignedDate('');
      setDeadline('');
      setAssignedTo('');
      setNewAttachments([]);
      setShowInputDetails(false);
  }, [activeGroup]);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: "Chào buổi sáng", icon: Sunrise };
    if (hour < 18) return { text: "Chào buổi chiều", icon: Sun };
    return { text: "Chào buổi tối", icon: Moon };
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const addTask = () => {
    if (inputValue.trim() === '') return;
    if (activeGroup && !isLeader) { alert("Chỉ trưởng nhóm mới có thể tạo nhiệm vụ."); return; }
    
    const taskDate = new Date(viewDate);
    if (isToday(viewDate)) {
      const now = new Date();
      taskDate.setHours(now.getHours(), now.getMinutes(), 0);
    }

    const newTask: Task = {
      id: Date.now(),
      text: inputValue.trim(),
      completed: false,
      progress: 0,
      createdAt: assignedDate ? new Date(assignedDate).toISOString() : taskDate.toISOString(),
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      archived: false,
      priority: newPriority,
      groupId: activeGroup?.id,
      assignedTo: assignedTo || undefined, // Set assigned user
      createdBy: currentUserId, // Track creator
      attachments: newAttachments,
      subtasks: [],
      comments: []
    };

    setTasks(prev => [newTask, ...prev]);
    setInputValue('');
    setDeadline('');
    setAssignedDate('');
    setAssignedTo('');
    setNewAttachments([]);
    setShowInputDetails(false);
  };

  const updateTask = () => {
    if (!editingTask) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  // useCallback optimizes these handlers so they don't break memoization of TaskItem
  const handleToggleClick = useCallback((task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (task.archived) return; 
    setLastCheckedId(task.id);
    setTimeout(() => setLastCheckedId(null), 500);

    if (task.completed) {
        // Toggle off immediately
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: false, completedAt: undefined, completedBy: undefined, completionNote: undefined } : t));
    }
    else {
      if (activeGroup) { 
          setCompletingTaskId(task.id); 
          setCompletionNote(''); 
      } else {
          // Toggle on immediately
          setTasks(prev => prev.map(t => {
              if (t.id === task.id) {
                  playSuccessSound();
                  return { ...t, completed: true, completedAt: new Date().toISOString(), completedBy: currentUserId, progress: 100 };
              }
              return t;
          }));
      }
    }
  }, [activeGroup, currentUserId, setTasks]);

  const toggleTask = (id: number, forceState?: boolean, note?: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === id) {
        const newCompleted = forceState !== undefined ? forceState : !task.completed;
        if (newCompleted) playSuccessSound();
        return { 
          ...task, 
          completed: newCompleted, 
          completedAt: newCompleted ? new Date().toISOString() : undefined,
          completedBy: newCompleted ? currentUserId : undefined,
          completionNote: newCompleted ? note : undefined,
          progress: newCompleted ? 100 : task.progress
        };
      }
      return task;
    }));
  };

  const addSubtask = () => { if (!editingTask || !newSubtaskText.trim()) return; const newSub: Subtask = { id: Date.now(), text: newSubtaskText.trim(), completed: false }; const updatedSubtasks = [...(editingTask.subtasks || []), newSub]; setEditingTask({ ...editingTask, subtasks: updatedSubtasks }); setNewSubtaskText(''); };
  const toggleSubtask = (subId: number) => { if (!editingTask) return; const updatedSubtasks = (editingTask.subtasks || []).map(st => st.id === subId ? { ...st, completed: !st.completed } : st); const completedCount = updatedSubtasks.filter(st => st.completed).length; const progress = Math.round((completedCount / updatedSubtasks.length) * 100); setEditingTask({ ...editingTask, subtasks: updatedSubtasks, progress, completed: progress === 100 }); };
  const deleteSubtask = (subId: number) => { if (!editingTask) return; const updatedSubtasks = (editingTask.subtasks || []).filter(st => st.id !== subId); setEditingTask({ ...editingTask, subtasks: updatedSubtasks }); };
  
  const deleteTask = useCallback((id: number, e?: React.MouseEvent) => { 
      if (e) e.stopPropagation(); 
      if (confirm("Xóa công việc này vĩnh viễn?")) { 
          setTasks(prev => prev.filter(t => t.id !== id)); 
          if (editingTask?.id === id) setEditingTask(null); 
      } 
  }, [editingTask, setTasks]);

  const handleEditClick = useCallback((task: Task) => setEditingTask(task), []);

  // --- FILTERING LOGIC ---
  const filteredTasks = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    
    return tasks
      .filter(t => {
        // 1. Archived Filter
        if (filterStatus === 'archived') { 
          if (!t.archived) return false; 
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase()); 
          return true; 
        } 
        if (t.archived) return false;

        // 2. Search Filter
        if (searchQuery && !t.text.toLowerCase().includes(searchQuery.toLowerCase())) { return false; }

        // 3. Assignment Filters (Bypass Date Logic)
        if (filterStatus === 'assigned_to_me') { 
          return t.assignedTo === currentUserId && !t.completed; 
        }
        if (filterStatus === 'delegated') { 
          if (t.createdBy) {
             return t.assignedTo && t.assignedTo !== currentUserId && t.createdBy === currentUserId && !t.completed;
          }
          return t.assignedTo && t.assignedTo !== currentUserId && !t.completed; 
        }

        // 4. Date Filter (For 'all', 'active', 'completed')
        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;
        
        // 5. Status Filter
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (filterStatus === 'assigned_to_me' || filterStatus === 'delegated') {
             if (a.deadline && !b.deadline) return -1;
             if (!a.deadline && b.deadline) return 1;
             if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }
        const pMap = { high: 3, medium: 2, low: 1 };
        return (pMap[b.priority || 'medium'] - pMap[a.priority || 'medium']);
      });
  }, [tasks, viewDate, filterStatus, searchQuery, currentUserId]);

  const changeMonth = (delta: number) => { const newDate = new Date(calendarViewDate); newDate.setMonth(calendarViewDate.getMonth() + delta); setCalendarViewDate(newDate); };
  const calendarDays = useMemo(() => { const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; }, [calendarViewDate]);

  const headerStyle = useMemo(() => {
    const customBg = currentMember?.headerBackground;
    if (customBg) { const isImage = customBg.startsWith('data:') || customBg.startsWith('http'); const bgValue = isImage ? `url(${customBg})` : customBg; return { background: bgValue, backgroundSize: 'cover', backgroundPosition: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }; }
    return {};
  }, [currentMember]);
  
  const headerClasses = useMemo(() => {
    if (currentMember?.headerBackground) return "pt-8 pb-4 px-6 relative z-10 shrink-0 text-white transition-all duration-500 bg-slate-900 shadow-xl rounded-b-[2.5rem] lg:rounded-b-[3rem] mb-2 mx-0 lg:mx-4 mt-0 lg:mt-4";
    return "pt-6 pb-2 px-4 relative z-10 shrink-0 transition-all duration-500 rounded-b-[2.5rem] lg:rounded-b-none mb-2 bg-transparent sticky top-0";
  }, [currentMember]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const filterConfig: Record<FilterType, { icon: any, label: string, colorClass: string, shadowClass: string }> = {
    all: { icon: Layers, label: t.all, colorClass: 'from-slate-700 to-slate-900', shadowClass: 'shadow-slate-500/30' },
    active: { icon: Zap, label: t.active, colorClass: 'from-indigo-500 to-violet-600', shadowClass: 'shadow-indigo-500/30' },
    completed: { icon: CheckCircle2, label: t.completed, colorClass: 'from-emerald-500 to-teal-600', shadowClass: 'shadow-emerald-500/30' },
    assigned_to_me: { icon: User, label: t.assigned_to_me, colorClass: 'from-blue-500 to-cyan-600', shadowClass: 'shadow-blue-500/30' },
    delegated: { icon: ArrowRightCircle, label: t.delegated, colorClass: 'from-orange-500 to-amber-600', shadowClass: 'shadow-orange-500/30' },
    archived: { icon: Archive, label: t.archived, colorClass: 'from-slate-500 to-gray-600', shadowClass: 'shadow-slate-500/30' },
  };

  const activeFilters = ['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me', 'delegated'] : []), 'archived'] as FilterType[];

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-xl animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modern bg-white/95 rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in flex flex-col border border-white/60">
              <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 p-8 flex items-center justify-between border-b border-slate-100 rounded-t-[3rem]">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                        <Edit3 size={28} />
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Chi tiết</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">Chỉnh sửa công việc</p>
                    </div>
                </div>
                <button onClick={() => setEditingTask(null)} className="p-3 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-200 rounded-2xl transition-all"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-8">
                {/* Task Title Input */}
                <div className="group">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">Nội dung công việc</label>
                    <textarea rows={2} value={editingTask.text} onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} className="w-full p-4 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-200 focus:bg-white text-xl font-bold text-slate-800 focus:ring-0 outline-none resize-none placeholder:text-slate-300 transition-all shadow-sm"/>
                </div>
                 
                 {/* Group Assignment Section in Edit Modal */}
                 {activeGroup && (
                    <div className="space-y-3">
                         <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Users size={16}/> Giao công việc</label>
                         <div className="flex flex-wrap gap-2">
                            {activeGroup.members?.map(member => (
                                <button
                                    key={member.id}
                                    onClick={() => setEditingTask({...editingTask, assignedTo: editingTask.assignedTo === member.id ? undefined : member.id})}
                                    className={`flex items-center gap-2 pr-4 pl-1.5 py-1.5 rounded-full border-2 transition-all ${editingTask.assignedTo === member.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 text-slate-600'}`}
                                >
                                    <img src={member.avatar} className="w-7 h-7 rounded-full bg-slate-100 object-cover" alt={member.name}/>
                                    <span className="text-xs font-bold">{member.name}</span>
                                    {editingTask.assignedTo === member.id && <CheckCircle2 size={14} className="ml-1 text-indigo-600"/>}
                                </button>
                            ))}
                         </div>
                    </div>
                 )}

                 {/* Subtasks Section */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><ListChecks size={16}/> Các bước thực hiện</label>
                         <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{editingTask.subtasks?.filter(s => s.completed).length || 0}/{editingTask.subtasks?.length || 0}</div>
                    </div>
                     <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                         {editingTask.subtasks?.map(st => (
                            <div key={st.id} className="flex items-center gap-3 bg-white p-4 rounded-2xl border border-slate-100 group hover:border-indigo-300 hover:shadow-md transition-all">
                                <button onClick={() => toggleSubtask(st.id)} className={`transition-all duration-200 ${st.completed ? 'text-emerald-500 scale-110' : 'text-slate-300 hover:text-emerald-500'}`}>
                                    {st.completed ? <CheckSquare size={22} strokeWidth={2.5} /> : <Square size={22} strokeWidth={2.5} />}
                                </button>
                                <span className={`flex-1 text-sm font-medium ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</span>
                                <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 bg-transparent hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={16} /></button>
                            </div>
                        ))}
                         <div className="flex gap-2 mt-2">
                            <input type="text" value={newSubtaskText} onChange={(e) => setNewSubtaskText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSubtask()} placeholder="Thêm bước nhỏ..." className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-sm"/>
                            <button onClick={addSubtask} disabled={!newSubtaskText.trim()} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-700 disabled:opacity-50 transition-colors shadow-lg shadow-slate-200"><PlusCircle size={22}/></button>
                        </div>
                     </div>
                 </div>
            </div>
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl p-8 border-t border-slate-100 rounded-b-[3rem]">
              <button onClick={updateTask} className="w-full py-4 rounded-2xl text-white font-bold text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce">Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL */}
      {showCalendar && (
        <div onClick={() => setShowCalendar(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-xl animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modern bg-white/95 rounded-[3rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in border border-white/60">
             <div className="flex items-center justify-between mb-8">
              <button onClick={() => changeMonth(-1)} className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"><ChevronLeft size={20}/></button>
              <div className="text-center">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-1">{calendarViewDate.getFullYear()}</p>
                <h4 className="text-xl font-black text-slate-800 tracking-tight">{calendarViewDate.toLocaleString(language, { month: 'long' })}</h4>
              </div>
              <button onClick={() => changeMonth(1)} className="p-3 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-2xl transition-colors"><ChevronRight size={20}/></button>
            </div>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (<div key={i} className="text-center text-[10px] font-bold text-slate-400 py-2">{d}</div>))}
              {calendarDays.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square"></div>;
                const isSelected = date.toDateString() === viewDate.toDateString();
                const isCurrentToday = date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => { setViewDate(date); setShowCalendar(false); }}
                    className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-bold transition-all relative ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'text-slate-700 hover:bg-slate-50'}`}
                  >
                    {date.getDate()}
                    {isCurrentToday && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-indigo-500"></div>}
                  </button>
                );
              })}
            </div>
             <button onClick={() => setShowCalendar(false)} className="w-full py-4 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-colors">Đóng</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className={headerClasses} style={headerStyle}>
        {currentMember?.headerBackground && <div className="absolute inset-0 bg-black/40 z-[-1] rounded-b-[3rem]"></div>}
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-start pt-2">
             <div>
                 <div className="flex items-center gap-2 mb-2 animate-fade-in">
                     <GreetingIcon size={16} className={currentMember?.headerBackground ? 'text-yellow-300' : 'text-orange-500'} />
                     <span className={`text-xs font-bold uppercase tracking-wider ${currentMember?.headerBackground ? 'text-white/80' : 'text-slate-500'}`}>{greeting.text}, {userProfile.name}</span>
                 </div>
                 <h2 className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${currentMember?.headerBackground ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}>
                    {filterStatus === 'archived' ? 'Lưu trữ' : (activeGroup ? activeGroup.name : (isToday(viewDate) ? "Hôm nay" : "Đã chọn"))}
                 </h2>
                 {!activeGroup && !isToday(viewDate) && <p className={`text-sm font-bold mt-1 ${currentMember?.headerBackground ? 'text-white/80' : 'text-indigo-500'}`}>{viewDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
             </div>
             <button onClick={() => setShowCalendar(true)} className={`group p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm ${currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' : 'bg-white border-white text-slate-700 shadow-slate-200'}`}>
               <CalendarIcon size={24} className={currentMember?.headerBackground ? "" : "text-indigo-600"}/>
            </button>
          </div>

          <div className="flex gap-3">
             <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none flex-1 -mx-4 px-4 mask-gradient-x">
              {activeFilters.map(f => {
                const isActive = filterStatus === f;
                const config = filterConfig[f] || filterConfig.all;
                const Icon = config.icon;
                
                return (
                  <button 
                    key={f} 
                    onClick={() => setFilterStatus(f)} 
                    className={`
                        relative px-5 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2 group
                        ${isActive 
                            ? `bg-gradient-to-r ${config.colorClass} text-white shadow-lg ${config.shadowClass} scale-105 ring-2 ring-white/20` 
                            : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-700 hover:shadow-md backdrop-blur-sm'
                        }
                        active:scale-95
                    `}
                  >
                    <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} strokeWidth={2.5} />
                    <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setSearchQuery(searchQuery ? '' : ' ')} className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm ${searchQuery ? 'bg-indigo-100 text-indigo-600' : 'bg-white/60 text-slate-400 hover:bg-white hover:shadow-md'}`}>
                {searchQuery ? <X size={20}/> : <Search size={20} />}
            </button>
          </div>
          
          {searchQuery && (
              <input type="text" autoFocus placeholder="Nhập từ khóa..." value={searchQuery === ' ' ? '' : searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-4 bg-white/80 backdrop-blur-xl rounded-2xl text-sm font-medium outline-none border border-white focus:ring-2 focus:ring-indigo-500 animate-scale-in shadow-lg shadow-indigo-100/50"/>
          )}
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-44 custom-scrollbar space-y-3 relative z-0 pt-4">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300 animate-scale-in">
            <div className="w-24 h-24 bg-white/50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm"><Archive size={40} className="text-slate-300 opacity-50" /></div>
            <p className="text-xs font-black text-slate-300 uppercase tracking-[0.2em]">{filterStatus === 'archived' ? 'Trống' : 'Thảnh thơi!'}</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => (
             <TaskItem 
                key={task.id} 
                task={task} 
                index={index}
                language={language}
                activeGroup={activeGroup}
                lastCheckedId={lastCheckedId}
                onToggle={handleToggleClick}
                onDelete={deleteTask}
                onEdit={handleEditClick}
             />
          ))
        )}
      </div>

      {/* FIXED FLOATING INPUT BAR */}
      <div className="fixed bottom-[85px] lg:bottom-6 left-4 right-4 lg:left-[300px] z-[40]">
          <div className="max-w-4xl mx-auto flex items-end gap-3 p-2 bg-white/90 backdrop-blur-xl border border-white/60 rounded-[2.5rem] shadow-[0_8px_40px_rgba(0,0,0,0.12)] ring-1 ring-white/50 animate-slide-up">
              <button 
                onClick={() => setShowInputDetails(!showInputDetails)} 
                className={`p-4 rounded-full transition-all duration-300 ${showInputDetails ? 'bg-indigo-100 text-indigo-600 rotate-90' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}
              >
                <SlidersHorizontal size={22} />
              </button>
              
              <div className="flex-1 flex flex-col gap-2 py-1.5">
                  {showInputDetails && (
                      <div className="flex flex-col gap-3 animate-slide-up mb-2 px-1">
                          <div className="flex gap-2">
                            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-slate-100 rounded-2xl text-xs px-4 py-3 border-none outline-none focus:ring-2 focus:ring-indigo-500/20 w-full font-medium text-slate-600 shadow-inner" />
                            <div className="flex bg-slate-100 rounded-2xl p-1 shrink-0 shadow-inner">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                                    <button key={p} onClick={() => setNewPriority(p)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase transition-all ${newPriority === p ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}>{p.substring(0,1)}</button>
                                ))}
                            </div>
                          </div>
                          {/* Assignment UI in Creation Bar */}
                          {activeGroup && (
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-2 bg-slate-100 px-2 py-1 rounded-lg">Giao cho:</span>
                                {activeGroup.members?.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => setAssignedTo(assignedTo === member.id ? '' : member.id)}
                                        className={`relative shrink-0 w-9 h-9 rounded-full border-2 transition-all ${assignedTo === member.id ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                    >
                                        <img src={member.avatar} className="w-full h-full rounded-full bg-slate-100 object-cover" alt={member.name}/>
                                        {assignedTo === member.id && <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center"><Check size={8} className="text-white"/></div>}
                                    </button>
                                ))}
                                <button onClick={() => setAssignedTo('')} className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center border-2 border-dashed border-slate-300 text-slate-400 text-[10px] font-bold hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50 transition-colors ${!assignedTo ? 'bg-slate-100 text-slate-600 border-slate-400' : ''}`}>
                                    <User size={14}/>
                                </button>
                            </div>
                          )}
                      </div>
                  )}
                  <input 
                    type="text" 
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addTask()} 
                    placeholder="Thêm việc mới..." 
                    className="w-full bg-transparent border-none px-2 py-1 text-[17px] font-bold text-slate-800 placeholder:text-slate-400/80 focus:ring-0 outline-none" 
                  />
              </div>

              <button 
                onClick={addTask} 
                disabled={!inputValue.trim()} 
                className={`p-4 rounded-full transition-all duration-300 shadow-xl ${inputValue.trim() ? (activeGroup ? 'bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/30 rotate-90 hover:rotate-180' : 'bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-500/30 rotate-90 hover:rotate-180') + ' text-white hover:scale-110 active:scale-95' : 'bg-slate-200 text-slate-300 shadow-none'}`}
              >
                <Plus size={26} strokeWidth={3} />
              </button>
          </div>
      </div>

      {/* GROUP COMPLETION MODAL */}
      {activeGroup && completingTaskId !== null && (
        <div onClick={() => setCompletingTaskId(null)} className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-xl animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modern bg-white/95 rounded-[3rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in border border-white/60">
             <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-sm ring-4 ring-emerald-50"><CheckSquare size={40}/></div>
             <h3 className="text-2xl font-black text-slate-800 mb-2 text-center tracking-tight">Hoàn thành công việc</h3>
             <p className="text-sm font-medium text-slate-500 mb-6 text-center">Thêm ghi chú cho các thành viên khác</p>
             <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} placeholder="Nhập ghi chú..." className="w-full p-5 bg-slate-50/50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-3xl text-sm font-medium outline-none resize-none h-32 mb-6 transition-all shadow-inner" autoFocus />
             <div className="flex gap-4">
                 <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-4 text-slate-500 font-bold text-xs uppercase hover:bg-slate-100 rounded-2xl transition-colors">Bỏ qua</button>
                 <button onClick={() => { if (completingTaskId !== null) { toggleTask(completingTaskId, true, completionNote); setCompletingTaskId(null); }}} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-bold text-xs uppercase shadow-xl shadow-emerald-200 hover:bg-emerald-600 transition-all btn-bounce">Xác nhận</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};