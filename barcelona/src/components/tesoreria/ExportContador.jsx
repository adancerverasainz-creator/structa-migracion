import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download } from 'lucide-react';
import { formatCurrency } from '../lib/formatCurrency';

/**
 * "Para el contador" (Tesorería): paquete mensual de ingresos y egresos
 * clasificados por concepto, categoría, método y cuenta. Exporta CSV
 * (compatible con Excel) listo para entregar al contador.
 */
export default function ExportContador({ payments = [], expenses = [] }) {
  const hoy = new Date();
  const [mes, setMes] = useState(`${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`);

  const enMes = (fecha) => (fecha || '').slice(0, 7) === mes;

  const ingresosMes = payments.filter(p => enMes(p.payment_date) && (!p.status || p.status === 'pagado'));
  const egresosMes = expenses.filter(e => enMes(e.expense_date));

  const totalIn = ingresosMes.reduce((s, p) => s + (p.paid_amount ?? p.amount ?? 0), 0);
  const totalOut = egresosMes.reduce((s, e) => s + (e.amount || 0), 0);

  const cuentaDe = (metodo, banco) => metodo === 'efectivo'
    ? (banco === 'Fondos' ? 'Caja Fondos' : 'Caja Efectivo')
    : metodo === 'tarjeta' ? 'Tarjeta' : (banco || 'Sin cuenta');

  const exportar = () => {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const filas = [
      ['Fecha', 'Tipo', 'Concepto', 'Categoría', 'Método', 'Cuenta', 'Monto'],
      ...ingresosMes.map(p => [
        (p.payment_date || '').slice(0, 10), 'Ingreso',
        `${p.payment_type || p.concept || 'Cobro'}${p.month ? ` ${p.month}` : ''}`,
        p.payment_type || 'cobro', p.payment_method || '',
        cuentaDe(p.payment_method, p.bank_name),
        (p.paid_amount ?? p.amount ?? 0),
      ]),
      ...egresosMes.map(e => [
        e.expense_date, 'Egreso', e.concept, e.category || 'otros',
        e.payment_method || '',
        cuentaDe(e.payment_method, e.account),
        -(e.amount || 0),
      ]),
    ];
    filas.push([]);
    filas.push(['', '', '', '', '', 'Total ingresos', totalIn]);
    filas.push(['', '', '', '', '', 'Total egresos', -totalOut]);
    filas.push(['', '', '', '', '', 'Neto del mes', totalIn - totalOut]);

    const csv = '﻿' + filas.map(f => f.map(esc).join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bia-contador-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSpreadsheet className="w-5 h-5 text-emerald-700" /> Paquete mensual para el contador
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Todos los ingresos y egresos del mes, clasificados por concepto, categoría, método y cuenta —
          listos para entregar a tu contador (abre directo en Excel).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Mes</label>
            <input type="month" className="border rounded-md p-2 text-sm" value={mes} onChange={(e) => setMes(e.target.value)} />
          </div>
          <Button onClick={exportar} className="bg-emerald-700 hover:bg-emerald-800"
            disabled={ingresosMes.length === 0 && egresosMes.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar mes ({ingresosMes.length + egresosMes.length} movimientos)
          </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Ingresos del mes</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIn)}</p>
            <p className="text-xs text-gray-400">{ingresosMes.length} movimientos</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Egresos del mes</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalOut)}</p>
            <p className="text-xs text-gray-400">{egresosMes.length} movimientos</p>
          </div>
          <div className="border rounded-lg p-3">
            <p className="text-xs text-gray-500">Neto del mes</p>
            <p className={`text-xl font-bold ${totalIn - totalOut >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{formatCurrency(totalIn - totalOut)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
