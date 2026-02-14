import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Cloud, RefreshCw, Facebook, Mail, Save, FileSpreadsheet, FileText, Download, Sparkles, WifiOff, Info, CheckCircle2, AlertCircle, Calendar, MapPin, Home, Briefcase, Camera, Link as LinkIcon, Phone, Lock, LogIn, UserPlus, Upload, ShieldCheck, LayoutDashboard } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { UserProfile } from '../types';
import { useRealtimeStorage, SESSION_KEY } from '../hooks/useRealtimeStorage';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { auth, googleProvider, facebookProvider, isFirebaseConfigured } from '../services/firebaseConfig';
import * as firebaseAuth from "firebase/auth";

// Cast to any to avoid "has no exported member" errors
const { signInWithPopup, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword } = firebaseAuth as any;

const DEFAULT_PROFILE: UserProfile = {
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

const SIMULATED_DB_KEY = 'daily_task_users_db';

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

  // Update System State
  const APP_VERSION = "1.1.0";
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'available' | 'downloading'>('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);

  const [editForm, setEditForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
        setEditForm(profile);
    }
  }, [profile, isEditing]);

  // --- AUTHENTICATION LOGIC ---

  const handleEmailAuth = async () => {
    if (!emailInput || !passwordInput) {
        alert("Vui lòng nhập email và mật khẩu.");
        return;
    }
    
    setIsSyncing(true);

    try {
        let user: any = null;

        // 1. TRY REAL FIREBASE
        if (isFirebaseConfigured() && isOnline && auth) {
            if (authMode === 'register') {
                const credential = await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
                user = credential.user;
            } else {
                const credential = await signInWithEmailAndPassword(auth, emailInput, passwordInput);
                user = credential.user;
            }
        } else {
            // 2. FALLBACK TO SIMULATION (DEMO MODE)
            // Simulates a backend delay
            await new Promise(resolve => setTimeout(resolve, 800));
            
            const usersDb = JSON.parse(localStorage.getItem(SIMULATED_DB_KEY) || '{}');

            if (authMode === 'register') {
                if (usersDb[emailInput]) throw new Error("Email đã tồn tại (Demo).");
                const newUser = {
                    email: emailInput,
                    password: passwordInput,
                    uid: `sim_${Date.now()}`,
                    displayName: emailInput.split('@')[0],
                    photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${emailInput}`
                };
                usersDb[emailInput] = newUser;
                localStorage.setItem(SIMULATED_DB_KEY, JSON.stringify(usersDb));
                user = newUser;
            } else {
                const existingUser = usersDb[emailInput];
                if (!existingUser) throw new Error("Tài khoản không tồn tại (Demo).");
                if (existingUser.password !== passwordInput) throw new Error("Sai mật khẩu (Demo).");
                user = existingUser;
            }
        }

        if (user) {
            loginSuccess(user, 'email');
        }

    } catch (error: any) {
        console.error("Auth Error:", error);
        alert(`Lỗi: ${error.message}`);
        setIsSyncing(false);
    }
  };

  const loginSocial = async (providerName: 'google' | 'facebook') => {
    if (!isOnline) {
        alert("Cần có kết nối mạng để đăng nhập xã hội.");
        return;
    }
    setIsSyncing(true);

    try {
        // 1. TRY REAL FIREBASE
        if (isFirebaseConfigured() && auth) {
            const provider = providerName === 'google' ? googleProvider : facebookProvider;
            const result = await signInWithPopup(auth, provider!);
            loginSuccess(result.user, providerName);
        } else {
            // 2. SIMULATION (DEMO MODE)
            console.warn("Chạy chế độ Demo login (Chưa config Firebase)");
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const demoUser = {
                displayName: providerName === 'google' ? 'Google User' : 'Facebook User',
                email: providerName === 'google' ? 'demo_google@gmail.com' : 'demo_fb@facebook.com',
                uid: `sim_${providerName}_${Date.now()}`,
                photoURL: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`
            };
            loginSuccess(demoUser, providerName);
        }
    } catch (error: any) {
        console.error("Login Error:", error);
        alert(`Đăng nhập thất bại: ${error.message}`);
        setIsSyncing(false);
    }
  };

  const loginSuccess = (user: any, provider: string) => {
    // PRESERVE GUEST DATA
    const guestTasks = localStorage.getItem('guest_daily_tasks');
    const guestReflections = localStorage.getItem('guest_reflections');
    const guestChat = localStorage.getItem('guest_ai_chat_history');

    // 1. Set Session Key
    const userId = user.email || user.uid;
    localStorage.setItem(SESSION_KEY, userId);

    // 2. MIGRATE DATA IF NEW ACCOUNT EMPTY
    // We check if the target account data exists. If not, we copy the guest data over.
    // This ensures a seamless transition from Guest -> Registered User.
    if (guestTasks && !localStorage.getItem(`${userId}_daily_tasks`)) {
        localStorage.setItem(`${userId}_daily_tasks`, guestTasks);
    }
    if (guestReflections && !localStorage.getItem(`${userId}_reflections`)) {
        localStorage.setItem(`${userId}_reflections`, guestReflections);
    }
    if (guestChat && !localStorage.getItem(`${userId}_ai_chat_history`)) {
        localStorage.setItem(`${userId}_ai_chat_history`, guestChat);
    }
    
    // 3. Trigger Event for other hooks
    window.dispatchEvent(new Event('auth-change'));

    // 4. Update Profile State
    // Create new profile object
    const newProfile: UserProfile = {
        name: user.displayName || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${Date.now()}`,
        provider: provider as any,
        isLoggedIn: true,
        // Preserve existing profile data if we are logging back in, 
        // OR initialize default empty strings if it's a fresh account (managed by storage retrieval usually, but here we set explicit defaults for safety)
        birthYear: '',
        hometown: '',
        address: '',
        company: '',
        phoneNumber: ''
    };

    // If there is an existing profile in storage for this user, we might want to merge, 
    // but typically the Auth provider data is authoritative for identity fields.
    const existingProfileStr = localStorage.getItem(`${userId}_user_profile`);
    let finalProfile = newProfile;

    if (existingProfileStr) {
        try {
            const existing = JSON.parse(existingProfileStr);
            finalProfile = { ...existing, ...newProfile, birthYear: existing.birthYear, hometown: existing.hometown, address: existing.address, company: existing.company, phoneNumber: existing.phoneNumber };
        } catch (e) { /* ignore */ }
    }

    // Immediate Write
    localStorage.setItem(`${userId}_user_profile`, JSON.stringify(finalProfile));

    setTimeout(() => {
        setProfile(finalProfile);
        setEditForm(finalProfile);
        setIsSyncing(false);
        setEmailInput('');
        setPasswordInput('');
        // Ensure all components re-render with new data
        window.dispatchEvent(new Event('local-storage'));
    }, 50);
  };

  const logout = () => {
    setIsSyncing(true);
    if (isFirebaseConfigured() && auth) {
        signOut(auth).catch(console.error);
    }

    // Reset local profile state to default guest
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

  const handleSave = () => {
    setProfile(editForm);
    setIsEditing(false);
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
  };

  // --- UI RENDERERS ---

  const renderLoginScreen = () => (
    <div className="w-full max-w-md mx-auto space-y-6 animate-scale-in">
        <div className="text-center space-y-2 mb-8">
             <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <div className="relative w-full h-full bg-white rounded-full shadow-xl flex items-center justify-center border-4 border-indigo-50">
                    <User size={40} className="text-indigo-600" />
                </div>
             </div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
             </h2>
             <p className="text-slate-500 font-medium">
                {authMode === 'login' ? 'Sign in to access your workspace' : 'Join us to boost your productivity'}
             </p>
             {!isFirebaseConfigured() && (
                 <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase tracking-wider rounded-full">
                     Demo Mode Active
                 </span>
             )}
        </div>

        <div className="bg-white/70 backdrop-blur-xl p-8 rounded-[2rem] shadow-xl border border-white space-y-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
             
             <div className="space-y-4">
                 <div className="group relative">
                    <Mail size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                    <input 
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="Email Address"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-sm font-medium transition-all"
                    />
                 </div>
                 <div className="group relative">
                    <Lock size={18} className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                    <input 
                        type="password"
                        value={passwordInput}
                        onChange={(e) => setPasswordInput(e.target.value)}
                        placeholder="Password"
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 focus:outline-none text-sm font-medium transition-all"
                    />
                 </div>
             </div>

             <button 
                onClick={handleEmailAuth}
                disabled={isSyncing}
                className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2"
             >
                 {isSyncing ? <RefreshCw size={18} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={18}/> : <UserPlus size={18}/>)}
                 {authMode === 'login' ? t.login : t.register}
             </button>

             <div className="relative py-2">
                 <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                 <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400 font-bold">Or continue with</span></div>
             </div>

             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={() => loginSocial('google')}
                    className="flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all font-bold text-sm text-slate-700 shadow-sm"
                 >
                     <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="G" className="w-4 h-4"/>
                     Google
                 </button>
                 <button 
                    onClick={() => loginSocial('facebook')}
                    className="flex items-center justify-center gap-2 py-3 bg-[#1877F2] text-white rounded-xl hover:bg-[#166fe5] transition-all font-bold text-sm shadow-sm"
                 >
                     <Facebook size={16} fill="currentColor"/>
                     Facebook
                 </button>
             </div>

             <div className="text-center pt-2">
                 <button 
                    onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    className="text-xs text-indigo-600 font-bold hover:text-indigo-800 hover:underline transition-colors"
                 >
                    {authMode === 'login' ? "Don't have an account? Create one" : "Already have an account? Sign in"}
                 </button>
             </div>
        </div>
    </div>
  );

  const renderProfileScreen = () => (
    <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in pb-10">
        
        {/* Banner Card */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-white shadow-xl shadow-slate-200/50 border border-white group">
             {/* Cover Image Placeholder */}
             <div className="h-40 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
                 <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                 {!isFirebaseConfigured() && (
                    <div className="absolute top-4 right-4 bg-black/20 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-white/10">
                        <ShieldCheck size={12}/> Demo Mode
                    </div>
                 )}
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
                     <div className="relative -mt-16 shrink-0">
                         <div className="w-32 h-32 rounded-[2rem] p-1 bg-white shadow-lg rotate-3 group-hover:rotate-0 transition-transform duration-500">
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
                     <div className="pt-4 flex-1 w-full">
                         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                             <div>
                                 {isEditing ? (
                                     <input 
                                        name="name"
                                        value={editForm.name}
                                        onChange={handleInputChange}
                                        className="text-2xl font-black text-slate-800 bg-slate-50 border-b-2 border-indigo-500 focus:outline-none w-full md:w-auto"
                                     />
                                 ) : (
                                     <h2 className="text-3xl font-black text-slate-800 tracking-tight">{profile.name}</h2>
                                 )}
                                 <div className="flex items-center gap-2 text-slate-500 mt-1 font-medium text-sm">
                                     <Mail size={14}/> {profile.email}
                                     {profile.provider && (
                                         <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                             {profile.provider}
                                         </span>
                                     )}
                                 </div>
                             </div>
                             
                             <div className="flex gap-2 w-full md:w-auto">
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
                             <p className="text-[10px] text-slate-500 mt-2 font-mono">v{APP_VERSION} (Build 2024.1)</p>
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