import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SchoolProfile {
  id: string;
  name: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  vercelUrl: string;
  gasUrl?: string;
}

let currentClient: SupabaseClient | null = null;

export function getActiveSchoolProfile(): SchoolProfile | null {
  try {
    const profilesJson = localStorage.getItem('school_profiles');
    const activeId = localStorage.getItem('active_school_id');
    if (profilesJson && activeId) {
      const profiles = JSON.parse(profilesJson);
      return profiles.find((p: SchoolProfile) => p.id === activeId) || null;
    }
  } catch (e) {
    console.error('Error reading active profile:', e);
  }
  return null;
}

export function getSchoolProfiles(): SchoolProfile[] {
  try {
    const profilesJson = localStorage.getItem('school_profiles');
    return profilesJson ? JSON.parse(profilesJson) : [];
  } catch (e) {
    console.error('Error reading profiles:', e);
    return [];
  }
}

export function initSupabase() {
  const profile = getActiveSchoolProfile();
  const url = profile?.supabaseUrl || import.meta.env.VITE_SUPABASE_URL || '';
  const key = profile?.supabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  
  if (url && key) {
    currentClient = createClient(url, key);
  } else {
    currentClient = createClient(
      url || 'https://placeholder-url.supabase.co', 
      key || 'placeholder-key'
    );
  }
}

// Initialize on load
initSupabase();

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop, receiver) {
    if (!currentClient) {
      initSupabase();
    }
    return Reflect.get(currentClient!, prop, receiver);
  }
});
