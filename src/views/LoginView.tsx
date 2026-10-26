import React, { useState } from 'react';
import { User, STORE_LOCATIONS_BY_REGION } from '../types';
import { 
  Shield, 
  Lock, 
  User as UserIcon, 
  MapPin, 
  Briefcase, 
  Eye, 
  EyeOff, 
  Activity, 
  Navigation, 
  Radar, 
  Radio, 
  CheckCircle2, 
  AlertCircle,
  Truck
} from 'lucide-react';

interface LoginViewProps {
  users: User[];
  onLoginSuccess: (user: User) => void;
  onRegisterRequest: (user: Omit<User, 'id' | 'status' | 'createdAt'>) => void;
}

const ROLE_NAMES = {
  supervisor_cd: 'Supervisor CD',
  expedition: 'Expedição',
  central: 'Central de Monitoramento',
  audit: 'Auditoria de Gate',
  analysis: 'Análise de Dados',
  portaria: 'Portaria',
  store_app: 'App Loja'
};

export const LoginView: React.FC<LoginViewProps> = ({ users, onLoginSuccess, onRegisterRequest }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [registerRole, setRegisterRole] = useState<'supervisor_cd' | 'expedition' | 'central' | 'audit' | 'analysis' | 'portaria' | 'store_app'>('supervisor_cd');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [storeLocation, setStoreLocation] = useState('');
  const [jobFunction, setJobFunction] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const normalize = (str: string) => {
    return str.trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const handleFillMaster = () => {
    setUsername('Cleiton');
    setPassword('361485');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (mode === 'login') {
      if (!username || !password) {
        setError('Por favor, preencha todos os campos.');
        return;
      }

      const normalizedInputUsername = normalize(username);
      const user = users.find(u => normalize(u.username) === normalizedInputUsername);
      
      if (user) {
        if (user.password !== password) {
          setError('Senha incorreta. Verifique suas credenciais.');
          return;
        }

        if (user.status === 'active') {
          onLoginSuccess(user);
        } else if (user.status === 'pending') {
          setError('Seu cadastro ainda está aguardando aprovação da Auditoria.');
        } else {
          setError('Seu cadastro foi rejeitado pela Auditoria.');
        }
      } else {
        setError(`Usuário "${username}" não encontrado no sistema.`);
      }
    } else {
      // Register request
      if (!username || !password || !fullName || !storeLocation || !jobFunction) {
        setError('Por favor, preencha todos os campos para solicitação.');
        return;
      }

      const normalizedInputUsername = normalize(username);
      const exists = users.find(u => normalize(u.username) === normalizedInputUsername);
      
      if (exists) {
        setError('Este nome de usuário já está em uso.');
        return;
      }

      onRegisterRequest({
        username,
        password,
        fullName,
        storeLocation,
        jobFunction,
        role: registerRole,
      });
      setSuccess('Solicitação enviada! Aguarde a liberação do seu acesso.');
      setMode('login');
      setPassword('');
      setFullName('');
      setStoreLocation('');
      setJobFunction('');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-[#060813]">
      
      {/* ============================================================ */}
      {/* ANIMATED LOGISTICS TRACKING MAP BACKGROUND (CSS & SVG)       */}
      {/* ============================================================ */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        {/* Subtle radial ambient gradients */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[140px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[700px] h-[700px] bg-amber-500/10 rounded-full blur-[160px]" />
        
        {/* Grid pattern background */}
        <div 
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '48px 48px'
          }}
        />

        {/* SVG Animated Logistics Routes, Nodes & Radar Sweeps */}
        <svg 
          className="w-full h-full absolute inset-0 opacity-80" 
          viewBox="0 0 1440 900" 
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            {/* Gradients */}
            <radialGradient id="radarSweepGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D4AF37" stopOpacity="0.4" />
              <stop offset="60%" stopColor="#3b82f6" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
            </radialGradient>
            
            <linearGradient id="routeGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>

            <linearGradient id="routeGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#D4AF37" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>

            {/* Glowing filter */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Highway Route Paths */}
            <path id="path_cd_sia" d="M 720 540 C 680 460, 560 410, 490 320" />
            <path id="path_cd_aguas" d="M 720 540 C 620 520, 480 500, 380 430" />
            <path id="path_cd_ceilandia" d="M 720 540 C 580 550, 420 480, 260 370" />
            <path id="path_cd_taguatinga" d="M 720 540 C 600 530, 450 490, 320 410" />
            <path id="path_cd_guara" d="M 720 540 C 660 480, 580 430, 520 370" />
            <path id="path_cd_jardim" d="M 720 540 C 800 510, 880 470, 960 430" />
            <path id="path_cd_sobradinho" d="M 720 540 C 780 420, 840 310, 920 220" />
            <path id="path_cd_luziania" d="M 720 540 C 750 630, 820 720, 890 810" />
            <path id="path_cd_novogama" d="M 720 540 C 650 620, 560 700, 510 770" />
            <path id="path_cd_formosa" d="M 720 540 C 850 440, 1020 350, 1160 260" />
            <path id="path_cd_itumbiara" d="M 720 540 C 630 670, 480 780, 360 840" />
          </defs>

          {/* Radar Circles centered around CD Santa Maria (720, 540) */}
          <g opacity="0.35">
            <circle cx="720" cy="540" r="120" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 6" />
            <circle cx="720" cy="540" r="260" fill="none" stroke="#38bdf8" strokeWidth="1" strokeDasharray="6 8" />
            <circle cx="720" cy="540" r="420" fill="none" stroke="#D4AF37" strokeWidth="1.2" strokeDasharray="8 12" />
            <circle cx="720" cy="540" r="600" fill="none" stroke="#3b82f6" strokeWidth="1" strokeDasharray="5 10" />
            <circle cx="720" cy="540" r="800" fill="none" stroke="#6366f1" strokeWidth="1" strokeDasharray="8 14" />
            
            {/* Crosshair grid lines */}
            <line x1="720" y1="0" x2="720" y2="900" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="6 6" />
            <line x1="0" y1="540" x2="1440" y2="540" stroke="#3b82f6" strokeWidth="0.8" strokeDasharray="6 6" />
          </g>

          {/* Sweeping Radar Beam */}
          <g>
            <circle cx="720" cy="540" r="580" fill="none" />
            <path d="M 720 540 L 1300 540 A 580 580 0 0 0 1130 130 Z" fill="url(#radarSweepGrad)" opacity="0.45">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 720 540"
                to="360 720 540"
                dur="9s"
                repeatCount="indefinite"
              />
            </path>
            {/* Leading laser line */}
            <line x1="720" y1="540" x2="1300" y2="540" stroke="#D4AF37" strokeWidth="2" filter="url(#glow)">
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 720 540"
                to="360 720 540"
                dur="9s"
                repeatCount="indefinite"
              />
            </line>
          </g>

          {/* Route Vectors - Background lines */}
          <g strokeWidth="2" fill="none" opacity="0.4">
            <path d="M 720 540 C 680 460, 560 410, 490 320" stroke="#38bdf8" />
            <path d="M 720 540 C 620 520, 480 500, 380 430" stroke="#38bdf8" />
            <path d="M 720 540 C 580 550, 420 480, 260 370" stroke="#38bdf8" />
            <path d="M 720 540 C 600 530, 450 490, 320 410" stroke="#38bdf8" />
            <path d="M 720 540 C 660 480, 580 430, 520 370" stroke="#38bdf8" />
            <path d="M 720 540 C 800 510, 880 470, 960 430" stroke="#38bdf8" />
            <path d="M 720 540 C 780 420, 840 310, 920 220" stroke="#38bdf8" />
            <path d="M 720 540 C 750 630, 820 720, 890 810" stroke="#38bdf8" />
            <path d="M 720 540 C 650 620, 560 700, 510 770" stroke="#38bdf8" />
            <path d="M 720 540 C 850 440, 1020 350, 1160 260" stroke="#38bdf8" />
            <path d="M 720 540 C 630 670, 480 780, 360 840" stroke="#38bdf8" />
          </g>

          {/* Animated Glowing Transit Flow (Dashed light pulses traveling along routes) */}
          <g strokeWidth="2.5" fill="none" filter="url(#glow)">
            <path 
              d="M 720 540 C 680 460, 560 410, 490 320" 
              stroke="#D4AF37" 
              strokeDasharray="14 36"
            >
              <animate attributeName="stroke-dashoffset" values="500;0" dur="4s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 620 520, 480 500, 380 430" 
              stroke="#38bdf8" 
              strokeDasharray="18 40"
            >
              <animate attributeName="stroke-dashoffset" values="500;0" dur="4.8s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 580 550, 420 480, 260 370" 
              stroke="#10b981" 
              strokeDasharray="20 50"
            >
              <animate attributeName="stroke-dashoffset" values="600;0" dur="5.5s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 780 420, 840 310, 920 220" 
              stroke="#D4AF37" 
              strokeDasharray="15 45"
            >
              <animate attributeName="stroke-dashoffset" values="0;600" dur="5s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 750 630, 820 720, 890 810" 
              stroke="#38bdf8" 
              strokeDasharray="16 42"
            >
              <animate attributeName="stroke-dashoffset" values="500;0" dur="4.2s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 650 620, 560 700, 510 770" 
              stroke="#fbbf24" 
              strokeDasharray="14 38"
            >
              <animate attributeName="stroke-dashoffset" values="0;500" dur="3.8s" repeatCount="indefinite" />
            </path>
            <path 
              d="M 720 540 C 850 440, 1020 350, 1160 260" 
              stroke="#a855f7" 
              strokeDasharray="16 46"
            >
              <animate attributeName="stroke-dashoffset" values="600;0" dur="6s" repeatCount="indefinite" />
            </path>
          </g>

          {/* Animated Moving Cargo Trucks / Delivery Markers */}
          {/* Truck 1: CD -> SIA */}
          <g>
            <circle r="6" fill="#D4AF37" filter="url(#glow)">
              <animate attributeName="opacity" values="0.7;1;0.7" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle r="14" fill="none" stroke="#D4AF37" strokeWidth="1" opacity="0.6">
              <animate attributeName="r" values="6;20" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
            </circle>
            <animateMotion dur="6.5s" repeatCount="indefinite" rotate="auto">
              <mpath href="#path_cd_sia" />
            </animateMotion>
          </g>

          {/* Truck 2: CD -> Ceilândia */}
          <g>
            <circle r="5" fill="#38bdf8" filter="url(#glow)" />
            <circle r="12" fill="none" stroke="#38bdf8" strokeWidth="1">
              <animate attributeName="r" values="5;18" dur="1.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="1.3s" repeatCount="indefinite" />
            </circle>
            <animateMotion dur="8s" repeatCount="indefinite" rotate="auto">
              <mpath href="#path_cd_ceilandia" />
            </animateMotion>
          </g>

          {/* Truck 3: CD -> Águas Claras */}
          <g>
            <circle r="5.5" fill="#10b981" filter="url(#glow)" />
            <animateMotion dur="7s" repeatCount="indefinite" rotate="auto">
              <mpath href="#path_cd_aguas" />
            </animateMotion>
          </g>

          {/* Truck 4: Sobradinho -> CD (Return / Reversa) */}
          <g>
            <circle r="5" fill="#fbbf24" filter="url(#glow)" />
            <animateMotion dur="7.5s" repeatCount="indefinite" rotate="auto" keyPoints="1;0" keyTimes="0;1">
              <mpath href="#path_cd_sobradinho" />
            </animateMotion>
          </g>

          {/* Truck 5: CD -> Luziânia */}
          <g>
            <circle r="5" fill="#f43f5e" filter="url(#glow)" />
            <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
              <mpath href="#path_cd_luziania" />
            </animateMotion>
          </g>

          {/* Truck 6: Formosa -> CD */}
          <g>
            <circle r="5" fill="#a855f7" filter="url(#glow)" />
            <animateMotion dur="9s" repeatCount="indefinite" rotate="auto">
              <mpath href="#path_cd_formosa" />
            </animateMotion>
          </g>

          {/* Logistics Hubs & Warehouses (Pulse points) */}
          {/* Main Central Hub: CD-01 & CD-02 Santa Maria */}
          <g transform="translate(720, 540)">
            <circle r="36" fill="rgba(212, 175, 55, 0.15)" stroke="#D4AF37" strokeWidth="1" strokeDasharray="3 3" />
            <circle r="22" fill="#14112e" stroke="#D4AF37" strokeWidth="2.5" filter="url(#glow)" />
            <circle r="8" fill="#D4AF37">
              <animate attributeName="r" values="7;10;7" dur="2s" repeatCount="indefinite" />
            </circle>
            <text x="28" y="5" fill="#D4AF37" fontSize="13" fontWeight="900" fontFamily="monospace" letterSpacing="1">
              HUB CD-01 / CD-02 [SANTA MARIA]
            </text>
            <text x="28" y="22" fill="#94a3b8" fontSize="9" fontWeight="700" fontFamily="monospace">
              STATUS: BASE DE OPERAÇÕES LOGÍSTICAS
            </text>
          </g>

          {/* Branch Nodes */}
          {[
            { x: 490, y: 320, name: 'SIA 1007', code: 'DF-07' },
            { x: 380, y: 430, name: 'ÁGUAS CLARAS 1028', code: 'DF-28' },
            { x: 260, y: 370, name: 'CEILÂNDIA 1032', code: 'DF-32' },
            { x: 320, y: 410, name: 'TAGUATINGA 1008', code: 'DF-08' },
            { x: 520, y: 370, name: 'GUARÁ 1029', code: 'DF-29' },
            { x: 960, y: 430, name: 'JARDIM BOTÂNICO 1042', code: 'DF-42' },
            { x: 920, y: 220, name: 'SOBRADINHO 0701004', code: 'DF-04' },
            { x: 890, y: 810, name: 'LUZIÂNIA 1013', code: 'GO-13' },
            { x: 510, y: 770, name: 'NOVO GAMA 1025', code: 'GO-25' },
            { x: 1160, y: 260, name: 'FORMOSA 1063', code: 'GO-63' },
            { x: 360, y: 840, name: 'ITUMBIARA 1064', code: 'GO-64' },
          ].map((hub, idx) => (
            <g key={idx} transform={`translate(${hub.x}, ${hub.y})`}>
              <circle r="14" fill="#0b0f19" stroke="#38bdf8" strokeWidth="1.5" />
              <circle r="4" fill="#38bdf8">
                <animate attributeName="opacity" values="0.4;1;0.4" dur={`${1.6 + (idx % 3) * 0.4}s`} repeatCount="indefinite" />
              </circle>
              <text x="18" y="4" fill="#cbd5e1" fontSize="10" fontWeight="700" fontFamily="monospace">
                {hub.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Live Telemetry HUD Bar (Top) */}
        <div className="absolute top-0 left-0 right-0 px-6 py-3 flex items-center justify-between border-b border-blue-500/15 bg-slate-950/40 backdrop-blur-md text-[10px] font-mono text-slate-400">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
              RADAR OPERACIONAL ONLINE
            </span>
            <span className="hidden md:inline-block text-slate-500">|</span>
            <span className="hidden md:flex items-center gap-1 text-slate-300">
              <Navigation className="w-3 h-3 text-primary-gold" />
              COORDENADAS: 15°47'38"S 47°52'58"W [CD-01]
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-primary-gold font-bold">
              TRANSMISSÃO CRIPTO-SEGURA SSL/TLS
            </span>
            <span className="text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-700/60">
              v2.8 CONTROL
            </span>
          </div>
        </div>

        {/* Live Telemetry Ticker (Bottom) */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-2.5 flex items-center justify-between border-t border-blue-500/15 bg-slate-950/50 backdrop-blur-md text-[9.5px] font-mono text-slate-400">
          <div className="flex items-center gap-3">
            <Radio className="w-3.5 h-3.5 text-primary-gold animate-pulse" />
            <span className="text-slate-300">
              SISTEMA INTEGRADO DE PREVENÇÃO DE PERDAS & CONTROLE DE LACRES
            </span>
          </div>
          <div className="text-right hidden sm:block text-slate-400">
            GRUPO DIA A DIA • MONITORAMENTO 24H
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* OVERLAID CENTERED LOGIN FORM (GLASSMORPHISM CARD)           */}
      {/* ============================================================ */}
      <div className="relative z-10 w-full max-w-md my-8">
        <div className="relative backdrop-blur-2xl bg-[#0c1022]/85 border border-white/15 rounded-3xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.95),0_0_35px_rgba(212,175,55,0.22)] overflow-hidden transition-all duration-300">
          
          {/* Top golden accent ribbon */}
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-600 via-primary-gold to-yellow-300 shadow-[0_0_15px_rgba(212,175,55,0.8)]" />

          {/* Brand Header with New 3D CargaRadar Logo */}
          <div className="p-7 pb-4 text-center relative">
            
            {/* The New CargaRadar Logo Emblem */}
            <div className="relative w-36 h-36 mx-auto mb-4 rounded-full bg-white keep-white p-1 shadow-[0_0_35px_rgba(212,175,55,0.45)] border-4 border-primary-gold flex items-center justify-center overflow-hidden group hover:scale-105 transition-transform duration-300">
              <img 
                src="/assets/aistudio/Gemini_Generated_Image_cqe2acqe2acqe2ac_fa8d184d.jpg" 
                alt="Logo CargaRadar" 
                className="w-full h-full object-contain rounded-full select-none"
                onError={(e) => {
                  e.currentTarget.src = '/logo.png';
                }}
              />
            </div>

            <h1 className="text-2xl font-black text-white tracking-tight uppercase flex items-center justify-center gap-2">
              <span>CARGARADAR</span>
            </h1>

            <p className="text-[10.5px] font-black uppercase tracking-[0.25em] text-primary-gold mt-1">
              {mode === 'login' ? 'Torre de Controle & Liberação' : 'Solicitação de Acesso Operacional'}
            </p>

            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-500/30 text-[9px] font-mono text-blue-300 font-bold uppercase tracking-wider">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
              SISTEMA DE PREVENÇÃO DE PERDAS
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-7 pb-7 pt-2 space-y-4">
            
            {/* Error Message */}
            {error && (
              <div className="bg-red-950/70 border border-red-500/60 text-red-200 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm shadow-lg">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 px-4 py-3 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 backdrop-blur-sm shadow-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            {/* Register Fields */}
            {mode === 'register' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary-gold" />
                    Área de Atuação
                  </label>
                  <select
                    value={registerRole}
                    onChange={(e) => setRegisterRole(e.target.value as any)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all cursor-pointer shadow-inner"
                  >
                    {Object.entries(ROLE_NAMES).map(([key, value]) => (
                      <option key={key} value={key} className="bg-slate-900 text-white font-medium">
                        {value}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-primary-gold" />
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all placeholder:text-slate-500 placeholder:font-normal shadow-inner"
                    placeholder="Digite seu nome completo"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary-gold" />
                    {registerRole === 'store_app' ? 'Loja Vinculada (App Loja)' : 'Loja / Unidade Locado'}
                  </label>
                  <select
                    value={storeLocation}
                    onChange={(e) => setStoreLocation(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all cursor-pointer shadow-inner"
                    required
                  >
                    <option value="" className="bg-slate-900 text-slate-400">Selecione a Unidade / Loja...</option>
                    {STORE_LOCATIONS_BY_REGION.map(group => (
                      <optgroup key={group.region} label={group.region} className="bg-slate-950 font-bold text-primary-gold">
                        {group.stores.map(store => (
                          <option key={store} value={store} className="bg-slate-900 text-white font-medium">
                            {store}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-primary-gold" />
                    Função Operacional
                  </label>
                  <input
                    type="text"
                    value={jobFunction}
                    onChange={(e) => setJobFunction(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all placeholder:text-slate-500 placeholder:font-normal shadow-inner"
                    placeholder="Ex: Conferente de Expedição"
                    required
                  />
                </div>
              </>
            )}

            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-200 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <UserIcon className="w-3.5 h-3.5 text-primary-gold" />
                  Usuário
                </span>
                {mode === 'login' && (
                  <button 
                    type="button" 
                    onClick={handleFillMaster}
                    className="text-[9.5px] text-primary-gold/90 hover:text-primary-gold font-bold underline transition-colors"
                  >
                    Preencher Master Cleiton
                  </button>
                )}
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3.5 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all placeholder:text-slate-500 placeholder:font-normal shadow-inner"
                placeholder="Ex: Cleiton"
                autoComplete="username"
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary-gold" />
                Senha de Acesso
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3.5 pr-11 text-sm font-bold text-white focus:ring-2 focus:ring-primary-gold focus:border-primary-gold outline-none transition-all placeholder:text-slate-500 placeholder:font-normal shadow-inner"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  title={showPassword ? "Ocultar senha" : "Ver senha"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-2 bg-gradient-to-r from-amber-500 via-primary-gold to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-4 rounded-xl shadow-[0_10px_25px_-5px_rgba(212,175,55,0.4)] transition-all active:scale-[0.98] uppercase tracking-wider text-xs flex items-center justify-center gap-2 cursor-pointer border-b-2 border-amber-600"
            >
              <Shield className="w-4 h-4 text-slate-950" />
              <span>{mode === 'login' ? 'ENTRAR NO SISTEMA' : 'ENVIAR SOLICITAÇÃO'}</span>
            </button>

            {/* Toggle Mode Link */}
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                  setSuccess('');
                }}
                className="text-[10px] font-black text-slate-300 hover:text-primary-gold uppercase tracking-widest transition-colors cursor-pointer"
              >
                {mode === 'login' ? 'Não tem conta? Solicite cadastro' : 'Já tem conta? Faça login'}
              </button>
            </div>
          </form>

          {/* Card Footer with master user info note */}
          <div className="p-3.5 bg-slate-950/60 border-t border-slate-800/80 text-center">
            <p className="text-[9.5px] text-slate-400 font-mono tracking-tight">
              Acesso Master Administrador: <strong className="text-primary-gold font-bold">Cleiton</strong> • Senha: <strong className="text-primary-gold font-bold">361485</strong>
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
