import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44, supabase } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Compatibilidad con la app original (Base44 los usaba para settings públicos)
  const [isLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings] = useState(null);

  useEffect(() => {
    let mounted = true;

    const loadUser = async (session) => {
      if (!session) {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: 'Authentication required' });
          setIsLoadingAuth(false);
        }
        return;
      }
      try {
        const me = await base44.auth.me();
        if (mounted) {
          setUser(me);
          setIsAuthenticated(true);
          setAuthError(null);
          setIsLoadingAuth(false);
        }
      } catch (e) {
        if (mounted) {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError({ type: 'auth_required', message: e.message });
          setIsLoadingAuth(false);
        }
      }
    };

    supabase.auth.getSession().then(({ data: { session } }) => loadUser(session));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadUser(session);
    });

    return () => { mounted = false; subscription?.unsubscribe(); };
  }, []);

  const logout = async () => {
    setUser(null);
    setIsAuthenticated(false);
    await base44.auth.logout();
  };

  const navigateToLogin = () => base44.auth.redirectToLogin();

  const checkAppState = () => {}; // compat no-op

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      logout,
      navigateToLogin,
      checkAppState,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
