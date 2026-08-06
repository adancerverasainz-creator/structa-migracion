import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Banknote } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * Corte de Caja formal (Tesorería): cuenta el efectivo de la caja operativa,
 * entrega un monto en custodia a la caja Fondos (CEO) y deja acta inmutable.
 * Todo ocurre en una sola transacción (RPC corte_de_caja).
 */
export default function CorteCajaModal({ saldoEfectivo, onClose }) {
  const queryClient = useQueryClient();
  const [contado, setContado] = useState('');
  const [monto, setMonto] = useState('');
  const [recibe, setRecibe] = useState('Adan Cervera (CEO)');
  const [notas, setNotas] = useState('');

  const contadoNum = parseFloat(contado) || 0;
  const montoNum = parseFloat(monto) || 0;
  const diferencia = contado === '' ? null : contadoNum - (saldoEfectivo || 0);

  const corteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('corte_de_caja', {
        p_saldo_sistema: saldoEfectivo || 0,
        p_contado: contadoNum,
        p_monto: montoNum,
        p_recibe: recibe.trim(),
        p_notas: notas.trim() || null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success('Corte de Caja registrado — acta de custodia generada');
      ['cashRegisters', 'allExpensesForFondos', 'expenses', 'saldosPorCuenta', 'cajaCortes', 'cajaArqueos']
        .forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => toast.error(`No se pudo registrar el corte: ${e.message}`),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold text-lg text-gray-900 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-green-700" /> Corte de Caja — entrega en custodia
        </h3>
        <p className="text-xs text-gray-500">
          Cuenta el efectivo de la caja operativa y entrega el monto a la caja Fondos.
          Se genera un acta inmutable (quién entrega, quién recibe, cuánto y la diferencia del conteo).
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm flex justify-between">
          <span className="text-gray-600">Saldo de caja Efectivo según sistema:</span>
          <b>{formatCurrency(saldoEfectivo || 0)}</b>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Efectivo contado físicamente *</label>
          <Input type="number" min="0" step="0.01" value={contado}
            onChange={(e) => { setContado(e.target.value); if (monto === '' || monto === contado) setMonto(e.target.value); }}
            placeholder="0.00" />
          {diferencia !== null && (
            <p className={`text-xs mt-1 ${diferencia === 0 ? 'text-green-700' : diferencia > 0 ? 'text-amber-700' : 'text-red-700'}`}>
              {diferencia === 0 ? 'Caja cuadrada ✓' : diferencia > 0 ? `Sobrante: ${formatCurrency(diferencia)}` : `Faltante: ${formatCurrency(Math.abs(diferencia))}`}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Monto a entregar en custodia *</label>
          <Input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="0.00" />
          {montoNum > contadoNum && contado !== '' && (
            <p className="text-xs text-red-600 mt-1">No puedes entregar más de lo contado.</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Recibe en custodia *</label>
          <Input value={recibe} onChange={(e) => setRecibe(e.target.value)} placeholder="Nombre de quien recibe" />
        </div>

        <div>
          <label className="text-sm font-medium text-gray-700">Notas</label>
          <textarea className="w-full border rounded-md p-2 text-sm" rows={2} value={notas}
            onChange={(e) => setNotas(e.target.value)} placeholder="Ej. Corte semanal" />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button className="bg-green-700 hover:bg-green-800"
            disabled={corteMutation.isPending || contado === '' || montoNum <= 0 || montoNum > contadoNum || recibe.trim().length < 3}
            onClick={() => corteMutation.mutate()}>
            Registrar corte y entrega
          </Button>
        </div>
      </div>
    </div>
  );
}
