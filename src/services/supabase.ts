import { createClient } from '@supabase/supabase-js';
import { CargoLoad } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = (): boolean => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return !!url && !!key && url !== 'https://placeholder.supabase.co';
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
