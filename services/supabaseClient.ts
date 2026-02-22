
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gckgfkonfdydliqgnldd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SYazz5g2WvcToaILp1DSDQ_x_EtLxzY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
