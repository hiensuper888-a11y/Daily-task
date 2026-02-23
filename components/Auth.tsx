import React from 'react';
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../services/supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

const Auth = () => {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Daily Task</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{t.loginWelcome}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-lg border border-slate-200 dark:border-slate-700">
          <SupabaseAuth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              style: {
                button: { background: 'var(--indigo-600)', borderColor: 'var(--indigo-700)', color: 'white' },
                anchor: { color: 'var(--indigo-500)' },
              }
            }}
            providers={['google']}
            localization={{
              variables: {
                sign_in: {
                  email_label: t.emailLabel,
                  password_label: t.passwordLabel,
                  button_label: t.signIn,
                  social_provider_text: t.signInWith,
                },
                sign_up: {
                  email_label: t.emailLabel,
                  password_label: t.passwordLabel,
                  button_label: t.signUp,
                  social_provider_text: t.signUpWith,
                },
                forgotten_password: {
                  email_label: t.emailLabel,
                  button_label: t.sendResetInstructions,
                  link_text: t.forgotPassword,
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default Auth;
