import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const issues = [];
    const stats = { total: 0, criticos: 0, advertencias: 0, info: 0 };

    // ─── 1. Pagos de torneo huérfanos ───
    const tournamentPayments = await base44.asServiceRole.entities.TournamentPayment.list();
    const orphanPayments = tournamentPayments.filter(p => !p.player_id && !p.external_attendee_id);
    if (orphanPayments.length > 0) {
      issues.push({
        modulo: 'Torneos',
        severidad: 'critico',
        tipo: 'pago_huerfano',
        mensaje: `${orphanPayments.length} pagos de torneo sin jugador asignado`,
        detalles: orphanPayments.map(p => ({
          id: p.id,
          monto: p.paid_amount ?? p.amount,
          nombre_externo: p.external_name || 'N/A',
          torneo_id: p.tournament_id
        })),
        auto_resoluble: false
      });
    }

    // ─── 2. Estado de pago inconsistente vs monto ───
    const tournaments = await base44.asServiceRole.entities.Tournament.list();
    const statusMismatches = [];
    for (const p of tournamentPayments) {
      const tournament = tournaments.find(t => t.id === p.tournament_id);
      const fee = tournament?.registration_fee || 0;
      const paid = p.paid_amount ?? p.amount ?? 0;

      if (paid <= 0 && p.status === 'pagado' && fee > 0) {
        // Becado es válido (amount = 0)
        const amountZero = (p.amount ?? 0) === 0;
        if (!amountZero) {
          statusMismatches.push({ id: p.id, status_actual: p.status, monto_pagado: paid, cuota: fee, accion: 'cambiar a pendiente' });
        }
      } else if (paid > 0 && paid < fee && p.status === 'pagado') {
        statusMismatches.push({ id: p.id, status_actual: p.status, monto_pagado: paid, cuota: fee, accion: 'cambiar a abono' });
      } else if (paid >= fee && p.status !== 'pagado' && fee > 0) {
        statusMismatches.push({ id: p.id, status_actual: p.status, monto_pagado: paid, cuota: fee, accion: 'cambiar a pagado' });
      }
    }
    if (statusMismatches.length > 0) {
      issues.push({
        modulo: 'Torneos',
        severidad: 'advertencia',
        tipo: 'estado_inconsistente',
        mensaje: `${statusMismatches.length} pagos con estado inconsistente vs monto`,
        detalles: statusMismatches,
        auto_resoluble: true
      });
    }

    // ─── 3. Cuentas por pagar: status vs suma de abonos ───
    const accountsPayable = await base44.asServiceRole.entities.AccountPayable.list();
    const accountPayments = await base44.asServiceRole.entities.AccountPayablePayment.list();
    const apMismatches = [];
    for (const ap of accountsPayable) {
      const sumPayments = accountPayments
        .filter(p => p.account_payable_id === ap.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      if (sumPayments >= ap.total_amount && ap.status !== 'pagado') {
        apMismatches.push({ id: ap.id, concepto: ap.concept, status_actual: ap.status, total: ap.total_amount, abonado: sumPayments, accion: 'marcar como pagado' });
      } else if (sumPayments > 0 && sumPayments < ap.total_amount && ap.status === 'pagado') {
        apMismatches.push({ id: ap.id, concepto: ap.concept, status_actual: ap.status, total: ap.total_amount, abonado: sumPayments, accion: 'marcar como parcial' });
      }
    }
    if (apMismatches.length > 0) {
      issues.push({
        modulo: 'Cuentas por Pagar',
        severidad: 'advertencia',
        tipo: 'cuenta_estado_inconsistente',
        mensaje: `${apMismatches.length} cuentas por pagar con estado inconsistente`,
        detalles: apMismatches,
        auto_resoluble: true
      });
    }

    // ─── 4. Jugadores activos sin cuota mensual (excluyendo becados 100%) ───
    const players = await base44.asServiceRole.entities.Player.list();
    const playersSinCuota = players.filter(p =>
      p.status === 'activo'
      && (!p.monthly_fee || p.monthly_fee <= 0)
      && p.scholarship !== '100%'
    );
    if (playersSinCuota.length > 0) {
      issues.push({
        modulo: 'Jugadores',
        severidad: 'advertencia',
        tipo: 'sin_cuota_mensual',
        mensaje: `${playersSinCuota.length} jugadores activos sin cuota mensual definida`,
        detalles: playersSinCuota.map(p => ({ id: p.id, nombre: p.full_name, categoria: p.category })),
        auto_resoluble: false
      });
    }

    // ─── 5. Pagos de torneo con monto 0 no becados ───
    const zeroAmountNonBecado = tournamentPayments.filter(p => {
      const paid = p.paid_amount ?? p.amount ?? 0;
      return paid === 0 && (!p.notes || !p.notes.toLowerCase().includes('beca'));
    });
    if (zeroAmountNonBecado.length > 0) {
      issues.push({
        modulo: 'Torneos',
        severidad: 'info',
        tipo: 'pago_cero_sin_beca',
        mensaje: `${zeroAmountNonBecado.length} pagos con monto $0 sin indicar beca`,
        detalles: zeroAmountNonBecado.map(p => ({ id: p.id, torneo_id: p.tournament_id })),
        auto_resoluble: false
      });
    }

    // ─── 6. Asistentes de torneo duplicados ───
    const attendees = await base44.asServiceRole.entities.TournamentAttendee.list();
    const dupMap = {};
    for (const a of attendees) {
      const key = `${a.tournament_id}|${a.player_id || 'ext'}|${a.external_name || ''}`;
      if (!dupMap[key]) dupMap[key] = [];
      dupMap[key].push(a);
    }
    const duplicates = Object.entries(dupMap).filter(([, arr]) => arr.length > 1);
    if (duplicates.length > 0) {
      issues.push({
        modulo: 'Torneos',
        severidad: 'critico',
        tipo: 'asistente_duplicado',
        mensaje: `${duplicates.length} asistentes duplicados en torneos`,
        detalles: duplicates.map(([key, arr]) => ({ key, count: arr.length, ids: arr.map(a => a.id) })),
        auto_resoluble: false
      });
    }

    // ─── 7. Pagos de liga sin equipo ───
    const leaguePayments = await base44.asServiceRole.entities.LeaguePayment.list();
    const teams = await base44.asServiceRole.entities.Team.list();
    const teamIds = new Set(teams.map(t => t.id));
    const orphanLeague = leaguePayments.filter(p => !teamIds.has(p.team_id));
    if (orphanLeague.length > 0) {
      issues.push({
        modulo: 'Liga',
        severidad: 'critico',
        tipo: 'pago_liga_sin_equipo',
        mensaje: `${orphanLeague.length} pagos de liga con equipo inexistente`,
        detalles: orphanLeague.map(p => ({ id: p.id, team_id: p.team_id, monto: p.amount })),
        auto_resoluble: false
      });
    }

    // ─── 8. Egresos con monto 0 ───
    const expenses = await base44.asServiceRole.entities.Expense.list();
    const zeroExpenses = expenses.filter(e => !e.amount || e.amount <= 0);
    if (zeroExpenses.length > 0) {
      issues.push({
        modulo: 'Egresos',
        severidad: 'advertencia',
        tipo: 'egreso_monto_cero',
        mensaje: `${zeroExpenses.length} egresos con monto $0`,
        detalles: zeroExpenses.map(e => ({ id: e.id, concepto: e.concept, fecha: e.expense_date })),
        auto_resoluble: false
      });
    }

    // ─── Estadísticas ───
    stats.total = issues.length;
    stats.criticos = issues.filter(i => i.severidad === 'critico').length;
    stats.advertencias = issues.filter(i => i.severidad === 'advertencia').length;
    stats.info = issues.filter(i => i.severidad === 'info').length;

    return Response.json({ success: true, stats, issues });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});