
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gckgfkonfdydliqgnldd.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_SYazz5g2WvcToaILp1DSDQ_x_EtLxzY';

// Check if the key is the placeholder or invalid
if (SUPABASE_ANON_KEY.startsWith('sb_publishable_')) {
    console.warn("CẢNH BÁO: Đang sử dụng API Key mặc định không hợp lệ. Vui lòng cấu hình VITE_SUPABASE_ANON_KEY trong file .env hoặc trên Vercel.");
}

let client;

try {
    // Polyfill WebSocket if missing to prevent Supabase Realtime crash on some mobile browsers
    if (typeof WebSocket === 'undefined') {
        console.warn("WebSocket is not available. Polyfilling with dummy implementation to support REST-only mode.");
        (globalThis as any).WebSocket = class DummyWebSocket {
            onopen: any;
            onmessage: any;
            onerror: any;
            onclose: any;
            binaryType: any;
            bufferedAmount = 0;
            extensions = '';
            protocol = '';
            readyState = 3; // CLOSED
            url = '';
            CONNECTING = 0;
            OPEN = 1;
            CLOSING = 2;
            CLOSED = 3;
            
            constructor() { 
                console.warn('Supabase Realtime is disabled because WebSocket is not supported.'); 
                setTimeout(() => {
                    if (this.onerror) this.onerror(new Event('error'));
                    if (this.onclose) this.onclose(new CloseEvent('close'));
                }, 0);
            }
            close() {}
            send() {}
            addEventListener() {}
            removeEventListener() {}
            dispatchEvent() { return true; }
        };
    }

    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
        },
        realtime: {
            params: {
                eventsPerSecond: 10,
            },
        },
    });
} catch (error) {
    console.error("Failed to initialize Supabase client:", error);
    // Fallback mock client to prevent app crash
    client = {
        auth: {
            getSession: async () => ({ data: { session: null }, error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
            signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not initialized') }),
            signOut: async () => ({ error: null }),
        },
        from: () => ({
            select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
            upsert: async () => ({ data: null, error: null }),
            delete: () => ({ eq: async () => ({ data: null, error: null }) }),
            insert: async () => ({ data: null, error: null }),
            update: () => ({ eq: async () => ({ data: null, error: null }) }),
            on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
        }),
        channel: () => ({
            on: () => ({ subscribe: () => {} }),
            unsubscribe: async () => {},
        }),
        removeChannel: async () => {},
    } as any;
}

export const supabase = client;
