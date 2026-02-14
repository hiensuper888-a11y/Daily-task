import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, Users, Plus, ScanLine, Copy, X, Image as ImageIcon, Settings, UserMinus, Trash2, LogOut, Loader2, Home, ChevronRight, Activity, Search, Check, Edit2, QrCode, Share2, Crown, Shield } from 'lucide-react';
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
  <div className="flex items-center justify-center h-full w-full bg-white/50 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <Loader2 size={40} className="animate-spin text-indigo-600" />
        <div className="absolute inset-0 animate-pulse bg-indigo-200 rounded-full blur-xl opacity-20"></div>
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

interface NavItemProps {
  tab: AppTab;
  icon: any;
  label: string;
  activeTab: AppTab;
  activeGroupId: string | null;
  setActiveTab: (tab: AppTab) => void;
  setActiveGroupId: (id: string | null) => void;
}

const NavItem: React.FC<NavItemProps> = ({ tab, icon: Icon, label, activeTab, activeGroupId, setActiveTab, setActiveGroupId }) => {
  const isActive = activeTab === tab && activeGroupId === null;
  return (
    <button
      onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold group mb-1 relative overflow-hidden ${
        isActive
          ? `bg-indigo-50/80 text-indigo-600 shadow-sm` 
          : 'text-slate-500 hover:bg-white/60 hover:text-slate-900 hover:shadow-sm'
      }`}
    >
      {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-500 rounded-r-full"></div>}
      <Icon size={22} strokeWidth={isActive ? 2.5 : 2} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-105'}`} />
      <span className="text-[15px] tracking-tight">{label}</span>
    </button>
  );
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
  
  const handleCreateGroup = () => {
      if (!newGroupName.trim()) return;
      const newGroup: Group = {
          id: Date.now().toString(),
          name: newGroupName,
          description: newGroupDesc,
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
    <div className="flex h-[100dvh] w-full overflow-hidden relative">
      
      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex flex-col w-[280px] bg-white/50 backdrop-blur-xl border-r border-white/50 shrink-0 z-20 relative transition-all overflow-hidden h-full shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-10 cursor-pointer group" onClick={() => {setActiveTab('tasks'); setActiveGroupId(null);}}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 group-hover:scale-105 transition-transform duration-300">
                <CheckSquare size={24} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black tracking-tight text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">Daily Task</span>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">by Mr.Hien</span>
            </div>
          </div>
          
          <div className="space-y-2">
             <NavItem tab="tasks" icon={Home} label="Tổng quan" activeTab={activeTab} activeGroupId={activeGroupId} setActiveTab={setActiveTab} setActiveGroupId={setActiveGroupId} />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} activeTab={activeTab} activeGroupId={activeGroupId} setActiveTab={setActiveTab} setActiveGroupId={setActiveGroupId} />
             <NavItem tab="reports" icon={Activity} label={t.reports} activeTab={activeTab} activeGroupId={activeGroupId} setActiveTab={setActiveTab} setActiveGroupId={setActiveGroupId} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} activeTab={activeTab} activeGroupId={activeGroupId} setActiveTab={setActiveTab} setActiveGroupId={setActiveGroupId} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} activeTab={activeTab} activeGroupId={activeGroupId} setActiveTab={setActiveTab} setActiveGroupId={setActiveGroupId} />
          </div>
        </div>

        <div className="flex-1 px-4 overflow-y-auto custom-scrollbar pt-4">
          <div className="flex items-center justify-between mb-4 px-3">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Dự án & Nhóm</p>
             <button onClick={handleOpenCreateGroup} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all shadow-sm" title="Tạo mới"><Plus size={14}/></button>
          </div>

          <div className="space-y-1.5 pb-20">
              {myGroups.map(group => (
                  <div key={group.id} className="relative group/item">
                    <button
                        onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-200 border ${
                            activeGroupId === group.id
                            ? `bg-white border-indigo-100 shadow-md shadow-slate-200/50 z-10 relative` 
                            : 'bg-transparent border-transparent hover:bg-white/50 text-slate-600 hover:shadow-sm'
                        }`}
                    >
                        <span className={`w-2.5 h-2.5 rounded-full ${activeGroupId === group.id ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-slate-300'}`}></span>
                        <span className={`text-sm font-bold truncate flex-1 text-left ${activeGroupId === group.id ? 'text-slate-800' : 'text-slate-500'}`}>{group.name}</span>
                        {activeGroupId === group.id && <Settings size={14} className="text-slate-300 hover:text-indigo-600 cursor-pointer" onClick={(e) => {e.stopPropagation(); setShowSettingsModal(true); setSettingsTab('info');}} />}
                    </button>
                  </div>
              ))}
              <button onClick={() => setShowJoinModal(true)} className="w-full flex items-center gap-3 px-3 py-2.5 mt-4 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors border-t border-dashed border-slate-200 pt-4">
                  <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center"><ScanLine size={12}/></div>
                  <span>Nhập mã tham gia...</span>
              </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
           <div className="flex-1 overflow-hidden animate-fade-in h-full relative">
               <Suspense fallback={<LoadingFallback />}>
                   {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                   activeTab === 'ai' ? <AiAssistant /> :
                   activeTab === 'reports' ? <Reports activeGroup={activeGroup} key={activeGroupId || 'personal'} /> : 
                   activeTab === 'profile' ? <Profile /> : <ImageEditor />}
               </Suspense>
           </div>

        {/* MOBILE FLOATING DOCK - Modern iOS Style */}
        <div className="lg:hidden fixed bottom-6 left-4 right-4 z-[40]">
            <div className="glass-panel rounded-[2rem] shadow-2xl shadow-indigo-500/10 p-1.5 flex justify-between items-center border border-white/50 relative">
              {[
                  { id: 'tasks', icon: Home, label: 'Việc' },
                  { id: 'reports', icon: BarChart3, label: 'TK' },
                  { id: 'create', icon: Plus, special: true },
                  { id: 'ai', icon: MessageSquare, label: 'AI' },
                  { id: 'profile', icon: UserCircle2, label: 'Tôi' }
              ].map((item) => {
                  if (item.special) {
                      return (
                        <div key="create" className="relative -top-6 mx-2">
                           <button onClick={activeGroupId ? () => {setShowSettingsModal(true); setSettingsTab('info')} : handleOpenCreateGroup} className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/40 border-[6px] border-[#f8fafc] flex items-center justify-center btn-bounce">
                                {activeGroupId ? <Settings size={28}/> : <Plus size={32} strokeWidth={3} />}
                           </button>
                        </div>
                      );
                  }
                  
                  const isActive = activeTab === item.id;
                  return (
                    <button 
                        key={item.id}
                        onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }}
                        className={`flex-1 flex flex-col items-center justify-center py-2 rounded-2xl transition-all duration-300 ${isActive ? 'text-indigo-600 bg-white shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <item.icon size={24} strokeWidth={isActive ? 2.5 : 2} className="mb-0.5" />
                        {isActive && <span className="w-1 h-1 rounded-full bg-indigo-500 mt-1"></span>}
                    </button>
                  );
              })}
            </div>
        </div>
      </main>

      {/* Modals - Wrapped in Glassmorphism */}
      {showJoinModal && (
          <div onClick={() => setShowJoinModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-card bg-white/90 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in relative border border-white/60">
                  <button onClick={() => { setShowJoinModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-xl font-black text-slate-800 mb-6 text-center tracking-tight">Tham gia nhóm</h3>
                  <div className="space-y-4">
                      <input 
                        value={joinCodeInput} 
                        onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())} 
                        className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl font-mono text-center text-3xl font-bold text-slate-800 outline-none tracking-[0.2em] uppercase placeholder:text-slate-300 transition-all" 
                        placeholder="CODE" 
                      />
                      <button onClick={handleJoinGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all btn-bounce">Tham gia ngay</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Creation Modal */}
      {showGroupModal && (
          <div onClick={() => setShowGroupModal(false)} className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-card bg-white/90 rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl animate-scale-in relative border border-white/60">
                  <button onClick={() => { setShowGroupModal(false); resetModalState(); }} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-xl font-black text-slate-800 mb-8 text-center tracking-tight">Tạo nhóm mới</h3>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div 
                            onClick={() => groupImageInputRef.current?.click()}
                            className="relative w-28 h-28 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-300 flex items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all overflow-hidden group/upload shadow-inner"
                          >
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={32} className="text-slate-300 group-hover/upload:scale-110 transition-transform" />}
                              <input ref={groupImageInputRef} type="file" className="hidden" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => setNewGroupImage(reader.result as string); reader.readAsDataURL(file); } e.target.value = ''; }} />
                          </div>
                      </div>
                      <div className="space-y-3">
                          <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl font-bold text-lg text-slate-800 outline-none text-center placeholder:text-slate-300 transition-all" placeholder="Đặt tên nhóm..." />
                          <input value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} className="w-full p-4 bg-slate-50 border-2 border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl font-medium text-sm text-slate-600 outline-none text-center placeholder:text-slate-300 transition-all" placeholder="Mô tả ngắn (tùy chọn)..." />
                      </div>
                      <button onClick={handleCreateGroup} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all btn-bounce">Tạo nhóm</button>
                  </div>
              </div>
          </div>
      )}

      {/* Settings Modal - Enhanced for Management */}
      {showSettingsModal && activeGroup && (
          <div onClick={() => setShowSettingsModal(false)} className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/20 backdrop-blur-md animate-fade-in">
              <div onClick={e => e.stopPropagation()} className="glass-card bg-white/95 rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-scale-in flex flex-col max-h-[85vh] border border-white/60">
                  <div className="p-6 pb-4 border-b border-slate-100 flex flex-col sticky top-0 bg-white/50 backdrop-blur-xl z-10 rounded-t-[2.5rem]">
                      <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                              {activeGroup.avatar ? (
                                  <img src={activeGroup.avatar} className="w-10 h-10 rounded-xl object-cover bg-slate-100" alt=""/>
                              ) : (
                                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-600"><Users size={20}/></div>
                              )}
                              <div>
                                  <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">{activeGroup.name}</h3>
                                  <p className="text-xs text-slate-500 font-bold mt-1">{activeGroup.members?.length} thành viên</p>
                              </div>
                          </div>
                          <button onClick={() => setShowSettingsModal(false)} className="p-2 text-slate-400 hover:text-slate-900 transition-colors"><X size={24}/></button>
                      </div>
                      
                      <div className="flex bg-slate-100/50 p-1.5 rounded-2xl">
                          <button onClick={() => setSettingsTab('info')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'info' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Thông tin & Share</button>
                          <button onClick={() => setSettingsTab('members')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'members' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Thành viên</button>
                          <button onClick={() => setSettingsTab('personalize')} className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${settingsTab === 'personalize' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>Giao diện</button>
                      </div>
                  </div>

                  <div className="overflow-y-auto p-6 space-y-6 custom-scrollbar">
                      {settingsTab === 'info' && (
                        <div className="space-y-6">
                             {/* Share Card */}
                             <div className="bg-gradient-to-br from-indigo-500 to-violet-600 rounded-3xl p-6 text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-16 bg-white opacity-5 rounded-full blur-2xl -translate-y-10 translate-x-10"></div>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <h4 className="text-sm font-bold uppercase tracking-widest opacity-80 mb-4 flex items-center gap-2"><QrCode size={16}/> Quét mã tham gia</h4>
                                    <div className="bg-white p-2 rounded-2xl shadow-sm mb-4">
                                        <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeGroup.joinCode}`} alt="QR Code" className="w-32 h-32 rounded-xl mix-blend-multiply" />
                                    </div>
                                    <div className="flex items-center gap-2 bg-white/20 p-2 pr-4 rounded-xl backdrop-blur-md border border-white/20 w-full max-w-[240px]">
                                        <div className="h-10 px-3 flex items-center justify-center bg-white rounded-lg shadow-sm font-mono text-lg font-black text-indigo-600 tracking-wider flex-1">{activeGroup.joinCode}</div>
                                        <button onClick={() => copyToClipboard(activeGroup.joinCode)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                                            {copiedCode ? <Check size={20} className="text-emerald-300"/> : <Copy size={20}/>}
                                        </button>
                                    </div>
                                    <p className="text-xs mt-4 opacity-70 font-medium">Chia sẻ mã này với những người bạn muốn mời vào nhóm.</p>
                                </div>
                             </div>

                             {/* Group Info */}
                             <div className="space-y-3">
                                 <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Mô tả nhóm</h4>
                                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-sm font-medium text-slate-600">
                                     {activeGroup.description || "Chưa có mô tả."}
                                 </div>
                             </div>

                             {activeGroup.leaderId === currentUserId ? (
                                  <button onClick={handleDeleteGroup} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-bold text-sm hover:bg-red-100 hover:text-red-600 transition-colors flex items-center justify-center gap-2 border border-red-100"><Trash2 size={18}/> Xóa nhóm vĩnh viễn</button>
                              ) : (
                                  <button onClick={handleLeaveGroup} className="w-full py-4 bg-slate-50 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-100 transition-colors flex items-center justify-center gap-2 border border-slate-200"><LogOut size={18}/> Rời nhóm</button>
                              )}
                        </div>
                      )}

                      {settingsTab === 'members' && (
                        <div className="space-y-6">
                           <div className="space-y-3">
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Mời thành viên</label>
                              <div className="flex gap-2">
                                  <div className="relative flex-1">
                                      <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                                      <input type="text" value={memberSearchQuery} onChange={(e) => setMemberSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()} placeholder="Email, ID..." className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-transparent focus:border-indigo-200 focus:bg-white rounded-2xl text-sm font-medium outline-none transition-all"/>
                                  </div>
                                  <button onClick={handleSearchUsers} disabled={isSearching || !memberSearchQuery} className="bg-indigo-600 text-white px-5 rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center min-w-[60px] shadow-md shadow-indigo-200">{isSearching ? <Loader2 size={20} className="animate-spin"/> : "Tìm"}</button>
                              </div>
                              {foundUsers.length > 0 && <div className="bg-white/50 rounded-2xl p-2 space-y-1 border border-slate-100 shadow-sm">{foundUsers.map(u => (<div key={u.uid} className="flex items-center justify-between p-2 hover:bg-white rounded-xl transition-colors"><div className="flex items-center gap-3"><img src={u.avatar} className="w-10 h-10 rounded-full border border-white shadow-sm" alt=""/><div className="min-w-0"><p className="text-sm font-bold text-slate-800 truncate">{u.name}</p></div></div><button onClick={() => handleAddMember(u)} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200 transition-colors"><Plus size={16}/></button></div>))}</div>}
                           </div>
                           
                           <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Danh sách ({activeGroup.members?.length || 0})</label>
                                  {activeGroup.leaderId === currentUserId && <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold">Quyền Quản trị</span>}
                              </div>
                              <div className="space-y-3">
                                  {activeGroup.members?.map((member) => (
                                      <div key={member.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col hover:shadow-md transition-shadow">
                                          <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-4">
                                                  <div className="relative">
                                                    <img src={member.avatar} className="w-12 h-12 rounded-2xl object-cover bg-slate-100 border-2 border-white shadow-sm" alt=""/>
                                                    {member.role === 'leader' && <div className="absolute -bottom-2 -right-2 bg-amber-400 text-white p-1 rounded-full border-2 border-white shadow-sm"><Crown size={12} fill="currentColor" /></div>}
                                                  </div>
                                                  <div>
                                                      <div className="flex items-center gap-2">
                                                          <p className="text-sm font-bold text-slate-800">{member.name}</p>
                                                          {member.role === 'leader' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">LEADER</span>}
                                                      </div>
                                                      <p className="text-xs text-indigo-500 font-bold bg-indigo-50 inline-block px-2 py-0.5 rounded-md mt-1">{member.customTitle || 'Thành viên'}</p>
                                                  </div>
                                              </div>
                                              {/* Only Leader can edit/remove others. Users can edit themselves? Maybe not in this version to keep simple. */}
                                              {activeGroup.leaderId === currentUserId && member.id !== currentUserId && (
                                                  <div className="flex gap-2">
                                                      <button onClick={() => startEditingMember(member)} className="p-2 text-slate-400 hover:text-indigo-600 bg-slate-50 rounded-xl hover:bg-indigo-50 transition-colors" title="Chỉnh sửa vai trò"><Edit2 size={16}/></button>
                                                      <button onClick={() => handleRemoveMember(member.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 rounded-xl hover:bg-red-50 transition-colors" title="Xóa khỏi nhóm"><UserMinus size={16}/></button>
                                                  </div>
                                              )}
                                          </div>
                                          
                                          {editingMemberId === member.id && (
                                              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-slate-50 animate-fade-in">
                                                  <div className="grid grid-cols-2 gap-3">
                                                      <div className="space-y-1">
                                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Chức danh</label>
                                                          <input value={editMemberTitle} onChange={(e) => setEditMemberTitle(e.target.value)} placeholder="VD: Designer" className="w-full p-2.5 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all"/>
                                                      </div>
                                                      <div className="space-y-1">
                                                          <label className="text-[10px] font-bold text-slate-400 uppercase">Ghi chú</label>
                                                          <input value={editMemberNote} onChange={(e) => setEditMemberNote(e.target.value)} placeholder="Ghi chú nội bộ" className="w-full p-2.5 bg-slate-50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all"/>
                                                      </div>
                                                  </div>
                                                  <div className="flex gap-3 justify-end mt-1">
                                                      <button onClick={() => setEditingMemberId(null)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Hủy</button>
                                                      <button onClick={() => handleUpdateMemberInfo(member.id)} className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 transition-all">Lưu thay đổi</button>
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
                        <div className="space-y-6">
                            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 text-indigo-800 text-sm font-medium leading-relaxed">
                                <p>🎨 Thay đổi hình nền header giúp không gian làm việc của bạn sinh động hơn. Cài đặt này chỉ áp dụng cho tài khoản của bạn.</p>
                            </div>
                             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[ { val: '', bg: 'bg-slate-100 border-2 border-dashed border-slate-300' }, { val: 'linear-gradient(to right, #ec4899, #8b5cf6)', bg: 'bg-gradient-to-r from-pink-500 to-violet-500' }, { val: 'linear-gradient(to right, #3b82f6, #06b6d4)', bg: 'bg-gradient-to-r from-blue-500 to-cyan-500' }, { val: '#1e293b', bg: 'bg-slate-800' } ].map((c, i) => (
                                    <button key={i} onClick={() => handleUpdatePersonalGroupSettings(c.val)} className={`aspect-square rounded-2xl ${c.bg} shadow-sm hover:scale-105 transition-all relative ring-offset-2 focus:ring-2 ring-indigo-500 overflow-hidden`}>
                                        {(activeGroup.members?.find(m => m.id === currentUserId)?.headerBackground || '') === c.val && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[1px]"><Check size={24} className="text-white drop-shadow-md"/></div>}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => personalBgInputRef.current?.click()} className="w-full py-4 rounded-2xl border-2 border-dashed border-slate-200 font-bold text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                                <ImageIcon size={20}/> Tải ảnh lên từ thiết bị
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