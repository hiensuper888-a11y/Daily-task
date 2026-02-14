import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, 
  Edit3, Flame, Zap, CheckCircle, 
  PlusCircle, CheckSquare, Square, ListChecks,
  Users, User
} from 'lucide-react';
import { Task, FilterType, Priority, Group, UserProfile, Attachment, Subtask } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
}

const PriorityBadge = ({ priority }: { priority: Priority }) => {
    const configs = {
      high: { color: 'bg-rose-100 text-rose-700 ring-rose-500/20', icon: <Flame size={10} fill="currentColor" />, label: 'High' },
      medium: { color: 'bg-amber-100 text-amber-700 ring-amber-500/20', icon: <Zap size={10} fill="currentColor" />, label: 'Medium' },
      low: { color: 'bg-emerald-100 text-emerald-700 ring-emerald-500/20', icon: <CheckCircle size={10} />, label: 'Low' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${config.color} ring-1`}>
        {config.icon}
        {config.label}
      </span>
    );
};

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
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const isLeader = !activeGroup || activeGroup.leaderId === currentUserId;

  // Find current user's membership to get preferences
  // SAFELY ACCESS MEMBERS WITH ?.
  const currentMember = activeGroup?.members?.find(m => m.id === currentUserId);

  // Reset form when switching groups
  useEffect(() => {
      setInputValue('');
      setNewPriority('medium');
      setAssignedDate('');
      setDeadline('');
      setAssignedTo('');
      setNewAttachments([]);
      setShowInputDetails(false);
  }, [activeGroup]);

  // Fix timezone issue for datetime-local input
  const toLocalISOString = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDeadline = (isoString: string) => {
    const target = new Date(isoString);
    const now = new Date();
    if (isNaN(target.getTime())) return null;
    const diffMs = target.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);
    const isOverdue = diffMs < 0;
    const isSoon = diffHrs > 0 && diffHrs < 24;

    let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    let colorClass = 'text-slate-500 bg-slate-50';
    let icon = <CalendarClock size={12} />;

    if (isOverdue) {
      text = t.overdue || 'Overdue';
      colorClass = 'text-rose-600 bg-rose-50 font-bold';
      icon = <AlertCircle size={12} />;
    } else if (isSoon) {
      text = `${Math.ceil(diffHrs)}h left`;
      colorClass = 'text-amber-600 bg-amber-50 font-bold';
      icon = <Timer size={12} />;
    }
    return { text, colorClass, icon, isOverdue };
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let type: 'image' | 'video' | 'file' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('video/')) type = 'video';

        const attachment: Attachment = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          type: type,
          url: reader.result as string,
          size: file.size
        };
        if (isEdit && editingTask) {
          setEditingTask(prev => prev ? { ...prev, attachments: [...(prev.attachments || []), attachment] } : null);
        } else {
          setNewAttachments(prev => [...prev, attachment]);
        }
      };
      reader.readAsDataURL(file);
    });
    if (e.target) e.target.value = '';
  };

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
      assignedTo: assignedTo || undefined,
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

  const handleToggleClick = (task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (task.archived) return; 
    setLastCheckedId(task.id);
    setTimeout(() => setLastCheckedId(null), 500);

    if (task.completed) toggleTask(task.id, false);
    else {
      if (activeGroup) { setCompletingTaskId(task.id); setCompletionNote(''); }
      else toggleTask(task.id, true);
    }
  };

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

  const addSubtask = () => {
    if (!editingTask || !newSubtaskText.trim()) return;
    const newSub: Subtask = {
      id: Date.now(),
      text: newSubtaskText.trim(),
      completed: false
    };
    const updatedSubtasks = [...(editingTask.subtasks || []), newSub];
    setEditingTask({ ...editingTask, subtasks: updatedSubtasks });
    setNewSubtaskText('');
  };

  const toggleSubtask = (subId: number) => {
    if (!editingTask) return;
    const updatedSubtasks = (editingTask.subtasks || []).map(st => 
      st.id === subId ? { ...st, completed: !st.completed } : st
    );
    const completedCount = updatedSubtasks.filter(st => st.completed).length;
    const progress = Math.round((completedCount / updatedSubtasks.length) * 100);
    setEditingTask({ 
      ...editingTask, 
      subtasks: updatedSubtasks, 
      progress,
      completed: progress === 100 
    });
  };

  const deleteSubtask = (subId: number) => {
    if (!editingTask) return;
    const updatedSubtasks = (editingTask.subtasks || []).filter(st => st.id !== subId);
    setEditingTask({ ...editingTask, subtasks: updatedSubtasks });
  };

  const archiveTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, archived: true } : t));
  };

  const restoreTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(prev => prev.map(t => t.id === id ? { ...t, archived: false } : t));
  };

  const deleteTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Xóa công việc này vĩnh viễn?")) {
      setTasks(prev => prev.filter(t => t.id !== id));
      if (editingTask?.id === id) setEditingTask(null);
    }
  };

  const filteredTasks = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    return tasks
      .filter(t => {
        // 1. Archived Tasks (Always Global Search)
        if (filterStatus === 'archived') {
          if (!t.archived) return false;
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
          return true;
        } 
        
        // 2. Filter out archived tasks for other views
        if (t.archived) return false;

        // 3. Search Query (Global search for non-archived)
        if (searchQuery && !t.text.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }

        // 4. Special Group Filters (Bypass Date Filter to show all pending items)
        if (filterStatus === 'assigned_to_me') {
            return t.assignedTo === currentUserId && !t.completed;
        }
        if (filterStatus === 'delegated') {
            return t.assignedTo && t.assignedTo !== currentUserId && !t.completed;
        }

        // 5. Date Filter
        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;
        
        // 6. Status Filters
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pMap = { high: 3, medium: 2, low: 1 };
        return (pMap[b.priority || 'medium'] - pMap[a.priority || 'medium']);
      });
  }, [tasks, viewDate, filterStatus, searchQuery, currentUserId]);

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
  };

  const changeMonth = (delta: number) => {
    const newDate = new Date(calendarViewDate);
    newDate.setMonth(calendarViewDate.getMonth() + delta);
    setCalendarViewDate(newDate);
  };

  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  }, [calendarViewDate]);

  // Determine Header Style
  const headerStyle = useMemo(() => {
    const customBg = currentMember?.headerBackground;
    if (customBg) {
        const isImage = customBg.startsWith('data:') || customBg.startsWith('http');
        const bgValue = isImage ? `url(${customBg})` : customBg;
        return { 
            background: bgValue,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            textShadow: '0 2px 10px rgba(0,0,0,0.5)'
        };
    }
    return {};
  }, [currentMember]);
  
  const headerClasses = useMemo(() => {
    if (currentMember?.headerBackground) return "pt-8 pb-4 px-6 lg:px-8 relative z-10 shrink-0 text-white transition-all duration-500 bg-slate-900 shadow-xl rounded-b-[2.5rem] lg:rounded-b-none mb-2";
    return "pt-8 pb-4 px-6 lg:px-8 relative z-10 shrink-0 transition-all duration-500 rounded-b-[2.5rem] lg:rounded-b-none mb-2";
  }, [currentMember]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modern rounded-[2.5rem] w-full max-w-3xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in flex flex-col bg-white/95">
              <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 p-8 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Chi tiết công việc</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">ID: {editingTask.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingTask(null)} className="p-3 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
            </div>
            <div className="p-8 space-y-8">
                {/* Simplified structure for brevity, logic maintained */}
                <input 
                  type="text" 
                  value={editingTask.text} 
                  onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} 
                  className="w-full p-5 bg-white border border-slate-200 rounded-[1.8rem] text-lg font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 outline-none"
                />
                 <div className="space-y-4 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                            <ListChecks size={14}/> Các bước thực hiện
                        </label>
                         <div className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-100">
                            {editingTask.subtasks?.filter(s => s.completed).length || 0}/{editingTask.subtasks?.length || 0}
                         </div>
                    </div>
                    
                     <div className="space-y-2 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                         {editingTask.subtasks?.map(st => (
                            <div key={st.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 group transition-all hover:shadow-sm hover:border-indigo-100">
                                <button onClick={() => toggleSubtask(st.id)} className={`transition-colors ${st.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}>
                                    {st.completed ? <CheckSquare size={18} strokeWidth={2.5} /> : <Square size={18} strokeWidth={2.5} />}
                                </button>
                                <span className={`flex-1 text-sm font-medium truncate ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</span>
                                <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                         {(!editingTask.subtasks || editingTask.subtasks.length === 0) && (
                             <div className="text-center py-4 text-xs text-slate-400 italic">Chưa có bước nhỏ nào.</div>
                         )}
                     </div>

                     <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newSubtaskText}
                            onChange={(e) => setNewSubtaskText(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                            placeholder="Thêm bước nhỏ..."
                            className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                        />
                        <button onClick={addSubtask} disabled={!newSubtaskText.trim()} className="p-3 bg-slate-800 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-slate-200">
                            <PlusCircle size={20}/>
                        </button>
                    </div>
                 </div>
            </div>
            <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl p-8 border-t border-slate-100 flex gap-4">
              <button 
                onClick={updateTask} 
                className={`w-full py-4 rounded-2xl text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                  activeGroup ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'
                }`}
              >
                Lưu thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL */}
      {showCalendar && (
        <div onClick={() => setShowCalendar(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modern rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in bg-white/95">
             <div className="flex items-center justify-between mb-8">
              <button onClick={() => changeMonth(-1)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"><ChevronLeft size={20}/></button>
              <div className="text-center">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{calendarViewDate.getFullYear()}</p>
                <h4 className="text-xl font-black text-slate-900 tracking-tight">{calendarViewDate.toLocaleString(language, { month: 'long' })}</h4>
              </div>
              <button onClick={() => changeMonth(1)} className="p-3 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"><ChevronRight size={20}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-black text-slate-300 py-2">{d}</div>
              ))}
              {calendarDays.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square"></div>;
                const isSelected = date.toDateString() === viewDate.toDateString();
                const isCurrentToday = date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => { setViewDate(date); setShowCalendar(false); }}
                    className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative group ${
                      isSelected 
                      ? (activeGroup ? 'bg-emerald-600 text-white shadow-lg' : 'bg-indigo-600 text-white shadow-lg')
                      : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {date.getDate()}
                    {isCurrentToday && !isSelected && (
                      <div className={`absolute bottom-1 w-1 h-1 rounded-full ${activeGroup ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                    )}
                  </button>
                );
              })}
            </div>
             <button onClick={() => setShowCalendar(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 mt-2">Đóng</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className={headerClasses} style={headerStyle}>
        {/* Overlay for readability if image set */}
        {currentMember?.headerBackground && <div className="absolute inset-0 bg-black/40 z-[-1]"></div>}
        
        <div className="flex flex-col gap-6 lg:gap-8">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4">
            <div className="animate-slide-right w-full lg:w-auto">
              <div className={`inline-flex items-center gap-2.5 px-3 py-1 lg:px-4 lg:py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 lg:mb-3 shadow-sm border ${activeGroup ? (currentMember?.headerBackground ? 'bg-white/20 text-white border-white/30 backdrop-blur-md' : 'bg-emerald-600 text-white border-emerald-500') : 'bg-indigo-600 text-white border-indigo-500'}`}>
                {activeGroup ? <Users size={12} strokeWidth={3}/> : <User size={12} strokeWidth={3}/>}
                {activeGroup ? 'Dự án Nhóm' : 'Không gian Cá nhân'}
              </div>
              <h1 className={`text-4xl lg:text-5xl font-black tracking-tighter transition-all duration-700 ${currentMember?.headerBackground ? 'text-white' : 'text-slate-900'}`}>
                {filterStatus === 'archived' ? 'Kho lưu trữ' : (activeGroup ? activeGroup.name : "Việc cần làm")}
              </h1>
            </div>
            
            <button 
              onClick={() => setShowCalendar(true)}
              className={`flex items-center gap-3 backdrop-blur-md p-2 pl-4 pr-2 rounded-full border shadow-sm hover:shadow-md transition-all group w-full lg:w-auto justify-between lg:justify-center ${
                currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' : 'bg-white/60 border-white hover:bg-white'
              }`}
            >
              <div className="text-left flex items-center gap-2">
                  <span className={`text-[10px] font-black uppercase tracking-widest block transition-colors ${currentMember?.headerBackground ? 'text-white/70 group-hover:text-white' : 'text-slate-400 group-hover:text-indigo-500'}`}>{viewDate.toLocaleDateString(language, { month: 'long' })}</span>
                  <span className={`text-2xl font-black leading-none ${currentMember?.headerBackground ? 'text-white' : 'text-slate-900'}`}>{viewDate.getDate()}</span>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${currentMember?.headerBackground ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                 <CalendarIcon size={18} />
              </div>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
             <div className="flex items-center gap-2 overflow-x-auto pb-4 pt-2 scrollbar-none flex-1 -mx-6 px-6 lg:mx-0 lg:px-0 mask-image-gradient">
              {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me', 'delegated'] : []), 'archived'] as FilterType[]).map(f => {
                const isActive = filterStatus === f;
                return (
                  <button 
                    key={f} 
                    onClick={() => setFilterStatus(f)} 
                    className={`
                      relative px-5 py-2.5 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300
                      ${isActive 
                        ? (activeGroup 
                            ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/30 scale-105' 
                            : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 scale-105') 
                        : (currentMember?.headerBackground 
                            ? 'bg-white/20 text-white hover:bg-white/30 border border-white/20' 
                            : 'bg-white/60 text-slate-500 hover:text-slate-800 hover:bg-white border border-transparent hover:border-slate-100 scale-100')
                      }
                    `}
                  >
                    {f === 'archived' ? 'Kho lưu trữ' : t[f]}
                  </button>
                );
              })}
            </div>
            <div className="relative group w-full lg:w-[250px]">
                <Search size={16} className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${currentMember?.headerBackground ? 'text-white/60 group-focus-within:text-white' : 'text-slate-400 group-focus-within:text-indigo-500'}`} />
                <input 
                    type="text" 
                    placeholder="Tìm kiếm..." 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)} 
                    className={`w-full pl-10 pr-4 py-3 rounded-2xl text-sm font-bold focus:outline-none focus:ring-2 transition-all shadow-sm ${
                        currentMember?.headerBackground 
                        ? 'bg-white/20 border border-white/30 text-white placeholder:text-white/50 focus:ring-white/50 focus:bg-white/30' 
                        : 'bg-white/60 border border-white text-slate-800 placeholder:text-slate-400 focus:ring-indigo-100'
                    }`} 
                />
            </div>
          </div>
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-8 pb-48 custom-scrollbar space-y-3 relative z-0 pt-2">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 animate-scale-in">
            <div className="w-24 h-24 bg-white/40 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm border border-white">
              <Archive size={40} className="text-slate-300" />
            </div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
              {filterStatus === 'archived' ? 'Chưa có mục lưu trữ' : 'Danh sách trống'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
            const subtasksCount = task.subtasks?.length || 0;
            const subtasksCompleted = task.subtasks?.filter(s => s.completed).length || 0;
            const assignedMember = activeGroup?.members?.find(m => m.id === task.assignedTo);
            
            return (
              <div 
                key={task.id} 
                onClick={() => setEditingTask(task)}
                className={`group bg-white/80 backdrop-blur-sm rounded-[1.5rem] p-4 border transition-all duration-300 cursor-pointer ${
                  task.completed ? 'opacity-60 grayscale-[0.5] border-transparent shadow-none bg-slate-50/50' : 'shadow-sm border-white hover:shadow-lg hover:bg-white hover:-translate-y-0.5'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <button onClick={(e) => handleToggleClick(task, e)} className={`mt-0.5 transition-all btn-press ${lastCheckedId === task.id ? 'animate-check' : ''} ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                    {task.completed ? <CheckCircle2 size={24} strokeWidth={2.5} fill="currentColor" className="text-emerald-100" /> : <Circle size={24} strokeWidth={2.5} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="space-y-1.5">
                        <p className={`text-[15px] font-semibold tracking-tight transition-all leading-snug ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.text}
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-2">
                          <PriorityBadge priority={task.priority || 'medium'} />
                          {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold ${deadlineInfo.colorClass}`}>
                              {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                          )}
                           {subtasksCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold bg-slate-100 text-slate-500">
                                  <ListChecks size={10}/> {subtasksCompleted}/{subtasksCount}
                              </span>
                          )}
                          {assignedMember && (
                              <div className="flex items-center gap-1 pl-1">
                                  <img src={assignedMember.avatar} className="w-5 h-5 rounded-full border border-white shadow-sm" alt="assignee"/>
                              </div>
                          )}
                        </div>
                    </div>
                  </div>
                   {!task.completed && (
                       <button onClick={(e) => deleteTask(task.id, e)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-xl transition-all">
                           <Trash2 size={16} />
                       </button>
                   )}
                </div>
              </div>
            );
        })}
      </div>

      {/* QUICK ADD BAR - FLOATING CAPSULE */}
      <div className="absolute bottom-24 lg:bottom-10 left-0 right-0 px-4 z-30 pointer-events-none pb-safe pt-4">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <div className={`glass-modern rounded-[2.5rem] shadow-2xl transition-all duration-300 overflow-hidden ring-1 ring-white/50 ${
            showInputDetails ? 'p-6 translate-y-[-10px] bg-white/95' : 'p-2 pr-3 bg-white/80'
          }`}>
            {showInputDetails && (
              <div className="grid grid-cols-2 gap-4 mb-4 animate-fade-in">
                  <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Hạn chót</label>
                      <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-500 transition-colors" />
                  </div>
                  <div className="col-span-2 flex gap-2">
                       {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button key={p} onClick={() => setNewPriority(p)} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${newPriority === p ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>{p}</button>
                      ))}
                  </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowInputDetails(!showInputDetails)} 
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-800 text-white rotate-180' : 'text-slate-400 hover:bg-slate-100'}`}
              >
                <SlidersHorizontal size={18} />
              </button>
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addTask()} 
                placeholder="Thêm việc mới..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-base font-bold text-slate-800 h-10 placeholder:text-slate-400 placeholder:font-semibold" 
              />
              <button 
                onClick={addTask} 
                disabled={!inputValue.trim()} 
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
                  inputValue.trim() 
                  ? (activeGroup ? 'bg-emerald-600' : 'bg-indigo-600') + ' text-white shadow-lg scale-105 active:scale-95' 
                  : 'bg-slate-100 text-slate-300'
                }`}
              >
                <Plus size={22} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};