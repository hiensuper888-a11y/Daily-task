import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer, Edit2, Save, XCircle, Calculator, ListChecks, GripVertical, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Play, Pause, User as UserIcon, MessageSquare, Paperclip, FileText, Image as ImageIcon, Video, Send, Download, Eye, Users } from 'lucide-react';
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
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false });

  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  const [assignedDate, setAssignedDate] = useState<string>(''); 
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(''); 

  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created'>('priority');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const commentListRef = useRef<HTMLDivElement>(null);

  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const { t, language } = useLanguage();

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const currentMember = activeGroup?.members.find(m => m.id === currentUserId);
  const isLeader = activeGroup?.leaderId === currentUserId || currentMember?.role === 'leader';

  const toLocalISOString = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const formatDisplayDate = (isoString?: string) => {
      if (!isoString) return null;
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return null;
      return date.toLocaleString(language, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
      });
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
      let colorClass = 'text-slate-500 bg-slate-100/50 border-slate-200';
      let icon = <CalendarClock size={12} />;

      if (isOverdue) {
          text = t.overdue;
          colorClass = 'text-rose-600 bg-rose-50 border-rose-200 font-bold';
          icon = <AlertCircle size={12} />;
      } else if (isSoon) {
          text = `${Math.ceil(diffHrs)}h còn lại`;
          colorClass = 'text-amber-600 bg-amber-50 border-amber-200 font-bold';
          icon = <Timer size={12} />;
      }
      return { text, colorClass, icon, isOverdue };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
  };

  const addTask = () => {
    if (inputValue.trim() === '') return;
    if (activeGroup && !isLeader) {
        alert("Chỉ trưởng nhóm mới có thể tạo nhiệm vụ.");
        return;
    }
    
    let createdDateStr = '';
    if (assignedDate) {
        createdDateStr = new Date(assignedDate).toISOString();
    } else {
        const now = new Date();
        let baseDate = new Date(viewDate);
        if (isToday(viewDate)) createdDateStr = now.toISOString();
        else { baseDate.setHours(9, 0, 0); createdDateStr = baseDate.toISOString(); }
    }

    const newTask: Task = {
      id: Date.now(),
      text: inputValue,
      completed: false,
      progress: 0,
      createdAt: createdDateStr,
      deadline: deadline ? new Date(deadline).toISOString() : undefined,
      estimatedTime: estimatedTime,
      archived: false,
      subtasks: [],
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
    setEstimatedTime(undefined);
    setAssignedTo('');
  };

  const updateTask = (updatedTask: Task) => {
      setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      if (selectedTask?.id === updatedTask.id) setSelectedTask(updatedTask);
  };

  const handleToggleClick = (task: Task) => {
      if (task.completed) toggleTask(task.id, false);
      else {
          if (activeGroup) { setCompletingTaskId(task.id); setCompletionNote(''); }
          else toggleTask(task.id, true);
      }
  };

  const confirmCompletion = () => {
      if (completingTaskId) {
          toggleTask(completingTaskId, true, completionNote);
          setCompletingTaskId(null);
          setCompletionNote('');
      }
  };

  const toggleTask = (id: number, forceState?: boolean, note?: string) => {
    setTasks(tasks.map(task => {
      if (task.id === id) {
        const newCompleted = forceState !== undefined ? forceState : !task.completed;
        if (newCompleted) playSuccessSound();
        const completionTime = newCompleted ? new Date().toISOString() : undefined;
        return { 
            ...task, 
            completed: newCompleted, 
            completedAt: completionTime,
            completedBy: newCompleted ? currentUserId : undefined,
            completionNote: newCompleted ? note : undefined,
            progress: newCompleted ? 100 : 0
        };
      }
      return task;
    }));
  };

  const updateProgress = (id: number, val: string) => {
    const progress = parseInt(val, 10);
    const isCompleted = progress === 100;
    if (isCompleted && activeGroup) {
        setCompletingTaskId(id); setCompletionNote('');
        return; 
    }
    setTasks(tasks.map(t => t.id === id ? { ...t, progress, completed: isCompleted, completedAt: isCompleted ? new Date().toISOString() : undefined, completedBy: isCompleted ? currentUserId : undefined } : t));
    if (progress === 100) playSuccessSound();
  };

  const deleteTask = (id: number) => {
      if (confirm("Xóa nhiệm vụ này?")) {
        setTasks(tasks.filter(t => t.id !== id));
        if (selectedTask?.id === id) setSelectedTask(null);
      }
  };

  const saveEdit = () => {
      if (editingTaskId && editText.trim()) {
          setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, text: editText } : t));
          setEditingTaskId(null);
          setEditText('');
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedTask || !e.target.files?.length) return;
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
          const result = event.target?.result as string;
          let type: 'image' | 'video' | 'file' = 'file';
          if (file.type.startsWith('image/')) type = 'image';
          if (file.type.startsWith('video/')) type = 'video';
          const newAttachment: Attachment = { id: Date.now().toString(), type, name: file.name, url: result, size: file.size };
          updateTask({ ...selectedTask, attachments: [...(selectedTask.attachments || []), newAttachment] });
      };
      reader.readAsDataURL(file);
  };

  const handleAddComment = () => {
      if (!selectedTask || !newComment.trim()) return;
      const comment: Comment = {
          id: Date.now().toString(),
          userId: currentUserId,
          userName: userProfile.name || 'User',
          userAvatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`,
          text: newComment,
          timestamp: Date.now(),
          role: activeGroup ? (isLeader ? 'leader' : 'member') : undefined
      };
      updateTask({ ...selectedTask, comments: [...(selectedTask.comments || []), comment] });
      setNewComment('');
      setTimeout(() => commentListRef.current?.scrollTo({ top: commentListRef.current.scrollHeight, behavior: 'smooth' }), 100);
  };

  const removeAttachment = (attachmentId: string) => {
      if (!selectedTask) return;
      updateTask({ ...selectedTask, attachments: selectedTask.attachments?.filter(a => a.id !== attachmentId) });
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
        if (sortBy === 'deadline') {
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1; if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } 
        if (sortBy === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        const pMap = { high: 3, medium: 2, low: 1 };
        return pMap[b.priority || 'medium'] - pMap[a.priority || 'medium'];
      });
  }, [tasks, viewDate, filterStatus, searchQuery, sortBy, currentUserId]);

  const stats = useMemo(() => {
      const dayTasks = tasks.filter(t => !t.archived && new Date(t.createdAt).toDateString() === viewDate.toDateString());
      return {
          total: dayTasks.length,
          completed: dayTasks.filter(t => t.completed).length,
          progress: dayTasks.length ? Math.round(dayTasks.reduce((acc, t) => acc + t.progress, 0) / dayTasks.length) : 0
      };
  }, [tasks, viewDate]);

  return (
    <div className="flex flex-col h-full relative transition-colors duration-500">
      
      {/* Note Completion Modal */}
      {completingTaskId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-scale-in">
                  <h3 className="text-xl font-black text-slate-800 mb-2">Báo cáo kết quả</h3>
                  <p className="text-slate-500 text-sm mb-6 font-medium">Nhiệm vụ đã hoàn thành! Hãy ghi lại một vài lưu ý nếu cần.</p>
                  <textarea 
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder="Ghi chú kết quả..."
                    className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-6 focus:outline-none focus:ring-2 focus:ring-emerald-200 resize-none text-sm font-medium"
                  />
                  <div className="flex gap-3">
                      <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-4 text-slate-500 font-black text-sm hover:bg-slate-50 rounded-2xl transition-colors">Hủy</button>
                      <button onClick={confirmCompletion} className="flex-[2] py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all">GỬI BÁO CÁO</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- TASK DETAIL MODAL --- */}
      {selectedTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
           <div className="bg-white rounded-[2rem] w-full max-w-5xl h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-in border border-white">
               <div className="flex-1 flex flex-col border-r border-slate-100 h-full overflow-hidden bg-white">
                   <div className="p-8 border-b border-slate-50 flex justify-between items-start bg-slate-50/30">
                        <div className="flex-1 pr-6">
                           <div className="flex items-center gap-3 mb-3">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                                  selectedTask.priority === 'high' ? 'bg-rose-100 text-rose-600' : 
                                  selectedTask.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                  Mức: {selectedTask.priority}
                              </span>
                              {selectedTask.completed && <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-600">Đã xong</span>}
                           </div>
                           <h2 className={`text-2xl font-black text-slate-800 leading-tight ${selectedTask.completed ? 'opacity-40' : ''}`}>{selectedTask.text}</h2>
                        </div>
                        <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={24} /></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
                       <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
                           <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ngày tạo</p>
                               <div className="font-bold text-slate-700 flex items-center gap-2"><CalendarIcon size={16} className="text-indigo-500"/> {formatDisplayDate(selectedTask.createdAt)}</div>
                           </div>
                           {selectedTask.deadline && (
                            <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100">
                                <p className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1">Hạn chót</p>
                                <div className="font-bold text-orange-700 flex items-center gap-2"><Clock size={16} className="text-orange-500"/> {formatDisplayDate(selectedTask.deadline)}</div>
                            </div>
                           )}
                       </div>

                       {selectedTask.completed && selectedTask.completionNote && (
                           <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                               <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Báo cáo hoàn thành</p>
                               <p className="text-slate-700 italic leading-relaxed font-medium">"{selectedTask.completionNote}"</p>
                           </div>
                       )}

                       <div>
                           <div className="flex items-center justify-between mb-5">
                               <h3 className="font-black text-slate-800 flex items-center gap-2 text-base"><Paperclip size={20} className="text-indigo-500"/> Tài liệu đính kèm</h3>
                               <button onClick={() => fileInputRef.current?.click()} className="text-[11px] bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2 rounded-xl font-black transition-all flex items-center gap-2 uppercase tracking-wide">
                                   <Plus size={14}/> Thêm tệp
                               </button>
                               <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple accept="image/*,video/*,.pdf,.doc,.docx" />
                           </div>
                           
                           {!selectedTask.attachments?.length ? (
                               <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-3xl text-slate-400 text-sm font-medium">Chưa có tài liệu đính kèm</div>
                           ) : (
                               <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                                   {selectedTask.attachments.map(att => (
                                       <div key={att.id} className="relative group border border-slate-100 rounded-2xl overflow-hidden hover:shadow-xl hover:border-indigo-100 transition-all bg-white">
                                           {att.type === 'image' ? (
                                               <div className="aspect-square relative"><img src={att.url} className="w-full h-full object-cover" /></div>
                                           ) : (
                                               <div className="p-4 flex flex-col items-center justify-center aspect-square gap-3">
                                                   <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all"><FileText size={24}/></div>
                                                   <p className="text-[10px] font-bold text-slate-600 truncate w-full text-center px-2">{att.name}</p>
                                               </div>
                                           )}
                                           <button onClick={() => removeAttachment(att.id)} className="absolute top-2 right-2 bg-white/90 hover:bg-red-500 hover:text-white text-slate-400 rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all shadow-lg"><X size={14}/></button>
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>
                   </div>
               </div>

               <div className="w-full md:w-[380px] bg-slate-50 flex flex-col h-[50vh] md:h-full">
                   <div className="p-6 border-b border-slate-200 font-black text-slate-800 flex items-center gap-2 bg-white text-sm">
                       <MessageSquare size={18} className="text-indigo-500"/> HOẠT ĐỘNG & THẢO LUẬN
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" ref={commentListRef}>
                       {!selectedTask.comments?.length ? (
                           <div className="text-center text-slate-400 text-xs py-12 font-medium">Chưa có bình luận nào.<br/>Hãy bắt đầu cuộc hội thoại!</div>
                       ) : (
                           selectedTask.comments.map(comment => (
                               <div key={comment.id} className={`flex gap-3 ${comment.userId === currentUserId ? 'flex-row-reverse' : ''}`}>
                                   <img src={comment.userAvatar} className="w-9 h-9 rounded-xl border-2 border-white shadow-sm shrink-0 bg-white" />
                                   <div className={`flex flex-col max-w-[80%] ${comment.userId === currentUserId ? 'items-end' : 'items-start'}`}>
                                       <div className="flex items-center gap-2 mb-1 px-1">
                                           <span className="text-[10px] font-black text-slate-500">{comment.userName}</span>
                                           <span className="text-[9px] text-slate-400 font-bold">{new Date(comment.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                       </div>
                                       <div className={`px-4 py-3 rounded-2xl text-[13px] leading-relaxed shadow-sm font-medium ${
                                           comment.userId === currentUserId 
                                           ? 'bg-indigo-600 text-white rounded-tr-none' 
                                           : 'bg-white text-slate-700 rounded-tl-none border border-slate-100'
                                       }`}>
                                           {comment.text}
                                       </div>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>

                   <div className="p-4 bg-white border-t border-slate-100">
                       <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-100 transition-all border border-transparent focus-within:border-indigo-100">
                           <input 
                               value={newComment}
                               onChange={(e) => setNewComment(e.target.value)}
                               onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                               placeholder="Viết phản hồi..."
                               className="flex-1 bg-transparent border-none text-[13px] px-3 focus:ring-0 placeholder:text-slate-400 font-medium"
                           />
                           <button onClick={handleAddComment} disabled={!newComment.trim()} className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-slate-200 transition-all active:scale-95 shadow-lg shadow-indigo-100"><Send size={18} /></button>
                       </div>
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="px-8 pt-8 pb-4 relative z-10">
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`px-3 py-1 rounded-full text-[10px] font-black flex items-center gap-1.5 uppercase tracking-widest ${activeGroup ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                            {activeGroup ? <Users size={12}/> : <UserIcon size={12}/>}
                            {activeGroup ? 'Chế độ nhóm' : 'Chế độ cá nhân'}
                        </div>
                    </div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tighter flex items-center gap-3">
                        {activeGroup ? (
                            <>
                                {activeGroup.avatar ? (
                                    <img src={activeGroup.avatar} alt={activeGroup.name} className="w-10 h-10 rounded-xl object-cover shadow-lg border-2 border-white" />
                                ) : (
                                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-lg"><Users size={20}/></div>
                                )}
                                {activeGroup.name}
                            </>
                        ) : "Nhiệm vụ của tôi"}
                    </h1>
                    <div className="flex items-center gap-3 mt-3">
                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-black ${activeGroup ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                           {stats.completed}/{stats.total} {t.items}
                        </span>
                        <div className="h-1 w-20 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-1000 ${activeGroup ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{width: `${stats.progress}%`}}></div>
                        </div>
                        <span className="text-[11px] font-black text-slate-400">{stats.progress}%</span>
                    </div>
                </div>
                
                <div className="relative w-16 h-16 animate-scale-in">
                     <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                        <path className="text-slate-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        <path className={`${activeGroup ? 'text-emerald-500' : 'text-indigo-600'} transition-all duration-1000 ease-out`} strokeDasharray={`${stats.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                    </svg>
                    <div className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${activeGroup ? 'text-emerald-700' : 'text-indigo-700'}`}>{stats.progress}%</div>
                </div>
            </div>

            <div className="flex flex-col gap-4 animate-fade-in" style={{animationDelay: '0.1s'}}>
                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                    <button onClick={() => navigateDate(-1)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"><ChevronLeft size={20} /></button>
                    <div className="flex flex-col items-center">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{isToday(viewDate) ? t.today : viewDate.toLocaleDateString(language, { weekday: 'long' })}</span>
                        <span className="text-sm font-black text-slate-800">{viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long' })}</span>
                    </div>
                    <button onClick={() => navigateDate(1)} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all"><ChevronRight size={20} /></button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me'] : [])] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-5 py-2.5 rounded-xl text-xs font-black capitalize whitespace-nowrap transition-all ${
                                filterStatus === f 
                                ? (activeGroup ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-100') 
                                : 'bg-white text-slate-500 border border-slate-100 hover:border-slate-200'
                            }`}
                        >
                            {t[f]}
                        </button>
                    ))}
                    <div className="relative ml-auto min-w-[200px]">
                        <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Tìm kiếm..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- TASK LIST --- */}
      <div className="flex-1 overflow-y-auto px-8 pb-40 custom-scrollbar z-0">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-300">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Archive size={32} strokeWidth={1.5} /></div>
                <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{t.emptyTasks}</p>
            </div>
        ) : (
            <div className="space-y-3">
                {filteredTasks.map((task, index) => {
                    const isEditing = editingTaskId === task.id;
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const isOverdue = deadlineInfo?.isOverdue && !task.completed;
                    const assignedMember = activeGroup?.members.find(m => m.id === task.assignedTo);

                    return (
                        <div key={task.id} style={{ animationDelay: `${index * 0.05}s` }} className={`animate-fade-in group bg-white rounded-3xl p-5 border transition-all duration-300 ${task.completed ? 'opacity-60 border-transparent' : 'border-slate-100 hover:border-indigo-200 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1'}`}>
                            <div className="flex items-start gap-4">
                                <button onClick={() => handleToggleClick(task)} className={`mt-1 transition-all duration-300 ${task.completed ? 'text-emerald-500 scale-110' : 'text-slate-200 hover:text-indigo-500'}`}>
                                    {task.completed ? <CheckCircle2 size={24} className="fill-emerald-50" /> : <Circle size={24} strokeWidth={2.5} />}
                                </button>
                                <div className="flex-1 min-w-0" onClick={() => setSelectedTask(task)}>
                                    <div className="flex justify-between items-start gap-3 cursor-pointer">
                                        <p className={`text-[15px] font-black leading-snug transition-all ${task.completed ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.text}</p>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                            <button onClick={() => { setEditingTaskId(task.id); setEditText(task.text); }} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl transition-colors"><Edit2 size={16} /></button>
                                            <button onClick={() => deleteTask(task.id)} className="p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500 rounded-xl transition-colors"><Trash2 size={16} /></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${task.priority === 'high' ? 'text-rose-500 bg-rose-50' : task.priority === 'medium' ? 'text-amber-500 bg-amber-50' : 'text-emerald-500 bg-emerald-50'}`}>{task.priority}</span>
                                        {deadlineInfo && <span className={`text-[10px] font-black flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${deadlineInfo.colorClass}`}>{deadlineInfo.icon} {deadlineInfo.text}</span>}
                                        {assignedMember && <div className="flex items-center gap-1.5 ml-auto"><span className="text-[10px] font-black text-slate-400 uppercase">Giao cho:</span><img src={assignedMember.avatar} className="w-5 h-5 rounded-lg border border-white shadow-sm" /></div>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </div>

      {(!activeGroup || isLeader) && (
        <div className="absolute bottom-8 left-0 right-0 px-8 z-30 pointer-events-none">
            <div className="max-w-4xl mx-auto pointer-events-auto">
                <div className={`bg-white rounded-[2.5rem] transition-all duration-300 border border-slate-100 shadow-2xl ${showInputDetails ? 'p-6' : 'p-3'}`}>
                    {showInputDetails && (
                        <div className="flex flex-wrap items-center gap-4 mb-5 animate-fade-in border-b border-slate-50 pb-5">
                            <div className="relative group">
                                <button className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${assignedDate ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-500'}`}>
                                    <CalendarDays size={14} /> {assignedDate ? formatDisplayDate(assignedDate) : "Ngày bắt đầu"}
                                </button>
                                <input type="datetime-local" className="absolute inset-0 opacity-0 cursor-pointer" value={assignedDate} onChange={e => setAssignedDate(e.target.value)} />
                            </div>
                            <div className="relative group">
                                <button className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${deadline ? 'bg-rose-600 text-white' : 'bg-slate-50 text-slate-500'}`}>
                                    <CalendarClock size={14} /> {deadline ? formatDisplayDate(deadline) : "Hạn chót"}
                                </button>
                                <input type="datetime-local" className="absolute inset-0 opacity-0 cursor-pointer" value={deadline} onChange={e => setDeadline(e.target.value)} />
                            </div>
                            {activeGroup && isLeader && (
                                <select className="bg-slate-50 text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded-2xl border-none focus:ring-2 focus:ring-indigo-100" value={assignedTo} onChange={e => setAssignedTo(e.target.value)}>
                                    <option value="">Giao cho...</option>
                                    {activeGroup.members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            )}
                            <div className="flex gap-1.5 ml-auto">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                                    <button key={p} onClick={() => setNewPriority(p)} className={`w-10 h-10 rounded-xl transition-all flex items-center justify-center font-black text-[10px] uppercase ${newPriority === p ? (p === 'high' ? 'bg-rose-500 text-white shadow-lg' : p === 'medium' ? 'bg-amber-500 text-white shadow-lg' : 'bg-emerald-500 text-white shadow-lg') : 'bg-slate-50 text-slate-400'}`}>{p[0]}</button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3">
                        <button onClick={() => setShowInputDetails(!showInputDetails)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${showInputDetails ? 'bg-slate-100 text-slate-800 rotate-90' : 'bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600'}`}><SlidersHorizontal size={20} /></button>
                        <input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder={t.addTaskPlaceholder} className="flex-1 bg-transparent border-none focus:ring-0 text-base font-bold text-slate-800 placeholder:text-slate-300 h-12 px-2" />
                        <button onClick={addTask} disabled={!inputValue.trim()} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${inputValue.trim() ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-200 active:scale-90' : 'bg-slate-100 text-slate-300'}`}><Plus size={28} strokeWidth={2.5} /></button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};