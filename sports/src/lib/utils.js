import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function calcStandings(teams, matches) {
  const table = {}
  teams.forEach(t => {
    table[t.id] = {
      id: t.id,
      name: t.name,
      logo_url: t.logo_url,
      color: t.color,
      pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0,
    }
  })

  matches.forEach(m => {
    if (m.status !== 'completed' && m.status !== 'forfait') return
    const h = m.home_team_id
    const a = m.away_team_id
    if (!table[h] || !table[a]) return

    const hg = m.home_goals ?? 0
    const ag = m.away_goals ?? 0

    if (m.status === 'forfait') {
      const winner = m.forfait_team_id === h ? a : h
      const loser = m.forfait_team_id
      if (table[winner]) { table[winner].pg++; table[winner].pts += 3; table[winner].pj++ }
      if (table[loser]) { table[loser].pp++; table[loser].pj++ }
      return
    }

    table[h].pj++; table[a].pj++
    table[h].gf += hg; table[h].gc += ag
    table[a].gf += ag; table[a].gc += hg

    if (hg > ag) {
      table[h].pg++; table[h].pts += 3; table[a].pp++
    } else if (hg < ag) {
      table[a].pg++; table[a].pts += 3; table[h].pp++
    } else {
      table[h].pe++; table[h].pts += 1
      table[a].pe++; table[a].pts += 1
    }
  })

  return Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    const gdA = a.gf - a.gc
    const gdB = b.gf - b.gc
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

export function calcScorers(events) {
  const scorers = {}
  events
    .filter(e => e.event_type === 'goal')
    .forEach(e => {
      const key = e.player_id || e.player_name
      if (!scorers[key]) {
        scorers[key] = { name: e.player_name || 'Desconocido', team: e.team_name || '', goals: 0 }
      }
      scorers[key].goals++
    })
  return Object.values(scorers).sort((a, b) => b.goals - a.goals)
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}
