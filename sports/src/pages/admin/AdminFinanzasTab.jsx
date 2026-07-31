import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { toast } from 'sonner'
import {
  CreditCard, ArrowDownToLine, Check, X, ChevronDown, ChevronUp
} from 'lucide-react'

const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500'

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

function SummaryCard({ label, value, color }) {
  const colors = {
    gray:   'bg-gray-50   text-gray-900',
    green:  'bg-green-50  text-green-800',
    red:    'bg-red-50    text-red-800',
    yellow: 'bg-yellow-50 text-yellow-800',
  }
  return (
    <div className={`rounded-xl p-4 ${colors[color] ?? colors.gray}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

const fmt = (n) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

export default function AdminFinanzasTab({ tournament, teams, tournamentId }) {
  const qc = useQueryClient()

  const [paymentModal, setPaymentModal]       = useState(null)   // charge with balance
  const [paymentForm, setPaymentForm]         = useState({ amount: '', notes: '' })
  const [remittanceModal, setRemittanceModal] = useState(false)
  const [remittanceForm, setRemittanceForm]   = useState({ amount: '', notes: '' })
  const [expandedTeam, setExpandedTeam]       = useState(null)

  // ── Charges (con pagos anidados) ────────────────────────────────────────────
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

  // Calcular saldos en el cliente (evita problemas de RLS en vistas)
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

  // ── Mutaciones ──────────────────────────────────────────────────────────────
  const registerPayment = useMutation({
    mutationFn: async ({ chargeId, amount, notes }) => {
      const { error } = await supabase.from('payments').insert({
        charge_id: chargeId,
        amount: Number(amount),
        notes: notes || null,
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

  const registerRemittance = useMutation({
    mutationFn: async ({ amount, notes }) => {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('remittances').insert({
        tournament_id: tournamentId,
        from_user_id: user?.id ?? null,
        amount: Number(amount),
        notes: notes || null,
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

  // ── Totales ─────────────────────────────────────────────────────────────────
  const totalCharged    = charges.reduce((s, c) => s + Number(c.amount), 0)
  const totalPaid       = charges.reduce((s, c) => s + c.paid, 0)
  const totalPending    = totalCharged - totalPaid
  const totalRemitted   = remittances.reduce((s, r) => s + Number(r.amount), 0)
  const pendingDeliver  = Math.max(0, totalPaid - totalRemitted)

  function openPayment(charge) {
    setPaymentForm({ amount: charge.balance.toFixed(2), notes: '' })
    setPaymentModal(charge)
  }

  if (chargesLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-6 h-6 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Tarjetas resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total cargado"        value={fmt(totalCharged)}   color="gray" />
        <SummaryCard label="Cobrado"              value={fmt(totalPaid)}      color="green" />
        <SummaryCard label="Pendiente de cobrar"  value={fmt(totalPending)}   color={totalPending  > 0 ? 'red'    : 'green'} />
        <SummaryCard label="Por entregar a Adan"  value={fmt(pendingDeliver)} color={pendingDeliver > 0 ? 'yellow' : 'green'} />
      </div>

      {/* Cargos por equipo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm text-gray-900">Cargos por equipo</h3>
        </div>

        {charges.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-30" />
            No hay cargos aún — se generan automáticamente al crear partidos y equipos.
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {teams.map(team => {
              const teamCharges = charges.filter(c => c.team_id === team.id)
              if (teamCharges.length === 0) return null

              const teamPaid    = teamCharges.reduce((s, c) => s + c.paid,          0)
              const teamCharged = teamCharges.reduce((s, c) => s + Number(c.amount), 0)
              const teamBalance = teamCharges.reduce((s, c) => s + c.balance,        0)
              const isExpanded  = expandedTeam === team.id

              return (
                <li key={team.id}>
                  {/* Fila del equipo (colapsable) */}
                  <button
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 text-left"
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: team.color || '#16a34a' }} />
                    <span className="flex-1 text-sm font-medium text-gray-900">{team.name}</span>
                    <span className="text-xs text-gray-500">{fmt(teamPaid)} / {fmt(teamCharged)}</span>
                    {teamBalance > 0
                      ? <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">{fmt(teamBalance)} pendiente</span>
                      : <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Check className="w-3 h-3" />Al corriente</span>
                    }
                    {isExpanded
                      ? <ChevronUp   className="w-4 h-4 text-gray-400 shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                  </button>

                  {/* Detalle de cargos */}
                  {isExpanded && (
                    <ul className="border-t border-gray-100 divide-y divide-gray-50">
                      {teamCharges.map(c => (
                        <li key={c.id} className="flex items-center gap-3 px-8 py-2.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-700">
                              {c.description || (c.type === 'arbitrage' ? 'Arbitraje' : 'Inscripción')}
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

      {/* Entregas a Adan */}
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
                <span className="text-xs text-gray-400">
                  {new Date(r.remitted_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Modal: Registrar pago ─────────────────────────────────────────── */}
      {paymentModal && (
        <Modal title="Registrar pago" onClose={() => setPaymentModal(null)}>
          <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            <p className="font-medium">{teams.find(t => t.id === paymentModal.team_id)?.name ?? '—'}</p>
            <p className="text-xs mt-0.5">
              {paymentModal.description || (paymentModal.type === 'arbitrage' ? 'Arbitraje' : 'Inscripción')}
              {' · '}Pendiente: <strong>{fmt(paymentModal.balance)}</strong>
            </p>
          </div>
          <form
            onSubmit={e => { e.preventDefault(); registerPayment.mutate({ chargeId: paymentModal.id, ...paymentForm }) }}
            className="space-y-4"
          >
            <Field label="Monto recibido *">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={paymentForm.amount}
                onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                className={INPUT}
              />
            </Field>
            <Field label="Notas">
              <input
                value={paymentForm.notes}
                onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
                className={INPUT}
                placeholder="Ej. Pagó en efectivo antes del partido"
              />
            </Field>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setPaymentModal(null)}
                className="flex-1 border border-gray-300 text-gray-700 font-medium py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button type="submit" disabled={registerPayment.isPending}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                {registerPayment.isPending ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Modal: Entrega a Adan ─────────────────────────────────────────── */}
      {remittanceModal && (
        <Modal title="Registrar entrega a Adan" onClose={() => setRemittanceModal(false)}>
          <form
            onSubmit={e => { e.preventDefault(); registerRemittance.mutate(remittanceForm) }}
            className="space-y-4"
          >
            <Field label="Monto entregado *">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={remittanceForm.amount}
                onChange={e => setRemittanceForm(f => ({ ...f, amount: e.target.value }))}
                className={INPUT}
              />
            </Field>
            <Field label="Notas">
              <input
                value={remittanceForm.notes}
                onChange={e => setRemittanceForm(f => ({ ...f, notes: e.target.value }))}
                className={INPUT}
                placeholder="Ej. Entrega semana 3"
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
    </div>
  )
}
