# Structa — Migración Base44 → Supabase

## barcelona/
ERP Club Barcelona Inter Academy portado a Supabase.
- Frontend Vite+React con adaptador de compatibilidad (src/api/base44Client.js)
- Auth Supabase (email/password) + RLS por rol (admin/editor/user)
- base44/: definiciones originales de entidades y funciones (referencia histórica)

Build: `npm install && npm run build`
Staging con hash-router: `VITE_HASH_ROUTER=1 npm run build`
Staging publicado: rama gh-pages → https://adancerverasainz-creator.github.io/structa-migracion/
