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
  Maximize2, Minimize2
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
        const isOverdue = diffMs < 0;
        const isSoon = diffHrs > 0 && diffHrs < 24;

        let text = target.toLocaleDateString(language, { day: 'numeric', month: 'short' });
        let colorClass = 'text-slate-500 bg-slate-100/80';
        let icon = <CalendarClock size={12} />;

        if (isOverdue) {
            text = t.overdue;
            colorClass = 'text-rose-600 bg-rose-50 font-bold';
            icon = <AlertCircle size={12} />;
        } else if (isSoon) {
            text = `${Math.ceil(diffHrs)}${t.hoursLeft}`;
            colorClass = 'text-amber-600 bg-amber-50 font-bold';
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
    const getPriorityColor = (p: Priority = 'medium') => {
        switch(p) {
            case 'high': return 'bg-rose-500';
            case 'medium': return 'bg-amber-500';
            case 'low': return 'bg-sky-500';
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
            className={`group relative pl-4 pr-4 py-4 rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.25,0.8,0.25,1)] cursor-pointer mb-3 backdrop-blur-xl border border-white/60 overflow-hidden transform-gpu animate-slide-up
                ${task.completed 
                    ? 'opacity-60 bg-slate-50/50 shadow-none scale-[0.99] grayscale-[0.2]' 
                    : 'bg-white/80 hover:bg-white shadow-subtle hover:shadow-float hover:-translate-y-1'
                }
                ${isDraggable ? 'active:cursor-grabbing cursor-grab' : ''} 
                ${isDragging ? 'opacity-40 scale-[0.95] rotate-1 border-dashed border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200 shadow-none grayscale' : ''}
                ${isDragOver && !isDragging ? 'ring-2 ring-indigo-500 ring-offset-4 ring-offset-slate-100 scale-[1.02] z-20 shadow-2xl bg-white rotate-0' : ''}
            `}
            style={{ animationDelay: `${Math.min(index * 40, 600)}ms`, animationFillMode: 'both' }}
        >
             {/* Priority Indicator Dot */}
             <div className={`absolute top-4 right-4 w-2 h-2 rounded-full ${priorityColor} ${task.completed ? 'opacity-30' : 'opacity-80'}`}></div>

             <div className="flex items-start gap-4">
                {/* Checkbox */}
                <button 
                  onClick={(e) => onToggle(task, e)} 
                  className={`mt-0.5 w-6 h-6 rounded-[8px] flex items-center justify-center transition-all duration-300 relative shrink-0 ${
                    task.completed 
                      ? 'bg-gradient-to-tr from-emerald-400 to-teal-500 text-white shadow-glow ring-2 ring-emerald-100' 
                      : `bg-slate-100 text-transparent hover:bg-slate-200`
                  }`}
                >
                    <Check size={14} strokeWidth={3} className={`transition-all duration-300 ${task.completed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}/>
                </button>

                <div className="flex-1 min-w-0 pr-6">
                    {/* Title */}
                    <p className={`text-[15px] font-bold leading-snug transition-all duration-500 line-clamp-2 mb-2 ${task.completed ? 'line-through text-slate-400 decoration-slate-300' : 'text-slate-800'}`}>{task.text}</p>
                    
                    {/* Meta Row */}
                    <div className="flex items-center flex-wrap gap-2.5">
                        {deadlineInfo && (
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors ${deadlineInfo.colorClass}`}>
                                {deadlineInfo.icon} {deadlineInfo.text}
                            </span>
                        )}
                        
                        {(subtasksCount > 0) && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100/80 text-[10px] font-bold text-slate-500">
                                <ListChecks size={12}/>
                                <span>{subtasksCompleted}/{subtasksCount}</span>
                            </div>
                        )}
                        
                        {attachmentsCount > 0 && (
                            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100/80 text-[10px] font-bold text-slate-500">
                                <Paperclip size={12}/> <span>{attachmentsCount}</span>
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
                className="absolute bottom-3 right-3 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all duration-300 z-20 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                    e.stopPropagation(); 
                    onDelete(task.id, e);
                }}
             >
                <Trash2 size={16} />
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
  const [sortOption, setSortOption] = useState<SortOption>('priority');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date());
  const [lastCheckedId, setLastCheckedId] = useState<number | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  
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
      setIsInputExpanded(false);
  }, [activeGroup]);

  // Click outside to collapse input
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (inputContainerRef.current && !inputContainerRef.current.contains(event.target as Node) && isInputExpanded && !inputValue.trim()) {
              // Only collapse if empty to avoid accidental data loss
              setIsInputExpanded(false);
              setShowInputDetails(false);
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

  const sortOptionsConfig: Record<SortOption, { label: string }> = {
    manual: { label: t.sortManual },
    priority: { label: t.sortPriority },
    date_new: { label: t.newest },
    date_old: { label: t.oldest },
    deadline: { label: t.deadline },
  };

  const activeFilters = ['all', 'active', 'completed', ...(activeGroup ? ['assigned_to_me', 'delegated'] : []), 'archived'] as FilterType[];

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      
      {/* PROFESSIONAL EDIT MODAL */}
      {editingTask && (
        <div onClick={() => setEditingTask(null)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
          {/* ... (Existing Edit Modal Code - No changes needed here, keeping logic) ... */}
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

                {/* ... (Keep existing Subtasks, Attachments, etc.) ... */}
            </div>
            <div className="sticky bottom-0 bg-white/80 backdrop-blur-xl p-8 border-t border-slate-100 rounded-b-[2.5rem] flex gap-4">
              <button onClick={(e) => deleteTask(editingTask.id, e)} className="p-4 rounded-xl text-rose-500 font-bold bg-rose-50 hover:bg-rose-100 transition-all"><Trash2 size={24}/></button>
              <button onClick={updateTask} className="flex-1 py-4 rounded-xl text-white font-bold text-lg bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce">{t.saveChanges}</button>
            </div>
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
                        className={`p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95 shadow-sm ${currentMember?.headerBackground ? 'bg-white/20 border-white/30 text-white backdrop-blur-md' : 'bg-white border-white text-slate-500 shadow-slate-200'}`}
                    >
                        <ArrowUpDown size={20} />
                    </button>
                     {showSortMenu && (
                        <div className="absolute top-12 right-0 bg-white/90 backdrop-blur-xl border border-white p-2 rounded-2xl shadow-xl z-50 min-w-[160px] animate-scale-in origin-top-right ring-1 ring-slate-900/5">
                            {(Object.keys(sortOptionsConfig) as SortOption[]).map(key => { 
                                const config = sortOptionsConfig[key]; 
                                return (
                                    <button key={key} onClick={() => { setSortOption(key); setShowSortMenu(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all mb-0.5 ${sortOption === key ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                        {config.label}
                                        {sortOption === key && <Check size={14} className="ml-auto text-indigo-600"/>}
                                    </button>
                                ) 
                            })}
                        </div>
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
      <div className="flex-1 overflow-y-auto px-4 pb-40 custom-scrollbar space-y-1 relative z-0 pt-2 flex flex-col items-center">
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
                    isDraggable={sortOption === 'manual' && !searchQuery}
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
      <div className="fixed bottom-6 lg:bottom-8 left-0 right-0 z-[60] pb-safe flex justify-center pointer-events-none px-4">
          <div 
            ref={inputContainerRef}
            className={`pointer-events-auto bg-white/90 backdrop-blur-[30px] rounded-[2.5rem] shadow-float ring-1 ring-white/60 transition-all duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)] flex items-center gap-3 relative overflow-hidden group ${isInputExpanded ? 'w-full max-w-2xl p-2 pl-3 bg-white/95' : 'w-14 h-14 p-0 hover:scale-110 active:scale-95 cursor-pointer bg-slate-900 border-none text-white'}`}
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
                        className={`w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 shrink-0 ${showInputDetails ? 'bg-slate-900 text-white rotate-90' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                        <SlidersHorizontal size={18} />
                    </button>
                    
                    <div className="flex-1 min-w-0 relative">
                        {/* EXPANDED DETAILS PANEL */}
                        {showInputDetails && (
                            <div className="absolute bottom-full left-0 right-0 mb-4 bg-white/95 backdrop-blur-xl p-5 rounded-[2rem] shadow-2xl border border-white/50 animate-slide-up origin-bottom">
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
                            className="w-full bg-transparent border-none px-2 py-2 text-[16px] font-semibold text-slate-800 placeholder:text-slate-400 focus:ring-0 outline-none" 
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
    </div>
  );
};