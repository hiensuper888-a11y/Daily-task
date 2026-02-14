import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, Archive, ChevronLeft, ChevronRight, PlusCircle, CheckSquare, Square, X, Search, SlidersHorizontal, Clock, CalendarClock, Flag, Hourglass, CalendarDays, AlertCircle, Timer, Edit2, Save, XCircle, Calculator, ListChecks, GripVertical, ArrowUpDown, ArrowDownWideNarrow, ArrowUpNarrowWide, Play, Pause, User as UserIcon, MessageSquare, Paperclip, FileText, Image as ImageIcon, Video, Send, Download, Eye } from 'lucide-react';
import { Task, FilterType, Priority, Subtask, Group, UserProfile, Attachment, Comment } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';

interface TodoListProps {
  activeGroup: Group | null;
}

export const TodoList: React.FC<TodoListProps> = ({ activeGroup }) => {
  // Determine storage key based on whether we are in a group or personal mode
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  // If activeGroup is present, we force "globalKey" to true in useRealtimeStorage to share data
  const isGlobal = !!activeGroup;

  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobal);
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false });

  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  
  // Enhanced Input States
  const [assignedDate, setAssignedDate] = useState<string>(''); 
  const [deadline, setDeadline] = useState<string>('');
  const [estimatedTime, setEstimatedTime] = useState<number | undefined>(undefined);
  const [showInputDetails, setShowInputDetails] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string>(''); // For Group Mode

  // Sorting
  const [sortBy, setSortBy] = useState<'priority' | 'deadline' | 'created'>('priority');
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Edit Mode State
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  // ... other edit states managed via direct task update or Detail Modal now

  // Task Detail Modal State
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [newComment, setNewComment] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Completion Note Modal State
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');

  // Filtering & Sorting
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // View Navigation State
  const [viewDate, setViewDate] = useState<Date>(new Date());
  
  const [subtaskInputs, setSubtaskInputs] = useState<Record<number, string>>({});

  const { t, language } = useLanguage();

  // Get current user ID to check permissions
  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem(SESSION_KEY) || 'guest' : 'guest';
  const isLeader = activeGroup?.leaderId === currentUserId;

  // Helper: Format Date for Input (YYYY-MM-DDTHH:mm)
  const toLocalISOString = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const safeDateToInput = (isoString?: string) => {
      if (!isoString) return '';
      try {
          // Check if ISO string is valid
          const d = new Date(isoString);
          if (isNaN(d.getTime())) return '';
          return toLocalISOString(d);
      } catch (e) { return ''; }
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

  const formatEstimate = (mins: number) => {
      if (mins < 60) return `${mins} ${t.minutes}`;
      const hrs = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${hrs}h ${m}m` : `${hrs} ${t.hours}`;
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
          const hrsLeft = Math.ceil(diffHrs);
          text = `${hrsLeft}h left`;
          colorClass = 'text-amber-600 bg-amber-50 border-amber-200 font-bold';
          icon = <Timer size={12} />;
      }

      return { text, fullDate: target.toLocaleString(), colorClass, icon, isOverdue };
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  const navigateDate = (days: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + days);
    setViewDate(newDate);
  };

  // --- TASK MANAGEMENT ---

  const addTask = () => {
    if (inputValue.trim() === '') return;
    
    // Permission check for groups
    if (activeGroup && !isLeader) {
        alert("Only the Group Leader can create tasks.");
        return;
    }
    
    let createdDateStr = '';
    
    if (assignedDate) {
        createdDateStr = new Date(assignedDate).toISOString();
    } else {
        const now = new Date();
        let baseDate = new Date(viewDate);
        if (isToday(viewDate)) {
            createdDateStr = now.toISOString();
        } else {
            baseDate.setHours(9, 0, 0); 
            createdDateStr = baseDate.toISOString();
        }
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
    setNewPriority('medium');
    setAssignedTo('');
  };

  const updateTask = (updatedTask: Task) => {
      setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t));
      // Also update selectedTask if it's the one being edited
      if (selectedTask && selectedTask.id === updatedTask.id) {
          setSelectedTask(updatedTask);
      }
  };

  const handleToggleClick = (task: Task) => {
      if (task.completed) {
          // Re-open task
          toggleTask(task.id, false);
      } else {
          if (activeGroup) {
              // Group mode: Open Note Modal
              setCompletingTaskId(task.id);
              setCompletionNote('');
          } else {
              // Personal mode: Just complete
              toggleTask(task.id, true);
          }
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
            progress: newCompleted ? 100 : (task.subtasks?.length ? calculateProgressFromSubtasks(task.subtasks) : 0),
            subtasks: newCompleted 
                ? task.subtasks?.map(s => ({ ...s, completed: true })) 
                : task.subtasks 
        };
      }
      return task;
    }));
  };

  const calculateProgressFromSubtasks = (subtasks: Subtask[]) => {
      if (!subtasks || subtasks.length === 0) return 0;
      const completed = subtasks.filter(s => s.completed).length;
      return Math.round((completed / subtasks.length) * 100);
  };

  const updateProgress = (id: number, val: string) => {
    const progress = parseInt(val, 10);
    const isCompleted = progress === 100;
    
    if (isCompleted && activeGroup) {
        // If sliding to 100% in group mode, trigger note modal
        setCompletingTaskId(id);
        setCompletionNote('');
        return; 
    }

    setTasks(tasks.map(t => {
        if (t.id === id) {
            const newCompletedAt = isCompleted ? (t.completedAt || new Date().toISOString()) : undefined;
            return { 
                ...t, 
                progress, 
                completed: isCompleted, 
                completedAt: newCompletedAt,
                completedBy: isCompleted ? currentUserId : undefined
            };
        }
        return t;
    }));
    
    if (progress === 100) playSuccessSound();
  };

  const deleteTask = (id: number) => {
      setTasks(tasks.filter(t => t.id !== id));
      if (selectedTask?.id === id) setSelectedTask(null);
  };

  const saveEdit = () => {
      if (editingTaskId && editText.trim()) {
          setTasks(tasks.map(t => t.id === editingTaskId ? { ...t, text: editText } : t));
          setEditingTaskId(null);
          setEditText('');
      }
  };

  const cancelEdit = () => {
      setEditingTaskId(null);
      setEditText('');
  };

  // --- DETAIL MODAL LOGIC (Attachments & Comments) ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedTask || !e.target.files?.length) return;
      
      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
          const result = event.target?.result as string;
          
          let type: 'image' | 'video' | 'file' = 'file';
          if (file.type.startsWith('image/')) type = 'image';
          if (file.type.startsWith('video/')) type = 'video';

          const newAttachment: Attachment = {
              id: Date.now().toString(),
              type,
              name: file.name,
              url: result, // In a real app, upload to cloud and get URL
              size: file.size
          };

          const updatedTask = {
              ...selectedTask,
              attachments: [...(selectedTask.attachments || []), newAttachment]
          };
          updateTask(updatedTask);
      };

      // Read file (Use DataURL for Images/Small items demo, usually would upload to server)
      reader.readAsDataURL(file);
  };

  const handleAddComment = () => {
      if (!selectedTask || !newComment.trim()) return;

      const comment: Comment = {
          id: Date.now().toString(),
          userId: currentUserId,
          userName: userProfile.name || 'User',
          userAvatar: userProfile.avatar || '',
          text: newComment,
          timestamp: Date.now(),
          role: activeGroup ? (isLeader ? 'leader' : 'member') : undefined
      };

      const updatedTask = {
          ...selectedTask,
          comments: [...(selectedTask.comments || []), comment]
      };
      updateTask(updatedTask);
      setNewComment('');
  };

  const removeAttachment = (attachmentId: string) => {
      if (!selectedTask) return;
      const updatedTask = {
          ...selectedTask,
          attachments: selectedTask.attachments?.filter(a => a.id !== attachmentId)
      };
      updateTask(updatedTask);
  };

  // ---------------------------------------------

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(t => {
        const tDate = new Date(t.createdAt);
        const isSameDay = tDate.getDate() === viewDate.getDate() &&
                          tDate.getMonth() === viewDate.getMonth() &&
                          tDate.getFullYear() === viewDate.getFullYear();
        if (!isSameDay || t.archived) return false;
        
        if (filterStatus === 'assigned_to_me') {
             return t.assignedTo === currentUserId && !t.completed;
        }
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        
        // Sorting Logic
        if (sortBy === 'deadline') {
            if (!a.deadline && !b.deadline) {
                 const pMap = { high: 3, medium: 2, low: 1 };
                 return (pMap[b.priority || 'medium'] || 2) - (pMap[a.priority || 'medium'] || 2);
            }
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        } 
        
        if (sortBy === 'created') {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }

        const pMap = { high: 3, medium: 2, low: 1 };
        const pA = pMap[a.priority || 'medium'];
        const pB = pMap[b.priority || 'medium'];
        if (pA !== pB) return pB - pA;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
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
    <div className="flex flex-col h-full relative">
      
      {/* Note Completion Modal */}
      {completingTaskId && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl animate-scale-in">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">{t.completionNote}</h3>
                  <textarea 
                    value={completionNote}
                    onChange={(e) => setCompletionNote(e.target.value)}
                    placeholder={t.addNotePlaceholder}
                    className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none text-sm"
                  />
                  <div className="flex gap-2 justify-end">
                      <button onClick={() => setCompletingTaskId(null)} className="px-4 py-2 text-slate-500 font-bold text-sm hover:bg-slate-100 rounded-xl">Cancel</button>
                      <button onClick={confirmCompletion} className="px-6 py-2 bg-indigo-600 text-white font-bold text-sm rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">{t.submitCompletion}</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- TASK DETAIL MODAL --- */}
      {selectedTask && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-2 md:p-4 bg-black/60 backdrop-blur-md animate-fade-in">
           <div className="bg-white rounded-3xl w-full max-w-4xl h-[90vh] flex flex-col md:flex-row overflow-hidden shadow-2xl animate-scale-in">
               
               {/* Left: Task Info */}
               <div className="flex-1 flex flex-col border-r border-slate-100 h-full overflow-hidden">
                   <div className="p-6 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div className="flex-1 pr-4">
                           <div className="flex items-center gap-2 mb-2">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  selectedTask.priority === 'high' ? 'bg-rose-100 text-rose-600' : 
                                  selectedTask.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                              }`}>
                                  {selectedTask.priority}
                              </span>
                              {selectedTask.completed && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-600">Completed</span>}
                           </div>
                           <h2 className={`text-2xl font-black text-slate-800 leading-tight ${selectedTask.completed ? 'line-through decoration-2 decoration-slate-300 text-slate-400' : ''}`}>{selectedTask.text}</h2>
                        </div>
                        <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                   </div>

                   <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                       {/* Metadata */}
                       <div className="flex flex-wrap gap-4 text-sm text-slate-500">
                           <div className="flex items-center gap-2"><CalendarIcon size={16}/> Created: {formatDisplayDate(selectedTask.createdAt)}</div>
                           {selectedTask.deadline && <div className="flex items-center gap-2 text-orange-600"><Clock size={16}/> Deadline: {formatDisplayDate(selectedTask.deadline)}</div>}
                           {activeGroup && selectedTask.assignedTo && (
                               <div className="flex items-center gap-2">
                                   <UserIcon size={16}/> 
                                   Assigned to: <span className="font-bold text-slate-700">{activeGroup.members.find(m => m.id === selectedTask.assignedTo)?.name || 'Unknown'}</span>
                               </div>
                           )}
                       </div>

                       {/* Completion Info */}
                       {selectedTask.completed && selectedTask.completionNote && (
                           <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                               <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Completion Report</p>
                               <p className="text-slate-700 italic">"{selectedTask.completionNote}"</p>
                           </div>
                       )}

                       {/* Attachments Section */}
                       <div>
                           <div className="flex items-center justify-between mb-3">
                               <h3 className="font-bold text-slate-800 flex items-center gap-2"><Paperclip size={18} className="text-indigo-500"/> Attachments</h3>
                               <button onClick={() => fileInputRef.current?.click()} className="text-xs bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg font-bold transition-colors flex items-center gap-1">
                                   <Plus size={14}/> Add File
                               </button>
                               <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} multiple accept="image/*,video/*,.pdf,.doc,.docx" />
                           </div>
                           
                           {(!selectedTask.attachments || selectedTask.attachments.length === 0) ? (
                               <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 text-sm">
                                   No attachments yet
                               </div>
                           ) : (
                               <div className="grid grid-cols-2 gap-3">
                                   {selectedTask.attachments.map(att => (
                                       <div key={att.id} className="relative group border border-slate-200 rounded-xl overflow-hidden hover:shadow-md transition-all bg-white">
                                           {att.type === 'image' ? (
                                               <div className="aspect-video bg-slate-100 relative">
                                                   <img src={att.url} alt={att.name} className="w-full h-full object-cover" />
                                                   <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                       <a href={att.url} download={att.name} className="p-2 bg-white/20 hover:bg-white text-white hover:text-slate-900 rounded-full backdrop-blur-sm"><Download size={16}/></a>
                                                   </div>
                                               </div>
                                           ) : att.type === 'video' ? (
                                               <div className="aspect-video bg-slate-900 flex items-center justify-center text-white relative">
                                                   <Video size={32} opacity={0.5}/>
                                                   <video src={att.url} className="absolute inset-0 w-full h-full object-cover opacity-60" />
                                                   <Play size={24} className="absolute z-10"/>
                                               </div>
                                           ) : (
                                               <div className="p-4 flex items-center gap-3">
                                                   <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500"><FileText size={20}/></div>
                                                   <div className="flex-1 min-w-0">
                                                       <p className="text-xs font-bold text-slate-700 truncate">{att.name}</p>
                                                       <p className="text-[10px] text-slate-400">{(att.size ? (att.size/1024).toFixed(1) + ' KB' : 'File')}</p>
                                                   </div>
                                               </div>
                                           )}
                                           <button 
                                                onClick={() => removeAttachment(att.id)}
                                                className="absolute top-1 right-1 bg-white/80 hover:bg-red-500 hover:text-white text-slate-400 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all z-20"
                                           >
                                               <X size={14}/>
                                           </button>
                                       </div>
                                   ))}
                               </div>
                           )}
                       </div>
                   </div>
               </div>

               {/* Right: Comments/Activity */}
               <div className="w-full md:w-[350px] bg-slate-50 flex flex-col h-[50vh] md:h-full">
                   <div className="p-4 border-b border-slate-200 font-bold text-slate-700 flex items-center gap-2 bg-white">
                       <MessageSquare size={18} className="text-indigo-500"/> Activity & Comments
                   </div>
                   
                   <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                       {(!selectedTask.comments || selectedTask.comments.length === 0) ? (
                           <div className="text-center text-slate-400 text-xs py-10">No comments yet. Be the first!</div>
                       ) : (
                           selectedTask.comments.map(comment => (
                               <div key={comment.id} className={`flex gap-3 ${comment.userId === currentUserId ? 'flex-row-reverse' : ''}`}>
                                   <div className="flex-shrink-0">
                                       <img src={comment.userAvatar} alt={comment.userName} className="w-8 h-8 rounded-full border border-white shadow-sm bg-slate-200" />
                                   </div>
                                   <div className={`flex flex-col max-w-[85%] ${comment.userId === currentUserId ? 'items-end' : 'items-start'}`}>
                                       <div className="flex items-center gap-2 mb-1">
                                           <span className="text-[10px] font-bold text-slate-600">{comment.userName}</span>
                                           {comment.role === 'leader' && <span className="bg-amber-100 text-amber-700 text-[9px] px-1.5 rounded font-bold uppercase">Leader</span>}
                                           <span className="text-[9px] text-slate-400">{new Date(comment.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                       </div>
                                       <div className={`px-3 py-2 rounded-2xl text-sm ${
                                           comment.userId === currentUserId 
                                           ? 'bg-indigo-600 text-white rounded-tr-none' 
                                           : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none shadow-sm'
                                       }`}>
                                           {comment.text}
                                       </div>
                                   </div>
                               </div>
                           ))
                       )}
                   </div>

                   <div className="p-3 bg-white border-t border-slate-200">
                       <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-transparent focus-within:border-indigo-300 focus-within:bg-white transition-all">
                           <input 
                               value={newComment}
                               onChange={(e) => setNewComment(e.target.value)}
                               onKeyDown={(e) => { if(e.key === 'Enter') handleAddComment() }}
                               placeholder="Write a comment..."
                               className="flex-1 bg-transparent border-none text-sm px-3 focus:ring-0 placeholder:text-slate-400"
                           />
                           <button 
                                onClick={handleAddComment}
                                disabled={!newComment.trim()}
                                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                           >
                               <Send size={16} />
                           </button>
                       </div>
                   </div>
               </div>
           </div>
        </div>
      )}

      {/* --- HEADER --- */}
      <div className="px-6 py-6 pb-2 relative z-10">
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-start animate-fade-in">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                        {activeGroup ? (
                            <>
                                {activeGroup.avatar ? (
                                    <img src={activeGroup.avatar} alt={activeGroup.name} className="w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm" />
                                ) : (
                                    <span className="bg-indigo-100 p-1.5 rounded-lg text-indigo-600"><UserIcon size={24}/></span>
                                )}
                                {activeGroup.name}
                            </>
                        ) : t.todoHeader}
                    </h1>
                    <p className="text-slate-500 font-medium text-sm mt-1 flex items-center gap-2">
                        <span className="bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-md text-xs font-bold">
                           {stats.completed} / {stats.total} {t.items}
                        </span>
                        <span>•</span>
                        <span className="text-slate-400">{stats.progress}% {t.done}</span>
                    </p>
                </div>
                {/* Clean Progress Ring */}
                <div className="relative w-14 h-14 group cursor-pointer hover:scale-105 transition-transform">
                     <svg className="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 36 36">
                        <path className="text-slate-200" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" />
                        <path className="text-indigo-600 transition-all duration-1000 ease-out" strokeDasharray={`${stats.progress}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-indigo-700">
                        {stats.progress}%
                    </div>
                </div>
            </div>

            {/* Filter and Sort Bar */}
            <div className="flex flex-col gap-4 animate-fade-in" style={{animationDelay: '0.1s'}}>
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-1.5 shadow-sm border border-slate-200 flex items-center justify-between">
                    <button onClick={() => navigateDate(-1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all">
                        <ChevronLeft size={20} />
                    </button>
                    
                    <div className="flex flex-col items-center cursor-pointer group relative">
                        <input 
                            type="date" 
                            className="absolute inset-0 opacity-0 cursor-pointer z-10"
                            onChange={(e) => {
                                if(e.target.value) setViewDate(new Date(e.target.value));
                            }}
                            value={toLocalISOString(viewDate).split('T')[0]}
                        />
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-0.5 group-hover:text-indigo-500 transition-colors">
                            {isToday(viewDate) ? t.today : viewDate.toLocaleDateString(language, { weekday: 'long' })}
                        </span>
                        <span className="text-base font-bold text-slate-800 flex items-center gap-2">
                            {viewDate.toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })}
                        </span>
                    </div>

                    <button onClick={() => navigateDate(1)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all">
                        <ChevronRight size={20} />
                    </button>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1 pr-1">
                    {(['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me'] : [])] as FilterType[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilterStatus(f)}
                            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize whitespace-nowrap transition-all ${
                                filterStatus === f 
                                ? 'bg-slate-800 text-white shadow-md' 
                                : 'bg-white/60 text-slate-500 border border-transparent hover:bg-white hover:border-slate-100'
                            }`}
                        >
                            {t[f]}
                        </button>
                    ))}
                    
                    {/* Sorting Dropdown */}
                    <div className="relative">
                        <button 
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className={`p-2 rounded-xl transition-all flex items-center gap-1.5 ${showSortMenu ? 'bg-indigo-100 text-indigo-700' : 'bg-white/60 text-slate-400 hover:bg-white hover:text-slate-600'}`}
                            title={t.sortBy}
                        >
                            <ArrowUpDown size={16} />
                        </button>
                        {showSortMenu && (
                            <div className="absolute top-full left-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 p-1 z-30 min-w-[140px] animate-fade-in">
                                {[
                                    { id: 'priority', icon: ArrowDownWideNarrow, label: t.sortPriority },
                                    { id: 'deadline', icon: Clock, label: t.deadline },
                                    { id: 'created', icon: CalendarDays, label: t.sortDate }
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        onClick={() => { setSortBy(opt.id as any); setShowSortMenu(false); }}
                                        className={`flex items-center gap-2 w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                            sortBy === opt.id ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <opt.icon size={14} /> {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showSortMenu && <div className="fixed inset-0 z-20" onClick={() => setShowSortMenu(false)}></div>}
                    </div>

                    <div className="w-px h-6 bg-slate-200/50 mx-1 shrink-0"></div>
                    <div className="relative flex-1 group min-w-[100px]">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                            type="text" 
                            placeholder="Search..." 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-white/60 border border-transparent hover:border-slate-200 rounded-xl text-xs focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* --- TASK LIST --- */}
      <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-40 custom-scrollbar z-0">
        {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 animate-scale-in">
                <div className="w-20 h-20 bg-slate-100/80 rounded-full flex items-center justify-center mb-4 shadow-inner">
                    <Archive size={32} className="text-slate-300" />
                </div>
                <p className="text-sm font-bold text-slate-500">{t.emptyTasks}</p>
            </div>
        ) : (
            <div className="space-y-3 pb-4">
                {filteredTasks.map((task, index) => {
                    const isEditing = editingTaskId === task.id;
                    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
                    const isOverdue = deadlineInfo?.isOverdue && !task.completed;
                    
                    // Group: Get assigned user info
                    const assignedMember = activeGroup?.members.find(m => m.id === task.assignedTo);
                    const completedMember = activeGroup?.members.find(m => m.id === task.completedBy);

                    const priorityColors = {
                        high: 'bg-rose-500',
                        medium: 'bg-amber-400',
                        low: 'bg-emerald-400'
                    };

                    return (
                        <div 
                            key={task.id}
                            style={{ animationDelay: `${index * 0.05}s` }}
                            className={`animate-fade-in group relative bg-white/90 backdrop-blur-md rounded-2xl p-0 border transition-all duration-300 ${
                                isEditing ? 'border-indigo-500 shadow-xl z-20 scale-[1.01]' :
                                task.completed 
                                ? 'border-transparent opacity-60 hover:opacity-100' 
                                : isOverdue 
                                    ? 'border-rose-200 bg-rose-50/30' 
                                    : 'border-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-500/5 hover:-translate-y-0.5'
                            } shadow-sm`}
                        >
                            {/* Visual Priority Indicator */}
                            <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${priorityColors[task.priority || 'medium']} opacity-80`}></div>

                            <div className="p-4 pl-5">
                                <div className="flex items-start gap-3 relative z-10">
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); handleToggleClick(task); }}
                                        className={`mt-0.5 shrink-0 transition-all duration-300 ${
                                            task.completed 
                                            ? 'text-emerald-500 scale-110' 
                                            : 'text-slate-300 hover:text-indigo-600 hover:scale-110'
                                        }`}
                                    >
                                        {task.completed ? <CheckCircle2 size={22} className="fill-emerald-50" /> : <Circle size={22} strokeWidth={2.5} />}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0" onClick={() => setSelectedTask(task)}>
                                        {isEditing ? (
                                            <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
                                                <input 
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    className="w-full text-lg font-bold text-slate-800 border-b border-indigo-200 focus:border-indigo-500 focus:outline-none bg-transparent pb-1"
                                                    autoFocus
                                                />
                                                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                                    <button onClick={cancelEdit} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"><XCircle size={20}/></button>
                                                    <button onClick={saveEdit} className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"><Save size={16}/> Save</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex justify-between items-start gap-2 cursor-pointer">
                                                    <p className={`text-[15px] font-semibold leading-snug transition-all ${task.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                                        {task.text}
                                                    </p>
                                                    
                                                    <div className="flex items-center gap-1">
                                                        {assignedMember && !task.completed && (
                                                            <img src={assignedMember.avatar} alt={assignedMember.name} className="w-6 h-6 rounded-full border border-white shadow-sm" title={`Assigned to ${assignedMember.name}`}/>
                                                        )}
                                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity translate-x-2 group-hover:translate-x-0 duration-200" onClick={(e) => e.stopPropagation()}>
                                                            <button onClick={() => { setEditingTaskId(task.id); setEditText(task.text); }} className="text-slate-300 hover:text-indigo-500 p-1.5 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={15} /></button>
                                                            <button onClick={() => deleteTask(task.id)} className="text-slate-300 hover:text-red-500 p-1.5 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={15} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                {/* Metadata Chips */}
                                                <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                                    <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500">
                                                        <CalendarDays size={10} /> {new Date(task.createdAt).toLocaleDateString(language, {day: 'numeric', month: 'numeric'})}
                                                    </span>

                                                    {task.attachments && task.attachments.length > 0 && (
                                                        <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 border border-indigo-100">
                                                            <Paperclip size={10} /> {task.attachments.length}
                                                        </span>
                                                    )}

                                                    {task.comments && task.comments.length > 0 && (
                                                        <span className="text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">
                                                            <MessageSquare size={10} /> {task.comments.length}
                                                        </span>
                                                    )}

                                                    {deadlineInfo && (
                                                        <span className={`text-[10px] font-bold flex items-center gap-1.5 px-2 py-0.5 rounded-md border ${deadlineInfo.colorClass}`}>
                                                            {deadlineInfo.icon} {deadlineInfo.text}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {/* Completion Note */}
                                                {task.completed && (task.completedBy || task.completionNote) && (
                                                    <div className="mt-2 bg-emerald-50/50 p-2 rounded-lg border border-emerald-100 flex items-start gap-2 text-xs">
                                                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0 mt-0.5"/>
                                                        <div>
                                                            {completedMember && <span className="font-bold text-emerald-700 mr-1">{completedMember.name}</span>}
                                                            <span className="text-slate-600 italic">{task.completionNote}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Progress Bar */}
                                                {!task.completed && (
                                                    <div className="mt-3 flex items-center gap-2 group/slider" onClick={(e) => e.stopPropagation()}>
                                                        <div className="relative flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                            <div className={`absolute h-full rounded-full transition-all duration-500 relative overflow-hidden ${isOverdue ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{width: `${task.progress}%`}}>
                                                                <div className="absolute inset-0 animate-shimmer opacity-40"></div>
                                                            </div>
                                                            {(!task.subtasks || task.subtasks.length === 0) && (
                                                                <input type="range" min="0" max="100" value={task.progress} onChange={(e) => updateProgress(task.id, e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-slate-400 w-8 text-right">{task.progress}%</span>
                                                    </div>
                                                )}
                                            </>
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

      {/* --- FLOATING INPUT BAR (Only visible if Personal or (Group + Leader)) --- */}
      {(!activeGroup || isLeader) && (
        <div className="absolute bottom-6 left-0 right-0 px-4 md:px-6 z-30 pointer-events-none">
            <div className="max-w-3xl mx-auto pointer-events-auto">
                <div className={`glass rounded-[2rem] transition-all duration-300 border border-white/50 bg-white/80 backdrop-blur-xl ${showInputDetails ? 'p-4 shadow-2xl ring-1 ring-indigo-500/10' : 'p-2 shadow-xl shadow-indigo-900/10'}`}>
                    
                    {showInputDetails && (
                        <div className="flex flex-wrap items-center gap-3 mb-4 animate-fade-in border-b border-slate-100 pb-4">
                            {/* Assigned Date Picker */}
                            <div className={`relative group flex items-center rounded-xl border transition-all overflow-hidden ${assignedDate ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-100 focus-within:border-indigo-300'}`}>
                                <div className="relative flex items-center">
                                    <button 
                                        type="button"
                                        className={`flex items-center gap-2 pl-3 pr-2 py-2 text-xs font-bold transition-all ${assignedDate ? 'text-indigo-700' : 'text-slate-500'}`}
                                    >
                                        <CalendarDays size={14} className={assignedDate ? "text-indigo-600" : "text-slate-400"} /> 
                                        <span>{assignedDate ? formatDisplayDate(assignedDate) : t.setAssignedDate || 'Start Date'}</span>
                                    </button>
                                    <input 
                                        type="datetime-local" 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        value={assignedDate}
                                        onChange={(e) => setAssignedDate(e.target.value)}
                                    />
                                </div>
                                {assignedDate && (
                                    <button onClick={() => setAssignedDate('')} className="pr-2 pl-1 text-indigo-400 hover:text-red-500 relative z-20">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Deadline Picker */}
                            <div className={`relative group flex items-center rounded-xl border transition-all overflow-hidden ${deadline ? 'bg-orange-50 border-orange-200' : 'bg-slate-50 border-slate-100 focus-within:border-indigo-300'}`}>
                                <div className="relative flex items-center">
                                    <button 
                                        type="button"
                                        className={`flex items-center gap-2 pl-3 pr-2 py-2 text-xs font-bold transition-all ${deadline ? 'text-orange-700' : 'text-slate-500'}`}
                                    >
                                        <CalendarClock size={14} className={deadline ? "text-orange-600" : "text-slate-400"} /> 
                                        <span>{deadline ? formatDisplayDate(deadline) : t.setDeadline}</span>
                                    </button>
                                    <input 
                                        type="datetime-local" 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                        value={deadline}
                                        onChange={(e) => setDeadline(e.target.value)}
                                    />
                                </div>
                                {deadline && (
                                    <button onClick={() => setDeadline('')} className="pr-2 pl-1 text-orange-400 hover:text-red-500 relative z-20">
                                        <X size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Estimate Time */}
                            <div className={`flex items-center gap-1 border rounded-xl p-1 pl-3 transition-colors ${estimatedTime ? 'bg-violet-50 border-violet-200' : 'bg-slate-50 border-slate-100'}`}>
                                <Hourglass size={14} className={estimatedTime ? "text-violet-500" : "text-slate-400"}/>
                                <select 
                                    className={`bg-transparent text-xs font-bold focus:outline-none py-1 cursor-pointer pr-2 ${estimatedTime ? 'text-violet-700' : 'text-slate-600'}`}
                                    value={estimatedTime || ''}
                                    onChange={(e) => setEstimatedTime(e.target.value ? parseInt(e.target.value) : undefined)}
                                >
                                    <option value="">{t.setEstimate}</option>
                                    <option value="15">15 {t.minutes}</option>
                                    <option value="30">30 {t.minutes}</option>
                                    <option value="45">45 {t.minutes}</option>
                                    <option value="60">1 {t.hours}</option>
                                    <option value="120">2 {t.hours}</option>
                                    <option value="240">4 {t.hours}</option>
                                </select>
                                {estimatedTime && (
                                    <button onClick={() => setEstimatedTime(undefined)} className="p-1 text-violet-400 hover:text-red-500"><X size={12} /></button>
                                )}
                            </div>

                            {/* Group Assignment Selector (Only for Leaders) */}
                            {activeGroup && isLeader && (
                                <div className="flex items-center gap-1 border rounded-xl p-1 pl-3 bg-slate-50 border-slate-100">
                                    <UserIcon size={14} className={assignedTo ? "text-indigo-500" : "text-slate-400"}/>
                                    <select 
                                        className={`bg-transparent text-xs font-bold focus:outline-none py-1 cursor-pointer pr-2 ${assignedTo ? 'text-indigo-700' : 'text-slate-600'}`}
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                    >
                                        <option value="">{t.assignTo}</option>
                                        {activeGroup.members.map(m => (
                                            <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Priority Selector */}
                            <div className="flex gap-1 ml-auto">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => (
                                    <button
                                        key={p}
                                        onClick={() => setNewPriority(p)}
                                        className={`w-8 h-8 rounded-full transition-all flex items-center justify-center border shadow-sm ${
                                            newPriority === p 
                                            ? (p === 'high' ? 'bg-rose-500 border-rose-600 text-white scale-110' : p === 'medium' ? 'bg-amber-500 border-amber-600 text-white scale-110' : 'bg-emerald-500 border-emerald-600 text-white scale-110') 
                                            : 'bg-white border-slate-100 text-slate-300 hover:text-slate-500 hover:bg-slate-50'
                                        }`}
                                        title={t[p] || p}
                                    >
                                        <Flag size={14} fill={newPriority === p ? "currentColor" : "none"} className={newPriority === p ? "" : "currentColor"} />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Input Row */}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => setShowInputDetails(!showInputDetails)}
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all border ${
                                showInputDetails 
                                ? 'bg-indigo-600 text-white border-indigo-600 rotate-90 shadow-md' 
                                : 'bg-slate-100 text-slate-500 border-transparent hover:bg-indigo-50 hover:text-indigo-600'
                            }`}
                        >
                            <SlidersHorizontal size={18} />
                        </button>

                        <input 
                            type="text" 
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
                            placeholder={t.addTaskPlaceholder}
                            className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-semibold text-slate-800 placeholder:text-slate-400 h-10 px-2"
                        />

                        <button 
                            onClick={addTask}
                            disabled={!inputValue.trim()}
                            className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                                inputValue.trim() 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:scale-105 hover:bg-indigo-700 active:scale-95' 
                                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }`}
                        >
                            <Plus size={22} strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
