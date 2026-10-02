/**
 * TournamentPrint.jsx
 * Route: /admin/torneo/:id/print/:type
 * type = standings | fixture | credenciales | estado-cuenta
 *
 * Opens in a new tab and calls window.print() automatically.
 */
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

const fmt = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const fmtTime = (t) => t ? t.slice(0, 5) : ''

export default function TournamentPrint() {
  const { id, type } = useParams()

  const { data: tournament } = useQuery({
    queryKey: ['print-tournament', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('tournaments').select('*').eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const { data: teams = [] } = useQuery({
    queryKey: ['print-teams', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*, players(*)')
        .eq('tournament_id', id)
        .order('name')
      if (error) throw error
      return data
    },
  })

  const { data: matches = [] } = useQuery({
    queryKey: ['print-matches', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('matches')
        .select('*, home_team:teams!matches_home_team_id_fkey(name,color), away_team:teams!matches_away_team_id_fkey(name,color), categories(name)')
        .eq('tournament_id', id)
        .order('matchday')
        .order('match_date')
        .order('match_time')
      if (error) throw error
      return data
    },
  })

  const { data: standings = [] } = useQuery({
    queryKey: ['print-standings', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_standings')
        .select('*')
        .eq('tournament_id', id)
        .order('category_id')
        .order('points', { ascending: false })
        .order('goal_diff', { ascending: false })
        .order('goals_for', { ascending: false })
      if (error) throw error
      return data
    },
  })

  const { data: charges = [] } = useQuery({
    queryKey: ['print-charges', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charges')
        .select('*, teams(name), payments(amount)')
        .eq('tournament_id', id)
        .order('created_at')
      if (error) throw error
      return data
    },
  })

  const isReady = tournament && (
    (type === 'standings' && standings.length >= 0) ||
    (type === 'fixture' && matches.length >= 0) ||
    (type === 'credenciales' && teams.length >= 0) ||
    (type === 'estado-cuenta' && charges.length >= 0)
  )

  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => window.print(), 800)
      return () => clearTimeout(timer)
    }
  }, [isReady])

  if (!tournament) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400">
        Cargando…
      </div>
    )
  }

  const orgName = tournament.name

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          @page { margin: 1.5cm; size: letter; }
        }
        body { font-family: system-ui, sans-serif; color: #111; background: white; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; font-size: 12px; }
        th { background: #14532d; color: white; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        h1 { font-size: 20px; font-weight: 800; margin: 0 0 4px; }
        h2 { font-size: 15px; font-weight: 700; margin: 16px 0 6px; color: #14532d; }
        .subtitle { font-size: 12px; color: #6b7280; margin: 0 0 16px; }
        .header { border-bottom: 3px solid #14532d; padding-bottom: 12px; margin-bottom: 20px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 600; }
        .badge-paid { background: #d1fae5; color: #065f46; }
        .badge-partial { background: #fef3c7; color: #92400e; }
        .badge-unpaid { background: #fee2e2; color: #991b1b; }
        .cred-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .cred-card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; break-inside: avoid; }
        .cred-card h3 { font-size: 13px; font-weight: 700; margin: 0 0 4px; }
        .cred-card .team { font-size: 11px; color: #6b7280; margin: 0 0 8px; }
        .cred-player { font-size: 11px; margin: 2px 0; }
        .print-hint { background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 13px; color: #166534; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>

        {/* Print hint — hidden when printing */}
        <div className="no-print print-hint">
          🖨️ El diálogo de impresión se abrirá automáticamente. También puedes presionar <strong>Ctrl+P</strong> (o ⌘+P en Mac).
          Para guardar como PDF, elige "Guardar como PDF" en el diálogo de impresión.
        </div>

        <div className="header">
          <h1>{orgName}</h1>
          <p className="subtitle">
            {type === 'standings' && 'Tabla de posiciones'}
            {type === 'fixture' && 'Fixture / Calendario'}
            {type === 'credenciales' && 'Credenciales de jugadores'}
            {type === 'estado-cuenta' && 'Estado de cuenta — Cobros y pagos'}
            {' · '}Generado {new Date().toLocaleDateString('es-MX')}
          </p>
        </div>

        {/* ── STANDINGS ─────────────────────────────────────────────────── */}
        {type === 'standings' && (() => {
          const byCategory = standings.reduce((acc, row) => {
            const key = row.category_name || 'General'
            if (!acc[key]) acc[key] = []
            acc[key].push(row)
            return acc
          }, {})
          return Object.entries(byCategory).map(([cat, rows]) => (
            <div key={cat}>
              <h2>{cat}</h2>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th style={{textAlign:'center'}}>PJ</th>
                    <th style={{textAlign:'center'}}>G</th>
                    <th style={{textAlign:'center'}}>E</th>
                    <th style={{textAlign:'center'}}>P</th>
                    <th style={{textAlign:'center'}}>GF</th>
                    <th style={{textAlign:'center'}}>GC</th>
                    <th style={{textAlign:'center'}}>DG</th>
                    <th style={{textAlign:'center'}}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.team_id}>
                      <td style={{textAlign:'center'}}>{i + 1}</td>
                      <td style={{fontWeight: i < 2 ? '700' : '400'}}>{r.team_name}</td>
                      <td style={{textAlign:'center'}}>{r.played}</td>
                      <td style={{textAlign:'center'}}>{r.won}</td>
                      <td style={{textAlign:'center'}}>{r.drawn}</td>
                      <td style={{textAlign:'center'}}>{r.lost}</td>
                      <td style={{textAlign:'center'}}>{r.goals_for}</td>
                      <td style={{textAlign:'center'}}>{r.goals_against}</td>
                      <td style={{textAlign:'center'}}>{r.goal_diff >= 0 ? '+' : ''}{r.goal_diff}</td>
                      <td style={{textAlign:'center', fontWeight:'700'}}>{r.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        })()}

        {/* ── FIXTURE ───────────────────────────────────────────────────── */}
        {type === 'fixture' && (() => {
          const byMatchday = matches.reduce((acc, m) => {
            const key = m.matchday ?? 'Sin jornada'
            if (!acc[key]) acc[key] = []
            acc[key].push(m)
            return acc
          }, {})
          return Object.entries(byMatchday).map(([jornada, rows]) => (
            <div key={jornada}>
              <h2>Jornada {jornada}</h2>
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Local</th>
                    <th style={{textAlign:'center'}}>Resultado</th>
                    <th>Visitante</th>
                    <th>Campo</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(m => (
                    <tr key={m.id}>
                      <td>{fmt(m.match_date)}</td>
                      <td>{fmtTime(m.match_time)}</td>
                      <td>{m.home_team?.name || m.home_team_name || '—'}</td>
                      <td style={{textAlign:'center', fontWeight:'700'}}>
                        {m.status === 'completed' || m.status === 'forfait'
                          ? `${m.home_goals ?? 0} - ${m.away_goals ?? 0}`
                          : m.status === 'no_show' ? 'N/P'
                          : '— - —'}
                      </td>
                      <td>{m.away_team?.name || m.away_team_name || '—'}</td>
                      <td>{m.field || '—'}</td>
                      <td>{m.status === 'completed' ? 'Finalizado' : m.status === 'scheduled' ? 'Pendiente' : m.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        })()}

        {/* ── CREDENCIALES ──────────────────────────────────────────────── */}
        {type === 'credenciales' && (
          <div className="cred-grid">
            {teams.map(team => (
              <div key={team.id} className="cred-card" style={{ borderTop: `4px solid ${team.color || '#14532d'}` }}>
                <h3>{team.name}</h3>
                {team.captain_name && <p className="team">Capitán: {team.captain_name}</p>}
                {(team.players || []).sort((a,b) => (a.number||99) - (b.number||99)).map(p => (
                  <p key={p.id} className="cred-player">
                    <span style={{fontWeight:'600', minWidth:24, display:'inline-block'}}>
                      {p.number ? `#${p.number}` : '—'}
                    </span>
                    {' '}{p.name}
                    {p.position ? <span style={{color:'#9ca3af'}}> · {p.position}</span> : ''}
                  </p>
                ))}
                {(!team.players || team.players.length === 0) && (
                  <p className="cred-player" style={{color:'#9ca3af'}}>Sin jugadores registrados</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── ESTADO DE CUENTA ──────────────────────────────────────────── */}
        {type === 'estado-cuenta' && (() => {
          const byTeam = charges.reduce((acc, c) => {
            const key = c.teams?.name || c.team_id
            if (!acc[key]) acc[key] = []
            acc[key].push(c)
            return acc
          }, {})

          return (
            <>
              {Object.entries(byTeam).map(([teamName, teamCharges]) => {
                const totalAmount = teamCharges.reduce((s, c) => s + (c.amount || 0), 0)
                const totalPaid = teamCharges.reduce((s, c) => s + (c.payments || []).reduce((ps, p) => ps + (p.amount || 0), 0), 0)
                const balance = totalAmount - totalPaid
                const statusClass = balance <= 0 ? 'badge-paid' : totalPaid > 0 ? 'badge-partial' : 'badge-unpaid'
                const statusLabel = balance <= 0 ? 'Al corriente' : totalPaid > 0 ? 'Parcial' : 'Pendiente'

                return (
                  <div key={teamName} style={{marginBottom: 20}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4}}>
                      <h2 style={{margin:0}}>{teamName}</h2>
                      <span className={`badge ${statusClass}`}>{statusLabel}</span>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>Concepto</th>
                          <th>Tipo</th>
                          <th style={{textAlign:'right'}}>Cargo</th>
                          <th style={{textAlign:'right'}}>Pagado</th>
                          <th style={{textAlign:'right'}}>Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamCharges.map(c => {
                          const paid = (c.payments || []).reduce((s, p) => s + (p.amount || 0), 0)
                          const bal = (c.amount || 0) - paid
                          return (
                            <tr key={c.id}>
                              <td>{c.description || '—'}</td>
                              <td>{c.type}</td>
                              <td style={{textAlign:'right'}}>${(c.amount||0).toLocaleString('es-MX')}</td>
                              <td style={{textAlign:'right'}}>${paid.toLocaleString('es-MX')}</td>
                              <td style={{textAlign:'right', color: bal > 0 ? '#dc2626' : '#16a34a', fontWeight:'600'}}>
                                ${bal.toLocaleString('es-MX')}
                              </td>
                            </tr>
                          )
                        })}
                        <tr style={{background:'#f0fdf4', fontWeight:'700'}}>
                          <td colSpan={2}>Total</td>
                          <td style={{textAlign:'right'}}>${totalAmount.toLocaleString('es-MX')}</td>
                          <td style={{textAlign:'right'}}>${totalPaid.toLocaleString('es-MX')}</td>
                          <td style={{textAlign:'right', color: balance > 0 ? '#dc2626' : '#16a34a'}}>
                            ${balance.toLocaleString('es-MX')}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )
              })}
              {charges.length === 0 && <p style={{color:'#9ca3af'}}>No hay cobros registrados.</p>}
            </>
          )
        })()}

      </div>
    </>
  )
}
