import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(undefined)   // undefined = cargando
  const [session, setSession] = useState(undefined)
  const [profileError, setProfileError] = useState(null) // BAJO: distinguir error vs sin perfil

  async function loadProfile(s) {
    setSession(s)
    setProfileError(null)
    if (s) {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, organization_id, org_name, contact_phone')
          .eq('id', s.user.id)
          .single()
        if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows (perfil aún no creado por trigger), no es un error real
          setProfileError(error)
          setProfile(null)
        } else {
          setProfile(data ?? null)
        }
      } catch (err) {
        setProfileError(err)
        setProfile(null)
      }
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => loadProfile(s))
    return () => subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, organization_id, org_name, contact_phone')
        .eq('id', s.user.id)
        .single()
      if (!error) setProfile(data ?? null)
    }
  }

  return (
    <ProfileContext.Provider value={{
      profile,
      session,
      role: profile?.role ?? null,
      organizationId: profile?.organization_id ?? null,
      isLoading: profile === undefined || session === undefined,
      profileError,
      refreshProfile,
    }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
