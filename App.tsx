import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, Users, Plus, ScanLine, Copy, X, Image as ImageIcon, Settings, UserMinus, Trash2, LogOut, Loader2, Home, ChevronRight, Activity, Search, Check, Edit2, QrCode, Share2, Crown, Shield, Bell, Menu, LayoutGrid, MoreHorizontal } from 'lucide-react';
import { AppTab, Language, Group, UserProfile, Task, GroupMember } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useRealtimeStorage, SESSION_KEY } from './hooks/useRealtimeStorage';
import { useDeadlineNotifications } from './hooks/useDeadlineNotifications';
import { NotificationManager } from './components/NotificationManager';
import { searchUsers } from './services/firebaseConfig';
import { FloatingDock } from './components/FloatingDock';

const TodoList = React.lazy(() => import('./components/TodoList').then(module => ({ default: module.TodoList })));
const ImageEditor = React.lazy(() => import('./components/ImageEditor').then(module => ({ default: module.ImageEditor })));
const Reports = React.lazy(() => import('./components/Reports').then(module => ({ default: module.Reports })));
const Profile = React.lazy(() => import('./components/Profile').then(module => ({ default: module.Profile })));
const AiAssistant = React.lazy(() => import('./components/AiAssistant').then(module => ({ default: module.AiAssistant })));

const languages: { code: Language; label: string; flag: string }[] = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
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

const saveGlobalGroup = (group: Group) => {
    const groups = getGlobalGroups();
    const index = groups.findIndex(g => g.id === group.id);
    if (index >= 0) {
        groups[index] = group;
    } else {
        groups.push(group);
    }
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new Event('storage'));
};

const deleteGlobalGroup = (groupId: string) => {
    const groups = getGlobalGroups().filter(g => g.id !== groupId);
    localStorage.setItem(GLOBAL_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new Event('storage'));
};

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  
  const [myGroups, setMyGroups] = useState<Group[]>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'info' | 'members' | 'personalize'>('info');

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  const groupImageInputRef = useRef<HTMLInputElement>(null);
  
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editMemberTitle, setEditMemberTitle] = useState('');
  const [editMemberNote, setEditMemberNote] = useState('');
  
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

  const syncGroups = () => {
      const globalGroups = getGlobalGroups();
      const relevantGroups = globalGroups.filter(g => 
          g.members.some(m => m.id === currentUserId)
      );
      
      setMyGroups(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(relevantGroups)) {
              return relevantGroups;
          }
          return prev;
      });
  };

  useEffect(() => {
      syncGroups();
      const interval = setInterval(syncGroups, 2000);
      window.addEventListener('storage', syncGroups);
      return () => {
          clearInterval(interval);
          window.removeEventListener('storage', syncGroups);
      }
  }, [currentUserId]);

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
      setMyGroups(prev => [...prev, newGroup]);
      resetModalState(); 
      setShowGroupModal(false); 
      setActiveGroupId(newGroup.id); 
      setActiveTab('tasks');
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
      setMyGroups(prev => [...prev, updatedGroup]); 
      setActiveGroupId(updatedGroup.id); 
      setActiveTab('tasks'); 
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
          setMyGroups(prev => prev.filter(g => g.id !== groupId)); 
          alert(t.groupDeleted);
      } 
  };

  const handleLeaveGroup = () => { 
      if (!activeGroup) return; 
      if (confirm(`${t.leaveGroup}?`)) { 
          const updatedMembers = (activeGroup.members || []).filter(m => m.id !== currentUserId); 
          const updatedGroup = { ...activeGroup, members: updatedMembers }; 
          saveGlobalGroup(updatedGroup); 
          setMyGroups(prev => prev.filter(g => g.id !== activeGroup.id)); 
          setActiveGroupId(null); 
          setShowSettingsModal(false); 
          setActiveTab('tasks'); 
      } 
  };

  const updateGroupMemberState = (updatedGroup: Group) => {
      saveGlobalGroup(updatedGroup);
      setMyGroups(prev => prev.map(g => g.id === updatedGroup.id ? updatedGroup : g));
  };

  const handleSearchUsers = async () => { if (!memberSearchQuery.trim()) return; setIsSearching(true); setHasSearched(true); try { const results = await searchUsers(memberSearchQuery); const existingMemberIds = activeGroup?.members?.map(m => m.id) || []; setFoundUsers(results.filter((u: any) => !existingMemberIds.includes(u.uid))); } catch (error) { console.error(error); } finally { setIsSearching(false); } };
  const handleAddMember = (user: any) => { if (!activeGroup) return; const newMember: GroupMember = { id: user.uid, name: user.name, avatar: user.avatar, role: 'member', joinedAt: Date.now(), customTitle: 'Thành viên', note: '', headerBackground: '' }; const updatedGroup = { ...activeGroup, members: [...(activeGroup.members || []), newMember] }; updateGroupMemberState(updatedGroup); setFoundUsers(foundUsers.filter(u => u.uid !== user.uid)); };
  const handleRemoveMember = (memberId: string) => { if (!activeGroup || activeGroup.leaderId !== currentUserId || memberId === activeGroup.leaderId) return; if(confirm(t.delete)) { const updatedGroup = { ...activeGroup, members: (activeGroup.members || []).filter(m => m.id !== memberId) }; updateGroupMemberState(updatedGroup); alert(t.memberRemoved); } };
  const handleUpdateMemberInfo = (memberId: string) => { if (!activeGroup) return; const updatedMembers = (activeGroup.members || []).map(m => { if (m.id === memberId) return { ...m, customTitle: editMemberTitle, note: editMemberNote }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); setEditingMemberId(null); };
  
  const handlePromoteMember = (memberId: string) => {
      if (!activeGroup || activeGroup.leaderId !== currentUserId) return;
      if (!confirm(t.promoteConfirm)) return;

      const updatedMembers = activeGroup.members.map(m => {
          if (m.id === memberId) return { ...m, role: 'leader' as const }; // New leader
          if (m.id === activeGroup.leaderId) return { ...m, role: 'member' as const }; // Old leader (me)
          return m;
      });

      const updatedGroup = { 
          ...activeGroup, 
          leaderId: memberId, 
          members: updatedMembers 
      };
      
      updateGroupMemberState(updatedGroup);
  };

  const handleShareGroup = async () => {
      if (!activeGroup) return;
      const text = `${t.shareText} ${activeGroup.joinCode}`;
      
      if (navigator.share) {
          try {
              await navigator.share({
                  title: t.shareTitle,
                  text: text,
              });
          } catch (e) {
              console.log('Error sharing:', e);
          }
      } else {
          copyToClipboard(text);
          alert(t.copied);
      }
  };

  const handleUpdatePersonalGroupSettings = (headerBg: string) => { if (!activeGroup || !activeGroup.members) return; const updatedMembers = activeGroup.members.map(m => { if (m.id === currentUserId) return { ...m, headerBackground: headerBg }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); };
  const handlePersonalBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { handleUpdatePersonalGroupSettings(reader.result as string); }; reader.readAsDataURL(file); } e.target.value = ''; };
  const startEditingMember = (member: GroupMember) => { setEditingMemberId(member.id); setEditMemberTitle(member.customTitle || ''); setEditMemberNote(member.note || ''); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  if (!userProfile.isLoggedIn) {
      return (
          <div className="h-[100dvh] w-full flex items-center justify-center bg-slate-50 relative">
              <div className="w-full max-w-md p-4">
                  <Suspense fallback={<LoadingFallback />}>
                      <Profile />
                  </Suspense>
              </div>
          </div>
      );
  }

  const handleGroupSelect = (groupId: string | null) => {
      setActiveGroupId(groupId);
      // If we're on the reports tab, stay there to show that group's report.
      // Otherwise, default to tasks for a smooth workflow.
      if (activeTab !== 'reports') {
          setActiveTab('tasks');
      }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-transparent text-slate-900 overflow-hidden relative selection:bg-indigo-100 selection:text-indigo-900">
      
      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />

      {/* TOP HEADER & GROUPS */}
      <div className="pt-safe px-6 pb-2 bg-white/60 backdrop-blur-xl border-b border-white/20 z-30 shrink-0 transition-all duration-500">
          <div className="flex items-center justify-between mb-4 mt-3 max-w-7xl mx-auto w-full">
               <div className="flex items-center gap-4">
                   <div 
                      onClick={() => {setActiveTab('profile'); setActiveGroupId(null);}} 
                      className="w-11 h-11 rounded-2xl p-0.5 bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                   >
                       <img src={userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`} alt="User" className="w-full h-full object-cover rounded-[14px] border-2 border-white"/>
                   </div>
                   <div>
                       <h1 className="text-xl font-black text-slate-800 leading-none tracking-tight">{t.appTitle}</h1>
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                           {activeGroup ? activeGroup.name : t.workspace}
                       </p>
                   </div>
               </div>
               
               <div className="flex gap-2">
                   <button 
                        onClick={() => setShowLangMenu(!showLangMenu)} 
                        className="w-10 h-10 rounded-2xl bg-white/50 border border-white text-slate-500 flex items-center justify-center hover:bg-white shadow-sm transition-all hover:scale-105 backdrop-blur-md"
                   >
                       <Globe size={18}/>
                   </button>
                   {activeGroup && (
                       <button 
                            onClick={() => {setShowSettingsModal(true); setSettingsTab('info')}}
                            className="w-10 h-10 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-100 shadow-sm transition-all hover:scale-105 backdrop-blur-md"
                       >
                           <Settings size={18}/>
                       </button>
                   )}
               </div>
          </div>

          {/* Group Selector Pill List */}
          <div className="w-full max-w-7xl mx-auto">
             <div className="flex items-center gap-3 overflow-x-auto scrollbar-none pb-2 -mx-4 px-4 snap-x mask-gradient-x">
                {/* Personal Workspace Pill */}
                <button 
                    onClick={() => handleGroupSelect(null)}
                    className={`flex items-center gap-2 rounded-2xl border transition-all duration-300 ease-out snap-start shrink-0 group py-1.5 pl-1.5 pr-4 ${
                        activeGroupId === null 
                        ? 'bg-slate-900 text-white border-transparent shadow-lg shadow-slate-900/10' 
                        : 'bg-white/40 text-slate-500 border-white/40 hover:bg-white/80 hover:text-slate-700'
                    }`}
                >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${activeGroupId === null ? 'bg-white/20' : 'bg-slate-100'}`}>
                        <UserCircle2 size={18} />
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap">{t.personal}</span>
                </button>

                {/* Divider */}
                <div className="w-px h-6 bg-slate-300/30 shrink-0"></div>

                {/* Group Pills */}
                {myGroups.map(group => {
                    const isActive = activeGroupId === group.id;
                    return (
                        <button 
                            key={group.id} 
                            onClick={() => handleGroupSelect(group.id)}
                            className={`flex items-center gap-2 rounded-2xl border transition-all duration-300 ease-out snap-start shrink-0 group py-1.5 pl-1.5 pr-4 ${
                                isActive
                                ? 'bg-indigo-600 text-white border-transparent shadow-lg shadow-indigo-600/20' 
                                : 'bg-white/40 text-slate-500 border-white/40 hover:bg-white/80 hover:text-slate-700'
                            }`}
                        >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden border transition-colors ${isActive ? 'border-white/20 bg-white/20' : 'border-transparent bg-indigo-50 text-indigo-600'}`}>
                                {group.avatar ? (
                                    <img src={group.avatar} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <span className="text-[10px] font-black">{group.name.substring(0,2).toUpperCase()}</span>
                                )}
                            </div>
                            <span className="text-xs font-bold whitespace-nowrap max-w-[100px] truncate">{group.name}</span>
                        </button>
                    );
                })}

                {/* Action Buttons */}
                <button onClick={handleOpenCreateGroup} className="w-11 h-11 rounded-2xl bg-white/40 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-white transition-all snap-start shrink-0" title={t.createGroup}>
                    <Plus size={20}/>
                </button>
                <button onClick={() => setShowJoinModal(true)} className="w-11 h-11 rounded-2xl bg-white/40 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-white transition-all snap-start shrink-0" title={t.joinGroup}>
                    <ScanLine size={18}/>
                </button>
             </div>
          </div>
      </div>

      {/* Language Menu Dropdown */}
      {showLangMenu && (
        <>
            <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)}></div>
            <div className="absolute top-20 right-4 w-48 bg-white/90 backdrop-blur-xl rounded-2xl shadow-premium border border-white z-50 overflow-hidden animate-scale-in origin-top-right">
                {languages.map(lang => (
                    <button
                        key={lang.code}
                        onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-bold transition-colors ${language === lang.code ? 'bg-indigo-50 text-indigo-600' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                        <span className="text-lg">{lang.flag}</span>
                        <span>{lang.label}</span>
                        {language === lang.code && <Check size={16} className="ml-auto"/>}
                    </button>
                ))}
            </div>
        </>
      )}

      {/* MAIN CONTENT */}
      <main className="flex-1 relative overflow-hidden flex flex-col items-center">
           <div className="w-full h-full max-w-7xl mx-auto relative animate-fade-in">
               <Suspense fallback={<LoadingFallback />}>
                   {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                   activeTab === 'ai' ? <AiAssistant /> :
                   activeTab === 'reports' ? <Reports activeGroup={activeGroup} key={activeGroupId || 'personal'} /> : 
                   activeTab === 'profile' ? <Profile /> : <ImageEditor />}
               </Suspense>
           </div>
      </main>

      {/* FLOATING DOCK */}
      <FloatingDock 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onTabChange={() => { if(activeTab !== 'tasks') setActiveGroupId(null); }}
      />

      {/* --- MODALS --- */}
      
      {/* Join Group Modal */}
      {showJoinModal && (
          <div onClick={() => setShowJoinModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modal rounded-[2.5rem] p-8 w-full max-w-sm relative border border-white/60">
                  <button onClick={() => { setShowJoinModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-full transition-colors"><X size={20}/></button>
                  <div className="text-center mb-8 mt-2">
                      <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-white rounded-3xl mx-auto flex items-center justify-center text-indigo-600 mb-6 shadow-lg ring-4 ring-white">
                          <ScanLine size={36} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.joinGroupHeader}</h3>
                      <p className="text-slate-500 text-sm font-medium mt-2">{t.joinCodePrompt}</p>
                  </div>
                  <div className="space-y-4">
                      <input 
                        value={joinCodeInput} 
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} 
                        className="w-full p-5 bg-white/50 border-2 border-white focus:border-indigo-500 focus:bg-white rounded-2xl font-mono text-center text-3xl font-bold text-slate-800 outline-none tracking-[0.3em] uppercase placeholder:text-slate-300 transition-all shadow-inner focus:shadow-float" 
                        placeholder="CODE" 
                      />
                      <button onClick={handleJoinGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce text-lg">{t.joinNow}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Creation Modal */}
      {showGroupModal && (
          <div onClick={() => setShowGroupModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modal rounded-[2.5rem] p-8 w-full max-w-sm relative border border-white/60">
                  <button onClick={() => { setShowGroupModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-50 p-2 rounded-full transition-colors"><X size={20}/></button>
                  <div className="text-center mb-8 mt-2">
                      <h3 className="text-2xl font-black text-slate-800 tracking-tight">{t.createGroupHeader}</h3>
                      <p className="text-slate-500 text-sm font-medium mt-1">{t.createGroupSub}</p>
                  </div>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div 
                            onClick={() => groupImageInputRef.current?.click()}
                            className="relative w-36 h-36 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all overflow-hidden group/upload shadow-inner"
                          >
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-slate-300 group-hover/upload:scale-110 transition-transform" />}
                              <input ref={groupImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setNewGroupImage(reader.result as string); reader.readAsDataURL(file); } e.target.value = ''; }} />
                              <div className="absolute bottom-3 bg-black/50 text-white text-[10px] px-3 py-1 rounded-full opacity-0 group-hover/upload:opacity-100 transition-opacity font-bold backdrop-blur-md">{t.upload}</div>
                          </div>
                      </div>
                      <div className="space-y-3">
                          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-4 bg-white/50 border-2 border-white focus:border-indigo-200 focus:bg-white rounded-2xl font-bold text-lg text-slate-800 outline-none text-center placeholder:text-slate-400 transition-all shadow-sm" placeholder={t.groupNamePlaceholder} />
                          <input value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full p-4 bg-white/50 border-2 border-white focus:border-indigo-200 focus:bg-white rounded-2xl font-medium text-sm text-slate-600 outline-none text-center placeholder:text-slate-400 transition-all shadow-sm" placeholder={t.groupDescPlaceholder} />
                      </div>
                      <button onClick={handleCreateGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all btn-bounce text-lg">{t.createGroupBtn}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && activeGroup && (
          <div onClick={() => setShowSettingsModal(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 bg-slate-900/20 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-modal rounded-[2.5rem] w-full max-w-lg flex flex-col max-h-[85vh] overflow-hidden border border-white/60">
                  <div className="p-6 border-b border-slate-100 flex flex-col sticky top-0 bg-white/80 backdrop-blur-xl z-10">
                      <div className="flex items-center justify-between mb-6">
                          <div className="flex items-center gap-4">
                              {activeGroup.avatar ? (
                                  <img src={activeGroup.avatar} className="w-16 h-16 rounded-[1.5rem] object-cover bg-slate-100 shadow-lg ring-4 ring-white" alt=""/>
                              ) : (
                                  <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-lg ring-4 ring-white"><Users size={32}/></div>
                              )}
                              <div>
                                  <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">{activeGroup.name}</h3>
                                  <p className="text-sm text-slate-500 font-bold mt-1 bg-white/50 inline-block px-3 py-1 rounded-lg border border-white">{activeGroup.members?.length} {t.member}</p>
                              </div>
                          </div>
                          <button onClick={() => setShowSettingsModal(false)} className="p-3 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-full hover:bg-slate-100 shadow-sm"><X size={20}/></button>
                      </div>
                      
                      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-white/50">
                          <button onClick={() => setSettingsTab('info')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'info' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t.infoTab}</button>
                          <button onClick={() => setSettingsTab('members')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'members' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t.membersTab}</button>
                          <button onClick={() => setSettingsTab('personalize')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'personalize' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>{t.themeTab}</button>
                      </div>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/30 flex-1">
                      {settingsTab === 'info' && (
                        <div className="space-y-6 animate-slide-up">
                             <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-[2rem] p-8 text-white shadow-float relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-20 bg-white opacity-10 rounded-full blur-3xl -translate-y-10 translate-x-10 group-hover:translate-x-5 transition-transform duration-700"></div>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="bg-white p-3 rounded-2xl shadow-lg mb-6 transform group-hover:scale-105 transition-transform duration-500">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeGroup.joinCode}`} alt="QR Code" className="w-32 h-32 rounded-xl mix-blend-multiply" />
                                    </div>
                                    <div className="flex items-center gap-2 bg-black/20 p-2 pr-2 pl-4 rounded-2xl backdrop-blur-md border border-white/10 w-full max-w-[280px]">
                                        <QrCode size={20} className="text-white/80"/>
                                        <div className="font-mono text-2xl font-black text-white tracking-widest flex-1">{activeGroup.joinCode}</div>
                                        <button onClick={() => copyToClipboard(activeGroup.joinCode)} className="p-3 bg-white/20 text-white rounded-xl hover:bg-white hover:text-indigo-600 active:scale-95 transition-all shadow-md" title={t.copyLink}>
                                            {copiedCode ? <Check size={20} className="text-emerald-300"/> : <Copy size={20}/>}
                                        </button>
                                    </div>
                                    <button onClick={handleShareGroup} className="mt-4 px-6 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-xs hover:bg-indigo-50 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/20 active:scale-95">
                                        <Share2 size={16}/> {t.shareGroup}
                                    </button>
                                </div>
                             </div>

                             <div className="space-y-3">
                                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.groupDesc}</h4>
                                 <div className="bg-white p-5 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600 shadow-sm leading-relaxed">
                                     {activeGroup.description || t.noDesc}
                                 </div>
                             </div>

                             {activeGroup.leaderId === currentUserId ? (
                                  <button onClick={handleDeleteGroup} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 hover:text-red-600 transition-colors flex items-center justify-center gap-2 border border-red-100 shadow-sm"><Trash2 size={18}/> {t.deleteGroup}</button>
                              ) : (
                                  <button onClick={handleLeaveGroup} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-200 shadow-sm"><LogOut size={18}/> {t.leaveGroup}</button>
                              )}
                        </div>
                      )}

                      {settingsTab === 'members' && (
                        <div className="space-y-8 animate-slide-up">
                           <div className="space-y-3">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">{t.inviteMembers}</label>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                      <input type="text" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()} placeholder="Email, ID..." className="w-full pl-11 pr-4 py-3.5 bg-white border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-medium outline-none transition-all shadow-sm"/>
                                  </div>
                                  <button onClick={handleSearchUsers} disabled={isSearching || !memberSearchQuery} className="bg-indigo-600 text-white px-5 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center min-w-[60px] shadow-lg shadow-indigo-200 transition-transform active:scale-95">{isSearching ? <Loader2 size={20} className="animate-spin"/> : t.search}</button>
                              </div>
                              {foundUsers.length > 0 && <div className="bg-white rounded-2xl p-2 space-y-1 border border-slate-100 shadow-md animate-fade-in">{foundUsers.map(u => (<div key={u.uid} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-colors"><div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-full border border-white shadow-sm" alt=""/><div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{u.name}</p><p className="text-xs text-slate-400 truncate">{u.email}</p></div></div><button onClick={() => handleAddMember(u)} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"><Plus size={16}/></button></div>))}</div>}
                           </div>
                           
                           <div className="space-y-4">
                              <div className="flex justify-between items-center px-1">
                                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t.memberList} ({activeGroup.members?.length || 0})</label>
                              </div>
                              <div className="space-y-3">
                                  {activeGroup.members?.map((member) => (
                                      <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow group">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-4">
                                                  <div className="relative">
                                                    <img src={member.avatar} className="w-12 h-12 rounded-[1rem] object-cover bg-slate-100 border-2 border-white shadow-sm group-hover:scale-105 transition-transform duration-300" alt=""/>
                                                    {member.role === 'leader' && <div className="absolute -bottom-2 -right-2 bg-amber-400 text-white p-1 rounded-full border-2 border-white shadow-sm"><Crown size={12} fill="currentColor" /></div>}
                                                  </div>
                                                  <div>
                                                      <div className="flex items-center gap-2">
                                                          <p className="text-sm font-bold text-slate-800">{member.name}</p>
                                                      </div>
                                                      <p className="text-xs text-indigo-500 font-bold bg-indigo-50 inline-block px-2 py-0.5 rounded-md mt-1">{member.customTitle || t.member}</p>
                                                  </div>
                                              </div>
                                              {/* Only Leader can edit/remove others. Users can edit themselves? Maybe not in this version to keep simple. */}
                                              {activeGroup.leaderId === currentUserId && member.id !== currentUserId && (
                                                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                      <button onClick={() => handlePromoteMember(member.id)} className="p-2 text-amber-500 hover:text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors" title={t.leader}><Crown size={16}/></button>
                                                      <button onClick={() => startEditingMember(member)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors" title={t.edit}><Edit2 size={16}/></button>
                                                      <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl hover:bg-red-50 transition-colors" title={t.delete}><UserMinus size={16}/></button>
                                                  </div>
                                              )}
                                          </div>
                                          
                                          {editingMemberId === member.id && (
                                              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-50 animate-fade-in bg-slate-50/50 -mx-4 -mb-4 p-4 rounded-b-2xl">
                                                  <div className="grid grid-cols-2 gap-3">
                                                      <div className="space-y-1">
                                                          <label className="text-[10px] font-bold text-slate-400 uppercase">{t.roleTitle}</label>
                                                          <input value={editMemberTitle} onChange={(e) => setEditMemberTitle(e.target.value)} placeholder="VD: Designer" className="w-full p-2.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-all"/>
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-[10px] font-bold text-slate-400 uppercase">{t.internalNote}</label>
                                                          <input value={editMemberNote} onChange={(e) => setEditMemberNote(e.target.value)} placeholder="Ghi chú nội bộ" className="w-full p-2.5 bg-white border border-slate-200 focus:border-indigo-500 rounded-xl text-sm font-medium outline-none transition-all"/>
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-3 justify-end mt-1">
                                                      <button onClick={() => setEditingMemberId(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">{t.cancel}</button>
                                                      <button onClick={() => handleUpdateMemberInfo(member.id)} className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">{t.saveChanges}</button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                           </div>
                        </div>
                      )}

                      {settingsTab === 'personalize' && (
                        <div className="space-y-6 animate-slide-up">
                            <div className="p-6 bg-gradient-to-br from-indigo-50 to-white rounded-2xl border border-indigo-100 text-indigo-800 text-sm font-medium leading-relaxed shadow-sm">
                                <p>🎨 {t.themeHint}</p>
                            </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[ { val: '', bg: 'bg-slate-100 border-2 border-dashed border-slate-300' }, { val: 'linear-gradient(to right, #ec4899, #8b5cf6)', bg: 'bg-gradient-to-r from-pink-500 to-violet-500' }, { val: 'linear-gradient(to right, #3b82f6, #06b6d4)', bg: 'bg-gradient-to-r from-blue-500 to-cyan-500' }, { val: '#1e293b', bg: 'bg-slate-800' } ].map((c, i) => (
                                    <button key={i} onClick={() => handleUpdatePersonalGroupSettings(c.val)} className={`aspect-square rounded-2xl ${c.bg} shadow-md hover:scale-105 transition-all relative ring-offset-2 focus:ring-4 ring-indigo-100 overflow-hidden group`}>
                                        {(activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground || '') === c.val && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"><Check size={32} className="text-white drop-shadow-md animate-scale-in"/></div>}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => personalBgInputRef.current?.click()} className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 font-bold text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 group">
                                <ImageIcon size={20} className="group-hover:scale-110 transition-transform"/> {t.uploadDevice}
                            </button>
                            <input type="file" ref={personalBgInputRef} className="hidden" accept="image/*" onChange={handlePersonalBgUpload} />
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