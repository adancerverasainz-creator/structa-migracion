import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  CreditCard, ArrowDownToLine, Check, X, ChevronDown, ChevronUp,
  RefreshCw, Plus, AlertCircle, Users,
} from 'lucide-react'

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'
const fmt = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

const CHARGE_TYPE_LABEL = { inscription: 'Inscripción', arbitrage: 'Arbitraje', fine: 'Multa', other: 'Otro' }
const CHARGE_TYPE_COLOR = {
  inscription: 'bg-blue-50 text-blue-700',
  arbitrage:   'bg-purple-50 text-purple-700',
  fine:        'bg-red-50 text-red-600',
  other:       'bg-gray-100 text-gray-600',
}

// ─── Shared UI ───────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color, sub }) {
  const colors = {
    gray:   'bg-gray-50   text-gray-900',
    green:  'bg-green-50  text-green-800',
    red:    'bg-red-50    text-red-800',
    yellow: 'bg-yellow-50 text-yellow-800',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.gray}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminFinanzasTab({ tournament, teams, tournamentId, matches }) {
  const qc = useQueryClient()

  const [paymentModal,    setPaymentModal]    = useState(null)
  const [paymentForm,     setPaymentForm]     = useState({ amount: '', notes: '' })
  const [remittanceModal, setRemittanceModal] = useState(false)
  const [remittanceForm,  setRemittanceForm]  = useState({ amount: '', notes: '' })
  const [chargeModal,     setChargeModal]     = useState(false)
  const [chargeForm,      setChargeForm]      = useState({ team_id: '', type: 'other', description: '', amount: '' })
  const [inscModal,       setInscModal]       = useState(null)   // team object
  const [inscAmount,      setInscAmount]      = useState('')
  const [expandedTeam,    setExpandedTeam]    = useState(null)

  // ── Charges ─────────────────────────────────────────────────────────────────
  const { data: rawCharges = [], isLoading: chargesLoading } = useQuery({
    queryKey: ['charges', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charges')
        .select('*, payments(id, amount, paid_at, notes)')
        .eq('tournament_id', tournamentId)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  // Calcular saldos en cliente
  const charges = rawCharges.map(c => {
    const paid    = (c.payments ?? []).reduce((s, p) => s + Number(p.amount), 0)
    const balance = Number(c.amount) - paid
    return { ...c, paid, balance, is_paid: balance <= 0 }
  })

  // ── Remesas ─────────────────────────────────────────────────────────────────
  const { data: remittances = [] } = useQuery({
    queryKey: ['remittances', tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('remittances')
        .select('*')
        .eq('tournament_id', tournamentId)
        .order('remitted_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // ── Totales globales ─────────────────────────────────────────────────────────
  const totalCharged   = charges.reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid      = charges.reduce((s, c) => s + c.paid, 0)
  const totalPending   = totalCharged - totalPaid
  const totalRemitted  = remittances.reduce((s, r) => s + Number(r.amount), 0)
  const pendingDeliver = Math.max(0, totalPaid - totalRemitted)

  // ── Totales por tipo ─────────────────────────────────────────────────────────
  const inscCharges = charges.filter(c => c.type === 'inscription')
  const arbCharges  = charges.filter(c => c.type === 'arbitrage')
  const inscTotal   = inscCharges.reduce((s, c) => s + Number(c.amount), 0)
  const inscPaid    = inscCharges.reduce((s, c) => s + c.paid, 0)
  const arbTotal    = arbCharges.reduce((s, c) => s + Number(c.amount), 0)
  const arbPaid     = arbCharges.reduce((s, c) => s + c.paid, 0)

  // ── Inscripciones: equipos con/sin cargo ─────────────────────────────────────
  const teamsWithInscription    = new Set(inscCharges.map(c => c.team_id))
  const teamsMissingInscription = teams.filter(t => !teamsWithInscription.has(t.id))

  // ── Arbitraje: cargos faltantes en partidos existentes ───────────────────────
  const arbitrageMissing = (() => {
    if (!matches) return 0
    let count = 0
    for (const m of matches.filter(m => m.home_team_id && m.away_team_id)) {
      const homeTeam = teams.find(t => t.id === m.home_team_id)
      const awayTeam = teams.find(t => t.id === m.away_team_id)
      if (homeTeam?.pays_arbitrage !== false && !charges.some(c => c.match_id === m.id && c.team_id === m.home_team_id)) count++
      if (awayTeam?.pays_arbitrage !== false && !charges.some(c => c.match_id === m.id && c.team_id === m.away_team_id)) count++
    }
    return count
  })()

  // ── Mutations ────────────────────────────────────────────────────────────────

  // Sync retroactivo de arbitraje
  const syncArbitraje = useMutation({
    mutationFn: async () => {
      const fee = Number(tournament?.arbitrage_fee ?? 350)
      const realMatches = (matches || []).filter(m => m.home_team_id && m.away_team_id)
      const toInsert = []
      for (const m of realMatches) {
        const homeTeam = teams.find(t => t.id === m.home_team_id)
        const awayTeam = teams.find(t => t.id === m.away_team_id)
        if (homeTeam?.pays_arbitrage !== false && !charges.some(c => c.match_id === m.id && c.team_id === m.home_team_id)) {
          toInsert.push({
            tournament_id: tournamentId,
            team_id:       homeTeam.id,
            match_id:      m.id,
            type:          'arbitrage',
            amount:        fee,
            description:   `Arbitraje J${m.matchday} vs ${awayTeam?.name || ''}`,
          })
        }
        if (awayTeam?.pays_arbitrage !== false && !charges.some(c => c.match_id === m.id && c.team_id === m.away_team_id)) {
          toInsert.push({
            tournament_id: tournamentId,
            team_id:       awayTeam.id,
            match_id:      m.id,
            type:          'arbitrage',
            amount:        fee,
            description:   `Arbitraje J${m.matchday} vs ${homeTeam?.name || ''}`,
          })
        }
      }
      if (toInsert.length === 0) throw new Error('Todos los cargos de arbitraje ya están al corriente.')
      const { error } = await supabase.from('charges').insert(toInsert)
      if (error) throw error
      return toInsert.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['charges', tournamentId] })
      toast.success(`${count} cargo${count !== 1 ? 's' : ''} de arbitraje generado${count !== 1 ? 's' : ''}`)
    },
    onError: (e) => toast.error(e.message),
  })

  // Pago de un cargo
  const registerPayment = useMutation({
    mutationFn: async ({ chargeId, amount, notes }) => {
      const { error } = await supabase.from('payments').insert({
        charge_id: chargeId,
        amount:    Number(amount),
        notes:     notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges', tournamentId] })
      toast.success('Pago registrado')
      setPaymentModal(null)
    },
    onError: (e) => toast.error('Error al registrar pago: ' + e.message),
  })

  // Entrega a Adan
  const registerRemittance = useMutation({
    mutationFn: async ({ amount, notes }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('remittances').insert({
        tournament_id: tournamentId,
        from_user_id:  user?.id ?? null,
        amount:        Number(amount),
        notes:         notes || null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['remittances', tournamentId] })
      toast.success('Entrega registrada')
      setRemittanceModal(false)
    },
    onError: (e) => toast.error('Error al registrar entrega: ' + e.message),
  })

  // Cargo manual
  const addCharge = useMutation({
    mutationFn: async (form) => {
      if (!form.team_id) throw new Error('Selecciona un equipo')
      if (!form.amount || Number(form.amount) <= 0) throw new Error('El monto debe ser mayor a 0')
      const { error } = await supabase.from('charges').insert({
        tournament_id: tournamentId,
        team_id:       form.team_id,
        type:          form.type,
        description:   form.description || CHARGE_TYPE_LABEL[form.type],
        amount:        Number(form.amount),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges', tournamentId] })
      toast.success('Cargo agregado')
      setChargeModal(false)
      setChargeForm({ team_id: '', type: 'other', description: '', amount: '' })
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  // Inscripción rápida para un equipo
  const addInscription = useMutation({
    mutationFn: async ({ team, amount }) => {
      if (!amount || Number(amount) <= 0) throw new Error('El monto debe ser mayor a 0')
      const { error } = await supabase.from('charges').insert({
        tournament_id: tournamentId,
        team_id:       team.id,
        type:          'inscription',
        description:   'Inscripción',
        amount:        Number(amount),
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['charges', tournamentId] })
      toast.success('Cargo de inscripción agregado')
      setInscModal(null)
      setInscAmount('')
    },
    onError: (e) => toast.error('Error: ' + e.message),
  })

  function openPayment(charge) {
    setPaymentForm({ amount: charge.balance.toFixed(2), notes: '' })
    setPaymentModal(charge)
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (chargesLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Tarjetas resumen ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard
          label="Total cargado"
          value={fmt(totalCharged)}
          color="gray"
          sub={`Insc. ${fmt(inscTotal)} · Arb. ${fmt(arbTotal)}`}
        />
        <SummaryCard
          label="Cobrado"
          value={fmt(totalPaid)}
          color="green"
          sub={`${totalCharged > 0 ? Math.round(totalPaid / totalCharged * 100) : 0}% del total`}
        />
        <SummaryCard
          label="Pendiente de cobrar"
          value={fmt(totalPending)}
          color={totalPending > 0 ? 'red' : 'green'}
        />
        <SummaryCard
          label="Por entregar a Adan"
          value={fmt(pendingDeliver)}
          color={pendingDeliver > 0 ? 'yellow' : 'green'}
        />
      </div>

      {/* ── Alertas de acción ───────────────────────────────────────────────── */}
      {(arbitrageMissing > 0 || teamsMissingInscription.length > 0) && (
        <div className="space-y-2">
          {arbitrageMissing > 0 && (
            <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  <strong>{arbitrageMissing}</strong> cargo{arbitrageMissing !== 1 ? 's' : ''} de arbitraje
                  {' '}sin registrar — partidos existentes sin cargo
                </span>
              </div>
              <button
                onClick={() => syncArbitraje.mutate()}
                disabled={syncArbitraje.isPending}
                className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncArbitraje.isPending ? 'animate-spin' : ''}`} />
                {syncArbitraje.isPending ? 'Generando...' : 'Generar ahora'}
              </button>
            </div>
          )}
          {teamsMissingInscription.length > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
              <Users className="w-4 h-4 shrink-0" />
              <span>
                <strong>{teamsMissingInscription.length}</strong>{' '}
                equipo{teamsMissingInscription.length !== 1 ? 's' : ''} sin cargo de inscripción registrado
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Inscripciones ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Inscripciones</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {teams.filter(t => teamsWithInscription.has(t.id)).length} de {teams.length} equipos con cargo
            {inscTotal > 0 && ` · ${fmt(inscPaid)} cobrado de ${fmt(inscTotal)}`}
          </p>
        </div>
        {teams.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">No hay equipos en este torneo</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {teams.map(team => {
              const inscCharge = inscCharges.find(c => c.team_id === team.id)
              return (
                <li key={team.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color || '#16a34a' }} />
                  <span className="flex-1 text-sm font-medium text-gray-900">{team.name}</span>
                  {inscCharge ? (
                    <>
                      <span className="text-xs text-gray-500 shrink-0">{fmt(inscCharge.paid)} / {fmt(inscCharge.amount)}</span>
                      {inscCharge.is_paid ? (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Check className="w-3 h-3" /> Pagada
                        </span>
                      ) : (
                        <button
                          onClick={() => openPayment(inscCharge)}
                          className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors shrink-0"
                        >
                          + Pago
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => { setInscModal(team); setInscAmount('') }}
                      className="text-xs border border-blue-300 text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors shrink-0"
                    >
                      + Agregar cargo
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Cargos por equipo (todos los tipos) ─────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Cargos por equipo</h3>
            {arbTotal > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Arbitraje: {fmt(arbPaid)} cobrado de {fmt(arbTotal)}
              </p>
            )}
          </div>
          <button
            onClick={() => { setChargeForm({ team_id: '', type: 'other', description: '', amount: '' }); setChargeModal(true) }}
            className="flex items-center gap-1.5 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Cargo manual
          </button>
        </div>

        {charges.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
            Sin cargos — genera los arbitrajes y agrega inscripciones con los botones de arriba.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {teams.map(team => {
              const teamCharges = charges.filter(c => c.team_id === team.id)
              if (teamCharges.length === 0) return null
              const teamPaid    = teamCharges.reduce((s, c) => s + c.paid, 0)
              const teamCharged = teamCharges.reduce((s, c) => s + Number(c.amount), 0)
              const teamBalance = teamCharges.reduce((s, c) => s + c.balance, 0)
              const isExpanded  = expandedTeam === team.id

              return (
                <li key={team.id}>
                  <button
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color || '#16a34a' }} />
                    <span className="flex-1 text-sm font-medium text-gray-900">{team.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">{fmt(teamPaid)} / {fmt(teamCharged)}</span>
                    {teamBalance > 0
                      ? <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">{fmt(teamBalance)} pendiente</span>
                      : <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Check className="w-3 h-3" />Al corriente</span>
                    }
                    {isExpanded
                      ? <ChevronUp   className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {isExpanded && (
                    <ul className="border-t border-gray-100 divide-y divide-gray-50">
                      {teamCharges.map(c => (
                        <li key={c.id} className="flex items-center gap-3 px-8 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${CHARGE_TYPE_COLOR[c.type] ?? CHARGE_TYPE_COLOR.other}`}>
                            {CHARGE_TYPE_LABEL[c.type] ?? c.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">
                              {c.description || CHARGE_TYPE_LABEL[c.type]}
                            </p>
                            <p className="text-xs text-gray-400">
                              {fmt(c.paid)} cobrado de {fmt(c.amount)}
                              {c.paid > 0 && c.balance > 0 && ` · Falta ${fmt(c.balance)}`}
                            </p>
                          </div>
                          {c.is_paid ? (
                            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                              <Check className="w-3 h-3" /> Pagado
                            </span>
                          ) : (
                            <button
                              onClick={() => openPayment(c)}
                              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors shrink-0"
                            >
                              + Pago
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ── Entregas a Adan ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm text-gray-900">Entregas a Adan</h3>
            <p className="text-xs text-gray-400 mt-0.5">Total entregado: {fmt(totalRemitted)}</p>
          </div>
          {pendingDeliver > 0 && (
            <button
              onClick={() => { setRemittanceForm({ amount: pendingDeliver.toFixed(2), notes: '' }); setRemittanceModal(true) }}
              className="flex items-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              <ArrowDownToLine className="w-3.5 h-3.5" /> Registrar entrega
            </button>
          )}
        </div>
        {remittances.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">Sin entregas registradas</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {remittances.map(r => (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <ArrowDownToLine className="w-4 h-4 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{fmt(r.amount)}</p>
                  {r.notes && <p className="text-xs text-gray-400">{r.notes}</p>}
                </div>
                <span className="text-xs text-gray-400 shrink-0">
                  {new Date(r.remitted_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ═══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Registrar pago de cargo */}
      {paymentModal && (
        <Modal title="Registrar pago" onClose={() => setPaymentModal(null)}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
            <p className="font-semibold">{teams.find(t => t.id === paymentModal.team_id)?.name ?? '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {paymentModal.description || CHARGE_TYPE_LABEL[paymentModal.type] || 'Cargo'}
              {' · '}Pendiente: <strong>{fmt(paymentModal.balance)}</strong>
            </p>
          </div>
          <form
            onSubmit={e => { e.preventDefault(); registerPayment.mutate({ chargeId: paymentModal.id, ...paymentForm }) }}
            className="space-y-4"
          >
            <Field label="Monto recibido *">
              <input
                required type="number" min="0.01" step="0.01"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className={INPUT}
              />
              <p className="text-xs text-gray-400 mt-1">Máximo: {fmt(paymentModal.balance)}</p>
            </Field>
            <Field label="Notas">
              <input
                value={paymentForm.notes}
                onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                className={INPUT} placeholder="Ej. Pagó en efectivo antes del partido"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPaymentModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={registerPayment.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {registerPayment.isPending ? 'Guardando...' : 'Registrar pago'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Entrega a Adan */}
      {remittanceModal && (
        <Modal title="Registrar entrega a Adan" onClose={() => setRemittanceModal(false)}>
          <form
            onSubmit={e => { e.preventDefault(); registerRemittance.mutate(remittanceForm) }}
            className="space-y-4"
          >
            <Field label="Monto entregado *">
              <input
                required type="number" min="0.01" step="0.01"
                value={remittanceForm.amount}
                onChange={e => setRemittanceForm(f => ({ ...f, amount: e.target.value }))}
                className={INPUT}
              />
            </Field>
            <Field label="Notas">
              <input
                value={remittanceForm.notes}
                onChange={e => setRemittanceForm(f => ({ ...f, notes: e.target.value }))}
                className={INPUT} placeholder="Ej. Entrega semana 3"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setRemittanceModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={registerRemittance.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {registerRemittance.isPending ? 'Guardando...' : 'Registrar entrega'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Cargo manual */}
      {chargeModal && (
        <Modal title="Agregar cargo" onClose={() => setChargeModal(false)}>
          <form
            onSubmit={e => { e.preventDefault(); addCharge.mutate(chargeForm) }}
            className="space-y-4"
          >
            <Field label="Equipo *">
              <select
                required value={chargeForm.team_id}
                onChange={e => setChargeForm(f => ({ ...f, team_id: e.target.value }))}
                className={INPUT}
              >
                <option value="">Seleccionar...</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Tipo *">
              <select
                value={chargeForm.type}
                onChange={e => setChargeForm(f => ({ ...f, type: e.target.value }))}
                className={INPUT}
              >
                <option value="inscription">Inscripción</option>
                <option value="arbitrage">Arbitraje</option>
                <option value="fine">Multa</option>
                <option value="other">Otro</option>
              </select>
            </Field>
            <Field label="Descripción">
              <input
                value={chargeForm.description}
                onChange={e => setChargeForm(f => ({ ...f, description: e.target.value }))}
                className={INPUT} placeholder="Ej. Multa por indisciplina"
              />
            </Field>
            <Field label="Monto *">
              <input
                required type="number" min="0.01" step="0.01"
                value={chargeForm.amount}
                onChange={e => setChargeForm(f => ({ ...f, amount: e.target.value }))}
                className={INPUT} placeholder="350"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setChargeModal(false)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={addCharge.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {addCharge.isPending ? 'Guardando...' : 'Agregar cargo'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Inscripción rápida para un equipo */}
      {inscModal && (
        <Modal title={`Inscripción — ${inscModal.name}`} onClose={() => setInscModal(null)}>
          <form
            onSubmit={e => { e.preventDefault(); addInscription.mutate({ team: inscModal, amount: inscAmount }) }}
            className="space-y-4"
          >
            <Field label="Monto de inscripción *">
              <input
                required type="number" min="0.01" step="100"
                value={inscAmount}
                onChange={e => setInscAmount(e.target.value)}
                className={INPUT} placeholder="1500"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setInscModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={addInscription.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {addInscription.isPending ? 'Guardando...' : 'Agregar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
