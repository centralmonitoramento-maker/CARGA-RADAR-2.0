-- ==============================================================================
-- CARGARADAR 2.0 - ESQUEMA COMPLETO DE TABELAS SUPABASE (POSTGRESQL)
-- ==============================================================================
-- Instruções:
-- 1. Acesse o painel do seu projeto no Supabase (https://supabase.com/dashboard)
-- 2. No menu lateral esquerdo, clique em "SQL Editor"
-- 3. Crie uma "New Query", cole todo o código abaixo e clique em "Run"
-- ==============================================================================

-- 1. TABELA DE CARGAS (LOADS)
CREATE TABLE IF NOT EXISTS public.loads (
  id TEXT PRIMARY KEY,
  plate TEXT NOT NULL,
  "driverName" TEXT,
  "driverPhone" TEXT,
  "cargoType" TEXT,
  origin TEXT,
  destination TEXT,
  "additionalDestinations" JSONB DEFAULT '[]'::jsonb,
  "sharedCargoDescriptions" JSONB DEFAULT '{}'::jsonb,
  "cargoClassificationByDest" JSONB DEFAULT '{}'::jsonb,
  "sealNumber" TEXT,
  "palletCount" NUMERIC DEFAULT 0,
  "palletDetails" JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'AWAITING',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "createdBy" TEXT,
  "isHighRisk" BOOLEAN DEFAULT FALSE,
  "parType" TEXT,
  "parInvoiceNumber" TEXT,
  "parDescription" TEXT,
  "auditedAt" TEXT,
  "tripFinished" BOOLEAN DEFAULT FALSE,
  "photoPlate" TEXT,
  "photoSeal" TEXT,
  "photoManifest" TEXT,
  "gatePhotoPlate" TEXT,
  "gatePhotoSeal" TEXT,
  "gatePhotoManifest" TEXT,
  "occurrenceType" TEXT,
  "occurrenceDescription" TEXT,
  "occurrencePhoto" TEXT,
  "occurrenceHistory" JSONB DEFAULT '[]'::jsonb,
  "gateChecklist" JSONB DEFAULT '{}'::jsonb,
  route JSONB DEFAULT '{}'::jsonb
);

-- 2. TABELA DE USUÁRIOS E AUTORIZAÇÃO (USERS)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  "fullName" TEXT,
  role TEXT DEFAULT 'expedition',
  "systemRole" TEXT DEFAULT 'dispatcher',
  status TEXT DEFAULT 'active',
  "storeLocation" TEXT,
  "jobFunction" TEXT,
  carrier TEXT,
  email TEXT,
  phone TEXT,
  unit TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE LOGS DE AUDITORIA E RASTREABILIDADE (LOGS)
CREATE TABLE IF NOT EXISTS public.logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action TEXT NOT NULL,
  details TEXT,
  username TEXT DEFAULT 'Sistema',
  "loadId" TEXT,
  "userId" TEXT
);

-- 4. TABELA DE CONFIGURAÇÕES DO SISTEMA (SETTINGS)
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY,
  "occurrenceAlertEmails" JSONB DEFAULT '["central.monitoramento@atacadaodiaadia.com.br"]'::jsonb,
  "autoEmailEnabled" BOOLEAN DEFAULT TRUE,
  "yardSlaTargetHours" NUMERIC DEFAULT 2.5,
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABELA DE FEEDBACKS E COMUNICAÇÃO OPERACIONAL (FEEDBACKS)
CREATE TABLE IF NOT EXISTS public.feedbacks (
  id TEXT PRIMARY KEY,
  text TEXT,
  "senderName" TEXT,
  "senderUsername" TEXT,
  "senderRole" TEXT,
  "senderRoleLabel" TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  audio TEXT,
  "audioDuration" NUMERIC,
  attachment TEXT,
  "attachmentName" TEXT,
  "attachmentType" TEXT,
  "areaTarget" TEXT DEFAULT 'all',
  "isDirect" BOOLEAN DEFAULT FALSE,
  "userTarget" TEXT,
  "userTargetName" TEXT
);

-- ==============================================================================
-- POLÍTICAS DE SEGURANÇA E ACESSO (ROW LEVEL SECURITY - RLS)
-- ==============================================================================
ALTER TABLE public.loads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

-- Criação de permissões permissivas para API pública/anon do CargaRadar
DROP POLICY IF EXISTS "Permissao Total Cargas" ON public.loads;
CREATE POLICY "Permissao Total Cargas" ON public.loads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao Total Usuarios" ON public.users;
CREATE POLICY "Permissao Total Usuarios" ON public.users FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao Total Logs" ON public.logs;
CREATE POLICY "Permissao Total Logs" ON public.logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao Total Config" ON public.settings;
CREATE POLICY "Permissao Total Config" ON public.settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permissao Total Feedbacks" ON public.feedbacks;
CREATE POLICY "Permissao Total Feedbacks" ON public.feedbacks FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- CARGA INICIAL: USUÁRIO MASTER CLEITON (Senha: 361485)
-- ==============================================================================
INSERT INTO public.users (id, username, password, "fullName", role, "systemRole", status, "storeLocation", "jobFunction", "createdAt")
VALUES 
  ('user_master_cleiton', 'Cleiton', '361485', 'Master Cleiton', 'audit', 'administrator', 'active', 'CD-01 - Centro de Distribuição 01', 'Gestor Master / Administrador do Sistema', NOW())
ON CONFLICT (username) DO UPDATE 
SET password = EXCLUDED.password, "systemRole" = 'administrator', status = 'active';
