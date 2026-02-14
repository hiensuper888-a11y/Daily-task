import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Cloud, RefreshCw, Mail, Save, AlertCircle, Calendar, MapPin, Home, Briefcase, Camera, Phone, Lock, LogIn, UserPlus, Eye, EyeOff, Fingerprint, LayoutDashboard } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile, 
  sendEmailVerification 
} from '../services/firebaseConfig';

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
    phoneNumber: ''
};

export const Profile: React.FC = () => {
  const { t } = useLanguage();
  
  // Hooks
  const [profile, setProfile] = useRealtimeStorage<UserProfile>('user_profile', DEFAULT_PROFILE);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const isOnline = useOnlineStatus();
  
  // Auth State
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false); // State for password visibility

  // Update System State
  const APP_VERSION = "1.2.0";
  const [editForm, setEditForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
        setEditForm(profile);
    }
  }, [profile, isEditing]);

  // --- AUTHENTICATION LOGIC ---

  const handleEmailAuth = async () => {
    if (!isFirebaseConfigured()) {
        alert("Lỗi: Ứng dụng chưa được cấu hình Firebase. Vui lòng liên hệ quản trị viên.");
        return;
    }
    
    if (!isOnline) {
        alert("Vui lòng kết nối mạng để đăng nhập.");
        return;
    }
    if (!emailInput || !passwordInput) {
        alert("Vui lòng nhập email và mật khẩu.");
        return;
    }
    
    setIsSyncing(true);
    const cleanEmail = emailInput.trim().toLowerCase();

    try {
        if (authMode === 'register') {
            // 1. REGISTER
            const credential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordInput);
            const user = credential.user;
            
            // 2. SEND VERIFICATION
            await sendEmailVerification(user);
            
            // 3. FORCE LOGOUT (Require verification first)
            await signOut(auth);
            
            alert(`Đăng ký thành công! Một email xác nhận đã được gửi tới ${cleanEmail}. Vui lòng chờ 2-3 giây để hệ thống giả lập xác nhận, sau đó đăng nhập.`);
            setAuthMode('login'); // Switch to login screen
        } else {
            // 1. LOGIN
            const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
            const user = credential.user;

            // 2. CHECK VERIFICATION
            if (!user.emailVerified) {
                await signOut(auth); // Sign out immediately
                alert("Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email của bạn. (Trong bản demo này, vui lòng đợi vài giây sau khi đăng ký để hệ thống tự kích hoạt).");
                setIsSyncing(false);
                return;
            }

            // 3. SUCCESS
            loginSuccess(user, 'email');
        }

    } catch (error: any) {
        console.error("Auth Error:", error);
        let msg = error.message;
        if (error.code === 'auth/email-already-in-use') msg = "Email này đã được sử dụng.";
        if (error.code === 'auth/wrong-password') msg = "Sai mật khẩu.";
        if (error.code === 'auth/user-not-found') msg = "Tài khoản không tồn tại. Vui lòng kiểm tra email hoặc đăng ký mới.";
        if (error.code === 'auth/weak-password') msg = "Mật khẩu quá yếu.";
        alert(`Lỗi: ${msg}`);
        setIsSyncing(false);
    } finally {
        if (authMode === 'register') setIsSyncing(false); // Only stop loading here for register, Login continues in loginSuccess
    }
  };

  const loginSuccess = (user: any, provider: string) => {
    // PRESERVE GUEST DATA
    const guestTasks = localStorage.getItem('guest_daily_tasks');
    const guestReflections = localStorage.getItem('guest_reflections');
    const guestChat = localStorage.getItem('guest_ai_chat_history');

    // 1. Set Session Key
    const userId = user.uid; // Use UID as the key, stricter than email
    localStorage.setItem(SESSION_KEY, userId);

    // 2. MIGRATE DATA IF NEW ACCOUNT EMPTY
    if (guestTasks && !localStorage.getItem(`${userId}_daily_tasks`)) {
        localStorage.setItem(`${userId}_daily_tasks`, guestTasks);
    }
    if (guestReflections && !localStorage.getItem(`${userId}_reflections`)) {
        localStorage.setItem(`${userId}_reflections`, guestReflections);
    }
    if (guestChat && !localStorage.getItem(`${userId}_ai_chat_history`)) {
        localStorage.setItem(`${userId}_ai_chat_history`, guestChat);
    }
    
    // 3. Trigger Event
    window.dispatchEvent(new Event('auth-change'));

    // 4. Update Profile State
    const newProfile: UserProfile = {
        uid: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        provider: provider as any,
        isLoggedIn: true,
        birthYear: '',
        hometown: '',
        address: '',
        company: '',
        phoneNumber: ''
    };

    const existingProfileStr = localStorage.getItem(`${userId}_user_profile`);
    let finalProfile = newProfile;

    if (existingProfileStr) {
        try {
            const existing = JSON.parse(existingProfileStr);
            finalProfile = { ...existing, ...newProfile, uid: user.uid }; // Ensure UID is always fresh
        } catch (e) { /* ignore */ }
    }

    localStorage.setItem(`${userId}_user_profile`, JSON.stringify(finalProfile));

    setTimeout(() => {
        setProfile(finalProfile);
        setEditForm(finalProfile);
        setIsSyncing(false);
        setEmailInput('');
        setPasswordInput('');
        window.dispatchEvent(new Event('local-storage'));
    }, 50);
  };

  const logout = () => {
    setIsSyncing(true);
    if (isFirebaseConfigured() && auth) {
        signOut(auth).catch(console.error);
    }

    setProfile(DEFAULT_PROFILE);

    setTimeout(() => {
        localStorage.removeItem(SESSION_KEY);
        window.dispatchEvent(new Event('auth-change'));
        setIsEditing(false);
        setIsSyncing(false);
        setAuthMode('login');
    }, 500);
  };

  // --- PROFILE MANAGEMENT ---

  const handleSave = async () => {
    setProfile(editForm);
    setIsEditing(false);

    try {
        if (isFirebaseConfigured() && auth && auth.currentUser) {
            await updateProfile(auth.currentUser, {
                displayName: editForm.name,
                photoURL: editForm.avatar
            });
        }
    } catch (error) {
        console.error("Failed to update remote profile:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditForm(prev => ({ ...prev, avatar: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input to allow re-selection
  };

  // --- UI RENDERERS ---

  const renderLoginScreen = () => (
    <div className="w-full max-w-sm mx-auto space-y-6 animate-scale-in">
        <div className="text-center space-y-2 mb-8">
             <div className="relative w-32 h-32 mx-auto mb-8">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                <div className="relative w-full h-full bg-white/80 backdrop-blur-xl rounded-[2rem] shadow-2xl flex items-center justify-center border border-white/60">
                    <User size={64} className="text-indigo-600 drop-shadow-sm" strokeWidth={1.5} />
                </div>
             </div>
             <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                {authMode === 'login' ? 'Đăng Nhập' : 'Đăng Ký Tài Khoản'}
             </h2>
             <p className="text-slate-500 font-medium text-sm">
                {authMode === 'login' ? 'Truy cập không gian làm việc của bạn' : 'Tham gia để quản lý công việc hiệu quả'}
             </p>
             {!isFirebaseConfigured() && (
                 <div className="mt-4 p-3 bg-red-50 text-red-700 text-xs font-bold rounded-xl border border-red-200 flex items-center justify-center gap-2">
                     <AlertCircle size={16}/> Hệ thống chưa cấu hình Firebase.
                 </div>
             )}
        </div>

        <div className="glass-modern p-8 rounded-[2.5rem] shadow-2xl border border-white/80 space-y-6 relative overflow-hidden backdrop-blur-xl">
             
             <div className="space-y-4">
                 <div className="group relative">
                    <Mail size={20} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10"/>
                    <input 
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Địa chỉ Email"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50/50 border-none ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none text-sm font-bold text-slate-700 transition-all placeholder:text-slate-400"
                    />
                 </div>
                 <div className="group relative">
                    <Lock size={20} className="absolute left-4 top-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors z-10"/>
                    <input 
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Mật khẩu"
                        className="w-full pl-12 pr-12 py-4 bg-slate-50/50 border-none ring-1 ring-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none text-sm font-bold text-slate-700 transition-all placeholder:text-slate-400"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-4 text-slate-400 hover:text-indigo-600 p-0.5 rounded-md transition-colors"
                    >
                        {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                 </div>
                 {authMode === 'register' && (
                     <div className="text-[10px] text-slate-500 px-2 font-medium">
                         * Bạn sẽ cần xác nhận email sau khi đăng ký.
                     </div>
                 )}
             </div>

             <button 
                onClick={handleEmailAuth}
                disabled={isSyncing}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 shadow-xl shadow-slate-300"
             >
                 {isSyncing ? <RefreshCw size={20} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                 {authMode === 'login' ? t.login : t.register}
             </button>

             <div className="text-center pt-4 border-t border-slate-100/50 mt-2">
                 <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="text-xs text-indigo-600 font-bold hover:text-indigo-800 hover:underline transition-colors"
                 >
                    {authMode === 'login' ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
                 </button>
             </div>
        </div>
    </div>
  );

  const renderProfileScreen = () => (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
        
        {/* Banner Card */}
        <div className="relative overflow-hidden rounded-[3rem] bg-white shadow-xl shadow-slate-200/50 border border-white group">
             {/* Cover Image */}
             <div className="h-44 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 relative">
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                 <button 
                    onClick={logout}
                    className="absolute top-6 right-6 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2.5 rounded-xl transition-all shadow-lg border border-white/20"
                    title={t.logout}
                 >
                     <LogOut size={20} />
                 </button>
             </div>

             <div className="px-8 pb-8 relative">
                 <div className="flex flex-col md:flex-row gap-8 items-start">
                     {/* Avatar */}
                     <div className="relative -mt-20 shrink-0 text-center md:text-left mx-auto md:mx-0">
                         <div className="w-36 h-36 rounded-[2.5rem] p-1.5 bg-white shadow-2xl">
                             <img 
                                src={editForm.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
                                className="w-full h-full rounded-[2.2rem] object-cover bg-slate-100 border border-slate-100"
                                alt="Profile"
                             />
                             <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                             {isEditing && (
                                 <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-[-8px] right-[-8px] bg-slate-900 text-white p-3 rounded-full shadow-xl hover:bg-slate-700 transition-colors border-4 border-white hover:scale-110 active:scale-95"
                                 >
                                     <Camera size={18} />
                                 </button>
                             )}
                         </div>
                     </div>

                     {/* Main Info */}
                     <div className="pt-2 flex-1 w-full text-center md:text-left">
                         <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                             <div>
                                 {isEditing ? (
                                     <input 
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleInputChange}
                                        className="text-3xl font-black text-slate-800 bg-transparent border-b-2 border-indigo-500 focus:outline-none w-full md:w-auto text-center md:text-left pb-1"
                                     />
                                 ) : (
                                     <h2 className="text-3xl font-black text-slate-900 tracking-tighter">{profile.name}</h2>
                                 )}
                                 
                                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3">
                                     <div className="flex items-center gap-1.5 text-slate-500 font-bold text-xs bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                                         <Mail size={14}/> {profile.email}
                                     </div>
                                     {profile.uid && (
                                         <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-xs bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100" title="User ID">
                                             <Fingerprint size={14}/> ID: {profile.uid.slice(0, 8)}...
                                         </div>
                                     )}
                                 </div>
                             </div>
                             
                             <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                                 {isEditing ? (
                                     <button onClick={handleSave} className="flex-1 md:flex-none px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95">
                                         <Save size={18}/> {t.saveProfile}
                                     </button>
                                 ) : (
                                     <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none px-8 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-2xl font-bold shadow-sm transition-all flex items-center justify-center gap-2 hover:shadow-md">
                                         <LayoutDashboard size={18}/> {t.editProfile}
                                     </button>
                                 )}
                             </div>
                         </div>
                     </div>
                 </div>
             </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                     <span className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center shadow-sm"><User size={20}/></span>
                     Personal Info
                 </h3>
                 <div className="space-y-5">
                    {[
                        { label: t.birthYear, key: 'birthYear', icon: Calendar },
                        { label: t.phoneNumber, key: 'phoneNumber', icon: Phone },
                        { label: t.address, key: 'address', icon: Home },
                    ].map((item) => (
                        <div key={item.key} className="group">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                {item.label}
                            </label>
                            {isEditing ? (
                                <input 
                                    name={item.key}
                                    value={(editForm[item.key as keyof UserProfile] as string) || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-3 bg-slate-50 border-none ring-1 ring-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 focus:bg-white outline-none transition-all"
                                />
                            ) : (
                                <div className="text-sm font-bold text-slate-700 flex items-center gap-3 h-10 px-1 border-b border-slate-100">
                                    <item.icon size={18} className="text-slate-300"/>
                                    {(profile[item.key as keyof UserProfile] as string) || <span className="text-slate-300 text-xs italic font-normal">Not set</span>}
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
             </div>

             <div className="space-y-6">
                 {/* Work Info */}
                 <div className="glass-card rounded-[2.5rem] p-8 space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                        <span className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm"><Briefcase size={20}/></span>
                        Work Info
                    </h3>
                    <div className="space-y-5">
                        {[
                            { label: t.company, key: 'company', icon: Briefcase },
                            { label: t.hometown, key: 'hometown', icon: MapPin },
                        ].map((item) => (
                            <div key={item.key} className="group">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                    {item.label}
                                </label>
                                {isEditing ? (
                                    <input 
                                        name={item.key}
                                        value={(editForm[item.key as keyof UserProfile] as string) || ''}
                                        onChange={handleInputChange}
                                        className="w-full p-3 bg-slate-50 border-none ring-1 ring-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 focus:bg-white outline-none transition-all"
                                    />
                                ) : (
                                    <div className="text-sm font-bold text-slate-700 flex items-center gap-3 h-10 px-1 border-b border-slate-100">
                                        <item.icon size={18} className="text-slate-300"/>
                                        {(profile[item.key as keyof UserProfile] as string) || <span className="text-slate-300 text-xs italic font-normal">Not set</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* System Info */}
                 <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                     <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-500 rounded-full blur-[60px] opacity-30 group-hover:opacity-50 transition-opacity duration-700"></div>
                     <div className="relative z-10 flex items-center justify-between">
                         <div>
                             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mb-2">System Status</p>
                             <div className="flex items-center gap-3 mb-3">
                                 <div className={`relative flex h-3 w-3`}>
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`}></span>
                                    <span className={`relative inline-flex rounded-full h-3 w-3 ${isOnline ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                                </div>
                                 <span className="font-bold text-base tracking-tight">{isOnline ? 'System Online' : 'Offline Mode'}</span>
                             </div>
                             <p className="text-[10px] text-slate-500 font-mono bg-slate-800 inline-block px-2 py-1 rounded-md border border-slate-700">v{APP_VERSION} (Build 2024.2)</p>
                         </div>
                         <button className="bg-white/10 hover:bg-white/20 p-3 rounded-2xl transition-colors backdrop-blur-sm">
                             <RefreshCw size={24} className="text-indigo-300" />
                         </button>
                     </div>
                 </div>
             </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white shrink-0 shadow-lg z-0 md:rounded-t-[3rem]">
        <div className="absolute right-0 bottom-0 opacity-10 p-4"><Cloud size={140} /></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        
        <h1 className="text-3xl font-black flex items-center gap-3 relative z-10 tracking-tight">
          <Cloud size={32} className="text-indigo-200" />
          {t.loginHeader}
        </h1>
        <p className="text-indigo-100 text-sm mt-2 font-medium opacity-90 relative z-10 max-w-md tracking-wide">
          {t.loginSubHeader}
        </p>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-start overflow-y-auto custom-scrollbar pb-24 relative z-10 -mt-6">
        {profile.isLoggedIn ? renderProfileScreen() : renderLoginScreen()}
      </div>
    </div>
  );
};