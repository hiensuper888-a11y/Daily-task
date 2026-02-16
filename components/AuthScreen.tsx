import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, LogIn, UserPlus, RefreshCw, Sparkles } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { 
  auth, 
  isFirebaseConfigured,
  signOut, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendEmailVerification 
} from '../services/firebaseConfig';
import { SESSION_KEY } from '../hooks/useRealtimeStorage';
import { UserProfile } from '../types';

export const AuthScreen: React.FC = () => {
  const { t } = useLanguage();
  const isOnline = useOnlineStatus();
  
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const loginSuccess = (user: any, provider: string) => {
    const userId = user.uid;
    // Set session key specifically for App.tsx to detect
    localStorage.setItem(SESSION_KEY, userId);
    
    // Create or update profile
    const newProfile: UserProfile = { 
        uid: user.uid, 
        name: user.displayName || user.email?.split('@')[0] || 'User', 
        email: user.email || '', 
        avatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`, 
        provider: provider as any, 
        isLoggedIn: true, 
        birthYear: '', hometown: '', address: '', company: '', phoneNumber: '', jobTitle: '', department: '' 
    };

    const storageKey = `${userId}_user_profile`;
    const existingProfileStr = localStorage.getItem(storageKey);
    let finalProfile = newProfile;
    
    if (existingProfileStr) { 
        try { 
            finalProfile = { ...JSON.parse(existingProfileStr), ...newProfile, uid: user.uid, isLoggedIn: true }; 
        } catch (e) {} 
    }
    
    // Save specific user profile
    localStorage.setItem(storageKey, JSON.stringify(finalProfile));
    
    // Also update the global 'user_profile' key which the app might be listening to initially
    localStorage.setItem('user_profile', JSON.stringify(finalProfile));

    // Dispatch events to trigger re-renders in App.tsx and hooks
    window.dispatchEvent(new Event('auth-change'));
    window.dispatchEvent(new Event('local-storage'));
    window.dispatchEvent(new Event('storage'));
  };

  const handleEmailAuth = async () => {
    if (!isFirebaseConfigured()) { alert(t.firebaseError); return; }
    if (!isOnline) { alert(t.networkError); return; }
    if (!emailInput || !passwordInput) { alert(t.fillAllFields); return; }
    
    setIsSyncing(true);
    const cleanEmail = emailInput.trim().toLowerCase();
    try {
        if (authMode === 'register') {
            const credential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordInput);
            await sendEmailVerification(credential.user);
            await signOut(auth);
            alert(t.registerSuccess);
            setAuthMode('login');
        } else {
            const credential = await signInWithEmailAndPassword(auth, cleanEmail, passwordInput);
            // In a real app, strict check: if (!credential.user.emailVerified) ...
            loginSuccess(credential.user, 'email');
        }
    } catch (error: any) { 
        alert(`${t.errorPrefix}${error.message}`); 
    } finally { 
        setIsSyncing(false); 
    }
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-4 relative z-50">
        <div className="glass-modal rounded-[2.5rem] w-full max-w-sm p-8 shadow-premium animate-scale-in relative border border-white/60 overflow-hidden">
             {/* Decorative Background Elements */}
             <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-bl-[120px] -z-10 opacity-60"></div>
             
             <div className="relative z-10">
                <div className="text-center mb-10">
                     <div className="w-20 h-20 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-indigo-500/30 transform hover:scale-110 transition-transform duration-500">
                         <Sparkles className="text-white" size={32} />
                     </div>
                     <h2 className="text-3xl font-black text-slate-800 tracking-tight">{authMode === 'login' ? t.welcomeBack : t.createAccount}</h2>
                     <p className="text-slate-500 text-sm mt-1 font-medium">{authMode === 'login' ? t.loginContinue : t.startJourney}</p>
                </div>

                <div className="space-y-5">
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">{t.emailLabel}</label>
                        <div className="relative group/input">
                            <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors"/>
                            <input 
                                type="email"
                                value={emailInput}
                                onChange={(e) => setEmailInput(e.target.value)}
                                className="w-full pl-11 pr-4 py-3.5 bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                placeholder="name@example.com"
                            />
                        </div>
                     </div>
                     <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 ml-1 uppercase tracking-wider">{t.passwordLabel}</label>
                        <div className="relative group/input">
                            <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/input:text-indigo-500 transition-colors"/>
                            <input 
                                type={showPassword ? "text" : "password"}
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                className="w-full pl-11 pr-11 py-3.5 bg-slate-50/50 border-2 border-slate-100 focus:border-indigo-500 focus:bg-white rounded-2xl text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 shadow-inner"
                                placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors">
                                {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                            </button>
                        </div>
                     </div>
                </div>

                <button 
                    onClick={handleEmailAuth}
                    disabled={isSyncing}
                    className="w-full mt-8 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-300 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 hover:bg-indigo-700"
                >
                    {isSyncing ? <RefreshCw size={20} className="animate-spin"/> : (authMode === 'login' ? <LogIn size={20}/> : <UserPlus size={20}/>)}
                    {authMode === 'login' ? t.loginBtn : t.registerBtn}
                </button>

                <div className="mt-8 text-center">
                    <button 
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                        className="text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        {authMode === 'login' ? t.noAccountPrompt : t.hasAccountPrompt}
                    </button>
                </div>
             </div>
        </div>
    </div>
  );
};