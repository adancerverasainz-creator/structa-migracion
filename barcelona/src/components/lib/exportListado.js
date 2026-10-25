// Exportación uniforme de listados (PDF térmico-no: carta, y Excel) para los
// módulos de cobranza: Morosos mensualidad, Inscripciones pendientes, Morosos
// torneos y Uniformes pendientes. Mismo encabezado y estilo que el reporte de
// Morosos original (jsPDF + xlsx, sin dependencias nuevas).
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

const safe = (s) => String(s || 'reporte').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/**
 * @param {object} o
 * @param {string}   o.titulo     Ej. "Inscripciones pendientes — Temporada 2026-2027"
 * @param {string[]} o.resumen    Líneas de resumen (ej. ["Jugadores: 127", "Deuda total: $228,600.00"])
 * @param {string[]} o.columnas   Encabezados
 * @param {number[]} [o.anchos]   Anchos PDF (mm) por columna; si faltan se reparten
 * @param {Array<Array<string|number>>} o.filas   Valores ya formateados para PDF
 * @param {Array<Array<string|number>>} [o.filasExcel] Valores crudos para Excel (default: filas)
 * @param {string}   o.archivo    Nombre base del archivo (sin extensión)
 */
export function exportarPDF({ titulo, resumen = [], columnas, anchos, filas, archivo }) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const usable = pageWidth - 28;
  const widths = anchos && anchos.length === columnas.length
    ? anchos
    : columnas.map(() => usable / columnas.length);

  doc.setFontSize(16); doc.setTextColor(165, 0, 68); doc.text('Barcelona Inter Academy', 14, 18);
  doc.setFontSize(12); doc.setTextColor(40, 40, 40); doc.text(titulo, 14, 27);
  doc.setFontSize(9); doc.setTextColor(120, 120, 120); doc.text(`Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);
  doc.setFontSize(10); doc.setTextColor(40, 40, 40);
  let y = 43;
  if (resumen.length) { doc.text(resumen.join('   |   '), 14, y); y += 9; }

  const header = () => {
    doc.setFillColor(165, 0, 68); doc.rect(14, y, usable, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8);
    let x = 16; columnas.forEach((c, i) => { doc.text(String(c), x, y + 5.5); x += widths[i]; });
    y += 8;
  };
  header();
  filas.forEach((row, idx) => {
    if (y > 270) { doc.addPage(); y = 20; header(); }
    if (idx % 2 === 0) { doc.setFillColor(255, 240, 245); doc.rect(14, y, usable, 8, 'F'); }
    doc.setTextColor(40, 40, 40); doc.setFontSize(8);
    let x = 16;
    row.forEach((val, i) => {
      const text = doc.splitTextToSize(String(val ?? '-'), widths[i] - 2)[0];
      doc.text(text, x, y + 5.5); x += widths[i];
    });
    y += 8;
  });
  doc.save(`${safe(archivo)}.pdf`);
}

export function exportarExcel({ titulo, resumen = [], columnas, filas, filasExcel, archivo, hoja = 'Reporte' }) {
  const wsData = [
    [`Barcelona Inter Academy - ${titulo}`],
    resumen.length ? resumen : [''],
    [],
    columnas,
    ...(filasExcel || filas),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
  XLSX.writeFile(wb, `${safe(archivo)}.xlsx`);
}
