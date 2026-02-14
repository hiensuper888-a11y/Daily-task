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
      high: { color: 'bg-rose-100 text-rose-700', label: 'Cao' },
      medium: { color: 'bg-amber-100 text-amber-700', label: 'TB' },
      low: { color: 'bg-emerald-100 text-emerald-700', label: 'Thấp' }
    };
    const config = configs[priority] || configs.medium;
    return (
      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider ${config.color}`}>
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

  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const isLeader = !activeGroup || activeGroup.leaderId === currentUserId;

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
    let colorClass = 'text-slate-400 bg-slate-100';
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
      if (activeGroup) { 
          setCompletingTaskId(task.id); 
          setCompletionNote(''); 
      } else {
          toggleTask(task.id, true);
      }
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

  // Subtask logic preserved (addSubtask, toggleSubtask, deleteSubtask)
  const addSubtask = () => { if (!editingTask || !newSubtaskText.trim()) return; const newSub: Subtask = { id: Date.now(), text: newSubtaskText.trim(), completed: false }; const updatedSubtasks = [...(editingTask.subtasks || []), newSub]; setEditingTask({ ...editingTask, subtasks: updatedSubtasks }); setNewSubtaskText(''); };
  const toggleSubtask = (subId: number) => { if (!editingTask) return; const updatedSubtasks = (editingTask.subtasks || []).map(st => st.id === subId ? { ...st, completed: !st.completed } : st); const completedCount = updatedSubtasks.filter(st => st.completed).length; const progress = Math.round((completedCount / updatedSubtasks.length) * 100); setEditingTask({ ...editingTask, subtasks: updatedSubtasks, progress, completed: progress === 100 }); };
  const deleteSubtask = (subId: number) => { if (!editingTask) return; const updatedSubtasks = (editingTask.subtasks || []).filter(st => st.id !== subId); setEditingTask({ ...editingTask, subtasks: updatedSubtasks }); };
  const deleteTask = (id: number, e?: React.MouseEvent) => { if (e) e.stopPropagation(); if (confirm("Xóa công việc này vĩnh viễn?")) { setTasks(prev => prev.filter(t => t.id !== id)); if (editingTask?.id === id) setEditingTask(null); } };

  const filteredTasks = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    return tasks
      .filter(t => {
        if (filterStatus === 'archived') { if (!t.archived) return false; if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase()); return true; } 
        if (t.archived) return false;
        if (searchQuery && !t.text.toLowerCase().includes(searchQuery.toLowerCase())) { return false; }
        if (filterStatus === 'assigned_to_me') { return t.assignedTo === currentUserId && !t.completed; }
        if (filterStatus === 'delegated') { return t.assignedTo && t.assignedTo !== currentUserId && !t.completed; }
        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;
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

  const changeMonth = (delta: number) => { const newDate = new Date(calendarViewDate); newDate.setMonth(calendarViewDate.getMonth() + delta); setCalendarViewDate(newDate); };
  const calendarDays = useMemo(() => { const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; }, [calendarViewDate]);

  const headerStyle = useMemo(() => {
    const customBg = currentMember?.headerBackground;
    if (customBg) { const isImage = customBg.startsWith('data:') || customBg.startsWith('http'); const bgValue = isImage ? `url(${customBg})` : customBg; return { background: bgValue, backgroundSize: 'cover', backgroundPosition: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }; }
    return {};
  }, [currentMember]);
  
  const headerClasses = useMemo(() => {
    if (currentMember?.headerBackground) return "pt-8 pb-4 px-6 relative z-10 shrink-0 text-white transition-all duration-500 bg-slate-900 shadow-xl rounded-b-[2rem] lg:rounded-b-[2rem] mb-2 mx-0 lg:mx-4 mt-0 lg:mt-4";
    return "pt-6 pb-2 px-4 relative z-10 shrink-0 transition-all duration-500 rounded-b-[2rem] lg:rounded-b-none mb-2";
  }, [currentMember]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#fcfcfc]">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-[2rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in flex flex-col border border-slate-100">
              <div className="sticky top-0 bg-white/95 backdrop-blur-xl z-10 p-6 flex items-center justify-between border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                    <Edit3 size={20} />
                    </div>
                    <div>
                    <h3 className="text-lg font-bold text-slate-800">Chi tiết công việc</h3>
                    </div>
                </div>
                <button onClick={() => setEditingTask(null)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-slate-50 rounded-full"><X size={20}/></button>
            </div>
            <div className="p-6 space-y-6">
                <input 
                  type="text" 
                  value={editingTask.text} 
                  onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 outline-none transition-all"
                />
                 <div className="space-y-4">
                    <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] flex items-center gap-1.5">
                            <ListChecks size={14}/> Các bước thực hiện
                        </label>
                         <div className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                            {editingTask.subtasks?.filter(s => s.completed).length || 0}/{editingTask.subtasks?.length || 0}
                         </div>
                    </div>
                    
                     <div className="space-y-2 max-h-[250px] overflow-y-auto custom-scrollbar">
                         {editingTask.subtasks?.map(st => (
                            <div key={st.id} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                                <button onClick={() => toggleSubtask(st.id)} className={`transition-colors ${st.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}>
                                    {st.completed ? <CheckSquare size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={2.5} />}
                                </button>
                                <span className={`flex-1 text-sm font-medium ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.text}</span>
                                <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-rose-500 bg-transparent hover:bg-rose-50 rounded-lg transition-all">
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                         <div className="flex gap-2 mt-2">
                            <input 
                                type="text" 
                                value={newSubtaskText}
                                onChange={(e) => setNewSubtaskText(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                                placeholder="Thêm bước nhỏ..."
                                className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <button onClick={addSubtask} disabled={!newSubtaskText.trim()} className="p-3 bg-slate-900 text-white rounded-xl hover:bg-slate-700 disabled:opacity-50 transition-colors">
                                <PlusCircle size={20}/>
                            </button>
                        </div>
                     </div>
                 </div>
            </div>
            <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl p-6 border-t border-slate-100">
              <button 
                onClick={updateTask} 
                className={`w-full py-4 rounded-xl text-white font-bold text-sm shadow-xl transition-all active:scale-95 ${
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
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-scale-in border border-slate-100">
             <div className="flex items-center justify-between mb-6">
              <button onClick={() => changeMonth(-1)} className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl"><ChevronLeft size={20}/></button>
              <div className="text-center">
                <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{calendarViewDate.getFullYear()}</p>
                <h4 className="text-lg font-bold text-slate-900">{calendarViewDate.toLocaleString(language, { month: 'long' })}</h4>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-xl"><ChevronRight size={20}/></button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-4">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-[10px] font-bold text-slate-400 py-2">{d}</div>
              ))}
              {calendarDays.map((date, i) => {
                if (!date) return <div key={i} className="aspect-square"></div>;
                const isSelected = date.toDateString() === viewDate.toDateString();
                const isCurrentToday = date.toDateString() === new Date().toDateString();
                return (
                  <button
                    key={i}
                    onClick={() => { setViewDate(date); setShowCalendar(false); }}
                    className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative ${
                      isSelected 
                      ? (activeGroup ? 'bg-emerald-600 text-white shadow-md' : 'bg-indigo-600 text-white shadow-md')
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
             <button onClick={() => setShowCalendar(false)} className="w-full py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors">Đóng</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className={headerClasses} style={headerStyle}>
        {/* Overlay for readability if image set */}
        {currentMember?.headerBackground && <div className="absolute inset-0 bg-black/40 z-[-1] rounded-[inherit]"></div>}
        
        <div className="flex flex-col gap-4">
          <div className="flex justify-between items-end">
             <div>
                 <p className={`text-xs font-bold uppercase tracking-wider mb-1 opacity-70 ${currentMember?.headerBackground ? 'text-white' : 'text-slate-500'}`}>
                    {viewDate.toLocaleDateString(language, { weekday: 'long' })}, {viewDate.getDate()} {viewDate.toLocaleDateString(language, { month: 'long' })}
                 </p>
                 <h2 className={`text-3xl font-black tracking-tighter ${currentMember?.headerBackground ? 'text-white' : 'text-slate-900'}`}>
                    {filterStatus === 'archived' ? 'Lưu trữ' : (activeGroup ? activeGroup.name : "Hôm nay")}
                 </h2>
             </div>
             
             <button 
              onClick={() => setShowCalendar(true)}
              className={`p-2.5 rounded-xl border shadow-sm hover:shadow-md transition-all ${
                currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white hover:bg-white/30' : 'bg-white border-slate-100 text-slate-700 hover:bg-slate-50'
              }`}
            >
               <CalendarIcon size={20} />
            </button>
          </div>

          <div className="flex gap-3">
             <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none flex-1 -mx-4 px-4 mask-gradient-x">
              {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me', 'delegated'] : []), 'archived'] as FilterType[]).map(f => {
                const isActive = filterStatus === f;
                return (
                  <button 
                    key={f} 
                    onClick={() => setFilterStatus(f)} 
                    className={`
                      px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border
                      ${isActive 
                        ? (activeGroup 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                            : 'bg-indigo-600 text-white border-indigo-600 shadow-md') 
                        : (currentMember?.headerBackground 
                            ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' 
                            : 'bg-white text-slate-500 border-slate-100 hover:border-slate-300 hover:text-slate-800')
                      }
                    `}
                  >
                    {f === 'archived' ? 'Kho lưu trữ' : t[f]}
                  </button>
                );
              })}
            </div>
            
            <button 
                onClick={() => setSearchQuery(searchQuery ? '' : ' ')}
                className={`p-2 rounded-full transition-colors ${searchQuery ? 'bg-indigo-100 text-indigo-600' : (currentMember?.headerBackground ? 'bg-white/10 text-white' : 'bg-white text-slate-400')}`}
            >
                {searchQuery ? <X size={18}/> : <Search size={18} />}
            </button>
          </div>
          
          {searchQuery && (
              <input 
                  type="text" 
                  autoFocus
                  placeholder="Nhập từ khóa..." 
                  value={searchQuery === ' ' ? '' : searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-full p-3 bg-white/90 backdrop-blur rounded-xl text-sm font-bold outline-none border border-indigo-100 focus:ring-2 focus:ring-indigo-500 shadow-lg animate-scale-in"
              />
          )}
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-48 custom-scrollbar space-y-3 relative z-0 pt-2">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300 animate-scale-in">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <Archive size={32} className="text-slate-300" />
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {filterStatus === 'archived' ? 'Trống' : 'Thảnh thơi!'}
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
                className={`group relative bg-white p-4 rounded-2xl border transition-all duration-300 cursor-pointer ${
                  task.completed 
                    ? 'opacity-60 border-transparent shadow-none bg-slate-50' 
                    : 'border-slate-100 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-md hover:border-indigo-100 hover:-translate-y-0.5'
                }`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex items-start gap-3.5">
                  <button onClick={(e) => handleToggleClick(task, e)} className={`mt-0.5 transition-all btn-press ${lastCheckedId === task.id ? 'animate-check' : ''} ${task.completed ? 'text-emerald-500' : 'text-slate-300 hover:text-indigo-500'}`}>
                    {task.completed ? <CheckCircle2 size={22} strokeWidth={2.5} fill="currentColor" className="text-emerald-100" /> : <Circle size={22} strokeWidth={2.5} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-[15px] font-semibold tracking-tight leading-snug mb-2 ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                        {task.text}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-2">
                        {task.priority !== 'medium' && <PriorityBadge priority={task.priority || 'medium'} />}
                        
                        {deadlineInfo && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${deadlineInfo.colorClass}`}>
                            {deadlineInfo.icon} {deadlineInfo.text}
                        </span>
                        )}
                        {subtasksCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-50 text-slate-500 border border-slate-100">
                                <ListChecks size={10}/> {subtasksCompleted}/{subtasksCount}
                            </span>
                        )}
                        {assignedMember && (
                            <img src={assignedMember.avatar} className="w-5 h-5 rounded-full border border-white shadow-sm ml-auto" alt="assignee"/>
                        )}
                    </div>
                  </div>
                   {!task.completed && (
                       <button onClick={(e) => deleteTask(task.id, e)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 bg-white/80 rounded-lg transition-all">
                           <Trash2 size={16} />
                       </button>
                   )}
                </div>
              </div>
            );
        })}
      </div>

      {/* FLOATING CAPSULE INPUT (Bottom for mobile thumb reach) */}
      <div className="absolute bottom-24 lg:bottom-8 left-0 right-0 px-4 z-[30] pointer-events-none pb-safe">
        <div className="max-w-xl mx-auto pointer-events-auto">
          <div className={`glass-modern bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl transition-all duration-300 overflow-hidden ring-1 ring-slate-900/5 ${
            showInputDetails ? 'p-5 translate-y-[-10px]' : 'p-1.5 pr-2'
          }`}>
            {showInputDetails && (
              <div className="grid grid-cols-2 gap-3 mb-4 animate-fade-in px-1 pt-1">
                  <div className="col-span-2 space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hạn chót</label>
                      <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-bold outline-none border border-slate-200 focus:border-indigo-500 transition-colors" />
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
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:bg-slate-50'}`}
              >
                <SlidersHorizontal size={20} />
              </button>
              <input 
                type="text" 
                value={inputValue} 
                onChange={e => setInputValue(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && addTask()} 
                placeholder="Thêm việc mới..." 
                className="flex-1 bg-transparent border-none px-2 py-3 text-[16px] font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium focus:outline-none transition-all" 
              />
              <button 
                onClick={addTask} 
                disabled={!inputValue.trim()} 
                className={`w-12 h-12 rounded-[1.2rem] flex items-center justify-center transition-all shadow-md ${
                  inputValue.trim() 
                  ? (activeGroup ? 'bg-emerald-600' : 'bg-indigo-600') + ' text-white scale-100 hover:scale-105 active:scale-95 shadow-indigo-200' 
                  : 'bg-slate-100 text-slate-300 scale-95 shadow-none'
                }`}
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* GROUP COMPLETION MODAL */}
      {activeGroup && completingTaskId !== null && (
        <div onClick={() => setCompletingTaskId(null)} className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-[2rem] p-6 w-full max-w-sm shadow-2xl animate-scale-in border border-slate-100">
             <h3 className="text-lg font-bold text-slate-800 mb-2 text-center">Hoàn thành công việc</h3>
             <p className="text-xs font-medium text-slate-500 mb-4 text-center">Thêm ghi chú cho các thành viên khác (tùy chọn)</p>
             
             <textarea 
                value={completionNote}
                onChange={(e) => setCompletionNote(e.target.value)}
                placeholder="Ví dụ: Đã gửi email, đang chờ phản hồi..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none resize-none h-28 mb-4 transition-all"
                autoFocus
             />
             
             <div className="flex gap-3">
                 <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-3 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 rounded-xl transition-colors">Bỏ qua</button>
                 <button 
                    onClick={() => {
                        if (completingTaskId !== null) {
                            toggleTask(completingTaskId, true, completionNote);
                            setCompletingTaskId(null);
                        }
                    }} 
                    className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-colors"
                 >
                    Xác nhận
                 </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};