import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, FileText, Building2, Tag, Calendar, CreditCard, StickyNote } from 'lucide-react';

const CATEGORY_LABELS = {
  nomina: 'Nómina',
  proveedor: 'Proveedor',
  arbitros: 'Árbitros',
  renta: 'Renta',
  equipamiento: 'Equipamiento',
  torneo: 'Torneo',
  viaticos: 'Viáticos',
  hospedaje: 'Hospedaje',
  transporte: 'Transporte',
  intereses: 'Intereses',
  otros: 'Otros',
};

export default function AccountPayableForm({ account, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(() => ({
    concept: account?.concept || '',
    supplier: account?.supplier || '',
    total_amount: account?.total_amount || '',
    due_date: account?.due_date ? account.due_date.slice(0, 10) : '',
    category: account?.category || 'otros',
    payment_method: account?.payment_method || 'efectivo',
    notes: account?.notes || '',
    status: account?.status || 'pendiente',
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, total_amount: parseFloat(formData.total_amount) || 0 });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl my-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-[#1a1a2e] to-indigo-700 rounded-t-2xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {account ? 'Editar Cuenta por Pagar' : 'Nueva Cuenta por Pagar'}
              </h2>
              <p className="text-white/70 text-sm">Completa los datos de la obligación</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">

            {/* Sección: Identificación */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Identificación
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Concepto *</Label>
                  <Input
                    value={formData.concept}
                    onChange={e => setFormData({ ...formData, concept: e.target.value })}
                    placeholder="Ej: Pago nómina abril, Uniformes proveedor X..."
                    className="h-10"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400" /> Proveedor / Acreedor
                  </Label>
                  <Input
                    value={formData.supplier}
                    onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="Nombre del proveedor"
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-gray-400" /> Categoría
                  </Label>
                  <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Sección: Monto y Fechas */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> Monto y Vencimiento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Monto Total *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-semibold">$</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.total_amount}
                      onChange={e => setFormData({ ...formData, total_amount: e.target.value })}
                      onWheel={e => e.currentTarget.blur()}
                      placeholder="0.00"
                      className="pl-7 h-10 text-lg font-semibold"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" /> Fecha Límite de Pago
                  </Label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={e => setFormData({ ...formData, due_date: e.target.value })}
                    className="h-10"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Sección: Pago */}
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" /> Método de Pago
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold text-gray-700">Método Preferido</Label>
                  <Select value={formData.payment_method} onValueChange={v => setFormData({ ...formData, payment_method: v })}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* Notas */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <StickyNote className="w-3.5 h-3.5 text-gray-400" /> Notas
              </Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Información adicional..."
                rows={2}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
              <Save className="w-4 h-4" />
              {account ? 'Actualizar Cuenta' : 'Crear Cuenta'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}