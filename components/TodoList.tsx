import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer, Edit2, Save, XCircle, Calculator, ListChecks, GripVertical, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Play, Pause, User as UserIcon, MessageSquare, Paperclip, FileText, Image as ImageIcon, Video, Send, Download, Eye, Users, Calendar } from 'lucide-react';
import { Task, FilterType, Priority, Subtask, Group, UserProfile, Attachment, Comment } from '../types';
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

  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  const [assignedDate, setAssignedDate] = useState<string>(''); 
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(''); 

  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created'>('priority');
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  
  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const isLeader = activeGroup?.leaderId === currentUserId;

  const toLocalISOString = (date: Date) => {
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().slice(0, 16);
  };

  const formatDeadline = (isoString: string) => {
      const target = new Date(isoString);
      const now = new Date();
      if(isNaN(target.getTime())) return null;
      const diffMs = target.getTime() - now.getTime();
      const diffHrs = diffMs / (1000 * 60 * 60);
      const isOverdue = diffMs < 0;
      const isSoon = diffHrs > 0 && diffHrs < 24;

      let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
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

  const addTask = () => {
    if (inputValue.trim() === '') return;
    if (activeGroup && !isLeader) { alert("Chỉ trưởng nhóm mới có thể tạo nhiệm vụ."); return; }
    
    const createdDateStr = assignedDate ? new Date(assignedDate).toISOString() : new Date(viewDate).toISOString();

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: createdDateStr,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      estimatedTime: estimatedTime,
      archived: false,
      priority: newPriority,
      groupId: activeGroup?.id,
      assignedTo: assignedTo || undefined,
      attachments: [],
      comments: []
    };

    setTasks([newTask, ...tasks]);
    setInputValue('');
    setDeadline('');
    setAssignedDate('');
    setAssignedTo('');
    setShowInputDetails(false);
  };

  const handleToggleClick = (task: Task) => {
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

  const deleteTask = (id: number) => {
      if (confirm("Xóa công việc này?")) {
        setTasks(tasks.filter(t => t.id !== id));
      }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const tDate = new Date(t.createdAt);
        const isSameDay = tDate.toDateString() === viewDate.toDateString();
        if (!isSameDay || t.archived) return false;
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
      const dayTasks = tasks.filter(t => !t.archived && new Date(t.createdAt).toDateString() === viewDate.toDateString());
      return {
          total: dayTasks.length,
          completed: dayTasks.filter(t => t.completed).length,
          progress: dayTasks.length ? Math.round(dayTasks.reduce((acc, t) => acc + t.progress, 0) / dayTasks.length) : 0
      };
  }, [tasks, viewDate]);

  // Calendar Logic
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
        days.push(null);
    }
    // Days of the month
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    return days;
  }, [calendarViewDate]);

  const changeMonth = (delta: number) => {
      const newDate = new Date(calendarViewDate);
      newDate.setMonth(calendarViewDate.getMonth() + delta);
      setCalendarViewDate(newDate);
  };

  const handleDateSelect = (date: Date) => {
      setViewDate(date);
      setShowCalendar(false);
  };

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Calendar Modal */}
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
                                onClick={() => handleDateSelect(date)}
                                className={`aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all relative group ${
                                    isSelected 
                                    ? (activeGroup ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100')
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

                  <button 
                    onClick={() => { setViewDate(new Date()); setCalendarViewDate(new Date()); setShowCalendar(false); }}
                    className={`w-full py-4 mt-6 rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${activeGroup ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}
                  >
                      Quay lại hôm nay
                  </button>
                  <button onClick={() => setShowCalendar(false)} className="w-full py-4 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-900 mt-2">Đóng</button>
              </div>
          </div>
      )}

      {completingTaskId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-[2.5rem] p-10 w-full max-w-md shadow-2xl animate-scale-in border border-slate-100">
                  <h3 className="text-2xl font-black text-slate-800 mb-2">Báo cáo hoàn thành</h3>
                  <p className="text-slate-400 text-sm mb-8 font-medium">Tuyệt vời! Hãy ghi chú lại kết quả công việc này.</p>
                  <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} placeholder="Mô tả ngắn gọn kết quả..." className="w-full h-36 p-5 bg-slate-50 border border-slate-200 rounded-3xl mb-8 focus:outline-none focus:ring-4 focus:ring-emerald-100 transition-all text-sm font-medium resize-none" />
                  <div className="flex gap-4">
                      <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-4 text-slate-400 font-black text-sm hover:bg-slate-50 rounded-2xl">Hủy</button>
                      <button onClick={() => { toggleTask(completingTaskId, true, completionNote); setCompletingTaskId(null); }} className="flex-[2] py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all uppercase tracking-widest">Gửi báo cáo</button>
                  </div>
              </div>
          </div>
      )}

      <div className="px-10 pt-12 pb-6 relative z-10 shrink-0">
        <div className="flex flex-col gap-8">
            <div className="flex justify-between items-end">
                <div className="animate-slide-right">
                    <div className={`inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 shadow-sm border ${activeGroup ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-indigo-600 text-white border-indigo-500'}`}>
                        {activeGroup ? <Users size={12} strokeWidth={3}/> : <UserIcon size={12} strokeWidth={3}/>}
                        {activeGroup ? 'Dự án Nhóm' : 'Không gian Cá nhân'}
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter transition-all duration-700">
                        {activeGroup ? activeGroup.name : "Việc cần làm"}
                    </h1>
                    <div className="flex items-center gap-4 mt-6">
                        <div className={`px-4 py-1.5 rounded-xl text-xs font-black transition-colors ${activeGroup ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                           {stats.completed}/{stats.total} đã xong
                        </div>
                        <div className="h-2 w-40 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                            <div className={`h-full transition-all duration-1000 ${activeGroup ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${stats.progress}%`}}></div>
                        </div>
                        <span className="text-xs font-black text-slate-300 uppercase tracking-widest">{stats.progress}%</span>
                    </div>
                </div>
                
                <div className="relative w-24 h-24 group hidden sm:block">
                     <svg className="w-full h-full -rotate-90 drop-shadow-xl" viewBox="0 0 36 36">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className={`${activeGroup ? 'text-emerald-500' : 'text-indigo-600'} transition-all duration-1000 ease-out`} strokeDasharray={`${stats.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <div className={`absolute inset-0 flex flex-col items-center justify-center font-black transition-colors duration-700 ${activeGroup ? 'text-emerald-700' : 'text-indigo-700'}`}>
                        <span className="text-xl leading-none">{stats.progress}%</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 animate-fade-in">
                <div className="bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-100 flex items-center justify-between min-w-[280px]">
                    <button onClick={() => navigateDate(-1)} className="p-3 text-slate-300 hover:text-indigo-600 rounded-2xl transition-all"><ChevronLeft size={22} /></button>
                    <button 
                      onClick={() => { setShowCalendar(true); setCalendarViewDate(new Date(viewDate)); }}
                      className="flex flex-col items-center hover:scale-105 transition-transform group"
                    >
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] mb-0.5 group-hover:text-indigo-400">{isToday(viewDate) ? "Hôm nay" : viewDate.toLocaleDateString(language, { weekday: 'long' })}</span>
                        <span className="text-[15px] font-black text-slate-800 tracking-tight flex items-center gap-2">
                            {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long' })}
                            <CalendarIcon size={14} className="text-indigo-500 opacity-40 group-hover:opacity-100 transition-opacity" />
                        </span>
                    </button>
                    <button onClick={() => navigateDate(1)} className="p-3 text-slate-300 hover:text-indigo-600 rounded-2xl transition-all"><ChevronRight size={22} /></button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
                    {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me'] : [])] as FilterType[]).map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)} className={`px-6 py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all border-2 ${filterStatus === f ? (activeGroup ? 'bg-emerald-600 text-white border-emerald-500 shadow-xl' : 'bg-indigo-600 text-white border-indigo-500 shadow-xl') : 'bg-white text-slate-400 border-slate-100 hover:border-slate-200'}`}>
                            {t[f]}
                        </button>
                    ))}
                    <div className="relative ml-auto min-w-[220px] group hidden lg:block">
                        <Search size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors" />
                        <input type="text" placeholder="Tìm công việc..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-[13px] font-bold focus:outline-none focus:ring-4 focus:ring-slate-100" />
                    </div>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-10 pb-48 custom-scrollbar z-0">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-slate-200 animate-scale-in">
                <div className="w-24 h-24 bg-white rounded-[2.5rem] flex items-center justify-center mb-8 shadow-sm border border-slate-50"><Archive size={40} /></div>
                <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em]">Trống trải quá...</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 gap-4">
                {filteredTasks.map((task, index) => {
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const assignedMember = activeGroup?.members.find(m => m.id === task.assignedTo);

                    return (
                        <div key={task.id} className={`group bg-white rounded-[2.2rem] p-6 border-2 transition-all duration-300 ${task.completed ? 'opacity-50 border-transparent bg-slate-50/50 scale-[0.98]' : 'border-slate-100 hover:border-indigo-100 hover:shadow-2xl hover:-translate-y-1'}`}>
                            <div className="flex items-start gap-6">
                                <button onClick={() => handleToggleClick(task)} className={`mt-1.5 transition-all ${task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-indigo-500'}`}>
                                    {task.completed ? <CheckCircle2 size={32} /> : <Circle size={32} strokeWidth={2.5} />}
                                </button>
                                <div className="flex-1 min-w-0" onClick={() => setSelectedTask(task)}>
                                    <div className="flex justify-between items-start gap-3 cursor-pointer">
                                        <p className={`text-xl font-black leading-tight tracking-tight ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.text}</p>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => deleteTask(task.id)} className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl"><Trash2 size={18} /></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 mt-5">
                                        <span className={`text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${task.priority === 'high' ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}`}>Ưu tiên: {task.priority}</span>
                                        {deadlineInfo && <span className={`text-[10px] font-black flex items-center gap-2 px-3 py-1 rounded-lg border ${deadlineInfo.colorClass}`}>{deadlineInfo.icon} {deadlineInfo.text}</span>}
                                        {assignedMember && (
                                            <div className="flex items-center gap-2 ml-auto bg-slate-50 px-3 py-1 rounded-xl">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">Giao cho:</span>
                                                <img src={assignedMember.avatar} className="w-7 h-7 rounded-lg border-2 border-white shadow-sm" alt={assignedMember.name} />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      <div className="absolute bottom-10 left-0 right-0 px-10 z-30 pointer-events-none">
          <div className="max-w-4xl mx-auto pointer-events-auto">
              <div className={`bg-white rounded-[2.5rem] border-2 shadow-2xl transition-all duration-500 ${showInputDetails ? 'p-8 border-indigo-100' : 'p-3 border-slate-50'}`}>
                  {showInputDetails && (
                      <div className="grid grid-cols-2 gap-4 mb-6 animate-fade-in">
                          <div className="space-y-1">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Hạn chót</label>
                              <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold" />
                          </div>
                          {activeGroup && isLeader && (
                              <div className="space-y-1">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Thành viên</label>
                                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold appearance-none">
                                      <option value="">Chọn người thực hiện...</option>
                                      {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                  </select>
                              </div>
                          )}
                          <div className="col-span-2 flex gap-2">
                             {(['low', 'medium', 'high'] as Priority[]).map(p => (
                                 <button key={p} onClick={() => setNewPriority(p)} className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${newPriority === p ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-400'}`}>{p}</button>
                             ))}
                          </div>
                      </div>
                  )}
                  <div className="flex items-center gap-3">
                      <button onClick={() => setShowInputDetails(!showInputDetails)} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-900 text-white rotate-90' : 'bg-slate-50 text-slate-300'}`}><SlidersHorizontal size={22} /></button>
                      <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="Nhập việc cần làm ngay..." className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-bold text-slate-800 h-14" />
                      <button onClick={addTask} disabled={!inputValue.trim()} className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${inputValue.trim() ? (activeGroup ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200') + ' text-white shadow-xl scale-110' : 'bg-slate-100 text-slate-300'}`}><Plus size={32} strokeWidth={3} /></button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};