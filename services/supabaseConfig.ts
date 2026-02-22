import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gckgfkonfdydliqgnldd.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SYazz5g2WvcToaILp1DSDQ_x_EtLxzY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
