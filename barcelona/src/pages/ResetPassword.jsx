// Restablecer contraseña — destino del enlace de recuperación de Supabase Auth
import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // El enlace de recuperación autentica la sesión al cargar (detectSessionInUrl)
    supabase.auth.getSession().then(({ data: { session } }) => setReady(!!session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setReady(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setDone(true);
    setTimeout(() => { window.location.href = '/'; }, 1800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-red-900 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900">Barcelona Inter Academy</h1>
          <p className="text-slate-500 mt-1 text-sm">Crea tu nueva contraseña</p>
        </div>
        {done ? (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-3 text-center">
            ✓ Contraseña guardada. Entrando al sistema…
          </p>
        ) : !ready ? (
          <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-3 text-center">
            Abre esta página desde el enlace de recuperación que te llegó por correo.
            Si el enlace expiró, pide uno nuevo desde "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
              <input type="password" required autoComplete="new-password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
              <input type="password" required autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-600" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full bg-blue-900 hover:bg-blue-800 text-white font-semibold rounded-lg py-2.5 transition disabled:opacity-60">
              {loading ? 'Guardando…' : 'Guardar contraseña y entrar'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
