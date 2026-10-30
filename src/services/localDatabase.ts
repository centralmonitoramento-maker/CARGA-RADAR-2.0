// Reactive Database & Auth Service for CargaRadar 2.0
// Exclusively powered by Supabase with synchronous cloud writes, real-time sync, and reactive listeners.

import { CargoLoad, User, EventLog, OccurrenceType, CargoStatus } from '../types';
import { 
  isSupabaseConfigured,
  getSupabaseLoads,
  upsertSupabaseLoad, 
  upsertSupabaseLoads, 
  deleteSupabaseLoad, 
  subscribeSupabaseLoads,
  getSupabaseUsers,
  upsertSupabaseUser,
  updateSupabaseUser,
  deleteSupabaseUser,
  subscribeSupabaseUsers,
  getSupabaseLogs,
  insertSupabaseLog,
  deleteSupabaseLog,
  clearSupabaseLogs,
  subscribeSupabaseLogs,
  getSupabaseSettings,
  upsertSupabaseSettings,
  subscribeSupabaseSettings,
  getSupabaseFeedbacks,
  insertSupabaseFeedback,
  subscribeSupabaseFeedbacks,
  sanitizeForSupabase
} from './supabase';

const STORAGE_KEYS = {
  LOADS: 'cargoradar_loads',
  USERS: 'cargoradar_users',
  LOGS: 'cargoradar_logs',
  SETTINGS: 'cargoradar_settings',
  FEEDBACKS: 'cargoradar_feedbacks',
  CURRENT_USER: 'cargoradar_current_user',
};

// Seed master user Cleiton and default system users
export const DEFAULT_USERS: User[] = [
  {
    id: 'user_master_cleiton',
    username: 'Cleiton',
    password: '361485',
    fullName: 'Master Cleiton',
    role: 'audit',
    systemRole: 'administrator',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Gestor Master / Administrador do Sistema',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_admin_01',
    username: 'admin',
    password: '123',
    fullName: 'Administrador Geral',
    role: 'audit',
    systemRole: 'administrator',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Gestor de Segurança e Auditoria',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_supervisor_01',
    username: 'supervisor',
    password: '123',
    fullName: 'Carlos Mendes',
    role: 'supervisor_cd',
    systemRole: 'supervisor_cd',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Supervisor Operacional CD',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_portaria_01',
    username: 'portaria',
    password: '123',
    fullName: 'Marcos Vinícius Silva',
    role: 'portaria',
    systemRole: 'dispatcher',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Fiscal de Portaria / Gate',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_expedicao_01',
    username: 'expedicao',
    password: '123',
    fullName: 'Roberto Albuquerque',
    role: 'expedition',
    systemRole: 'dispatcher',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Conferente Líder de Expedição',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_auditor_01',
    username: 'auditor',
    password: '123',
    fullName: 'Fernanda Rocha',
    role: 'audit',
    systemRole: 'auditor',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Auditora de Cargas',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_central_01',
    username: 'central',
    password: '123',
    fullName: 'Central de Monitoramento',
    role: 'central',
    systemRole: 'administrator',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Operador de Torre',
    createdAt: '2025-01-01T00:00:00.000Z'
  },
  {
    id: 'user_loja_01',
    username: 'loja1001',
    password: '123',
    fullName: 'Ceilândia 1001 - Apoio',
    role: 'store_app',
    systemRole: 'store_app',
    status: 'active',
    storeLocation: '1001 - Ceilândia',
    jobFunction: 'Operador App Loja',
    createdAt: '2025-01-01T00:00:00.000Z'
  }
];

// Helper to normalize strings for comparison
export function normalizeStr(str?: string): string {
  if (!str) return '';
  return str.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Generate unique ID safely
export function generateLocalId(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

class LocalDatabase {
  private listeners: { [key: string]: Set<(data: any) => void> } = {
    loads: new Set(),
    users: new Set(),
    logs: new Set(),
    settings: new Set(),
    feedbacks: new Set()
  };

  private isSupabaseSyncInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initLocalCache();
      this.initSupabaseSync();
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEYS.LOADS) this.notify('loads', this.getLoads());
        if (event.key === STORAGE_KEYS.USERS) this.notify('users', this.getUsers());
        if (event.key === STORAGE_KEYS.LOGS) this.notify('logs', this.getLogs());
        if (event.key === STORAGE_KEYS.SETTINGS) this.notify('settings', this.getSettings());
        if (event.key === STORAGE_KEYS.FEEDBACKS) this.notify('feedbacks', this.getFeedbacks());
      });
    }
  }

  private initLocalCache() {
    try {
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!storedUsers || JSON.parse(storedUsers).length === 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      }

      if (!localStorage.getItem(STORAGE_KEYS.LOADS)) {
        localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.LOGS)) {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.FEEDBACKS)) {
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
      }
      if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify({
          occurrenceAlertEmails: ['central.monitoramento@atacadaodiaadia.com.br'],
          yardSlaTargetHours: 2.5
        }));
      }
    } catch (err) {
      console.warn('Erro ao inicializar cache local:', err);
    }
  }

  /**
   * Initialize synchronous cloud fetch and real-time listeners with Supabase exclusively
   */
  public async initSupabaseSync() {
    if (this.isSupabaseSyncInitialized) return;
    this.isSupabaseSyncInitialized = true;

    if (!isSupabaseConfigured()) {
      console.warn(
        '[CargaRadar] Supabase não está configurado no ambiente. Para salvar e carregar dados na nuvem, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
      );
      return;
    }

    try {
      console.log('[CargaRadar] Conectando diretamente ao Supabase...');

      // 1. SINCRONIZAR USUÁRIOS
      try {
        const remoteUsers = await getSupabaseUsers();
        if (remoteUsers && remoteUsers.length > 0) {
          // Garantir que Cleiton sempre exista e esteja ativo
          const cleitonFound = remoteUsers.some(u => normalizeStr(u.username) === 'CLEITON');
          if (!cleitonFound) {
            await upsertSupabaseUser(DEFAULT_USERS[0]);
            remoteUsers.unshift(DEFAULT_USERS[0]);
          }
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(remoteUsers));
          this.notify('users', remoteUsers);
        } else {
          // Se a tabela estiver vazia, semeia o usuário master Cleiton e padrões no Supabase
          console.log('[CargaRadar] Semeando usuários padrão no Supabase...');
          for (const defUser of DEFAULT_USERS) {
            await upsertSupabaseUser(defUser);
          }
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
          this.notify('users', DEFAULT_USERS);
        }
      } catch (err: any) {
        console.error('[CargaRadar] Falha ao carregar usuários do Supabase:', err.message);
      }

      // 2. SINCRONIZAR CARGAS
      try {
        const remoteLoads = await getSupabaseLoads();
        if (remoteLoads) {
          localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(remoteLoads));
          this.notify('loads', remoteLoads);
        }
      } catch (err: any) {
        console.error('[CargaRadar] Falha ao carregar cargas do Supabase:', err.message);
      }

      // 3. SINCRONIZAR LOGS DE AUDITORIA
      try {
        const remoteLogs = await getSupabaseLogs();
        if (remoteLogs) {
          localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(remoteLogs));
          this.notify('logs', remoteLogs);
        }
      } catch (err: any) {
        console.error('[CargaRadar] Falha ao carregar logs do Supabase:', err.message);
      }

      // 4. SINCRONIZAR CONFIGURAÇÕES
      try {
        const remoteSettings = await getSupabaseSettings();
        if (remoteSettings && Object.keys(remoteSettings).length > 0) {
          localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(remoteSettings));
          this.notify('settings', remoteSettings);
        }
      } catch (err: any) {
        console.error('[CargaRadar] Falha ao carregar configurações do Supabase:', err.message);
      }

      // 5. SINCRONIZAR FEEDBACKS
      try {
        const remoteFeedbacks = await getSupabaseFeedbacks();
        if (remoteFeedbacks) {
          localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(remoteFeedbacks));
          this.notify('feedbacks', remoteFeedbacks);
        }
      } catch (err: any) {
        console.error('[CargaRadar] Falha ao carregar feedbacks do Supabase:', err.message);
      }

      // 6. INICIAR SUBSCRIÇÕES REALTIME DO SUPABASE
      subscribeSupabaseLoads((liveLoads) => {
        localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(liveLoads));
        this.notify('loads', liveLoads);
      });

      subscribeSupabaseUsers((liveUsers) => {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(liveUsers));
        this.notify('users', liveUsers);
      });

      subscribeSupabaseLogs((liveLogs) => {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(liveLogs));
        this.notify('logs', liveLogs);
      });

      subscribeSupabaseSettings((liveSettings) => {
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(liveSettings));
        this.notify('settings', liveSettings);
      });

      subscribeSupabaseFeedbacks((liveFeedbacks) => {
        localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(liveFeedbacks));
        this.notify('feedbacks', liveFeedbacks);
      });

      console.log('[CargaRadar] Sincronização e Realtime do Supabase estabelecidos com sucesso!');
    } catch (err) {
      console.error('[CargaRadar] Falha geral ao inicializar Supabase:', err);
    }
  }

  private notify(type: string, data: any) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Erro no listener de ${type}:`, e);
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`cargoradar_${type}_updated`, { detail: data }));
    }
  }

  // =======================================================================================
  // CARGAS (LOADS) - GRAVAÇÃO SÍNCRONA DIRETA NO SUPABASE
  // =======================================================================================

  getLoads(): CargoLoad[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOADS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Salva uma carga diretamente no Supabase antes de alterar o estado local.
   * Lança erro caso o Supabase falhe para que a UI exiba a mensagem para o usuário.
   */
  async saveLoad(load: CargoLoad): Promise<CargoLoad> {
    const sanitizedLoad: CargoLoad = {
      ...load,
      driverPhone: typeof load.driverPhone === 'string' ? load.driverPhone : (load.driverPhone ?? ''),
      origin: load.origin || '',
      destination: load.destination || '',
      plate: load.plate || '',
      driverName: load.driverName || '',
      sealNumber: load.sealNumber || '',
      status: load.status || CargoStatus.AWAITING,
    };

    // 1. Grava diretamente e de forma síncrona no Supabase
    const savedInCloud = await upsertSupabaseLoad(sanitizedLoad);

    // 2. Atualiza estado local apenas após sucesso na nuvem
    const loads = this.getLoads();
    const existingIndex = loads.findIndex(l => l.id === savedInCloud.id);
    if (existingIndex >= 0) {
      loads[existingIndex] = { ...loads[existingIndex], ...savedInCloud };
    } else {
      loads.unshift(savedInCloud);
    }
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    this.notify('loads', loads);

    return savedInCloud;
  }

  /**
   * Salva lote de cargas no Supabase antes de atualizar o estado local.
   */
  async saveLoads(newLoads: CargoLoad[]): Promise<CargoLoad[]> {
    const sanitizedList = newLoads.map(load => ({
      ...load,
      driverPhone: typeof load.driverPhone === 'string' ? load.driverPhone : (load.driverPhone ?? ''),
      origin: load.origin || '',
      destination: load.destination || '',
      plate: load.plate || '',
      driverName: load.driverName || '',
    }));

    // 1. Grava lote diretamente no Supabase
    const savedInCloud = await upsertSupabaseLoads(sanitizedList);

    // 2. Atualiza estado local após sucesso
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(savedInCloud));
    this.notify('loads', savedInCloud);

    return savedInCloud;
  }

  /**
   * Exclui carga do Supabase antes de atualizar o estado local.
   */
  async deleteLoad(loadId: string): Promise<void> {
    // 1. Exclui diretamente no Supabase
    await deleteSupabaseLoad(loadId);

    // 2. Atualiza estado local
    const loads = this.getLoads().filter(l => l.id !== loadId);
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    this.notify('loads', loads);
  }

  getLoadById(id: string): CargoLoad | undefined {
    return this.getLoads().find(l => l.id === id);
  }

  async deleteOccurrence(loadId: string, occurrenceTimestamp: string): Promise<boolean> {
    const loads = this.getLoads();
    const loadIndex = loads.findIndex(l => l.id === loadId);
    
    if (loadIndex >= 0) {
      const load = loads[loadIndex];
      let updated = false;

      if (load.occurrenceHistory && load.occurrenceHistory.length > 0) {
        const initialCount = load.occurrenceHistory.length;
        load.occurrenceHistory = load.occurrenceHistory.filter(occ => occ.timestamp !== occurrenceTimestamp);
        
        if (load.occurrenceHistory.length !== initialCount) {
          updated = true;
        }
      }

      if (load.occurrenceHistory && load.occurrenceHistory.length === 0) {
        delete load.occurrenceHistory;
        load.occurrenceType = OccurrenceType.NONE;
        delete load.occurrenceDescription;
        delete load.occurrencePhoto;
        updated = true;
      }

      if (updated) {
        const updatedLoad = { ...load };
        await this.saveLoad(updatedLoad);
        return true;
      }
    }

    return false;
  }

  async deleteAuditedLoad(id: string): Promise<boolean> {
    const loads = this.getLoads();
    const load = loads.find(l => l.id === id);

    if (load) {
      if (load.auditedAt || load.status === CargoStatus.FINISHED || load.status === CargoStatus.BLOCKED) {
        await this.deleteLoad(id);
        await this.addLog(
          'Exclusão de Registro Auditado', 
          `Registro auditado da carga ${load.plate} excluído permanentemente no Supabase`, 
          'Administrador Master', 
          id
        );
        return true;
      }
    }

    return false;
  }

  async deleteRecordById(id: string, type?: string): Promise<boolean> {
    if (type === 'load' || type === 'carga' || !type) {
      await this.deleteLoad(id);
      return true;
    }
    if (type === 'occurrence') {
      const loads = this.getLoads();
      for (const load of loads) {
        if (load.occurrenceHistory?.some(occ => occ.timestamp === id)) {
          return await this.deleteOccurrence(load.id, id);
        }
      }
      return false;
    }
    if (type === 'log' || type === 'audit') {
      await deleteSupabaseLog(id);
      const logs = this.getLogs().filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      this.notify('logs', logs);
      return true;
    }
    return false;
  }

  async clearAllSystemData(): Promise<void> {
    // 1. Limpa histórico de logs no Supabase
    await clearSupabaseLogs();

    // 2. Atualiza estado local
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
    this.notify('loads', []);
    this.notify('logs', []);
    this.notify('feedbacks', []);
    
    await this.addLog(
      'Limpeza de Dados', 
      'Histórico de auditoria completamente zerado no Supabase pelo Administrador Master', 
      'Administrador Master'
    );
  }

  subscribeLoads(callback: (loads: CargoLoad[]) => void): () => void {
    this.listeners.loads.add(callback);
    callback(this.getLoads());
    return () => this.listeners.loads.delete(callback);
  }

  // =======================================================================================
  // USUÁRIOS E AUTORIZAÇÃO (USERS) - GRAVAÇÃO SÍNCRONA DIRETA NO SUPABASE
  // =======================================================================================

  getUsers(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      return raw ? JSON.parse(raw) : DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  }

  /**
   * Salva/Cadastra um usuário diretamente no Supabase antes de atualizar o estado local.
   */
  async saveUser(user: User): Promise<User> {
    // 1. Grava diretamente e de forma síncrona no Supabase
    const savedInCloud = await upsertSupabaseUser(user);

    // 2. Atualiza estado local
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === savedInCloud.id);
    if (index >= 0) {
      users[index] = { ...users[index], ...savedInCloud };
    } else {
      users.push(savedInCloud);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users', users);

    return savedInCloud;
  }

  /**
   * Atualiza permissões ou dados do usuário diretamente no Supabase.
   */
  async updateUser(userId: string, partial: Partial<User>): Promise<User | null> {
    // 1. Atualiza diretamente no Supabase
    await updateSupabaseUser(userId, partial);

    // 2. Atualiza estado local
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index >= 0) {
      users[index] = { ...users[index], ...partial };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.notify('users', users);
      return users[index];
    }
    return null;
  }

  /**
   * Exclui usuário do Supabase.
   */
  async deleteUser(userId: string): Promise<void> {
    // 1. Exclui diretamente no Supabase
    await deleteSupabaseUser(userId);

    // 2. Atualiza estado local
    const users = this.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users', users);
  }

  /**
   * Solicitação de novo cadastro de usuário - grava diretamente no Supabase
   */
  async register(userData: Omit<User, 'id' | 'createdAt'>): Promise<{ success: boolean; message: string; user?: User }> {
    const users = this.getUsers();
    const existing = users.find(u => normalizeStr(u.username) === normalizeStr(userData.username));
    if (existing) {
      return { success: false, message: 'Nome de usuário já cadastrado.' };
    }
    const newUser: User = {
      ...userData,
      id: generateLocalId(),
      status: userData.status || 'pending',
      createdAt: new Date().toISOString()
    };

    // Grava de forma síncrona no Supabase
    const saved = await this.saveUser(newUser);
    return { success: true, message: 'Cadastro enviado para aprovação no Supabase.', user: saved };
  }

  subscribeUsers(callback: (users: User[]) => void): () => void {
    this.listeners.users.add(callback);
    callback(this.getUsers());
    return () => this.listeners.users.delete(callback);
  }

  // =======================================================================================
  // AUDITORIA E LOGS (LOGS) - GRAVAÇÃO SÍNCRONA DIRETA NO SUPABASE
  // =======================================================================================

  getLogs(): EventLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Registra log de auditoria diretamente no Supabase de forma síncrona.
   */
  async addLog(action: string, details: string, username: string = 'Sistema', loadId?: string, userId?: string): Promise<EventLog> {
    const newLog: EventLog = {
      id: generateLocalId(),
      timestamp: new Date().toISOString(),
      action: action || '',
      details: details || '',
      username: username || 'Sistema',
      loadId: loadId || '',
      userId: userId || ''
    };

    // 1. Grava no Supabase
    const savedInCloud = await insertSupabaseLog(newLog);

    // 2. Atualiza estado local
    const logs = this.getLogs();
    logs.unshift(savedInCloud);
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
    this.notify('logs', trimmed);

    return savedInCloud;
  }

  subscribeLogs(callback: (logs: EventLog[]) => void): () => void {
    this.listeners.logs.add(callback);
    callback(this.getLogs());
    return () => this.listeners.logs.delete(callback);
  }

  // =======================================================================================
  // CONFIGURAÇÕES (SETTINGS) - GRAVAÇÃO SÍNCRONA DIRETA NO SUPABASE
  // =======================================================================================

  getSettings(): Record<string, any> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  async saveSettings(settings: Record<string, any>): Promise<void> {
    const current = this.getSettings();
    const merged = { ...current, ...settings };

    // 1. Grava no Supabase
    await upsertSupabaseSettings(merged);

    // 2. Atualiza estado local
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    this.notify('settings', merged);
  }

  subscribeSettings(callback: (settings: Record<string, any>) => void): () => void {
    this.listeners.settings.add(callback);
    callback(this.getSettings());
    return () => this.listeners.settings.delete(callback);
  }

  // =======================================================================================
  // FEEDBACKS / COMUNICAÇÃO OPERACIONAL - GRAVAÇÃO SÍNCRONA DIRETA NO SUPABASE
  // =======================================================================================

  getFeedbacks(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async saveFeedback(msg: any): Promise<any> {
    // 1. Grava no Supabase
    const savedInCloud = await insertSupabaseFeedback(msg);

    // 2. Atualiza estado local
    const list = this.getFeedbacks();
    list.push(savedInCloud);
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(list));
    this.notify('feedbacks', list);

    return savedInCloud;
  }

  subscribeFeedbacks(callback: (feedbacks: any[]) => void): () => void {
    this.listeners.feedbacks.add(callback);
    callback(this.getFeedbacks());
    return () => this.listeners.feedbacks.delete(callback);
  }

  // =======================================================================================
  // SESSÃO DO USUÁRIO ATUAL (LOCAL)
  // =======================================================================================

  getCurrentUser(): User | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  setCurrentUser(user: User | null) {
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  logout() {
    this.setCurrentUser(null);
  }
}

export const localDb = new LocalDatabase();
