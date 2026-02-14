import React, { useState, useEffect, useRef, Suspense, useMemo } from 'react';
import { ListTodo, Wand2, Globe, BarChart3, UserCircle2, CheckSquare, MessageSquare, WifiOff, Users, Plus, ScanLine, Share2, Copy, X, Camera, Image as ImageIcon, Settings, Shield, ShieldAlert, UserMinus, Trash2, LogOut, UserPlus, Loader2, Home, LayoutGrid, Layout, ChevronRight, Activity, Search, AlertCircle, LogIn } from 'lucide-react';
import { AppTab, Language, Group, UserProfile, Task } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { useOnlineStatus } from './hooks/useOnlineStatus';
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
      <span className="text-sm font-bold tracking-tight opacity-60">Đang tối ưu hóa dữ liệu...</span>
    </div>
  </div>
);

const AppContent: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AppTab>('tasks');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { language, setLanguage, t } = useLanguage();
  const isOnline = useOnlineStatus();
  
  const [myGroups, setMyGroups] = useRealtimeStorage<Group[]>('my_groups', []);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  
  // Modals
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false); // New modal for group settings

  // Create Group State
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupImage, setNewGroupImage] = useState('');
  
  // Member Management State
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [foundUsers, setFoundUsers] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [userProfile] = useRealtimeStorage<UserProfile>('user_profile', { name: 'Người dùng', email: 'guest', avatar: '', provider: null, isLoggedIn: false });
  
  // FIX: Use SESSION_KEY to get the actual unique ID (UID) used by authentication and TodoList.
  const currentUserId = typeof window !== 'undefined' ? (localStorage.getItem(SESSION_KEY) || 'guest') : 'guest';
  
  const activeGroup = myGroups.find(g => g.id === activeGroupId) || null;

  const [personalTasks] = useRealtimeStorage<Task[]>('daily_tasks', []);
  
  // State to track local storage changes for forcing updates
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

  // Logic tổng hợp task
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

  const handleOpenCreateGroup = () => {
      if (!userProfile.isLoggedIn) {
          alert(t.loginHeader + " - Bạn cần đăng nhập để tạo nhóm!");
          setActiveTab('profile');
          return;
      }
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
              joinedAt: Date.now()
          }],
          joinCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          createdAt: Date.now()
      };
      setMyGroups([...myGroups, newGroup]);
      setNewGroupName('');
      setNewGroupImage('');
      setShowGroupModal(false);
      setActiveGroupId(newGroup.id);
      setActiveTab('tasks');
  };

  const handleDeleteGroup = () => {
      if (!activeGroup) return;
      if (activeGroup.leaderId !== currentUserId) {
          alert("Chỉ trưởng nhóm mới có thể xóa nhóm.");
          return;
      }
      if (confirm(`Bạn có chắc chắn muốn xóa nhóm "${activeGroup.name}"? Hành động này không thể hoàn tác.`)) {
          // Remove tasks from storage
          localStorage.removeItem(`group_${activeGroup.id}_tasks`);
          // Remove group from list
          const updatedGroups = myGroups.filter(g => g.id !== activeGroup.id);
          setMyGroups(updatedGroups);
          setActiveGroupId(null);
          setShowSettingsModal(false);
          setActiveTab('tasks');
      }
  };

  const handleSearchUsers = async () => {
      if (!memberSearchQuery.trim()) return;
      setIsSearching(true);
      try {
          const results = await searchUsers(memberSearchQuery);
          // Filter out users already in the group
          const existingMemberIds = activeGroup?.members.map(m => m.id) || [];
          setFoundUsers(results.filter((u: any) => !existingMemberIds.includes(u.uid)));
      } catch (error) {
          console.error(error);
      } finally {
          setIsSearching(false);
      }
  };

  const handleAddMember = (user: any) => {
      if (!activeGroup) return;
      const newMember = {
          id: user.uid,
          name: user.name,
          avatar: user.avatar,
          role: 'member' as const,
          joinedAt: Date.now()
      };
      const updatedGroup = {
          ...activeGroup,
          members: [...activeGroup.members, newMember]
      };
      setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
      // Remove from search results
      setFoundUsers(foundUsers.filter(u => u.uid !== user.uid));
  };

  const handleRemoveMember = (memberId: string) => {
      if (!activeGroup) return;
      if (activeGroup.leaderId !== currentUserId) return;
      if (memberId === activeGroup.leaderId) return; // Cannot remove leader

      if(confirm("Xóa thành viên này khỏi nhóm?")) {
          const updatedGroup = {
              ...activeGroup,
              members: activeGroup.members.filter(m => m.id !== memberId)
          };
          setMyGroups(myGroups.map(g => g.id === activeGroup.id ? updatedGroup : g));
      }
  };

  const NavItem = ({ tab, icon: Icon, label }: any) => (
    <button
      onClick={() => { setActiveTab(tab); setActiveGroupId(null); }}
      className={`w-full flex items-center justify-between px-5 py-3.5 rounded-2xl transition-all duration-300 font-bold group mb-1.5 ${
        activeTab === tab && activeGroupId === null
          ? `bg-indigo-600 text-white shadow-lg shadow-indigo-200` 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <Icon size={20} className={`${activeTab === tab && activeGroupId === null ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500 transition-colors'}`} />
        <span className="text-[14px] tracking-tight">{label}</span>
      </div>
      {activeTab === tab && activeGroupId === null && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
    </button>
  );

  return (
    <div className={`flex h-[100dvh] w-full transition-colors duration-1000 overflow-hidden relative ${activeGroupId ? 'bg-[#f4faf8]' : 'bg-[#fcfdfe]'}`}>
      <div className="absolute inset-0 bg-noise z-0"></div>
      
      <NotificationManager notifications={notifications} onDismiss={dismissNotification} />
      
      {/* Dynamic Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
          <div className={`absolute top-[-10%] left-[-5%] w-[45%] h-[45%] rounded-full blur-[160px] transition-all duration-1000 ${activeGroupId ? 'bg-emerald-300/30' : 'bg-indigo-300/30'}`}></div>
          <div className={`absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full blur-[160px] transition-all duration-1000 ${activeGroupId ? 'bg-teal-300/30' : 'bg-violet-300/30'}`}></div>
      </div>

      <aside className="hidden md:flex flex-col w-72 bg-white/60 backdrop-blur-3xl border-r border-slate-100 shrink-0 z-20 relative shadow-[1px_0_10px_rgba(0,0,0,0.02)]">
        <div className="p-8 pb-4">
          <div className="flex items-center gap-4 mb-10 group cursor-pointer">
            <div className={`w-12 h-12 transition-all duration-700 rounded-2xl flex items-center justify-center text-white shadow-xl ${activeGroupId ? 'bg-emerald-600 rotate-6 shadow-emerald-200' : 'bg-indigo-600 -rotate-6 shadow-indigo-200'} group-hover:rotate-0`}>
                <CheckSquare size={26} strokeWidth={2.5} />
            </div>
            <div className="flex flex-col">
                <span className="text-xl font-black tracking-tighter text-slate-900 leading-none uppercase">Daily Task</span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1.5">By Mr.Hien</span>
            </div>
          </div>
          
          <div className="space-y-1">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 pl-1 opacity-50">Cá nhân</p>
             <NavItem tab="tasks" icon={Home} label="Trang chủ" />
             <NavItem tab="ai" icon={MessageSquare} label={t.ai} />
             <NavItem tab="reports" icon={Activity} label={t.reports} />
             <NavItem tab="studio" icon={Wand2} label={t.studio} />
             <NavItem tab="profile" icon={UserCircle2} label={t.profile} />
          </div>
        </div>

        <div className="flex-1 px-6 py-4 overflow-y-auto custom-scrollbar border-t border-slate-50 mt-6 bg-slate-50/20">
          <div className="flex items-center justify-between mb-5 px-2">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] opacity-50">Dự án Nhóm</p>
             <div className="flex gap-1.5">
                <button onClick={() => setShowJoinModal(true)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Tham gia"><ScanLine size={14}/></button>
                <button onClick={handleOpenCreateGroup} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" title="Tạo mới"><Plus size={14}/></button>
             </div>
          </div>

          <div className="space-y-2">
              {myGroups.map(group => (
                  <div key={group.id} className="relative group/item">
                    <button
                        onClick={() => { setActiveTab('tasks'); setActiveGroupId(group.id); }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-500 border-2 ${
                            activeGroupId === group.id
                            ? `bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-100` 
                            : 'text-slate-600 bg-white border-transparent hover:border-emerald-100 hover:shadow-sm'
                        }`}
                    >
                        {group.avatar ? (
                            <img src={group.avatar} alt={group.name} className="w-8 h-8 rounded-xl object-cover shrink-0 border border-white/20"/>
                        ) : (
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${activeGroupId === group.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                                {group.name.substring(0,2).toUpperCase()}
                            </div>
                        )}
                        <span className="text-sm font-bold truncate tracking-tight">{group.name}</span>
                    </button>
                    
                    {/* Settings Icon - Show only for active group and if leader */}
                    {activeGroupId === group.id && group.leaderId === currentUserId && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowSettingsModal(true); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-emerald-100 hover:bg-emerald-500 hover:text-white transition-colors"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                  </div>
              ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-50 bg-white/40">
           <button onClick={() => setShowLangMenu(!showLangMenu)} className="w-full flex items-center justify-between px-5 py-4 bg-white/60 hover:bg-white rounded-2xl text-[13px] font-bold text-slate-600 transition-all border border-slate-100 shadow-sm group">
             <span className="flex items-center gap-3"><Globe size={16} className="text-indigo-500 group-hover:rotate-12 transition-transform" /> {languages.find(l => l.code === language)?.label}</span>
             <ChevronRight size={14} className="opacity-30 group-hover:translate-x-0.5 transition-transform" />
           </button>
           {showLangMenu && (
             <div className="absolute bottom-24 left-6 right-6 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 animate-scale-in z-50">
               {languages.map((lang) => (
                 <button key={lang.code} onClick={() => { setLanguage(lang.code); setShowLangMenu(false); }} className={`w-full text-left px-6 py-3 text-[14px] font-bold hover:bg-indigo-50 transition-colors ${language === lang.code ? 'text-indigo-600 bg-indigo-50/50' : 'text-slate-600'}`}>
                   {lang.label}
                 </button>
               ))}
             </div>
           )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative h-full overflow-hidden z-10">
        <div className="flex-1 overflow-hidden relative md:p-6 h-full flex flex-col">
           <div className={`flex-1 w-full max-w-[1600px] mx-auto bg-white/95 backdrop-blur-3xl md:rounded-[3rem] border transition-all duration-700 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.1)] relative overflow-hidden flex flex-col ${activeGroupId ? 'border-emerald-100' : 'border-slate-100'}`}>
               <div className="flex-1 overflow-hidden animate-fade-in h-full">
                   <Suspense fallback={<LoadingFallback />}>
                       {activeTab === 'tasks' ? <TodoList activeGroup={activeGroup} /> : 
                       activeTab === 'ai' ? <AiAssistant /> :
                       activeTab === 'reports' ? <Reports /> : 
                       activeTab === 'profile' ? <Profile /> : <ImageEditor />}
                   </Suspense>
               </div>
           </div>
        </div>

        <div className="md:hidden bg-white/95 backdrop-blur-2xl border-t border-slate-100 pb-safe pt-3 px-6 flex justify-around items-center z-30 shadow-[0_-10px_40px_rgba(0,0,0,0.05)]">
          {[
              { id: 'tasks', icon: activeGroupId ? Users : Home },
              { id: 'ai', icon: MessageSquare },
              { id: 'reports', icon: BarChart3 },
              { id: 'profile', icon: UserCircle2 }
          ].map((item) => (
              <button key={item.id} onClick={() => { setActiveTab(item.id as AppTab); if(item.id !== 'tasks') setActiveGroupId(null); }} className={`p-4 rounded-2xl transition-all relative ${activeTab === item.id ? (activeGroupId ? 'text-emerald-600 bg-emerald-50' : 'text-indigo-600 bg-indigo-50') : 'text-slate-400'}`}>
                <item.icon size={24} strokeWidth={activeTab === item.id ? 2.5 : 2} />
                {activeTab === item.id && <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${activeGroupId ? 'bg-emerald-600' : 'bg-indigo-600'}`}></div>}
              </button>
          ))}
          {/* Mobile Settings button for active group */}
          {activeGroupId && activeGroup?.leaderId === currentUserId && (
              <button 
                onClick={() => setShowSettingsModal(true)}
                className="p-4 rounded-2xl text-emerald-600 bg-emerald-50 relative"
              >
                 <Settings size={24} strokeWidth={2.5} />
              </button>
          )}
        </div>
      </main>

      {/* Group Create Modal */}
      {showGroupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[3rem] p-10 w-full max-w-sm shadow-2xl animate-scale-in relative border border-white">
                  <button onClick={() => setShowGroupModal(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  <h3 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Tạo nhóm dự án</h3>
                  <div className="space-y-6">
                      <div className="flex justify-center">
                          <div className="relative w-28 h-28 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all overflow-hidden group/upload">
                              {newGroupImage ? <img src={newGroupImage} alt="Group" className="w-full h-full object-cover" /> : <ImageIcon size={36} className="text-slate-300 group-hover/upload:scale-110 transition-transform" />}
                              <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    const reader = new FileReader();
                                    reader.onloadend = () => setNewGroupImage(reader.result as string);
                                    reader.readAsDataURL(file);
                                  }
                              }} />
                          </div>
                      </div>
                      <input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="w-full p-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] font-bold text-slate-800 focus:ring-4 focus:ring-indigo-100 transition-all outline-none" placeholder="Tên nhóm của bạn..." />
                      <button onClick={handleCreateGroup} className="w-full py-5 bg-indigo-600 text-white rounded-[1.5rem] font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all uppercase tracking-[0.2em] text-[11px]">Tạo không gian làm việc</button>
                  </div>
              </div>
          </div>
      )}

      {/* Group Settings Modal */}
      {showSettingsModal && activeGroup && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl animate-scale-in border border-white flex flex-col max-h-[85vh]">
                  <div className="p-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-[2.5rem]">
                      <div>
                          <h3 className="text-xl font-black text-slate-900">Quản lý nhóm</h3>
                          <p className="text-sm text-slate-400 font-medium">{activeGroup.name}</p>
                      </div>
                      <button onClick={() => setShowSettingsModal(false)} className="p-2 text-slate-300 hover:text-slate-900 transition-colors"><X size={24}/></button>
                  </div>

                  <div className="overflow-y-auto p-8 space-y-8 custom-scrollbar">
                      
                      {/* Invite / Add Member Section */}
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Thêm thành viên</label>
                          <div className="flex gap-2">
                              <div className="relative flex-1">
                                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"/>
                                  <input 
                                    type="text" 
                                    value={memberSearchQuery}
                                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                                    placeholder="Nhập tên, email hoặc ID..." 
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-100"
                                  />
                              </div>
                              <button 
                                onClick={handleSearchUsers}
                                disabled={isSearching || !memberSearchQuery}
                                className="bg-indigo-600 text-white px-4 rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                              >
                                  {isSearching ? <Loader2 size={18} className="animate-spin"/> : "Tìm"}
                              </button>
                          </div>
                          
                          {foundUsers.length > 0 && (
                              <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                                  {foundUsers.map(user => (
                                      <div key={user.uid} className="flex items-center justify-between p-3 border-b border-slate-100 last:border-0">
                                          <div className="flex items-center gap-3">
                                              <img src={user.avatar} className="w-8 h-8 rounded-full bg-white" alt="avatar"/>
                                              <div>
                                                  <p className="text-sm font-bold text-slate-800">{user.name}</p>
                                                  <p className="text-xs text-slate-500">{user.email}</p>
                                              </div>
                                          </div>
                                          <button 
                                            onClick={() => handleAddMember(user)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                            title="Thêm"
                                          >
                                              <Plus size={16}/>
                                          </button>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      {/* Members List */}
                      <div className="space-y-4">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex justify-between">
                              <span>Thành viên ({activeGroup.members.length})</span>
                              <span className="text-slate-300">Mã: {activeGroup.joinCode}</span>
                          </label>
                          <div className="space-y-2">
                              {activeGroup.members.map((member) => (
                                  <div key={member.id} className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                                      <div className="flex items-center gap-3">
                                          <img src={member.avatar} className="w-10 h-10 rounded-xl object-cover" alt={member.name}/>
                                          <div>
                                              <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                                  {member.name}
                                                  {member.role === 'leader' && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase tracking-wider">Leader</span>}
                                              </p>
                                              <p className="text-[10px] text-slate-400 font-mono">ID: {member.id.slice(0, 8)}...</p>
                                          </div>
                                      </div>
                                      
                                      {member.role !== 'leader' && (
                                          <button 
                                            onClick={() => handleRemoveMember(member.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                            title="Xóa khỏi nhóm"
                                          >
                                              <UserMinus size={18}/>
                                          </button>
                                      )}
                                  </div>
                              ))}
                          </div>
                      </div>

                      {/* Danger Zone */}
                      <div className="pt-6 border-t border-slate-100">
                          <button 
                            onClick={handleDeleteGroup}
                            className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                              <Trash2 size={18}/> Xóa nhóm vĩnh viễn
                          </button>
                      </div>

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