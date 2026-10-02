import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(undefined) // undefined = loading
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    async function loadProfile(s) {
      setSession(s)
      if (s) {
        const { data } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, organization_id')
          .eq('id', s.user.id)
          .single()
        setProfile(data ?? null)
      } else {
        setProfile(null)
      }
    }

    supabase.auth.getSession().then(({ data }) => loadProfile(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => loadProfile(s))
    return () => subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    const { data: { session: s } } = await supabase.auth.getSession()
    if (s) {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, organization_id')
        .eq('id', s.user.id)
        .single()
      setProfile(data ?? null)
    }
  }

  return (
    <ProfileContext.Provider value={{
      profile,
      session,
      role: profile?.role ?? null,
      organizationId: profile?.organization_id ?? null,
      isLoading: profile === undefined || session === undefined,
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
