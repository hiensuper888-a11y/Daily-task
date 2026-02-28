import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { 
  Check, Trash2, Plus, Calendar, User, Users, CheckSquare, 
  X, SortAsc, Archive, Sparkles, Settings, Clock, Flag, AlertCircle, CalendarClock, PanelLeft, Send, Search, MoreHorizontal, Layout, Filter, Edit2, ArrowRight, ChevronDown, AlignLeft, Paperclip, Download, Flame
} from 'lucide-react';
import { Task, Subtask, Group, Priority, SortOption, FilterType, UserProfile, Attachment } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { generateSubtasksWithGemini, refineTaskTextWithGemini } from '../services/geminiService';
import { playSuccessSound } from '../utils/sound';
import { supabase } from '../services/supabaseClient';

const StreakFireAnimation = ({ onAnimationEnd }: { onAnimationEnd: () => void }) => {
    useEffect(() => {
        const timer = setTimeout(onAnimationEnd, 2200); // Match animation duration + delay
        return () => clearTimeout(timer);
    }, [onAnimationEnd]);

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center pointer-events-none animate-fade-in">
            <div className="relative text-center">
                <div className="relative w-48 h-48">
                    <Flame size={128} className="absolute inset-0 m-auto text-orange-400 animate-realistic-fire drop-shadow-[0_0_20px_rgba(251,146,60,0.8)]" style={{ animationDuration: '1.2s' }} />
                    <Sparkles size={80} className="absolute inset-0 m-auto text-yellow-300 animate-pulse" style={{ animationDelay: '0.2s', animationDuration: '1.5s' }}/>
                </div>
                <div className="mt-2 text-white text-4xl font-black drop-shadow-lg animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    <p>Chuỗi Giữ Lửa!</p>
                </div>
            </div>
        </div>
    );
};

const StreakCompletionCard = ({ streak, onStartNewTask }: { streak: number, onStartNewTask: () => void }) => {
    const { t } = useLanguage();
    return (
        <div className="m-3 p-6 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-slate-800 dark:to-slate-800/50 rounded-3xl text-center animate-fade-in border border-orange-200/50 dark:border-slate-700">
            <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-500 to-orange-400 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/20 mb-4">
                <Flame size={40} className="text-white animate-realistic-fire" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-white">Chuỗi Giữ Lửa</h3>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-1">Bạn đã hoàn thành tất cả nhiệm vụ trong ngày!</p>
            <p className="text-2xl font-black text-orange-500">{streak} ngày</p>
            <button 
                onClick={onStartNewTask}
                className="mt-4 px-6 py-3 bg-slate-900 dark:bg-indigo-600 text-white rounded-full font-bold text-sm shadow-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all"
            >
                Bắt đầu ngày mới
            </button>
        </div>
    );
};


interface TodoListProps {
  activeGroup: Group | null;
  onOpenSettings: () => void;
  onOpenProfile: () => void;
  onToggleSidebar: () => void;
}

export const TodoList: React.FC<TodoListProps> = ({ activeGroup, onOpenSettings, onOpenProfile, onToggleSidebar }) => {
  const { t, language } = useLanguage();
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  
  // Storage Logic
  const storageKey = activeGroup ? `group_${activeGroup.id}_tasks` : 'daily_tasks';
  const isGlobalStorage = !!activeGroup; 
  
  const [tasks, setTasks] = useRealtimeStorage<Task[]>(storageKey, [], isGlobalStorage);
  const [userProfile, setUserProfile] = useRealtimeStorage<UserProfile>('user_profile', { 
      name: 'User', email: '', avatar: '', provider: null, isLoggedIn: false, uid: '' 
  });
  
  // --- Local State ---
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newDeadline, setNewDeadline] = useState('');
  const [newPriority, setNewPriority] = useState<Priority>('medium');
  const [newAssignee, setNewAssignee] = useState<string>(''); 
  const [showAssigneeList, setShowAssigneeList] = useState(false);

  const [filter, setFilter] = useState<FilterType>('all');
  const [sort, setSort] = useState<SortOption>('date_new'); 
  const [showSortMenu, setShowSortMenu] = useState(false);
  
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'specific' | 'custom'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toLocaleDateString('en-CA'));
  const [customDateStart, setCustomDateStart] = useState('');
  const [customDateEnd, setCustomDateEnd] = useState('');
  const [showDateMenu, setShowDateMenu] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState(''); // New Search State
  
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);

  const handleAnimationEnd = useCallback(() => {
    setShowStreakAnimation(false);
  }, []);

  // Reset input state when switching groups
  useEffect(() => {
      setNewAssignee('');
      setNewPriority('medium');
      setNewDeadline('');
      setIsInputExpanded(false);
      setShowAssigneeList(false);
      setSearchQuery(''); // Reset search on group switch
  }, [activeGroup?.id]);

  // Fetch tasks from Supabase
  useEffect(() => {
      if (currentUserId === 'guest') return;

      const fetchTasks = async () => {
          try {
              let query = supabase.from('tasks').select('raw_data');
              
              if (activeGroup) {
                  // Fetch group tasks
                  // Use raw_data->>groupId
                  query = query.eq('raw_data->>groupId', activeGroup.id);
              } else {
                  // Personal tasks
                  query = query.eq('user_id', currentUserId).is('raw_data->>groupId', null);
              }

              const { data, error } = await query;
              
              if (error) throw error;
              
              if (data) {
                  const fetchedTasks = data.map((row: any) => row.raw_data as Task);
                  setTasks(fetchedTasks);
              }
          } catch (error) {
              console.error('Error fetching tasks:', error);
          }
      };

      fetchTasks();

      // Realtime subscription
      const channel = supabase.channel(`tasks_${storageKey}`)
          .on('postgres_changes', { 
              event: '*', 
              schema: 'public', 
              table: 'tasks',
              filter: activeGroup ? undefined : `user_id=eq.${currentUserId}`
          }, (payload: any) => {
              // Optimize: Handle payload directly instead of refetching
              if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                  const newData = payload.new;
                  const task = newData.raw_data as Task;
                  
                  if (!task) return;

                  // Client-side filtering for groups (since we can't easily filter JSONB in subscription)
                  if (activeGroup) {
                      if (task.groupId !== activeGroup.id) return;
                  } else {
                      // For personal tasks, ensure it's not a group task and belongs to user
                      if (task.groupId) return;
                      if (newData.user_id !== currentUserId) return;
                  }

                  setTasks(prev => {
                      const index = prev.findIndex(t => t.id === task.id);
                      if (index >= 0) {
                          // Update existing
                          const newTasks = [...prev];
                          // Only update if timestamp is newer to avoid overwriting local optimistic updates?
                          // For now, simple replacement to ensure sync.
                          newTasks[index] = task;
                          return newTasks;
                      } else {
                          // Insert new
                          return [task, ...prev];
                      }
                  });
              } else if (payload.eventType === 'DELETE') {
                  const deletedId = payload.old.id; // Assuming id column matches task.id
                  setTasks(prev => prev.filter(t => t.id != deletedId));
              }
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [currentUserId, activeGroup?.id, storageKey]);

  // --- Sync Helper ---
  const syncTaskToSupabase = async (task: Task, isDelete: boolean = false) => {
      if (currentUserId === 'guest') return;
      
      try {
          if (isDelete) {
              await supabase.from('tasks').delete().eq('id', task.id);
          } else {
              await supabase.from('tasks').upsert({
                  id: task.id,
                  user_id: currentUserId,
                  text: task.text,
                  completed: task.completed,
                  created_at: task.createdAt,
                  deadline: task.deadline,
                  priority: task.priority,
                  raw_data: task
              });
          }
      } catch (err) {
          console.error("Failed to sync task to Supabase:", err);
      }
  };

  // --- Handlers ---

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;

    let createdAtDate = new Date();
    if (dateFilter === 'specific' && selectedDate) {
        const [year, month, day] = selectedDate.split('-').map(Number);
        createdAtDate.setFullYear(year, month - 1, day);
    }

    const newTask: Task = {
      id: Date.now(),
      text: newTaskText,
      completed: false,
      progress: 0,
      createdAt: createdAtDate.toISOString(),
      deadline: newDeadline || undefined,
      priority: newPriority,
      subtasks: [],
      createdBy: currentUserId,
      assignedTo: activeGroup ? (newAssignee || currentUserId) : undefined, 
      groupId: activeGroup?.id
    };

    setTasks(prev => [newTask, ...prev]);
    syncTaskToSupabase(newTask);
    
    // Reset form
    setNewTaskText('');
    setNewDeadline('');
    setNewPriority('medium');
    setNewAssignee('');
    setShowAssigneeList(false);
    playSuccessSound(); 
    
    // Keep focus for rapid entry
    inputRef.current?.focus();
  };

  const handleUpdateTask = (taskId: number, updates: Partial<Task>) => {
      setTasks(prev => prev.map(task => {
          if (task.id === taskId) {
              const updatedTask = { ...task, ...updates };
              syncTaskToSupabase(updatedTask);
              return updatedTask;
          }
          return task;
      }));
  };

  const checkAndUpdateStreak = (updatedTasks: Task[]) => {
    if (currentUserId === 'guest') return;
    
    const now = new Date();
    const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    
    // Check if all tasks for today are completed
    const todayTasks = updatedTasks.filter(t => {
        if (t.archived) return false;
        if (!t.completed) return true; // Incomplete tasks carry over
        
        if (t.completedAt) {
            const completedAtStr = new Date(t.completedAt).toLocaleDateString('en-CA');
            return completedAtStr === todayStr;
        }
        
        const createdAtStr = new Date(t.createdAt).toLocaleDateString('en-CA');
        const deadlineStr = t.deadline ? new Date(t.deadline).toLocaleDateString('en-CA') : null;
        return createdAtStr === todayStr || deadlineStr === todayStr;
    });

    if (todayTasks.length === 0) return; // No tasks for today
    const allCompleted = todayTasks.every(t => t.completed);
    if (!allCompleted) return; // Not all completed
    
    let updatedProfile = { ...userProfile };
    let streakChanged = false;

    if (!updatedProfile.lastTaskCompletedDate) {
      updatedProfile.currentStreak = 1;
      updatedProfile.longestStreak = 1;
      updatedProfile.lastTaskCompletedDate = todayStr;
      streakChanged = true;
    } else if (updatedProfile.lastTaskCompletedDate !== todayStr) {
      if (updatedProfile.lastTaskCompletedDate === yesterdayStr) {
        updatedProfile.currentStreak = (updatedProfile.currentStreak || 0) + 1;
      } else {
        updatedProfile.currentStreak = 1; 
      }
      
      if (updatedProfile.currentStreak > (updatedProfile.longestStreak || 0)) {
        updatedProfile.longestStreak = updatedProfile.currentStreak;
      }
      updatedProfile.lastTaskCompletedDate = todayStr;
      streakChanged = true;
    }

    if (streakChanged) {
      const streak = updatedProfile.currentStreak || 0;
      const titles = updatedProfile.unlockedTitles || [];
      let newTitle = '';

      if (streak >= 1825 && !titles.includes('Đấng Sáng Tạo')) newTitle = 'Đấng Sáng Tạo';
      else if (streak >= 1460 && !titles.includes('Vị Thần Thời Gian')) newTitle = 'Vị Thần Thời Gian';
      else if (streak >= 1095 && !titles.includes('Thực Thể Bất Tử')) newTitle = 'Thực Thể Bất Tử';
      else if (streak >= 730 && !titles.includes('Kẻ Thống Trị Kỷ Nguyên')) newTitle = 'Kẻ Thống Trị Kỷ Nguyên';
      else if (streak >= 365 && !titles.includes('Thần Đồng Năng Suất')) newTitle = 'Thần Đồng Năng Suất';
      else if (streak >= 100 && !titles.includes('Huyền Thoại Sống')) newTitle = 'Huyền Thoại Sống';
      else if (streak >= 60 && !titles.includes('Chúa Tể Thời Gian')) newTitle = 'Chúa Tể Thời Gian';
      else if (streak >= 30 && !titles.includes('Bậc Thầy Kỷ Luật')) newTitle = 'Bậc Thầy Kỷ Luật';
      else if (streak >= 14 && !titles.includes('Kẻ Hủy Diệt Deadline')) newTitle = 'Kẻ Hủy Diệt Deadline';
      else if (streak >= 7 && !titles.includes('Chiến Binh Bền Bỉ')) newTitle = 'Chiến Binh Bền Bỉ';
      else if (streak >= 3 && !titles.includes('Ngọn Lửa Nhỏ')) newTitle = 'Ngọn Lửa Nhỏ';
      else if (streak >= 1 && !titles.includes('Tân Binh Chăm Chỉ')) newTitle = 'Tân Binh Chăm Chỉ';

      if (newTitle) {
        updatedProfile.unlockedTitles = [...titles, newTitle];
        
        // Big Fire effect for title
        const duration = 3000;
        const end = Date.now() + duration;

        

        // Use a simple alert or custom toast if available
        setShowStreakAnimation(true);
        setTimeout(() => alert(`🔥 Chúc mừng! Bạn đã đạt danh hiệu mới: ${newTitle} (Streak: ${streak} ngày)`), 500);
      } else {
        // Small fire effect for regular streak increase
        setShowStreakAnimation(true);
      }

      setUserProfile(updatedProfile);
      
      // Update to Supabase
      if (currentUserId !== 'guest') {
          supabase.from('profiles').update({
              current_streak: updatedProfile.currentStreak,
              longest_streak: updatedProfile.longestStreak,
              last_task_completed_date: updatedProfile.lastTaskCompletedDate,
              unlocked_titles: updatedProfile.unlockedTitles
          }).eq('id', currentUserId).then();
      }
    }
  };

  const handleToggleTask = (taskId: number) => {
    const originalTask = tasks.find(t => t.id === taskId);
    if (!originalTask) return;

    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        const newCompleted = !task.completed;
        const now = new Date().toISOString();
        return {
          ...task,
          completed: newCompleted,
          progress: newCompleted ? 100 : (task.subtasks?.length ? task.progress : 0),
          completedAt: newCompleted ? now : undefined,
          completedBy: newCompleted ? currentUserId : undefined
        };
      }
      return task;
    });

    const updatedTask = updatedTasks.find(t => t.id === taskId)!;

    setTasks(updatedTasks);
    syncTaskToSupabase(updatedTask);

    if (!originalTask.completed && updatedTask.completed) {
      playSuccessSound();
      checkAndUpdateStreak(updatedTasks);
    }
  };

  const handleDeleteTask = (taskId: number) => {
    if (confirm(t.deleteTaskConfirm)) {
        const taskToDelete = tasks.find(t => t.id === taskId);
        if (taskToDelete) syncTaskToSupabase(taskToDelete, true);
        
        setTasks(prev => prev.filter(t => t.id !== taskId));
        if (editingTask?.id === taskId) setEditingTask(null);
    }
  };

  const handleArchiveCompleted = () => {
      setTasks(prev => prev.map(t => {
          if (t.completed) {
              const archivedTask = { ...t, archived: true };
              syncTaskToSupabase(archivedTask);
              return archivedTask;
          }
          return t;
      }));
  };

  // --- AI Handlers ---

  const handleAiRefine = async () => {
      if (!editingTask) return;
      setIsAiProcessing(true);
      try {
          const refined = await refineTaskTextWithGemini(editingTask.text);
          setEditingTask(prev => prev ? { ...prev, text: refined } : null);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const handleAiSubtasks = async () => {
      if (!editingTask) return;
      setIsAiProcessing(true);
      try {
          const steps = await generateSubtasksWithGemini(editingTask.text);
          const newSubtasks: Subtask[] = steps.map((s, i) => ({
              id: Date.now() + i,
              text: s,
              completed: false
          }));
          setEditingTask(prev => prev ? { ...prev, subtasks: [...(prev.subtasks || []), ...newSubtasks] } : null);
      } finally {
          setIsAiProcessing(false);
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !editingTask) return;

      // Limit size to 5MB for base64 storage
      if (file.size > 5 * 1024 * 1024) {
          alert("File too large (max 5MB)");
          return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
          const base64 = event.target?.result as string;
          const newAttachment: Attachment = {
              id: Date.now().toString(),
              name: file.name,
              type: file.type,
              url: base64,
              size: file.size,
              createdAt: new Date().toISOString()
          };
          setEditingTask(prev => prev ? {
              ...prev,
              attachments: [...(prev.attachments || []), newAttachment]
          } : null);
      };
      reader.readAsDataURL(file);
  };

  const handleDownload = (attachment: Attachment) => {
      const link = document.createElement('a');
      link.href = attachment.url;
      link.download = attachment.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const removeAttachment = (id: string) => {
      setEditingTask(prev => prev ? {
          ...prev,
          attachments: prev.attachments?.filter(a => a.id !== id)
      } : null);
  };

  const formatSize = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleSaveEdit = () => {
      if (!editingTask) return;
      setTasks(prev => prev.map(t => t.id === editingTask.id ? editingTask : t));
      syncTaskToSupabase(editingTask);
      setEditingTask(null);
  };

  // --- Sorting & Filtering Logic ---

  const cyclePriority = () => {
      if (newPriority === 'medium') setNewPriority('high');
      else if (newPriority === 'high') setNewPriority('low');
      else setNewPriority('medium');
  };

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(t => !t.archived); 

    const today = new Date().toLocaleDateString('en-CA');

    // Global rule: Tasks completed before target date are hidden (unless in custom date view)
    // Incomplete tasks always carry over to the next day.
    if (dateFilter === 'today' || dateFilter === 'specific') {
        const targetDate = dateFilter === 'specific' ? selectedDate : today;
        
        result = result.filter(t => {
            const createdDate = new Date(t.createdAt).toLocaleDateString('en-CA');
            const deadlineDate = t.deadline ? new Date(t.deadline).toLocaleDateString('en-CA') : null;
            const completedDate = t.completedAt ? new Date(t.completedAt).toLocaleDateString('en-CA') : null;

            // If the task was completed on the target date, show it
            if (completedDate === targetDate) return true;
            
            // If the task was created or due on the target date, show it
            if (createdDate === targetDate || deadlineDate === targetDate) return true;

            // Carry over logic: if the task was created BEFORE target date, and is STILL incomplete (or was completed AFTER target date), show it
            if (createdDate < targetDate) {
                if (!t.completed) return true;
                if (completedDate && completedDate > targetDate) return true;
            }

            return false;
        });
    }

    if (filter === 'active') result = result.filter(t => !t.completed);
    else if (filter === 'completed') result = result.filter(t => t.completed);
    else if (filter === 'assigned_to_me' && activeGroup) result = result.filter(t => t.assignedTo === currentUserId);

    // Date Filtering
    if (dateFilter === 'custom' && customDateStart && customDateEnd) {
        const start = new Date(customDateStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customDateEnd);
        end.setHours(23, 59, 59, 999);
        
        result = result.filter(t => {
            const created = new Date(t.createdAt);
            const deadline = t.deadline ? new Date(t.deadline) : null;
            const completed = t.completedAt ? new Date(t.completedAt) : null;
            
            return (created >= start && created <= end) ||
                   (deadline && deadline >= start && deadline <= end) ||
                   (completed && completed >= start && completed <= end);
        });
    }

    // Search Filtering
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(t => 
            t.text.toLowerCase().includes(query) || 
            t.subtasks?.some(st => st.text.toLowerCase().includes(query))
        );
    }

    if (sort === 'priority') {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        result.sort((a, b) => {
            const pA = priorityOrder[a.priority || 'medium'];
            const pB = priorityOrder[b.priority || 'medium'];
            if (pA !== pB) return pB - pA;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    } else if (sort === 'deadline') {
        result.sort((a, b) => {
            if (!a.deadline) return 1; 
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
    } else if (sort === 'date_new') {
        result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return result;
  }, [tasks, filter, sort, activeGroup, currentUserId]);

  const stats = useMemo(() => {
      const total = tasks.filter(t => !t.archived).length;
      const completed = tasks.filter(t => !t.archived && t.completed).length;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      return { total, completed, percent };
  }, [tasks]);

  // --- Theming ---
  
  const memberSettings = useMemo(() => {
      if (!activeGroup) return null;
      return activeGroup.members.find(m => m.id === currentUserId);
  }, [activeGroup, currentUserId]);

  const headerStyle = useMemo(() => {
      let bg = '';
      if (memberSettings?.headerBackground) bg = memberSettings.headerBackground;
      else if (activeGroup?.background) bg = activeGroup.background;
      return bg ? { background: bg, backgroundSize: 'cover', backgroundPosition: 'center' } : {};
  }, [memberSettings, activeGroup]);
  
  const isCustomTheme = !!(memberSettings?.headerBackground || activeGroup?.background);

  const displayDate = useMemo(() => {
      if (dateFilter === 'all') return t.all;
      if (dateFilter === 'custom') return `${customDateStart} - ${customDateEnd}`;
      
      const d = dateFilter === 'specific' ? new Date(selectedDate) : new Date();
      return d.toLocaleDateString(language, { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
  }, [dateFilter, selectedDate, customDateStart, customDateEnd, language, t]);

  // --- Render ---

  return (
    <div className="flex flex-col h-full bg-transparent relative">
      {showStreakAnimation && <StreakFireAnimation onAnimationEnd={handleAnimationEnd} />}
      
      {/* 1. Header Section */}
      <div className="shrink-0 z-50 transition-all duration-500 relative">
          <div className={`pt-4 pb-6 px-6 transition-all duration-500 ${isCustomTheme ? 'bg-black/40 backdrop-blur-xl rounded-b-[2.5rem] shadow-2xl mx-2 mt-2 text-white border-b border-white/10' : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50'}`} style={headerStyle}>
            
            {/* Top Row: Navigation & Actions */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <button onClick={onToggleSidebar} className={`p-2.5 rounded-2xl transition-all active:scale-95 ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-slate-700 text-indigo-900 dark:text-indigo-100 shadow-sm ring-1 ring-indigo-50 dark:ring-slate-700'}`}>
                        <PanelLeft size={20} />
                    </button>
                    
                    <div onClick={activeGroup ? onOpenSettings : onOpenProfile} className="flex items-center gap-3 cursor-pointer group">
                        <div className="relative">
                            <div className={`w-11 h-11 rounded-2xl shadow-lg overflow-hidden ring-2 transition-all ${isCustomTheme ? 'ring-white/30' : 'ring-white dark:ring-slate-700'}`}>
                                <img src={activeGroup ? (activeGroup.avatar || `https://ui-avatars.com/api/?name=${activeGroup.name}`) : (userProfile.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default")} alt="Avatar" className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"/>
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-emerald-500 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-sm"></div>
                        </div>
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2 min-w-0">
                                <h1 className={`text-lg font-black leading-none truncate ${isCustomTheme ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>{activeGroup ? activeGroup.name : t.todoHeader}</h1>
                                {!activeGroup && typeof userProfile.currentStreak === 'number' ? (
                                    <span className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${isCustomTheme ? 'bg-white/20 text-orange-300' : 'bg-orange-50 dark:bg-orange-500/10 text-orange-500'}`}>
                                        <Flame size={12} className="animate-realistic-fire"/> {userProfile.currentStreak}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                                <span className={`text-[11px] font-bold uppercase tracking-widest opacity-70 ${isCustomTheme ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>{displayDate}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    {activeGroup && (
                        <button onClick={onOpenSettings} className={`p-2.5 rounded-2xl transition-all active:scale-95 ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700'}`}>
                            <Settings size={20}/>
                        </button>
                    )}
                    <button onClick={handleArchiveCompleted} className={`p-2.5 rounded-2xl transition-all active:scale-95 group ${isCustomTheme ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 shadow-sm ring-1 ring-slate-100 dark:ring-slate-700'}`} title={t.clearCompleted}>
                        <Archive size={20} className="group-hover:text-indigo-500 transition-colors"/>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="mb-4 relative group">
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${isCustomTheme ? 'text-white/60 group-focus-within:text-white' : 'text-slate-400 dark:text-slate-500 group-focus-within:text-indigo-500 dark:group-focus-within:text-indigo-400'}`}>
                    <Search size={18} />
                </div>
                <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t.search}
                    className={`w-full py-3 pl-10 pr-4 rounded-2xl text-sm font-bold outline-none transition-all ${
                        isCustomTheme 
                        ? 'bg-white/10 text-white placeholder-white/50 border border-white/20 focus:bg-white/20 focus:border-white/40' 
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-700 focus:border-indigo-200 dark:focus:border-indigo-900 focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/20'
                    }`}
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full transition-colors ${isCustomTheme ? 'text-white/60 hover:bg-white/20 hover:text-white' : 'text-slate-400 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300'}`}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Bottom Row: Progress & Filters */}
            <div className="space-y-4">
                 <div className="flex items-center gap-4">
                     <div className="flex-1 relative h-3 bg-slate-200/30 dark:bg-slate-700/30 rounded-full overflow-hidden backdrop-blur-sm shadow-inner">
                         <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out bg-gradient-to-r ${isCustomTheme ? 'from-white/80 to-white' : 'from-indigo-500 to-fuchsia-500'}`} style={{ width: `${stats.percent}%` }}>
                             <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                         </div>
                     </div>
                     <span className={`text-sm font-black min-w-[3rem] text-right ${isCustomTheme ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>{stats.percent}%</span>
                 </div>

                 <div className="flex justify-between items-center gap-2">
                     <div className="flex gap-1.5 p-1 rounded-xl bg-slate-100/50 dark:bg-slate-800/50 backdrop-blur-sm overflow-x-auto scrollbar-none">
                        {(['all', 'active', 'completed'] as FilterType[]).map(f => (
                            <button 
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all duration-300 whitespace-nowrap ${
                                    filter === f 
                                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm scale-105' 
                                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                            >
                                {t[f]}
                            </button>
                        ))}
                     </div>

                     {/* Date Filter Dropdown */}
                     <div className="relative">
                        <button 
                            onClick={() => setShowDateMenu(!showDateMenu)} 
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 ${
                                isCustomTheme 
                                ? 'bg-white/20 text-white hover:bg-white/30' 
                                : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-100'
                            }`}
                        >
                            <Calendar size={14}/>
                            <span className="hidden sm:inline">{dateFilter === 'all' ? t.all : dateFilter === 'today' ? t.today : dateFilter === 'specific' ? 'Ngày cụ thể' : t.custom}</span>
                            <ChevronDown size={12} className={`transition-transform duration-300 ${showDateMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showDateMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowDateMenu(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 p-3 z-50 animate-scale-in origin-top-right max-h-[60vh] overflow-y-auto custom-scrollbar">
                                    <div className="space-y-1 mb-3">
                                        <button onClick={() => { setDateFilter('all'); setShowDateMenu(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${dateFilter === 'all' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            {t.all}
                                        </button>
                                        <button onClick={() => { setDateFilter('today'); setShowDateMenu(false); }} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${dateFilter === 'today' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            {t.today}
                                        </button>
                                        <button onClick={() => setDateFilter('specific')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${dateFilter === 'specific' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            Ngày cụ thể
                                        </button>
                                        <button onClick={() => setDateFilter('custom')} className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${dateFilter === 'custom' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}>
                                            {t.custom}
                                        </button>
                                    </div>

                                    {dateFilter === 'specific' && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2 text-center">Chọn ngày</p>
                                            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
                                        </div>
                                    )}

                                    {dateFilter === 'custom' && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2 text-center">{t.assignedDate}</p>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{t.startDate}</label>
                                                <input type="date" value={customDateStart} onChange={(e) => setCustomDateStart(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">{t.endDate}</label>
                                                <input type="date" value={customDateEnd} onChange={(e) => setCustomDateEnd(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 transition-colors" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                     </div>
                     
                     {/* Sorting Dropdown */}
                     <div className="relative">
                        <button 
                            onClick={() => setShowSortMenu(!showSortMenu)} 
                            className={`px-3 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 active:scale-95 ${
                                isCustomTheme 
                                ? 'bg-white/20 text-white hover:bg-white/30' 
                                : 'bg-white text-slate-600 hover:bg-slate-50 shadow-sm ring-1 ring-slate-100'
                            }`}
                        >
                            {sort === 'priority' ? <Flag size={14} className="text-amber-500"/> : sort === 'deadline' ? <Clock size={14} className="text-rose-500"/> : <AlignLeft size={14}/>}
                            <span className="hidden sm:inline">{sort === 'date_new' ? t.newest : sort === 'priority' ? t.priority : t.deadline}</span>
                            <ChevronDown size={12} className={`transition-transform duration-300 ${showSortMenu ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-50 animate-scale-in origin-top-right">
                                    <button 
                                        onClick={() => { setSort('date_new'); setShowSortMenu(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${sort === 'date_new' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <AlignLeft size={14}/> {t.newest}
                                    </button>
                                    <button 
                                        onClick={() => { setSort('priority'); setShowSortMenu(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${sort === 'priority' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <Flag size={14}/> {t.priority}
                                    </button>
                                    <button 
                                        onClick={() => { setSort('deadline'); setShowSortMenu(false); }}
                                        className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${sort === 'deadline' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                                    >
                                        <Clock size={14}/> {t.deadline}
                                    </button>
                                </div>
                            </>
                        )}
                     </div>
                 </div>
            </div>
          </div>
      </div>

      {/* 2. Task List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-32 pt-2 space-y-3">
        {filteredTasks.length === 0 && stats.total > 0 && stats.percent === 100 ? (
              <StreakCompletionCard streak={userProfile.currentStreak || 0} onStartNewTask={() => setIsInputExpanded(true)} />
          ) : filteredTasks.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 animate-fade-in">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-50 to-white rounded-[2rem] flex items-center justify-center mb-4 shadow-sm ring-1 ring-indigo-50">
                      <Sparkles size={40} className="text-indigo-200 animate-pulse"/>
                  </div>
                  <p className="font-bold text-sm text-slate-400">{t.emptyTasks}</p>
                  <p className="text-xs font-semibold text-slate-300 mt-1">{t.emptyChill}</p>
              </div>
          ) : (
              <div className="space-y-3 pb-24">
                  {filteredTasks.map((task, index) => (
                      <TaskItem 
                        key={task.id} 
                        task={task} 
                        index={index}
                        onToggle={() => handleToggleTask(task.id)}
                        onEdit={() => setEditingTask(task)}
                        onUpdate={handleUpdateTask}
                        activeGroup={activeGroup}
                      />
                  ))}
              </div>
          )}
      </div>

      {/* 3. Floating Input Bar */}
      {/* Overlay to close expanded input - z-30 to be under bar but over content */}
      <div 
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-30 transition-opacity duration-300 ${isInputExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { setIsInputExpanded(false); setShowAssigneeList(false); }}
      ></div>

      {/* Input Bar Container - z-40 to be below Sidebar (z-200) */}
      <div className={`fixed bottom-0 left-0 right-0 z-40 pb-safe transition-transform duration-500 cubic-bezier(0.32,0.72,0,1) ${isInputExpanded ? 'translate-y-0' : 'translate-y-0'}`}>
          <div className={`mx-auto transition-all duration-300 ${isInputExpanded ? 'max-w-2xl px-4 pb-4' : 'max-w-xl px-4 pb-4 lg:pb-8'}`}>
              <div 
                className={`bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl shadow-float border border-white/50 dark:border-slate-700/50 transition-all duration-300 overflow-hidden relative group ${
                    isInputExpanded ? 'rounded-[2.5rem] p-4 ring-1 ring-black/5 dark:ring-white/5' : 'rounded-full p-2 pr-3 flex items-center gap-3 cursor-text hover:scale-[1.01]'
                }`}
                onClick={() => !isInputExpanded && setIsInputExpanded(true)}
              >
                  {!isInputExpanded && (
                      <div className="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-600 text-white rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30 group-hover:rotate-90 transition-transform duration-500">
                          <Plus size={24} />
                      </div>
                  )}

                  <div className="flex-1 min-w-0">
                      <input
                          ref={inputRef}
                          value={newTaskText}
                          onChange={(e) => setNewTaskText(e.target.value)}
                          onFocus={() => setIsInputExpanded(true)}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddTask(); }}
                          placeholder={t.addTaskPlaceholder}
                          className={`w-full bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 font-bold ${isInputExpanded ? 'text-xl px-2 pt-1 pb-3' : 'text-base'}`}
                      />
                      
                      {isInputExpanded && (
                          <div className="flex items-center gap-2 mt-4 px-1 overflow-x-auto scrollbar-none pb-1 animate-slide-up">
                              {/* Date Picker Button */}
                              <div className="relative shrink-0 group/date">
                                  <button className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newDeadline ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                      <CalendarClock size={16} className={newDeadline ? "text-indigo-500" : "text-slate-400 dark:text-slate-500"} />
                                      {newDeadline ? new Date(newDeadline).toLocaleDateString(language, {day: 'numeric', month: 'short', hour: '2-digit'}) : t.dueDate}
                                  </button>
                                  <input type="datetime-local" value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"/>
                              </div>

                              {/* Priority Pill Selector */}
                              <button onClick={cyclePriority} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newPriority === 'high' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50' : newPriority === 'low' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-800/50'}`}>
                                  <Flag size={16} fill="currentColor" className="opacity-50" /> {t[newPriority]}
                              </button>

                              {/* Assignee Selector */}
                              {activeGroup && (
                                  <button onClick={() => setShowAssigneeList(!showAssigneeList)} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${newAssignee ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-800/50' : 'bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-600/50 hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                      {newAssignee ? (<><img src={activeGroup.members.find(m => m.id === newAssignee)?.avatar} className="w-4 h-4 rounded-full" alt=""/><span className="max-w-[80px] truncate">{activeGroup.members.find(m => m.id === newAssignee)?.name}</span></>) : (<><User size={16} /> {t.assignTask}</>)}
                                  </button>
                              )}
                          </div>
                      )}
                  </div>

                  {isInputExpanded && (
                      <button onClick={handleAddTask} disabled={!newTaskText.trim()} className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 shadow-xl ${newTaskText.trim() ? 'bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 hover:scale-105 hover:rotate-[-10deg]' : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed'}`}>
                          <Send size={24} className={newTaskText.trim() ? "ml-0.5" : ""} />
                      </button>
                  )}
              </div>

              {/* Expanded Assignee List */}
              {isInputExpanded && showAssigneeList && activeGroup && (
                  <div className="mt-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-white dark:border-slate-700 rounded-[2rem] p-4 shadow-2xl animate-slide-up overflow-x-auto">
                      <h4 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 px-1">{t.memberList}</h4>
                      <div className="flex gap-4">
                          {activeGroup.members.map(member => (
                              <button key={member.id} onClick={() => { setNewAssignee(newAssignee === member.id ? '' : member.id); setShowAssigneeList(false); }} className={`flex flex-col items-center gap-2 shrink-0 transition-all ${newAssignee === member.id ? 'opacity-100 scale-110' : 'opacity-60 hover:opacity-100'}`}>
                                  <div className={`w-12 h-12 rounded-2xl p-0.5 border-2 shadow-sm ${newAssignee === member.id ? 'border-indigo-600 dark:border-indigo-400' : 'border-transparent'}`}>
                                      <img src={member.avatar} className="w-full h-full rounded-[0.9rem] object-cover bg-slate-100 dark:bg-slate-700" alt={member.name} />
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 max-w-[60px] truncate">{member.name}</span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}
          </div>
      </div>

      {/* 4. Edit Modal - z-[250] to be above sidebar */}
      {editingTask && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2.5rem] w-full max-w-lg max-h-[85vh] shadow-2xl animate-scale-in flex flex-col overflow-hidden relative ring-1 ring-white/50">
                
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                    <h2 className="text-xl font-black text-slate-800 flex items-center gap-2"><Edit2 size={20} className="text-indigo-500"/> {t.editTask}</h2>
                    <div className="flex gap-2">
                        <button onClick={() => handleDeleteTask(editingTask.id)} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 size={20}/></button>
                        <button onClick={() => setEditingTask(null)} className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-xl transition-colors"><X size={20}/></button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6 bg-slate-50/50">
                    {/* Task Content Input */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.taskContent}</label>
                            <button onClick={handleAiRefine} disabled={isAiProcessing} className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm">
                                <Sparkles size={12}/> {t.optimizeAi}
                            </button>
                        </div>
                        <textarea 
                            value={editingTask.text}
                            onChange={(e) => setEditingTask({ ...editingTask, text: e.target.value })}
                            className="w-full p-5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-800 text-lg outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all min-h-[140px] resize-none shadow-sm"
                        />
                    </div>

                    {/* Meta Data Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Due Date */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t.dueDate}</label>
                            <div className="relative">
                                <input 
                                    type="datetime-local"
                                    value={editingTask.deadline || ''}
                                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                                    className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 shadow-sm transition-all"
                                />
                                <CalendarClock size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            </div>
                        </div>

                        {/* Priority Selection - PILL STYLE */}
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">{t.priority}</label>
                            <div className="flex gap-2">
                                {(['low', 'medium', 'high'] as Priority[]).map(p => {
                                    const isActive = editingTask.priority === p;
                                    let activeClass = '';
                                    if (p === 'high') activeClass = 'bg-rose-500 text-white shadow-lg shadow-rose-200 ring-2 ring-rose-200 ring-offset-1';
                                    else if (p === 'medium') activeClass = 'bg-amber-500 text-white shadow-lg shadow-amber-200 ring-2 ring-amber-200 ring-offset-1';
                                    else activeClass = 'bg-emerald-500 text-white shadow-lg shadow-emerald-200 ring-2 ring-emerald-200 ring-offset-1';

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setEditingTask({ ...editingTask, priority: p })}
                                            className={`flex-1 py-3 rounded-full text-xs font-bold capitalize transition-all duration-300 ${isActive ? activeClass : 'bg-white border border-slate-200 text-slate-400 hover:border-slate-300 hover:bg-slate-50'}`}
                                        >
                                            {t[p]}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Subtasks */}
                    <div className="space-y-3">
                         <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.subtasksHeader}</label>
                            <button onClick={handleAiSubtasks} disabled={isAiProcessing} className="text-[10px] font-bold text-fuchsia-600 bg-fuchsia-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-fuchsia-100 transition-colors border border-fuchsia-100 shadow-sm">
                                <Sparkles size={12}/> {t.breakdownAi}
                            </button>
                        </div>
                        <div className="bg-white rounded-3xl p-2 space-y-1 border border-slate-200 shadow-sm">
                             {editingTask.subtasks?.map((st, i) => (
                                 <div key={st.id} className="flex items-center gap-3 group p-2 hover:bg-slate-50 rounded-2xl transition-colors">
                                     <button 
                                        onClick={() => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].completed = !newSt[i].completed;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${st.completed ? 'bg-emerald-500 border-emerald-500 text-white scale-110' : 'bg-transparent border-slate-300 text-transparent'}`}
                                     >
                                         <Check size={14} strokeWidth={3}/>
                                     </button>
                                     <input 
                                        value={st.text}
                                        onChange={(e) => {
                                            const newSt = [...(editingTask.subtasks || [])];
                                            newSt[i].text = e.target.value;
                                            setEditingTask({ ...editingTask, subtasks: newSt });
                                        }}
                                        className={`flex-1 bg-transparent text-sm font-semibold outline-none ${st.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}
                                     />
                                     <button onClick={() => {
                                         const newSt = editingTask.subtasks?.filter((_, idx) => idx !== i);
                                         setEditingTask({ ...editingTask, subtasks: newSt });
                                     }} className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-rose-50 rounded-lg"><X size={14}/></button>
                                 </div>
                             ))}
                             <button onClick={() => setEditingTask({ ...editingTask, subtasks: [...(editingTask.subtasks || []), { id: Date.now(), text: '', completed: false }] })} className="w-full py-3 flex items-center justify-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all border border-dashed border-slate-200 hover:border-indigo-200">
                                 <Plus size={14}/> {t.add}
                             </button>
                        </div>
                    </div>

                    {/* Attachments */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-1">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.attachments}</label>
                            <label className="cursor-pointer text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 hover:bg-indigo-100 transition-colors border border-indigo-100 shadow-sm">
                                <Paperclip size={12}/> {t.add}
                                <input type="file" className="hidden" onChange={handleFileUpload} />
                            </label>
                        </div>
                        <div className="space-y-2">
                            {editingTask.attachments?.map((at) => (
                                <div key={at.id} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-2xl group hover:border-indigo-200 transition-all shadow-sm">
                                    <div className="p-2 bg-slate-50 rounded-xl text-slate-400 group-hover:text-indigo-500 transition-colors">
                                        <Paperclip size={16}/>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-700 truncate">{at.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">{formatSize(at.size || 0)}</p>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => handleDownload(at)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                            <Download size={16}/>
                                        </button>
                                        <button onClick={() => removeAttachment(at.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                                            <X size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(!editingTask.attachments || editingTask.attachments.length === 0) && (
                                <div className="py-8 border-2 border-dashed border-slate-100 rounded-[2rem] flex flex-col items-center justify-center text-slate-300">
                                    <Paperclip size={24} className="mb-2 opacity-20"/>
                                    <p className="text-[10px] font-bold uppercase tracking-widest">{t.noAttachments}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Save Button */}
                <div className="p-6 border-t border-slate-100 bg-white z-10">
                    <button onClick={handleSaveEdit} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-[0.98] hover:scale-[1.01]">
                        {t.saveChanges}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

// --- Task Item Component ---

const TaskItem: React.FC<{ 
    task: Task; 
    index: number; 
    onToggle: () => void; 
    onEdit: () => void; 
    onUpdate: (id: number, data: Partial<Task>) => void;
    activeGroup: Group | null; 
}> = ({ task, index, onToggle, onEdit, onUpdate, activeGroup }) => {
    const { t, language } = useLanguage();
    
    // Calculate deadline status
    const deadlineInfo = useMemo(() => {
        if (!task.deadline) return null;
        const now = new Date();
        const d = new Date(task.deadline);
        const diff = d.getTime() - now.getTime();
        const isOverdue = diff < 0;
        const minsLeft = Math.floor(Math.abs(diff) / (1000 * 60));
        const hoursLeft = Math.floor(minsLeft / 60);
        const daysLeft = Math.floor(hoursLeft / 24);
        
        let text = '';
        if (isOverdue) text = hoursLeft < 24 ? `${hoursLeft}h overdue` : `${daysLeft}d overdue`;
        else text = minsLeft < 60 ? `${minsLeft}m left` : hoursLeft < 24 ? `${hoursLeft}h left` : `${daysLeft}d left`;

        return { isOverdue, text, dateStr: d.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) };
    }, [task.deadline, language]);

    // Assigned Date Info
    const assignedDateInfo = useMemo(() => {
        const created = new Date(task.createdAt);
        return {
            dateStr: created.toLocaleDateString(language, { month: 'short', day: 'numeric' }),
            fullDate: created.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
    }, [task.createdAt, language]);

    // Completed Date Info
    const completedDateInfo = useMemo(() => {
        if (!task.completed || !task.completedAt) return null;
        const completed = new Date(task.completedAt);
        return {
            dateStr: completed.toLocaleDateString(language, { month: 'short', day: 'numeric' }),
            timeStr: completed.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' }),
            fullDate: completed.toLocaleString(language, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };
    }, [task.completed, task.completedAt, language]);

    // Priority Styling
    const priority = task.priority || 'medium';
    const priorityColors = {
        high: { 
            bg: 'bg-rose-50 dark:bg-rose-900/20', 
            text: 'text-rose-600 dark:text-rose-400', 
            border: 'border-rose-100 dark:border-rose-900/30', 
            leftBorder: 'border-l-rose-500', 
            pillDot: 'bg-rose-500', 
            icon: 'text-rose-500' 
        },
        medium: { 
            bg: 'bg-amber-50 dark:bg-amber-900/20', 
            text: 'text-amber-600 dark:text-amber-400', 
            border: 'border-amber-100 dark:border-amber-900/30', 
            leftBorder: 'border-l-amber-500', 
            pillDot: 'bg-amber-500', 
            icon: 'text-amber-500' 
        },
        low: { 
            bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
            text: 'text-emerald-600 dark:text-emerald-400', 
            border: 'border-emerald-100 dark:border-emerald-900/30', 
            leftBorder: 'border-l-emerald-500', 
            pillDot: 'bg-emerald-500', 
            icon: 'text-emerald-500' 
        }
    };
    
    const pStyle = priorityColors[priority];
    const assignee = activeGroup && task.assignedTo ? activeGroup.members.find(m => m.id === task.assignedTo) : null;

    // Handlers for Inline Editing
    const cyclePriority = (e: React.MouseEvent) => {
        e.stopPropagation();
        const next: Priority = priority === 'medium' ? 'high' : priority === 'high' ? 'low' : 'medium';
        onUpdate(task.id, { priority: next });
    };

    const handleAssigneeClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!activeGroup) return;
        const members = activeGroup.members;
        const currentIndex = members.findIndex(m => m.id === task.assignedTo);
        const nextIndex = (currentIndex + 1) % members.length;
        onUpdate(task.id, { assignedTo: members[nextIndex].id });
    };

    // Card Base Classes
    const baseClasses = `group relative p-5 rounded-[2rem] transition-all duration-300 cursor-pointer mb-3 transform-gpu animate-slide-up hover:scale-[1.01] active:scale-[0.99] border-2 border-l-8 ${pStyle.leftBorder}`;
    const stateClasses = task.completed 
        ? "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 opacity-60 grayscale-[0.3]"
        : `bg-white dark:bg-slate-800 border-transparent dark:border-slate-700/50 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.08)] hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900/50 ${deadlineInfo?.isOverdue ? 'ring-2 ring-rose-100 dark:ring-rose-900/30 bg-rose-50/20 dark:bg-rose-900/10' : ''}`;

    return (
        <div 
            onClick={onEdit}
            className={`${baseClasses} ${stateClasses}`}
        >
            <div className="flex items-start gap-4">
                {/* Custom Animated Checkbox */}
                <button 
                    onClick={(e) => { e.stopPropagation(); onToggle(); }}
                    className={`w-7 h-7 mt-0.5 rounded-xl border-2 flex items-center justify-center transition-all duration-300 shrink-0 z-10 hover:scale-110 shadow-sm ${
                        task.completed 
                        ? 'bg-slate-800 dark:bg-indigo-600 border-slate-800 dark:border-indigo-600 text-white animate-check-bounce' 
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-transparent hover:border-indigo-300 dark:hover:border-indigo-500'
                    }`}
                >
                    <Check size={16} strokeWidth={4} />
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        {/* Task Title */}
                        <div className="w-full mr-2">
                            <p className={`w-full bg-transparent text-base font-bold leading-snug transition-all ${task.completed ? 'text-slate-400 dark:text-slate-500 line-through decoration-slate-300 dark:decoration-slate-600 decoration-2' : 'text-slate-800 dark:text-slate-100'}`}>
                                {task.text || t.taskContent}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center flex-wrap gap-2 mt-2">
                         {/* Assigned Date Badge */}
                         {assignedDateInfo && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg flex items-center gap-1.5 border bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700" title={t.assignedDate}>
                                <Calendar size={10} strokeWidth={3}/> Giao: {assignedDateInfo.dateStr}
                            </span>
                         )}

                         {/* Completed Date Badge */}
                         {completedDateInfo && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg flex items-center gap-1.5 border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/30" title="Ngày hoàn thành">
                                <Check size={10} strokeWidth={3}/> Xong: {completedDateInfo.dateStr} {completedDateInfo.timeStr}
                            </span>
                         )}

                         {/* Inline Editable Deadline Badge */}
                         <div className="relative group/date" onClick={(e) => e.stopPropagation()}>
                            <span className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg flex items-center gap-1.5 border cursor-pointer transition-colors ${
                                deadlineInfo ? (deadlineInfo.isOverdue ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-800/50 hover:bg-rose-100 dark:hover:bg-rose-900/50' : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700') : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-indigo-500 dark:hover:text-indigo-400'
                            }`}>
                                {deadlineInfo ? (deadlineInfo.isOverdue ? <AlertCircle size={10} strokeWidth={3}/> : <Clock size={10} strokeWidth={3}/>) : <CalendarClock size={10} strokeWidth={3}/>} 
                                {deadlineInfo ? `${deadlineInfo.text} (${deadlineInfo.dateStr})` : t.dueDate}
                            </span>
                            <input 
                                type="datetime-local" 
                                value={task.deadline || ''} 
                                onChange={(e) => onUpdate(task.id, { deadline: e.target.value })}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </div>
                        
                        {/* Inline Editable Priority Badge */}
                        <button 
                            onClick={cyclePriority}
                            className={`text-[10px] font-extrabold uppercase tracking-wide px-2.5 py-1 rounded-lg border flex items-center gap-1 transition-all hover:scale-105 active:scale-95 ${pStyle.bg} ${pStyle.text} ${pStyle.border} ${task.completed ? 'opacity-70' : ''}`}
                        >
                            <Flag size={10} fill="currentColor" className={pStyle.icon} />
                            {t[priority]}
                        </button>
                        
                        {/* Inline Editable Assignee Badge */}
                        {activeGroup && (
                            <button 
                                onClick={handleAssigneeClick}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg border transition-all hover:scale-105 active:scale-95 ${assignee ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-900/50' : 'bg-slate-50 dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                            >
                                {assignee ? (
                                    <>
                                        <img src={assignee.avatar} className="w-4 h-4 rounded-md object-cover" alt=""/>
                                        <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 truncate max-w-[80px]">{assignee.name}</span>
                                    </>
                                ) : (
                                    <>
                                        <User size={10} className="text-slate-400 dark:text-slate-500"/>
                                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{t.assignTo}</span>
                                    </>
                                )}
                            </button>
                        )}
                        
                        {/* Subtasks Count */}
                        {task.subtasks && task.subtasks.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                <Layout size={10} />
                                {task.subtasks.filter(s => s.completed).length}/{task.subtasks.length}
                            </div>
                        )}

                        {/* Attachments Count */}
                        {task.attachments && task.attachments.length > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                                <Paperclip size={10} />
                                {task.attachments.length}
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Arrow hint on hover (opens full modal) */}
                <div className="self-center opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 duration-300">
                    <ArrowRight size={16} className="text-slate-300"/>
                </div>
            </div>
        </div>
    );
};
