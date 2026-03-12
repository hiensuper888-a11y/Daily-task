import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Mail, Save, Calendar, MapPin, Home, Briefcase, Camera, Phone, LayoutDashboard, Building2, UserSquare, Lock, Trash2, AlertTriangle, Flame, Trophy, MessageSquareHeart } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { UserProfile, Task } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  updateProfile,
  changePassword,
  deleteOwnAccount,
  getCurrentUser
} from '../services/authService';
import { Moon, Sun } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

const DEFAULT_PROFILE: UserProfile = {
    uid: '',
    name: '',
    email: '',
    avatar: '',
    provider: null,
    isLoggedIn: false,
    birthYear: '',
    hometown: '',
    address: '',
    company: '',
    phoneNumber: '',
    jobTitle: '',
    department: ''
};

const STREAK_MILESTONES = [
    { days: 1, title: 'Tân Binh Chăm Chỉ', icon: '🌱' },
    { days: 3, title: 'Ngọn Lửa Nhỏ', icon: '🕯️' },
    { days: 7, title: 'Chiến Binh Bền Bỉ', icon: '⚔️' },
    { days: 14, title: 'Kẻ Hủy Diệt Deadline', icon: '💥' },
    { days: 30, title: 'Bậc Thầy Kỷ Luật', icon: '🧘' },
    { days: 60, title: 'Chúa Tể Thời Gian', icon: '⏳' },
    { days: 100, title: 'Huyền Thoại Sống', icon: '🐉' },
    { days: 365, title: 'Thần Đồng Năng Suất', icon: '👑' },
    { days: 730, title: 'Kẻ Thống Trị Kỷ Nguyên', icon: '⚡' },
    { days: 1095, title: 'Thực Thể Bất Tử', icon: '🌌' },
    { days: 1460, title: 'Vị Thần Thời Gian', icon: '⏳' },
    { days: 1825, title: 'Đấng Sáng Tạo', icon: '👁️' },
    { days: 2190, title: 'Kẻ Xuyên Không', icon: '🌀' },
    { days: 2555, title: 'Chúa Tể Vũ Trụ', icon: '🪐' },
    { days: 2920, title: 'Thực Thể Tối Thượng', icon: '✨' },
    { days: 3285, title: 'Đấng Toàn Năng', icon: '🌟' },
    { days: 3650, title: 'Huyền Thoại Vĩnh Cửu', icon: '♾️' },
];

export const Profile: React.FC = () => {
  const { t } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  
  // Hooks
  const [profile, setProfile] = useRealtimeStorage<UserProfile>('user_profile', DEFAULT_PROFILE);
  const [isEditing, setIsEditing] = useState(false);
  const isOnline = useOnlineStatus();
  
  const [editForm, setEditForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Change State
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Feedback State
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  useEffect(() => {
    if (!isEditing) {
        setEditForm(profile);
    }
  }, [profile, isEditing]);

  const logout = () => { 
      // Dispatch event to trigger exit animation in App.tsx
      window.dispatchEvent(new Event('logout-start'));
  };

  const handleSave = async () => { 
      setProfile(editForm); 
      setIsEditing(false); 
      try { 
          const user = await getCurrentUser();
          if (isFirebaseConfigured() && user) {
              await updateProfile(user, { 
                  displayName: editForm.name, 
                  photoURL: editForm.avatar,
                  birthYear: editForm.birthYear,
                  hometown: editForm.hometown,
                  address: editForm.address,
                  company: editForm.company,
                  phoneNumber: editForm.phoneNumber,
                  jobTitle: editForm.jobTitle,
                  department: editForm.department
              }); 
          }
      } catch (error) {} 
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setEditForm(prev => ({ ...prev, [name]: value })); };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditForm(prev => ({ ...prev, avatar: reader.result as string })); }; reader.readAsDataURL(file); } e.target.value = ''; };

  const handleChangePassword = async () => {
      if (newPassword !== confirmPassword) {
          alert(t.passwordMismatch);
          return;
      }
      if (newPassword.length < 6) {
          alert(t.passwordTooShort);
          return;
      }
      try {
          await changePassword(profile.uid || '', newPassword);
          alert(t.passwordChanged);
          setShowPasswordChange(false);
          setNewPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          alert(t.errorPrefix + error.message);
      }
  };

  const handleDeleteAccount = async () => {
      if (confirm(t.deleteAccountConfirm)) {
          try {
              await deleteOwnAccount(profile.uid || '');
              alert(t.accountDeleted);
              logout();
          } catch (error: any) {
              alert(t.errorPrefix + error.message);
          }
      }
  };

  const renderProfileScreen = () => (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-28 pt-4 px-4">
        {/* Header Card */}
        <div className="glass-panel rounded-[2.5rem] p-6 md:p-10 mb-6 flex flex-col md:flex-row items-center gap-8 relative overflow-hidden group border-white/60 dark:border-white/10">
             <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-indigo-50 to-pink-50 dark:from-indigo-900/10 dark:to-pink-900/10 rounded-full blur-3xl -z-10 opacity-60"></div>
             
             <div className="relative group">
                 <div className="w-32 h-32 rounded-[2rem] p-1.5 bg-white dark:bg-slate-800 shadow-lg relative z-10 border border-slate-100 dark:border-slate-700">
                     <img src={editForm.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"} className="w-full h-full rounded-[1.7rem] object-cover bg-slate-50 dark:bg-slate-900" alt="Avatar"/>
                     {isEditing && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-xl shadow-md hover:scale-110 transition-transform ring-4 ring-white dark:ring-slate-800">
                            <Camera size={16}/>
                        </button>
                     )}
                     <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                 </div>
             </div>

             <div className="flex-1 text-center md:text-left relative z-10">
                 {isEditing ? (
                     <input name="name" value={editForm.name} onChange={handleInputChange} className="text-3xl font-black text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 border-b-2 border-indigo-500 outline-none w-full md:w-auto text-center md:text-left rounded-lg px-2 py-1"/>
                 ) : (
                     <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight mb-1">{profile.name}</h2>
                 )}
                 <p className="text-slate-400 dark:text-slate-500 font-medium flex items-center justify-center md:justify-start gap-1.5 text-sm mb-4 bg-slate-50 dark:bg-slate-800 inline-block px-3 py-1 rounded-full border border-slate-100 dark:border-slate-700">
                     <Mail size={14}/> {profile.email}
                 </p>
                 
                 <div className="flex gap-3 justify-center md:justify-start">
                     {isEditing ? (
                         <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"><Save size={16}/> {t.save}</button>
                     ) : (
                         <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2 border border-slate-200"><LayoutDashboard size={16}/> {t.edit}</button>
                     )}
                     <button 
                        onClick={toggleTheme} 
                        className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-all active:scale-95 shadow-sm flex items-center justify-center"
                        title={theme === 'light' ? t.darkMode : t.lightMode}
                      >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                      </button>
                      <button onClick={logout} className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors border border-red-100 dark:border-red-900/30"><LogOut size={16}/></button>
                 </div>
             </div>
        </div>

        {/* Streak & Achievements Section */}
        <div className="glass-panel rounded-[2.5rem] p-6 md:p-8 mb-6 border-white/60 dark:border-white/10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-orange-500/10 to-rose-500/10 rounded-full blur-3xl -z-10 opacity-60"></div>
            
            <div className="flex items-center gap-4 mb-6">
                <div className="w-20 h-20 rounded-2xl bg-slate-900/5 dark:bg-slate-900/50 flex items-center justify-center relative overflow-visible group">
                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-orange-600/30 rounded-full blur-3xl animate-pulse group-hover:bg-orange-500/40 transition-colors duration-500"></div>
                    
                    {/* Realistic Fire Core - Surrounding & Rising */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        {/* 1. Large Back Flame (Red/Dark Orange) - Shape Follower */}
                        <Flame size={56} className="absolute text-red-600 blur-[8px] animate-fire-wave-intense opacity-80 dark:mix-blend-screen origin-bottom" style={{ animationDuration: '1.5s' }} />
                        
                        {/* 2. Middle Flame (Orange/Amber) - Shape Follower */}
                        <Flame size={48} className="absolute text-orange-500 blur-[4px] animate-fire-wave-intense opacity-90 dark:mix-blend-screen origin-bottom" style={{ animationDelay: '-0.5s', animationDuration: '1.3s' }} />
                        
                        {/* 3. Inner Flame (Yellow) - Shape Follower */}
                        <Flame size={40} className="absolute text-yellow-400 blur-[2px] animate-fire-wave-intense opacity-100 dark:mix-blend-screen origin-bottom" style={{ animationDelay: '-1s', animationDuration: '1.1s' }} />

                        {/* Rising Sparks/Embers - Floating up */}
                        <div className="absolute bottom-0 left-1/2 w-1 h-1 bg-yellow-200 rounded-full animate-spark-rise opacity-0 blur-[0.5px]" style={{ animationDuration: '1.5s', animationDelay: '0.2s' }}></div>
                        <div className="absolute bottom-0 left-[30%] w-0.5 h-0.5 bg-orange-300 rounded-full animate-spark-rise opacity-0 blur-[0.5px]" style={{ animationDuration: '2.2s', animationDelay: '0.8s' }}></div>
                        <div className="absolute bottom-2 left-[70%] w-0.5 h-0.5 bg-white rounded-full animate-spark-rise opacity-0 blur-[0.5px]" style={{ animationDuration: '1.8s', animationDelay: '0.5s' }}></div>
                        <div className="absolute bottom-1 left-[40%] w-0.5 h-0.5 bg-amber-100 rounded-full animate-spark-rise opacity-0 blur-[0.5px]" style={{ animationDuration: '2.5s', animationDelay: '0.1s' }}></div>

                        {/* Main Icon - Centered in the heat */}
                        <Flame size={36} className="relative z-10 text-white drop-shadow-[0_0_15px_rgba(255,100,0,0.8)] animate-fire-flicker-intense" />
                    </div>
                </div>
                <div>
                    <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 group-hover:text-orange-500 transition-colors">Chuỗi Giữ Lửa</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Hoàn thành tất cả nhiệm vụ trong ngày</p>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Hiện Tại</p>
                    <p className="text-3xl font-black text-orange-500 flex items-center justify-center gap-1 drop-shadow-sm">
                        {profile.currentStreak || 0} <Flame size={24} className="text-orange-500 fill-orange-500 animate-fire-pulse" />
                    </p>
                </div>
                <div className="bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 text-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Kỷ Lục</p>
                    <p className="text-3xl font-black text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1">
                        {profile.longestStreak || 0} <span className="text-lg">👑</span>
                    </p>
                </div>
                <div className="col-span-2 bg-white/50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex flex-col justify-center">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Danh Hiệu Cao Nhất</p>
                    <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                        {profile.unlockedTitles && profile.unlockedTitles.length > 0 
                            ? profile.unlockedTitles[profile.unlockedTitles.length - 1] 
                            : 'Chưa có danh hiệu'}
                    </p>
                </div>
            </div>

            <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500"/> Bộ Sưu Tập Danh Hiệu
                </h4>
                <div className="flex flex-wrap gap-3">
                    {STREAK_MILESTONES.map(milestone => {
                        const isUnlocked = profile.unlockedTitles?.includes(milestone.title) || (profile.longestStreak || 0) >= milestone.days;
                        return (
                            <div key={milestone.days} className={`px-4 py-2 rounded-xl border text-sm font-bold flex items-center gap-2 transition-all ${isUnlocked ? 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-200 dark:border-amber-700/50 text-amber-700 dark:text-amber-400 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60 grayscale'}`}>
                                <span>{milestone.icon}</span>
                                <span>{milestone.title}</span>
                                <span className="text-[10px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-md ml-1">{milestone.days}d</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <InfoCard title={t.personalInfo} icon={User} color="orange">
                <InfoRow icon={Calendar} label={t.birthYear} name="birthYear" value={editForm.birthYear} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Phone} label={t.phoneNumber} name="phoneNumber" value={editForm.phoneNumber} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Home} label={t.address} name="address" value={editForm.address} isEditing={isEditing} onChange={handleInputChange} />
            </InfoCard>

            <InfoCard title={t.work} icon={Briefcase} color="blue">
                 <InfoRow icon={Briefcase} label={t.company} name="company" value={editForm.company} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={UserSquare} label={t.jobTitle} name="jobTitle" value={editForm.jobTitle} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={Building2} label={t.department} name="department" value={editForm.department} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={MapPin} label={t.hometown} name="hometown" value={editForm.hometown} isEditing={isEditing} onChange={handleInputChange} />
                 <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.statusLabel}</span>
                     <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                         <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                         {isOnline ? t.online : 'Offline'}
                     </span>
                 </div>
            </InfoCard>
        </div>

        {/* Account Settings Section */}
        <div className="glass-panel rounded-[2rem] p-8 border-white/60 dark:border-white/10 mb-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                    <Lock size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.accountSecurity}</h3>
            </div>

            <div className="space-y-6">
                {/* Change Password */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-100">{t.changePassword}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.updatePasswordDesc}</p>
                        </div>
                        <button 
                            onClick={() => setShowPasswordChange(!showPasswordChange)}
                            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                            {showPasswordChange ? t.cancel : t.edit}
                        </button>
                    </div>

                    {showPasswordChange && (
                        <div className="space-y-3 animate-slide-up">
                            <input 
                                type="password" 
                                placeholder={t.newPassword} 
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none dark:text-slate-100"
                            />
                            <input 
                                type="password" 
                                placeholder={t.confirmNewPassword} 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none dark:text-slate-100"
                            />
                            <button 
                                onClick={handleChangePassword}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-colors shadow-md"
                            >
                                {t.saveNewPassword}
                            </button>
                        </div>
                    )}
                </div>

                {/* Delete Account */}
                <div className="bg-rose-50 dark:bg-rose-900/10 p-6 rounded-2xl border border-rose-100 dark:border-rose-900/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                            <AlertTriangle size={20}/>
                        </div>
                        <div>
                            <h4 className="font-bold text-rose-700 dark:text-rose-400">{t.deleteAccount}</h4>
                            <p className="text-xs text-rose-600/80 dark:text-rose-400/80 mt-1">{t.deleteAccountDesc}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleDeleteAccount}
                        className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400 rounded-xl font-bold text-xs hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors shadow-sm whitespace-nowrap"
                    >
                        {t.delete}
                    </button>
                </div>
            </div>
        </div>

        {/* Help & Feedback Section */}
        <div className="glass-panel rounded-[2rem] p-8 border-white/60 dark:border-white/10 mb-6">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400">
                    <MessageSquareHeart size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Trợ giúp & Phản hồi</h3>
            </div>

            <div className="bg-gradient-to-br from-indigo-500/5 to-purple-500/5 dark:from-indigo-900/10 dark:to-purple-900/10 p-6 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 flex flex-col sm:flex-row items-center justify-between gap-6">
                <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100">Bạn nghĩ gì về Daily Task?</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                        Mọi ý kiến đóng góp của bạn đều giúp chúng tôi cải thiện ứng dụng tốt hơn mỗi ngày. Đừng ngần ngại chia sẻ nhé!
                    </p>
                </div>
                <button 
                    onClick={() => setShowFeedbackModal(true)}
                    className="px-6 py-3 w-full sm:w-auto bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/25 active:scale-95 whitespace-nowrap flex items-center justify-center gap-2"
                >
                    <MessageSquareHeart size={18} /> Gửi Góp Ý
                </button>
            </div>
        </div>

        <FeedbackModal isOpen={showFeedbackModal} onClose={() => setShowFeedbackModal(false)} />
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto custom-scrollbar">
       {renderProfileScreen()}
    </div>
  );
};

// Helper Components for Cleaner Code
const InfoCard = ({ title, icon: Icon, color, children }: any) => {
    const colorClasses = {
        orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400',
        blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
    };
    return (
        <div className="glass-panel rounded-[2rem] p-8 hover:shadow-lg transition-shadow border-white/60 dark:border-white/10">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
            </div>
            <div className="space-y-5">{children}</div>
        </div>
    );
};

const InfoRow = ({ icon: Icon, label, name, value, isEditing, onChange }: any) => {
    const { t } = useLanguage();
    return (
        <div className="group">
            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">{label}</label>
            {isEditing ? (
                <input name={name} value={value} onChange={onChange} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 outline-none transition-all dark:text-slate-100"/>
            ) : (
                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-3 h-10 border-b border-slate-50 dark:border-slate-800">
                    <Icon size={16} className="text-slate-300 dark:text-slate-600"/>
                    {value || <span className="text-slate-300 dark:text-slate-600 italic font-normal text-xs">{t.notUpdated}</span>}
                </div>
            )}
        </div>
    );
};