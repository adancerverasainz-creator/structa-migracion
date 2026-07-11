/**
 * Módulo Centralizado de Cálculo de Saldos para Torneos
 * ────────────────────────────────────────────────────
 * Fuente única de verdad para el cálculo de balances de pago de torneos.
 * 
 * Principio ERP: Todo el sistema consulta estas funciones para evitar
 * discrepancias entre módulos (Dashboard, Pagos, Reportes, Morosos).
 * 
 * Modelo de negocio:
 *   Saldo Neto = Cuota del Torneo - Suma de todos los abonos registrados
 *   Un asistente está al corriente si: Suma Abonos >= Cuota del Torneo
 */

/**
 * Obtiene el total abonado por un asistente (interno o externo).
 * Usa paid_amount como fuente primaria, con fallback a amount.
 * 
 * @param {Object} attendee - Registro de TournamentAttendee
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @param {string} tournamentId - ID del torneo
 * @returns {number} Total abonado
 */
export function getTotalPaidForAttendee(attendee, payments, tournamentId) {
  const attendeePayments = payments.filter(p => {
    if (p.tournament_id !== tournamentId) return false;
    if (attendee.is_external) {
      return p.external_attendee_id === attendee.id;
    }
    return p.player_id === attendee.player_id;
  });

  return attendeePayments.reduce(
    (sum, p) => sum + (p.paid_amount ?? p.amount ?? 0),
    0
  );
}

/**
 * Verifica si un asistente tiene beca (pago registrado como $0 con status pagado).
 * 
 * @param {Object} attendee - Registro de TournamentAttendee
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @param {string} tournamentId - ID del torneo
 * @returns {boolean}
 */
export function isAttendeeBecado(attendee, payments, tournamentId) {
  const attendeePayments = payments.filter(p => {
    if (p.tournament_id !== tournamentId) return false;
    if (attendee.is_external) {
      return p.external_attendee_id === attendee.id;
    }
    return p.player_id === attendee.player_id;
  });

  return attendeePayments.some(p => p.status === 'pagado' && p.amount === 0);
}

/**
 * Calcula el balance completo de un asistente.
 * 
 * @param {Object} attendee - Registro de TournamentAttendee
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @param {string} tournamentId - ID del torneo
 * @param {number} registrationFee - Cuota de inscripción del torneo
 * @returns {{ totalPaid: number, pending: number, isFullyPaid: boolean, isBecado: boolean, payments: Array }}
 */
export function calculateAttendeeBalance(attendee, payments, tournamentId, registrationFee) {
  const totalPaid = getTotalPaidForAttendee(attendee, payments, tournamentId);
  const isBecado = isAttendeeBecado(attendee, payments, tournamentId);
  const pending = isBecado ? 0 : Math.max(0, registrationFee - totalPaid);

  const attendeePayments = payments.filter(p => {
    if (p.tournament_id !== tournamentId) return false;
    if (attendee.is_external) {
      return p.external_attendee_id === attendee.id;
    }
    return p.player_id === attendee.player_id;
  });

  return {
    totalPaid,
    pending,
    isFullyPaid: pending === 0,
    isBecado,
    payments: attendeePayments,
  };
}

/**
 * Construye la lista completa de morosos para un torneo.
 * Incluye tanto jugadores internos como externos.
 * 
 * @param {Array} attendees - Todos los TournamentAttendee del torneo
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @param {Array} players - Todos los jugadores del club
 * @param {string} tournamentId - ID del torneo
 * @param {number} registrationFee - Cuota de inscripción del torneo
 * @returns {Array} Lista de deudores con { attendeeId, playerId, name, isExternal, totalPaid, debt, payments, attendee, player }
 */
export function buildDebtorsList(attendees, payments, players, tournamentId, registrationFee) {
  return attendees
    .filter(a => !isAttendeeBecado(a, payments, tournamentId))
    .map(attendee => {
      const totalPaid = getTotalPaidForAttendee(attendee, payments, tournamentId);
      const debt = registrationFee - totalPaid;

      if (debt <= 0) return null;

      const isExternal = attendee.is_external;
      const player = isExternal
        ? null
        : players.find(p => p.id === attendee.player_id);

      const name = isExternal
        ? (attendee.external_name || 'Externo')
        : (player?.full_name || 'Desconocido');

      const attendeePayments = payments.filter(p => {
        if (p.tournament_id !== tournamentId) return false;
        if (isExternal) return p.external_attendee_id === attendee.id;
        return p.player_id === attendee.player_id;
      });

      return {
        attendeeId: attendee.id,
        playerId: attendee.player_id,
        player,
        name,
        isExternal,
        totalPaid,
        debt,
        payments: attendeePayments,
        attendee,
      };
    })
    .filter(Boolean);
}

/**
 * Obtiene los IDs de jugadores internos con pago completo.
 * 
 * @param {Array} attendees - Todos los TournamentAttendee del torneo
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @param {string} tournamentId - ID del torneo
 * @param {number} registrationFee - Cuota de inscripción del torneo
 * @returns {Set<string>} Set de player_id con pago completo
 */
export function getPaidAttendeeIds(attendees, payments, tournamentId, registrationFee) {
  const ids = new Set();

  attendees
    .filter(a => !a.is_external && a.player_id && !isAttendeeBecado(a, payments, tournamentId))
    .forEach(a => {
      if (getTotalPaidForAttendee(a, payments, tournamentId) >= registrationFee) {
        ids.add(a.player_id);
      }
    });

  return ids;
}

/**
 * Calcula el total recaudado en un torneo.
 * 
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @returns {number} Total recaudado
 */
export function getTotalCollected(payments) {
  return payments.reduce((sum, p) => sum + (p.paid_amount ?? p.amount ?? 0), 0);
}

/**
 * Agrupa los ingresos por método de pago.
 * 
 * @param {Array} payments - Todos los TournamentPayment del torneo
 * @returns {{ efectivo: {total, count}, tarjeta: {total, count}, transferencia: {total, count, byBank: Object} }}
 */
/**
 * Encuentra pagos huérfanos (sin player_id ni external_attendee_id).
 * 
 * @param {Array} payments - Todos los TournamentPayment
 * @param {string} tournamentId - ID del torneo
 * @returns {Array} Pagos huérfanos
 */
export function findOrphanPayments(payments, tournamentId) {
  return payments.filter(p => 
    p.tournament_id === tournamentId && 
    !p.player_id && 
    !p.external_attendee_id
  );
}

/**
 * Sugiere matches para pagos huérfanos buscando por nombre en attendees.
 * 
 * @param {Array} orphanPayments - Pagos sin player_id
 * @param {Array} attendees - TournamentAttendee del torneo
 * @param {Array} players - Jugadores del club
 * @returns {Array} Sugerencias [{ payment, candidates: [{attendee, player, score}] }]
 */
export function suggestOrphanMatches(orphanPayments, attendees, players) {
  return orphanPayments.map(payment => {
    const searchName = (payment.external_name || '').toLowerCase().trim();
    const candidates = [];
    
    if (!searchName) return { payment, candidates: [] };

    // Buscar entre attendees internos
    attendees.filter(a => !a.is_external && a.player_id).forEach(a => {
      const player = players.find(pl => pl.id === a.player_id);
      if (!player) return;
      const playerName = (player.full_name || '').toLowerCase().trim();
      if (playerName === searchName) {
        candidates.push({ attendee: a, player, score: 100, matchType: 'exacta' });
      } else if (playerName.includes(searchName) || searchName.includes(playerName)) {
        candidates.push({ attendee: a, player, score: 70, matchType: 'parcial' });
      }
    });

    // Buscar entre attendees externos
    attendees.filter(a => a.is_external).forEach(a => {
      const extName = (a.external_name || '').toLowerCase().trim();
      if (extName === searchName) {
        candidates.push({ attendee: a, player: null, score: 100, matchType: 'exacta_externo' });
      } else if (extName.includes(searchName) || searchName.includes(extName)) {
        candidates.push({ attendee: a, player: null, score: 70, matchType: 'parcial_externo' });
      }
    });

    candidates.sort((a, b) => b.score - a.score);
    return { payment, candidates: candidates.slice(0, 5) };
  });
}

export function getIncomeByPaymentMethod(payments) {
  const effectivePaid = (p) => (p.paid_amount ?? p.amount ?? 0);

  const cash = payments.filter(p => p.payment_method === 'efectivo');
  const card = payments.filter(p => p.payment_method === 'tarjeta');
  const transfer = payments.filter(p => p.payment_method === 'transferencia');

  const byBank = {};
  transfer.forEach(p => {
    const bank = p.bank_name || 'Sin banco';
    if (!byBank[bank]) byBank[bank] = { total: 0, count: 0 };
    byBank[bank].total += effectivePaid(p);
    byBank[bank].count += 1;
  });

  return {
    efectivo: { total: cash.reduce((s, p) => s + effectivePaid(p), 0), count: cash.length },
    tarjeta: { total: card.reduce((s, p) => s + effectivePaid(p), 0), count: card.length },
    transferencia: {
      total: transfer.reduce((s, p) => s + effectivePaid(p), 0),
      count: transfer.length,
      byBank,
    },
  };
}