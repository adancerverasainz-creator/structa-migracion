import React, { useState, useEffect } from 'react';
import { supabase } from '@/api/base44Client';

// ─── Formulario PÚBLICO de pre-registro (sin sesión) ─────────────────────────
// Reemplaza al viejo forms.structa.mx (Base44). Accesible en /registro?programa=<id>
// (acepta también ?token=<id> por compatibilidad con links antiguos).
// Solo habla con dos RPCs públicos: programa_publico y registrar_prospecto.

const LOGO = 'https://swtrrldixeeecsmfseah.supabase.co/storage/v1/object/public/assets/logo-bia-transparente.png';

export default function Registro() {
  const params = new URLSearchParams(window.location.search);
  const programId = params.get('programa') || params.get('token');

  const [programa, setPrograma] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState('');
  const [f, setF] = useState({ full_name: '', birth_date: '', parent_name: '', parent_phone: '', parent_email: '', notes: '' });
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      if (!programId) { setCargando(false); return; }
      const { data, error: err } = await supabase.rpc('programa_publico', { p_program_id: programId });
      if (!err && data && data.length) setPrograma(data[0]);
      setCargando(false);
    })();
  }, [programId]);

  const enviar = async (e) => {
    e.preventDefault();
    setError('');
    setEnviando(true);
    const { error: err } = await supabase.rpc('registrar_prospecto', {
      p_program_id: programId,
      p_full_name: f.full_name,
      p_birth_date: f.birth_date || null,
      p_parent_name: f.parent_name,
      p_parent_phone: f.parent_phone,
      p_parent_email: f.parent_email || null,
      p_notes: f.notes || null,
    });
    setEnviando(false);
    if (err) return setError(err.message);
    setEnviado(true);
  };

  const campo = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#004d98] focus:border-transparent';
  const etiqueta = 'block text-sm font-semibold text-gray-700 mb-1';

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Encabezado con identidad del club */}
      <header className="bg-gradient-to-r from-[#1a1a2e] via-[#a50044] to-[#004d98] text-white py-6 px-4">
        <div className="max-w-lg mx-auto flex items-center gap-4">
          <img src={LOGO} alt="BIA" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-xl font-bold">Barcelona Inter Academy</h1>
            <p className="text-white/80 text-sm">Formulario de pre-registro</p>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow-lg p-6 sm:p-8">
          {cargando ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#004d98]"></div>
            </div>
          ) : !programId || !programa ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-4xl">⚽</p>
              <h2 className="text-lg font-bold text-gray-800">Este link no está disponible</h2>
              <p className="text-gray-500 text-sm">El programa ya no está activo o el enlace es incorrecto. Contacta al club para recibir un link vigente.</p>
            </div>
          ) : enviado ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-4xl">✅</p>
              <h2 className="text-lg font-bold text-gray-800">¡Registro recibido!</h2>
              <p className="text-gray-500 text-sm">Gracias por tu interés en <b>{programa.name}</b>. El club se pondrá en contacto contigo muy pronto.</p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900">{programa.name}</h2>
                {programa.description && <p className="text-gray-500 text-sm mt-1">{programa.description}</p>}
              </div>
              <form onSubmit={enviar} className="space-y-4">
                <div>
                  <label className={etiqueta}>Nombre completo del jugador *</label>
                  <input className={campo} value={f.full_name} onChange={e => set('full_name', e.target.value)} required maxLength={120} />
                </div>
                <div>
                  <label className={etiqueta}>Fecha de nacimiento del jugador</label>
                  <input type="date" className={campo} value={f.birth_date} onChange={e => set('birth_date', e.target.value)} />
                </div>
                <div>
                  <label className={etiqueta}>Nombre del padre o tutor *</label>
                  <input className={campo} value={f.parent_name} onChange={e => set('parent_name', e.target.value)} required maxLength={120} />
                </div>
                <div>
                  <label className={etiqueta}>Teléfono de contacto *</label>
                  <input type="tel" className={campo} placeholder="998 123 4567" value={f.parent_phone} onChange={e => set('parent_phone', e.target.value)} required />
                </div>
                <div>
                  <label className={etiqueta}>Correo electrónico</label>
                  <input type="email" className={campo} value={f.parent_email} onChange={e => set('parent_email', e.target.value)} maxLength={160} />
                </div>
                <div>
                  <label className={etiqueta}>Comentarios</label>
                  <textarea className={campo} rows={3} maxLength={500} placeholder="Edad, experiencia, dudas..." value={f.notes} onChange={e => set('notes', e.target.value)} />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg px-3 py-2 text-sm">{error}</div>
                )}
                <button type="submit" disabled={enviando}
                  className="w-full bg-[#004d98] hover:bg-[#003d78] text-white font-semibold rounded-lg py-3 transition-colors disabled:opacity-60">
                  {enviando ? 'Enviando...' : 'Enviar pre-registro'}
                </button>
                <p className="text-[11px] text-gray-400 text-center">Al enviar aceptas que el club te contacte con información del programa.</p>
              </form>
            </>
          )}
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        © 2026 Barcelona Inter Academy · Powered by Structa
      </footer>
    </div>
  );
}
