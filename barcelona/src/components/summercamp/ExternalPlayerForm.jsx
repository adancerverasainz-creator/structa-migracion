import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, UserPlus } from 'lucide-react';

export default function ExternalPlayerForm({ player, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    full_name: player?.full_name || '',
    age: player?.age || '',
    category: player?.category || '',
    parent_name: player?.parent_name || '',
    parent_phone: player?.parent_phone || '',
    notes: player?.notes || '',
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ ...formData, age: formData.age ? parseInt(formData.age) : null });
  };

  const isEditing = !!player?.id;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-2xl px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <UserPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg leading-tight">
                {isEditing ? 'Editar Jugador Externo' : 'Registrar Jugador Externo'}
              </h2>
              <p className="text-white/70 text-sm">Summer Camp 2026</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Nombre completo *</Label>
                <Input
                  value={formData.full_name}
                  onChange={e => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="Nombre del jugador"
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Edad</Label>
                <Input
                  type="number" min="3" max="18"
                  value={formData.age}
                  onChange={e => setFormData({ ...formData, age: e.target.value })}
                  placeholder="Ej: 10"
                  className="h-10"
                  onWheel={e => e.currentTarget.blur()}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Categoría</Label>
                <Input
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Ej: Sub-10, Sub-12..."
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Nombre del tutor *</Label>
                <Input
                  value={formData.parent_name}
                  onChange={e => setFormData({ ...formData, parent_name: e.target.value })}
                  placeholder="Nombre del padre/madre"
                  className="h-10"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Teléfono *</Label>
                <Input
                  value={formData.parent_phone}
                  onChange={e => setFormData({ ...formData, parent_phone: e.target.value })}
                  placeholder="55 1234 5678"
                  className="h-10"
                  required
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm font-semibold text-gray-700">Notas</Label>
                <Textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  rows={2}
                />
              </div>
            </div>
          </div>

          <div className="px-6 pb-6 flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>Cancelar</Button>
            <Button type="submit" disabled={isLoading} className="bg-violet-600 hover:bg-violet-700 gap-2">
              <Save className="w-4 h-4" />
              {isLoading ? 'Guardando...' : isEditing ? 'Actualizar' : 'Registrar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}