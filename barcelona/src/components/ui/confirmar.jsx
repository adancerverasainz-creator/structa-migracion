import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

/**
 * Diálogo de confirmación del ERP — reemplaza al confirm() nativo del navegador.
 * Uso: const ok = await confirmar('¿Eliminar este pago?');
 * Debe estar montado <ConfirmarHost /> una sola vez (App.jsx).
 */
let _resolver = null;
let _setState = null;

export function confirmar(mensaje, opts = {}) {
  return new Promise((resolve) => {
    if (!_setState) { resolve(window.confirm(mensaje)); return; } // fallback si el host no está montado
    _resolver = resolve;
    _setState({
      open: true,
      mensaje,
      titulo: opts.titulo || 'Confirmar acción',
      confirmLabel: opts.confirmLabel || 'Sí, continuar',
      cancelLabel: opts.cancelLabel || 'Cancelar',
    });
  });
}

export function ConfirmarHost() {
  const [state, setState] = useState({ open: false });
  useEffect(() => {
    _setState = setState;
    return () => { _setState = null; };
  }, []);

  const close = (val) => {
    setState({ open: false });
    const r = _resolver; _resolver = null;
    r?.(val);
  };

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e) => { if (e.key === 'Escape') close(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open]);

  if (!state.open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={() => close(false)}>
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog" aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 bg-red-50 rounded-full shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900 text-lg">{state.titulo}</h3>
            <p className="text-sm text-gray-600 mt-1 break-words">{state.mensaje}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => close(false)}>{state.cancelLabel}</Button>
          <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={() => close(true)}>
            {state.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
