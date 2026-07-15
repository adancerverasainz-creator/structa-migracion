/**
 * Motor Centralizado de Cálculos Financieros — ERP BIA
 * ────────────────────────────────────────────────────
 * Fuente única de verdad para TODOS los cálculos financieros del sistema.
 * 
 * Principio ERP: Ningún componente de UI calcula dinero directamente.
 * Todo el sistema consulta estas funciones para evitar discrepancias.
 * 
 * Si mañana cambia el IVA, la política de recargos o las becas,
 * solo se modifica ESTE archivo y todo el ERP se actualiza.
 */

/**
 * Calcula el IVA (16%) sobre un subtotal.
 * @param {number} subtotal - Monto base
 * @param {boolean} requiresInvoice - Si requiere factura
 * @returns {{ iva: number, total: number }}
 */
export function calculateIVA(subtotal, requiresInvoice = false) {
  if (!requiresInvoice || !subtotal || subtotal <= 0) {
    return { iva: 0, total: subtotal || 0 };
  }
  const iva = subtotal * 0.16;
  return { iva, total: subtotal + iva };
}

/**
 * Determina el recargo sugerido basado en el mes de pago.
 * Si el pago corresponde a un mes anterior al actual, sugiere recargo.
 * 
 * @param {string} monthKey - Mes correspondiente (ej: "junio 2026")
 * @param {string} paymentDate - Fecha de pago (YYYY-MM-DD)
 * @returns {{ suggestedSurcharge: number, isLate: boolean, monthsLate: number }}
 */
export function calculateSuggestedSurcharge(monthKey, paymentDate) {
  if (!monthKey || !paymentDate) return { suggestedSurcharge: 0, isLate: false, monthsLate: 0 };

  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const parts = monthKey.toLowerCase().split(' ');
  const monthName = parts[0];
  const year = parseInt(parts[1]);
  const monthIndex = monthNames.indexOf(monthName);

  if (monthIndex < 0 || !year) return { suggestedSurcharge: 0, isLate: false, monthsLate: 0 };

  const dueDate = new Date(year, monthIndex, 1);
  const payDate = new Date(paymentDate);

  // Calculate months difference
  const monthsLate = (payDate.getFullYear() - dueDate.getFullYear()) * 12 + (payDate.getMonth() - dueDate.getMonth());

  if (monthsLate <= 0) return { suggestedSurcharge: 0, isLate: false, monthsLate: 0 };

  // Progressive surcharge: $50 for 1 month late, $100 for 2+, $200 for 4+
  let suggestedSurcharge = 0;
  if (monthsLate >= 4) suggestedSurcharge = 200;
  else if (monthsLate >= 2) suggestedSurcharge = 100;
  else suggestedSurcharge = 50;

  return { suggestedSurcharge, isLate: true, monthsLate };
}

/**
 * Calcula el moratorio fijo de $100 para mensualidades atrasadas.
 * Regla: si el mes de la mensualidad ya pasó respecto al mes actual, aplica $100.
 * Se usa en la vista de Deuda Unificada para mostrar el saldo real adeudado.
 * 
 * @param {string} monthKey - Mes correspondiente (ej: "junio 2026")
 * @param {Date} [referenceDate] - Fecha de referencia (default: hoy)
 * @returns {{ moratorio: number, isLate: boolean, monthsLate: number }}
 */
// Regla del club (2026-07-15): fecha límite de pago = día 15 de cada mes;
// desde el día 16 se cobra recargo fijo (default $100). Configurable en club_settings.late_fee.
export function calculateMoratorio(monthKey, referenceDate = new Date(), lateFeeSettings = null) {
  const cfg = { amount: 100, cutoff_day: 15, start_month: '2026-07', enabled: true, ...(lateFeeSettings || {}) };
  if (!cfg.enabled || !monthKey) return { moratorio: 0, isLate: false, monthsLate: 0 };

  const monthNames = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const parts = monthKey.toLowerCase().split(' ');
  const monthName = parts[0];
  const year = parseInt(parts[1]);
  const monthIndex = monthNames.indexOf(monthName);

  if (monthIndex < 0 || !year) return { moratorio: 0, isLate: false, monthsLate: 0 };

  // Vigencia: la regla aplica a partir de start_month (no retroactiva a meses históricos)
  const [sy, sm] = String(cfg.start_month).split('-').map(Number);
  if (sy && sm && (year < sy || (year === sy && (monthIndex + 1) < sm))) {
    return { moratorio: 0, isLate: false, monthsLate: 0 };
  }

  // Vencido si ya pasó el día límite (15) de ese mes
  const cutoff = new Date(year, monthIndex, cfg.cutoff_day, 23, 59, 59);
  if (referenceDate <= cutoff) return { moratorio: 0, isLate: false, monthsLate: 0 };

  const refMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  const monthsLate = Math.max(1, (refMonth.getFullYear() - year) * 12 + (refMonth.getMonth() - monthIndex));

  return { moratorio: cfg.amount, isLate: true, monthsLate };
}

/**
 * Aplica beca al monto de cuota mensual.
 * @param {number} baseFee - Cuota base
 * @param {string} scholarship - Tipo de beca ('ninguna', '50%', '100%')
 * @returns {number} Cuota ajustada
 */
export function applyScholarship(baseFee, scholarship) {
  if (!baseFee || baseFee <= 0) return 0;
  if (scholarship === '100%') return 0;
  if (scholarship === '50%') return baseFee * 0.5;
  return baseFee;
}

/**
 * Calcula la cuota prorrateada del primer mes si el jugador ingresó después del día 15.
 * @param {number} monthlyFee - Cuota mensual completa
 * @param {string} joinDate - Fecha de ingreso del jugador (YYYY-MM-DD)
 * @param {Date} monthDate - Fecha del mes a calcular
 * @returns {number} Cuota prorrateada
 */
export function calculateProRata(monthlyFee, joinDate, monthDate) {
  if (!joinDate) return monthlyFee;
  const join = new Date(joinDate + 'T00:00:00');
  if (join.getFullYear() === monthDate.getFullYear() && join.getMonth() === monthDate.getMonth() && join.getDate() > 15) {
    return monthlyFee * 0.5;
  }
  return monthlyFee;
}

/**
 * Construye el registro de pago para la entidad Payment.
 * Centraliza toda la lógica de ensamblaje del objeto que se persiste.
 * 
 * @param {Object} params
 * @param {Object} params.player - Datos del jugador { id, full_name, ... }
 * @param {string} params.paymentType - Tipo de pago
 * @param {number} params.baseAmount - Monto base a pagar
 * @param {number} params.surcharge - Recargo aplicado
 * @param {boolean} params.requiresInvoice - Si requiere factura
 * @param {string} params.paymentDate - Fecha de pago (YYYY-MM-DD)
 * @param {string} params.paymentMethod - Método de pago
 * @param {string} params.month - Mes/temporada correspondiente
 * @param {string} params.bankName - Banco (si aplica)
 * @param {string} params.referenceNumber - Referencia
 * @param {string} params.notes - Notas
 * @param {string} params.existingPaymentId - ID de pago existente (para actualizar)
 * @param {Object} params.tournamentInfo - Info de torneo (si es pago de torneo)
 * @returns {Object} Registro de pago listo para persistir
 */
export function buildPaymentRecord({
  player,
  paymentType = 'mensualidad',
  baseAmount = 0,
  surcharge = 0,
  requiresInvoice = false,
  paymentDate,
  paymentMethod = 'efectivo',
  month = '',
  bankName = '',
  referenceNumber = '',
  notes = '',
  existingPaymentId = null,
  tournamentInfo = null,
  pendingAmount = 0,
}) {
  const subtotal = baseAmount + surcharge;
  const { iva, total } = calculateIVA(subtotal, requiresInvoice);

  // Construir notas automáticas
  let autoNote = notes || '';
  if (surcharge > 0) {
    autoNote = autoNote ? `${autoNote} | Recargo: $${surcharge}` : `Recargo: $${surcharge}`;
  }
  if (requiresInvoice) {
    autoNote = autoNote ? `${autoNote} | IVA 16%: $${iva.toFixed(0)}` : `IVA 16% incluido: $${iva.toFixed(0)}`;
  }

  const remaining = pendingAmount > 0 ? pendingAmount - baseAmount : 0;

  // --- Tournament Payment Record ---
  if (paymentType === 'torneo' && tournamentInfo) {
    const tRemaining = tournamentInfo.registrationFee - total;
    return {
      type: 'tournament',
      player_id: player.id,
      tournament_id: tournamentInfo.id,
      amount: tournamentInfo.registrationFee,
      paid_amount: total,
      payment_date: paymentDate + 'T12:00:00',
      payment_method: paymentMethod,
      bank_name: bankName,
      reference_number: referenceNumber,
      notes: autoNote || (tRemaining > 0 
        ? `Abono a torneo ${tournamentInfo.name} — quedan $${tRemaining} pendientes`
        : `Pago completo torneo ${tournamentInfo.name}`),
      status: tRemaining <= 0 ? 'pagado' : 'abono',
    };
  }

  // --- Regular Payment Record (mensualidad, inscripcion, uniformes, etc.) ---
  const isUniformes = paymentType === 'uniformes';

  if (isUniformes && !autoNote) {
    autoNote = remaining > 0 ? `Pendiente: $${remaining.toFixed(0)}` : 'Pago total de uniformes';
  }

  return {
    type: 'regular',
    player_id: player.id,
    amount: total,
    surcharge,
    payment_date: paymentDate + 'T12:00:00',
    month: isUniformes ? 'uniformes' : month,
    payment_method: paymentMethod,
    bank_name: bankName,
    reference_number: referenceNumber,
    notes: autoNote,
    status: isUniformes 
      ? (remaining <= 0 ? 'pagado' : 'pendiente')
      : (remaining <= 0 ? 'pagado' : 'pendiente'),
    payment_type: paymentType,
    existingPaymentId: existingPaymentId || null,
  };
}

/**
 * Formatea un monto como moneda (copia de formatCurrency para usar en backend).
 * @param {number} amount 
 * @returns {string}
 */
export function fmt(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '$0.00';
  return '$' + Number(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,');
}

export default {
  calculateIVA,
  calculateSuggestedSurcharge,
  calculateMoratorio,
  applyScholarship,
  calculateProRata,
  buildPaymentRecord,
  fmt,
};