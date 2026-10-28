import { createClient } from '@supabase/supabase-js';
import { CargoLoad } from '../types';

export const isSupabaseConfigured = (): boolean => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return !!url && !!key && url.startsWith('http') && !url.includes('placeholder.supabase.co');
};

const createSafeSupabaseClient = () => {
  try {
    const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (url && key && url.startsWith('http')) {
      return createClient(url, key);
    }
    // Safe placeholder client with valid JWT format to prevent crash on module import
    return createClient(
      'https://placeholder.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3NDM3MzEsImV4cCI6MjA4NjMxOTczMX0.placeholder'
    );
  } catch (err) {
    console.warn('Supabase client failed to initialize safely:', err);
    return null as any;
  }
};

export const supabase = createSafeSupabaseClient();

/**
 * Supabase CRUD Services for Cargo Loads (Cargas)
 * Replaces Firestore setDoc / getDocs / deleteDoc
 */

// 1. SELECT / GET ALL LOADS
export async function getSupabaseLoads(): Promise<{ data: CargoLoad[] | null; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('loads')
      .select('*')
      .order('createdAt', { ascending: false });

    if (error) {
      console.warn('Supabase select error in loads:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as CargoLoad[]) || [], error: null };
  } catch (err: any) {
    console.warn('Falha na consulta de cargas no Supabase:', err);
    return { data: null, error: err };
  }
}

// 2. UPSERT / CREATE / UPDATE SINGLE LOAD (Replaces Firestore setDoc)
export async function upsertSupabaseLoad(load: CargoLoad): Promise<{ data: any; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('loads')
      .upsert(load, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('Supabase upsert error in loads:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: any) {
    console.warn('Falha ao salvar carga no Supabase:', err);
    return { data: null, error: err };
  }
}

// 3. UPSERT BATCH OF LOADS (Replaces Firestore batch setDoc)
export async function upsertSupabaseLoads(loads: CargoLoad[]): Promise<{ data: any; error: Error | null }> {
  if (!isSupabaseConfigured() || loads.length === 0) {
    return { data: null, error: null };
  }

  try {
    const { data, error } = await supabase
      .from('loads')
      .upsert(loads, { onConflict: 'id' })
      .select();

    if (error) {
      console.warn('Supabase batch upsert error in loads:', error.message);
      return { data: null, error: new Error(error.message) };
    }

    return { data, error: null };
  } catch (err: any) {
    console.warn('Falha no lote de cargas no Supabase:', err);
    return { data: null, error: err };
  }
}

// 4. DELETE LOAD (Replaces Firestore deleteDoc)
export async function deleteSupabaseLoad(loadId: string): Promise<{ success: boolean; error: Error | null }> {
  if (!isSupabaseConfigured()) {
    return { success: true, error: null };
  }

  try {
    const { error } = await supabase
      .from('loads')
      .delete()
      .eq('id', loadId);

    if (error) {
      console.warn('Supabase delete error in loads:', error.message);
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.warn('Falha ao deletar carga no Supabase:', err);
    return { success: false, error: err };
  }
}

// 5. REALTIME SUBSCRIPTION FOR LOADS (Replaces Firestore onSnapshot)
export function subscribeSupabaseLoads(onLoadsChanged: (loads: CargoLoad[]) => void): () => void {
  if (!isSupabaseConfigured()) {
    return () => {};
  }

  const channel = supabase
    .channel('loads-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loads' },
      async () => {
        const { data } = await getSupabaseLoads();
        if (data) {
          onLoadsChanged(data);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
