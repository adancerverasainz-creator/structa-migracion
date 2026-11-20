import React from 'react';
import { Phone } from 'lucide-react';

/**
 * Enlace de WhatsApp (wa.me) a partir de un teléfono capturado a mano.
 * Normaliza: quita todo lo que no sea dígito; 10 dígitos → México (+52);
 * acepta ya con lada 52 (12 dígitos) o 521 (13 dígitos, formato viejo de celular).
 * Devuelve null si no parece un número válido.
 */
export function waLink(phone, text = '') {
  // Si capturaron dos números ("999..., 555...") se usa el primero.
  const primero = String(phone || '').split(/[,;/]|\s{2,}| y /)[0];
  let d = primero.replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) d = '52' + d;                                   // celular México sin lada
  else if (d.length === 13 && d.startsWith('521')) d = '52' + d.slice(3); // formato viejo +52 1
  else if (d.length === 12 && d.startsWith('52')) { /* ya con lada */ }
  else if (d.length === 11 && d.startsWith('1')) { /* EE.UU./Canadá */ }
  else return null; // longitud inválida (p.ej. 11 dígitos por error de captura, 0000, etc.)
  const q = text ? `?text=${encodeURIComponent(text)}` : '';
  return `https://wa.me/${d}${q}`;
}

/**
 * Teléfono clicable: abre el chat de WhatsApp en una pestaña nueva (WhatsApp Web en escritorio,
 * la app en el teléfono). Si el número no es válido, se muestra como texto.
 */
export function PhoneLink({ phone, text = '', className = '', iconClass = 'w-3 h-3', showIcon = true }) {
  if (!phone) return null;
  const href = waLink(phone, text);
  const inner = (
    <>
      {showIcon && <Phone className={iconClass} />}
      <span>{phone}</span>
    </>
  );
  if (!href) return <span className={`inline-flex items-center gap-1 ${className}`} title="Número no válido para WhatsApp: revísalo en Editar jugador">{inner}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title="Abrir chat de WhatsApp"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center gap-1 text-green-700 hover:text-green-800 hover:underline ${className}`}
    >
      {inner}
    </a>
  );
}

const money = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Texto del estado de cuenta para WhatsApp a partir de las secciones de Deuda Unificada
 * (solo conceptos pendientes). Formato de WhatsApp: *negritas*, un concepto por línea.
 */
export function mensajeEstadoCuenta({ player, sections = [], totalDebt = 0, clubName = 'Barcelona Inter Academy', fecha = new Date() }) {
  const nombrePadre = (player?.parent_name || '').trim().split(' ')[0];
  const lineas = [];
  lineas.push(`Hola${nombrePadre ? ' ' + nombrePadre : ''}, le saludamos de *${clubName}*.`);
  lineas.push(`Le compartimos el estado de cuenta de *${player?.full_name || ''}*${player?.category ? ` (${player.category})` : ''} al ${fecha.toLocaleDateString('es-MX')}:`);
  lineas.push('');
  for (const sec of sections) {
    const pend = (sec.items || []).filter(i => (i.pending || 0) > 0);
    if (!pend.length) continue;
    lineas.push(`*${sec.title}*`);
    for (const it of pend) {
      const extra = it.moratorio > 0 ? ` (incluye recargo ${money(it.moratorio)})` : '';
      lineas.push(`• ${it.label}: ${money(it.pending)}${extra}`);
    }
    lineas.push('');
  }
  lineas.push(`*Total pendiente: ${money(totalDebt)}*`);
  lineas.push('');
  lineas.push('Puede pagar en la academia (efectivo) o por transferencia; con gusto le enviamos los datos bancarios. Si ya realizó su pago, por favor ignore este mensaje y compártanos el comprobante. ¡Gracias!');
  return lineas.join('\n');
}
