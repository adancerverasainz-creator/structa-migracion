// Salud Financiera — checks reales calculados en cliente (agregado 2026-07-13)
// Detecta: saldos negativos, gastos retroactivos/futuros, CxP vencidas,
// transferencias sin cuenta y traspasos sin marcar.
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { HeartPulse, AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';

const sevStyles = {
  critico: { icon: AlertCircle, cls: 'bg-red-50 border-red-200 text-red-700', badge: 'bg-red-500' },
  advertencia: { icon: AlertTriangle, cls: 'bg-orange-50 border-orange-200 text-orange-700', badge: 'bg-orange-500' },
  info: { icon: Info, cls: 'bg-blue-50 border-blue-200 text-blue-700', badge: 'bg-blue-500' },
  ok: { icon: CheckCircle2, cls: 'bg-green-50 border-green-200 text-green-700', badge: 'bg-green-500' },
};

const fmt = (n) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);

export default function FinancialHealthCheck() {
  const { data: payments = [] } = useQuery({ queryKey: ['payments'], queryFn: () => base44.entities.Payment.list(null, 10000) });
  const { data: generalPayments = [] } = useQuery({ queryKey: ['generalPayments'], queryFn: () => base44.entities.GeneralPayment.list(null, 10000) });
  const { data: tournamentPayments = [] } = useQuery({ queryKey: ['tournamentPayments'], queryFn: () => base44.entities.TournamentPayment.list(null, 10000) });
  const { data: leaguePayments = [] } = useQuery({ queryKey: ['leaguePayments'], queryFn: () => base44.entities.LeaguePayment.list(null, 10000) });
  const { data: summerCampPayments = [] } = useQuery({ queryKey: ['summerCampPayments'], queryFn: () => base44.entities.SummerCampPayment.list(null, 10000) });
  const { data: expenses = [] } = useQuery({ queryKey: ['expenses'], queryFn: () => base44.entities.Expense.list(null, 10000) });
  const { data: cashRegisters = [] } = useQuery({ queryKey: ['cashRegisters'], queryFn: () => base44.entities.CashRegister.list(null, 10000) });
  const { data: accountsPayable = [] } = useQuery({ queryKey: ['accountsPayable'], queryFn: () => base44.entities.AccountPayable.list(null, 10000) });

  const getAmt = (p) => (p.paid_amount !== undefined && p.paid_amount !== null) ? p.paid_amount : (p.amount || 0);
  const allPayments = [
    ...payments.filter(p => p.status === 'pagado'),
    ...generalPayments,
    ...tournamentPayments,
    ...leaguePayments,
    ...summerCampPayments.filter(p => p.status === 'pagado'),
  ];

  const issues = [];
  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Check 1: saldos negativos por cuenta ──
  const CUENTAS = ['BBVA', 'MP', 'NU', 'OpenBank', 'MercadoPagoBIA'];
  const inBy = (pred) => allPayments.filter(pred).reduce((s, p) => s + getAmt(p), 0);
  const outBy = (pred) => expenses.filter(pred).reduce((s, e) => s + (e.amount || 0), 0);
  const saldos = {
    Efectivo: inBy(p => p.payment_method === 'efectivo') - outBy(e => e.payment_method === 'efectivo'),
    Tarjeta: inBy(p => p.payment_method === 'tarjeta') - outBy(e => e.payment_method === 'tarjeta'),
  };
  CUENTAS.forEach(c => {
    saldos[c] = inBy(p => p.payment_method === 'transferencia' && p.bank_name === c)
      - outBy(e => e.payment_method === 'transferencia' && e.account === c);
  });
  saldos.Fondos = cashRegisters.reduce((s, r) => s + (r.cash_amount || 0), 0)
    - outBy(e => e.account === 'Fondos' && !e.is_transfer);
  Object.entries(saldos).forEach(([cuenta, saldo]) => {
    if (saldo < 0) issues.push({
      sev: 'critico', modulo: 'Saldos',
      msg: `Saldo negativo en ${cuenta}: ${fmt(saldo)}`,
      hint: 'Una cuenta real no puede ser negativa: falta registrar ingresos o hay gastos asignados a la cuenta equivocada. Requiere conciliación bancaria.',
    });
  });

  // ── Check 2: gastos con fecha retroactiva (>7 días entre captura y fecha del gasto) ──
  const retro = expenses.filter(e => {
    if (!e.created_at || !e.expense_date) return false;
    const diff = (new Date(e.created_at) - new Date(e.expense_date)) / 86400000;
    return diff > 7;
  });
  if (retro.length > 0) issues.push({
    sev: 'advertencia', modulo: 'Egresos',
    msg: `${retro.length} gastos capturados con más de 7 días de retraso`,
    hint: 'La captura retroactiva rompe la trazabilidad. Los ERP enterprise bloquean periodos cerrados; considera capturar el mismo día.',
  });

  // ── Check 3: gastos con fecha futura ──
  const futuros = expenses.filter(e => e.expense_date && e.expense_date > todayStr);
  if (futuros.length > 0) issues.push({
    sev: 'advertencia', modulo: 'Egresos',
    msg: `${futuros.length} gastos con fecha futura`,
    hint: 'Un gasto no debería tener fecha posterior a hoy. Revisar y corregir la fecha.',
  });

  // ── Check 4: CxP vencidas sin pagar ──
  const vencidas = accountsPayable.filter(c => c.status !== 'pagado' && c.due_date && c.due_date < todayStr);
  if (vencidas.length > 0) {
    const totalVencido = vencidas.reduce((s, c) => s + (c.total_amount || 0), 0);
    issues.push({
      sev: 'advertencia', modulo: 'CxP',
      msg: `${vencidas.length} cuentas por pagar vencidas (${fmt(totalVencido)})`,
      hint: 'Revisar en el módulo CxP y reprogramar o liquidar.',
    });
  }

  // ── Check 5: transferencias sin cuenta bancaria ──
  const sinCuentaExp = expenses.filter(e => e.payment_method === 'transferencia' && !e.account);
  const sinCuentaPay = allPayments.filter(p => p.payment_method === 'transferencia' && !p.bank_name);
  if (sinCuentaExp.length + sinCuentaPay.length > 0) issues.push({
    sev: 'advertencia', modulo: 'Datos',
    msg: `${sinCuentaExp.length + sinCuentaPay.length} transferencias sin cuenta bancaria asignada`,
    hint: 'Estos montos no aparecen en ningún saldo por cuenta. Asignar banco a cada transferencia.',
  });

  // ── Check 6: posibles traspasos sin marcar como transferencia ──
  const traspasosSinMarcar = expenses.filter(e => !e.is_transfer && e.concept && /traspaso/i.test(e.concept));
  if (traspasosSinMarcar.length > 0) issues.push({
    sev: 'advertencia', modulo: 'Datos',
    msg: `${traspasosSinMarcar.length} gastos parecen traspasos pero no están marcados como transferencia`,
    hint: 'Un traspaso marcado como gasto infla el P&L. Marcar is_transfer o corregir el concepto.',
  });

  const criticos = issues.filter(i => i.sev === 'critico').length;
  const advertencias = issues.filter(i => i.sev === 'advertencia').length;

  return (
    <Card className="border-2 border-purple-100">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse className="w-5 h-5 text-purple-600" />
          Salud Financiera
          {criticos > 0 && <Badge className="bg-red-500 text-white">{criticos} críticos</Badge>}
          {advertencias > 0 && <Badge className="bg-orange-500 text-white">{advertencias} advertencias</Badge>}
          {issues.length === 0 && <Badge className="bg-green-500 text-white">Todo en orden</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Resumen de saldos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(saldos).map(([cuenta, saldo]) => (
            <div key={cuenta} className={`rounded-lg border p-2 text-center ${saldo < 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
              <p className="text-xs text-gray-500">{cuenta}</p>
              <p className={`text-sm font-bold ${saldo < 0 ? 'text-red-600' : 'text-green-700'}`}>{fmt(saldo)}</p>
            </div>
          ))}
        </div>
        {issues.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            <p className="text-sm text-green-700">Sin incidencias financieras: saldos positivos, sin CxP vencidas ni capturas anómalas.</p>
          </div>
        ) : issues.map((issue, i) => {
          const st = sevStyles[issue.sev];
          const Icon = st.icon;
          return (
            <div key={i} className={`${st.cls} border rounded-lg p-3`}>
              <div className="flex items-start gap-3">
                <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={`${st.badge} text-white text-xs`}>{issue.sev}</Badge>
                    <Badge variant="outline" className="text-xs">{issue.modulo}</Badge>
                  </div>
                  <p className="font-semibold text-gray-900 text-sm">{issue.msg}</p>
                  <p className="text-xs text-gray-600 mt-1">{issue.hint}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
