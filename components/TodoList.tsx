import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, User as UserIcon, Users, 
  RotateCcw, Paperclip, Image as ImageIcon, FileText, Video, 
  ExternalLink, Clock, Edit3, Flame, Zap, CheckCircle, Info, ArrowUpRight
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
  const isLeader = !activeGroup || activeGroup.leaderId === currentUserId;

  // Hàm chuyển đổi an toàn cho input datetime-local
  const toLocalISOString = (date: Date) => {
    if (!date || isNaN(date.getTime())) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
    let colorClass = 'text-slate-400 bg-slate-50 border-slate-100';
    let icon = <CalendarClock size={12} />;

    if (isOverdue) {
      text = t.overdue || 'Quá hạn';
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

  const archiveTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(tasks.map(t => t.id === id ? { ...t, archived: true } : t));
  };

  const restoreTask = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setTasks(tasks.map(t => t.id === id ? { ...t, archived: false } : t));
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
        // Nếu bộ lọc là Archive, bỏ qua kiểm tra ngày
        if (filterStatus === 'archived') {
          if (!t.archived) return false;
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
          return true;
        } 

        // Các bộ lọc khác đều phải đúng ngày
        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;
        if (t.archived) return false;
        
        if (filterStatus === 'assigned_to_me') return t.assignedTo === currentUserId && !t.completed;
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
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
      progress: dayTasks.length ? Math.round(dayTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / dayTasks.length) : 0
    };
  }, [tasks, viewDate]);

  const PriorityBadge = ({ priority }: { priority: Priority }) => {
    const configs = {
      high: { color: 'bg-rose-50 text-rose-600 border-rose-100', icon: <Flame size={12} />, label: 'Quan trọng' },
      medium: { color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Zap size={12} />, label: 'Cần thiết' },
      low: { color: 'bg-slate-50 text-slate-500 border-slate-100', icon: <CheckCircle size={12} />, label: 'Bình thường' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border ${config.color} transition-all`}>
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
    <div className="flex flex-col h-full relative overflow-hidden bg-white/50">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in border border-white flex flex-col">
            <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 p-8 pb-4 flex items-center justify-between border-b border-slate-50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                  <Edit3 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Chi tiết công việc</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">ID: {editingTask.id}</p>
                </div>
              </div>
              <button onClick={() => setEditingTask(null)} className="p-3 text-slate-300 hover:text-slate-900 transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Tiêu đề nhiệm vụ</label>
                <input 
                  type="text" 
                  value={editingTask.text} 
                  onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} 
                  className="w-full p-5 bg-slate-50/50 border border-slate-100 rounded-[1.8rem] text-lg font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100/50 focus:border-indigo-400 focus:bg-white transition-all outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Độ ưu tiên</label>
                  <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                    {(['low', 'medium', 'high'] as Priority[]).map(p => (
                      <button 
                        key={p} 
                        onClick={() => setEditingTask({ ...editingTask, priority: p })} 
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          editingTask.priority === p 
                          ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' 
                          : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                {activeGroup && isLeader && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Giao việc cho</label>
                    <select 
                      value={editingTask.assignedTo || ''} 
                      onChange={e => setEditingTask({ ...editingTask, assignedTo: e.target.value })}
                      className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-[1.2rem] text-[13px] font-bold appearance-none outline-none focus:bg-white focus:border-indigo-400 transition-all"
                    >
                      <option value="">Cá nhân</option>
                      {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                    <Clock size={12}/> Ngày phân phối
                  </label>
                  <input 
                    type="datetime-local" 
                    value={toLocalISOString(new Date(editingTask.createdAt))} 
                    onChange={e => setEditingTask({ ...editingTask, createdAt: e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString() })}
                    className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-[1.2rem] text-xs font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1 flex items-center gap-2">
                    <CalendarClock size={12}/> Hạn chót hoàn thành
                  </label>
                  <input 
                    type="datetime-local" 
                    value={editingTask.deadline ? toLocalISOString(new Date(editingTask.deadline)) : ''} 
                    onChange={e => setEditingTask({ ...editingTask, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="w-full p-4 bg-slate-50/50 border border-slate-100 rounded-[1.2rem] text-xs font-bold outline-none focus:bg-white focus:border-indigo-400 transition-all" 
                  />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white/90 backdrop-blur-xl p-8 border-t border-slate-100 flex gap-4">
              <button onClick={() => setEditingTask(null)} className="flex-1 py-4 text-slate-400 font-black text-[11px] uppercase tracking-[0.2em] hover:bg-slate-50 rounded-2xl transition-all">Đóng</button>
              <button 
                onClick={updateTask} 
                className={`flex-[2] py-4 rounded-2xl text-white font-black text-[11px] uppercase tracking-[0.2em] shadow-xl transition-all active:scale-95 ${
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
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
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

      {completingTaskId && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-scale-in border border-slate-100">
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Báo cáo hoàn thành</h3>
                  <p className="text-slate-400 text-sm mb-8 font-medium">Bạn đã hoàn thành nhiệm vụ này? Hãy để lại ghi chú nếu cần.</p>
                  <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} placeholder="Mô tả ngắn gọn kết quả..." className="w-full h-36 p-5 bg-slate-50 border border-slate-200 rounded-3xl mb-8 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all text-sm font-medium resize-none" />
                  <div className="flex gap-4">
                      <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-4 text-slate-400 font-black text-sm hover:bg-slate-50 rounded-2xl">Hủy</button>
                      <button onClick={() => { toggleTask(completingTaskId, true, completionNote); setCompletingTaskId(null); }} className="flex-[2] py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all uppercase tracking-widest">Hoàn tất</button>
                  </div>
              </div>
          </div>
      )}

      {/* Header Area */}
      <div className="px-8 pt-10 pb-8 relative z-10 shrink-0">
        <div className="flex flex-col gap-10">
          <div className="flex justify-between items-end">
            <div className="animate-slide-right">
              <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-5 shadow-sm border ${activeGroup ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-indigo-600 text-white border-indigo-500'}`}>
                {activeGroup ? <Users size={12} strokeWidth={3}/> : <UserIcon size={12} strokeWidth={3}/>}
                {activeGroup ? 'Dự án Nhóm' : 'Không gian Cá nhân'}
              </div>
              <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter transition-all duration-700">
                {filterStatus === 'archived' ? 'Kho lưu trữ' : (activeGroup ? activeGroup.name : "Việc cần làm")}
              </h1>
              {filterStatus !== 'archived' && (
                <div className="flex items-center gap-5 mt-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Tiến độ ngày</span>
                    <div className="flex items-center gap-4">
                       <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">{stats.progress}%</span>
                       <div className="h-2.5 w-40 md:w-56 bg-slate-100 rounded-full overflow-hidden shadow-inner relative ring-4 ring-slate-50">
                        <div className={`h-full transition-all duration-1000 relative overflow-hidden ${activeGroup ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${stats.progress}%`}}>
                          <div className="absolute inset-0 shimmer opacity-30"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-px h-10 bg-slate-100 mx-1"></div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Số lượng</span>
                    <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">{stats.completed}<span className="text-slate-200 mx-1">/</span>{stats.total}</span>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setShowCalendar(true)}
              className="hidden lg:flex flex-col items-center bg-white p-4 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
            >
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 group-hover:text-indigo-500 transition-colors">{viewDate.toLocaleDateString(language, { month: 'short' })}</span>
              <span className="text-3xl font-black text-slate-900 leading-none">{viewDate.getDate()}</span>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
            <div className="bg-white/60 p-1.5 rounded-[1.8rem] shadow-sm border border-slate-100 flex items-center justify-between min-w-[280px]">
              <button onClick={() => navigateDate(-1)} className="p-3 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all active:scale-90"><ChevronLeft size={20} /></button>
              <button onClick={() => { setShowCalendar(true); setCalendarViewDate(new Date(viewDate)); }} className="flex flex-col items-center transition-transform active:scale-95 group">
                <span className="text-[14px] font-black text-slate-800 tracking-tight flex items-center gap-2">
                  {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long' })}
                  <CalendarIcon size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                </span>
              </button>
              <button onClick={() => navigateDate(1)} className="p-3 text-slate-400 hover:text-indigo-600 rounded-2xl transition-all active:scale-90"><ChevronRight size={20} /></button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
              {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me'] : []), 'archived'] as FilterType[]).map(f => (
                <button 
                  key={f} 
                  onClick={() => setFilterStatus(f)} 
                  className={`px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${
                    filterStatus === f 
                    ? (activeGroup ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg' : 'bg-indigo-600 text-white border-indigo-500 shadow-lg') 
                    : 'bg-white/40 text-slate-400 border-transparent hover:border-slate-200'
                  }`}
                >
                  {f === 'archived' ? 'Kho lưu trữ' : t[f]}
                </button>
              ))}
              <div className="relative ml-auto min-w-[220px] group hidden lg:block">
                <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                <input type="text" placeholder="Tìm kiếm công việc..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white/60 border border-slate-100 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-indigo-100/30 focus:bg-white transition-all shadow-sm" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-8 pb-48 custom-scrollbar space-y-4 relative z-0">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-200 animate-scale-in">
            <div className="w-24 h-24 bg-white/60 rounded-[2.5rem] flex items-center justify-center mb-6 shadow-sm border border-slate-100 group">
              <Archive size={36} className="group-hover:scale-110 transition-transform duration-500 text-slate-300" />
            </div>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
              {filterStatus === 'archived' ? 'Chưa có mục lưu trữ' : 'Danh sách trống'}
            </p>
          </div>
        ) : (
          filteredTasks.map((task, index) => {
            const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
            const assignedMember = activeGroup?.members.find(m => m.id === task.assignedTo);
            const isNew = Date.now() - new Date(task.createdAt).getTime() < 3000;
            
            return (
              <div 
                key={task.id} 
                onClick={() => setEditingTask(task)}
                className={`group bg-white rounded-[2rem] p-6 border-2 transition-all duration-300 cursor-pointer ${
                  isNew ? 'animate-task-entry border-indigo-100 shadow-xl' : 'border-transparent'
                } ${task.completed ? 'opacity-40 scale-[0.98] grayscale-[0.3]' : 'shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-100'}`}
                style={{ animationDelay: `${index * 40}ms` }}
              >
                <div className="flex items-start gap-6">
                  <button 
                    onClick={(e) => handleToggleClick(task, e)} 
                    disabled={task.archived}
                    className={`mt-1 transition-all active:scale-90 ${lastCheckedId === task.id ? 'animate-check' : ''} ${task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-indigo-400'} ${task.archived ? 'opacity-30 cursor-not-allowed' : ''}`}
                  >
                    {task.completed ? <CheckCircle2 size={36} strokeWidth={2} /> : <Circle size={36} strokeWidth={2.5} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <p className={`text-xl font-bold tracking-tight transition-all duration-500 ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                          {task.text}
                        </p>
                        <div className="flex flex-wrap items-center gap-2.5 mt-2">
                          <PriorityBadge priority={task.priority || 'medium'} />
                          {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold border transition-all ${deadlineInfo.colorClass}`}>
                              {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                          )}
                          {task.attachments && task.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold bg-slate-50 text-slate-400 border border-slate-100">
                              <Paperclip size={10} /> {task.attachments.length} tài liệu
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-3 group-hover:translate-x-0">
                        {task.archived ? (
                          <button onClick={(e) => restoreTask(task.id, e)} className="p-3 text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all" title="Phục hồi"><RotateCcw size={18} /></button>
                        ) : (
                          <button onClick={(e) => archiveTask(task.id, e)} className="p-3 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-2xl transition-all" title="Lưu trữ"><Archive size={18} /></button>
                        )}
                        <button onClick={(e) => deleteTask(task.id, e)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all" title="Xóa vĩnh viễn"><Trash2 size={18} /></button>
                      </div>
                    </div>
                    
                    {assignedMember && (
                      <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-50">
                        <div className="flex items-center gap-3">
                          <img src={assignedMember.avatar} className="w-8 h-8 rounded-xl border-2 border-white shadow-sm ring-1 ring-slate-100" alt={assignedMember.name} />
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-0.5">Phân phối cho</span>
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

      {/* QUICK ADD BAR */}
      <div className="absolute bottom-10 left-0 right-0 px-8 z-30 pointer-events-none">
        <div className="max-w-4xl mx-auto pointer-events-auto">
          <div className={`bg-white/95 backdrop-blur-3xl rounded-[2.8rem] border shadow-2xl transition-all duration-500 overflow-hidden ${
            showInputDetails ? 'p-8 border-indigo-200 translate-y-[-10px]' : 'p-3 border-slate-200/50'
          }`}>
            {showInputDetails && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 animate-fade-in">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Ngày bắt đầu</label>
                  <input 
                    type="datetime-local" 
                    value={assignedDate} 
                    onChange={e => setAssignedDate(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all outline-none" 
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Hạn chót</label>
                  <input 
                    type="datetime-local" 
                    value={deadline} 
                    onChange={e => setDeadline(e.target.value)} 
                    className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all outline-none" 
                  />
                </div>
                
                <div className="col-span-1 md:col-span-2 flex flex-wrap gap-5 items-end">
                  <div className="flex-1 min-w-[180px] space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mức độ ưu tiên</label>
                    <div className="flex gap-2 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                      {(['low', 'medium', 'high'] as Priority[]).map(p => (
                        <button key={p} onClick={() => setNewPriority(p)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                          newPriority === p ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-400'
                        }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {activeGroup && isLeader && (
                    <div className="flex-1 min-w-[180px] space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Giao cho</label>
                      <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold appearance-none outline-none focus:bg-white transition-all">
                        <option value="">Cá nhân</option>
                        {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowInputDetails(!showInputDetails)} 
                className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-900 text-white rotate-90 shadow-xl' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
              >
                <SlidersHorizontal size={22} />
              </button>
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addTask()} 
                placeholder="Nhập nội dung công việc..." 
                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-bold text-slate-800 h-14 placeholder:text-slate-300" 
              />
              <button 
                onClick={addTask} 
                disabled={!inputValue.trim()} 
                className={`w-14 h-14 rounded-[1.5rem] flex items-center justify-center transition-all ${
                  inputValue.trim() 
                  ? (activeGroup ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200') + ' text-white shadow-2xl scale-110 active:scale-95' 
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