import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../lib/formatCurrency';

export default function TicketUniforme({ ticketData, onClose }) {
  const printRef = useRef(null);

  const {
    playerName,
    parentName,
    category,
    items,
    total,
    montoRecibido,
    cambio,
    pendiente,
    paymentMethod,
    paymentDate,
    referenceNumber,
    bankName,
  } = ticketData;

  const handlePrint = () => {
    const printContents = printRef.current.innerHTML;
    const win = window.open('', '_blank', 'width=320,height=600');
    win.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Ticket Uniforme</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              width: 80mm;
              padding: 4mm 4mm;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .large { font-size: 15px; }
            .xlarge { font-size: 18px; }
            .divider {
              border-top: 1px dashed #000;
              margin: 4px 0;
            }
            .divider-solid {
              border-top: 1px solid #000;
              margin: 4px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin: 2px 0;
            }
            .row-item { flex: 1; }
            .row-price { text-align: right; min-width: 60px; }
            .header-logo {
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 1px;
            }
            .section-title {
              font-weight: bold;
              font-size: 10px;
              letter-spacing: 1px;
              text-transform: uppercase;
            }
            .total-row {
              font-size: 14px;
              font-weight: bold;
            }
            .cambio-row {
              font-size: 13px;
              font-weight: bold;
            }
            .pendiente-row {
              font-size: 13px;
              font-weight: bold;
            }
            .footer { font-size: 9px; }
            .mt2 { margin-top: 4px; }
            .mt4 { margin-top: 8px; }
            .badge-pendiente {
              border: 1px solid #000;
              padding: 2px 4px;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          ${printContents}
          <script>window.onload = function(){ window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const methodLabel = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    transferencia: 'Transferencia',
  }[paymentMethod] || paymentMethod;

  const dateFormatted = paymentDate
    ? format(new Date(paymentDate.includes('T') ? paymentDate : paymentDate + 'T12:00:00'), "dd/MM/yyyy HH:mm", { locale: es })
    : format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* Controles */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b">
          <span className="font-semibold text-gray-700 text-sm">Vista previa del ticket</span>
          <div className="flex gap-2">
            <Button size="sm" onClick={handlePrint} className="bg-gray-800 hover:bg-gray-900 gap-1">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Vista previa del ticket */}
        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <div
            ref={printRef}
            style={{
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '11px',
              color: '#000',
              width: '100%',
              maxWidth: '72mm',
              margin: '0 auto',
              lineHeight: '1.5',
            }}
          >
            {/* Encabezado */}
            <div className="center">
              <div className="header-logo">BARCELONA INTER</div>
              <div className="header-logo">ACADEMY</div>
              <div className="mt2" style={{ fontSize: '10px' }}>Venta de Uniformes</div>
              <div style={{ fontSize: '9px', color: '#555' }}>{dateFormatted}</div>
            </div>

            <div className="divider-solid mt2" />

            {/* Datos del cliente */}
            <div className="mt2">
              <div className="section-title">Cliente</div>
              <div className="bold">{playerName}</div>
              {parentName && <div style={{ fontSize: '10px' }}>{parentName}</div>}
              {category && <div style={{ fontSize: '10px' }}>Cat: {category}</div>}
            </div>

            <div className="divider mt2" />

            {/* Artículos */}
            <div className="mt2">
              <div className="section-title">Artículos</div>
              {items.map((item, i) => (
                <div key={i} className="row mt2">
                  <span className="row-item">{item.label}</span>
                  <span className="row-price">{formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>

            <div className="divider mt2" />

            {/* Total */}
            <div className="row mt2 total-row">
              <span>TOTAL</span>
              <span>{formatCurrency(total)}</span>
            </div>

            <div className="divider mt2" />

            {/* Cobro */}
            <div className="mt2">
              <div className="section-title">Cobro</div>
              <div className="row mt2">
                <span>{methodLabel}{bankName ? ` (${bankName})` : ''}</span>
                <span>{formatCurrency(montoRecibido > 0 ? montoRecibido : total)}</span>
              </div>
              {referenceNumber && (
                <div style={{ fontSize: '9px', color: '#555' }}>Ref: {referenceNumber}</div>
              )}
              {cambio > 0 && (
                <div className="row mt2 cambio-row">
                  <span>CAMBIO</span>
                  <span>{formatCurrency(cambio)}</span>
                </div>
              )}
            </div>

            {/* Pendiente */}
            {pendiente > 0 && (
              <>
                <div className="divider mt2" />
                <div className="mt2 center">
                  <div className="badge-pendiente">** PAGO PENDIENTE **</div>
                  <div className="row mt2 pendiente-row">
                    <span>SALDO PENDIENTE</span>
                    <span>{formatCurrency(pendiente)}</span>
                  </div>
                  <div style={{ fontSize: '9px', marginTop: '2px' }}>
                    Este saldo quedará registrado en morosos
                  </div>
                </div>
              </>
            )}

            <div className="divider-solid mt4" />

            {/* Pie */}
            <div className="center footer mt2">
              <div>¡Gracias por su compra!</div>
              <div className="mt2">www.barcelonainteracademy.com</div>
              <div style={{ fontSize: '8px', marginTop: '4px' }}>Powered by STRUCTA</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}