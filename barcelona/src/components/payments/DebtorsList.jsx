import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Phone, Mail, DollarSign, Calendar, FileDown, Search, ClipboardList, UserX, Trophy, ShoppingBag, PlusCircle } from 'lucide-react';
import TournamentDebtorsList from './TournamentDebtorsList';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calculateMoratorio } from '../../lib/financeEngine';
import { format, subMonths, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

// Season options starting from 2025-2026
const currentYear = new Date().getFullYear();
const SEASON_OPTIONS = Array.from({ length: currentYear - 2025 + 4 }, (_, i) => {
  const y = 2025 + i;
  return `${y}-${y + 1}`;
});

// Generate list of months (current + 11 previous)
function getMonthOptions() {
  const options = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = subMonths(now, i);
    options.push({
      label: format(d, 'MMMM yyyy', { locale: es }),
      value: format(d, 'MMMM yyyy', { locale: es }),
      monthName: format(d, 'MMMM', { locale: es }),
    });
  }
  return options;
}

export default function DebtorsList({ players, payments, isLoading, tournamentPayments = [], onAbonar, onAbonarInscripcion, lateFeeSettings = null, debtWaivers = [] , onCondonar }) {
  const monthOptions = getMonthOptions();
  const [selectedMonth, setSelectedMonth] = useState(monthOptions[0].value);
  const [search, setSearch] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('2025-2026');
  const [seasonSearch, setSeasonSearch] = useState('');

  const selectedOption = monthOptions.find(o => o.value === selectedMonth) || monthOptions[0];

  // Solo incluir jugadores que ya estaban inscritos en el mes seleccionado
  const [selMonthName, selYear] = selectedOption.value.split(' ');
  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const selMonthIndex = monthNames.indexOf(selMonthName.toLowerCase());
  const selectedMonthDate = new Date(parseInt(selYear), selMonthIndex, 1);

  // FIX 2026-07-15: la deuda NO desaparece al dar de baja — se sigue cobrando.
  // Morosos de mensualidad incluye TODOS los estatus; solo se filtra por fecha de inscripción.
  const eligiblePlayers = players.filter(p => {
    // Fecha de baja: la deuda se congela — no se generan meses posteriores a la baja
    if (p.baja_date) {
      const baja = parseISO(p.baja_date);
      const bajaMonthDate = new Date(baja.getFullYear(), baja.getMonth(), 1);
      if (selectedMonthDate > bajaMonthDate) return false;
    }
    if (!p.join_date) return true;
    const joined = parseISO(p.join_date);
    // El jugador debe haberse inscrito antes o durante el mes seleccionado
    const joinedMonthDate = new Date(joined.getFullYear(), joined.getMonth(), 1);
    return joinedMonthDate <= selectedMonthDate;
  });

  const paymentsThisMonth = payments.filter(p =>
    // Incluir pagos de mensualidad explícita O pagos sin payment_type (registros antiguos = mensualidades)
    // Excluir explícitamente uniformes, inscripcion y reinscripcion
    (!p.payment_type || p.payment_type === 'mensualidad') &&
    p.month?.toLowerCase().includes(selectedOption.monthName.toLowerCase()) &&
    p.month?.includes(selectedOption.value.split(' ')[1])
  );

  // Condonaciones registradas para el mes seleccionado
  const waivedByPlayer = {};
  debtWaivers
    .filter(w => (w.month || '').toLowerCase() === selectedOption.value.toLowerCase())
    .forEach(w => { waivedByPlayer[w.player_id] = (waivedByPlayer[w.player_id] || 0) + (w.amount || 0); });

  // Sumar pagos por jugador para detectar pagos parciales
  const paidAmountByPlayer = {};
  paymentsThisMonth.forEach(p => {
    paidAmountByPlayer[p.player_id] = (paidAmountByPlayer[p.player_id] || 0) + (p.amount || 0);
  });

  // Calcula la cuota requerida para el mes seleccionado:
  // Si el jugador ingresó después del día 15 de ese mismo mes → 50%, si no → 100%
  const getRequiredFee = (player) => {
    const fullFee = player.monthly_fee || 0;
    if (!player.join_date) return fullFee;
    const joined = parseISO(player.join_date);
    const joinedYear = joined.getFullYear();
    const joinedMonth = joined.getMonth(); // 0-indexed
    // Solo aplica descuento si el mes/año de ingreso coincide con el mes seleccionado
    if (joinedYear === parseInt(selYear) && joinedMonth === selMonthIndex && joined.getDate() > 15) {
      return fullFee * 0.5;
    }
    return fullFee;
  };

  // Moroso: sin pago o pago parcial (pagó menos de su cuota requerida) — cualquier estatus.
  // Regla del club: vencido el día 15 → recargo (configurable). Las condonaciones restan deuda.
  const debtors = eligiblePlayers
    .filter(p => {
      const paid = (paidAmountByPlayer[p.id] || 0) + (waivedByPlayer[p.id] || 0);
      return paid < getRequiredFee(p);
    })
    .map(p => {
      const requiredFee = getRequiredFee(p);
      const isHalfFee = requiredFee < (p.monthly_fee || 0);
      const paid = paidAmountByPlayer[p.id] || 0;
      const waived = waivedByPlayer[p.id] || 0;
      const basePending = Math.max(0, requiredFee - paid - waived);
      const { moratorio } = basePending > 0
        ? calculateMoratorio(selectedOption.value, new Date(), lateFeeSettings)
        : { moratorio: 0 };
      return {
        ...p,
        requiredFee,
        isHalfFee,
        paidAmount: paid,
        waivedAmount: waived,
        recargo: moratorio,
        pendingAmount: basePending + moratorio,
      };
    });

  const totalDebt = debtors.reduce((sum, player) => sum + (player.pendingAmount || 0), 0);

  // --- Inscripciones / Reinscripciones pendientes por temporada ---
  // Jugadores que YA pagaron inscripcion o reinscripcion para la temporada seleccionada
  const paidInscripcionIds = new Set(
    payments
      .filter(p => (p.payment_type === 'inscripcion' || p.payment_type === 'reinscripcion') && p.month === selectedSeason)
      .map(p => p.player_id)
  );

  // Inscripciones/reinscripciones: SOLO jugadores activos (a un inactivo/baja no se le genera nueva reinscripción)
  // Excluir jugadores con cuota mensual $0 (no pagan reinscripción)
  const activeOnly = eligiblePlayers.filter(p => p.status === 'activo');
  const pendingInscripcion = activeOnly.filter(p => (p.monthly_fee || 0) > 0 && !paidInscripcionIds.has(p.id));

  const filteredPendingInscripcion = seasonSearch.trim()
    ? pendingInscripcion.filter(p =>
        p.full_name?.toLowerCase().includes(seasonSearch.toLowerCase()) ||
        p.parent_name?.toLowerCase().includes(seasonSearch.toLowerCase()) ||
        p.category?.toLowerCase().includes(seasonSearch.toLowerCase())
      )
    : pendingInscripcion;

  const filteredDebtors = search.trim()
    ? debtors.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.parent_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.category?.toLowerCase().includes(search.toLowerCase())
      )
    : debtors;

  const exportPDF = () => {
    const doc = new jsPDF();
    const monthLabel = selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1);
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(16);
    doc.setTextColor(165, 0, 68);
    doc.text('Barcelona Inter Academy', 14, 18);
    doc.setFontSize(12);
    doc.setTextColor(40, 40, 40);
    doc.text(`Reporte de Morosos - ${monthLabel}`, 14, 27);
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(`Generado el ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 34);
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    doc.text(`Total morosos: ${debtors.length}   |   Deuda total: ${formatCurrency(totalDebt)}`, 14, 43);

    // Table header
    const cols = ['Jugador', 'Categoría', 'Padre/Tutor', 'Teléfono', 'Cuota'];
    const colWidths = [45, 25, 45, 35, 25];
    let y = 52;

    // Draw header row
    doc.setFillColor(165, 0, 68);
    doc.rect(14, y, pageWidth - 28, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    let x = 16;
    cols.forEach((col, i) => {
      doc.text(col, x, y + 5.5);
      x += colWidths[i];
    });

    // Draw rows
    y += 8;
    debtors.forEach((p, idx) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      if (idx % 2 === 0) {
        doc.setFillColor(255, 240, 245);
        doc.rect(14, y, pageWidth - 28, 8, 'F');
      }
      doc.setTextColor(40, 40, 40);
      x = 16;
      const row = [
        p.full_name,
        p.category || '-',
        p.parent_name,
        p.parent_phone,
        formatCurrency(p.requiredFee || 0),
      ];
      row.forEach((val, i) => {
        const maxW = colWidths[i] - 2;
        const text = doc.splitTextToSize(String(val || '-'), maxW)[0];
        doc.text(text, x, y + 5.5);
        x += colWidths[i];
      });
      y += 8;
    });

    doc.save(`morosos_${selectedOption.monthName}_${selectedOption.value.split(' ')[1]}.pdf`);
  };

  const exportXLSX = () => {
    const monthLabel = selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1);
    const wsData = [
      [`Barcelona Inter Academy - Reporte de Morosos - ${monthLabel}`],
      [`Total morosos: ${debtors.length}`, `Deuda total: ${formatCurrency(totalDebt)}`],
      [],
      ['Jugador', 'Categoría', 'Padre/Tutor', 'Teléfono', 'Email', 'Cuota Mensual'],
      ...debtors.map(p => [
        p.full_name,
        p.category || '-',
        p.parent_name,
        p.parent_phone,
        p.parent_email || '-',
        p.monthly_fee || 0,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Morosos');
    XLSX.writeFile(wb, `morosos_${selectedOption.monthName}_${selectedOption.value.split(' ')[1]}.xlsx`);
  };

  // Morosos uniformes: pagos de uniformes con status 'pendiente'
  const uniformDebtors = payments
    .filter(p => p.payment_type === 'uniformes' && p.status === 'pendiente')
    .map(p => {
      // El monto pendiente está guardado en las notas: "| Pendiente: $1200"
      const pendienteMatch = p.notes?.match(/[Pp]endiente[:\s]*\$?([\d.,]+)/);
      const pendienteAmount = pendienteMatch ? parseFloat(pendienteMatch[1].replace(/,/g, '')) : p.amount;
      return {
        ...p,
        pendienteAmount,
        player: players.find(pl => pl.id === p.player_id),
      };
    })
    .filter(p => p.player);

  return (
    <Tabs defaultValue="mensualidad" className="space-y-4">
      <TabsList className="grid w-full grid-cols-4">
        <TabsTrigger value="mensualidad" className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Morosos Mensualidad
        </TabsTrigger>
        <TabsTrigger value="inscripcion" className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" /> Inscripciones Pendientes
        </TabsTrigger>
        <TabsTrigger value="torneos" className="flex items-center gap-2">
          <Trophy className="w-4 h-4" /> Morosos Torneos
        </TabsTrigger>
        <TabsTrigger value="uniformes" className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" /> Uniformes Pendientes
          {uniformDebtors.length > 0 && (
            <span className="ml-1 bg-yellow-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{uniformDebtors.length}</span>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="inscripcion" className="space-y-4">
        {/* Season Selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500" />
            <Select value={selectedSeason} onValueChange={setSelectedSeason}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEASON_OPTIONS.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar jugador, padre o categoría..."
              value={seasonSearch}
              onChange={e => setSeasonSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Summary */}
        <Card className="bg-orange-50 border-2 border-orange-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-orange-500 rounded-lg">
                  <UserX className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Sin inscripción/reinscripción — Temporada {selectedSeason}</p>
                  <p className="text-3xl font-bold text-orange-600">{pendingInscripcion.length}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">jugadores activos</p>
                <p className="text-sm text-gray-700">sin pago registrado</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : pendingInscripcion.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <ClipboardList className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Todo al día!</h3>
              <p className="text-gray-600">Todos los jugadores tienen inscripción/reinscripción registrada para {selectedSeason}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filteredPendingInscripcion.length === 0 && (
              <p className="text-center text-gray-500 py-6">No se encontraron resultados para "{seasonSearch}"</p>
            )}
            {filteredPendingInscripcion.map(player => (
              <Card key={player.id} className="border-2 border-orange-200 hover:shadow-lg transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col md:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="text-base font-bold text-gray-900">{player.full_name}</h3>
                        {player.status && player.status !== 'activo' && (
                          <Badge className="bg-gray-700 text-white text-xs">{player.status === 'baja' ? 'Baja' : 'Inactivo'}</Badge>
                        )}
                        {player.category && <Badge variant="outline">{player.category}</Badge>}
                        <Badge className="bg-orange-100 text-orange-700 border-orange-300 border">Sin inscripción</Badge>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                        <p className="font-semibold text-gray-800 text-sm">{player.parent_name}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <a href={`tel:${player.parent_phone}`} className="hover:text-blue-600">{player.parent_phone}</a>
                          </div>
                          {player.parent_email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4 text-blue-600" />
                              <a href={`mailto:${player.parent_email}`} className="hover:text-blue-600">{player.parent_email}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-2">
                      <span className="text-xs text-gray-500">Reinscripción</span>
                      <span className="text-lg font-bold text-purple-700">{formatCurrency(1800)}</span>
                      {onAbonarInscripcion && (
                        <Button
                          size="sm"
                          className="bg-orange-600 hover:bg-orange-700 gap-2 mt-1"
                          onClick={() => onAbonarInscripcion({ player, pendingAmount: 1800, payment_type: 'reinscripcion', month: selectedSeason })}
                        >
                          <PlusCircle className="w-4 h-4" />
                          Registrar Pago
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="mensualidad" className="space-y-4">
      {/* Month Selector + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-500" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label.charAt(0).toUpperCase() + opt.label.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar jugador, padre o categoría..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {debtors.length > 0 && (
        <div className="flex justify-end gap-2">
          <Button onClick={exportXLSX} variant="outline" className="gap-2 border-green-300 text-green-700 hover:bg-green-50">
            <FileDown className="w-4 h-4" />
            Exportar Excel
          </Button>
          <Button onClick={exportPDF} variant="outline" className="gap-2 border-red-300 text-red-700 hover:bg-red-50">
            <FileDown className="w-4 h-4" />
            Exportar PDF
          </Button>
        </div>
      )}

      {/* Summary */}
      <Card className="bg-red-50 border-2 border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600 rounded-lg">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Padres Morosos - {selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}</p>
                <p className="text-3xl font-bold text-red-600">{debtors.length}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Deuda Total</p>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Debtors List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
          <p className="mt-2 text-gray-600">Cargando información...</p>
        </div>
      ) : debtors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Excelente!</h3>
            <p className="text-gray-600">Todos los pagos están al día para este mes</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredDebtors.length === 0 && (
            <p className="text-center text-gray-500 py-6">No se encontraron resultados para "{search}"</p>
          )}
          {filteredDebtors.map((player) => (
            <Card key={player.id} className="border-2 border-red-200 hover:shadow-lg transition-all">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{player.full_name}</h3>
                        {player.status && player.status !== 'activo' && (
                          <Badge className="bg-gray-700 text-white text-xs">{player.status === 'baja' ? 'Baja' : 'Inactivo'}</Badge>
                        )}
                        {player.category && (
                          <Badge variant="outline" className="mt-1">{player.category}</Badge>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {player.paidAmount > 0 && (
                          <span className="text-xs text-green-600 font-medium">Abonado: {formatCurrency(player.paidAmount)}</span>
                        )}
                        <div className="flex items-center gap-2 bg-red-100 px-3 py-1 rounded-lg">
                          <DollarSign className="w-4 h-4 text-red-600" />
                          <span className="font-bold text-red-600">Adeuda: {formatCurrency(player.pendingAmount)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                      <p className="font-semibold text-gray-900">{player.parent_name}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Phone className="w-4 h-4 text-blue-600" />
                          <a href={`tel:${player.parent_phone}`} className="hover:text-blue-600">
                            {player.parent_phone}
                          </a>
                        </div>
                        {player.parent_email && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Mail className="w-4 h-4 text-blue-600" />
                            <a href={`mailto:${player.parent_email}`} className="hover:text-blue-600">
                              {player.parent_email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-red-700">
                        {player.paidAmount > 0
                          ? `⚠️ Pago parcial para ${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)} — Cuota requerida: ${formatCurrency(player.requiredFee)}`
                          : `⚠️ Sin pago registrado para ${selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1)}`
                        }
                      </p>
                      {player.recargo > 0 && (
                        <p className="text-xs text-red-600 mt-1">Incluye recargo por pago tardío: {formatCurrency(player.recargo)} (vencido el día 15)</p>
                      )}
                      {player.waivedAmount > 0 && (
                        <p className="text-xs text-purple-600 mt-1">Condonado previamente: {formatCurrency(player.waivedAmount)}</p>
                      )}
                      {player.isHalfFee && (
                        <p className="text-xs text-orange-600 mt-1">
                          📅 Ingresó después del día 15 — aplica 50% de mensualidad ({formatCurrency(player.requiredFee)} de {formatCurrency(player.monthly_fee)})
                        </p>
                      )}
                    </div>
                    {onAbonar && (
                      <div className="mt-3 flex justify-end gap-2">
                        {onCondonar && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
                            onClick={() => onCondonar(player, selectedMonth, player.pendingAmount)}
                          >
                            Condonar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 gap-2"
                          onClick={() => onAbonar({ player, month: selectedMonth, pendingAmount: player.pendingAmount, payment_type: 'mensualidad' })}
                        >
                          <PlusCircle className="w-4 h-4" />
                          Abonar
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      </TabsContent>

      <TabsContent value="torneos" className="space-y-4">
        <TournamentDebtorsList players={players} onAbonarTorneo={onAbonar ? (info) => onAbonar({ ...info, isTournament: true }) : undefined} />
      </TabsContent>

      <TabsContent value="uniformes" className="space-y-4">
        <Card className="bg-yellow-50 border-2 border-yellow-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-500 rounded-lg">
                  <ShoppingBag className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Pagos de uniformes incompletos</p>
                  <p className="text-3xl font-bold text-yellow-600">{uniformDebtors.length}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Pendiente total</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {formatCurrency(uniformDebtors.reduce((sum, p) => sum + (p.pendienteAmount || 0), 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {uniformDebtors.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <ShoppingBag className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">¡Sin pendientes!</h3>
              <p className="text-gray-600">No hay pagos de uniformes pendientes</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3">
            {uniformDebtors.map((item) => (
              <Card key={item.id} className="border-2 border-yellow-200 hover:shadow-lg transition-all">
                <CardContent className="pt-4 pb-4">
                  <div className="flex flex-col md:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap mb-2">
                        <h3 className="text-base font-bold text-gray-900">{item.player.full_name}</h3>
                        {item.player.category && <Badge variant="outline">{item.player.category}</Badge>}
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 border">Pago pendiente</Badge>
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-600 mb-2">🛍️ {item.notes}</p>
                      )}
                      <div className="bg-gray-50 p-3 rounded-lg space-y-1">
                        <p className="font-semibold text-gray-800 text-sm">{item.player.parent_name}</p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2 text-gray-600">
                            <Phone className="w-4 h-4 text-blue-600" />
                            <a href={`tel:${item.player.parent_phone}`} className="hover:text-blue-600">{item.player.parent_phone}</a>
                          </div>
                          {item.player.parent_email && (
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4 text-blue-600" />
                              <a href={`mailto:${item.player.parent_email}`} className="hover:text-blue-600">{item.player.parent_email}</a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-center gap-2">
                      <span className="text-xs text-gray-500">Adeuda</span>
                      <span className="text-xl font-bold text-yellow-700">{formatCurrency(item.pendienteAmount)}</span>
                      {item.payment_date && (
                        <span className="text-xs text-gray-400">{item.payment_date.slice(0, 10).split('-').reverse().join('/')}</span>
                      )}
                      {onAbonar && (
                        <Button
                          size="sm"
                          className="bg-yellow-600 hover:bg-yellow-700 gap-2 mt-1"
                          onClick={() => onAbonar({ player: item.player, pendingAmount: item.pendienteAmount, payment_type: 'uniformes', month: 'uniformes', existingPaymentId: item.id })}
                        >
                          <PlusCircle className="w-4 h-4" />
                          Abonar
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}