import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export function calcStandings(teams, matches, tournament = {}) {
  const PTS_WIN  = tournament.points_win  ?? 3
  const PTS_DRAW = tournament.points_draw ?? 1
  const PTS_LOSS = tournament.points_loss ?? 0

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

    if (m.status === 'forfait') {
      // Forfait: one team may be null (deleted/withdrawn team with no valid ID).
      // Determine winner/loser: the team that IS in the table wins; the absent one loses.
      // If forfait_team_id is set, use it directly; otherwise infer from which ID is null/missing.
      let winner, loser
      if (m.forfait_team_id) {
        loser  = m.forfait_team_id
        winner = m.forfait_team_id === h ? a : h
      } else if (!table[a]) {
        // Away team missing (null or deleted) → away forfeited, home wins
        winner = h
        loser  = a
      } else if (!table[h]) {
        // Home team missing (null or deleted) → home forfeited, away wins
        winner = a
        loser  = h
      } else {
        // Both teams present but forfait_team_id is null — skip (ambiguous)
        return
      }
      if (table[winner]) { table[winner].pg++; table[winner].pts += PTS_WIN;  table[winner].pj++ }
      if (table[loser])  { table[loser].pp++;  table[loser].pts  += PTS_LOSS; table[loser].pj++ }
      return
    }

    // Completed match — skip if either team is not in the standings table
    if (!table[h] || !table[a]) return

    const hg = m.home_goals ?? 0
    const ag = m.away_goals ?? 0

    table[h].pj++; table[a].pj++
    table[h].gf += hg; table[h].gc += ag
    table[a].gf += ag; table[a].gc += hg

    if (hg > ag) {
      table[h].pg++; table[h].pts += PTS_WIN;  table[a].pp++; table[a].pts += PTS_LOSS
    } else if (hg < ag) {
      table[a].pg++; table[a].pts += PTS_WIN;  table[h].pp++; table[h].pts += PTS_LOSS
    } else {
      table[h].pe++; table[h].pts += PTS_DRAW
      table[a].pe++; table[a].pts += PTS_DRAW
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
    .forEach((e, i) => {
      // Use player_id if available; fall back to "name + team" to avoid
      // merging different players with the same name. Anonymous goals
      // (no name, no id) each get a unique key so they don't collapse.
      const key = e.player_id
        || (e.player_name ? `${e.player_name}__${e.team_id || e.team_name || ''}` : `anon_${i}`)
      if (!scorers[key]) {
        scorers[key] = { name: e.player_name || 'Sin nombre', team: e.team_name || '', goals: 0 }
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
