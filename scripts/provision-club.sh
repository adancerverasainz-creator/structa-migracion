#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
# Structa ERP — Clubes Deportivos · Aprovisionamiento de club nuevo
# ══════════════════════════════════════════════════════════════════════
# Levanta una instancia completa (modelo instancia-por-club) en un comando:
#   1. Proyecto Supabase nuevo con el esquema del ERP
#   2. Semillas de configuración (cuentas, catálogo, precios, permisos)
#   3. Usuario administrador inicial
#   4. Proyecto Vercel conectado al repo (carpeta barcelona/)
#
# Requisitos (una sola vez en la máquina del operador):
#   npm i -g supabase vercel
#   supabase login          # cuenta de Structa
#   vercel login            # cuenta de Structa
#
# Uso:
#   ./scripts/provision-club.sh "nombre-del-club" "admin@club.com" "dominio.club.mx"
# ══════════════════════════════════════════════════════════════════════
set -euo pipefail

CLUB_SLUG="${1:?Uso: provision-club.sh <slug-club> <email-admin> <dominio>}"
ADMIN_EMAIL="${2:?Falta email del admin}"
DOMAIN="${3:?Falta dominio (ej. club.structa.mx)}"
ORG_ID="${SUPABASE_ORG_ID:?Exporta SUPABASE_ORG_ID (org de Structa)}"
REGION="${SUPABASE_REGION:-us-west-2}"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=')"

echo "══ 1/5 · Creando proyecto Supabase: structa-${CLUB_SLUG}"
supabase projects create "structa-${CLUB_SLUG}" \
  --org-id "$ORG_ID" --region "$REGION" --db-password "$DB_PASS"

PROJECT_REF=$(supabase projects list -o json | \
  python3 -c "import sys,json; print([p['id'] for p in json.load(sys.stdin) if p['name']=='structa-${CLUB_SLUG}'][0])")
echo "   ref: $PROJECT_REF"

echo "══ 2/5 · Aplicando esquema del ERP"
# El esquema canónico se exporta del proyecto de referencia (BIA) con:
#   supabase db dump --project-ref swtrrldixeeecsmfseah --schema public -f supabase/schema.sql
# y se versiona en este repo. Aplica ese snapshot + semillas:
supabase db push --project-ref "$PROJECT_REF" || \
  psql "$(supabase projects api-keys get "$PROJECT_REF" --db-url)" -f supabase/schema.sql

echo "══ 3/5 · Semillas de configuración del club"
psql "postgresql://postgres:${DB_PASS}@db.${PROJECT_REF}.supabase.co:5432/postgres" <<'SQL'
-- Configuración mínima operable; el club la ajusta después en /Configuracion
insert into club_settings (key, value, updated_by) values
 ('late_fee', '{"amount":100,"cutoff_day":15,"enabled":true}', 'provision'),
 ('fees', '{"inscripcion_default":1800,"summer_week":1200,"inscripcion_montos":[1800],"reinscripcion_montos":[1800]}', 'provision')
on conflict (key) do nothing;
insert into bank_accounts (name, sort_order) values ('Efectivo bancario', 10) on conflict do nothing;
SQL

echo "══ 4/5 · Usuario administrador inicial ($ADMIN_EMAIL)"
supabase auth users create --project-ref "$PROJECT_REF" \
  --email "$ADMIN_EMAIL" --email-confirm true
# El perfil/rol admin se crea vía trigger on_auth_user_created (parte del esquema)

echo "══ 5/5 · Proyecto Vercel"
vercel project add "structa-${CLUB_SLUG}" || true
vercel link --project "structa-${CLUB_SLUG}" --yes
vercel env add VITE_SUPABASE_URL production <<< "https://${PROJECT_REF}.supabase.co"
vercel env add VITE_SUPABASE_ANON_KEY production <<< "$(supabase projects api-keys list --project-ref "$PROJECT_REF" -o json | python3 -c "import sys,json; print([k['api_key'] for k in json.load(sys.stdin) if k['name']=='anon'][0])")"
vercel domains add "$DOMAIN" || echo "   (configura el DNS del dominio manualmente)"
vercel deploy --prod --cwd barcelona

cat <<EOF

✅ Club aprovisionado
   Supabase : https://supabase.com/dashboard/project/${PROJECT_REF}
   App      : https://${DOMAIN}
   Admin    : ${ADMIN_EMAIL} (enviar enlace de recuperación para primer acceso)
   DB pass  : guardada solo en esta terminal — regístrala en el gestor de secretos

Pasos post-aprovisionamiento (manual, 5 min):
   1. Supabase → Auth → URL Configuration: Site URL = https://${DOMAIN}, Redirect = https://${DOMAIN}/**
   2. Supabase → Auth → Providers: desactivar signups públicos
   3. Entrar como admin → /Configuracion: cuentas bancarias, catálogo y precios reales del club
EOF
