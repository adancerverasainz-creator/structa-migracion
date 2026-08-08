// Adaptador de compatibilidad Base44 → Supabase.
// Mantiene la misma superficie que usaba el SDK de Base44
// (entities.X.list/filter/create/update/delete, auth.me/logout, functions.invoke)
// para que las 15 páginas existentes funcionen sin cambios.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://swtrrldixeeecsmfseah.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qO3UXosCPzJQD_7acKmsmA_r4-kkDXo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Entidad Base44 → tabla Supabase
const TABLE = {
  Player: 'players',
  ClubSetting: 'club_settings',
  RolePermission: 'role_permissions',
  UserPermission: 'user_permissions',
  Profile: 'profiles',
  DebtWaiver: 'debt_waivers',
  PreRegistro: 'pre_registrations',
  Tournament: 'tournaments',
  Team: 'teams',
  Match: 'matches',
  MatchPlayer: 'match_players',
  Payment: 'payments',
  TournamentAttendee: 'tournament_attendees',
  TournamentPayment: 'tournament_payments',
  Expense: 'expenses',
  CajaPrincipalExpense: 'caja_principal_expenses',
  GeneralPayment: 'general_payments',
  AccountPayable: 'accounts_payable',
  AccountPayablePayment: 'account_payable_payments',
  LeaguePayment: 'league_payments',
  SummerCampPayment: 'summer_camp_payments',
  SummerCampExternalPlayer: 'summer_camp_external_players',
  CashRegister: 'cash_registers',
  Program: 'programs',
  BankAccount: 'bank_accounts',
  PlayerPause: 'player_pauses',
  CatalogItem: 'catalog_items',
  AuditLog: 'audit_logs',
};

// El código legado usa created_date/updated_date (Base44); en Supabase son created_at/updated_at.
const SORT_ALIAS = { created_date: 'created_at', updated_date: 'updated_at' };

const fromDb = (row) => {
  if (!row) return row;
  return { ...row, created_date: row.created_at, updated_date: row.updated_at };
};

const toDb = (data) => {
  if (!data) return data;
  const out = { ...data };
  delete out.id;
  delete out.created_date;
  delete out.updated_date;
  delete out.created_at;
  delete out.updated_at;
  delete out.legacy_id;
  delete out.created_by_id;
  delete out.is_sample;
  // Campos vacíos de fecha/número rompen el tipado de Postgres
  for (const k of Object.keys(out)) if (out[k] === '') out[k] = null;
  return out;
};

// ── Motor de Idempotencia (capa cliente) ─────────────────────────────────────
// 1) Toda inserción en tablas de movimientos lleva op_key (índice único en BD).
// 2) Guarda anti doble-submit: una inserción idéntica lanzada mientras otra
//    igual está en vuelo (doble clic, doble invocación) reutiliza la misma
//    promesa en vez de duplicar el movimiento. La garantía final es la BD.
const MOVEMENT_TABLES = new Set([
  'payments', 'general_payments', 'tournament_payments', 'league_payments',
  'summer_camp_payments', 'expenses', 'account_payable_payments', 'cash_registers',
]);
const _inflight = new Map();
const _opHash = (table, payload) => {
  const { op_key, ...rest } = payload;
  return table + '|' + JSON.stringify(rest, Object.keys(rest).sort());
};

const parseSort = (sort) => {
  if (!sort) return null;
  const desc = sort.startsWith('-');
  const raw = desc ? sort.slice(1) : sort;
  return { column: SORT_ALIAS[raw] || raw, ascending: !desc };
};

function makeEntity(name) {
  const table = TABLE[name];
  if (!table) throw new Error(`Entidad desconocida: ${name}`);

  const runQuery = async (filterObj, sort, limit) => {
    let q = supabase.from(table).select('*');
    if (filterObj) {
      for (const [k, v] of Object.entries(filterObj)) {
        if (v === undefined) continue;
        if (v && typeof v === 'object' && '$in' in v) q = q.in(k, v.$in);
        else if (v === null) q = q.is(k, null);
        else q = q.eq(k, v);
      }
    }
    const s = parseSort(sort);
    if (s) q = q.order(s.column, { ascending: s.ascending });
    q = q.limit(limit && limit > 0 ? limit : 10000);
    const { data, error } = await q;
    if (error) throw new Error(`${name}.list: ${error.message}`);
    return (data || []).map(fromDb);
  };

  return {
    list: (sort, limit) => runQuery(null, sort, limit),
    filter: (filterObj, sort, limit) => runQuery(filterObj, sort, limit),
    get: async (id) => {
      const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(`${name}.get: ${error.message}`);
      return fromDb(data);
    },
    create: async (data) => {
      let payload = toDb(data);
      if (name === 'AuditLog') {
        for (const k of ['previous_value', 'new_value']) {
          const v = payload[k];
          if (typeof v === 'string') {
            try { payload[k] = JSON.parse(v); } catch { payload[k] = { _raw: v }; }
          }
        }
      }
      const { data: me } = await supabase.auth.getUser();
      if (me?.user?.email) payload.created_by = me.user.email;
      if (MOVEMENT_TABLES.has(table)) {
        const h = _opHash(table, payload);
        const prev = _inflight.get(h);
        if (prev && Date.now() - prev.t < 8000) return prev.promise; // doble submit → misma operación
        if (!payload.op_key && globalThis.crypto?.randomUUID) payload.op_key = crypto.randomUUID();
        const p = (async () => {
          const { data: row, error } = await supabase.from(table).insert(payload).select().single();
          if (error) throw new Error(`${name}.create: ${error.message}`);
          return fromDb(row);
        })();
        _inflight.set(h, { promise: p, t: Date.now() });
        p.catch(() => _inflight.delete(h)); // un fallo libera la guarda para reintentar
        p.finally(() => setTimeout(() => {
          const e = _inflight.get(h);
          if (e && e.promise === p) _inflight.delete(h);
        }, 8000));
        return p;
      }
      const { data: row, error } = await supabase.from(table).insert(payload).select().single();
      if (error) throw new Error(`${name}.create: ${error.message}`);
      return fromDb(row);
    },
    update: async (id, data) => {
      const payload = toDb(data);
      const { data: rows, error } = await supabase.from(table).update(payload).eq('id', id).select();
      if (error) throw new Error(`${name}.update: ${error.message}`);
      if (!rows || rows.length === 0) throw new Error('No tienes permiso para modificar este registro (o ya no existe). Pide el cambio a un administrador.');
      return fromDb(rows[0]);
    },
    delete: async (id) => {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw new Error(`${name}.delete: ${error.message}`);
      return { id };
    },
    bulkCreate: async (rows) => {
      const payloads = rows.map(toDb);
      const { data, error } = await supabase.from(table).insert(payloads).select();
      if (error) throw new Error(`${name}.bulkCreate: ${error.message}`);
      return (data || []).map(fromDb);
    },
  };
}

const entities = new Proxy({}, {
  get: (cache, name) => {
    if (typeof name !== 'string') return undefined;
    if (!cache[name]) cache[name] = makeEntity(name);
    return cache[name];
  },
});

function goToLogin() {
  if (import.meta.env.VITE_HASH_ROUTER === '1') {
    window.location.hash = '#/login';
    window.location.reload();
  } else {
    window.location.href = '/login';
  }
}

const auth = {
  // Devuelve el usuario con la forma que espera el código legado: { email, full_name, role }
  me: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw Object.assign(new Error('No autenticado'), { status: 401 });
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', user.id).maybeSingle();
    return {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || user.email,
      role: profile?.role || 'user',
    };
  },
  logout: async () => {
    await supabase.auth.signOut();
    goToLogin();
  },
  redirectToLogin: () => {
    const inLogin = window.location.pathname.startsWith('/login')
      || window.location.hash.toLowerCase().startsWith('#/login');
    if (!inLogin) goToLogin();
  },
};

const functions = {
  invoke: async (name, body) => {
    const { data, error } = await supabase.functions.invoke(name, { body: body ?? {} });
    if (error) throw new Error(`functions.${name}: ${error.message}`);
    return { data };
  },
};

// Telemetría interna de Base44 (NavigationTracker la invoca) — no-op en Supabase
const appLogs = {
  logUserInApp: async () => {},
};

export const base44 = { entities, auth, functions, appLogs, supabase };
