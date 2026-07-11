import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      token,
      nombre_jugador,
      fecha_nacimiento,
      categoria_interes,
      posicion_preferida,
      nombre_padre,
      telefono_whatsapp,
      email,
      notas,
    } = body;

    if (!token || !nombre_jugador || !nombre_padre || !telefono_whatsapp) {
      return Response.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Verify program exists and is active
    const programs = await base44.asServiceRole.entities.Program.list();
    const program = programs.find((p: any) => p.id === token);

    if (!program || program.status === 'cerrado') {
      return Response.json({ error: 'Este programa ya no acepta registros' }, { status: 410 });
    }

    // Build notes string
    const notesParts: string[] = [];
    if (notas?.trim()) notesParts.push(notas.trim());
    if (posicion_preferida) notesParts.push(`Posición: ${posicion_preferida}`);

    const prospecto = await base44.asServiceRole.entities.PreRegistro.create({
      full_name: nombre_jugador.trim(),
      birth_date: fecha_nacimiento || undefined,
      category: categoria_interes || undefined,
      parent_name: nombre_padre.trim(),
      parent_phone: telefono_whatsapp.trim(),
      parent_email: email?.trim() || undefined,
      notes: notesParts.length > 0 ? notesParts.join(' | ') : undefined,
      monthly_fee: 0,
      status: 'pendiente',
      program_id: token,
      program_name: program.name,
    });

    return Response.json({ success: true, id: prospecto.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
