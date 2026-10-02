/**
 * PdfExportButtons.jsx
 * Drop this component near the top of AdminTournamentDetail.
 * It opens each print view in a new tab.
 *
 * Usage:
 *   import PdfExportButtons from './PdfExportButtons'
 *   <PdfExportButtons tournamentId={id} />
 */
import { FileText } from 'lucide-react'

const EXPORTS = [
  { type: 'standings',     label: 'Standings' },
  { type: 'fixture',       label: 'Fixture' },
  { type: 'credenciales',  label: 'Credenciales' },
  { type: 'estado-cuenta', label: 'Estado de cuenta' },
]

export default function PdfExportButtons({ tournamentId }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
        <FileText className="w-3.5 h-3.5" />
        Exportar PDF:
      </span>
      {EXPORTS.map(({ type, label }) => (
        <a
          key={type}
          href={`/admin/torneo/${tournamentId}/print/${type}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1 rounded-lg transition-colors"
        >
          {label}
        </a>
      ))}
    </div>
  )
}
