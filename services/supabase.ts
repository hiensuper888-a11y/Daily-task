import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SYazz5g2WvcToaILp1DSDQ_x_EtLxzY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('_test').select('*').limit(1);
    console.log('Supabase connection test:', { data, error });
    return !error;
  } catch (err) {
    console.error('Supabase connection error:', err);
    return false;
  }
};
