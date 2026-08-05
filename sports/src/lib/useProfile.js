import { useEffect, useState } from 'react'
import { supabase } from './supabase'

/**
 * Devuelve el perfil del usuario autenticado:
 *   { email, role, orgId, orgName, loading }
 *
 * - admin     → orgName = 'Structa Sports' (su org fija)
 * - org_admin → orgName = nombre de su organización
 * - editor    → orgName = null (no tiene org propia)
 */
export function useProfile() {
  const [profile, setProfile] = useState({
    email: '',
    role: '',
    orgId: null,
    orgName: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const { data: p } = await supabase
        .from('profiles')
        .select('role, organization_id')
        .eq('id', user.id)
        .single()

      if (cancelled) return

      let orgName = null
      if (p?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('name')
          .eq('id', p.organization_id)
          .single()
        orgName = org?.name ?? null
      }

      if (!cancelled) {
        setProfile({
          email: user.email ?? '',
          role: p?.role ?? '',
          orgId: p?.organization_id ?? null,
          orgName,
          loading: false,
        })
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return profile
}
