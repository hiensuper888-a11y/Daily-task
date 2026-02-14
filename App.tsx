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
  <div className="flex items-center justify-center h-full w-full bg-white">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Loader2 size={40} className="animate-spin text-indigo-600" />
      </div>
    </div>
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
  const [settingsTab, setSettingsTab] = useState<'info' | 'personalize'>('info');

  const [newGroupName, setNewGroupName] = useState('');
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

  const resetModalState = () => { setNewGroupName(''); setNewGroupImage(''); setJoinCodeInput(''); };
  
  const handleOpenCreateGroup = () => { setShowGroupModal(true); };
  
  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      const newGroup: Group = {
          id: Date.now().toString(),
          name: newGroupName,
          leaderId: currentUserId,
          avatar: newGroupImage,
          members: [{ id: currentUserId, name: userProfile.name || 'Người dùng', avatar: userProfile.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUserId}`, role: 'leader', joinedAt: Date.now(), customTitle: 'Trưởng nhóm', note: 'Quản trị viên', headerBackground: '' }],
          joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(), createdAt: Date.now()
      };
      saveGlobalGroup(newGroup);
      setMyGroups(prev => [...prev, newGroup]);
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
      if (!targetGroup) { alert("Mã nhóm không tồn tại hoặc không tìm thấy."); return; }
      
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
      alert(`Đã tham gia nhóm "${updatedGroup.name}" thành công!`);
  };

  const handleDeleteGroup = () => { 
      if (!activeGroup || activeGroup.leaderId !== currentUserId) return; 
      if (confirm(`Xóa vĩnh viễn nhóm "${activeGroup.name}"? Hành động này không thể hoàn tác.`)) { 
          const groupId = activeGroup.id; 
          setActiveGroupId(null); 
          setShowSettingsModal(false); 
          setActiveTab('tasks'); 
          localStorage.removeItem(`group_${groupId}_tasks`); 
          deleteGlobalGroup(groupId);
          setMyGroups(prev => prev.filter(g => g.id !== groupId)); 
      } 
  };

  const handleLeaveGroup = () => { 
      if (!activeGroup) return; 
      if (confirm(`Rời nhóm "${activeGroup.name}"?`)) { 
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
  const handleRemoveMember = (memberId: string) => { if (!activeGroup || activeGroup.leaderId !== currentUserId || memberId === activeGroup.leaderId) return; if(confirm("Xóa thành viên?")) { const updatedGroup = { ...activeGroup, members: (activeGroup.members || []).filter(m => m.id !== memberId) }; updateGroupMemberState(updatedGroup); } };
  const handleUpdateMemberInfo = (memberId: string) => { if (!activeGroup) return; const updatedMembers = (activeGroup.members || []).map(m => { if (m.id === memberId) return { ...m, customTitle: editMemberTitle, note: editMemberNote }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); setEditingMemberId(null); };
  const handleUpdatePersonalGroupSettings = (headerBg: string) => { if (!activeGroup || !activeGroup.members) return; const updatedMembers = activeGroup.members.map(m => { if (m.id === currentUserId) return { ...m, headerBackground: headerBg }; return m; }); const updatedGroup = { ...activeGroup, members: updatedMembers }; updateGroupMemberState(updatedGroup); };
  const handlePersonalBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { handleUpdatePersonalGroupSettings(reader.result as string); }; reader.readAsDataURL(file); } e.target.value = ''; };
  const startEditingMember = (member: GroupMember) => { setEditingMemberId(member.id); setEditMemberTitle(member.customTitle || ''); setEditMemberNote(member.note || ''); };
  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); };

  const NavItem = ({ tab, icon: Icon, label }: any) => {
    const isActive = activeTab === tab && activeGroupId === null;
    return (
      <button
        onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 font-bold group mb-1 ${
          isActive
            ? `bg-indigo-50 text-indigo-700` 
            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
        }`}
      >
        <div className="flex items-center gap-3">
          <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
          <span className="text-sm">{label}</span>
        </div>
        {isActive && <ChevronRight size={14} className="text-indigo-400"/>}
      </button>
    );
  };

  if (!userProfile.isLoggedIn) {
      return (
          <div className="h-[100dvh] w-full flex items-center justify-center bg-white overflow-hidden relative">
              <div className="mesh-bg absolute inset-0 z-0 opacity-40"></div>
              <div className="relative z-10 w-full h-full flex flex-col">
                  <Suspense fallback={<LoadingFallback />}>
                      <Profile />
                  </Suspense>
              </div>
          </div>
      );
  }

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden relative bg-[#f8fafc]">
      
      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white border-r border-slate-100 shrink-0 z-20 relative transition-all overflow-hidden h-full">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => {setActiveTab('tasks'); setActiveGroupId(null);}}>
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
                <CheckSquare size={22} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight text-slate-900 leading-tight">Daily Task</span>
                <span className="text-[10px] font-bold text-slate-400">by Mr.Hien</span>
            </div>
          </div>
          
          <div className="space-y-0.5">
             <NavItem tab="tasks" icon={Home} label="Tổng quan" />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
             <NavItem tab="reports" icon={Activity} label={t.reports} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
          </div>
        </div>

        <div className="flex-1 px-4 overflow-y-auto custom-scrollbar pt-2 border-t border-slate-50">
          <div className="flex items-center justify-between mb-2 px-2 pt-4">
             <p className="text-xs font-bold text-slate-400">Dự án & Nhóm</p>
             <button onClick={handleOpenCreateGroup} className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-all" title="Tạo mới"><Plus size={16}/></button>
          </div>

          <div className="space-y-1">
              {myGroups.map(group => (
                  <div key={group.id} className="relative group/item">
                    <button
                        onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 border ${
                            activeGroupId === group.id
                            ? `bg-white border-indigo-200 shadow-sm z-10 relative` 
                            : 'bg-transparent border-transparent hover:bg-slate-50 text-slate-600'
                        }`}
                    >
                        <span className={`w-2 h-2 rounded-full ${activeGroupId === group.id ? 'bg-indigo-500' : 'bg-slate-300'}`}></span>
                        <span className={`text-sm font-bold truncate flex-1 text-left ${activeGroupId === group.id ? 'text-indigo-900' : 'text-slate-600'}`}>{group.name}</span>
                        {activeGroupId === group.id && <Settings size={14} className="text-slate-300 hover:text-indigo-600 cursor-pointer" onClick={(e) => {e.stopPropagation(); setShowSettingsModal(true); setSettingsTab('info');}} />}
                    </button>
                  </div>
              ))}
              <button onClick={() => setShowJoinModal(true)} className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600 mt-2">
                  <ScanLine size={14}/> <span>Nhập mã tham gia...</span>
              </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100">
           <button onClick={() => setShowLangMenu(!showLangMenu)} className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-slate-500 hover:bg-slate-50 transition-all">
             <span className="flex items-center gap-2"><Globe size={14} /> {languages.find(l => l.code === language)?.label}</span>
           </button>
           {showLangMenu && (
             <div className="absolute bottom-16 left-4 right-4 bg-white rounded-xl shadow-xl border border-slate-100 py-1 animate-scale-in z-50">
               {languages.map((lang) => (
                 <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }} className={`w-full text-left px-4 py-2 text-xs font-medium hover:bg-slate-50 transition-colors ${language === lang.code ? 'text-indigo-600' : 'text-slate-600'}`}>
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
           <div className="flex-1 overflow-hidden animate-fade-in h-full bg-[#fcfcfc] relative">
               <Suspense fallback={<LoadingFallback />}>
                   {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                   activeTab === 'ai' ? <AiAssistant /> :
                   activeTab === 'reports' ? <Reports activeGroup={activeGroup} key={activeGroupId || 'personal'} /> : 
                   activeTab === 'profile' ? <Profile /> : <ImageEditor />}
               </Suspense>
           </div>

        {/* MOBILE BOTTOM NAVIGATION - CLEANER */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-[40] pb-safe bg-white border-t border-slate-200">
            <div className="flex justify-around items-end h-[60px] pb-2">
              {[
                  { id: 'tasks', icon: Home, label: 'Việc' },
                  { id: 'reports', icon: BarChart3, label: 'TK' },
                  { id: 'create', icon: Plus, special: true },
                  { id: 'ai', icon: MessageSquare, label: 'AI' },
                  { id: 'profile', icon: UserCircle2, label: 'Tôi' }
              ].map((item) => {
                  if (item.special) {
                      return (
                        <button key="create" onClick={activeGroupId ? () => {setShowSettingsModal(true); setSettingsTab('info')} : handleOpenCreateGroup} className="mb-4">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-100 border-4 border-white ${activeGroupId ? 'bg-slate-800' : 'bg-indigo-600'}`}>
                                {activeGroupId ? <Settings size={24}/> : <Plus size={28} strokeWidth={3} />}
                            </div>
                        </button>
                      );
                  }
                  
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                        key={item.id}
                        onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }}
                        className={`flex flex-col items-center justify-center w-16 h-full transition-all ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
                    >
                        <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className="mb-1" />
                        <span className="text-[10px] font-bold">{item.label}</span>
                    </button>
                  );
              })}
            </div>
        </div>
      </main>

      {/* Modals remain mostly the same, ensuring glass effect matches */}
      {showJoinModal && (
          <div onClick={() => setShowJoinModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => { setShowJoinModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Tham gia nhóm</h3>
                  <div className="space-y-4">
                      <input 
                        value={joinCodeInput} 
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} 
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-center text-2xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none tracking-widest uppercase placeholder:text-slate-300" 
                        placeholder="CODE" 
                      />
                      <button onClick={handleJoinGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">Tham gia ngay</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Creation Modal */}
      {showGroupModal && (
          <div onClick={() => setShowGroupModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl animate-scale-in relative">
                  <button onClick={() => { setShowGroupModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-xl font-bold text-slate-900 mb-6 text-center">Tạo nhóm mới</h3>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div 
                            onClick={() => groupImageInputRef.current?.click()}
                            className="relative w-24 h-24 rounded-2xl bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all overflow-hidden group/upload"
                          >
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={28} className="text-slate-300 group-hover/upload:scale-110 transition-transform" />}
                              <input ref={groupImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setNewGroupImage(reader.result as string); reader.readAsDataURL(file); } e.target.value = ''; }} />
                          </div>
                      </div>
                      <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none text-center placeholder:text-slate-400" placeholder="Đặt tên nhóm..." />
                      <button onClick={handleCreateGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">Tạo nhóm</button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && activeGroup && (
          <div onClick={() => setShowSettingsModal(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-sm animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="bg-white rounded-3xl w-full max-w-lg shadow-2xl animate-scale-in flex flex-col max-h-[85vh]">
                  <div className="p-6 pb-4 border-b border-slate-100 flex flex-col sticky top-0 bg-white z-10 rounded-t-3xl">
                      <div className="flex items-center justify-between mb-4">
                          <div>
                              <h3 className="text-lg font-bold text-slate-800">Cài đặt nhóm</h3>
                              <p className="text-sm text-slate-500 font-medium">{activeGroup.name}</p>
                          </div>
                          <button onClick={() => setShowSettingsModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                      </div>
                      
                      <div className="flex bg-slate-100 p-1 rounded-xl">
                          <button onClick={() => setSettingsTab('info')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settingsTab === 'info' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Thành viên</button>
                          <button onClick={() => setSettingsTab('personalize')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settingsTab === 'personalize' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Giao diện</button>
                      </div>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      {settingsTab === 'info' ? (
                        <>
                           <div className="space-y-3">
                              <label className="text-xs font-bold text-slate-500">Mời thành viên</label>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                      <input type="text" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()} placeholder="Email, ID..." className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 transition-all"/>
                                  </div>
                                  <button onClick={handleSearchUsers} disabled={isSearching || !memberSearchQuery} className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center min-w-[60px]">{isSearching ? <Loader2 size={18} className="animate-spin"/> : "Tìm"}</button>
                              </div>
                              {foundUsers.length > 0 && <div className="bg-slate-50 rounded-xl p-2 space-y-1 border border-slate-100">{foundUsers.map(u => (<div key={u.uid} className="flex items-center justify-between p-2 hover:bg-white rounded-lg transition-colors"><div className="flex items-center gap-2"><img src={u.avatar} className="w-8 h-8 rounded-full" alt=""/><div className="min-w-0"><p className="text-xs font-bold text-slate-800 truncate">{u.name}</p></div></div><button onClick={() => handleAddMember(u)} className="p-1.5 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200"><Plus size={14}/></button></div>))}</div>}
                              
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between shadow-sm">
                                  <div><p className="text-[10px] text-slate-400 font-bold uppercase">Mã tham gia</p><p className="text-lg font-black text-slate-800 tracking-widest font-mono">{activeGroup.joinCode}</p></div>
                                  <button onClick={() => copyToClipboard(activeGroup.joinCode)} className="p-2 text-slate-500 hover:text-indigo-600 bg-white rounded-lg shadow-sm border border-slate-100">{copiedCode ? <Check size={16}/> : <Copy size={16}/>}</button>
                              </div>
                           </div>
                           
                           <div className="space-y-3">
                              <label className="text-xs font-bold text-slate-500">Danh sách ({activeGroup.members?.length || 0})</label>
                              <div className="space-y-2">
                                  {activeGroup.members?.map((member) => (
                                      <div key={member.id} className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-3">
                                                  <img src={member.avatar} className="w-10 h-10 rounded-xl object-cover bg-slate-100" alt=""/>
                                                  <div><p className="text-sm font-bold text-slate-800">{member.name}</p><p className="text-[11px] text-indigo-600 font-medium">{member.customTitle || 'Thành viên'}</p></div>
                                              </div>
                                              {activeGroup.leaderId === currentUserId && member.id !== currentUserId && (
                                                  <div className="flex gap-1">
                                                      <button onClick={() => startEditingMember(member)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-lg"><Edit2 size={14}/></button>
                                                      <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-lg"><UserMinus size={14}/></button>
                                                  </div>
                                              )}
                                          </div>
                                          
                                          {editingMemberId === member.id && (
                                              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-50 animate-fade-in">
                                                  <input value={editMemberTitle} onChange={(e) => setEditMemberTitle(e.target.value)} placeholder="Chức danh" className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"/>
                                                  <input value={editMemberNote} onChange={(e) => setEditMemberNote(e.target.value)} placeholder="Ghi chú" className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none"/>
                                                  <div className="flex gap-2 justify-end mt-1">
                                                      <button onClick={() => setEditingMemberId(null)} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Hủy</button>
                                                      <button onClick={() => handleUpdateMemberInfo(member.id)} className="px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg">Lưu</button>
                                                  </div>
                                              </div>
                                          )}
                                      </div>
                                  ))}
                              </div>
                           </div>
                           
                            <div className="pt-4">
                              {activeGroup.leaderId === currentUserId ? (
                                  <button onClick={handleDeleteGroup} className="w-full py-3 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"><Trash2 size={16}/> Xóa nhóm</button>
                              ) : (
                                  <button onClick={handleLeaveGroup} className="w-full py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"><LogOut size={16}/> Rời nhóm</button>
                              )}
                          </div>
                        </>
                      ) : (
                        <div className="space-y-6">
                            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 text-indigo-800 text-xs font-medium"><p>Thay đổi hình nền chỉ áp dụng cho tài khoản của bạn.</p></div>
                             <div className="grid grid-cols-5 gap-3">
                                {[ { val: '', bg: 'bg-slate-100 border-2 border-dashed border-slate-300' }, { val: 'linear-gradient(to right, #ec4899, #8b5cf6)', bg: 'bg-gradient-to-r from-pink-500 to-violet-500' }, { val: 'linear-gradient(to right, #3b82f6, #06b6d4)', bg: 'bg-gradient-to-r from-blue-500 to-cyan-500' }, { val: '#1e293b', bg: 'bg-slate-800' } ].map((c, i) => (
                                    <button key={i} onClick={() => handleUpdatePersonalGroupSettings(c.val)} className={`aspect-square rounded-xl ${c.bg} shadow-sm hover:scale-105 transition-transform relative ring-offset-2 focus:ring-2 ring-indigo-500`}>
                                        {(activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground || '') === c.val && <div className="absolute inset-0 flex items-center justify-center"><Check size={16} className="text-white drop-shadow-md"/></div>}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => personalBgInputRef.current?.click()} className="w-full py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50 transition-colors">Tải ảnh lên</button>
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