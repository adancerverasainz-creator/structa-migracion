import React, { useEffect, useState } from 'react';
import { supabase } from '@/api/base44Client';

// Página PÚBLICA de verificación de vales (QR): /Verificar?id=<uuid>
// No requiere sesión. Muestra solo lo que la RPC verificar_movimiento expone:
// tipo, fecha, monto, concepto, método y estado — nunca datos personales.

const LOGO_URL = 'https://swtrrldixeeecsmfseah.supabase.co/storage/v1/object/public/assets/logo-bia-transparente.png';

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fecha = (f) => {
  try { return new Date(String(f).slice(0, 10) + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' }); }
  catch { return String(f || ''); }
};
const METODOS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

export default function Verificar() {
  const [estado, setEstado] = useState('cargando'); // cargando | ok | reversado | no | error
  const [mov, setMov] = useState(null);
  const [club, setClub] = useState({ nombre: 'Barcelona Inter Academy', logo_url: LOGO_URL });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) { setEstado('no'); return; }
    supabase.rpc('verificar_movimiento', { p_id: id })
      .then(({ data, error }) => {
        if (error) { setEstado('error'); return; }
        if (data?.club?.nombre) setClub((c) => ({ ...c, ...data.club }));
        if (!data?.encontrado) { setEstado('no'); return; }
        setMov(data);
        setEstado(data.estado === 'REVERSADO' ? 'reversado' : 'ok');
      })
      .catch(() => setEstado('error'));
  }, []);

  const Sello = () => {
    if (estado === 'ok') return (
      <div className="flex flex-col items-center gap-1 text-green-600">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-4xl">✓</div>
        <p className="font-bold text-lg">Movimiento verificado</p>
        <p className="text-sm text-gray-600">Registrado en el sistema y vigente</p>
      </div>
    );
    if (estado === 'reversado') return (
      <div className="flex flex-col items-center gap-1 text-amber-600">
        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center text-4xl">↩</div>
        <p className="font-bold text-lg">Movimiento reversado</p>
        <p className="text-sm text-gray-600">Este vale existió pero fue anulado con un contra-movimiento</p>
      </div>
    );
    if (estado === 'no') return (
      <div className="flex flex-col items-center gap-1 text-red-600">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center text-4xl">✕</div>
        <p className="font-bold text-lg">No encontrado</p>
        <p className="text-sm text-gray-600">Este vale no corresponde a ningún movimiento registrado</p>
      </div>
    );
    if (estado === 'error') return (
      <div className="flex flex-col items-center gap-1 text-gray-600">
        <p className="font-bold text-lg">No se pudo verificar</p>
        <p className="text-sm">Intenta de nuevo en unos momentos</p>
      </div>
    );
    return (
      <div className="flex flex-col items-center gap-2 text-gray-500">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin"></div>
        <p className="text-sm">Verificando…</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-lg border border-gray-100 p-6 text-center space-y-5">
        <div>
          <img src={club.logo_url} alt="" className="w-16 h-16 object-contain mx-auto mb-1" onError={(e) => { e.target.style.display = 'none'; }} />
          <h1 className="font-bold text-gray-900">{club.nombre}</h1>
          <p className="text-xs text-gray-400 uppercase tracking-widest">Verificación de vale de caja</p>
        </div>

        <Sello />

        {mov && (
          <div className="text-left border-t border-gray-100 pt-4 space-y-2 text-sm">
            {mov.folio && (
              <div className="flex justify-between"><span className="text-gray-500">Folio</span><span className="font-bold tracking-wider">{mov.folio}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">Tipo</span><span className="font-semibold">{mov.tipo}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Fecha</span><span className="font-semibold">{fecha(mov.fecha)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Concepto</span><span className="font-semibold text-right ml-4">{mov.concepto}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Método</span><span className="font-semibold">{METODOS[mov.metodo] || mov.metodo}</span></div>
            <div className="flex justify-between text-base border-t border-gray-100 pt-2"><span className="text-gray-500">Monto</span><span className="font-bold">{money(mov.monto)}</span></div>
          </div>
        )}

        <p className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
          Esta verificación confirma el registro del movimiento en el sistema del club.
          No es comprobante fiscal. Powered by Structa.
        </p>
      </div>
    </div>
  );
}
