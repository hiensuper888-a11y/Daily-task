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
             <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <div className="relative w-full h-full bg-white/80 backdrop-blur-md rounded-full shadow-xl flex items-center justify-center border-4 border-white">
                    <User size={32} className="text-indigo-600" />
                </div>
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">
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

        <div className="glass-modern p-6 md:p-8 rounded-[2rem] shadow-xl border border-white space-y-4 relative overflow-hidden">
             
             <div className="space-y-4">
                 <div className="group relative">
                    <Mail size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                    <input 
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Địa chỉ Email"
                        className="w-full pl-11 pr-4 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-sm font-medium transition-all"
                    />
                 </div>
                 <div className="group relative">
                    <Lock size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                    <input 
                        type={showPassword ? "text" : "password"}
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Mật khẩu"
                        className="w-full pl-11 pr-11 py-3 bg-white/50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-sm font-medium transition-all"
                    />
                    <button 
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-slate-400 hover:text-indigo-600 p-1 rounded-md transition-colors"
                    >
                        {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                 </div>
                 {authMode === 'register' && (
                     <div className="text-[10px] text-slate-500 px-1">
                         * Bạn sẽ cần xác nhận email sau khi đăng ký.
                     </div>
                 )}
             </div>

             <button 
                onClick={handleEmailAuth}
                disabled={isSyncing}
                className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
             >
                 {isSyncing ? <RefreshCw size={18} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={18}/> : <UserPlus size={18}/>)}
                 {authMode === 'login' ? t.login : t.register}
             </button>

             <div className="text-center pt-4 border-t border-slate-100 mt-2">
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
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-white group">
             {/* Cover Image */}
             <div className="h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                 <button 
                    onClick={logout}
                    className="absolute top-4 left-4 bg-white/20 hover:bg-white/30 backdrop-blur-md text-white p-2 rounded-xl transition-all"
                    title={t.logout}
                 >
                     <LogOut size={18} />
                 </button>
             </div>

             <div className="px-8 pb-8 relative">
                 <div className="flex flex-col md:flex-row gap-6 items-start">
                     {/* Avatar */}
                     <div className="relative -mt-16 shrink-0 text-center md:text-left">
                         <div className="w-32 h-32 rounded-[2rem] p-1 bg-white shadow-lg mx-auto md:mx-0">
                             <img 
                                src={editForm.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} 
                                className="w-full h-full rounded-[1.8rem] object-cover bg-slate-100"
                                alt="Profile"
                             />
                             <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                             {isEditing && (
                                 <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-[-10px] right-[-10px] bg-slate-900 text-white p-2.5 rounded-full shadow-lg hover:bg-slate-700 transition-colors border-4 border-white"
                                 >
                                     <Camera size={16} />
                                 </button>
                             )}
                         </div>
                     </div>

                     {/* Main Info */}
                     <div className="pt-4 flex-1 w-full text-center md:text-left">
                         <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                             <div>
                                 {isEditing ? (
                                     <input 
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleInputChange}
                                        className="text-2xl font-black text-slate-800 bg-slate-50 border-b-2 border-indigo-500 focus:outline-none w-full md:w-auto text-center md:text-left"
                                     />
                                 ) : (
                                     <h2 className="text-3xl font-black text-slate-800 tracking-tight">{profile.name}</h2>
                                 )}
                                 
                                 <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
                                     <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs bg-slate-100 px-2 py-1 rounded-lg">
                                         <Mail size={12}/> {profile.email}
                                     </div>
                                     {profile.uid && (
                                         <div className="flex items-center gap-1.5 text-indigo-500 font-bold text-xs bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-100" title="User ID">
                                             <Fingerprint size={12}/> ID: {profile.uid.slice(0, 8)}...
                                         </div>
                                     )}
                                 </div>
                             </div>
                             
                             <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                 {isEditing ? (
                                     <button onClick={handleSave} className="flex-1 md:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2">
                                         <Save size={16}/> {t.saveProfile}
                                     </button>
                                 ) : (
                                     <button onClick={() => setIsEditing(true)} className="flex-1 md:flex-none px-6 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold shadow-sm transition-all flex items-center justify-center gap-2">
                                         <LayoutDashboard size={16}/> {t.editProfile}
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
             <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-8 shadow-sm border border-white space-y-6">
                 <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                     <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center"><User size={18}/></span>
                     Personal Info
                 </h3>
                 <div className="space-y-5">
                    {[
                        { label: t.birthYear, key: 'birthYear', icon: Calendar },
                        { label: t.phoneNumber, key: 'phoneNumber', icon: Phone },
                        { label: t.address, key: 'address', icon: Home },
                    ].map((item) => (
                        <div key={item.key} className="group">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                {item.label}
                            </label>
                            {isEditing ? (
                                <input 
                                    name={item.key}
                                    value={(editForm[item.key as keyof UserProfile] as string) || ''}
                                    onChange={handleInputChange}
                                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                                />
                            ) : (
                                <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 h-9">
                                    <item.icon size={16} className="text-slate-300"/>
                                    {(profile[item.key as keyof UserProfile] as string) || <span className="text-slate-300 text-xs italic">Not set</span>}
                                </div>
                            )}
                        </div>
                    ))}
                 </div>
             </div>

             <div className="space-y-6">
                 {/* Work Info */}
                 <div className="bg-white/70 backdrop-blur-xl rounded-[2rem] p-8 shadow-sm border border-white space-y-6">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Briefcase size={18}/></span>
                        Work Info
                    </h3>
                    <div className="space-y-5">
                        {[
                            { label: t.company, key: 'company', icon: Briefcase },
                            { label: t.hometown, key: 'hometown', icon: MapPin },
                        ].map((item) => (
                            <div key={item.key} className="group">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                                    {item.label}
                                </label>
                                {isEditing ? (
                                    <input 
                                        name={item.key}
                                        value={(editForm[item.key as keyof UserProfile] as string) || ''}
                                        onChange={handleInputChange}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-100 outline-none"
                                    />
                                ) : (
                                    <div className="text-sm font-semibold text-slate-700 flex items-center gap-2 h-9">
                                        <item.icon size={16} className="text-slate-300"/>
                                        {(profile[item.key as keyof UserProfile] as string) || <span className="text-slate-300 text-xs italic">Not set</span>}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                 </div>

                 {/* System Info */}
                 <div className="bg-slate-800 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-[50px] opacity-20"></div>
                     <div className="relative z-10 flex items-center justify-between">
                         <div>
                             <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">System Status</p>
                             <div className="flex items-center gap-2">
                                 <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-red-400'}`}></div>
                                 <span className="font-bold text-sm">{isOnline ? 'System Online' : 'Offline Mode'}</span>
                             </div>
                             <p className="text-[10px] text-slate-500 mt-2 font-mono">v{APP_VERSION} (Build 2024.2)</p>
                         </div>
                         <button className="bg-white/10 hover:bg-white/20 p-2 rounded-xl transition-colors">
                             <RefreshCw size={20} className="text-slate-300" />
                         </button>
                     </div>
                 </div>
             </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white shrink-0 shadow-lg z-0">
        <div className="absolute right-0 bottom-0 opacity-10 p-4"><Cloud size={140} /></div>
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
        
        <h1 className="text-2xl font-bold flex items-center gap-3 relative z-10">
          <Cloud size={28} className="text-indigo-200" />
          {t.loginHeader}
        </h1>
        <p className="text-indigo-100 text-sm mt-2 font-medium opacity-90 relative z-10 max-w-md">
          {t.loginSubHeader}
        </p>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-start overflow-y-auto custom-scrollbar pb-24 relative z-10 -mt-6">
        {profile.isLoggedIn ? renderProfileScreen() : renderLoginScreen()}
      </div>
    </div>
  );
};
