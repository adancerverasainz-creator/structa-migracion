import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save } from 'lucide-react';

const CATEGORIES = [
  "Sub 5A","Sub 5B","Sub 5C","Sub 5D",
  "Sub 7A","Sub 7B","Sub 7C","Sub 7D",
  "Sub 9A","Sub 9B","Sub 9C","Sub 9D",
  "Sub 11A","Sub 11B","Sub 11C","Sub 11D",
  "Sub 13A","Sub 13B","Sub 13C","Sub 13D",
  "Sub 15A","Sub 15B","Sub 15C","Sub 15D",
  "Sub 17A","Sub 17B","Sub 17C","Sub 17D",
];

const FEE_OPTIONS = [800, 900, 1000, 1100, 1200, 1300, 1500, 1800, 2000];

export default function PreRegistroForm({ record, onSubmit, onCancel, isLoading }) {
  const [form, setForm] = useState({
    full_name: record?.full_name || '',
    birth_date: record?.birth_date || '',
    join_date: record?.join_date || '',
    category: record?.category || '',
    parent_name: record?.parent_name || '',
    parent_phone: record?.parent_phone || '',
    parent_email: record?.parent_email || '',
    monthly_fee: record?.monthly_fee || '',
    photo_url: record?.photo_url || '',
    notes: record?.notes || '',
  });

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...form, monthly_fee: parseFloat(form.monthly_fee) || 0 });
  };

  return (
    <Card className="shadow-lg border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{record ? 'Editar Pre-Registro' : 'Nuevo Pre-Registro'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel}><X className="w-5 h-5" /></Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="space-y-2 md:col-span-2">
              <Label>Nombre completo *</Label>
              <Input value={form.full_name} onChange={e => set('full_name', e.target.value)} required placeholder="Nombre del jugador" />
            </div>

            {/* Fecha nacimiento */}
            <div className="space-y-2">
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={form.birth_date} onChange={e => set('birth_date', e.target.value)} />
            </div>

            {/* Fecha ingreso */}
            <div className="space-y-2">
              <Label>Fecha de ingreso</Label>
              <Input type="date" value={form.join_date} onChange={e => set('join_date', e.target.value)} />
            </div>

            {/* Categoría */}
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={form.category} onValueChange={v => set('category', v)}>
                <SelectTrigger><SelectValue placeholder="Seleccionar categoría" /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cuota mensual */}
            <div className="space-y-2">
              <Label>Cuota mensual *</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {FEE_OPTIONS.map(fee => (
                  <button key={fee} type="button"
                    onClick={() => set('monthly_fee', fee)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors ${parseFloat(form.monthly_fee) === fee ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 hover:border-blue-400'}`}
                  >
                    ${fee}
                  </button>
                ))}
              </div>
              <Input type="number" value={form.monthly_fee} onChange={e => set('monthly_fee', e.target.value)} required placeholder="Monto mensual" />
            </div>

            {/* Padre/tutor */}
            <div className="space-y-2">
              <Label>Nombre del padre/tutor *</Label>
              <Input value={form.parent_name} onChange={e => set('parent_name', e.target.value)} required placeholder="Nombre completo" />
            </div>

            {/* Teléfono */}
            <div className="space-y-2">
              <Label>Teléfono *</Label>
              <Input value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} required placeholder="Número de teléfono" />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label>Email del padre/tutor</Label>
              <Input type="email" value={form.parent_email} onChange={e => set('parent_email', e.target.value)} placeholder="correo@ejemplo.com" />
            </div>

            {/* Notas */}
            <div className="space-y-2 md:col-span-2">
              <Label>Notas adicionales</Label>
              <Textarea value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Comentarios, observaciones..." rows={3} />
            </div>
          </div>
        </CardContent>
        <div className="px-6 pb-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {record ? 'Actualizar' : 'Guardar Pre-Registro'}
          </Button>
        </div>
      </form>
    </Card>
  );
}