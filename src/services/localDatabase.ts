// Local Reactive Database & Auth Service for CargaRadar
// Migrated to Supabase with real-time sync, Firestore fallback, and offline-first local cache.

import { CargoLoad, User, EventLog, SystemRole, OccurrenceType, CargoStatus } from '../types';
import { db, handleFirestoreError, OperationType } from './firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { 
  supabase, 
  isSupabaseConfigured, 
  upsertSupabaseLoad, 
  upsertSupabaseLoads, 
  deleteSupabaseLoad, 
  getSupabaseLoads, 
  subscribeSupabaseLoads 
} from './supabase';

const STORAGE_KEYS = {
  LOADS: 'cargoradar_loads',
  USERS: 'cargoradar_users',
  LOGS: 'cargoradar_logs',
  SETTINGS: 'cargoradar_settings',
  FEEDBACKS: 'cargoradar_feedbacks',
  CURRENT_USER: 'cargoradar_current_user',
};

// Default seed users if none exist in localStorage
const DEFAULT_USERS: User[] = [
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
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_portaria_01',
    username: 'portaria',
    password: '123',
    fullName: 'Marcos Vinícius Silva',
    role: 'portaria',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Fiscal de Portaria / Gate',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_expedicao_01',
    username: 'expedicao',
    password: '123',
    fullName: 'Roberto Albuquerque',
    role: 'expedition',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Conferente Líder de Expedição',
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
  },
  {
    id: 'user_central_01',
    username: 'central',
    password: '123',
    fullName: 'Central de Monitoramento',
    role: 'central',
    status: 'active',
    storeLocation: 'CD-01 - Centro de Distribuição 01',
    jobFunction: 'Operador de Torre',
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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

// Deep sanitization for Firestore: converts undefined to omitted/clean values so setDoc never fails
export function sanitizeForFirestore<T = any>(obj: T): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return (obj as any[])
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item));
  }
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj as Record<string, any>)) {
    if (val === undefined) {
      // Completely omit undefined fields to satisfy Firestore strict requirements
      continue;
    }
    cleaned[key] = sanitizeForFirestore(val);
  }
  return cleaned;
}

class LocalDatabase {
  private listeners: { [key: string]: Set<(data: any) => void> } = {
    loads: new Set(),
    users: new Set(),
    logs: new Set(),
    settings: new Set(),
    feedbacks: new Set()
  };

  private isFirestoreInitialized = false;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initSeedData();
      this.initFirestoreSync();
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEYS.LOADS) this.notify('loads', this.getLoads());
        if (event.key === STORAGE_KEYS.USERS) this.notify('users', this.getUsers());
        if (event.key === STORAGE_KEYS.LOGS) this.notify('logs', this.getLogs());
        if (event.key === STORAGE_KEYS.SETTINGS) this.notify('settings', this.getSettings());
        if (event.key === STORAGE_KEYS.FEEDBACKS) this.notify('feedbacks', this.getFeedbacks());
      });
    }
  }

  private initSeedData() {
    try {
      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (!storedUsers || JSON.parse(storedUsers).length === 0) {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(DEFAULT_USERS));
      } else {
        const parsed: User[] = JSON.parse(storedUsers);
        let updated = false;

        // Guarantee master user Cleiton is active with password 361485 and administrator role
        const cleitonUser = parsed.find(u => normalizeStr(u.username) === 'CLEITON');
        if (cleitonUser) {
          if (cleitonUser.password !== '361485' || cleitonUser.systemRole !== 'administrator' || cleitonUser.status !== 'active') {
            cleitonUser.password = '361485';
            cleitonUser.systemRole = 'administrator';
            cleitonUser.role = 'audit';
            cleitonUser.status = 'active';
            cleitonUser.fullName = cleitonUser.fullName || 'Master Cleiton';
            updated = true;
          }
        } else {
          parsed.unshift({
            id: 'user_master_cleiton',
            username: 'Cleiton',
            password: '361485',
            fullName: 'Master Cleiton',
            role: 'audit',
            systemRole: 'administrator',
            status: 'active',
            storeLocation: 'CD-01 - Centro de Distribuição 01',
            jobFunction: 'Gestor Master / Administrador do Sistema',
            createdAt: new Date().toISOString()
          });
          updated = true;
        }

        DEFAULT_USERS.forEach(def => {
          if (!parsed.some(u => normalizeStr(u.username) === normalizeStr(def.username))) {
            parsed.push(def);
            updated = true;
          }
        });
        if (updated) {
          localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(parsed));
        }
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
      console.warn('Erro ao inicializar semente local:', err);
    }
  }

  // Real-time Firestore sync with local cache
  private initFirestoreSync() {
    if (this.isFirestoreInitialized) return;
    this.isFirestoreInitialized = true;

    try {
      // 1. Loads listener (Supabase Realtime with Firestore fallback)
      if (isSupabaseConfigured()) {
        getSupabaseLoads().then(({ data }) => {
          if (data && data.length > 0) {
            localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(data));
            this.notify('loads', data);
          }
        });

        subscribeSupabaseLoads((liveLoads) => {
          localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(liveLoads));
          this.notify('loads', liveLoads);
        });
      } else {
        const loadsPath = 'loads';
        onSnapshot(
          collection(db, loadsPath),
          (snapshot) => {
            if (!snapshot.empty) {
              const firestoreLoads: CargoLoad[] = [];
              snapshot.forEach((docSnap) => {
                const data = docSnap.data() as CargoLoad;
                firestoreLoads.push(data);
              });
              // Update local storage and notify
              localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(firestoreLoads));
              this.notify('loads', firestoreLoads);
            }
          },
          (error) => {
            handleFirestoreError(error, OperationType.GET, loadsPath);
          }
        );
      }

      // 2. Users listener
      const usersPath = 'users';
      onSnapshot(
        collection(db, usersPath),
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreUsers: User[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as User;
              firestoreUsers.push(data);
            });

            // Ensure Cleiton always has full admin role and 361485
            const cleitonUser = firestoreUsers.find(u => normalizeStr(u.username) === 'CLEITON');
            if (cleitonUser) {
              cleitonUser.password = '361485';
              cleitonUser.systemRole = 'administrator';
              cleitonUser.status = 'active';
            } else {
              firestoreUsers.unshift(DEFAULT_USERS[0]);
            }

            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(firestoreUsers));
            this.notify('users', firestoreUsers);
          } else {
            // Seed master users to Firestore if collection is empty
            this.seedUsersToFirestore();
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, usersPath);
        }
      );

      // 3. Logs listener
      const logsPath = 'logs';
      onSnapshot(
        collection(db, logsPath),
        (snapshot) => {
          if (!snapshot.empty) {
            const firestoreLogs: EventLog[] = [];
            snapshot.forEach((docSnap) => {
              firestoreLogs.push(docSnap.data() as EventLog);
            });
            // Sort by timestamp descending
            firestoreLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const trimmed = firestoreLogs.slice(0, 500);
            localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
            this.notify('logs', trimmed);
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, logsPath);
        }
      );

      // 4. Settings listener
      const settingsPath = 'settings';
      onSnapshot(
        collection(db, settingsPath),
        (snapshot) => {
          if (!snapshot.empty) {
            snapshot.forEach((docSnap) => {
              if (docSnap.id === 'system_config') {
                const data = docSnap.data();
                localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data));
                this.notify('settings', data);
              }
            });
          }
        },
        (error) => {
          handleFirestoreError(error, OperationType.GET, settingsPath);
        }
      );
    } catch (err) {
      console.warn('Firestore sync listener setup failed (offline mode active):', err);
    }
  }

  private async seedUsersToFirestore() {
    try {
      const usersToSeed = this.getUsers();
      for (const u of usersToSeed) {
        const sanitizedUser = sanitizeForFirestore(u);
        await setDoc(doc(db, 'users', u.id), sanitizedUser, { merge: true });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users');
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
    // Dispatch custom window event for reactive multi-component sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(`cargoradar_${type}_updated`, { detail: data }));
    }
  }

  // --- LOADS API ---
  getLoads(): CargoLoad[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOADS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveLoad(load: CargoLoad): CargoLoad {
    // Explicitly guarantee driverPhone and other core strings are never undefined
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

    const loads = this.getLoads();
    const existingIndex = loads.findIndex(l => l.id === sanitizedLoad.id);
    if (existingIndex >= 0) {
      loads[existingIndex] = { ...loads[existingIndex], ...sanitizedLoad };
    } else {
      loads.unshift(sanitizedLoad);
    }
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    this.notify('loads', loads);

    // Sync to Supabase (primary) or fallback to Firestore
    if (isSupabaseConfigured()) {
      upsertSupabaseLoad(sanitizedLoad).catch((err) => {
        console.warn('Erro ao salvar carga no Supabase:', err);
      });
    } else {
      // Sync to Firestore with strict sanitization ensuring zero undefined fields
      const firestorePayload = sanitizeForFirestore(sanitizedLoad);
      setDoc(doc(db, 'loads', sanitizedLoad.id), firestorePayload, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.WRITE, `loads/${sanitizedLoad.id}`);
      });
    }

    return sanitizedLoad;
  }

  saveLoads(newLoads: CargoLoad[]) {
    const sanitizedList = newLoads.map(load => ({
      ...load,
      driverPhone: typeof load.driverPhone === 'string' ? load.driverPhone : (load.driverPhone ?? ''),
      origin: load.origin || '',
      destination: load.destination || '',
      plate: load.plate || '',
      driverName: load.driverName || '',
    }));
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(sanitizedList));
    this.notify('loads', sanitizedList);

    // Sync batch to Supabase (primary) or fallback to Firestore
    if (isSupabaseConfigured()) {
      upsertSupabaseLoads(sanitizedList).catch((err) => {
        console.warn('Erro ao salvar lote de cargas no Supabase:', err);
      });
    } else {
      try {
        sanitizedList.forEach(load => {
          const firestorePayload = sanitizeForFirestore(load);
          setDoc(doc(db, 'loads', load.id), firestorePayload, { merge: true }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, `loads/${load.id}`);
          });
        });
      } catch (err) {
        console.warn('Erro ao sincronizar lote de cargas no Firestore:', err);
      }
    }
  }

  deleteLoad(loadId: string) {
    const loads = this.getLoads().filter(l => l.id !== loadId);
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify(loads));
    this.notify('loads', loads);

    // Delete in Supabase (primary) or fallback to Firestore
    if (isSupabaseConfigured()) {
      deleteSupabaseLoad(loadId).catch((err) => {
        console.warn('Erro ao deletar carga no Supabase:', err);
      });
    } else {
      deleteDoc(doc(db, 'loads', loadId)).catch((err) => {
        handleFirestoreError(err, OperationType.DELETE, `loads/${loadId}`);
      });
    }
  }

  getLoadById(id: string): CargoLoad | undefined {
    return this.getLoads().find(l => l.id === id);
  }

  // Clean occurrence from load
  deleteOccurrence(loadId: string, occurrenceTimestamp: string): boolean {
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
        loads[loadIndex] = { ...load };
        this.saveLoads(loads);
        return true;
      }
    }

    return false;
  }

  // Delete audited load
  deleteAuditedLoad(id: string): boolean {
    const loads = this.getLoads();
    const loadIndex = loads.findIndex(l => l.id === id);

    if (loadIndex >= 0) {
      const load = loads[loadIndex];
      if (load.auditedAt || load.status === CargoStatus.FINISHED || load.status === CargoStatus.BLOCKED) {
        this.deleteLoad(id);
        this.addLog('Exclusão de Registro Auditado', `Registro auditado da carga ${load.plate} excluído pelo Administrador Master`, 'Administrador Master', id);
        return true;
      }
    }

    return false;
  }

  // Delete record by id and type
  deleteRecordById(id: string, type?: string): boolean {
    if (type === 'load' || !type) {
      this.deleteLoad(id);
      return true;
    }
    if (type === 'occurrence') {
      const loads = this.getLoads();
      for (const load of loads) {
        if (load.occurrenceHistory?.some(occ => occ.timestamp === id)) {
          return this.deleteOccurrence(load.id, id);
        }
      }
      return false;
    }
    if (type === 'log') {
      const logs = this.getLogs().filter(l => l.id !== id);
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs));
      this.notify('logs', logs);
      deleteDoc(doc(db, 'logs', id)).catch(err => {
        handleFirestoreError(err, OperationType.DELETE, `logs/${id}`);
      });
      return true;
    }
    return false;
  }

  clearAllSystemData() {
    localStorage.setItem(STORAGE_KEYS.LOADS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify([]));
    this.notify('loads', []);
    this.notify('logs', []);
    this.notify('feedbacks', []);
    this.addLog('Limpeza de Dados', 'Histórico operacional de cargas e logs completamente zerado pelo Administrador Master', 'Administrador Master');
  }

  subscribeLoads(callback: (loads: CargoLoad[]) => void): () => void {
    this.listeners.loads.add(callback);
    callback(this.getLoads());
    return () => this.listeners.loads.delete(callback);
  }

  // --- USERS API ---
  getUsers(): User[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.USERS);
      return raw ? JSON.parse(raw) : DEFAULT_USERS;
    } catch {
      return DEFAULT_USERS;
    }
  }

  saveUser(user: User): User {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users', users);

    // Sync to Firestore
    const firestoreUser = sanitizeForFirestore(user);
    setDoc(doc(db, 'users', user.id), firestoreUser, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.id}`);
    });

    return user;
  }

  updateUser(userId: string, partial: Partial<User>): User | null {
    const users = this.getUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index >= 0) {
      users[index] = { ...users[index], ...partial };
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
      this.notify('users', users);

      // Sync to Firestore
      const firestorePartial = sanitizeForFirestore(partial);
      setDoc(doc(db, 'users', userId), firestorePartial, { merge: true }).catch((err) => {
        handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
      });

      return users[index];
    }
    return null;
  }

  deleteUser(userId: string) {
    const users = this.getUsers().filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    this.notify('users', users);

    // Sync to Firestore
    deleteDoc(doc(db, 'users', userId)).catch((err) => {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    });
  }

  // Register new user request
  register(userData: Omit<User, 'id' | 'createdAt'>): { success: boolean; message: string; user?: User } {
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
    this.saveUser(newUser);
    return { success: true, message: 'Cadastro enviado para aprovação.', user: newUser };
  }

  subscribeUsers(callback: (users: User[]) => void): () => void {
    this.listeners.users.add(callback);
    callback(this.getUsers());
    return () => this.listeners.users.delete(callback);
  }

  // --- LOGS API ---
  getLogs(): EventLog[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addLog(action: string, details: string, username: string = 'Sistema', loadId?: string, userId?: string): EventLog {
    const logs = this.getLogs();
    const newLog: EventLog = {
      id: generateLocalId(),
      timestamp: new Date().toISOString(),
      action: action || '',
      details: details || '',
      username: username || 'Sistema',
      loadId: loadId || '',
      userId: userId || ''
    };
    logs.unshift(newLog);
    const trimmed = logs.slice(0, 500);
    localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(trimmed));
    this.notify('logs', trimmed);

    // Sync to Firestore
    const firestoreLog = sanitizeForFirestore(newLog);
    setDoc(doc(db, 'logs', newLog.id), firestoreLog).catch((err) => {
      handleFirestoreError(err, OperationType.CREATE, `logs/${newLog.id}`);
    });

    return newLog;
  }

  subscribeLogs(callback: (logs: EventLog[]) => void): () => void {
    this.listeners.logs.add(callback);
    callback(this.getLogs());
    return () => this.listeners.logs.delete(callback);
  }

  // --- SETTINGS API ---
  getSettings(): Record<string, any> {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  saveSettings(settings: Record<string, any>) {
    const current = this.getSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
    this.notify('settings', merged);

    // Sync to Firestore
    const firestoreSettings = sanitizeForFirestore(merged);
    setDoc(doc(db, 'settings', 'system_config'), firestoreSettings, { merge: true }).catch((err) => {
      handleFirestoreError(err, OperationType.WRITE, 'settings/system_config');
    });
  }

  subscribeSettings(callback: (settings: Record<string, any>) => void): () => void {
    this.listeners.settings.add(callback);
    callback(this.getSettings());
    return () => this.listeners.settings.delete(callback);
  }

  // --- FEEDBACKS API ---
  getFeedbacks(): any[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.FEEDBACKS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  saveFeedback(msg: any): any {
    const list = this.getFeedbacks();
    list.push(msg);
    localStorage.setItem(STORAGE_KEYS.FEEDBACKS, JSON.stringify(list));
    this.notify('feedbacks', list);
    return msg;
  }

  subscribeFeedbacks(callback: (feedbacks: any[]) => void): () => void {
    this.listeners.feedbacks.add(callback);
    callback(this.getFeedbacks());
    return () => this.listeners.feedbacks.delete(callback);
  }

  // --- CURRENT USER SESSION ---
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
