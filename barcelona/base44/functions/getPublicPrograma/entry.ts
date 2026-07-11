import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const LOGO_URL = 'https://ligasmex.com/structa_logo_white.png';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const token = body?.token;

    if (!token) {
      return Response.json({ error: 'Token requerido' }, { status: 400 });
    }

    const programs = await base44.asServiceRole.entities.Program.list();
    const program = programs.find((p: any) => p.id === token);

    if (!program) {
      return Response.json({ error: 'Programa no encontrado' }, { status: 404 });
    }

    if (program.status === 'cerrado') {
      return Response.json({ error: 'Este programa ya no acepta registros' }, { status: 410 });
    }

    return Response.json({
      programa: {
        nombre: program.name,
        descripcion: program.description || '',
        tipo: 'prueba_libre',
        fecha_inicio: program.start_date || null,
        fecha_fin: program.end_date || null,
        logo_url: LOGO_URL,
        club_nombre: 'Club Barcelona Inter Academy',
        status: program.status,
      }
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
