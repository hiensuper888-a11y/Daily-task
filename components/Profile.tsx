import React, { useState, useEffect, useRef } from 'react';
import { User, LogOut, Cloud, RefreshCw, Mail, Save, AlertCircle, Calendar, MapPin, Home, Briefcase, Camera, Phone, Lock, LogIn, UserPlus, Eye, EyeOff, Fingerprint, LayoutDashboard, Sparkles, ShieldCheck } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);

  // Update System State
  const APP_VERSION = "2.0.0";
  const [editForm, setEditForm] = useState(profile);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditing) {
        setEditForm(profile);
    }
  }, [profile, isEditing]);

  // ... (Auth Logic Remains Same - Omitted for brevity, assume existing logic) ...
  const handleEmailAuth = async () => {
    if (!isFirebaseConfigured()) { alert("Lỗi cấu hình Firebase"); return; }
    if (!isOnline) { alert("Vui lòng kết nối mạng."); return; }
    if (!emailInput || !passwordInput) { alert("Nhập đủ thông tin."); return; }
    setIsSyncing(true);
    const cleanEmail = emailInput.trim().toLowerCase();
    try {
        if (authMode === 'register') {
            const credential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordInput);
            await sendEmailVerification(credential.user);
            await signOut(auth);
            alert(`Đăng ký thành công! Vui lòng kiểm tra email ${cleanEmail}.`);
            setAuthMode('login');
        } else {
            const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
            if (!credential.user.emailVerified) {
                await signOut(auth);
                alert("Tài khoản chưa kích hoạt."); setIsSyncing(false); return;
            }
            loginSuccess(credential.user, 'email');
        }
    } catch (error: any) { alert(`Lỗi: ${error.message}`); setIsSyncing(false); } finally { if (authMode === 'register') setIsSyncing(false); }
  };

  const loginSuccess = (user: any, provider: string) => {
    const userId = user.uid;
    localStorage.setItem(SESSION_KEY, userId);
    window.dispatchEvent(new Event('auth-change'));
    const newProfile: UserProfile = { uid: user.uid, name: user.displayName || user.email?.split('@')[0] || 'User', email: user.email || '', avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`, provider: provider as any, isLoggedIn: true, birthYear: '', hometown: '', address: '', company: '', phoneNumber: '' };
    const existingProfileStr = localStorage.getItem(`${userId}_user_profile`);
    let finalProfile = newProfile;
    if (existingProfileStr) { try { finalProfile = { ...JSON.parse(existingProfileStr), ...newProfile, uid: user.uid }; } catch (e) {} }
    localStorage.setItem(`${userId}_user_profile`, JSON.stringify(finalProfile));
    setTimeout(() => { setProfile(finalProfile); setEditForm(finalProfile); setIsSyncing(false); setEmailInput(''); setPasswordInput(''); window.dispatchEvent(new Event('local-storage')); }, 50);
  };

  const logout = () => { setIsSyncing(true); if (isFirebaseConfigured() && auth) signOut(auth).catch(console.error); setProfile(DEFAULT_PROFILE); setTimeout(() => { localStorage.removeItem(SESSION_KEY); window.dispatchEvent(new Event('auth-change')); setIsEditing(false); setIsSyncing(false); setAuthMode('login'); }, 500); };
  const handleSave = async () => { setProfile(editForm); setIsEditing(false); try { if (isFirebaseConfigured() && auth && auth.currentUser) await updateProfile(auth.currentUser, { displayName: editForm.name, photoURL: editForm.avatar }); } catch (error) {} };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => { const { name, value } = e.target; setEditForm(prev => ({ ...prev, [name]: value })); };
  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onloadend = () => { setEditForm(prev => ({ ...prev, avatar: reader.result as string })); }; reader.readAsDataURL(file); } e.target.value = ''; };

  // --- NEW UI DESIGN ---

  const renderLoginScreen = () => (
    <div className="w-full max-w-sm mx-auto animate-scale-in pt-10 px-4">
        <div className="glass-modern bg-white/90 rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 relative overflow-hidden">
             {/* Decorative Background Elements */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-[100px] -z-0"></div>
             <div className="absolute bottom-0 left-0 w-24 h-24 bg-pink-50 rounded-tr-[80px] -z-0"></div>

             <div className="relative z-10">
                <div className="text-center mb-8">
                     <div className="w-20 h-20 bg-indigo-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-200">
                         <Sparkles className="text-white" size={32} />
                     </div>
                     <h2 className="text-2xl font-black text-slate-800 tracking-tight">{authMode === 'login' ? t.welcomeBack : t.createAccount}</h2>
                     <p className="text-slate-400 text-sm mt-1 font-medium">{authMode === 'login' ? t.loginContinue : t.startJourney}</p>
                </div>

                <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">{t.emailLabel}</label>
                        <div className="relative">
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input 
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                placeholder="name@example.com"
                            />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 ml-1">{t.passwordLabel}</label>
                        <div className="relative">
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full pl-11 pr-11 py-3.5 bg-slate-50 border-2 border-transparent focus:border-indigo-100 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300"
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500">
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                     </div>
                </div>

                <button 
                    onClick={handleEmailAuth}
                    disabled={isSyncing}
                    className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    {isSyncing ? <RefreshCw size={20} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                    {authMode === 'login' ? t.loginBtn : t.registerBtn}
                </button>

                <div className="mt-6 text-center">
                    <button 
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                        className="text-xs font-bold text-slate-500 hover:text-indigo-600 transition-colors"
                    >
                        {authMode === 'login' ? t.noAccountPrompt : t.hasAccountPrompt}
                    </button>
                </div>
             </div>
        </div>
    </div>
  );

  const renderProfileScreen = () => (
    <div className="w-full max-w-5xl mx-auto animate-fade-in pb-10">
        {/* Header Card */}
        <div className="bg-white rounded-[2.5rem] p-6 md:p-10 shadow-xl shadow-slate-200/50 mb-6 flex flex-col md:flex-row items-center gap-8 border border-slate-100 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-32 bg-gradient-to-br from-indigo-50 to-pink-50 rounded-full blur-3xl -z-0 opacity-60"></div>
             
             <div className="relative group">
                 <div className="w-32 h-32 rounded-[2rem] p-1 bg-white shadow-lg relative z-10">
                     <img src={editForm.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=default"} className="w-full h-full rounded-[1.8rem] object-cover bg-slate-100" alt="Avatar"/>
                     {isEditing && (
                        <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-indigo-600 text-white p-2.5 rounded-xl shadow-md hover:scale-110 transition-transform">
                            <Camera size={16}/>
                        </button>
                     )}
                     <input type="file" ref={fileInputRef} onChange={handleAvatarUpload} className="hidden" accept="image/*" />
                 </div>
             </div>

             <div className="flex-1 text-center md:text-left relative z-10">
                 {isEditing ? (
                     <input name="name" value={editForm.name} onChange={handleInputChange} className="text-3xl font-black text-slate-800 bg-slate-50 border-b-2 border-indigo-500 outline-none w-full md:w-auto text-center md:text-left rounded-lg px-2"/>
                 ) : (
                     <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-1">{profile.name}</h2>
                 )}
                 <p className="text-slate-400 font-medium flex items-center justify-center md:justify-start gap-1.5 text-sm mb-4">
                     <Mail size={14}/> {profile.email}
                 </p>
                 
                 <div className="flex gap-3 justify-center md:justify-start">
                     {isEditing ? (
                         <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm shadow-md hover:bg-indigo-700 transition-colors flex items-center gap-2"><Save size={16}/> {t.save}</button>
                     ) : (
                         <button onClick={() => setIsEditing(true)} className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors flex items-center gap-2"><LayoutDashboard size={16}/> {t.edit}</button>
                     )}
                     <button onClick={logout} className="px-4 py-2.5 bg-red-50 text-red-500 rounded-xl font-bold text-sm hover:bg-red-100 transition-colors"><LogOut size={16}/></button>
                 </div>
             </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InfoCard title={t.personalInfo} icon={User} color="orange">
                <InfoRow icon={Calendar} label={t.birthYear} name="birthYear" value={editForm.birthYear} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Phone} label={t.phoneNumber} name="phoneNumber" value={editForm.phoneNumber} isEditing={isEditing} onChange={handleInputChange} />
                <InfoRow icon={Home} label={t.address} name="address" value={editForm.address} isEditing={isEditing} onChange={handleInputChange} />
            </InfoCard>

            <InfoCard title={t.work} icon={Briefcase} color="blue">
                 <InfoRow icon={Briefcase} label={t.company} name="company" value={editForm.company} isEditing={isEditing} onChange={handleInputChange} />
                 <InfoRow icon={MapPin} label={t.hometown} name="hometown" value={editForm.hometown} isEditing={isEditing} onChange={handleInputChange} />
                 <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                     <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t.statusLabel}</span>
                     <span className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                         <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                         {isOnline ? 'Online' : 'Offline'}
                     </span>
                 </div>
            </InfoCard>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50/50 overflow-y-auto custom-scrollbar p-6">
       {profile.isLoggedIn ? renderProfileScreen() : renderLoginScreen()}
    </div>
  );
};

// Helper Components for Cleaner Code
const InfoCard = ({ title, icon: Icon, color, children }: any) => {
    const colorClasses = {
        orange: 'bg-orange-50 text-orange-600',
        blue: 'bg-blue-50 text-blue-600'
    };
    return (
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-100 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${colorClasses[color as keyof typeof colorClasses]}`}>
                    <Icon size={20} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
            </div>
            <div className="space-y-5">{children}</div>
        </div>
    );
};

const InfoRow = ({ icon: Icon, label, name, value, isEditing, onChange }: any) => {
    const { t } = useLanguage();
    return (
        <div className="group">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">{label}</label>
            {isEditing ? (
                <input name={name} value={value} onChange={onChange} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-200 outline-none transition-all"/>
            ) : (
                <div className="text-sm font-bold text-slate-700 flex items-center gap-3 h-10 border-b border-slate-50">
                    <Icon size={16} className="text-slate-300"/>
                    {value || <span className="text-slate-300 italic font-normal text-xs">{t.notUpdated}</span>}
                </div>
            )}
        </div>
    );
};