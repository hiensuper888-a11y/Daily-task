import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, User as UserIcon, Users, 
  RotateCcw, Paperclip, Image as ImageIcon, FileText, Video, 
  ExternalLink, Clock, Edit3, Flame, Zap, CheckCircle, Info
} from 'lucide-react';
import { Task, FilterType, Priority, Group, UserProfile, Attachment } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
}

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
  const isLeader = activeGroup?.leaderId === currentUserId;

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
    let colorClass = 'text-slate-400 bg-slate-50 border-slate-100';
    let icon = <CalendarClock size={12} />;

    if (isOverdue) {
      text = t.overdue;
      colorClass = 'text-rose-600 bg-rose-50 border-rose-100 font-bold';
      icon = <AlertCircle size={12} />;
    } else if (isSoon) {
      text = `${Math.ceil(diffHrs)}h còn lại`;
      colorClass = 'text-amber-600 bg-amber-50 border-amber-100 font-bold';
      icon = <Timer size={12} />;
    }
    return { text, colorClass, icon, isOverdue };
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        let type: 'image' | 'video' | 'file' = 'file';
        if (file.type.startsWith('image/')) type = 'image';
        if (file.type.startsWith('video/')) type = 'video';

        const attachment: Attachment = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: type,
          url: reader.result as string,
          size: file.size
        };
        if (isEdit) {
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
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: assignedDate ? new Date(assignedDate).toISOString() : taskDate.toISOString(),
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      archived: false,
      priority: newPriority,
      groupId: activeGroup?.id,
      assignedTo: assignedTo || undefined,
      attachments: newAttachments,
      comments: []
    };

    setTasks([newTask, ...tasks]);
    setInputValue('');
    setDeadline('');
    setAssignedDate('');
    setAssignedTo('');
    setNewAttachments([]);
    setShowInputDetails(false);
  };

  const updateTask = () => {
    if (!editingTask) return;
    setTasks(tasks.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  const archiveTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, archived: true } : t));
  };

  const restoreTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, archived: false } : t));
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
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = forceState !== undefined ? forceState : !task.completed;
        if (newCompleted) playSuccessSound();
        return { 
          ...task, 
          completed: newCompleted, 
          completedAt: newCompleted ? new Date().toISOString() : undefined,
          completedBy: newCompleted ? currentUserId : undefined,
          completionNote: newCompleted ? note : undefined,
          progress: newCompleted ? 100 : 0
        };
      }
      return task;
    }));
  };

  const deleteTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Xóa công việc này vĩnh viễn?")) {
      setTasks(tasks.filter(t => t.id !== id));
      if (editingTask?.id === id) setEditingTask(null);
    }
  };

  const filteredTasks = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    return tasks
      .filter(t => {
        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;

        if (filterStatus === 'archived') {
          return t.archived === true;
        } else {
          if (t.archived) return false;
          if (filterStatus === 'assigned_to_me') return t.assignedTo === currentUserId && !t.completed;
          if (filterStatus === 'active') return !t.completed;
          if (filterStatus === 'completed') return t.completed;
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
          return true;
        }
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const pMap = { high: 3, medium: 2, low: 1 };
        return (pMap[b.priority || 'medium'] - pMap[a.priority || 'medium']);
      });
  }, [tasks, viewDate, filterStatus, searchQuery, currentUserId]);

  const stats = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    const dayTasks = tasks.filter(t => !t.archived && getLocalDateString(new Date(t.createdAt)) === targetDateStr);
    return {
      total: dayTasks.length,
      completed: dayTasks.filter(t => t.completed).length,
      progress: dayTasks.length ? Math.round(dayTasks.reduce((acc, t) => acc + t.progress, 0) / dayTasks.length) : 0
    };
  }, [tasks, viewDate]);

  const PriorityBadge = ({ priority }: { priority: Priority }) => {
    const configs = {
      high: { color: 'bg-rose-50 text-rose-600 border-rose-100', icon: <Flame size={12} />, label: 'Khẩn cấp' },
      medium: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Zap size={12} />, label: 'Quan trọng' },
      low: { color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle size={12} />, label: 'Thông thường' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
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

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-slate-50/30">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in border border-white flex flex-col">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 p-8 pb-4 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 tracking-tight">Chỉnh sửa nhiệm vụ</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">ID: {editingTask.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingTask(null)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Tiêu đề công việc</label>
                <input 
                  type="text" 
                  value={editingTask.text} 
                  onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} 
                  className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.8rem] text-lg font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all outline-none"
                />
              </div>

              {/* Priority & Assignment Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mức độ ưu tiên</label>
                  <div className="flex gap-2">
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button 
                        key={p} 
                        onClick={() => setEditingTask({ ...editingTask, priority: p })} 
                        className={`flex-1 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${
                          editingTask.priority === p 
                          ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                          : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {activeGroup && isLeader && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Giao cho thành viên</label>
                    <select 
                      value={editingTask.assignedTo || ''} 
                      onChange={e => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none outline-none focus:ring-4 focus:ring-indigo-100 transition-all"
                    >
                      <option value="">Cá nhân</option>
                      {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              {/* Precise Date Time Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                    <Clock size={12}/> Ngày bắt đầu (Chính xác)
                  </label>
                  <input 
                    type="datetime-local" 
                    value={editingTask.createdAt ? editingTask.createdAt.slice(0, 16) : ''} 
                    onChange={e => setEditingTask({ ...editingTask, createdAt: new Date(e.target.value).toISOString() })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                    <CalendarClock size={12}/> Hạn chót hoàn thành
                  </label>
                  <input 
                    type="datetime-local" 
                    value={editingTask.deadline ? editingTask.deadline.slice(0, 16) : ''} 
                    onChange={e => setEditingTask({ ...editingTask, deadline: new Date(e.target.value).toISOString() })}
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-100" 
                  />
                </div>
              </div>

              {/* Attachments Area */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Tài liệu đính kèm</label>
                <div className="flex flex-wrap gap-3">
                  {editingTask.attachments?.map(att => (
                    <div key={att.id} className="relative group/att">
                      <div className="w-20 h-20 bg-slate-50 border-2 border-slate-100 rounded-2xl flex items-center justify-center overflow-hidden">
                        {att.type === 'image' ? (
                          <img src={att.url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-300 flex flex-col items-center gap-1">
                            <FileText size={20} />
                            <span className="text-[8px] font-bold max-w-[60px] truncate text-center px-1">{att.name}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => setEditingTask({ ...editingTask, attachments: editingTask.attachments?.filter(a => a.id !== att.id) })}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover/att:opacity-100 transition-all scale-75 group-hover:scale-100"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={() => editFileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all group/add"
                  >
                    <Plus size={24} className="group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] font-black uppercase tracking-widest mt-1">Thêm</span>
                  </button>
                  <input type="file" multiple ref={editFileInputRef} onChange={e => handleFileChange(e, true)} className="hidden" />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl p-8 border-t border-slate-100 flex gap-4">
              <button onClick={() => setEditingTask(null)} className="flex-1 py-4 text-slate-400 font-black text-sm uppercase tracking-widest hover:bg-slate-50 rounded-2xl transition-all">Đóng</button>
              <button 
                onClick={updateTask} 
                className={`flex-[2] py-4 rounded-2xl text-white font-black text-sm uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
                  activeGroup ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-600 shadow-indigo-100'
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[3rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in border border-white">
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
                      : 'text-slate-700 hover:bg-slate-50'
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
            <button onClick={() => { setViewDate(new Date()); setCalendarViewDate(new Date()); setShowCalendar(false); }} className={`w-full py-4 mt-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeGroup ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>Quay lại hôm nay</button>
            <button onClick={() => setShowCalendar(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 mt-2">Đóng</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className="px-8 pt-12 pb-6 relative z-10 shrink-0">
        <div className="flex flex-col gap-8">
          <div className="flex justify-between items-end">
            <div className="animate-slide-right">
              <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-sm border ${activeGroup ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-indigo-600 text-white border-indigo-500'}`}>
                {activeGroup ? <Users size={12} strokeWidth={3}/> : <UserIcon size={12} strokeWidth={3}/>}
                {activeGroup ? 'Dự án Nhóm' : 'Không gian Cá nhân'}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter transition-all duration-700">
                {filterStatus === 'archived' ? 'Kho lưu trữ' : (activeGroup ? activeGroup.name : "Việc cần làm")}
              </h1>
              <div className="flex items-center gap-4 mt-6">
                <div className={`px-4 py-1.5 rounded-xl text-xs font-black transition-colors ${activeGroup ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                   {stats.completed}/{stats.total} đã xong
                </div>
                <div className="h-2 w-40 bg-slate-100 rounded-full overflow-hidden shadow-inner relative group/bar">
                  <div className={`h-full transition-all duration-1000 relative overflow-hidden ${activeGroup ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${stats.progress}%`}}>
                    <div className="absolute inset-0 shimmer opacity-30"></div>
                  </div>
                </div>
                <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{stats.progress}%</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
            <div className="bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center justify-between min-w-[280px]">
              <button onClick={() => navigateDate(-1)} className="p-3 text-slate-300 hover:text-indigo-600 rounded-2xl transition-all active:scale-90"><ChevronLeft size={22} /></button>
              <button onClick={() => { setShowCalendar(true); setCalendarViewDate(new Date(viewDate)); }} className="flex flex-col items-center hover:scale-105 transition-transform group">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5 group-hover:text-indigo-400 transition-colors">{isToday(viewDate) ? "Hôm nay" : viewDate.toLocaleDateString(language, { weekday: 'long' })}</span>
                <span className="text-[15px] font-black text-slate-800 tracking-tight flex items-center gap-2">
                  {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long' })}
                  <CalendarIcon size={14} className="text-indigo-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
              <button onClick={() => navigateDate(1)} className="p-3 text-slate-300 hover:text-indigo-600 rounded-2xl transition-all active:scale-90"><ChevronRight size={22} /></button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
              {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me'] : []), 'archived'] as FilterType[]).map(f => (
                <button key={f} onClick={() => setFilterStatus(f)} className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${filterStatus === f ? (activeGroup ? 'bg-emerald-600 text-white border-emerald-500 shadow-xl' : 'bg-indigo-600 text-white border-indigo-500 shadow-xl') : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200 active:scale-95'}`}>
                  {f === 'archived' ? 'Đã lưu trữ' : t[f]}
                </button>
              ))}
              <div className="relative ml-auto min-w-[200px] group hidden lg:block">
                <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input type="text" placeholder="Tìm kiếm..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-8 pb-48 custom-scrollbar space-y-4">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-200 animate-scale-in">
            <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-50"><Archive size={32} /></div>
            <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">{filterStatus === 'archived' ? 'Kho trống' : 'Không có công việc'}</p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
            const assignedMember = activeGroup?.members.find(m => m.id === task.assignedTo);
            const isNew = Date.now() - new Date(task.createdAt).getTime() < 2000;
            
            return (
              <div 
                key={task.id} 
                onClick={() => setEditingTask(task)}
                className={`group bg-white rounded-[2rem] p-6 border border-slate-100 transition-all duration-300 cursor-pointer ${isNew ? 'animate-task-entry' : ''} ${task.completed ? 'opacity-50 scale-[0.98] border-transparent bg-slate-50/50' : 'hover:border-indigo-100 hover:shadow-xl hover:-translate-y-1'}`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start gap-6">
                  <button 
                    onClick={(e) => handleToggleClick(task, e)} 
                    disabled={task.archived}
                    className={`mt-1 transition-all ${lastCheckedId === task.id ? 'animate-check' : ''} ${task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-indigo-400'} ${task.archived ? 'cursor-not-allowed' : ''}`}
                  >
                    {task.completed ? <CheckCircle2 size={32} /> : <Circle size={32} strokeWidth={2.5} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className={`text-xl font-bold tracking-tight transition-all duration-500 ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.text}
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <PriorityBadge priority={task.priority || 'medium'} />
                          {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border transition-all ${deadlineInfo.colorClass}`}>
                              {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                          )}
                          {task.attachments && task.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
                              <Paperclip size={10} /> {task.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                        {task.archived ? (
                          <button onClick={(e) => { e.stopPropagation(); restoreTask(task.id); }} className="p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all"><RotateCcw size={18} /></button>
                        ) : (
                          <button onClick={(e) => { e.stopPropagation(); archiveTask(task.id); }} className="p-3 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all"><Archive size={18} /></button>
                        )}
                        <button onClick={(e) => deleteTask(task.id, e)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    
                    {assignedMember && (
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                          <img src={assignedMember.avatar} className="w-8 h-8 rounded-xl border-2 border-white shadow-sm" alt={assignedMember.name} />
                          <div className="flex flex-col">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Phân phối cho</span>
                            <span className="text-xs font-bold text-slate-700">{assignedMember.name}</span>
                          </div>
                        </div>
                        <div className="text-[10px] font-bold text-slate-300 flex items-center gap-1.5">
                           <Clock size={10}/> {new Date(task.createdAt).toLocaleTimeString(language, {hour: '2-digit', minute:'2-digit'})}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* QUICK ADD BAR - REFINED */}
      <div className="absolute bottom-10 left-0 right-0 px-8 z-30 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className={`bg-white/95 backdrop-blur-2xl rounded-[2.5rem] border-2 shadow-2xl transition-all duration-500 overflow-hidden ${showInputDetails ? 'p-8 border-indigo-100 translate-y-[-10px]' : 'p-3 border-slate-100/50'}`}>
            {showInputDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Ngày bắt đầu & Giờ (Chính xác)</label>
                  <input 
                    type="datetime-local" 
                    value={assignedDate} 
                    onChange={e => setAssignedDate(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Hạn chót & Giờ (Deadline)</label>
                  <input 
                    type="datetime-local" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold focus:ring-4 focus:ring-indigo-100 transition-all outline-none" 
                  />
                </div>
                
                <div className="col-span-1 md:col-span-2 flex flex-wrap gap-4 items-end">
                  <div className="flex-1 min-w-[200px] space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mức độ ưu tiên</label>
                    <div className="flex gap-2">
                      {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button key={p} onClick={() => setNewPriority(p)} className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border-2 ${newPriority === p ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeGroup && isLeader && (
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Giao việc</label>
                      <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none outline-none focus:ring-4 focus:ring-indigo-100">
                        <option value="">Cá nhân</option>
                        {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                {/* Quick Attachments */}
                <div className="col-span-1 md:col-span-2">
                  <div className="flex flex-wrap gap-2">
                    {newAttachments.map(att => (
                      <div key={att.id} className="relative group/new">
                        <div className="w-12 h-12 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center overflow-hidden">
                          {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover" /> : <FileText size={16} className="text-slate-300"/>}
                        </div>
                        <button onClick={() => setNewAttachments(prev => prev.filter(a => a.id !== att.id))} className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover/new:opacity-100 transition-opacity"><X size={8}/></button>
                      </div>
                    ))}
                    <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-slate-300 hover:border-indigo-400 hover:text-indigo-600 transition-all"><Paperclip size={18}/></button>
                    <input type="file" multiple ref={fileInputRef} onChange={e => handleFileChange(e)} className="hidden" />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowInputDetails(!showInputDetails)} 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-900 text-white rotate-90 shadow-xl' : 'bg-slate-50 text-slate-300 hover:bg-slate-100'}`}
              >
                <SlidersHorizontal size={22} />
              </button>
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addTask()} 
                placeholder="Phím tắt nhanh: Thêm công việc mới..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-bold text-slate-800 h-14" 
              />
              <button 
                onClick={addTask} 
                disabled={!inputValue.trim()} 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                  inputValue.trim() 
                  ? (activeGroup ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200') + ' text-white shadow-xl scale-110 active:scale-95' 
                  : 'bg-slate-100 text-slate-300'
                }`}
              >
                <Plus size={32} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};