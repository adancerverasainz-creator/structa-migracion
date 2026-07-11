import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, TrendingUp, TrendingDown, DollarSign, Search, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from './lib/formatCurrency';

export default function FinancialSummary() {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState(currentMonth.toString());
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [expandedBanks, setExpandedBanks] = useState({});

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
  });

  const { data: generalPayments = [] } = useQuery({
    queryKey: ['generalPayments'],
    queryFn: () => base44.entities.GeneralPayment.list(),
  });

  const { data: tournamentPayments = [] } = useQuery({
    queryKey: ['tournamentPayments'],
    queryFn: () => base44.entities.TournamentPayment.list(),
  });

  const { data: leaguePayments = [] } = useQuery({
    queryKey: ['leaguePayments'],
    queryFn: () => base44.entities.LeaguePayment.list(),
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses'],
    queryFn: () => base44.entities.Expense.list(),
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => base44.entities.Player.list(),
  });

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => base44.entities.Team.list(),
  });

  const { data: cashRegisters = [] } = useQuery({
    queryKey: ['cashRegisters'],
    queryFn: () => base44.entities.CashRegister.list(),
  });

  const { data: summerCampPayments = [] } = useQuery({
    queryKey: ['summerCampPayments'],
    queryFn: () => base44.entities.SummerCampPayment.list(),
  });

  const months = [
    { value: '1', label: 'Enero' },
    { value: '2', label: 'Febrero' },
    { value: '3', label: 'Marzo' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Mayo' },
    { value: '6', label: 'Junio' },
    { value: '7', label: 'Julio' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Septiembre' },
    { value: '10', label: 'Octubre' },
    { value: '11', label: 'Noviembre' },
    { value: '12', label: 'Diciembre' },
  ];

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - 2 + i).toString());

  // Filtrar datos por mes y año seleccionados
  const filterByMonthYear = (date) => {
    if (!date) return false;
    const str = String(date);
    const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0];
    const parts = datePart.split('-').map(Number);
    if (parts.length < 3 || parts.some(isNaN)) return false;
    return parts[1] === parseInt(selectedMonth) && parts[0] === parseInt(selectedYear);
  };

  // Ingresos
  const monthPayments = payments.filter(p => p.payment_date && filterByMonthYear(p.payment_date));
  const monthGeneralPayments = generalPayments.filter(p => p.payment_date && filterByMonthYear(p.payment_date));
  const monthTournamentPayments = tournamentPayments.filter(p => p.payment_date && filterByMonthYear(p.payment_date));
  const monthLeaguePayments = leaguePayments.filter(p => p.payment_date && filterByMonthYear(p.payment_date));
  const monthSummerCampPayments = summerCampPayments.filter(p => p.payment_date && filterByMonthYear(p.payment_date));
  const monthCashRegisters = cashRegisters.filter(c => c.register_date && filterByMonthYear(c.register_date));

  // Helper: obtiene el monto real considerando paid_amount para torneos
  const getPaidAmount = (p) => (p.paid_amount ?? p.amount) || 0;

  const totalPlayerPayments = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalGeneralPayments = monthGeneralPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalTournamentPayments = monthTournamentPayments.reduce((sum, p) => sum + getPaidAmount(p), 0);
  const totalLeaguePayments = monthLeaguePayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalSummerCampPayments = monthSummerCampPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCashRegisters = monthCashRegisters.reduce((sum, c) => sum + (c.cash_amount || 0), 0);

  const totalIncome = totalPlayerPayments + totalGeneralPayments + totalTournamentPayments + totalLeaguePayments + totalSummerCampPayments + totalCashRegisters;

  // Desglose de ingresos por método de pago
  const incomeByMethod = {
    efectivo: {
      payments: monthPayments.filter(p => p.payment_method === 'efectivo'),
      general: monthGeneralPayments.filter(p => p.payment_method === 'efectivo'),
      tournaments: monthTournamentPayments.filter(p => p.payment_method === 'efectivo'),
      league: monthLeaguePayments.filter(p => p.payment_method === 'efectivo'),
      summerCamp: monthSummerCampPayments.filter(p => p.payment_method === 'efectivo'),
    },
    tarjeta: {
      payments: monthPayments.filter(p => p.payment_method === 'tarjeta'),
      general: monthGeneralPayments.filter(p => p.payment_method === 'tarjeta'),
      tournaments: monthTournamentPayments.filter(p => p.payment_method === 'tarjeta'),
      league: monthLeaguePayments.filter(p => p.payment_method === 'tarjeta'),
      summerCamp: monthSummerCampPayments.filter(p => p.payment_method === 'tarjeta'),
    },
    transferencia: {
      payments: monthPayments.filter(p => p.payment_method === 'transferencia'),
      general: monthGeneralPayments.filter(p => p.payment_method === 'transferencia'),
      tournaments: monthTournamentPayments.filter(p => p.payment_method === 'transferencia'),
      league: monthLeaguePayments.filter(p => p.payment_method === 'transferencia'),
      summerCamp: monthSummerCampPayments.filter(p => p.payment_method === 'transferencia'),
    },
  };

  const calculateMethodTotal = (method) => {
    return (
      incomeByMethod[method].payments.reduce((sum, p) => sum + (p.amount || 0), 0) +
      incomeByMethod[method].general.reduce((sum, p) => sum + (p.amount || 0), 0) +
      incomeByMethod[method].tournaments.reduce((sum, p) => sum + getPaidAmount(p), 0) +
      incomeByMethod[method].league.reduce((sum, p) => sum + (p.amount || 0), 0) +
      incomeByMethod[method].summerCamp.reduce((sum, p) => sum + (p.amount || 0), 0)
    );
  };

  // Desglose de transferencias por banco
  const allTransfers = [
    ...incomeByMethod.transferencia.payments,
    ...incomeByMethod.transferencia.general,
    ...incomeByMethod.transferencia.tournaments,
    ...incomeByMethod.transferencia.league
  ];

  const transferByBank = {
    BBVA: allTransfers.filter(p => p.bank_name === 'BBVA'),
    MP: allTransfers.filter(p => p.bank_name === 'MP'),
    NU: allTransfers.filter(p => p.bank_name === 'NU'),
    OpenBank: allTransfers.filter(p => p.bank_name === 'OpenBank'),
    MercadoPagoBIA: allTransfers.filter(p => p.bank_name === 'MercadoPagoBIA'),
  };

  const calculateBankTotal = (bank) => {
    return transferByBank[bank].reduce((sum, p) => sum + getPaidAmount(p), 0);
  };

  // Desglose por banco y tipo de pago
  const getBankBreakdown = (bankName) => ({
    payments: incomeByMethod.transferencia.payments.filter(p => p.bank_name === bankName),
    general: incomeByMethod.transferencia.general.filter(p => p.bank_name === bankName),
    tournaments: incomeByMethod.transferencia.tournaments.filter(p => p.bank_name === bankName),
    league: incomeByMethod.transferencia.league.filter(p => p.bank_name === bankName),
  });

  // Egresos
  const monthExpenses = expenses.filter(e => e.expense_date && filterByMonthYear(e.expense_date));
  const totalExpenses = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Balance
  const balance = totalIncome - totalExpenses;

  // Buscar pagos por jugador o fecha
  const getPlayerName = (playerId) => {
    const player = players.find(p => p.id === playerId);
    return player?.full_name || 'Desconocido';
  };

  const getTeamName = (teamId) => {
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Desconocido';
  };

  const allPaymentsWithDetails = [
    ...monthPayments.map(p => ({
      ...p,
      type: 'Pago Mensual',
      playerName: getPlayerName(p.player_id),
      date: p.payment_date,
    })),
    ...monthTournamentPayments.map(p => ({
      ...p,
      type: 'Pago de Torneo',
      playerName: getPlayerName(p.player_id),
      date: p.payment_date,
    })),
    ...monthLeaguePayments.map(p => ({
      ...p,
      type: p.payment_type === 'inscripcion' ? 'Inscripción Liga' : 'Arbitraje Liga',
      teamName: getTeamName(p.team_id),
      date: p.payment_date,
    })),
    ...monthGeneralPayments.map(p => ({
      ...p,
      type: 'Pago General',
      date: p.payment_date,
    })),
    ...monthSummerCampPayments.map(p => ({
      ...p,
      type: 'Pago Summer Camp',
      playerName: p.player_name || getPlayerName(p.player_id),
      date: p.payment_date,
    })),
  ];

  const searchResults = allPaymentsWithDetails.filter(payment => {
    const searchLower = searchTerm.toLowerCase();
    const matchesPlayer = payment.playerName?.toLowerCase().includes(searchLower);
    const matchesTeam = payment.teamName?.toLowerCase().includes(searchLower);
    const matchesDate = payment.date?.includes(searchTerm);
    const matchesConcept = payment.concept?.toLowerCase().includes(searchLower);
    const matchesType = payment.type?.toLowerCase().includes(searchLower);
    return matchesPlayer || matchesTeam || matchesDate || matchesConcept || matchesType;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const toggleBank = (bankName) => {
    setExpandedBanks(prev => ({ ...prev, [bankName]: !prev[bankName] }));
  };

  // Helper para formatear fechas de forma segura
  const formatSafeDate = (dateString) => {
    if (!dateString) return '';
    try {
      const clean = String(dateString).split('T')[0]; // quitar componente de hora si existe
      const date = new Date(clean + 'T00:00:00');
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  return (
    <Card className="shadow-lg border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-600" />
          Resumen Financiero por Mes y Año
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selectores */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Mes</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Año</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Buscador de pagos */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-gray-700 block">Buscar Pagos en este Período</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar por jugador, equipo, fecha o concepto..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSearchResults(e.target.value.length > 0);
              }}
              className="pl-9"
            />
          </div>
          
          {showSearchResults && searchResults.length > 0 && (
            <div className="border rounded-lg p-4 bg-blue-50 max-h-96 overflow-y-auto">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900">Resultados ({searchResults.length})</h4>
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setShowSearchResults(false);
                  }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Limpiar
                </button>
              </div>
              <div className="space-y-2">
                {searchResults.map((payment, index) => (
                  <div key={index} className="bg-white p-3 rounded border">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">{payment.type}</Badge>
                          {payment.playerName && <span className="font-semibold text-gray-900">{payment.playerName}</span>}
                          {payment.teamName && <span className="font-semibold text-gray-900">{payment.teamName}</span>}
                          {payment.concept && <span className="font-semibold text-gray-900">{payment.concept}</span>}
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                          {payment.date && formatSafeDate(payment.date) && <span>Fecha: {formatSafeDate(payment.date)}</span>}
                          <span>Método: {payment.payment_method}</span>
                          {payment.bank_name && <span>Banco: {payment.bank_name}</span>}
                          {payment.month && <span>Mes: {payment.month}</span>}
                        </div>
                      </div>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {showSearchResults && searchResults.length === 0 && (
            <div className="border rounded-lg p-4 bg-gray-50 text-center text-gray-500">
              No se encontraron pagos que coincidan con "{searchTerm}"
            </div>
          )}
        </div>

        {/* Ingresos */}
        <Tabs defaultValue="total" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="total">Total</TabsTrigger>
            <TabsTrigger value="efectivo">Efectivo</TabsTrigger>
            <TabsTrigger value="tarjeta">Tarjeta</TabsTrigger>
            <TabsTrigger value="transferencia">Transferencia</TabsTrigger>
          </TabsList>

          <TabsContent value="total" className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Ingresos Totales
            </h3>
            <div className="space-y-2 pl-6">
            {/* Pagos de Jugadores */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('playerPayments')}
                className="w-full flex justify-between items-center p-2 bg-green-50 rounded border border-green-200 hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Pagos de Jugadores</span>
                  {monthPayments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{monthPayments.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(totalPlayerPayments)}</span>
                  {monthPayments.length > 0 && (
                    expandedSections.playerPayments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>
              {expandedSections.playerPayments && monthPayments.length > 0 && (
                <div className="ml-4 space-y-1">
                  {monthPayments.map((payment) => (
                    <div key={payment.id} className="bg-white p-2 rounded border text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="font-semibold">{getPlayerName(payment.player_id)}</span>
                          <div className="text-gray-600 mt-1">
                            {payment.payment_date && formatSafeDate(payment.payment_date) && (
                              <>
                                <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                {' • '}
                              </>
                            )}
                            <span>{payment.payment_method}</span>
                            {payment.bank_name && <span> • {payment.bank_name}</span>}
                          </div>
                        </div>
                        <span className="font-bold text-green-600">{formatCurrency(payment.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagos Generales */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('generalPayments')}
                className="w-full flex justify-between items-center p-2 bg-green-50 rounded border border-green-200 hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Pagos Generales</span>
                  {monthGeneralPayments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{monthGeneralPayments.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(totalGeneralPayments)}</span>
                  {monthGeneralPayments.length > 0 && (
                    expandedSections.generalPayments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>
              {expandedSections.generalPayments && monthGeneralPayments.length > 0 && (
                <div className="ml-4 space-y-1">
                  {monthGeneralPayments.map((payment) => (
                    <div key={payment.id} className="bg-white p-2 rounded border text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="font-semibold">{payment.concept}</span>
                          <div className="text-gray-600 mt-1">
                            {payment.payment_date && formatSafeDate(payment.payment_date) && (
                              <>
                                <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                {' • '}
                              </>
                            )}
                            <span>{payment.payment_method}</span>
                            {payment.bank_name && <span> • {payment.bank_name}</span>}
                          </div>
                        </div>
                        <span className="font-bold text-green-600">{formatCurrency(payment.amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagos de Torneos */}
            <div className="space-y-2">
              <button
                onClick={() => toggleSection('tournamentPayments')}
                className="w-full flex justify-between items-center p-2 bg-green-50 rounded border border-green-200 hover:bg-green-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700">Pagos de Torneos</span>
                  {monthTournamentPayments.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{monthTournamentPayments.length}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-green-600">{formatCurrency(totalTournamentPayments)}</span>
                  {monthTournamentPayments.length > 0 && (
                    expandedSections.tournamentPayments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </button>
              {expandedSections.tournamentPayments && monthTournamentPayments.length > 0 && (
                <div className="ml-4 space-y-1">
                  {monthTournamentPayments.map((payment) => (
                    <div key={payment.id} className="bg-white p-2 rounded border text-xs">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <span className="font-semibold">{getPlayerName(payment.player_id)}</span>
                          <div className="text-gray-600 mt-1">
                            {payment.payment_date && formatSafeDate(payment.payment_date) && (
                              <>
                                <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                {' • '}
                              </>
                            )}
                            <span>{payment.payment_method}</span>
                            {payment.bank_name && <span> • {payment.bank_name}</span>}
                          </div>
                        </div>
                        <span className="font-bold text-green-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                        </div>
                        </div>
                        ))}
                        </div>
                        )}
                        </div>

                        {/* Pagos de Liga */}
                        <div className="space-y-2">
                          <button
                            onClick={() => toggleSection('leaguePayments')}
                            className="w-full flex justify-between items-center p-2 bg-green-50 rounded border border-green-200 hover:bg-green-100 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-700">Pagos de Liga</span>
                              {monthLeaguePayments.length > 0 && (
                                <Badge variant="secondary" className="text-xs">{monthLeaguePayments.length}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-green-600">{formatCurrency(totalLeaguePayments)}</span>
                              {monthLeaguePayments.length > 0 && (
                                expandedSections.leaguePayments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                              )}
                            </div>
                          </button>
                          {expandedSections.leaguePayments && monthLeaguePayments.length > 0 && (
                            <div className="ml-4 space-y-1">
                              {monthLeaguePayments.map((payment) => (
                                <div key={payment.id} className="bg-white p-2 rounded border text-xs">
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold">{getTeamName(payment.team_id)}</span>
                                        <Badge variant="outline" className="text-xs">
                                          {payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}
                                        </Badge>
                                      </div>
                                      <div className="text-gray-600 mt-1">
                                        {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                          <>
                                            <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                            {' • '}
                                          </>
                                        )}
                                        <span>{payment.payment_method}</span>
                                        {payment.bank_name && <span> • {payment.bank_name}</span>}
                                      </div>
                                    </div>
                                    <span className="font-bold text-green-600">{formatCurrency(payment.amount)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pagos Summer Camp */}
                        <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                          <span className="text-sm text-gray-700">Pagos Summer Camp</span>
                          <span className="text-sm font-semibold text-green-600">{formatCurrency(totalSummerCampPayments)}</span>
                        </div>

                        {/* Cortes de Caja */}
            <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
              <span className="text-sm text-gray-700">Cortes de Caja</span>
              <span className="text-sm font-semibold text-green-600">{formatCurrency(totalCashRegisters)}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-green-100 rounded border-2 border-green-300">
              <span className="font-bold text-gray-900">Total Ingresos</span>
              <span className="text-lg font-bold text-green-600">{formatCurrency(totalIncome)}</span>
            </div>
            </div>
          </TabsContent>

          <TabsContent value="efectivo" className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Ingresos en Efectivo
            </h3>
            <div className="space-y-2 pl-6">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Jugadores</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.efectivo.payments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.efectivo.payments.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos Generales</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.efectivo.general.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.efectivo.general.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Torneos</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.efectivo.tournaments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.efectivo.tournaments.reduce((sum, p) => sum + getPaidAmount(p), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Liga</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.efectivo.league.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.efectivo.league.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Summer Camp</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.efectivo.summerCamp.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.efectivo.summerCamp.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Cortes de Caja</span>
                  <span className="text-xs text-gray-500 ml-2">({monthCashRegisters.length} entradas)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(totalCashRegisters)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-100 rounded border-2 border-green-300">
                <span className="font-bold text-gray-900">Total Efectivo</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(calculateMethodTotal('efectivo') + totalCashRegisters)}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="tarjeta" className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Ingresos por Tarjeta
            </h3>
            <div className="space-y-2 pl-6">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Jugadores</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.tarjeta.payments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.tarjeta.payments.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos Generales</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.tarjeta.general.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.tarjeta.general.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Torneos</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.tarjeta.tournaments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.tarjeta.tournaments.reduce((sum, p) => sum + getPaidAmount(p), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Liga</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.tarjeta.league.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.tarjeta.league.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Summer Camp</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.tarjeta.summerCamp.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.tarjeta.summerCamp.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-100 rounded border-2 border-green-300">
                <span className="font-bold text-gray-900">Total Tarjeta</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(calculateMethodTotal('tarjeta'))}</span>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="transferencia" className="space-y-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-600" />
              Ingresos por Transferencia
            </h3>
            <div className="space-y-2 pl-6">
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Jugadores</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.transferencia.payments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.transferencia.payments.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos Generales</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.transferencia.general.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.transferencia.general.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Torneos</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.transferencia.tournaments.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.transferencia.tournaments.reduce((sum, p) => sum + getPaidAmount(p), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Pagos de Liga</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.transferencia.league.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.transferencia.league.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-green-50 rounded border border-green-200">
                <div>
                  <span className="text-sm text-gray-700">Summer Camp</span>
                  <span className="text-xs text-gray-500 ml-2">({incomeByMethod.transferencia.summerCamp.length} pagos)</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{formatCurrency(incomeByMethod.transferencia.summerCamp.reduce((sum, p) => sum + (p.amount || 0), 0))}</span>
              </div>

               <div className="pt-2 space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">Por Banco</p>
                
                {/* BBVA */}
                <div className="space-y-1">
                  <button
                    onClick={() => toggleBank('BBVA')}
                    className="w-full flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-semibold">BBVA</span>
                      <span className="text-xs text-gray-500">({transferByBank.BBVA.length} pagos)</span>
                      {expandedBanks.BBVA ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{formatCurrency(calculateBankTotal('BBVA'))}</span>
                  </button>
                  {expandedBanks.BBVA && (
                    <div className="pl-4 space-y-1">
                      {getBankBreakdown('BBVA').payments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Jugador</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                {payment.month && <span> • Mes: {payment.month}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('BBVA').general.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">General</Badge>
                                <span className="text-xs font-semibold">{payment.concept}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('BBVA').tournaments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Torneo</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('BBVA').league.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Liga</Badge>
                                <span className="text-xs font-semibold">{getTeamName(payment.team_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                <span> • {payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* MP */}
                <div className="space-y-1">
                  <button
                    onClick={() => toggleBank('MP')}
                    className="w-full flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-semibold">MP</span>
                      <span className="text-xs text-gray-500">({transferByBank.MP.length} pagos)</span>
                      {expandedBanks.MP ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{formatCurrency(calculateBankTotal('MP'))}</span>
                  </button>
                  {expandedBanks.MP && (
                    <div className="pl-4 space-y-1">
                      {getBankBreakdown('MP').payments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Jugador</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                {payment.month && <span> • Mes: {payment.month}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('MP').general.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">General</Badge>
                                <span className="text-xs font-semibold">{payment.concept}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('MP').tournaments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Torneo</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('MP').league.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Liga</Badge>
                                <span className="text-xs font-semibold">{getTeamName(payment.team_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                <span> • {payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* NU */}
                <div className="space-y-1">
                  <button
                    onClick={() => toggleBank('NU')}
                    className="w-full flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-semibold">NU</span>
                      <span className="text-xs text-gray-500">({transferByBank.NU.length} pagos)</span>
                      {expandedBanks.NU ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{formatCurrency(calculateBankTotal('NU'))}</span>
                  </button>
                  {expandedBanks.NU && (
                    <div className="pl-4 space-y-1">
                      {getBankBreakdown('NU').payments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Jugador</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                {payment.month && <span> • Mes: {payment.month}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('NU').general.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">General</Badge>
                                <span className="text-xs font-semibold">{payment.concept}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('NU').tournaments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Torneo</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('NU').league.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Liga</Badge>
                                <span className="text-xs font-semibold">{getTeamName(payment.team_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                <span> • {payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* OpenBank */}
                <div className="space-y-1">
                  <button
                    onClick={() => toggleBank('OpenBank')}
                    className="w-full flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-semibold">OpenBank</span>
                      <span className="text-xs text-gray-500">({transferByBank.OpenBank.length} pagos)</span>
                      {expandedBanks.OpenBank ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{formatCurrency(calculateBankTotal('OpenBank'))}</span>
                  </button>
                  {expandedBanks.OpenBank && (
                    <div className="pl-4 space-y-1">
                      {getBankBreakdown('OpenBank').payments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Jugador</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                {payment.month && <span> • Mes: {payment.month}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('OpenBank').general.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">General</Badge>
                                <span className="text-xs font-semibold">{payment.concept}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.paid_amount ?? payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('OpenBank').tournaments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Torneo</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('OpenBank').league.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Liga</Badge>
                                <span className="text-xs font-semibold">{getTeamName(payment.team_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                <span> • {payment.payment_type === 'inscripcion' ? 'Inscripción' : 'Arbitraje'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    )}
                    </div>
                    {/* MercadoPagoBIA */}
                <div className="space-y-1">
                  <button
                    onClick={() => toggleBank('MercadoPagoBIA')}
                    className="w-full flex justify-between items-center p-2 bg-purple-50 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700 font-semibold">Mercado Pago BIA</span>
                      <span className="text-xs text-gray-500">({transferByBank.MercadoPagoBIA.length} pagos)</span>
                      {expandedBanks.MercadoPagoBIA ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-semibold text-purple-600">{formatCurrency(calculateBankTotal('MercadoPagoBIA'))}</span>
                  </button>
                  {expandedBanks.MercadoPagoBIA && (
                    <div className="pl-4 space-y-1">
                      {getBankBreakdown('MercadoPagoBIA').payments.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Jugador</Badge>
                                <span className="text-xs font-semibold">{getPlayerName(payment.player_id)}</span>
                              </div>
                              <div className="text-xs text-gray-600 mt-1">
                                {payment.payment_date && formatSafeDate(payment.payment_date) && (
                                  <span>Fecha: {formatSafeDate(payment.payment_date)}</span>
                                )}
                                {payment.month && <span> • Mes: {payment.month}</span>}
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                      {getBankBreakdown('MercadoPagoBIA').general.map((payment) => (
                        <div key={payment.id} className="bg-purple-50/50 p-2 rounded border border-purple-100">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">General</Badge>
                                <span className="text-xs font-semibold">{payment.concept}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-purple-600">{formatCurrency(payment.amount)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-green-100 rounded border-2 border-green-300">
                <span className="font-bold text-gray-900">Total Transferencia</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(calculateMethodTotal('transferencia'))}</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Egresos */}
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-600" />
            Egresos
          </h3>
          <div className="pl-6">
            <div className="flex justify-between items-center p-3 bg-red-100 rounded border-2 border-red-300">
              <span className="font-bold text-gray-900">Total Egresos</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(totalExpenses)}</span>
            </div>
          </div>
        </div>

        {/* Balance */}
        <div className="pt-4 border-t-2">
          <div className={`flex justify-between items-center p-4 rounded-lg ${
            balance >= 0 ? 'bg-blue-100 border-2 border-blue-300' : 'bg-orange-100 border-2 border-orange-300'
          }`}>
            <div className="flex items-center gap-2">
              <DollarSign className={`w-6 h-6 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              <span className="text-xl font-bold text-gray-900">Balance</span>
            </div>
            <span className={`text-2xl font-bold ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              {formatCurrency(balance)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}