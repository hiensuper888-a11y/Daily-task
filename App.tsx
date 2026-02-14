import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, Users, Plus, ScanLine, Copy, X, Image as ImageIcon, Settings, UserMinus, Trash2, LogOut, Loader2, Home, ChevronRight, Activity, Search, Check, Edit2 } from 'lucide-react';
import { AppTab, Language, Group, UserProfile, Task, GroupMember } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useRealtimeStorage, SESSION_KEY } from './hooks/useRealtimeStorage';
import { useDeadlineNotifications } from './hooks/useDeadlineNotifications';
import { NotificationManager } from './components/NotificationManager';
import { searchUsers } from './services/firebaseConfig';

const TodoList = React.lazy(() => import('./components/TodoList').then(module => ({ default: module.TodoList })));
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));

const languages: { code: Language; label: string }[] = [
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
  { code: 'fr', label: 'Français' },
  { code: 'ko', label: '한국어' },
];

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full text-slate-400">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Loader2 size={40} className="animate-spin text-indigo-500" />
        <div className="absolute inset-0 blur-lg bg-indigo-500/20 animate-pulse"></div>
      </div>
      <span className="text-sm font-bold tracking-tight opacity-60">Đang tải dữ liệu...</span>
    </div>
  </div>
);

// --- GLOBAL GROUP HELPERS (Mock Backend) ---
const GLOBAL_GROUPS_KEY = 'public_groups_db';

const getGlobalGroups = (): Group[] => {
    try {
        return JSON.parse(localStorage.getItem(GLOBAL_GROUPS_KEY) || '[]');
    } catch { return []; }
};

const saveGlobalGroup = (group: Group) => {
    const groups = getGlobalGroups();
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) {
        groups[index] = group;
    } else {
        groups.push(group);
    }
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
};

const deleteGlobalGroup = (groupId: string) => {
    const groups = getGlobalGroups().filter(g => g.id !== groupId);
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  
  const [myGroups, setMyGroups] = useRealtimeStorage<Group[]>('my_groups', []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  
  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'personalize'>('info');

  // Create Group State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  
  // Member Management State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  // Edit Member State
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberTitle, setEditMemberTitle] = useState('');
  const [editMemberNote, setEditMemberNote] = useState('');
  
  // Personalization State
  const personalBgInputRef = useRef<HTMLInputElement>(null);

  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'Người dùng', email: 'guest', avatar: '', provider: null, isLoggedIn: false });
  
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  
  const activeGroup = useMemo(() => myGroups.find(g => g.id === activeGroupId) || null, [myGroups, activeGroupId]);

  const [personalTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  const [storageVersion, setStorageVersion] = useState(0);

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

  // Sync Groups
  useEffect(() => {
      const interval = setInterval(() => {
          const globalGroups = getGlobalGroups();
          
          setMyGroups(prevMyGroups => {
              if (prevMyGroups.length === 0 && globalGroups.length === 0) return prevMyGroups;

              const validGroups = prevMyGroups.filter(localGroup => {
                  const globalMatch = globalGroups.find(gg => gg.id === localGroup.id);
                  if (globalMatch) {
                      // Safety check for members
                      const amIMember = globalMatch.members?.some(m => m.id === currentUserId);
                      return amIMember;
                  }
                  return false;
              });

              let hasChanges = validGroups.length !== prevMyGroups.length;
              const newGroups = validGroups.map(localGroup => {
                  const globalMatch = globalGroups.find(gg => gg.id === localGroup.id);
                  if (globalMatch && JSON.stringify(globalMatch) !== JSON.stringify(localGroup)) {
                      hasChanges = true;
                      return globalMatch;
                  }
                  return localGroup;
              });

              return hasChanges ? newGroups : prevMyGroups;
          });
      }, 3000);
      return () => clearInterval(interval);
  }, [setMyGroups, currentUserId]);

  useEffect(() => {
      if (activeGroupId && !myGroups.find(g => g.id === activeGroupId)) {
          setActiveGroupId(null);
      }
  }, [myGroups, activeGroupId]);

  useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('joinCode');
      if (code) {
          setJoinCodeInput(code);
          setShowJoinModal(true);
          window.history.replaceState({}, document.title, window.location.pathname);
      }
  }, []);

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

  // --- Group Functions ---

  const resetModalState = () => {
      setNewGroupName('');
      setNewGroupImage('');
      setJoinCodeInput('');
  };

  const handleOpenCreateGroup = () => {
      setShowGroupModal(true);
  };

  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      const newGroup: Group = {
          id: Date.now().toString(),
          name: newGroupName,
          leaderId: currentUserId,
          avatar: newGroupImage,
          members: [{
              id: currentUserId,
              name: userProfile.name || 'Người dùng',
              avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`,
              role: 'leader',
              joinedAt: Date.now(),
              customTitle: 'Trưởng nhóm',
              note: 'Quản trị viên',
              headerBackground: ''
          }],
          joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: Date.now()
      };
      
      setMyGroups([...myGroups, newGroup]);
      saveGlobalGroup(newGroup);
      resetModalState();
      setShowGroupModal(false);
      setActiveGroupId(newGroup.id);
      setActiveTab('tasks');
  };

  const handleJoinGroup = () => {
      if(!joinCodeInput) return;
      
      const existing = myGroups.find(g => g.joinCode === joinCodeInput);
      if(existing) {
          alert("Bạn đã là thành viên của nhóm này!");
          setActiveGroupId(existing.id);
          setActiveTab('tasks');
          setShowJoinModal(false);
          resetModalState();
          return;
      }
      
      const globalGroups = getGlobalGroups();
      const targetGroup = globalGroups.find(g => g.joinCode === joinCodeInput);

      if (!targetGroup) {
          alert("Mã nhóm không tồn tại hoặc không tìm thấy.");
          return;
      }

      let updatedGroup = targetGroup;
      // Safety check for members
      const isAlreadyMember = targetGroup.members?.some(m => m.id === currentUserId);
      
      if (!isAlreadyMember) {
          const newMember: GroupMember = {
              id: currentUserId,
              name: userProfile.name || 'Thành viên mới',
              avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`,
              role: 'member',
              joinedAt: Date.now(),
              customTitle: 'Thành viên',
              note: '',
              headerBackground: ''
          };
          updatedGroup = { ...targetGroup, members: [...(targetGroup.members || []), newMember] };
          saveGlobalGroup(updatedGroup);
      }

      setMyGroups([...myGroups, updatedGroup]);
      setActiveGroupId(updatedGroup.id);
      setActiveTab('tasks');
      setShowJoinModal(false);
      resetModalState();
      alert(`Đã tham gia nhóm "${updatedGroup.name}" thành công!`);
  };

  const handleDeleteGroup = () => {
      if (!activeGroup) return;
      if (activeGroup.leaderId !== currentUserId) {
          alert("Chỉ trưởng nhóm mới có thể xóa nhóm.");
          return;
      }
      if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${activeGroup.name}"? Hành động này không thể hoàn tác.`)) {
          const groupId = activeGroup.id;
          setActiveGroupId(null);
          setShowSettingsModal(false);
          setActiveTab('tasks');
          localStorage.removeItem(`group_${groupId}_tasks`);
          setMyGroups(prev => prev.filter(g => g.id !== groupId));
          deleteGlobalGroup(groupId);
      }
  };

  const handleLeaveGroup = () => {
      if (!activeGroup) return;
      if (confirm(`Bạn có chắc chắn muốn rời nhóm "${activeGroup.name}"?`)) {
          const updatedMembers = (activeGroup.members || []).filter(m => m.id !== currentUserId);
          const updatedGroup = { ...activeGroup, members: updatedMembers };
          saveGlobalGroup(updatedGroup);
          setMyGroups(prev => prev.filter(g => g.id !== activeGroup.id));
          setActiveGroupId(null);
          setShowSettingsModal(false);
          setActiveTab('tasks');
      }
  };

  const handleSearchUsers = async () => {
      if (!memberSearchQuery.trim()) return;
      setIsSearching(true);
      setHasSearched(true);
      try {
          const results = await searchUsers(memberSearchQuery);
          const existingMemberIds = activeGroup?.members?.map(m => m.id) || [];
          setFoundUsers(results.filter((u: any) => !existingMemberIds.includes(u.uid)));
      } catch (error) {
          console.error(error);
      } finally {
          setIsSearching(false);
      }
  };

  const handleAddMember = (user: any) => {
      if (!activeGroup) return;
      const newMember: GroupMember = {
          id: user.uid,
          name: user.name,
          avatar: user.avatar,
          role: 'member',
          joinedAt: Date.now(),
          customTitle: 'Thành viên',
          note: '',
          headerBackground: ''
      };
      const updatedGroup = {
          ...activeGroup,
          members: [...(activeGroup.members || []), newMember]
      };
      setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
      saveGlobalGroup(updatedGroup);
      setFoundUsers(foundUsers.filter(u => u.uid !== user.uid));
  };

  const handleRemoveMember = (memberId: string) => {
      if (!activeGroup) return;
      if (activeGroup.leaderId !== currentUserId) return;
      if (memberId === activeGroup.leaderId) return;

      if(confirm("Xóa thành viên này khỏi nhóm?")) {
          const updatedGroup = {
              ...activeGroup,
              members: (activeGroup.members || []).filter(m => m.id !== memberId)
          };
          setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
          saveGlobalGroup(updatedGroup);
      }
  };

  const handleUpdateMemberInfo = (memberId: string) => {
      if (!activeGroup) return;
      const updatedMembers = (activeGroup.members || []).map(m => {
          if (m.id === memberId) {
              return { ...m, customTitle: editMemberTitle, note: editMemberNote };
          }
          return m;
      });
      const updatedGroup = { ...activeGroup, members: updatedMembers };
      setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
      saveGlobalGroup(updatedGroup);
      setEditingMemberId(null);
  };

  const handleUpdatePersonalGroupSettings = (headerBg: string) => {
    if (!activeGroup || !activeGroup.members) return;
    const updatedMembers = activeGroup.members.map(m => {
        if (m.id === currentUserId) {
            return { ...m, headerBackground: headerBg };
        }
        return m;
    });
    const updatedGroup = { ...activeGroup, members: updatedMembers };
    setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
    saveGlobalGroup(updatedGroup);
  };

  const handlePersonalBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleUpdatePersonalGroupSettings(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
      e.target.value = '';
  };

  const startEditingMember = (member: GroupMember) => {
      setEditingMemberId(member.id);
      setEditMemberTitle(member.customTitle || '');
      setEditMemberNote(member.note || '');
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
  };

  const NavItem = ({ tab, icon: Icon, label }: any) => (
    <button
      onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold group mb-1 btn-press ${
        activeTab === tab && activeGroupId === null
          ? `bg-indigo-600 text-white shadow-lg shadow-indigo-500/20` 
          : 'text-slate-500 hover:bg-slate-100/80 hover:text-slate-800'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <Icon size={20} strokeWidth={activeTab === tab ? 2.5 : 2} className={`${activeTab === tab && activeGroupId === null ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500 transition-colors'}`} />
        <span className="text-[14px] tracking-tight">{label}</span>
      </div>
      {activeTab === tab && activeGroupId === null && <div className="w-1.5 h-1.5 rounded-full bg-white/80 animate-pulse"></div>}
    </button>
  );

  // --- AUTH CHECK ---
  if (!userProfile.isLoggedIn) {
      return (
          <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50 overflow-hidden relative">
              <div className="absolute inset-0 bg-noise z-0 opacity-50"></div>
              <div className="mesh-bg absolute inset-0 z-0"></div>
              <div className="relative z-10 w-full h-full flex flex-col">
                  <Suspense fallback={<LoadingFallback />}>
                      <Profile />
                  </Suspense>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative bg-slate-50/50">
      
      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />
      
      {/* SIDEBAR - VISIBLE ON LARGE SCREENS (LG +) */}
      <aside className="hidden lg:flex flex-col w-72 m-4 mr-0 rounded-[2.5rem] bg-white/60 backdrop-blur-xl border border-white/40 shrink-0 z-20 relative shadow-xl shadow-slate-200/50 transition-all">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-4 mb-8 px-2 cursor-pointer btn-press">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 transition-all duration-500 ${activeGroupId ? 'bg-gradient-to-br from-emerald-500 to-teal-600 rotate-3' : 'bg-gradient-to-br from-indigo-600 to-violet-600 -rotate-3'}`}>
                <CheckSquare size={22} strokeWidth={3} />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-slate-800 leading-none">Daily Task</span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1.5">By Mr.Hien</span>
            </div>
          </div>
          
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 pl-4 opacity-60">Menu</p>
             <NavItem tab="tasks" icon={Home} label="Trang chủ" />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
             <NavItem tab="reports" icon={Activity} label={t.reports} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
          </div>
        </div>

        <div className="flex-1 px-4 py-4 overflow-y-auto custom-scrollbar mt-2">
          <div className="flex items-center justify-between mb-4 px-4">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-60">Dự án Nhóm</p>
             <div className="flex gap-1">
                <button onClick={() => setShowJoinModal(true)} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Tham gia"><ScanLine size={16}/></button>
                <button onClick={handleOpenCreateGroup} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="Tạo mới"><Plus size={16}/></button>
             </div>
          </div>

          <div className="space-y-2">
              {myGroups.map(group => (
                  <div key={group.id} className="relative group/item">
                    <button
                        onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 btn-press border ${
                            activeGroupId === group.id
                            ? `bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-500/20` 
                            : 'bg-white/40 text-slate-600 border-transparent hover:bg-white hover:border-white hover:shadow-sm'
                        }`}
                    >
                        {group.avatar ? (
                            <img src={group.avatar} alt={group.name} className="w-8 h-8 rounded-lg object-cover shrink-0 border border-white/20"/>
                        ) : (
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${activeGroupId === group.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                {group.name.substring(0,2).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-bold truncate tracking-tight">{group.name}</span>
                    </button>
                    
                    {activeGroupId === group.id && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); setSettingsTab('info'); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                  </div>
              ))}
          </div>
        </div>

        <div className="p-4 bg-white/40 backdrop-blur-md rounded-b-[2.5rem] border-t border-white/50">
           <button onClick={() => setShowLangMenu(!showLangMenu)} className="w-full flex items-center justify-between px-4 py-3 bg-white/80 hover:bg-white rounded-xl text-xs font-bold text-slate-600 transition-all border border-white shadow-sm group">
             <span className="flex items-center gap-2"><Globe size={14} className="text-indigo-500 group-hover:rotate-12 transition-transform" /> {languages.find(l => l.code === language)?.label}</span>
             <ChevronRight size={14} className="opacity-30 group-hover:translate-x-0.5 transition-transform" />
           </button>
           {showLangMenu && (
             <div className="absolute bottom-20 left-4 right-4 bg-white/90 backdrop-blur-xl rounded-xl shadow-2xl border border-white/50 py-2 animate-scale-in z-50">
               {languages.map((lang) => (
                 <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }} className={`w-full text-left px-4 py-2.5 text-xs font-bold hover:bg-indigo-50 transition-colors ${language === lang.code ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}>
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        <div className="flex-1 overflow-hidden relative p-0 lg:p-4 h-full flex flex-col">
           <div className={`flex-1 w-full mx-auto bg-white/60 backdrop-blur-3xl lg:rounded-[3rem] border-0 lg:border border-white/60 transition-all duration-700 shadow-none lg:shadow-2xl lg:shadow-slate-200/50 relative overflow-hidden flex flex-col ${activeGroupId ? 'lg:border-emerald-100/50' : ''}`}>
               <div className="flex-1 overflow-hidden animate-fade-in h-full">
                   <Suspense fallback={<LoadingFallback />}>
                       {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                       activeTab === 'ai' ? <AiAssistant /> :
                       activeTab === 'reports' ? <Reports activeGroup={activeGroup} key={activeGroupId || 'personal'} /> : 
                       activeTab === 'profile' ? <Profile /> : <ImageEditor />}
                   </Suspense>
               </div>
           </div>
        </div>

        {/* BOTTOM NAVIGATION - MOBILE/TABLET ONLY (HIDDEN ON LG) */}
        <div className="lg:hidden absolute bottom-5 left-4 right-4 z-30 pb-safe">
            <div className="glass-dock px-3 py-2 rounded-[2rem] flex justify-between items-center shadow-2xl border border-white/50">
              {[
                  { id: 'tasks', icon: activeGroupId ? Users : Home },
                  { id: 'ai', icon: MessageSquare },
                  { id: 'studio', icon: Wand2 },
                  { id: 'reports', icon: BarChart3 },
                  { id: 'profile', icon: UserCircle2 }
              ].map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => { 
                        if (item.id === 'tasks') {
                            if (activeTab === 'tasks' && activeGroupId) {
                                setActiveGroupId(null);
                            } else {
                                setActiveTab('tasks');
                            }
                        } else {
                            setActiveTab(item.id as AppTab); 
                            setActiveGroupId(null); // Switch to personal tab
                        }
                    }} 
                    className={`p-3 rounded-2xl transition-all btn-press flex flex-col items-center gap-1 relative overflow-hidden ${activeTab === item.id ? (activeGroupId ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50') : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <div className="relative z-10">
                        <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                    </div>
                  </button>
              ))}
              {/* Mobile Group Settings Toggle or Create */}
              {activeGroupId ? (
                  <button onClick={() => { setShowSettingsModal(true); setSettingsTab('info'); }} className="p-3 rounded-2xl text-emerald-600 bg-emerald-50/50 btn-press">
                     <Settings size={24} strokeWidth={2.5} />
                  </button>
              ) : (
                  <button onClick={handleOpenCreateGroup} className="p-3 rounded-2xl text-indigo-600 bg-indigo-50/50 btn-press">
                     <Plus size={24} strokeWidth={2.5} />
                  </button>
              )}
            </div>
        </div>
      </main>

      {/* MODAL: Join Group */}
      {showJoinModal && (
          <div onClick={() => setShowJoinModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-lg animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modern rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => { setShowJoinModal(false); resetModalState(); }} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tighter">Tham gia nhóm</h3>
                  <div className="space-y-6">
                      <input 
                        value={joinCodeInput} 
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} 
                        className="w-full p-5 bg-white/50 border border-white rounded-[1.5rem] font-mono text-center text-2xl font-black text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all outline-none tracking-widest uppercase shadow-inner" 
                        placeholder="CODE" 
                      />
                      <button onClick={handleJoinGroup} className="w-full py-5 bg-slate-900 text-white rounded-[1.5rem] font-bold shadow-xl hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs">Tham gia ngay</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: Create Group */}
      {showGroupModal && (
          <div onClick={() => setShowGroupModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-lg animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modern rounded-[2.5rem] p-10 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => { setShowGroupModal(false); resetModalState(); }} className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-800 mb-8 tracking-tighter">Tạo nhóm dự án</h3>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div 
                            onClick={() => groupImageInputRef.current?.click()}
                            className="relative w-28 h-28 rounded-[2rem] bg-white/50 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all overflow-hidden group/upload shadow-sm"
                          >
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-slate-300 group-hover/upload:scale-110 transition-transform" />}
                              <input 
                                ref={groupImageInputRef}
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setNewGroupImage(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                                  e.target.value = '';
                              }} />
                          </div>
                      </div>
                      <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-5 bg-white/50 border border-white rounded-[1.5rem] font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all outline-none text-center placeholder:font-medium" placeholder="Tên nhóm..." />
                      <button onClick={handleCreateGroup} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-bold shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs">Tạo không gian</button>
                  </div>
              </div>
          </div>
      )}

      {/* MODAL: Group Settings */}
      {showSettingsModal && activeGroup && (
          <div onClick={() => setShowSettingsModal(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/30 backdrop-blur-lg animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modern rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
                  <div className="p-8 pb-4 border-b border-slate-100 flex flex-col sticky top-0 bg-white/80 backdrop-blur-md z-10 rounded-t-[2.5rem]">
                      <div className="flex items-center justify-between mb-4">
                          <div>
                              <h3 className="text-xl font-black text-slate-800">Cài đặt nhóm</h3>
                              <p className="text-sm text-slate-500 font-medium">{activeGroup.name}</p>
                          </div>
                          <button onClick={() => setShowSettingsModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                      </div>
                      
                      {/* Tabs */}
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                          <button 
                            onClick={() => setSettingsTab('info')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settingsTab === 'info' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Thông tin
                          </button>
                          <button 
                            onClick={() => setSettingsTab('personalize')}
                            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settingsTab === 'personalize' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                          >
                             Cá nhân hóa
                          </button>
                      </div>
                  </div>

                  <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      {settingsTab === 'info' ? (
                        <>
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mời thành viên</label>
                              <div className="flex gap-2">
                                      <div className="relative flex-1">
                                          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                          <input 
                                            type="text" 
                                            value={memberSearchQuery}
                                            onChange={(e) => setMemberSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                                            placeholder="Tìm email, ID..." 
                                            className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                                          />
                                      </div>
                                      <button onClick={handleSearchUsers} disabled={isSearching || !memberSearchQuery} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50">
                                          {isSearching ? <Loader2 size={18} className="animate-spin"/> : "Tìm"}
                                      </button>
                                </div>
                                
                                {foundUsers.length > 0 && (
                                    <div className="bg-white border border-slate-100 rounded-xl p-2 space-y-1">
                                        {foundUsers.map(u => (
                                            <div key={u.uid} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <img src={u.avatar} className="w-8 h-8 rounded-full" alt=""/>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800">{u.name}</p>
                                                        <p className="text-[10px] text-slate-500">{u.email}</p>
                                                    </div>
                                                </div>
                                                <button onClick={() => handleAddMember(u)} className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100"><Plus size={14}/></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                
                                {hasSearched && foundUsers.length === 0 && !isSearching && (
                                    <p className="text-xs text-slate-400 italic text-center">Không tìm thấy người dùng.</p>
                                )}

                                <div className="flex gap-2 mt-4">
                                  <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                                      <div>
                                          <p className="text-[10px] text-slate-400 font-bold uppercase">Code</p>
                                          <p className="text-lg font-black text-slate-800 tracking-widest font-mono">{activeGroup.joinCode}</p>
                                      </div>
                                      <div className="flex gap-1">
                                          <button onClick={() => copyToClipboard(activeGroup.joinCode)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg">{copiedCode ? <Check size={16}/> : <Copy size={16}/>}</button>
                                      </div>
                                  </div>
                              </div>
                           </div>
                           
                           <div className="space-y-4">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thành viên ({activeGroup.members?.length || 0})</label>
                               <div className="space-y-2">
                                  {activeGroup.members?.map((member) => (
                                      <div key={member.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                          <div className="flex items-start justify-between">
                                              <div className="flex items-center gap-3">
                                                  <img src={member.avatar} className="w-10 h-10 rounded-xl object-cover" alt={member.name}/>
                                                  <div>
                                                      <p className="text-sm font-bold text-slate-800">{member.name}</p>
                                                      <p className="text-[11px] text-indigo-600 font-bold">{member.customTitle || 'Thành viên'}</p>
                                                  </div>
                                              </div>
                                              {activeGroup.leaderId === currentUserId && member.id !== currentUserId && (
                                                  <div className="flex gap-1">
                                                      <button onClick={() => startEditingMember(member)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 rounded-lg transition-colors"><Edit2 size={14}/></button>
                                                      <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors"><UserMinus size={14}/></button>
                                                  </div>
                                              )}
                                              {editingMemberId === member.id && (
                                                 <div className="absolute inset-0 bg-white/95 z-10 rounded-2xl p-3 flex flex-col gap-2 border border-indigo-200">
                                                     <input value={editMemberTitle} onChange={e => setEditMemberTitle(e.target.value)} placeholder="Chức danh" className="text-xs p-2 bg-slate-50 rounded-lg border border-slate-200"/>
                                                     <input value={editMemberNote} onChange={e => setEditMemberNote(e.target.value)} placeholder="Ghi chú" className="text-xs p-2 bg-slate-50 rounded-lg border border-slate-200"/>
                                                     <div className="flex gap-2 mt-1">
                                                         <button onClick={() => handleUpdateMemberInfo(member.id)} className="flex-1 bg-indigo-600 text-white text-[10px] font-bold py-1.5 rounded-lg">Lưu</button>
                                                         <button onClick={() => setEditingMemberId(null)} className="flex-1 bg-slate-200 text-slate-600 text-[10px] font-bold py-1.5 rounded-lg">Hủy</button>
                                                     </div>
                                                 </div>
                                              )}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                           </div>
                           
                            <div className="pt-6 border-t border-slate-100">
                              {activeGroup.leaderId === currentUserId ? (
                                  <button onClick={handleDeleteGroup} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2">
                                      <Trash2 size={16}/> Xóa nhóm vĩnh viễn
                                  </button>
                              ) : (
                                  <button onClick={handleLeaveGroup} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors flex items-center justify-center gap-2">
                                      <LogOut size={16}/> Rời nhóm
                                  </button>
                              )}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 text-indigo-800 text-xs font-medium leading-relaxed">
                                <p className="mb-2"><strong>Cá nhân hóa trải nghiệm:</strong></p>
                                <p>Thay đổi hình nền tiêu đề chỉ áp dụng cho tài khoản của bạn trong nhóm này. Các thành viên khác sẽ không thấy thay đổi này.</p>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Màu sắc</label>
                                <div className="grid grid-cols-5 gap-3">
                                    {[
                                        { val: '', name: 'Mặc định', bg: 'bg-slate-200 border-dashed border-2 border-slate-400' },
                                        { val: 'linear-gradient(to right, #ec4899, #8b5cf6)', name: 'Pink Purple', bg: 'bg-gradient-to-r from-pink-500 to-violet-500' },
                                        { val: 'linear-gradient(to right, #3b82f6, #06b6d4)', name: 'Blue Cyan', bg: 'bg-gradient-to-r from-blue-500 to-cyan-500' },
                                        { val: 'linear-gradient(to right, #f59e0b, #ef4444)', name: 'Orange Red', bg: 'bg-gradient-to-r from-amber-500 to-red-500' },
                                        { val: 'linear-gradient(to right, #10b981, #3b82f6)', name: 'Green Blue', bg: 'bg-gradient-to-r from-emerald-500 to-blue-500' },
                                        { val: '#1e293b', name: 'Dark', bg: 'bg-slate-800' },
                                        { val: '#0f172a', name: 'Midnight', bg: 'bg-slate-950' },
                                        { val: '#4c1d95', name: 'Violet', bg: 'bg-violet-900' },
                                        { val: '#881337', name: 'Rose', bg: 'bg-rose-900' },
                                    ].map((c, i) => (
                                        <button 
                                            key={i}
                                            onClick={() => handleUpdatePersonalGroupSettings(c.val)}
                                            className={`aspect-square rounded-xl ${c.bg} shadow-sm hover:scale-105 transition-transform relative`}
                                            title={c.name}
                                        >
                                            {/* Show check if roughly matches current bg (simplified check) */}
                                            {(activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground || '') === c.val && (
                                                <div className="absolute inset-0 flex items-center justify-center">
                                                    <Check size={16} className="text-white drop-shadow-md"/>
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Hình ảnh</label>
                                <button 
                                    onClick={() => personalBgInputRef.current?.click()}
                                    className="w-full h-32 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-400 hover:bg-indigo-50/50 hover:text-indigo-600 transition-all gap-2"
                                >
                                    <ImageIcon size={24}/>
                                    <span className="text-xs font-bold">Tải ảnh lên</span>
                                </button>
                                <input 
                                    type="file" 
                                    ref={personalBgInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handlePersonalBgUpload}
                                />
                                {activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground?.startsWith('data:') && (
                                    <div className="relative h-32 rounded-2xl overflow-hidden shadow-md group">
                                        <img 
                                            src={activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground} 
                                            className="w-full h-full object-cover" 
                                            alt="Custom Header"
                                        />
                                        <button 
                                            onClick={() => handleUpdatePersonalGroupSettings('')}
                                            className="absolute top-2 right-2 bg-white/90 p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                )}
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

export default function App() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}