import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, 
  Archive, ChevronLeft, ChevronRight, X, Search, SlidersHorizontal, 
  CalendarClock, Timer, AlertCircle, 
  Edit3, CheckSquare, ListChecks,
  Sun, Moon, Sunrise, Users, User,
  Layers, Zap, ArrowRightCircle, Check, ArrowUpDown, ArrowDownWideNarrow, ArrowUpWideNarrow, Clock,
  Paperclip, FileText, Loader2,
  MoreVertical, Sparkles, Flag, GripVertical, MessageSquare, Star, Crown
} from 'lucide-react';
import { Task, FilterType, Priority, Group, UserProfile, Attachment, Subtask, SortOption } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useLanguage } from '../contexts/LanguageContext';
import { playSuccessSound } from '../utils/sound';
import { generateSubtasksWithGemini, refineTaskTextWithGemini } from '../services/geminiService';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface TodoListProps {
  activeGroup: Group | null;
}

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
  onDrop
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
  onDrop: (e: React.DragEvent, id: number) => void
}) => {
    
    const { t } = useLanguage();

    const formatDeadline = (isoString: string) => {
        const target = new Date(isoString);
        if (isNaN(target.getTime())) return null;
        const now = new Date();
        const diffMs = target.getTime() - now.getTime();
        const diffHrs = diffMs / (1000 * 60 * 60);
        const isOverdue = diffMs < 0;
        const isSoon = diffHrs > 0 && diffHrs < 24;

        let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short' });
        let colorClass = 'text-slate-500 bg-slate-100 border-slate-200';
        let icon = <CalendarClock size={12} />;

        if (isOverdue) {
            text = t.overdue;
            colorClass = 'text-rose-600 bg-rose-50 border-rose-200 font-bold';
            icon = <AlertCircle size={12} />;
        } else if (isSoon) {
            text = `${Math.ceil(diffHrs)}${t.hoursLeft}`;
            colorClass = 'text-amber-600 bg-amber-50 border-amber-200 font-bold';
            icon = <Timer size={12} />;
        }
        return { text, colorClass, icon, isOverdue };
    };

    const deadlineInfo = task.deadline ? formatDeadline(task.deadline) : null;
    const subtasksCount = task.subtasks?.length || 0;
    const subtasksCompleted = task.subtasks?.filter(s => s.completed).length || 0;
    const assignedMember = activeGroup?.members?.find(m => m.id === task.assignedTo);
    const attachmentsCount = task.attachments?.length || 0;

    // --- Priority Styling ---
    const getPriorityStyles = (p: Priority = 'medium') => {
        switch(p) {
            case 'high': return { 
                border: 'border-l-rose-500', 
                bg: 'bg-rose-50/40 hover:bg-rose-50/80',
                badge: 'text-rose-600 bg-rose-100',
                iconColor: 'text-rose-500'
            };
            case 'medium': return { 
                border: 'border-l-amber-500', 
                bg: 'bg-amber-50/40 hover:bg-amber-50/80',
                badge: 'text-amber-600 bg-amber-100',
                iconColor: 'text-amber-500'
            };
            case 'low': return { 
                border: 'border-l-sky-500', 
                bg: 'bg-sky-50/40 hover:bg-sky-50/80',
                badge: 'text-sky-600 bg-sky-100',
                iconColor: 'text-sky-500'
            };
            default: return { 
                border: 'border-l-slate-300', 
                bg: 'bg-white/60 hover:bg-white',
                badge: 'text-slate-500 bg-slate-100',
                iconColor: 'text-slate-400'
            };
        }
    };

    const pStyles = getPriorityStyles(task.priority);

    return (
        <div 
            draggable={isDraggable}
            onDragStart={(e) => onDragStart(e, task.id)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, task.id)}
            onClick={() => onEdit(task)}
            className={`group relative pl-4 pr-4 py-4 rounded-2xl transition-all duration-300 cursor-pointer mb-3 backdrop-blur-md border border-white/60 shadow-sm hover:shadow-lg hover:-translate-y-0.5 overflow-hidden ${
                task.completed ? 'opacity-60 grayscale-[0.5] bg-slate-50/50' : pStyles.bg
            } ${isDraggable ? 'active:cursor-grabbing cursor-grab' : ''}`}
            style={{ animationDelay: `${Math.min(index * 50, 400)}ms`, animationFillMode: 'both' }}
        >
             {/* Priority Indicator Strip */}
             <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${pStyles.border} transition-colors`}></div>

             <div className="flex items-start gap-3.5">
                {/* Drag Handle or Checkbox */}
                {isDraggable && (
                    <div className="mt-1 text-slate-300 group-hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing">
                        <GripVertical size={20} />
                    </div>
                )}

                <button 
                  onClick={(e) => onToggle(task, e)} 
                  className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300 border-[2px] shadow-sm relative overflow-hidden shrink-0 ${
                    task.completed 
                      ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent text-white scale-110 shadow-glow' 
                      : `bg-white border-slate-300 text-transparent hover:border-indigo-400 group-hover:scale-110`
                  }`}
                >
                    <Check size={14} strokeWidth={4} className={task.completed ? 'animate-check' : 'scale-0'}/>
                </button>

                <div className="flex-1 min-w-0 pr-8">
                    {/* Top Meta Row: Priority & Deadline */}
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {!task.completed && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider border border-transparent ${pStyles.badge}`}>
                                <Flag size={8} fill="currentColor" /> {task.priority || 'MEDIUM'}
                            </span>
                        )}
                        {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border ${deadlineInfo.colorClass}`}>
                                {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                        )}
                        {/* Rating Display */}
                        {task.leaderRating && task.leaderRating > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] bg-yellow-50 text-yellow-600 border border-yellow-200">
                                <Star size={8} fill="currentColor"/> {task.leaderRating}
                            </span>
                        )}
                    </div>
                    
                    <p className={`text-[15px] font-semibold leading-snug transition-all line-clamp-2 ${task.completed ? 'line-through text-slate-400 decoration-slate-400' : 'text-slate-800'}`}>{task.text}</p>
                    
                    {/* Bottom Metadata Row */}
                    {(subtasksCount > 0 || attachmentsCount > 0 || assignedMember || task.leaderFeedback) && (
                        <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-slate-200/50">
                            {subtasksCount > 0 && (
                                <div className="flex items-center gap-1.5 flex-1 max-w-[100px]" title="Subtasks progress">
                                    <ListChecks size={12} className="text-slate-400"/>
                                    <div className="flex-1 h-1 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${(subtasksCompleted/subtasksCount)*100}%` }}></div>
                                    </div>
                                </div>
                            )}
                            {attachmentsCount > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400"><Paperclip size={10}/> {attachmentsCount}</span>}
                            {task.leaderFeedback && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500"><MessageSquare size={10}/></span>}
                            {assignedMember && <img src={assignedMember.avatar} className="w-5 h-5 rounded-full border border-white shadow-sm ml-auto" alt="assignee" title={assignedMember.name}/>}
                        </div>
                    )}
                </div>
             </div>
             
             {/* Delete Action - Improved Hit Area */}
             <button 
                className="absolute top-2 right-2 p-2 text-slate-300 hover:text-rose-500 hover:bg-white/80 rounded-xl transition-all z-20 opacity-0 group-hover:opacity-100"
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
  
  // Drag and Drop State
  const [dragId, setDragId] = useState<number | null>(null);
  
  // AI Loading States
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const isOnline = useOnlineStatus();

  // UI State
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [showSortMenu, setShowSortMenu] = useState(false);
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
      // Optional: Set ghost image or just let default behavior work
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault(); // Necessary to allow dropping
      e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetId: number) => {
      e.preventDefault();
      if (dragId === null || dragId === targetId) return;

      const sourceIndex = tasks.findIndex(t => t.id === dragId);
      const targetIndex = tasks.findIndex(t => t.id === targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
          const newTasks = [...tasks];
          const [movedTask] = newTasks.splice(sourceIndex, 1);
          newTasks.splice(targetIndex, 0, movedTask);
          setTasks(newTasks);
      }
      setDragId(null);
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
        if (filterStatus === 'archived') { 
          if (!t.archived) return false; 
          if (searchQuery) return t.text.toLowerCase().includes(searchQuery.toLowerCase()); 
          return true; 
        } 
        if (t.archived) return false;

        if (searchQuery && !t.text.toLowerCase().includes(searchQuery.toLowerCase())) { return false; }

        if (filterStatus === 'assigned_to_me') { 
          return t.assignedTo === currentUserId && !t.completed; 
        }
        if (filterStatus === 'delegated') { 
          if (t.createdBy) {
             return t.assignedTo && t.assignedTo !== currentUserId && t.createdBy === currentUserId && !t.completed;
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
        // 1. Completed tasks always go to the bottom unless we are looking at archived
        if (filterStatus !== 'completed' && filterStatus !== 'archived') {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
        }

        switch (sortOption) {
            case 'manual':
                return 0; // Maintain array order
            case 'priority': {
                const pMap = { high: 3, medium: 2, low: 1 };
                const pA = pMap[a.priority || 'medium'];
                const pB = pMap[b.priority || 'medium'];
                if (pA !== pB) return pB - pA; // High to Low
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); // Newest first for ties
            }
            case 'date_new':
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            
            case 'date_old':
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            
            case 'deadline': {
                if (!a.deadline && !b.deadline) return 0;
                if (!a.deadline) return 1; // No deadline -> bottom
                if (!b.deadline) return -1;
                const timeDiff = new Date(a.deadline).getTime() - new Date(b.deadline).getTime(); // Nearest first
                if (timeDiff !== 0) return timeDiff;
                const pMap2 = { high: 3, medium: 2, low: 1 };
                return pMap2[b.priority || 'medium'] - pMap2[a.priority || 'medium'];
            }   
            default:
                return 0;
        }
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
    if (currentMember?.headerBackground) return "pt-8 pb-4 px-6 relative z-10 shrink-0 text-white transition-all duration-500 bg-slate-900 shadow-xl rounded-b-[2.5rem] lg:rounded-b-[3rem] mb-2 mx-0 lg:mx-4 mt-0 lg:mt-4";
    return "pt-6 pb-2 px-6 relative z-10 shrink-0 transition-all duration-500 rounded-b-[2.5rem] lg:rounded-b-none mb-2 bg-transparent sticky top-0";
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
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-md animate-fade-in">
          <div onClick={e => e.stopPropagation()} className="glass-modal bg-white/95 rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl animate-scale-in flex flex-col border border-white/60">
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
                <div className="flex gap-2 p-2 bg-slate-100 rounded-xl justify-between items-center">
                    <span className="text-xs font-bold text-slate-500 uppercase ml-2 tracking-wider">{t.priority}</span>
                    <div className="flex gap-1">
                        {(['low', 'medium', 'high'] as Priority[]).map(p => {
                            const active = editingTask.priority === p;
                            let colors = "";
                            if (p === 'high') colors = active ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'text-slate-500 hover:bg-rose-100 hover:text-rose-600';
                            if (p === 'medium') colors = active ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'text-slate-500 hover:bg-amber-100 hover:text-amber-600';
                            if (p === 'low') colors = active ? 'bg-sky-500 text-white shadow-lg shadow-sky-200' : 'text-slate-500 hover:bg-sky-100 hover:text-sky-600';
                            return (
                                <button key={p} onClick={() => setEditingTask({...editingTask, priority: p})} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${colors}`}>
                                    {t[p]}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="group relative">
                    <div className="flex justify-between items-center mb-2">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block">{t.taskContent}</label>
                        {isOnline && (
                             <button onClick={handleAiRefineText} disabled={isAiProcessing} className="text-[10px] font-bold text-violet-600 bg-violet-50 hover:bg-violet-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                 {isAiProcessing ? <Loader2 size={12} className="animate-spin"/> : t.optimizeAi}
                             </button>
                        )}
                    </div>
                    <textarea rows={2} value={editingTask.text} onChange={e => setEditingTask({ ...editingTask, text: e.target.value })} className="w-full p-4 bg-slate-50 rounded-2xl border border-transparent focus:border-indigo-200 focus:bg-white text-lg font-semibold text-slate-800 focus:ring-0 outline-none resize-none placeholder:text-slate-300 transition-all shadow-sm"/>
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
                            <button onClick={handleAiGenerateSubtasks} disabled={isAiProcessing} className="text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                {isAiProcessing ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>} {t.breakdownAi || 'Auto-Breakdown'}
                            </button>
                        )}
                    </div>
                    
                    <div className="space-y-2">
                        {editingTask.subtasks?.map(subtask => (
                            <div key={subtask.id} className="flex items-center gap-3 p-3 bg-white border border-slate-100 rounded-xl group/sub transition-all hover:shadow-sm">
                                <button onClick={() => toggleSubtask(subtask.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${subtask.completed ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300 hover:border-indigo-400'}`}>
                                    {subtask.completed && <Check size={12} className="text-white" />}
                                </button>
                                <span className={`flex-1 text-sm font-medium ${subtask.completed ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{subtask.text}</span>
                                <button onClick={() => deleteSubtask(subtask.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover/sub:opacity-100 transition-all p-1 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                            </div>
                        ))}
                        {(!editingTask.subtasks || editingTask.subtasks.length === 0) && (
                            <div className="text-center py-4 text-slate-400 text-xs italic">{t.addSubtaskPlaceholder || 'No subtasks yet.'}</div>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <input 
                            type="text" 
                            value={newSubtaskText} 
                            onChange={(e) => setNewSubtaskText(e.target.value)} 
                            onKeyDown={(e) => e.key === 'Enter' && addSubtask()}
                            placeholder={t.addSubtaskPlaceholder || 'Add a step...'} 
                            className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:border-indigo-500 focus:bg-white outline-none transition-all placeholder:text-slate-400"
                        />
                        <button onClick={addSubtask} className="p-3 bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white rounded-xl transition-all shadow-sm">
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

                 {/* Leader Evaluation Section */}
                 {activeGroup && (
                    <div className="space-y-3 pt-4 border-t border-slate-100">
                        <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-widest"><Crown size={16} className="text-amber-500"/> {t.leaderEvaluation}</label>
                        {isLeader ? (
                            // Leader View: Editable
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
                            // Member View: Read Only
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
              <button onClick={(e) => deleteTask(editingTask.id, e)} className="p-4 rounded-xl text-rose-500 font-bold bg-rose-50 hover:bg-rose-100 transition-all"><Trash2 size={24}/></button>
              <button onClick={updateTask} className="flex-1 py-4 rounded-xl text-white font-bold text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce">{t.saveChanges}</button>
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
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-start pt-2">
             <div>
                 <div className="flex items-center gap-2 mb-2 animate-fade-in">
                     <GreetingIcon size={16} className={currentMember?.headerBackground ? 'text-yellow-300' : 'text-amber-500'} />
                     <span className={`text-xs font-bold uppercase tracking-wider ${currentMember?.headerBackground ? 'text-white/80' : 'text-slate-500'}`}>{greeting.text}, {userProfile.name}</span>
                 </div>
                 <h2 className={`text-4xl md:text-5xl font-black tracking-tighter leading-none ${currentMember?.headerBackground ? 'text-white drop-shadow-sm' : 'text-slate-900'}`}>
                    {filterStatus === 'archived' ? t.archived : (activeGroup ? activeGroup.name : (isToday(viewDate) ? t.today : t.custom))}
                 </h2>
                 {!activeGroup && !isToday(viewDate) && <p className={`text-lg font-bold mt-1 ${currentMember?.headerBackground ? 'text-white/80' : 'text-indigo-500'}`}>{viewDate.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'long' })}</p>}
             </div>
             <button onClick={() => setShowCalendar(true)} className={`group p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm ${currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' : 'bg-white border-white text-slate-700 shadow-slate-200'}`}>
               <CalendarIcon size={24} className={currentMember?.headerBackground ? "" : "text-indigo-600"}/>
            </button>
          </div>

          <div className="flex gap-3 relative z-20">
             <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-none flex-1 -mx-4 px-4 mask-gradient-x">
              {activeFilters.map(f => {
                const isActive = filterStatus === f;
                const config = filterConfig[f] || filterConfig.all;
                const Icon = config.icon;
                return (
                  <button key={f} onClick={() => setFilterStatus(f)} className={`relative px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-300 flex items-center gap-2 group border ${isActive ? `${config.colorClass} shadow-lg ${config.shadowClass} scale-105 border-white/20` : 'bg-white/60 text-slate-500 hover:bg-white hover:text-slate-900 hover:shadow-md backdrop-blur-sm border-transparent'} active:scale-95`}>
                    <Icon size={14} strokeWidth={2.5} /> <span>{config.label}</span>
                  </button>
                );
              })}
            </div>
             
             {/* SORT BUTTON & DROPDOWN */}
             <div className="relative">
                <button 
                    onClick={() => setShowSortMenu(!showSortMenu)} 
                    className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm ${showSortMenu ? 'bg-indigo-100 text-indigo-600 scale-105' : 'bg-white/60 text-slate-500 hover:bg-white hover:shadow-md backdrop-blur-sm'}`}
                >
                    <ArrowUpDown size={20} />
                </button>
                
                {showSortMenu && (
                    <div className="absolute top-12 right-0 bg-white/90 backdrop-blur-xl border border-white p-2 rounded-2xl shadow-xl z-50 min-w-[180px] animate-scale-in origin-top-right ring-1 ring-slate-900/5">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 mb-1">{t.sortBy}</div>
                        {(Object.keys(sortOptionsConfig) as SortOption[]).map(key => { 
                            const config = sortOptionsConfig[key]; 
                            const Icon = config.icon; 
                            return (
                                <button key={key} onClick={() => { setSortOption(key); setShowSortMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-0.5 ${sortOption === key ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                    <Icon size={16} />
                                    <span>{config.label}</span>
                                    {sortOption === key && <Check size={14} className="ml-auto text-indigo-600"/>}
                                </button>
                            ) 
                        })}
                    </div>
                )}
            </div>

            <button onClick={() => setSearchQuery(searchQuery ? '' : ' ')} className={`w-10 h-10 flex items-center justify-center rounded-2xl transition-all shadow-sm ${searchQuery ? 'bg-indigo-100 text-indigo-600' : 'bg-white/60 text-slate-500 hover:bg-white hover:shadow-md backdrop-blur-sm'}`}>{searchQuery ? <X size={20}/> : <Search size={20} />}</button>
          </div>
          {searchQuery && (<input type="text" autoFocus placeholder={t.search} value={searchQuery === ' ' ? '' : searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full p-4 bg-white/80 backdrop-blur-xl rounded-2xl text-sm font-medium outline-none border border-white focus:ring-2 focus:ring-indigo-500 animate-scale-in shadow-lg shadow-indigo-100/50"/>)}
        </div>
      </div>

      {/* Task List Container */}
      <div className="flex-1 overflow-y-auto px-4 pb-44 custom-scrollbar space-y-1 relative z-0 pt-2">
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300 animate-scale-in">
            <div className="w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner"><Archive size={48} className="text-slate-300 opacity-50" /></div>
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
                isDraggable={sortOption === 'manual' && filterStatus === 'all' && !searchQuery}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
             />
          ))
        )}
      </div>

      {/* FIXED FLOATING CAPSULE INPUT */}
      <div className="fixed bottom-[90px] lg:bottom-6 left-4 right-4 lg:left-[300px] z-[40] pb-safe flex justify-center">
          <div className="w-full max-w-2xl bg-white/80 backdrop-blur-[30px] rounded-[2.5rem] p-2 pl-3 shadow-premium ring-1 ring-white/40 animate-slide-up flex items-center gap-3 group transition-all hover:shadow-[0_25px_60px_-10px_rgba(0,0,0,0.15)]">
              <button 
                onClick={() => setShowInputDetails(!showInputDetails)} 
                className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 ${showInputDetails ? 'bg-slate-900 text-white rotate-90' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
              >
                <SlidersHorizontal size={20} />
              </button>
              
              <div className="flex-1 min-w-0 relative">
                  {/* EXPANDED DETAILS PANEL */}
                  {showInputDetails && (
                      <div className="absolute bottom-full left-0 right-0 mb-4 bg-white/95 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl border border-white/50 animate-slide-up origin-bottom">
                          <div className="flex flex-col gap-4">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.taskDetailsCapsule}</label>
                            
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

                            <div className="flex gap-2">
                                <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)} className="bg-slate-50 rounded-xl text-xs px-3 py-2.5 border border-slate-100 outline-none focus:border-indigo-200 flex-1 font-medium text-slate-600" />
                                
                                <div className="flex bg-slate-100 rounded-xl p-1 shrink-0 border border-slate-200">
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
                                                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${isActive ? activeClass : 'text-slate-400 hover:text-slate-600'}`}
                                            >
                                                {p.substring(0,1)}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs font-bold text-slate-500 hover:text-indigo-600 hover:border-indigo-200 transition-all shrink-0">
                                    <Paperclip size={14}/> {t.attachLabel}
                                </button>
                                <input type="file" multiple ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e)} />

                                {activeGroup && (
                                    <>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mx-1">{t.assignLabel}</span>
                                        {activeGroup.members?.map(member => (
                                            <button
                                                key={member.id}
                                                onClick={() => setAssignedTo(assignedTo === member.id ? '' : member.id)}
                                                className={`relative shrink-0 w-8 h-8 rounded-full border-2 transition-all ${assignedTo === member.id ? 'border-indigo-500 scale-110 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                            >
                                                <img src={member.avatar} className="w-full h-full rounded-full bg-slate-100 object-cover" alt={member.name}/>
                                                {assignedTo === member.id && <div className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full border-2 border-white flex items-center justify-center"><Check size={6} className="text-white"/></div>}
                                            </button>
                                        ))}
                                    </>
                                )}
                            </div>
                          </div>
                      </div>
                  )}
                  <input 
                    type="text" 
                    value={inputValue} 
                    onChange={e => setInputValue(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && addTask()} 
                    placeholder={t.newTaskPlaceholder} 
                    className="w-full bg-transparent border-none px-2 py-2 text-[16px] font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0 outline-none" 
                  />
              </div>

              <button 
                onClick={addTask} 
                disabled={!inputValue.trim() || !inputValue} 
                className={`w-11 h-11 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 shadow-lg ${inputValue.trim() ? (activeGroup ? 'bg-emerald-500 text-white hover:scale-110 hover:bg-emerald-400' : 'bg-indigo-600 text-white hover:scale-110 hover:bg-indigo-500') : 'bg-slate-100 text-slate-300'}`}
              >
                <Plus size={22} strokeWidth={3} />
              </button>
          </div>
      </div>

      {/* GROUP COMPLETION MODAL */}
      {activeGroup && completingTaskId !== null && (
        <div onClick={() => setCompletingTaskId(null)} className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-md animate-fade-in">
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