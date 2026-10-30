import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CargoLoad, User, EventLog } from '../types';

export const isSupabaseConfigured = (): boolean => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return !!url && !!key && url.startsWith('http') && !url.includes('placeholder.supabase.co');
};

const createSafeSupabaseClient = (): SupabaseClient => {
  try {
    const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    if (url && key && url.startsWith('http')) {
      return createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
      });
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
 * Validates that Supabase credentials are configured.
 * Throws explicit descriptive error if not configured so callers can present it.
 */
export function requireSupabaseClient(): SupabaseClient {
  if (!isSupabaseConfigured() || !supabase) {
    throw new Error(
      'Banco de dados Supabase não está configurado. Por favor, adicione as variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env para que os dados sejam gravados na nuvem.'
    );
  }
  return supabase;
}

/**
 * Sanitizes object by removing `undefined` and converting them to `null` or valid JSON types
 * to avoid Postgres/Supabase syntax or unsupported value errors.
 */
export function sanitizeForSupabase<T = any>(obj: T): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return (obj as any[])
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForSupabase(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj as Record<string, any>)) {
    if (val === undefined) {
      cleaned[key] = null;
    } else {
      cleaned[key] = sanitizeForSupabase(val);
    }
  }
  return cleaned;
}

/**
 * Formats Supabase errors into human-readable Portuguese messages.
 */
export function formatSupabaseError(error: any, operationName: string): Error {
  const code = error?.code || '';
  const message = error?.message || 'Erro de comunicação com o Supabase.';
  const details = error?.details || '';
  const hint = error?.hint || '';

  let userFriendly = `[Supabase] Erro ao ${operationName}: ${message}`;
  if (code === '42P01') {
    userFriendly = `[Supabase] Tabela necessária não encontrada no banco. Crie a tabela no seu projeto Supabase (${message}).`;
  } else if (code === '42501') {
    userFriendly = `[Supabase] Permissão negada pelas regras de RLS (Row Level Security). Revise as permissões da tabela no painel do Supabase.`;
  } else if (code === '23505') {
    userFriendly = `[Supabase] Registro com identificador duplicado no banco: ${details || message}`;
  } else if (code === 'PGRST116') {
    userFriendly = `[Supabase] Nenhum registro retornado para a operação solicitada.`;
  }

  if (details) userFriendly += ` Detalhes: ${details}.`;
  if (hint) userFriendly += ` Sugestão: ${hint}.`;

  console.error(`Falha no Supabase [${operationName}]:`, error);
  return new Error(userFriendly);
}

/* =========================================================================================
 * 1. CARGO LOADS (CARGAS) - SUPABASE CRUD & REALTIME
 * ========================================================================================= */

export async function getSupabaseLoads(): Promise<CargoLoad[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('loads')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) {
    throw formatSupabaseError(error, 'consultar cargas');
  }

  return (data as CargoLoad[]) || [];
}

export async function upsertSupabaseLoad(load: CargoLoad): Promise<CargoLoad> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase({
    ...load,
    driverPhone: typeof load.driverPhone === 'string' ? load.driverPhone : (load.driverPhone ?? ''),
    origin: load.origin || '',
    destination: load.destination || '',
    plate: load.plate || '',
    driverName: load.driverName || '',
    sealNumber: load.sealNumber || '',
  });

  const { data, error } = await client
    .from('loads')
    .upsert(sanitized, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw formatSupabaseError(error, `salvar carga (Placa: ${load.plate || load.id})`);
  }

  return (data as CargoLoad) || sanitized;
}

export async function upsertSupabaseLoads(loads: CargoLoad[]): Promise<CargoLoad[]> {
  const client = requireSupabaseClient();
  if (!loads || loads.length === 0) return [];

  const sanitized = loads.map(load => sanitizeForSupabase({
    ...load,
    driverPhone: typeof load.driverPhone === 'string' ? load.driverPhone : (load.driverPhone ?? ''),
    origin: load.origin || '',
    destination: load.destination || '',
    plate: load.plate || '',
    driverName: load.driverName || '',
    sealNumber: load.sealNumber || '',
  }));

  const { data, error } = await client
    .from('loads')
    .upsert(sanitized, { onConflict: 'id' })
    .select();

  if (error) {
    throw formatSupabaseError(error, 'salvar lote de cargas');
  }

  return (data as CargoLoad[]) || sanitized;
}

export async function deleteSupabaseLoad(loadId: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('loads')
    .delete()
    .eq('id', loadId);

  if (error) {
    throw formatSupabaseError(error, `excluir carga (${loadId})`);
  }
}

export function subscribeSupabaseLoads(onLoadsChanged: (loads: CargoLoad[]) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('loads-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'loads' },
      async () => {
        try {
          const loads = await getSupabaseLoads();
          onLoadsChanged(loads);
        } catch (err) {
          console.warn('Erro ao sincronizar atualização de cargas em tempo real do Supabase:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================================================================================
 * 2. USERS (USUÁRIOS E AUTORIZAÇÃO) - SUPABASE CRUD & REALTIME
 * ========================================================================================= */

export async function getSupabaseUsers(): Promise<User[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('users')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) {
    throw formatSupabaseError(error, 'consultar lista de usuários');
  }

  return (data as User[]) || [];
}

export async function upsertSupabaseUser(user: User): Promise<User> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase({
    ...user,
    username: user.username?.trim(),
    fullName: user.fullName || user.username,
    status: user.status || 'pending',
    createdAt: user.createdAt || new Date().toISOString()
  });

  const { data, error } = await client
    .from('users')
    .upsert(sanitized, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw formatSupabaseError(error, `salvar usuário (${user.username})`);
  }

  return (data as User) || sanitized;
}

export async function updateSupabaseUser(userId: string, partial: Partial<User>): Promise<void> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase(partial);

  const { error } = await client
    .from('users')
    .update(sanitized)
    .eq('id', userId);

  if (error) {
    throw formatSupabaseError(error, `atualizar permissões do usuário (${userId})`);
  }
}

export async function deleteSupabaseUser(userId: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('users')
    .delete()
    .eq('id', userId);

  if (error) {
    throw formatSupabaseError(error, `excluir usuário (${userId})`);
  }
}

export function subscribeSupabaseUsers(onUsersChanged: (users: User[]) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('users-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users' },
      async () => {
        try {
          const users = await getSupabaseUsers();
          onUsersChanged(users);
        } catch (err) {
          console.warn('Erro ao sincronizar usuários em tempo real do Supabase:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================================================================================
 * 3. LOGS (AUDITORIA E RASTREABILIDADE) - SUPABASE CRUD & REALTIME
 * ========================================================================================= */

export async function getSupabaseLogs(): Promise<EventLog[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(500);

  if (error) {
    throw formatSupabaseError(error, 'consultar logs de auditoria');
  }

  return (data as EventLog[]) || [];
}

export async function insertSupabaseLog(log: EventLog): Promise<EventLog> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase({
    ...log,
    timestamp: log.timestamp || new Date().toISOString(),
    action: log.action || '',
    details: log.details || '',
    username: log.username || 'Sistema',
    loadId: log.loadId || '',
    userId: log.userId || ''
  });

  const { data, error } = await client
    .from('logs')
    .upsert(sanitized, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw formatSupabaseError(error, 'registrar log de auditoria');
  }

  return (data as EventLog) || sanitized;
}

export async function deleteSupabaseLog(logId: string): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('logs')
    .delete()
    .eq('id', logId);

  if (error) {
    throw formatSupabaseError(error, `excluir log (${logId})`);
  }
}

export async function clearSupabaseLogs(): Promise<void> {
  const client = requireSupabaseClient();
  const { error } = await client
    .from('logs')
    .delete()
    .neq('id', 'placeholder_keep_none');

  if (error) {
    throw formatSupabaseError(error, 'limpar histórico de logs de auditoria');
  }
}

export function subscribeSupabaseLogs(onLogsChanged: (logs: EventLog[]) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('logs-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'logs' },
      async () => {
        try {
          const logs = await getSupabaseLogs();
          onLogsChanged(logs);
        } catch (err) {
          console.warn('Erro ao sincronizar logs em tempo real do Supabase:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================================================================================
 * 4. SETTINGS (CONFIGURAÇÕES DO SISTEMA) - SUPABASE CRUD & REALTIME
 * ========================================================================================= */

export async function getSupabaseSettings(): Promise<Record<string, any>> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('settings')
    .select('*')
    .eq('id', 'system_config')
    .maybeSingle();

  if (error) {
    throw formatSupabaseError(error, 'consultar configurações do sistema');
  }

  return (data as Record<string, any>) || {};
}

export async function upsertSupabaseSettings(settings: Record<string, any>): Promise<void> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase({
    id: 'system_config',
    ...settings,
    updatedAt: new Date().toISOString()
  });

  const { error } = await client
    .from('settings')
    .upsert(sanitized, { onConflict: 'id' });

  if (error) {
    throw formatSupabaseError(error, 'salvar configurações do sistema');
  }
}

export function subscribeSupabaseSettings(onSettingsChanged: (settings: Record<string, any>) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('settings-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      async () => {
        try {
          const settings = await getSupabaseSettings();
          onSettingsChanged(settings);
        } catch (err) {
          console.warn('Erro ao sincronizar configurações em tempo real do Supabase:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/* =========================================================================================
 * 5. FEEDBACKS (CANAL DE COMUNICAÇÃO OPERACIONAL) - SUPABASE CRUD & REALTIME
 * ========================================================================================= */

export async function getSupabaseFeedbacks(): Promise<any[]> {
  const client = requireSupabaseClient();
  const { data, error } = await client
    .from('feedbacks')
    .select('*')
    .order('timestamp', { ascending: true });

  if (error) {
    throw formatSupabaseError(error, 'consultar mensagens de feedback');
  }

  return data || [];
}

export async function insertSupabaseFeedback(feedback: any): Promise<any> {
  const client = requireSupabaseClient();
  const sanitized = sanitizeForSupabase(feedback);

  const { data, error } = await client
    .from('feedbacks')
    .upsert(sanitized, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    throw formatSupabaseError(error, 'enviar mensagem de feedback');
  }

  return data || sanitized;
}

export function subscribeSupabaseFeedbacks(onFeedbacksChanged: (feedbacks: any[]) => void): () => void {
  if (!isSupabaseConfigured() || !supabase) {
    return () => {};
  }

  const channel = supabase
    .channel('feedbacks-realtime-channel')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'feedbacks' },
      async () => {
        try {
          const msgs = await getSupabaseFeedbacks();
          onFeedbacksChanged(msgs);
        } catch (err) {
          console.warn('Erro ao sincronizar feedbacks em tempo real do Supabase:', err);
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
