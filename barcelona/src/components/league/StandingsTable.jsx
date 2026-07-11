import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Award } from 'lucide-react';

export default function StandingsTable({ teams }) {
  // Calculate goal difference and sort by points, then goal difference
  const standings = teams
    .map(team => ({
      ...team,
      goal_difference: (team.goals_for || 0) - (team.goals_against || 0)
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.goal_difference - a.goal_difference;
    });

  return (
    <Card className="border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="w-6 h-6 text-blue-600" />
          Tabla de Posiciones
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-blue-200 bg-blue-50">
                <th className="px-2 py-3 text-left text-xs font-bold text-gray-700">#</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">Equipo</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">PJ</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">PG</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">PE</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">PP</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">GF</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">GC</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">DG</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gray-700">PTS</th>
                <th className="px-3 py-3 text-left text-xs font-bold text-gray-700">Goleador</th>
                <th className="px-3 py-3 text-center text-xs font-bold text-gray-700">Faltas/Tarjetas</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((team, index) => (
                <tr 
                  key={team.id} 
                  className={`border-b hover:bg-blue-50/50 transition-colors ${
                    index === 0 ? 'bg-yellow-50' : 
                    index === 1 ? 'bg-gray-50' : 
                    index === 2 ? 'bg-orange-50' : ''
                  }`}
                >
                  <td className="px-2 py-3 text-center font-bold text-gray-700">
                    {index === 0 && <Trophy className="w-4 h-4 inline text-yellow-600" />}
                    {index === 1 && <Award className="w-4 h-4 inline text-gray-500" />}
                    {index === 2 && <Award className="w-4 h-4 inline text-orange-600" />}
                    {index > 2 && index + 1}
                  </td>
                  <td className="px-3 py-3 font-semibold text-gray-900">{team.name}</td>
                  <td className="px-2 py-3 text-center text-gray-700">{team.matches_played || 0}</td>
                  <td className="px-2 py-3 text-center text-green-600 font-semibold">{team.matches_won || 0}</td>
                  <td className="px-2 py-3 text-center text-gray-600">{team.matches_tied || 0}</td>
                  <td className="px-2 py-3 text-center text-red-600 font-semibold">{team.matches_lost || 0}</td>
                  <td className="px-2 py-3 text-center text-blue-600 font-semibold">{team.goals_for || 0}</td>
                  <td className="px-2 py-3 text-center text-red-500">{team.goals_against || 0}</td>
                  <td className={`px-2 py-3 text-center font-bold ${
                    team.goal_difference > 0 ? 'text-green-600' : 
                    team.goal_difference < 0 ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {team.goal_difference > 0 ? '+' : ''}{team.goal_difference}
                  </td>
                  <td className="px-2 py-3 text-center font-bold text-lg text-blue-600">{team.points || 0}</td>
                  <td className="px-3 py-3 text-sm">
                    {team.top_scorer ? (
                      <div>
                        <div className="font-semibold text-gray-900">{team.top_scorer}</div>
                        <div className="text-xs text-gray-500">{team.top_scorer_goals || 0} goles</div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex flex-col gap-1 items-center">
                      <div className="text-xs text-gray-600">
                        {team.fouls || 0} faltas
                      </div>
                      <div className="flex gap-2">
                        {team.yellow_cards > 0 && (
                          <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 rounded text-xs font-bold">
                            {team.yellow_cards}
                          </span>
                        )}
                        {team.red_cards > 0 && (
                          <span className="px-2 py-0.5 bg-red-600 text-white rounded text-xs font-bold">
                            {team.red_cards}
                          </span>
                        )}
                        {!team.yellow_cards && !team.red_cards && (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}