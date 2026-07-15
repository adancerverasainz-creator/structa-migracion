import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Search, User, DollarSign, Calendar, Trophy, ShoppingBag, Sun,
  ClipboardList, GraduationCap, Phone, Mail, PlusCircle,
  AlertCircle, CheckCircle2, Wallet, FileDown, Users, AlertTriangle
} from 'lucide-react';
import { format, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';
import { calculateMoratorio } from '../../lib/financeEngine';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, 'MMMM yyyy', { locale: es }),
      value: format(d, 'MMMM yyyy', { locale: es }),
    });
  }
  return options;
}

const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export default function PlayerUnifiedDebt({
  players, payments, tournamentPayments, tournaments, tournamentAttendees,
  summerCampPayments, onAbonar, onAbonarTorneo, onPagoGeneral, isLoading
, lateFeeSettings = null, debtWaivers = []}) {
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0]?.value || '');
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false); // toggle: solo deudores vs todos

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentSeason = `${currentYear}-${currentYear + 1}`;

  const selectedOption = monthOptions.find(o => o.value === selectedMonth) || monthOptions[0];
  const [selMonthName, selYear] = (selectedOption?.value || '').split(' ');
  const selMonthIndex = monthNames.indexOf(selMonthName?.toLowerCase());
  const selectedMonthDate = selMonthIndex >= 0 ? new Date(parseInt(selYear), selMonthIndex, 1) : now;

  // ── Calculate consolidated view for ALL active players ──
  const allPlayerDebts = useMemo(() => {
    const results = [];

    for (const p of players) {
      // FIX 2026-07-15: inactivos/baja permanecen — su deuda sigue viva y cobrable.
      const monthlyFee = p.monthly_fee || 0;
      if (monthlyFee <= 0) continue;

      const joinDate = p.join_date ? new Date(p.join_date + 'T00:00:00') : null;
      const joinMonthDate = joinDate ? new Date(joinDate.getFullYear(), joinDate.getMonth(), 1) : null;

      if (joinMonthDate && joinMonthDate > selectedMonthDate) continue;

      const sections = [];
      let totalPending = 0;
      let totalPaid = 0;

      // ── 1. MENSUALIDADES ──
      const fixedStart = new Date(2025, 11, 1);
      const startDate = joinDate && joinDate > fixedStart ? joinDate : fixedStart;
      const mensualidadItems = [];
      let mensualidadPending = 0;
      let mensualidadPaid = 0;

      const genCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      let genEnd = new Date(selectedMonthDate.getFullYear(), selectedMonthDate.getMonth(), 1);
      // Fecha de baja: la deuda se genera solo hasta el mes de la baja (congelada después)
      if (p.baja_date) {
        const baja = new Date(p.baja_date + 'T00:00:00');
        const bajaMonth = new Date(baja.getFullYear(), baja.getMonth(), 1);
        if (bajaMonth < genEnd) genEnd = bajaMonth;
      }

      while (genCursor <= genEnd) {
        const mName = format(genCursor, 'MMMM', { locale: es });
        const mYear = genCursor.getFullYear();
        const mKey = `${mName} ${mYear}`;

        let requiredFee = monthlyFee;
        if (joinDate && genCursor.getFullYear() === joinDate.getFullYear() && genCursor.getMonth() === joinDate.getMonth() && joinDate.getDate() > 15) {
          requiredFee = monthlyFee * 0.5;
        }
        if (p.scholarship === '50%') requiredFee *= 0.5;
        else if (p.scholarship === '100%') requiredFee = 0;

        const paidForMonth = payments
          .filter(pay => pay.player_id === p.id
            && (!pay.payment_type || pay.payment_type === 'mensualidad')
            && pay.month?.toLowerCase().includes(mName.toLowerCase())
            && pay.month?.includes(String(mYear)))
          .reduce((sum, pay) => sum + (pay.amount || 0), 0);

        const waivedForMonth = debtWaivers
          .filter(w => w.player_id === p.id && (w.month || '').toLowerCase() === mKey.toLowerCase())
          .reduce((sum, w) => sum + (w.amount || 0), 0);

        const basePending = Math.max(0, requiredFee - paidForMonth - waivedForMonth);

        // Moratorio: $100 si el mes ya pasó y aún hay saldo pendiente
        let moratorio = 0;
        let isLate = false;
        let monthsLate = 0;
        if (basePending > 0 && requiredFee > 0) {
          const morResult = calculateMoratorio(mKey, now, lateFeeSettings);
          moratorio = morResult.moratorio;
          isLate = morResult.isLate;
          monthsLate = morResult.monthsLate;
        }

        const totalPendingWithMoratorio = basePending > 0 ? basePending + moratorio : 0;

        mensualidadItems.push({
          label: `${mName.charAt(0).toUpperCase() + mName.slice(1)} ${mYear}`,
          detail: requiredFee === 0
            ? 'Beca 100% — sin cargo'
            : `Cuota: ${formatCurrency(requiredFee)}${moratorio > 0 ? ` + Recargo día 15: ${formatCurrency(moratorio)}` : ''}${requiredFee !== monthlyFee && requiredFee > 0 ? ' (50%)' : ''}${waivedForMonth > 0 ? ` | Condonado: ${formatCurrency(waivedForMonth)}` : ''}`,
          paid: paidForMonth,
          pending: totalPendingWithMoratorio,
          moratorio,
          isLate,
          monthsLate,
          payment_type: 'mensualidad',
          month: mKey,
          status: basePending <= 0 ? 'pagado' : 'pendiente',
        });

        mensualidadPending += totalPendingWithMoratorio;
        mensualidadPaid += paidForMonth;

        genCursor.setMonth(genCursor.getMonth() + 1);
      }

      if (mensualidadItems.length > 0) {
        const pendingCount = mensualidadItems.filter(i => i.pending > 0).length;
        sections.push({
          id: 'mensualidad',
          icon: Calendar,
          title: 'Mensualidad',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          badge: pendingCount > 0 ? `${pendingCount} pendiente(s)` : 'Al día ✓',
          badgeColor: pendingCount > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          items: mensualidadItems,
        });
        totalPending += mensualidadPending;
        totalPaid += mensualidadPaid;
      }

      // ── 2. INSCRIPCIÓN / REINSCRIPCIÓN ──
      const inscPayments = payments.filter(pay =>
        pay.player_id === p.id
        && (pay.payment_type === 'inscripcion' || pay.payment_type === 'reinscripcion')
        && pay.month === currentSeason
      );
      const paidInscripcion = inscPayments.reduce((sum, pay) => sum + (pay.amount || 0), 0);
      const inscPending = paidInscripcion > 0 ? 0 : 1800;

      sections.push({
        id: 'inscripcion',
        icon: ClipboardList,
        title: 'Inscripción / Reinscripción',
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        badge: inscPending > 0 ? 'Pendiente' : 'Pagado ✓',
        badgeColor: inscPending > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
        items: [{
          label: `Temporada ${currentSeason}`,
          detail: inscPending > 0 ? 'Reinscripción pendiente' : `Pagado: ${formatCurrency(paidInscripcion)}`,
          paid: paidInscripcion,
          pending: inscPending,
          payment_type: 'reinscripcion',
          month: currentSeason,
          status: inscPending <= 0 ? 'pagado' : 'pendiente',
        }],
      });
      totalPending += inscPending;
      totalPaid += paidInscripcion;

      // ── 3. UNIFORMES ──
      const allUniformPayments = payments.filter(pay =>
        pay.player_id === p.id && pay.payment_type === 'uniformes'
      );
      if (allUniformPayments.length > 0) {
        const uniformItems = allUniformPayments.map(up => {
          const isPending = up.status === 'pendiente';
          const pendienteMatch = up.notes?.match(/[Pp]endiente[:\s]*\$?([\d.,]+)/);
          const pendingAmt = isPending
            ? (pendienteMatch ? parseFloat(pendienteMatch[1].replace(/,/g, '')) : up.amount)
            : 0;
          const paidAmt = up.amount - pendingAmt;
          return {
            label: up.notes?.replace(/\s*\|\s*Pendiente:.*/, '') || 'Uniformes',
            detail: isPending ? 'Saldo pendiente' : `Pagado el ${up.payment_date ? format(new Date(up.payment_date), 'dd/MMM/yy', { locale: es }) : '-'}`,
            paid: paidAmt,
            pending: pendingAmt,
            payment_type: 'uniformes',
            month: 'uniformes',
            existingPaymentId: isPending ? up.id : null,
            status: up.status,
          };
        });

        const uniformPending = uniformItems.reduce((s, i) => s + i.pending, 0);
        const uniformPaid = uniformItems.reduce((s, i) => s + i.paid, 0);

        sections.push({
          id: 'uniformes',
          icon: ShoppingBag,
          title: 'Uniformes',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          badge: uniformPending > 0 ? `${uniformItems.filter(i => i.pending > 0).length} pendiente(s)` : `${uniformItems.length} compra(s) ✓`,
          badgeColor: uniformPending > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          items: uniformItems,
        });
        totalPending += uniformPending;
        totalPaid += uniformPaid;
      }

      // ── 4. TORNEOS ──
      const playerAttendees = tournamentAttendees.filter(a => a.player_id === p.id);
      const tournamentDebtItems = [];
      let torneosPending = 0;
      let torneosPaid = 0;

      for (const att of playerAttendees) {
        const tournament = tournaments.find(t => t.id === att.tournament_id);
        if (!tournament) continue;
        const fee = tournament.registration_fee || 0;
        const paid = tournamentPayments
          .filter(tp => tp.tournament_id === tournament.id && (
            tp.player_id === p.id ||
            (tp.external_attendee_id && tp.external_attendee_id === att.id)
          ))
          .reduce((sum, tp) => sum + (tp.paid_amount ?? tp.amount ?? 0), 0);
        const pending = Math.max(0, fee - paid);
        tournamentDebtItems.push({
          label: tournament.name,
          detail: `Cuota: ${formatCurrency(fee)}`,
          paid,
          pending,
          isTournament: true,
          tournament_id: tournament.id,
          tournament_name: tournament.name,
          registration_fee: fee,
          status: pending <= 0 ? 'pagado' : 'pendiente',
        });
        torneosPending += pending;
        torneosPaid += paid;
      }

      if (tournamentDebtItems.length > 0) {
        const pendingTournaments = tournamentDebtItems.filter(i => i.pending > 0).length;
        sections.push({
          id: 'torneos',
          icon: Trophy,
          title: 'Torneos',
          color: 'text-amber-600',
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          badge: pendingTournaments > 0 ? `${pendingTournaments} pendiente(s)` : `${tournamentDebtItems.length} pagado(s) ✓`,
          badgeColor: pendingTournaments > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          items: tournamentDebtItems,
        });
        totalPending += torneosPending;
        totalPaid += torneosPaid;
      }

      // ── 5. SUMMER CAMP ──
      const scPayments = summerCampPayments.filter(sp => sp.player_id === p.id);
      if (scPayments.length > 0) {
        const scItems = scPayments.map(sc => ({
          label: sc.payment_type === 'semana' ? `Semana ${sc.week_number || '?'}` : 'Uniforme Summer',
          detail: sc.status === 'pagado' ? `Pagado: ${formatCurrency(sc.amount)}` : sc.notes || 'Pendiente',
          paid: sc.status === 'pagado' ? sc.amount : (sc.paid_amount || 0),
          pending: sc.status === 'pagado' ? 0 : Math.max(0, (sc.amount || 0) - (sc.paid_amount || 0)),
          payment_type: `summer_${sc.payment_type}`,
          status: sc.status,
        }));
        const scPending = scItems.reduce((s, i) => s + i.pending, 0);
        const scPaid = scItems.reduce((s, i) => s + i.paid, 0);
        sections.push({
          id: 'summercamp',
          icon: Sun,
          title: 'Summer Camp',
          color: 'text-orange-600',
          bgColor: 'bg-orange-50',
          borderColor: 'border-orange-200',
          badge: scPending > 0 ? `${scItems.filter(i => i.pending > 0).length} pendiente(s)` : `${scItems.length} pagado(s) ✓`,
          badgeColor: scPending > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          items: scItems,
        });
        totalPending += scPending;
        totalPaid += scPaid;
      }

      if (sections.length > 0) {
        results.push({ player: p, sections, totalDebt: totalPending, totalPaid });
      }
    }

    results.sort((a, b) => b.totalDebt - a.totalDebt);
    return results;
  }, [players, payments, tournamentPayments, tournaments, tournamentAttendees, summerCampPayments, selectedMonthDate, currentSeason]);

  // Filter: show all OR only with debt
  const visibleDebts = useMemo(() => {
    let list = showAll ? allPlayerDebts : allPlayerDebts.filter(d => d.totalDebt > 0);
    if (!search.trim()) return list;
    const term = search.toLowerCase();
    return list.filter(d =>
      d.player.full_name?.toLowerCase().includes(term) ||
      d.player.parent_name?.toLowerCase().includes(term) ||
      d.player.category?.toLowerCase().includes(term)
    );
  }, [allPlayerDebts, search, showAll]);

  const totalDebtors = allPlayerDebts.filter(d => d.totalDebt > 0).length;
  const grandTotalDebt = allPlayerDebts.filter(d => d.totalDebt > 0).reduce((sum, d) => sum + d.totalDebt, 0);
  const grandTotalPaid = allPlayerDebts.reduce((sum, d) => sum + d.totalPaid, 0);

  const selectedMonthLabel = (() => {
    const v = selectedOption?.label || '';
    return v.charAt(0).toUpperCase() + v.slice(1);
  })();

  // ── Handlers ──
  const handleAbonar = (player, item) => {
    if (item.isTournament) {
      onAbonarTorneo?.({ player, tournament: { id: item.tournament_id, name: item.tournament_name }, debt: item.pending, fee: item.registration_fee, totalPaid: item.paid });
    } else {
      onAbonar?.({ player, pendingAmount: item.pending, payment_type: item.payment_type, month: item.month, existingPaymentId: item.existingPaymentId });
    }
  };

  // ── Export ──
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.setTextColor(165, 0, 68);
    doc.text('Barcelona Inter Academy', 14, 18);
    doc.setFontSize(12); doc.setTextColor(40, 40, 40);
    doc.text(`Deuda Unificada — ${selectedMonthLabel}`, 14, 27);
    doc.setFontSize(9); doc.setTextColor(120, 120, 120);
    doc.text(`Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
    doc.setFontSize(10); doc.setTextColor(40, 40, 40);
    doc.text(`Jugadores con deuda: ${totalDebtors}   |   Deuda total: ${formatCurrency(grandTotalDebt)}`, 14, 43);
    let y = 55;
    for (const d of visibleDebts) {
      if (y > 265) { doc.addPage(); y = 20; }
      doc.setFontSize(11); doc.setTextColor(40, 40, 40);
      doc.text(`${d.player.full_name} (${d.player.category || 'Sin cat.'})`, 14, y);
      doc.setFontSize(9);
      doc.setTextColor(d.totalDebt > 0 ? 200 : 40, d.totalDebt > 0 ? 40 : 140, 40);
      doc.text(`Adeuda: ${formatCurrency(d.totalDebt)}  |  Abonado: ${formatCurrency(d.totalPaid)}  |  ${d.player.parent_name} — ${d.player.parent_phone}`, 14, y + 5);
      y += 12;
    }
    doc.save(`deuda_unificada_${selMonthName}_${selYear}.pdf`);
  };

  const exportXLSX = () => {
    const wsData = [
      [`Barcelona Inter Academy — Deuda Unificada — ${selectedMonthLabel}`],
      [`Jugadores con deuda: ${totalDebtors}`, `Deuda total: ${formatCurrency(grandTotalDebt)}`],
      [],
      ['Jugador', 'Categoría', 'Padre', 'Teléfono', 'Email', 'Mensualidad', 'Torneos', 'Uniformes', 'Inscripción', 'Summer Camp', 'Deuda Total'],
      ...visibleDebts.map(d => {
        const bySection = (id) => { const s = d.sections.find(sec => sec.id === id); return s ? s.items.reduce((sum, i) => sum + i.pending, 0) : 0; };
        return [d.player.full_name, d.player.category || '-', d.player.parent_name, d.player.parent_phone, d.player.parent_email || '-', bySection('mensualidad'), bySection('torneos'), bySection('uniformes'), bySection('inscripcion'), bySection('summercamp'), d.totalDebt];
      }),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deuda Unificada');
    XLSX.writeFile(wb, `deuda_unificada_${selMonthName}_${selYear}.xlsx`);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Buscar jugador, padre o categoría..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-64" />
          </div>
          {/* Toggle all/debtors */}
          <button
            onClick={() => setShowAll(v => !v)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              showAll
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4" />
            {showAll ? 'Todos los jugadores' : 'Solo con deuda'}
          </button>
        </div>
        {visibleDebts.length > 0 && (
          <div className="flex gap-2">
            <Button onClick={exportXLSX} variant="outline" size="sm" className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
              <FileDown className="w-4 h-4" /> Excel
            </Button>
            <Button onClick={exportPDF} variant="outline" size="sm" className="gap-2 border-red-300 text-red-700 hover:bg-red-50">
              <FileDown className="w-4 h-4" /> PDF
            </Button>
          </div>
        )}
      </div>

      {/* Summary */}
      <Card className={`border-2 ${grandTotalDebt > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg ${grandTotalDebt > 0 ? 'bg-red-600' : 'bg-green-600'}`}>
                {grandTotalDebt > 0 ? <AlertCircle className="w-6 h-6 text-white" /> : <CheckCircle2 className="w-6 h-6 text-white" />}
              </div>
              <div>
                <p className="text-sm text-gray-600">Deuda Unificada — {selectedMonthLabel}</p>
                <p className={`text-3xl font-bold ${grandTotalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {totalDebtors} {totalDebtors === 1 ? 'moroso' : 'morosos'}
                </p>
              </div>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-xs text-gray-500">Deuda Total</p>
                <p className={`text-2xl font-bold ${grandTotalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(grandTotalDebt)}</p>
              </div>
              {grandTotalPaid > 0 && (
                <div>
                  <p className="text-xs text-gray-500">Total Cobrado</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(grandTotalPaid)}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-gray-500">Total Jugadores</p>
                <p className="text-2xl font-bold text-gray-700">{allPlayerDebts.length}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Player Cards */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Calculando deudas...</p>
        </div>
      ) : visibleDebts.length === 0 ? (
        <Card className="border-2 border-dashed border-green-300 bg-green-50/30">
          <CardContent className="py-16 text-center">
            <div className="w-20 h-20 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo al día!</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              {search.trim() ? 'No se encontraron jugadores para esta búsqueda.' : 'No hay jugadores con deudas pendientes.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visibleDebts.map(({ player, sections, totalDebt, totalPaid }) => (
            <Card key={player.id} className={`border-2 ${totalDebt > 0 ? 'border-red-200 hover:border-red-300' : 'border-green-200 hover:border-green-300'} hover:shadow-lg transition-all`}>
              <CardContent className="pt-4 pb-3">
                {/* Player Header */}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${totalDebt > 0 ? 'bg-red-100' : 'bg-green-100'}`}>
                      <User className={`w-5 h-5 ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-gray-900">{player.full_name}</h3>
                        {player.status && player.status !== 'activo' && (
                          <Badge className="bg-gray-700 text-white text-xs">{player.status === 'baja' ? 'Baja' : 'Inactivo'}</Badge>
                        )}
                        {player.category && <Badge variant="outline">{player.category}</Badge>}
                        {(player.scholarship && player.scholarship !== 'ninguna') && (
                          <Badge className="bg-purple-100 text-purple-800 flex items-center gap-1">
                            <GraduationCap className="w-3 h-3" /> Beca {player.scholarship}
                          </Badge>
                        )}
                        {totalDebt > 0
                          ? <Badge className="bg-red-100 text-red-700 border-red-300 border">Adeuda</Badge>
                          : <Badge className="bg-green-100 text-green-700 border-green-300 border">Al día ✓</Badge>
                        }
                      </div>
                      <div className="bg-gray-50 p-2 rounded mt-1.5 space-y-0.5 text-xs">
                        <p className="font-semibold">{player.parent_name}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-gray-600">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{player.parent_phone}</span>
                          {player.parent_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{player.parent_email}</span>}
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" />Cuota: {formatCurrency(player.monthly_fee || 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      {totalPaid > 0 && <p className="text-xs text-green-600">Abonado: {formatCurrency(totalPaid)}</p>}
                      <p className={`text-xl font-bold ${totalDebt > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {totalDebt > 0 ? formatCurrency(totalDebt) : 'Sin deuda'}
                      </p>
                      <p className="text-xs text-gray-400">{sections.length} sección(es)</p>
                    </div>
                    {totalDebt > 0 && onPagoGeneral && (
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700 gap-1.5" onClick={() => onPagoGeneral({ player, debts: { sections } })}>
                        <Wallet className="w-3.5 h-3.5" /> Pago General
                      </Button>
                    )}
                  </div>
                </div>

                {/* Sections Accordion */}
                <Accordion type="multiple" defaultValue={sections.filter(s => s.items.some(i => i.pending > 0)).map(s => s.id)} className="space-y-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    const sectionPending = section.items.reduce((s, i) => s + i.pending, 0);
                    const sectionPaid = section.items.reduce((s, i) => s + i.paid, 0);
                    return (
                      <AccordionItem key={section.id} value={section.id}
                        className={`border rounded-lg ${section.borderColor} ${section.bgColor} px-1`}>
                        <AccordionTrigger className="hover:no-underline px-3 py-2">
                          <div className="flex items-center gap-3 flex-1">
                            <Icon className={`w-4 h-4 ${section.color}`} />
                            <span className="font-semibold text-sm text-gray-900">{section.title}</span>
                            <Badge className={`text-xs ${section.badgeColor}`}>{section.badge}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mr-3" onClick={e => e.stopPropagation()}>
                            <span className={`text-sm font-bold ${sectionPending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {sectionPending > 0 ? formatCurrency(sectionPending) : '✓'}
                            </span>
                            {sectionPaid > 0 && <span className="text-xs text-green-600">+{formatCurrency(sectionPaid)}</span>}
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 pt-0">
                          <div className="space-y-2">
                            {section.items.map((item, idx) => (
                              <div key={idx} className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2.5 rounded-lg border ${item.status === 'pagado' ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-900">{item.label}</p>
                                    {item.isLate && item.pending > 0 && (
                                      <Badge className="bg-orange-100 text-orange-700 text-xs flex items-center gap-0.5">
                                        <AlertTriangle className="w-3 h-3" /> +{item.monthsLate} {item.monthsLate === 1 ? 'mes' : 'meses'}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">{item.detail}</p>
                                  <div className="flex items-center gap-3 mt-1">
                                    {item.paid > 0 && <span className="text-xs text-green-600">Abonado: {formatCurrency(item.paid)}</span>}
                                    <span className={`text-xs font-semibold ${item.pending > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {item.pending > 0 ? `Pendiente: ${formatCurrency(item.pending)}` : '✓ Pagado'}
                                    </span>
                                    {item.moratorio > 0 && item.pending > 0 && (
                                      <span className="text-xs text-orange-600 font-medium">
                                        (incl. moratorio {formatCurrency(item.moratorio)})
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {item.pending > 0 && (
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1.5 shrink-0" onClick={() => handleAbonar(player, item)}>
                                    <PlusCircle className="w-3.5 h-3.5" /> Pagar
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}