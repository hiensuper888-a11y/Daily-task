
import { createClient } from '@supabase/supabase-js';

// User provided credentials
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://gckgfkonfdydliqgnldd.supabase.co';
// Use a valid-looking JWT format for the fallback key to prevent crashes during initialization
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdja2dma29uZmR5ZGxpcWdubGRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.dummy_signature_to_prevent_crashes';

let client;
try {
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
  console.error("Failed to initialize Supabase client:", error);
  // Fallback mock client to prevent app crash
  client = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithOAuth: async () => ({ data: null, error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }) }) }),
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
