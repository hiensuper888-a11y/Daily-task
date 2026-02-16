import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, 
  Edit3, CheckSquare, ListChecks,
  Sun, Moon, Sunrise, Users, User,
  Layers, Zap, ArrowRightCircle, Check, ArrowUpDown, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock,
  Paperclip, FileText, Loader2,
  MoreVertical, Sparkles, Flag, GripVertical, MessageSquare, Star, Crown,
  Maximize2, Minimize2, Send, Save, Download, PlayCircle
} from 'lucide-react';
import { Task, FilterType, Priority, Group, UserProfile, Attachment, Subtask, SortOption, Comment } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';
import { generateSubtasksWithGemini, refineTaskTextWithGemini } from '../services/geminiService';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface TodoListProps {
  activeGroup: Group | null;
}

// --- HELPER: Format Date for Input (Local Time) ---
const formatForInput = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return '';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// --- BEAUTIFIED TASK ITEM ---
const TaskItem = React.memo(({ 
  task, 
  index,
  language, 
  activeGroup, 
  lastCheckedId, 
  onToggle, 
  onDelete, 
  onEdit, 
  onProgressChange,
  isDraggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnter,
  onDragEnd,
  isDragging,
  isDragOver
}: { 
  task: Task, 
  index: number,
  language: string, 
  activeGroup: Group | null, 
  lastCheckedId: number | null, 
  onToggle: (task: Task, e?: React.MouseEvent) => void,
  onDelete: (id: number, e?: React.MouseEvent) => void,
  onEdit: (task: Task) => void,
  onProgressChange: (id: number, progress: number) => void,
  isDraggable: boolean,
  onDragStart: (e: React.DragEvent, id: number) => void,
  onDragOver: (e: React.DragEvent) => void,
  onDrop: (e: React.DragEvent, id: number) => void,
  onDragEnter: (id: number) => void,
  onDragEnd: () => void,
  isDragging: boolean,
  isDragOver: boolean
}) => {
    
    const { t } = useLanguage();

    const formatDeadline = (isoString: string) => {
        const target = new Date(isoString);
        if (isNaN(target.getTime())) return null;
        
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        const diffMins = diffMs / (1000 * 60);
        
        // For Today/Tomorrow calculation based on local time
        const today = new Date();
        today.setHours(0,0,0,0);
        const targetDay = new Date(target);
        targetDay.setHours(0,0,0,0);
        
        const isOverdue = diffMs < 0;
        const isToday = targetDay.getTime() === today.getTime();
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const isTomorrow = targetDay.getTime() === tomorrow.getTime();

        // Default formatting: use toLocaleString for date AND time support across browsers
        let text = target.toLocaleString(language, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        let colorClass = 'text-slate-500 bg-slate-100 border-slate-200';
        let icon = <CalendarClock size={13} />;

        if (isOverdue) {
            // If overdue within 24h, show hours ago. Else show date.
            if (diffHrs > -24) {
                 text = `${t.overdue} (${Math.abs(Math.ceil(diffHrs))}h)`;
            } else {
                 // For older overdue, just show date
                 text = `${t.overdue} (${target.toLocaleDateString(language, {month: 'numeric', day: 'numeric'})})`;
            }
            colorClass = 'text-rose-600 bg-rose-50 border-rose-200 font-bold';
            icon = <AlertCircle size={13} />;
        } else if (isToday) {
            // Urgency: < 1 hour shows mins left
            if (diffMins < 60 && diffMins > 0) {
                 text = `${Math.ceil(diffMins)} ${t.minsLeft}`;
                 colorClass = 'text-amber-600 bg-amber-50 border-amber-200 font-bold';
                 icon = <Timer size={13} />;
            } else {
                 text = `${t.today}, ${target.toLocaleTimeString(language, {hour: '2-digit', minute: '2-digit'})}`;
                 colorClass = 'text-indigo-600 bg-indigo-50 border-indigo-200 font-bold';
                 icon = <Clock size={13} />;
            }
        } else if (isTomorrow) {
            text = `${t.tomorrow}, ${target.toLocaleTimeString(language, {hour: '2-digit', minute: '2-digit'})}`;
            colorClass = 'text-blue-600 bg-blue-50 border-blue-200 font-medium';
            icon = <CalendarIcon size={13} />;
        }
        
        return { text, colorClass, icon, isOverdue };
    };

    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
    const subtasksCount = task.subtasks?.length || 0;
    const subtasksCompleted = task.subtasks?.filter(s => s.completed).length || 0;
    const assignedMember = activeGroup?.members?.find(m => m.id === task.assignedTo);
    const attachmentsCount = task.attachments?.length || 0;
    const commentsCount = task.comments?.length || 0;

    // --- Priority Styling ---
    const getPriorityColor = (p: Priority = 'medium') => {
        switch(p) {
            case 'high': return 'bg-rose-500 shadow-glow shadow-rose-500/40';
            case 'medium': return 'bg-amber-500 shadow-glow shadow-amber-500/40';
            case 'low': return 'bg-sky-500 shadow-glow shadow-sky-500/40';
            default: return 'bg-slate-300';
        }
    };
    
    const priorityColor = getPriorityColor(task.priority);

    return (
        <div 
            draggable={isDraggable}
            onDragStart={(e) => {
                onDragStart(e, task.id);
            }}
            onDragEnd={onDragEnd}
            onDragOver={onDragOver}
            onDragEnter={(e) => {
                if(isDraggable) {
                    e.preventDefault();
                    onDragEnter(task.id);
                }
            }}
            onDrop={(e) => onDrop(e, task.id)}
            onClick={() => onEdit(task)}
            className={`group relative pl-5 pr-5 py-5 rounded-[1.8rem] transition-all duration-500 cubic-bezier(0.23, 1, 0.32, 1) cursor-pointer mb-3 backdrop-blur-xl border border-white/60 overflow-hidden transform-gpu animate-slide-up
                ${task.completed 
                    ? 'opacity-60 bg-slate-50/40 shadow-none scale-[0.98] grayscale-[0.05]' 
                    : 'bg-white/70 hover:bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 hover:border-white'
                }
                ${isDraggable ? 'active:cursor-grabbing cursor-grab active:scale-[0.98]' : ''} 
                ${isDragging ? 'opacity-40 scale-[0.95] rotate-1 border-dashed border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200 shadow-none grayscale' : ''}
                ${isDragOver && !isDragging ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-100 scale-[1.02] z-20 shadow-2xl bg-white rotate-0' : ''}
                ${deadlineInfo?.isOverdue && !task.completed ? 'ring-1 ring-rose-300 bg-rose-50/30' : ''}
            `}
            style={{ animationDelay: `${Math.min(index * 40, 600)}ms`, animationFillMode: 'both' }}
        >
             {/* Priority Indicator Dot */}
             <div className={`absolute top-5 right-5 w-2.5 h-2.5 rounded-full ${priorityColor} ${task.completed ? 'opacity-30' : 'opacity-100'}`}></div>

             <div className="flex items-start gap-4">
                {/* Checkbox - Fluid Animation */}
                <button 
                  onClick={(e) => onToggle(task, e)} 
                  className={`mt-0.5 w-6 h-6 rounded-[10px] flex items-center justify-center transition-all duration-500 cubic-bezier(0.34, 1.56, 0.64, 1) relative shrink-0 border-2
                    ${task.completed 
                      ? 'bg-emerald-500 border-emerald-500 text-white scale-100 shadow-md shadow-emerald-200 rotate-0' 
                      : 'bg-white border-slate-200 text-transparent hover:border-indigo-300 hover:scale-110 active:scale-90'
                    }
                  `}
                >
                    <Check size={14} strokeWidth={4} className={`transition-all duration-500 ease-out ${task.completed ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-50 -rotate-90'}`}/>
                </button>

                <div className="flex-1 min-w-0 pr-6">
                    {/* Title */}
                    <p className={`text-[16px] font-bold leading-snug transition-all duration-500 line-clamp-2 mb-2.5 ${task.completed ? 'line-through text-slate-400 decoration-slate-300' : 'text-slate-800'}`}>{task.text}</p>
                    
                    {/* Meta Row */}
                    <div className="flex items-center flex-wrap gap-2">
                        {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${deadlineInfo.colorClass}`}>
                                {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                        )}
                        
                        {(subtasksCount > 0) && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-[11px] font-bold text-slate-500 border border-slate-200/50">
                                <ListChecks size={12}/>
                                <span>{subtasksCompleted}/{subtasksCount}</span>
                            </div>
                        )}
                        
                        {attachmentsCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-[11px] font-bold text-slate-500 border border-slate-200/50">
                                <Paperclip size={12}/> <span>{attachmentsCount}</span>
                            </div>
                        )}

                        {commentsCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/80 text-[11px] font-bold text-slate-500 border border-slate-200/50">
                                <MessageSquare size={12}/> <span>{commentsCount}</span>
                            </div>
                        )}

                        {assignedMember && (
                             <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100/80 border border-white">
                                <img src={assignedMember.avatar} className="w-4 h-4 rounded-full" alt=""/>
                                <span className="text-[10px] font-bold text-slate-600 max-w-[60px] truncate">{assignedMember.name}</span>
                             </div>
                        )}
                    </div>
                </div>
             </div>
             
             {/* Delete Action */}
             <button 
                className="absolute bottom-4 right-4 p-2.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300 z-20 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                    e.stopPropagation(); 
                    onDelete(task.id, e);
                }}
             >
                <Trash2 size={18} />
             </button>
        </div>
    );
});

export const TodoList: React.FC<TodoListProps> = ({ activeGroup }) => {
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobal = !!activeGroup;

  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobal);
  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'Người dùng', email: '', avatar: '', provider: null, isLoggedIn: false });

  // Creation State
  const [isInputExpanded, setIsInputExpanded] = useState(false);
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
  const [newCommentText, setNewCommentText] = useState('');
  
  // Drag and Drop State
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  
  // AI Loading States
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const isOnline = useOnlineStatus();

  // UI State
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('manual');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [lastCheckedId, setLastCheckedId] = useState<number | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

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
      setIsInputExpanded(false);
  }, [activeGroup]);

  useEffect(() => {
      if (editingTask && commentsEndRef.current) {
          commentsEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
  }, [editingTask?.comments]);

  // Click outside to collapse input
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          // Check if click is outside and NOT on a date picker or select (which might render in a portal)
          if (inputContainerRef.current && !inputContainerRef.current.contains(event.target as Node)) {
              // Only collapse if empty to avoid accidental data loss
              if (isInputExpanded && !inputValue.trim()) {
                  setIsInputExpanded(false);
                  setShowInputDetails(false);
              }
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInputExpanded, inputValue]);

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return { text: t.today, icon: Sunrise };
    if (hour < 18) return { text: t.today, icon: Sun };
    return { text: t.today, icon: Moon };
  };

  const isToday = (date: Date) => date.toDateString() === new Date().toDateString();

  // --- FILE HANDLING ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode: boolean = false) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const newAtts: Attachment[] = [];
      const filePromises = Array.from(files).map((file: File) => {
          return new Promise<void>((resolve) => {
              if (file.size > 5 * 1024 * 1024) { 
                  alert(`File "${file.name}" quá lớn (Max 5MB).`);
                  resolve();
                  return;
              }
              const reader = new FileReader();
              reader.onloadend = () => {
                  newAtts.push({
                      id: Date.now().toString() + Math.random().toString(),
                      name: file.name,
                      type: file.type.startsWith('image/') ? 'image' : 'file',
                      url: reader.result as string,
                      size: file.size
                  });
                  resolve();
              };
              reader.readAsDataURL(file);
          });
      });

      await Promise.all(filePromises);

      if (newAtts.length > 0) {
          if (isEditMode && editingTask) {
              setEditingTask(prev => prev ? {
                  ...prev,
                  attachments: [...(prev.attachments || []), ...newAtts]
              } : null);
          } else {
              setNewAttachments(prev => [...prev, ...newAtts]);
              setShowInputDetails(true);
          }
      }
      e.target.value = ''; 
  };

  const removeAttachment = (attId: string, isEditMode: boolean = false) => {
      if (isEditMode && editingTask) {
          setEditingTask(prev => prev ? {
              ...prev,
              attachments: (prev.attachments || []).filter(a => a.id !== attId)
          } : null);
      } else {
          setNewAttachments(prev => prev.filter(a => a.id !== attId));
      }
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDragStart = (e: React.DragEvent, id: number) => {
      setDragId(id);
      e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (id: number) => {
      if (dragId !== null && dragId !== id) {
          setDragOverId(id);
      }
  };

  const handleDragEnd = () => {
      setDragId(null);
      setDragOverId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
      e.preventDefault();
      if (dragId === null || dragId === targetId) {
          handleDragEnd();
          return;
      }

      const sourceIndex = tasks.findIndex(t => t.id === dragId);
      const targetIndex = tasks.findIndex(t => t.id === targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
          const newTasks = [...tasks];
          const [movedTask] = newTasks.splice(sourceIndex, 1);
          newTasks.splice(targetIndex, 0, movedTask);
          setTasks(newTasks);
      }
      handleDragEnd();
  };

  // --- AI HANDLERS ---
  const handleAiRefineText = async () => {
      if (!editingTask || !isOnline) return;
      setIsAiProcessing(true);
      try {
          const refined = await refineTaskTextWithGemini(editingTask.text);
          setEditingTask(prev => prev ? { ...prev, text: refined } : null);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const handleAiGenerateSubtasks = async () => {
      if (!editingTask || !isOnline) return;
      setIsAiProcessing(true);
      try {
          const steps = await generateSubtasksWithGemini(editingTask.text);
          const newSubtasks: Subtask[] = steps.map(step => ({
              id: Date.now() + Math.random(),
              text: step,
              completed: false
          }));
          const updatedSubtasks = [...(editingTask.subtasks || []), ...newSubtasks];
          
          const completedCount = updatedSubtasks.filter(st => st.completed).length;
          const progress = updatedSubtasks.length > 0 ? Math.round((completedCount / updatedSubtasks.length) * 100) : editingTask.progress;

          setEditingTask(prev => prev ? { 
              ...prev, 
              subtasks: updatedSubtasks,
              progress: progress,
              completed: progress === 100
          } : null);
      } catch (e) {
          console.error(e);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const addSubtask = () => { 
      if (!editingTask || !newSubtaskText.trim()) return; 
      const newSub: Subtask = { id: Date.now(), text: newSubtaskText.trim(), completed: false }; 
      const updatedSubtasks = [...(editingTask.subtasks || []), newSub]; 
      
      const completedCount = updatedSubtasks.filter(st => st.completed).length;
      const progress = Math.round((completedCount / updatedSubtasks.length) * 100);

      setEditingTask({ 
          ...editingTask, 
          subtasks: updatedSubtasks, 
          progress: progress,
          completed: progress === 100
      }); 
      setNewSubtaskText(''); 
  };
  
  const toggleSubtask = (subId: number) => { 
      if (!editingTask) return; 
      const updatedSubtasks = (editingTask.subtasks || []).map(st => st.id === subId ? { ...st, completed: !st.completed } : st); 
      
      const completedCount = updatedSubtasks.filter(st => st.completed).length;
      const progress = updatedSubtasks.length > 0 ? Math.round((completedCount / updatedSubtasks.length) * 100) : 0;
      const isCompleted = progress === 100;

      if (isCompleted && !editingTask.completed) playSuccessSound();
      
      setEditingTask({ 
          ...editingTask, 
          subtasks: updatedSubtasks, 
          progress: progress,
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : undefined,
          completedBy: isCompleted ? currentUserId : undefined
      }); 
  };
  
  const deleteSubtask = (subId: number) => { 
      if (!editingTask) return; 
      const updatedSubtasks = (editingTask.subtasks || []).filter(st => st.id !== subId);
      
      let progress = editingTask.progress;
      let isCompleted = editingTask.completed;

      if (updatedSubtasks.length > 0) {
          const completedCount = updatedSubtasks.filter(st => st.completed).length;
          progress = Math.round((completedCount / updatedSubtasks.length) * 100);
      } else {
          progress = 0; 
      }
      
      isCompleted = progress === 100 && updatedSubtasks.length > 0;

      setEditingTask({ 
          ...editingTask, 
          subtasks: updatedSubtasks, 
          progress, 
          completed: isCompleted,
          completedAt: isCompleted ? new Date().toISOString() : undefined
      }); 
  };

  const addComment = () => {
      if (!editingTask || !newCommentText.trim()) return;
      const newComment: Comment = {
          id: Date.now().toString(),
          userId: currentUserId,
          userName: userProfile.name || 'User',
          userAvatar: userProfile.avatar || '',
          text: newCommentText.trim(),
          timestamp: Date.now(),
          role: activeGroup?.leaderId === currentUserId ? 'leader' : 'member'
      };
      
      const updatedComments = [...(editingTask.comments || []), newComment];
      setEditingTask({ ...editingTask, comments: updatedComments });
      setNewCommentText('');
  };

  const addTask = () => {
    if (inputValue.trim() === '') return;
    if (activeGroup && !isLeader) { alert(t.leaderOnly); return; }
    
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
      assignedTo: assignedTo || (activeGroup ? undefined : currentUserId), 
      createdBy: currentUserId, 
      attachments: newAttachments,
      subtasks: [],
      comments: []
    };

    setTasks(prev => [newTask, ...prev]);
    
    setInputValue('');
    setDeadline('');
    setAssignedDate('');
    setAssignedTo('');
    setNewPriority('medium'); // Reset priority
    setNewAttachments([]);
    setShowInputDetails(false);
    setIsInputExpanded(false); // Collapse after adding
  };

  const updateTask = () => {
    if (!editingTask) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
    setEditingTask(null);
  };

  const handleProgressChange = useCallback((taskId: number, newProgress: number) => {
      setTasks(prev => prev.map(t => {
          if (t.id === taskId) {
              const isCompleted = newProgress === 100;
              if (isCompleted && !t.completed) playSuccessSound();
              return {
                  ...t,
                  progress: newProgress,
                  completed: isCompleted,
                  completedAt: isCompleted ? new Date().toISOString() : undefined,
                  completedBy: isCompleted ? currentUserId : undefined
              };
          }
          return t;
      }));
  }, [setTasks, currentUserId]);

  const handleToggleClick = useCallback((task: Task, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (task.archived) return; 
    setLastCheckedId(task.id);
    setTimeout(() => setLastCheckedId(null), 500);

    if (task.completed) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: false, progress: 0, completedAt: undefined, completedBy: undefined, completionNote: undefined } : t));
    }
    else {
      if (activeGroup) { 
          setCompletingTaskId(task.id); 
          setCompletionNote(''); 
      } else {
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
          progress: newCompleted ? 100 : 0
        };
      }
      return task;
    }));
  };

  const deleteTask = useCallback((id: number, e?: React.MouseEvent) => { 
      if (e) {
        e.stopPropagation(); 
        e.preventDefault();
      }
      if (window.confirm(t.deleteTaskConfirm)) { 
          setTasks(prev => prev.filter(t => t.id !== id)); 
          if (editingTask?.id === id) {
              setEditingTask(null); 
          }
      } 
  }, [editingTask, setTasks, t]);

  const handleEditClick = useCallback((task: Task) => setEditingTask(task), []);

  const filteredTasks = useMemo(() => {
    const targetDateStr = getLocalDateString(viewDate);
    
    let result = tasks.filter(t => {
        // Handle Archived
        if (filterStatus === 'archived') { 
          if (!t.archived) return false; 
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase()); 
          return true; 
        } 
        if (t.archived) return false;

        // Search Filter
        if (searchQuery && !t.text.toLowerCase().includes(searchQuery.toLowerCase())) { return false; }

        // Specific Group Filters
        if (filterStatus === 'assigned_to_me') { 
          return t.assignedTo === currentUserId && !t.completed; 
        }
        if (filterStatus === 'delegated') { 
          if (t.createdBy) {
             return t.createdBy === currentUserId && t.assignedTo && t.assignedTo !== currentUserId && !t.completed;
          }
          return t.assignedTo && t.assignedTo !== currentUserId && !t.completed; 
        }

        const tDate = new Date(t.createdAt);
        const isSameDay = getLocalDateString(tDate) === targetDateStr;
        if (!isSameDay) return false;
        
        if (filterStatus === 'active') return !t.completed;
        if (filterStatus === 'completed') return t.completed;
        
        return true;
    });

    // ROBUST SORTING LOGIC
    return result.sort((a, b) => {
        // Priority Value Helper
        const getPrioVal = (p?: Priority) => p === 'high' ? 3 : p === 'medium' ? 2 : 1;

        switch (sortOption) {
            case 'priority':
                if (getPrioVal(a.priority) !== getPrioVal(b.priority)) {
                    return getPrioVal(b.priority) - getPrioVal(a.priority);
                }
                break;
            case 'deadline':
                // Tasks with deadlines come first, sorted by nearest
                if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
                if (a.deadline) return -1;
                if (b.deadline) return 1;
                break;
            case 'date_new':
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            case 'date_old':
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            case 'manual':
            default:
                if (filterStatus !== 'completed' && filterStatus !== 'archived') {
                    if (a.completed !== b.completed) return a.completed ? 1 : -1;
                }
                return 0; // Keep array order
        }
        
        // Secondary sort for stability: Newest created first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  }, [tasks, viewDate, filterStatus, searchQuery, currentUserId, sortOption]);

  const changeMonth = (delta: number) => { const newDate = new Date(calendarViewDate); newDate.setMonth(calendarViewDate.getMonth() + delta); setCalendarViewDate(newDate); };
  const calendarDays = useMemo(() => { const year = calendarViewDate.getFullYear(); const month = calendarViewDate.getMonth(); const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate(); const days = []; for (let i = 0; i < firstDay; i++) days.push(null); for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i)); return days; }, [calendarViewDate]);

  const headerStyle = useMemo(() => {
    const customBg = currentMember?.headerBackground;
    if (customBg) { const isImage = customBg.startsWith('data:') || customBg.startsWith('http'); const bgValue = isImage ? `url(${customBg})` : customBg; return { background: bgValue, backgroundSize: 'cover', backgroundPosition: 'center', textShadow: '0 2px 10px rgba(0,0,0,0.5)' }; }
    return {};
  }, [currentMember]);
  
  const headerClasses = useMemo(() => {
    if (currentMember?.headerBackground) return "pt-4 pb-4 px-6 relative z-10 shrink-0 text-white transition-all duration-500 bg-slate-900 shadow-xl rounded-b-[2.5rem] lg:rounded-b-[3rem] mb-2 mx-0 lg:mx-4 mt-0 lg:mt-4";
    return "pt-2 pb-2 px-6 relative z-10 shrink-0 transition-all duration-500 rounded-b-[2.5rem] lg:rounded-b-none mb-2 bg-transparent sticky top-0";
  }, [currentMember]);

  const greeting = getGreeting();
  const GreetingIcon = greeting.icon;

  const filterConfig: Record<FilterType, { icon: any, label: string, colorClass: string, shadowClass: string }> = {
    all: { icon: Layers, label: t.all, colorClass: 'bg-slate-800 text-white', shadowClass: 'shadow-slate-500/20' },
    active: { icon: Zap, label: t.active, colorClass: 'bg-indigo-600 text-white', shadowClass: 'shadow-indigo-500/20' },
    completed: { icon: CheckCircle2, label: t.completed, colorClass: 'bg-emerald-600 text-white', shadowClass: 'shadow-emerald-500/20' },
    assigned_to_me: { icon: User, label: t.assigned_to_me, colorClass: 'bg-blue-600 text-white', shadowClass: 'shadow-blue-500/20' },
    delegated: { icon: ArrowRightCircle, label: t.delegated, colorClass: 'bg-orange-600 text-white', shadowClass: 'shadow-orange-500/20' },
    archived: { icon: Archive, label: t.archived, colorClass: 'bg-slate-500 text-white', shadowClass: 'shadow-slate-500/20' },
  };

  const sortOptionsConfig: Record<SortOption, { label: string, icon: any }> = {
      manual: { label: t.sortManual || 'Manual', icon: GripVertical },
      priority: { label: t.sortPriority || 'Priority', icon: Flag },
      date_new: { label: t.newest || 'Newest', icon: ArrowDownWideNarrow },
      date_old: { label: t.oldest || 'Oldest', icon: ArrowUpWideNarrow },
      deadline: { label: t.deadline || 'Deadline', icon: Clock },
  };

  const activeFilters = ['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me', 'delegated'] : []), 'archived'] as FilterType[];

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modal rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in flex flex-col border border-white/60">
              <div className="sticky top-0 bg-white/80 backdrop-blur-xl z-10 p-8 flex items-center justify-between border-b border-slate-100 rounded-t-[2.5rem]">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm border border-indigo-100">
                        <Edit3 size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-800 tracking-tight leading-none">{t.taskDetails}</h3>
                        <p className="text-slate-400 text-sm font-medium mt-1">{t.editTask}</p>
                    </div>
                </div>
                <button onClick={() => setEditingTask(null)} className="p-2 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-200 rounded-full transition-all"><X size={20}/></button>
            </div>
            <div className="p-8 space-y-8">
                {/* Priority Selection in Edit Modal */}
                <div className="flex gap-2 p-2 bg-slate-100 rounded-2xl justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase ml-2 tracking-wider">{t.priority}</span>
                    <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => {
                            const active = editingTask.priority === p;
                            let colors = "";
                            if (p === 'high') colors = active ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-500 hover:bg-rose-100 hover:text-rose-600';
                            if (p === 'medium') colors = active ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'text-slate-500 hover:bg-amber-100 hover:text-amber-600';
                            if (p === 'low') colors = active ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' : 'text-slate-500 hover:bg-sky-100 hover:text-sky-600';
                            return (
                                <button key={p} onClick={() => setEditingTask({...editingTask, priority: p})} className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${colors}`}>
                                    {t[p]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Date Inputs in Edit Modal - Improved Look */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.assignedDate || 'Start'}</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 hover:border-indigo-200 transition-colors focus-within:ring-2 focus-within:ring-indigo-100">
                            <CalendarIcon size={18} className="text-indigo-500" />
                            <input 
                                type="datetime-local" 
                                value={formatForInput(editingTask.createdAt)} 
                                onChange={e => setEditingTask({...editingTask, createdAt: new Date(e.target.value).toISOString()})}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">{t.deadline}</label>
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-3.5 hover:border-indigo-200 transition-colors focus-within:ring-2 focus-within:ring-indigo-100">
                            <CalendarClock size={18} className="text-indigo-500" />
                            <input 
                                type="datetime-local" 
                                value={formatForInput(editingTask.deadline)}
                                onChange={e => setEditingTask({...editingTask, deadline: new Date(e.target.value).toISOString()})}
                                className="bg-transparent text-sm font-bold text-slate-700 outline-none w-full"
                            />
                        </div>
                    </div>
                </div>

                <div className="group relative">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.taskContent}</label>
                        {isOnline && (
                             <button onClick={handleAiRefineText} disabled={isAiProcessing} className="text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                 {isAiProcessing ? <Loader2 size={12} className="animate-spin"/> : t.optimizeAi}
                             </button>
                        )}
                    </div>
                    <textarea rows={3} value={editingTask.text} onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} className="w-full p-5 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-200 focus:bg-white text-lg font-semibold text-slate-800 focus:ring-4 focus:ring-indigo-50 outline-none resize-none placeholder:text-slate-300 transition-all shadow-inner-light"/>
                </div>

                <div className="group">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.progress}</label>
                        <span className="text-sm font-bold text-indigo-600">{editingTask.progress || 0}%</span>
                    </div>
                    <input type="range" min="0" max="100" value={editingTask.progress || 0} onChange={(e) => setEditingTask({...editingTask, progress: Number(e.target.value), completed: Number(e.target.value) === 100})} className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"/>
                </div>

                {/* Subtasks Section */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.subtasksHeader || 'Checklist'}</label>
                        {isOnline && (
                            <button onClick={handleAiGenerateSubtasks} disabled={isAiProcessing} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                {isAiProcessing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} {t.breakdownAi || 'Auto-Breakdown'}
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {editingTask.subtasks?.map(subtask => (
                            <div key={subtask.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-2xl group/sub transition-all hover:shadow-sm hover:border-indigo-100">
                                <button onClick={() => toggleSubtask(subtask.id)} className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${subtask.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'}`}>
                                    {subtask.completed && <Check size={14} className="text-white" />}
                                </button>
                                <span className={`flex-1 text-sm font-medium ${subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{subtask.text}</span>
                                <button onClick={() => deleteSubtask(subtask.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-all p-2 rounded-xl hover:bg-red-50"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {(!editingTask.subtasks || editingTask.subtasks.length === 0) && (
                            <div className="text-center py-4 text-slate-400 text-xs italic bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">{t.addSubtaskPlaceholder || 'No subtasks yet.'}</div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newSubtaskText} 
                            onChange={(e) => setNewSubtaskText(e.target.value)} 
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addSubtask();
                                }
                            }}
                            placeholder={t.addSubtaskPlaceholder || 'Add a step...'} 
                            className="flex-1 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-50 outline-none transition-all placeholder:text-slate-400"
                        />
                        <button onClick={addSubtask} className="p-3.5 bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all shadow-sm">
                            <Plus size={20}/>
                        </button>
                    </div>
                </div>
                 
                 {activeGroup && (
                    <div className="space-y-3">
                         <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Users size={16}/> {t.assignTask}</label>
                         <div className="flex flex-wrap gap-2">
                            {activeGroup.members?.map(member => (
                                <button key={member.id} onClick={() => setEditingTask({...editingTask, assignedTo: editingTask.assignedTo === member.id ? undefined : member.id})} className={`flex items-center gap-2 pr-4 pl-1.5 py-1.5 rounded-full border transition-all ${editingTask.assignedTo === member.id ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm' : 'bg-white border-transparent hover:border-slate-200 text-slate-600'}`}>
                                    <img src={member.avatar} className="w-7 h-7 rounded-full bg-slate-100 object-cover" alt={member.name}/>
                                    <span className="text-xs font-bold">{member.name}</span>
                                    {editingTask.assignedTo === member.id && <CheckCircle2 size={14} className="ml-1 text-indigo-600"/>}
                                </button>
                            ))}
                         </div>
                    </div>
                 )}

                 {/* Comments Section */}
                 {activeGroup && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><MessageSquare size={16} /> Comments</label>
                        <div className="space-y-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-100">
                            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                                {editingTask.comments?.map((comment) => (
                                    <div key={comment.id} className={`flex gap-3 ${comment.userId === currentUserId ? 'flex-row-reverse' : ''}`}>
                                        <img src={comment.userAvatar} className="w-8 h-8 rounded-full bg-white shadow-sm object-cover border border-slate-200" alt=""/>
                                        <div className={`p-3 rounded-2xl max-w-[80%] ${comment.userId === currentUserId ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                                            <p className="text-sm font-medium whitespace-pre-wrap">{comment.text}</p>
                                            <p className={`text-[10px] mt-1 ${comment.userId === currentUserId ? 'text-indigo-200' : 'text-slate-400'}`}>{new Date(comment.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'numeric' })}</p>
                                        </div>
                                    </div>
                                ))}
                                {(!editingTask.comments || editingTask.comments.length === 0) && (
                                    <p className="text-center text-xs text-slate-400 italic py-4">No comments yet.</p>
                                )}
                                <div ref={commentsEndRef} />
                            </div>
                            
                            <div className="flex gap-2 relative">
                                <input 
                                    type="text" 
                                    value={newCommentText} 
                                    onChange={(e) => setNewCommentText(e.target.value)} 
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            addComment();
                                        }
                                    }}
                                    placeholder="Write a comment..." 
                                    className="flex-1 pl-4 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none transition-all"
                                />
                                <button 
                                    onClick={addComment} 
                                    disabled={!newCommentText.trim()}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-600 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-indigo-50 disabled:hover:text-indigo-600"
                                >
                                    <Send size={16}/>
                                </button>
                            </div>
                        </div>
                    </div>
                 )}

                 {/* Leader Evaluation Section */}
                 {activeGroup && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Crown size={16} className="text-amber-500"/> {t.leaderEvaluation}</label>
                        {isLeader ? (
                            <div className="space-y-3 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="text-[10px] font-bold text-amber-600 uppercase">{t.rating}</span>
                                    <div className="flex gap-1">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button 
                                                key={star} 
                                                onClick={() => setEditingTask({...editingTask, leaderRating: star})}
                                                className={`transition-transform hover:scale-110 ${editingTask.leaderRating && editingTask.leaderRating >= star ? 'text-amber-500' : 'text-slate-300'}`}
                                            >
                                                <Star size={20} fill="currentColor" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <textarea 
                                    rows={3} 
                                    placeholder={t.leaderFeedbackPlaceholder} 
                                    value={editingTask.leaderFeedback || ''} 
                                    onChange={(e) => setEditingTask({...editingTask, leaderFeedback: e.target.value})} 
                                    className="w-full p-3 bg-white border border-amber-200 rounded-xl text-sm text-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 outline-none resize-none transition-all placeholder:text-slate-400"
                                />
                            </div>
                        ) : (
                            (editingTask.leaderFeedback || editingTask.leaderRating) ? (
                                <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-2">
                                    {editingTask.leaderRating && (
                                        <div className="flex gap-1 text-amber-500 mb-1">
                                            {Array.from({length: 5}).map((_, i) => (
                                                <Star key={i} size={16} fill={i < (editingTask.leaderRating || 0) ? "currentColor" : "none"} className={i < (editingTask.leaderRating || 0) ? "" : "text-slate-300"} />
                                            ))}
                                        </div>
                                    )}
                                    {editingTask.leaderFeedback && (
                                        <p className="text-sm font-medium text-slate-700 italic">"{editingTask.leaderFeedback}"</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-400 italic pl-1">{t.noData}</p>
                            )
                        )}
                    </div>
                 )}

            </div>
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl p-8 border-t border-slate-100 rounded-b-[2.5rem] flex gap-4">
              <button onClick={(e) => deleteTask(editingTask.id, e)} className="p-4 rounded-2xl text-rose-500 font-bold bg-rose-50 hover:bg-rose-100 transition-all"><Trash2 size={24}/></button>
              <button onClick={updateTask} className="flex-1 py-4 rounded-2xl text-white font-bold text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce">{t.saveChanges}</button>
            </div>
          </div>
        </div>
      )}

      {/* CALENDAR MODAL */}
      {showCalendar && (
        <div onClick={() => setShowCalendar(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modal bg-white/95 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in border border-white/60">
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
                  <button key={i} onClick={() => { setViewDate(date); setShowCalendar(false); }} className={`aspect-square rounded-2xl flex items-center justify-center text-sm font-bold transition-all relative ${isSelected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-110' : 'text-slate-700 hover:bg-slate-50'}`}>
                    {date.getDate()}
                    {isCurrentToday && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 rounded-full bg-indigo-500"></div>}
                  </button>
                );
              })}
            </div>
             <button onClick={() => setShowCalendar(false)} className="w-full py-4 text-slate-500 font-bold text-xs uppercase tracking-widest hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-colors">{t.close}</button>
          </div>
        </div>
      )}

      {/* Header Area */}
      <div className={headerClasses} style={headerStyle}>
        {currentMember?.headerBackground && <div className="absolute inset-0 bg-black/40 z-[-1] rounded-b-[2.5rem]"></div>}
        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
          <div className="flex justify-between items-end pt-2 px-2">
             <div>
                 <div className="flex items-center gap-2 mb-2 animate-fade-in">
                     <span className={`text-xs font-bold uppercase tracking-wider ${currentMember?.headerBackground ? 'text-white/80' : 'text-slate-400'}`}>{greeting.text}, {userProfile.name}</span>
                 </div>
                 <h2 className={`text-3xl md:text-4xl font-black tracking-tight leading-none ${currentMember?.headerBackground ? 'text-white drop-shadow-sm' : 'text-slate-800'}`}>
                    {filterStatus === 'archived' ? t.archived : (activeGroup ? activeGroup.name : (isToday(viewDate) ? t.today : t.custom))}
                 </h2>
                 {!activeGroup && !isToday(viewDate) && <p className={`text-lg font-bold mt-1 ${currentMember?.headerBackground ? 'text-white/80' : 'text-indigo-500'}`}>{viewDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
             </div>
             
             <div className="flex gap-2">
                <button onClick={() => setShowCalendar(true)} className={`group p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm ${currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' : 'bg-white border-white text-slate-500 shadow-slate-200'}`}>
                    <CalendarIcon size={20} className={currentMember?.headerBackground ? "" : "text-indigo-600"}/>
                </button>
                <div className="relative">
                    <button 
                        onClick={() => setShowSortMenu(!showSortMenu)} 
                        className={`p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm ${currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' : 'bg-white border-white text-slate-500 shadow-slate-200'} ${sortOption !== 'manual' ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                    >
                        <ArrowUpDown size={20} />
                    </button>
                     {showSortMenu && (
                        <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                        <div className="absolute top-14 right-0 bg-white/90 backdrop-blur-xl border border-white p-2 rounded-2xl shadow-xl z-50 min-w-[180px] animate-scale-in origin-top-right ring-1 ring-slate-900/5">
                            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.sortBy}</div>
                            {(Object.keys(sortOptionsConfig) as SortOption[]).map(key => { 
                                const config = sortOptionsConfig[key]; 
                                return (
                                    <button key={key} onClick={() => { setSortOption(key); setShowSortMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-0.5 ${sortOption === key ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                        <config.icon size={16} />
                                        <span>{config.label}</span>
                                        {sortOption === key && <Check size={14} className="ml-auto text-indigo-600"/>}
                                    </button>
                                ) 
                            })}
                        </div>
                        </>
                    )}
                </div>
             </div>
          </div>

          <div className="flex gap-3 relative z-20">
             <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none flex-1 -mx-4 px-4 mask-gradient-x">
              {activeFilters.map(f => {
                const isActive = filterStatus === f;
                const config = filterConfig[f] || filterConfig.all;
                const Icon = config.icon;
                return (
                  <button key={f} onClick={() => setFilterStatus(f)} className={`relative px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2 group border ${isActive ? `${config.colorClass} shadow-lg ${config.shadowClass} scale-105 border-transparent` : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-md backdrop-blur-sm border-transparent'} active:scale-95`}>
                    <Icon size={14} strokeWidth={2.5} /> <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-44 custom-scrollbar space-y-1 relative z-0 pt-2 flex flex-col items-center">
        <div className="w-full max-w-3xl">
            {filteredTasks.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 animate-scale-in py-20">
                <div className="w-32 h-32 bg-slate-50/50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-1 ring-slate-100"><Archive size={48} className="text-slate-300 opacity-50" /></div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em]">{filterStatus === 'archived' ? t.emptyArchived : t.emptyChill}</p>
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
                    onProgressChange={handleProgressChange}
                    isDraggable={sortOption === 'manual' && !searchQuery && filterStatus !== 'completed' && filterStatus !== 'archived'}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragEnd={handleDragEnd}
                    onDrop={handleDrop}
                    isDragging={dragId === task.id}
                    isDragOver={dragOverId === task.id}
                />
            ))
            )}
        </div>
      </div>

      {/* EXPANDABLE COMPACT INPUT */}
      <div className="fixed bottom-6 lg:bottom-8 left-0 right-0 z-[10000] pb-safe flex justify-center pointer-events-none px-4">
          <div 
            ref={inputContainerRef}
            className={`pointer-events-auto bg-white/80 backdrop-blur-[40px] rounded-[2.5rem] shadow-float ring-1 ring-white/60 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex items-center gap-3 relative group ${
                isInputExpanded 
                ? `w-full max-w-2xl p-2 pl-3 bg-white/95 ${showInputDetails ? 'overflow-visible' : 'overflow-hidden'}` 
                : 'w-14 h-14 p-0 hover:scale-110 active:scale-95 cursor-pointer bg-slate-900 border-none text-white overflow-hidden'
            }`}
            onClick={() => !isInputExpanded && setIsInputExpanded(true)}
          >
              {/* COMPACT STATE */}
              {!isInputExpanded && (
                  <div className="w-full h-full flex items-center justify-center">
                      <Plus size={28} strokeWidth={3} />
                  </div>
              )}

              {/* EXPANDED STATE */}
              {isInputExpanded && (
                  <>
                    <button 
                        onClick={(e) => { e.stopPropagation(); setShowInputDetails(!showInputDetails); }} 
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 ${showInputDetails ? 'bg-slate-900 text-white rotate-90 shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                    
                    <div className="flex-1 min-w-0 relative">
                        {/* EXPANDED DETAILS PANEL */}
                        {showInputDetails && (
                            <div className="absolute bottom-full left-0 right-0 mb-4 bg-white/95 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl border border-white/50 animate-slide-up origin-bottom z-[10001]">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.taskDetailsCapsule}</label>
                                        <button onClick={() => setShowInputDetails(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
                                    </div>
                                    
                                    {newAttachments.length > 0 && (
                                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                                            {newAttachments.map(att => (
                                                <div key={att.id} className="relative group shrink-0">
                                                    <div className="w-12 h-12 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                                                        {att.type === 'image' ? <img src={att.url} className="w-full h-full object-cover"/> : <FileText size={20} className="text-slate-400"/>}
                                                    </div>
                                                    <button onClick={() => removeAttachment(att.id)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-sm"><X size={10}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-3">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t.assignedDate || 'Start'}</label>
                                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                                                     <CalendarIcon size={14} className="text-indigo-500"/>
                                                     <input type="datetime-local" value={assignedDate} onChange={(e) => setAssignedDate(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none w-full"/>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">{t.deadline || 'Due'}</label>
                                                <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2.5 border border-slate-200">
                                                     <CalendarClock size={14} className="text-indigo-500"/>
                                                     <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="bg-transparent text-xs font-bold text-slate-600 outline-none w-full"/>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            <Flag size={16} className="text-slate-400" />
                                            <div className="flex bg-slate-100 rounded-xl p-1 shrink-0 border border-slate-200 flex-1">
                                                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                                                    const isActive = newPriority === p;
                                                    let activeClass = "";
                                                    if (p === 'low') activeClass = "bg-sky-500 text-white shadow-md";
                                                    if (p === 'medium') activeClass = "bg-amber-500 text-white shadow-md";
                                                    if (p === 'high') activeClass = "bg-rose-500 text-white shadow-md";

                                                    return (
                                                        <button 
                                                            key={p} 
                                                            onClick={() => setNewPriority(p)} 
                                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isActive ? activeClass : 'text-slate-400 hover:text-slate-600'}`}
                                                        >
                                                            {t[p]}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Assign for Groups */}
                                    {activeGroup && (
                                        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
                                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1"><Users size={12}/> {t.assignTask}</label>
                                            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                                                {activeGroup.members?.map(member => (
                                                    <button 
                                                        key={member.id} 
                                                        onClick={() => setAssignedTo(assignedTo === member.id ? '' : member.id)} 
                                                        className={`relative flex-shrink-0 transition-all ${assignedTo === member.id ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                                                    >
                                                        <img src={member.avatar} className={`w-8 h-8 rounded-full object-cover border-2 ${assignedTo === member.id ? 'border-indigo-500' : 'border-transparent'}`} alt={member.name}/>
                                                        {assignedTo === member.id && <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white rounded-full p-0.5"><Check size={8}/></div>}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-2 border-t border-slate-100">
                                        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shrink-0">
                                            <Paperclip size={14}/> {t.attachLabel}
                                        </button>
                                        <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e)} />
                                    </div>
                                </div>
                            </div>
                        )}
                        <input 
                            type="text" 
                            value={inputValue} 
                            onChange={e => setInputValue(e.target.value)} 
                            onKeyDown={e => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addTask();
                                }
                            }}
                            placeholder={t.newTaskPlaceholder} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-[16px] font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none shadow-sm transition-all" 
                            autoFocus
                        />
                    </div>

                    <div className="flex gap-2">
                        <button 
                            onClick={addTask} 
                            disabled={!inputValue.trim()} 
                            className={`w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 shadow-lg ${inputValue.trim() ? 'bg-indigo-600 text-white hover:scale-110' : 'bg-slate-100 text-slate-300'}`}
                        >
                            <Plus size={22} strokeWidth={3} />
                        </button>
                    </div>
                  </>
              )}
          </div>
      </div>

      {/* GROUP COMPLETION MODAL */}
      {activeGroup && completingTaskId !== null && (
        <div onClick={() => setCompletingTaskId(null)} className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          {/* ... (Existing Completion Modal Code) ... */}
          <div onClick={e => e.stopPropagation()} className="glass-modal bg-white/95 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in border border-white/60">
             <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-sm ring-4 ring-emerald-50"><CheckSquare size={32}/></div>
             <h3 className="text-xl font-bold text-slate-800 mb-2 text-center tracking-tight">{t.completeTaskHeader}</h3>
             <p className="text-sm font-medium text-slate-500 mb-6 text-center">{t.completionNotePrompt}</p>
             <textarea value={completionNote} onChange={(e) => setCompletionNote(e.target.value)} placeholder={t.enterNotePlaceholder} className="w-full p-4 bg-slate-50 border border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-medium outline-none resize-none h-32 mb-6 transition-all shadow-inner" autoFocus />
             <div className="flex gap-4">
                 <button onClick={() => setCompletingTaskId(null)} className="flex-1 py-3 text-slate-500 font-bold text-xs uppercase hover:bg-slate-100 rounded-xl transition-colors">{t.skip}</button>
                 <button onClick={() => { if (completingTaskId !== null) { toggleTask(completingTaskId, true, completionNote); setCompletingTaskId(null); }}} className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs uppercase shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all btn-bounce">{t.confirm}</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};