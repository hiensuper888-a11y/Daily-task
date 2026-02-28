
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gckgfkonfdydliqgnldd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SYazz5g2WvcToaILp1DSDQ_x_EtLxzY';

// Check if the key is the placeholder or invalid
if (SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
    console.warn("CẢNH BÁO: Đang sử dụng API Key mặc định không hợp lệ. Vui lòng cấu hình VITE_SUPABASE_ANON_KEY trong file .env hoặc trên Vercel.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
