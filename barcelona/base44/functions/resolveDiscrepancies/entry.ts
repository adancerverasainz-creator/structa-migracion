import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const resolved = [];
    const failed = [];

    // Helper para actualizaciones con rate limiting
    const batchUpdate = async (updates, label) => {
      let count = 0;
      for (const { id, data, meta } of updates) {
        try {
          await base44.asServiceRole.entities.TournamentPayment.update(id, data);
          resolved.push({ ...meta });
          count++;
          if (count % 20 === 0) await new Promise(r => setTimeout(r, 2000)); // pausa cada 20
        } catch (e) {
          failed.push({ modulo: 'Torneos', id, error: e.message });
        }
      }
    };

    // ─── 1. Corregir estados inconsistentes de TournamentPayment ───
    const tournamentPayments = await base44.asServiceRole.entities.TournamentPayment.list();
    const tournaments = await base44.asServiceRole.entities.Tournament.list();

    const tpUpdates = [];
    for (const p of tournamentPayments) {
      const tournament = tournaments.find(t => t.id === p.tournament_id);
      const fee = tournament?.registration_fee || 0;
      const paid = p.paid_amount ?? p.amount ?? 0;

      let newStatus = null;

      if (paid <= 0 && p.status === 'pagado' && fee > 0 && (p.amount ?? 0) > 0) {
        newStatus = 'pendiente';
      } else if (paid > 0 && paid < fee && p.status === 'pagado') {
        newStatus = 'abono';
      } else if (paid >= fee && p.status !== 'pagado' && fee > 0) {
        newStatus = 'pagado';
      }

      if (newStatus) {
        tpUpdates.push({
          id: p.id,
          data: { status: newStatus },
          meta: { modulo: 'Torneos', tipo: 'estado_corregido', id: p.id, cambio: `${p.status} → ${newStatus}` }
        });
      }
    }
    await batchUpdate(tpUpdates, 'TournamentPayment status');

    // ─── 2. Corregir estados de AccountPayable ───
    const accountsPayable = await base44.asServiceRole.entities.AccountPayable.list();
    const accountPayments = await base44.asServiceRole.entities.AccountPayablePayment.list();

    let apCount = 0;
    for (const ap of accountsPayable) {
      const sumPayments = accountPayments
        .filter(p => p.account_payable_id === ap.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      let newStatus = null;

      if (sumPayments >= ap.total_amount && ap.status !== 'pagado') {
        newStatus = 'pagado';
      } else if (sumPayments > 0 && sumPayments < ap.total_amount && ap.status !== 'parcial') {
        newStatus = 'parcial';
      }

      if (newStatus) {
        try {
          await base44.asServiceRole.entities.AccountPayable.update(ap.id, { status: newStatus });
          resolved.push({ modulo: 'Cuentas por Pagar', tipo: 'estado_corregido', id: ap.id, concepto: ap.concept, cambio: `${ap.status} → ${newStatus}` });
          apCount++;
          if (apCount % 20 === 0) await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
          failed.push({ modulo: 'Cuentas por Pagar', id: ap.id, error: e.message });
        }
      }
    }

    // ─── 3. Vincular pagos huérfanos con coincidencia exacta ───
    const attendees = await base44.asServiceRole.entities.TournamentAttendee.list();
    const players = await base44.asServiceRole.entities.Player.list();

    let orphanCount = 0;
    for (const p of tournamentPayments) {
      if (p.player_id || p.external_attendee_id) continue; // ya vinculado

      const orphanName = (p.external_name || '').toLowerCase().trim();
      if (!orphanName) continue;

      let matched = false;

      // Buscar coincidencia exacta en asistentes externos
      for (const a of attendees) {
        if (a.tournament_id !== p.tournament_id) continue;
        if (!a.is_external) continue;
        const attName = (a.external_name || '').toLowerCase().trim();
        if (attName === orphanName) {
          try {
            await base44.asServiceRole.entities.TournamentPayment.update(p.id, { external_attendee_id: a.id });
            resolved.push({ modulo: 'Torneos', tipo: 'huerfano_vinculado', id: p.id, nombre: p.external_name, vinculado_a: 'externo: ' + a.external_name });
            orphanCount++;
            if (orphanCount % 5 === 0) await new Promise(r => setTimeout(r, 2000));
            matched = true;
          } catch (e) {
            failed.push({ modulo: 'Torneos', id: p.id, error: e.message });
          }
          break;
        }
      }

      // Buscar en jugadores internos
      if (!matched) {
        for (const a of attendees) {
          if (a.tournament_id !== p.tournament_id) continue;
          const player = players.find(pl => pl.id === a.player_id);
          if (!player) continue;
          const playerName = (player.full_name || '').toLowerCase().trim();
          if (playerName === orphanName) {
            try {
              await base44.asServiceRole.entities.TournamentPayment.update(p.id, { player_id: player.id });
              resolved.push({ modulo: 'Torneos', tipo: 'huerfano_vinculado', id: p.id, nombre: p.external_name, vinculado_a: 'jugador: ' + player.full_name });
              orphanCount++;
              if (orphanCount % 5 === 0) await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
              failed.push({ modulo: 'Torneos', id: p.id, error: e.message });
            }
            break;
          }
        }
      }
    }

    return Response.json({
      success: true,
      resueltos: resolved.length,
      fallidos: failed.length,
      resolved,
      failed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});