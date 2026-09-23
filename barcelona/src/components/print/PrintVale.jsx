// Impresión de vales de caja en térmica 80mm (WiFi) — mismo patrón que
// Structa ERP Constructoras. Sin librerías: window.open + window.print().
//
// imprimirVale(vale) recibe:
//   tipoVale        'EGRESO' | 'INGRESO'  (NO usar 'tipo': colisiona con la
//                   categoría del movimiento al hacer spread del objeto)
//   folio           texto corto (se muestra grande)
//   fecha           'YYYY-MM-DD' o Date
//   concepto, monto, cuenta_nombre, forma_pago, referencia,
//   autorizado_por, categoria_nombre (equivalente de obra en clubes),
//   proveedor_nombre, cliente_nombre  — los vacíos no se imprimen.

const LOGO_URL = 'https://swtrrldixeeecsmfseah.supabase.co/storage/v1/object/public/assets/logo-bia-transparente.png';
const CLUB_NOMBRE = 'Barcelona Inter Academy';

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtFecha = (f) => {
  try {
    const d = f instanceof Date ? f : new Date(String(f).slice(0, 10) + 'T00:00:00');
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(f || ''); }
};

const FORMAS = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta' };

export function imprimirVale(vale) {
  const w = window.open('', '_blank', 'width=420,height=680');
  if (!w) {
    alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes (popups) para bia.structa.mx e intenta de nuevo con el botón 🖨 del movimiento.');
    return;
  }

  const esEgreso = vale.tipoVale === 'EGRESO';
  const campos = [
    ['Concepto', vale.concepto],
    ['Cuenta / Caja', vale.cuenta_nombre],
    ['Forma de pago', FORMAS[vale.forma_pago] || vale.forma_pago],
    ['Referencia', vale.referencia],
    ['Categoría', vale.categoria_nombre],
    [esEgreso ? 'Pagado a' : 'Recibido de', esEgreso ? vale.proveedor_nombre : vale.cliente_nombre],
  ].filter(([, v]) => v != null && String(v).trim() !== '');

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Vale ${esc(vale.tipoVale)} ${esc(vale.folio)}</title>
<style>
  /* Térmicas: NADA de grises (los ditherean y se ven borrosos) — todo negro puro,
     sin fondos invertidos y tamaños mínimos de 10px. */
  @page { size: 80mm auto; margin: 4mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 72mm; font-family: Arial, Helvetica, sans-serif; color: #000; font-size: 12px;
         -webkit-print-color-adjust: exact; }
  .center { text-align: center; }
  .logo { max-width: 34mm; max-height: 18mm; object-fit: contain; margin: 0 auto 2px; display: block; }
  .club { font-weight: 700; font-size: 13px; }
  .titulo { font-size: 11px; letter-spacing: 2px; font-weight: 700; margin-top: 1px; }
  .badge { display: inline-block; margin: 5px auto 3px; padding: 3px 16px; border: 3px solid #000;
           border-radius: 4px; font-weight: 900; font-size: 15px; letter-spacing: 3px; color: #000; }
  .folio { font-size: 22px; font-weight: 900; letter-spacing: 1px; }
  .fecha { font-size: 12px; font-weight: 700; }
  .monto { font-size: 17px; font-weight: 800; text-align: center; margin: 6px 0;
           padding: 4px 0; letter-spacing: .5px;
           border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; }
  .campo { margin: 6px 0; }
  .campo .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; }
  .campo .val { font-size: 13px; font-weight: 600; word-break: break-word; }
  .firmas { display: flex; gap: 6mm; margin-top: 12mm; }
  .firma { flex: 1; text-align: center; font-size: 11px; font-weight: 700; }
  .firma .linea { border-top: 1.5px solid #000; padding-top: 2px; }
  .firma .nombre { font-size: 11px; font-weight: 700; min-height: 13px; }
  .disclaimer { margin-top: 6mm; text-align: center; font-size: 10px; font-weight: 700;
                border-top: 1px dashed #000; padding-top: 3px; }
</style></head>
<body>
  <div class="center">
    <img class="logo" src="${LOGO_URL}" onerror="this.style.display='none'">
    <div class="club">${esc(CLUB_NOMBRE)}</div>
    <div class="titulo">VALE DE CAJA</div>
    <div><span class="badge">${esc(vale.tipoVale)}</span></div>
    <div class="folio">${esc(vale.folio || '—')}</div>
    <div class="fecha">${esc(fmtFecha(vale.fecha))}</div>
  </div>
  <div class="monto">${esc(money(vale.monto))}</div>
  ${campos.map(([lbl, val]) => `<div class="campo"><div class="lbl">${esc(lbl)}</div><div class="val">${esc(val)}</div></div>`).join('')}
  <div class="firmas">
    <div class="firma"><div class="nombre">${esc(vale.autorizado_por || '')}</div><div class="linea">Autorizó</div></div>
    <div class="firma"><div class="nombre">&nbsp;</div><div class="linea">${esEgreso ? 'Recibió' : 'Entregó'}</div></div>
  </div>
  <div class="disclaimer">ESTE DOCUMENTO NO ES COMPROBANTE FISCAL</div>
  <script>window.onload = function(){ window.print(); };<\/script>
</body></html>`;

  w.document.write(html);
  w.document.close();
}

// Folio corto y estable a partir del id (uuid) del movimiento
export const folioDesdeId = (id) => (id ? String(id).replace(/-/g, '').slice(0, 8).toUpperCase() : '—');

// Nombre legible de la caja/cuenta según la convención del motor de saldos
export const cuentaLegible = ({ payment_method, account, bank_name }) => {
  const cta = account ?? bank_name ?? '';
  if (payment_method === 'efectivo') return cta === 'Fondos' ? 'Fondos (caja)' : 'Efectivo (caja chica)';
  if (payment_method === 'tarjeta') return 'Tarjeta';
  return cta === 'MercadoPagoBIA' ? 'Mercado Pago BIA' : (cta || '—');
};

export default { imprimirVale, folioDesdeId, cuentaLegible };
