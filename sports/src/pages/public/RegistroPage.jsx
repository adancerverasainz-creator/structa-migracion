import { Link } from 'react-router-dom'
import { Trophy, MessageCircle, CheckCircle } from 'lucide-react'

const WHATSAPP_NUMBER = '529991131632'
const WHATSAPP_MSG = encodeURIComponent(
  'Hola! Me interesa Structa Sports para gestionar mi liga/torneo. ¿Me pueden dar información?'
)
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`

const INCLUDES = [
  'Tabla de posiciones en tiempo real',
  'Fixture automático con algoritmo Berger',
  'Portal del capitán para registro de jugadores',
  'Exportación de credenciales y PDF',
  'Control de finanzas e inscripciones',
  'Acceso para todo tu equipo de trabajo',
]

export default function RegistroPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mb-8">
        <div className="w-9 h-9 rounded-xl bg-[#14532d] flex items-center justify-center">
          <Trophy className="w-5 h-5 text-white" />
        </div>
        <span className="font-bold text-gray-900 text-lg">Structa Sports</span>
      </Link>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">Empieza hoy</h1>
          <p className="text-sm text-gray-500">
            Contáctanos por WhatsApp y en minutos tendrás tu liga configurada.
          </p>
        </div>

        {/* Qué incluye */}
        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          {INCLUDES.map((item) => (
            <div key={item} className="flex items-start gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <span className="text-sm text-gray-700">{item}</span>
            </div>
          ))}
        </div>

        {/* Precio */}
        <div className="text-center border border-green-200 bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-700 font-medium uppercase tracking-wide mb-1">Suscripción mensual</p>
          <p className="text-3xl font-bold text-gray-900">$499 <span className="text-base font-normal text-gray-500">MXN / mes</span></p>
          <p className="text-xs text-gray-500 mt-1">Por liga. Sin límite de torneos ni equipos.</p>
        </div>

        {/* CTA WhatsApp */}
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold py-3 rounded-xl text-sm transition-colors"
        >
          <MessageCircle className="w-5 h-5" />
          Contactar por WhatsApp
        </a>

        <p className="text-center text-xs text-gray-400">
          Te respondemos en menos de una hora en horario de lunes a sábado.
        </p>

        <p className="text-center text-sm text-gray-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/admin/login" className="text-green-700 font-medium hover:underline">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
