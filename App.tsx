import React, { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import { Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, Users, Plus, ScanLine, Copy, X, Image as ImageIcon, Settings, UserMinus, Trash2, LogOut, Loader2, Home, ChevronRight, Activity, Search, Check, Edit2, QrCode, Share2, Crown, Shield, Bell, Menu, PanelLeft, LayoutGrid, MoreHorizontal, Sparkles, Clock, UserPlus, Flame } from 'lucide-react';
import { AppTab, Language, Group, UserProfile, Task, GroupMember } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useRealtimeStorage, SESSION_KEY } from './hooks/useRealtimeStorage';
import { useDeadlineNotifications } from './hooks/useDeadlineNotifications';
import { NotificationManager } from './components/NotificationManager';
import { searchUsers } from './services/authService';
import { FloatingDock } from './components/FloatingDock';
import { AuthScreen } from './components/AuthScreen';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';

const TodoList = React.lazy(() => import('./components/TodoList').then(module => ({ default: module.TodoList })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(module => ({ default: module.CalendarView })));
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard').then(module => ({ default: module.AdminDashboard })));

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
];

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full">
    <Loader2 size={32} className="animate-spin text-indigo-500" />
  </div>
);

// --- GLOBAL GROUP HELPERS ---
const GLOBAL_GROUPS_KEY = 'public_groups_db';

const getGlobalGroups = (): Group[] => {
    try {
        return JSON.parse(localStorage.getItem(GLOBAL_GROUPS_KEY) || '[]');
    } catch { return []; }
};

const saveGlobalGroup = async (group: Group) => {
    const groups = getGlobalGroups();
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) {
        groups[index] = group;
    } else {
        groups.push(group);
    }
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new Event('storage'));

    const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
    if (currentUserId !== 'guest') {
        try {
            await supabase.from('groups').upsert({
                id: group.id,
                name: group.name,
                join_code: group.joinCode,
                raw_data: group
            });
        } catch (error) {
            console.error('Error saving group to Supabase:', error);
        }
    }
};

const deleteGlobalGroup = async (groupId: string) => {
    const groups = getGlobalGroups().filter(g => g.id !== groupId);
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new Event('storage'));

    const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
    if (currentUserId !== 'guest') {
        try {
            await supabase.from('groups').delete().eq('id', groupId);
        } catch (error) {
            console.error('Error deleting group from Supabase:', error);
        }
    }
};

const copyToClipboard = (text: string) => {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text);
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            document.execCommand('copy');
            return Promise.resolve();
        } catch (err) {
            console.error('Unable to copy', err);
            return Promise.reject(err);
        } finally {
            document.body.removeChild(textArea);
        }
    }
};

// --- OPTIMIZED SIDEBAR CLOCK ---
const SidebarClock = React.memo(({ language }: { language: string }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="flex flex-col mt-1.5 gap-0.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest opacity-80">
                {currentTime.toLocaleDateString(language, { month: 'short', day: 'numeric' })}
            </span>
            <span className="text-[11px] font-mono text-indigo-300 font-bold tracking-wide">
                {currentTime.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
        </div>
    );
});

const AuthenticatedApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'members' | 'personalize'>('info');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberTitle, setEditMemberTitle] = useState('');
  const [editMemberNote, setEditMemberNote] = useState('');
  
  const personalBgInputRef = useRef<HTMLInputElement>(null);

  const [userProfile, setUserProfile] = useRealtimeStorage<UserProfile>('user_profile', { 
      name: 'Người dùng', email: '', avatar: '', provider: null, isLoggedIn: false, uid: '' 
  });
  
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';

  // --- STREAK CHECK ---
  useEffect(() => {
    if (!userProfile.lastTaskCompletedDate) return;
    
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    
    if (userProfile.lastTaskCompletedDate < yesterdayStr && (userProfile.currentStreak || 0) > 0) {
      setUserProfile(prev => ({ ...prev, currentStreak: 0 }));
      
      if (currentUserId !== 'guest') {
        supabase.from('profiles').update({ current_streak: 0 }).eq('id', currentUserId).then();
      }
    }
  }, [userProfile.lastTaskCompletedDate, userProfile.currentStreak, currentUserId, setUserProfile]);
  
  // Fetch user profile from Supabase
  useEffect(() => {
      if (currentUserId === 'guest') return;

      const fetchProfile = async () => {
          try {
              const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUserId).single();
              if (error) throw error;
              if (data) {
                  setUserProfile(prev => ({
                      ...prev,
                      name: data.display_name || prev.name,
                      avatar: data.avatar_url || prev.avatar,
                      birthYear: data.birth_year || prev.birthYear,
                      hometown: data.hometown || prev.hometown,
                      address: data.address || prev.address,
                      company: data.company || prev.company,
                      phoneNumber: data.phone_number || prev.phoneNumber,
                      jobTitle: data.job_title || prev.jobTitle,
                      department: data.department || prev.department,
                      currentStreak: data.current_streak,
                      longestStreak: data.longest_streak,
                      lastTaskCompletedDate: data.last_task_completed_date,
                      unlockedTitles: data.unlocked_titles || []
                  }));
              }
          } catch (error) {
              console.error('Error fetching profile:', error);
          }
      };

      fetchProfile();

      const channel = supabase.channel(`profile_${currentUserId}`)
          .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'profiles',
              filter: `id=eq.${currentUserId}`
          }, (payload) => {
              const data = payload.new;
              setUserProfile(prev => ({
                  ...prev,
                  name: data.display_name || prev.name,
                  avatar: data.avatar_url || prev.avatar,
                  birthYear: data.birth_year || prev.birthYear,
                  hometown: data.hometown || prev.hometown,
                  address: data.address || prev.address,
                  company: data.company || prev.company,
                  phoneNumber: data.phone_number || prev.phoneNumber,
                  jobTitle: data.job_title || prev.jobTitle,
                  department: data.department || prev.department,
                  currentStreak: data.current_streak,
                  longestStreak: data.longest_streak,
                  lastTaskCompletedDate: data.last_task_completed_date,
                  unlockedTitles: data.unlocked_titles || []
              }));
          })
          .subscribe();

      return () => {
          supabase.removeChannel(channel);
      };
  }, [currentUserId, setUserProfile]);
  
  const activeGroup = useMemo(() => myGroups.find(g => g.id === activeGroupId) || null, [myGroups, activeGroupId]);

  const [personalTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [storageVersion, setStorageVersion] = useState(0);

  // --- PRESENCE HEARTBEAT ---
  useEffect(() => {
    if (!currentUserId || currentUserId === 'guest') return;

    const updatePresence = async () => {
        await supabase.from('profiles').update({ 
            last_seen: new Date().toISOString(),
            is_online: true 
        }).eq('id', currentUserId);
    };

    updatePresence();
    const interval = setInterval(updatePresence, 30000); // Heartbeat every 30s

    const handleUnload = () => {
        supabase.from('profiles').update({ is_online: false }).eq('id', currentUserId).then();
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
        clearInterval(interval);
        window.removeEventListener('beforeunload', handleUnload);
        handleUnload();
    };
  }, [currentUserId]);

  useEffect(() => {
    const handleStorageChange = () => {
      setStorageVersion(prev => prev + 1);
    };
    window.addEventListener('local-storage', handleStorageChange);
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('local-storage', handleStorageChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const lastGroupsRaw = useRef<string>('');

  const syncGroups = useCallback(async () => {
      if (currentUserId === 'guest') {
          const raw = localStorage.getItem(GLOBAL_GROUPS_KEY) || '[]';
          if (raw === lastGroupsRaw.current) return;
          lastGroupsRaw.current = raw;
          try {
              const globalGroups = JSON.parse(raw);
              const relevantGroups = globalGroups.filter((g: Group) => 
                  g.members.some(m => m.id === currentUserId)
              );
              setMyGroups(prev => JSON.stringify(prev) !== JSON.stringify(relevantGroups) ? relevantGroups : prev);
          } catch (e) { console.error("Error parsing groups", e); }
          return;
      }

      try {
          // Fetch groups where user is a member
          const { data, error } = await supabase.from('groups').select('raw_data');
          if (error) throw error;
          
          if (data) {
              const globalGroups = data.map(row => row.raw_data as Group);
              const relevantGroups = globalGroups.filter((g: Group) => 
                  g.members.some(m => m.id === currentUserId)
              );
              setMyGroups(prev => JSON.stringify(prev) !== JSON.stringify(relevantGroups) ? relevantGroups : prev);
          }
      } catch (error) {
          console.error('Error fetching groups from Supabase, falling back to local storage:', error);
          const raw = localStorage.getItem(GLOBAL_GROUPS_KEY) || '[]';
          try {
              const globalGroups = JSON.parse(raw);
              const relevantGroups = globalGroups.filter((g: Group) => 
                  g.members.some(m => m.id === currentUserId)
              );
              setMyGroups(prev => JSON.stringify(prev) !== JSON.stringify(relevantGroups) ? relevantGroups : prev);
          } catch (e) { console.error("Error parsing groups", e); }
      }
  }, [currentUserId]);

  useEffect(() => {
      syncGroups();
      
      window.addEventListener('storage', syncGroups);
      
      if (currentUserId !== 'guest') {
          const channel = supabase.channel('groups_sync')
              .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
                  syncGroups();
              })
              .subscribe();
          return () => { 
              supabase.removeChannel(channel); 
              window.removeEventListener('storage', syncGroups);
          };
      } else {
          const interval = setInterval(syncGroups, 3000); 
          return () => {
              clearInterval(interval);
              window.removeEventListener('storage', syncGroups);
          }
      }
  }, [syncGroups, currentUserId]);

  useEffect(() => {
      if (activeGroupId && !myGroups.find(g => g.id === activeGroupId)) {
          setActiveGroupId(null);
      }
  }, [myGroups, activeGroupId]);

  const allCurrentTasks = useMemo(() => {
    const all = [...personalTasks];
    myGroups.forEach(group => {
        const key = `group_${group.id}_tasks`;
        const stored = localStorage.getItem(key);
        if (stored) {
            try {
                const groupTasks = JSON.parse(stored) as Task[];
                all.push(...groupTasks);
            } catch (e) { /* ignore */ }
        }
    });
    return all;
  }, [personalTasks, myGroups, currentUserId, storageVersion]);

  const { notifications, dismissNotification } = useDeadlineNotifications(allCurrentTasks);

  const resetModalState = () => { setNewGroupName(''); setNewGroupDesc(''); setNewGroupImage(''); setJoinCodeInput(''); };
  
  const handleOpenCreateGroup = () => { setShowGroupModal(true); };
  
  const generateUniqueJoinCode = () => {
      const groups = getGlobalGroups();
      let code = '';
      let isUnique = false;
      while (!isUnique) {
          code = Math.random().toString(36).substring(2, 8).toUpperCase();
          isUnique = !groups.some(g => g.joinCode === code);
      }
      return code;
  };

  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      
      const newGroup: Group = {
          id: Date.now().toString(),
          name: newGroupName,
          description: newGroupDesc,
          leaderId: currentUserId,
          avatar: newGroupImage,
          members: [{ id: currentUserId, name: userProfile.name || 'Người dùng', avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`, role: 'leader', joinedAt: Date.now(), customTitle: 'Trưởng nhóm', note: 'Quản trị viên', headerBackground: '' }],
          joinCode: generateUniqueJoinCode(), 
          createdAt: Date.now()
      };
      saveGlobalGroup(newGroup);
      
      resetModalState(); 
      setShowGroupModal(false); 
      
      // Delay switch to ensure storage has propagated
      setTimeout(() => {
          setActiveGroupId(newGroup.id); 
          setActiveTab('tasks');
      }, 50);

      alert(t.groupCreated);
  };
  
  const handleJoinGroup = () => {
      if(!joinCodeInput) return;
      const existing = myGroups.find(g => g.joinCode === joinCodeInput);
      if(existing) { 
          alert(t.alreadyMember); 
          setActiveGroupId(existing.id); 
          setActiveTab('tasks'); 
          setShowJoinModal(false); 
          resetModalState(); 
          return; 
      }
      const globalGroups = getGlobalGroups(); 
      const targetGroup = globalGroups.find(g => g.joinCode === joinCodeInput);
      if (!targetGroup) { alert(t.invalidCode); return; }
      
      let updatedGroup = targetGroup; 
      const isAlreadyMember = targetGroup.members?.some(m => m.id === currentUserId);
      
      if (!isAlreadyMember) {
          const newMember: GroupMember = { id: currentUserId, name: userProfile.name || 'Thành viên mới', avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`, role: 'member', joinedAt: Date.now(), customTitle: 'Thành viên', note: '', headerBackground: '' };
          updatedGroup = { ...targetGroup, members: [...(targetGroup.members || []), newMember] }; 
          saveGlobalGroup(updatedGroup);
      }
      
      setTimeout(() => {
          setActiveGroupId(updatedGroup.id); 
          setActiveTab('tasks'); 
      }, 50);

      setShowJoinModal(false); 
      resetModalState(); 
      alert(t.groupJoined);
  };

  const handleDeleteGroup = () => { 
      if (!activeGroup || activeGroup.leaderId !== currentUserId) return; 
      if (confirm(`${t.deleteGroup}?`)) { 
          const groupId = activeGroup.id; 
          setActiveGroupId(null); 
          setShowSettingsModal(false); 
          setActiveTab('tasks'); 
          localStorage.removeItem(`group_${groupId}_tasks`); 
          localStorage.removeItem(`group_${groupId}_reflections`);
          deleteGlobalGroup(groupId);
          alert(t.groupDeleted);
      } 
  };

  const handleLeaveGroup = () => { 
      if (!activeGroup) return; 
      if (confirm(`${t.leaveGroup}?`)) { 
          const updatedMembers = (activeGroup.members || []).filter(m => m.id !== currentUserId); 
          const updatedGroup = { ...activeGroup, members: updatedMembers }; 
          saveGlobalGroup(updatedGroup); 
          setActiveGroupId(null); 
          setShowSettingsModal(false); 
          setActiveTab('tasks'); 
      } 
  };
  
  const updateGroupMemberState = (updatedGroup: Group) => {
      saveGlobalGroup(updatedGroup);
  };
  
  const handleSearchUsers = async () => { if (!memberSearchQuery.trim()) return; setIsSearching(true); setHasSearched(true); try { const results = await searchUsers(memberSearchQuery); const existingMemberIds = activeGroup?.members?.map(m => m.id) || []; setFoundUsers(results.filter((u: any) => !existingMemberIds.includes(u.uid))); } catch (error) { console.error(error); } finally { setIsSearching(false); } };
  const handleAddMember = (user: any) => { if (!activeGroup) return; const newMember: GroupMember = { id: user.uid, name: user.name, avatar: user.avatar, role: 'member', joinedAt: Date.now(), customTitle: 'Thành viên', note: '', headerBackground: '' }; const updatedGroup = { ...activeGroup, members: [...(activeGroup.members || []), newMember] }; updateGroupMemberState(updatedGroup); setFoundUsers(foundUsers.filter(u => u.uid !== user.uid)); };
  const handleRemoveMember = (memberId: string) => { if (!activeGroup || activeGroup.leaderId !== currentUserId || memberId === activeGroup.leaderId) return; if(confirm(t.delete)) { const updatedGroup = { ...activeGroup, members: (activeGroup.members || []).filter(m => m.id !== memberId) }; updateGroupMemberState(updatedGroup); alert(t.memberRemoved); } };
  const handleUpdateMemberInfo = (memberId: string) => { if (!activeGroup) return; const updatedMembers = (activeGroup.members || []).map(m => { if (m.id === memberId) return { ...m, customTitle: editMemberTitle, note: editMemberNote }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); setEditingMemberId(null); };
  const handlePromoteMember = (memberId: string) => { if (!activeGroup || activeGroup.leaderId !== currentUserId) return; if (!confirm(t.promoteConfirm)) return; const updatedMembers = activeGroup.members.map(m => { if (m.id === memberId) return { ...m, role: 'leader' as const }; if (m.id === activeGroup.leaderId) return { ...m, role: 'member' as const }; return m; }); const updatedGroup = { ...activeGroup, leaderId: memberId, members: updatedMembers }; updateGroupMemberState(updatedGroup); };
  const handleShareGroup = async () => { if (!activeGroup) return; const text = `${t.shareText} ${activeGroup.joinCode}`; if (navigator.share) { try { await navigator.share({ title: t.shareTitle, text: text, }); } catch (e) { console.log('Error sharing:', e); } } else { copyToClipboard(text); alert(t.copied); } };
  const handleUpdatePersonalGroupSettings = (headerBg: string) => { if (!activeGroup || !activeGroup.members) return; const updatedMembers = activeGroup.members.map(m => { if (m.id === currentUserId) return { ...m, headerBackground: headerBg }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); };
  const handlePersonalBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0]; 
      if (file) { 
          const reader = new FileReader(); 
          reader.onloadend = () => {
              if (reader.result && typeof reader.result === 'string') {
                  handleUpdatePersonalGroupSettings(reader.result);
              }
          };
          reader.readAsDataURL(file); 
      } 
  };

  return (
    <div className="h-full flex flex-col bg-transparent dark:bg-transparent relative font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      {/* SIDEBAR FOR GROUPS (Desktop / Toggle on Mobile) - Z-INDEX 200 */}
      <div className={`fixed inset-y-0 left-0 w-80 bg-[#0B1120] border-r border-white/5 z-[200] transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} shadow-2xl flex flex-col`}>
          {/* TOP SECTION: Header & Identity */}
          <div className="p-6 pb-2 text-white shrink-0">
              <button onClick={() => setIsSidebarOpen(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white transition-colors hover:bg-white/5 rounded-full"><X size={24}/></button>
              
              {/* Identity Card - Premium Look */}
              <div className="mb-4 mt-2 p-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-[1.5rem] border border-white/10 relative overflow-hidden group">
                  <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>

                  <div className="flex items-center gap-4 relative z-10">
                      <div className="relative">
                          <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/10 shadow-lg ring-2 ring-white/5">
                              <img 
                                src={activeGroup ? (activeGroup.avatar || `https://ui-avatars.com/api/?name=${activeGroup.name}`) : (userProfile.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default")} 
                                className="w-full h-full object-cover" 
                                alt="Context Avatar"
                              />
                          </div>
                          <div className="absolute -bottom-1 -right-1 bg-[#0B1120] p-[3px] rounded-full">
                              <div className="bg-emerald-500 w-2.5 h-2.5 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse"></div>
                          </div>
                      </div>
                      <div className="flex-1 min-w-0">
                          <h2 className="text-base font-bold truncate leading-tight text-white/90">
                              {activeGroup ? activeGroup.name : t.personal}
                          </h2>
                          {/* Streak Indicator */}
                          {!activeGroup && userProfile.currentStreak ? (
                              <div className="flex items-center gap-1 text-xs font-bold text-orange-400 mt-1">
                                  <Flame size={12} className="animate-fire-pulse"/> {userProfile.currentStreak} ngày
                              </div>
                          ) : null}
                          {/* OPTIMIZED: CLOCK ISOLATED HERE */}
                          <SidebarClock language={language} />
                      </div>
                  </div>
              </div>
          </div>

          {/* MIDDLE SECTION: Scrollable List */}
          <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0 custom-scrollbar-dark space-y-1.5">
              <button onClick={() => { setActiveGroupId(null); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all border ${!activeGroupId ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 border-indigo-500' : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'}`}>
                  <UserCircle2 size={20} className={!activeGroupId ? "text-indigo-100" : ""}/>
                  <span className="font-bold text-sm">{t.personal}</span>
                  {!activeGroupId && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-glow"></div>}
              </button>

              <div className="pt-4 pb-2 pl-3 flex items-center justify-between group">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t.myGroups}</p>
                  <button onClick={handleOpenCreateGroup} className="text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100" title={t.createGroup}>
                      <Plus size={14} />
                  </button>
              </div>
              
              {myGroups.map(group => (
                  <button key={group.id} onClick={() => { setActiveGroupId(group.id); setIsSidebarOpen(false); }} className={`w-full flex items-center gap-3 p-3.5 rounded-2xl transition-all border group ${activeGroupId === group.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20 border-indigo-500' : 'text-slate-400 hover:text-white hover:bg-white/5 border-transparent'}`}>
                      <img src={group.avatar || `https://ui-avatars.com/api/?name=${group.name}`} className={`w-7 h-7 rounded-lg object-cover transition-all ${activeGroupId === group.id ? 'ring-1 ring-white/30' : 'opacity-60 group-hover:opacity-100'}`} alt=""/>
                      <span className="font-bold text-sm truncate">{group.name}</span>
                      {group.leaderId === currentUserId && <Crown size={14} className="ml-auto text-amber-400"/>}
                  </button>
              ))}
          </div>

          {/* BOTTOM SECTION: Actions & Language (Pinned) */}
          <div className="p-6 pt-4 border-t border-white/5 shrink-0 bg-[#0B1120] z-20">
              <div className="space-y-3">
                  <button onClick={() => { handleOpenCreateGroup(); setIsSidebarOpen(false); }} className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-900/30 text-white group">
                      <Plus size={18} className="group-hover:scale-110 transition-transform"/> {t.createGroup}
                  </button>
                  <button onClick={() => { setShowJoinModal(true); setIsSidebarOpen(false); }} className="w-full py-3.5 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all text-slate-300 hover:text-white">
                      <ScanLine size={18}/> {t.joinGroup}
                  </button>
              </div>

              {/* Language Switcher */}
              <div className="mt-4 flex justify-between items-center bg-white/5 p-2 rounded-2xl border border-white/10 overflow-x-auto scrollbar-none gap-2">
                  {languages.map(lang => (
                      <button 
                        key={lang.code} 
                        onClick={() => setLanguage(lang.code)}
                        className={`text-xl p-2 rounded-xl transition-all hover:scale-110 shrink-0 ${language === lang.code ? 'bg-white/20 shadow-sm scale-110 border border-white/20' : 'opacity-60 hover:opacity-100'}`}
                        title={lang.label}
                      >
                          {lang.flag}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {/* OVERLAY FOR SIDEBAR - Z-INDEX 190 */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[190] backdrop-blur-sm transition-opacity" onClick={() => setIsSidebarOpen(false)}></div>}

      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />

      {/* TOP BAR (Visible when Tab is NOT tasks on Mobile usually) */}
      {/* Hide global buttons when in 'tasks' tab to avoid overlapping with TodoList's internal header */}
      {activeTab !== 'tasks' && (
          <div className="absolute top-4 left-4 z-30">
              <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-800 dark:text-slate-200 rounded-2xl shadow-sm hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 transition-all active:scale-95 border border-white/60 dark:border-slate-700/60 group">
                  <PanelLeft size={24} className="group-hover:scale-110 transition-transform"/>
              </button>
          </div>
      )}

      {/* Show settings button globally only if NOT in tasks tab (TodoList handles it internally) */}
      {activeGroup && activeTab !== 'tasks' && (
          <div className="absolute top-4 right-4 z-30">
               <button onClick={() => setShowSettingsModal(true)} className="p-3 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md text-slate-600 dark:text-slate-300 rounded-2xl shadow-sm hover:bg-white dark:hover:bg-slate-700 hover:text-indigo-600 transition-all border border-white dark:border-slate-700 group">
                   <Settings size={24} className="group-hover:rotate-90 transition-transform duration-500"/>
               </button>
          </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 overflow-hidden relative">
        <Suspense fallback={<LoadingFallback />}>
          {activeTab === 'tasks' && (
            <TodoList 
                activeGroup={activeGroup} 
                onOpenSettings={() => setShowSettingsModal(true)}
                onOpenProfile={() => setActiveTab('profile')}
                onToggleSidebar={() => setIsSidebarOpen(true)}
            />
          )}
          {activeTab === 'calendar' && <CalendarView activeGroup={activeGroup} />}
          {activeTab === 'studio' && <ImageEditor />}
          {activeTab === 'reports' && <Reports activeGroup={activeGroup} />}
          {activeTab === 'profile' && <Profile />}
          {activeTab === 'ai' && <AiAssistant />}
          {activeTab === 'admin' && <AdminDashboard />}
        </Suspense>
      </div>

      <FloatingDock activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* --- MODALS - Z-INDEX 250 --- */}

      {/* CREATE GROUP MODAL */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-scale-in relative overflow-hidden border border-white/10">
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 dark:bg-indigo-900/10 rounded-bl-full -z-10"></div>
             <button onClick={() => setShowGroupModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20}/></button>
             
             <div className="mb-6">
                 <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20"><Users size={28}/></div>
                 <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100">{t.createGroupHeader}</h2>
                 <p className="text-slate-500 dark:text-slate-400 font-medium">{t.createGroupSub}</p>
             </div>

             <div className="space-y-4">
                 <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t.groupName}</label>
                     <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder={t.groupNamePlaceholder} className="w-full mt-1 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 outline-none transition-all"/>
                 </div>
                 <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">{t.groupDesc}</label>
                     <textarea value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} placeholder={t.groupDescPlaceholder} className="w-full mt-1 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-medium text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 focus:border-indigo-500 outline-none transition-all resize-none h-24"/>
                 </div>
                 <button onClick={handleCreateGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 dark:shadow-indigo-900/20 hover:bg-indigo-700 active:scale-95 transition-all">{t.createGroupBtn}</button>
             </div>
          </div>
        </div>
      )}

      {/* JOIN GROUP MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-md p-8 shadow-2xl animate-scale-in text-center relative overflow-hidden border border-white/10">
             <div className="absolute bottom-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
             <button onClick={() => setShowJoinModal(false)} className="absolute top-6 right-6 p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20}/></button>

             <div className="w-20 h-20 bg-slate-900 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-xl border border-white/5"><ScanLine size={32}/></div>
             <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">{t.joinGroupHeader}</h2>
             <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">{t.joinCodePrompt}</p>

             <div className="relative mb-6">
                 <input 
                    value={joinCodeInput} 
                    onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} 
                    placeholder="CODE..." 
                    className="w-full p-5 bg-slate-100 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-center text-3xl font-black text-slate-800 dark:text-slate-100 tracking-[0.5em] focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-800 outline-none transition-all placeholder-slate-400"
                 />
             </div>

             <button onClick={handleJoinGroup} className="w-full py-4 bg-slate-900 dark:bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-xl hover:bg-slate-800 dark:hover:bg-indigo-700 active:scale-95 transition-all">{t.joinNow}</button>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && activeGroup && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-2xl max-h-[85vh] shadow-2xl animate-scale-in flex flex-col relative overflow-hidden border border-white/10">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 z-10">
                    <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Settings size={24} className="text-slate-400"/> {t.groupName}
                    </h2>
                    <button onClick={() => setShowSettingsModal(false)} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"><X size={20}/></button>
                </div>
                
                <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 gap-6 bg-white dark:bg-slate-900">
                    {(['info', 'members', 'personalize'] as const).map(tab => (
                        <button 
                            key={tab} 
                            onClick={() => setSettingsTab(tab)} 
                            className={`py-4 text-sm font-bold uppercase tracking-wider border-b-2 transition-colors ${settingsTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab === 'info' && t.infoTab}
                            {tab === 'members' && t.membersTab}
                            {tab === 'personalize' && t.themeTab}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-50/50 dark:bg-slate-900/50">
                    {/* INFO TAB */}
                    {settingsTab === 'info' && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex flex-col items-center text-center">
                                <img src={activeGroup.avatar || `https://ui-avatars.com/api/?name=${activeGroup.name}`} className="w-24 h-24 rounded-3xl bg-white dark:bg-slate-800 shadow-lg object-cover mb-4 border border-slate-100 dark:border-slate-700" alt=""/>
                                <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100">{activeGroup.name}</h3>
                                <p className="text-slate-500 dark:text-slate-400 font-medium mt-1 max-w-sm">{activeGroup.description || t.noDesc}</p>
                            </div>

                            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 block">{t.joinCode} & {t.inviteMembers}</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-slate-50 dark:bg-slate-900 p-4 rounded-xl font-mono text-xl font-bold text-slate-800 dark:text-slate-100 tracking-widest text-center border border-slate-200 dark:border-slate-700 border-dashed">{activeGroup.joinCode}</div>
                                    <button onClick={handleShareGroup} className="p-4 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-colors" title={t.shareGroup}><Share2 size={20}/></button>
                                    <button onClick={() => { setSettingsTab('members'); }} className="p-4 bg-slate-900 dark:bg-slate-700 text-white rounded-xl shadow-lg hover:bg-slate-800 dark:hover:bg-slate-600 transition-colors" title={t.inviteMembers}><UserPlus size={20}/></button>
                                </div>
                            </div>

                            <div className="flex gap-4">
                                <button onClick={handleLeaveGroup} className="flex-1 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">{t.leaveGroup}</button>
                                <button 
                                    onClick={activeGroup.leaderId === currentUserId ? handleDeleteGroup : undefined} 
                                    disabled={activeGroup.leaderId !== currentUserId}
                                    className={`flex-1 py-4 font-bold rounded-2xl transition-colors ${
                                        activeGroup.leaderId === currentUserId 
                                        ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40' 
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed opacity-60'
                                    }`}
                                >
                                    {t.deleteGroup}
                                    {activeGroup.leaderId !== currentUserId && <span className="block text-[10px] font-normal opacity-70">{t.leader} Only</span>}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MEMBERS TAB */}
                    {settingsTab === 'members' && (
                        <div className="space-y-6 animate-fade-in">
                            {/* Member Search / Add */}
                            <div className="relative">
                                <input 
                                    value={memberSearchQuery}
                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                    placeholder={t.inviteMembers} 
                                    className="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none shadow-sm"
                                />
                                <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                <button 
                                    onClick={handleSearchUsers}
                                    disabled={!memberSearchQuery.trim() || isSearching}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-slate-900 dark:bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-slate-800 dark:hover:bg-indigo-700 disabled:opacity-50"
                                >
                                    {isSearching ? <Loader2 size={14} className="animate-spin"/> : 'Search'}
                                </button>
                            </div>

                            {/* Search Results */}
                            {foundUsers.length > 0 && (
                                <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Found Users</p>
                                    {foundUsers.map(u => (
                                        <div key={u.uid} className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm">
                                            <div className="flex items-center gap-3">
                                                <img src={u.avatar} className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700" alt=""/>
                                                <span className="font-bold text-sm text-slate-700 dark:text-slate-200">{u.name}</span>
                                            </div>
                                            <button onClick={() => handleAddMember(u)} className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/60"><Plus size={16}/></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Member List */}
                            <div className="space-y-3">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2">{t.memberList} ({activeGroup.members.length})</p>
                                {activeGroup.members.map(member => (
                                    <div key={member.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center justify-between group">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <img src={member.avatar} className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 object-cover" alt=""/>
                                                {member.role === 'leader' && <div className="absolute -top-2 -right-2 bg-amber-400 text-white p-1 rounded-full shadow-sm"><Crown size={10}/></div>}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100">{member.name} {member.id === currentUserId && <span className="text-indigo-500">(You)</span>}</h4>
                                                <p className="text-xs font-medium text-slate-400 dark:text-slate-500">{member.customTitle || member.role}</p>
                                            </div>
                                        </div>
                                        
                                        {activeGroup.leaderId === currentUserId && member.id !== currentUserId && (
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handlePromoteMember(member.id)} className="p-2 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40" title="Promote"><Crown size={16}/></button>
                                                <button onClick={() => handleRemoveMember(member.id)} className="p-2 bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40" title="Remove"><UserMinus size={16}/></button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* PERSONALIZE TAB */}
                    {settingsTab === 'personalize' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-6 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 flex items-start gap-4">
                                <div className="p-3 bg-white dark:bg-slate-800 rounded-xl text-indigo-600 dark:text-indigo-400 shadow-sm"><Sparkles size={24}/></div>
                                <div>
                                    <h4 className="font-bold text-indigo-900 dark:text-indigo-100 mb-1">Customize Your Header</h4>
                                    <p className="text-sm text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">{t.themeHint}</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <button onClick={() => personalBgInputRef.current?.click()} className="w-full py-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl flex flex-col items-center justify-center text-slate-400 hover:text-indigo-400 hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all group">
                                    <ImageIcon size={32} className="mb-2 group-hover:scale-110 transition-transform"/>
                                    <span className="font-bold text-sm">{t.uploadDevice}</span>
                                </button>
                                <input type="file" ref={personalBgInputRef} className="hidden" accept="image/*" onChange={handlePersonalBgUpload} />

                                <div className="grid grid-cols-2 gap-3">
                                    {['linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 'linear-gradient(120deg, #84fab0 0%, #8fd3f4 100%)', 'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)', 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)'].map((bg, i) => (
                                        <button 
                                            key={i} 
                                            onClick={() => handleUpdatePersonalGroupSettings(bg)} 
                                            className="h-20 rounded-2xl shadow-sm hover:scale-[1.02] transition-transform ring-2 ring-transparent hover:ring-indigo-500"
                                            style={{ background: bg }}
                                        ></button>
                                    ))}
                                </div>
                                <button onClick={() => handleUpdatePersonalGroupSettings('')} className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">{t.reset}</button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

const AppContent: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [localSession, setLocalSession] = useState<string | null>(localStorage.getItem(SESSION_KEY));

    useEffect(() => {
        // Supabase Auth Listener
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        // Local/Firebase Auth Listener
        const handleAuthChange = () => {
            setLocalSession(localStorage.getItem(SESSION_KEY));
        };
        
        // Listen for both custom event and storage events
        window.addEventListener('auth-change', handleAuthChange);
        window.addEventListener('storage', handleAuthChange);
        window.addEventListener('local-storage', handleAuthChange);

        return () => {
            subscription.unsubscribe();
            window.removeEventListener('auth-change', handleAuthChange);
            window.removeEventListener('storage', handleAuthChange);
            window.removeEventListener('local-storage', handleAuthChange);
        };
    }, []);

    const isAuthenticated = session || (localSession && localSession !== 'guest');

    if (!isAuthenticated) {
        return <AuthScreen />;
    }

    return <AuthenticatedApp />;
};

const App = () => (
    <LanguageProvider>
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    </LanguageProvider>
);

export default App;