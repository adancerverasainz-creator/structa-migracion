import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save } from 'lucide-react';

export default function PlayerForm({ player, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState(() => {
    if (player) {
      return {
        ...player,
        birth_date: player.birth_date ? player.birth_date.split('T')[0] : '',
        join_date: player.join_date ? player.join_date.split('T')[0] : '',
      };
    }
    return {
      full_name: '',
      birth_date: '',
      join_date: '',
      category: '',
      parent_name: '',
      parent_phone: '',
      parent_email: '',
      monthly_fee: '',
      scholarship: 'ninguna',
      photo_url: '',
      status: 'activo',
    };
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const submitData = {
      ...formData,
      monthly_fee: parseFloat(formData.monthly_fee) || 0,
    };
    
    // Ensure dates are in YYYY-MM-DD format only
    if (submitData.birth_date) {
      submitData.birth_date = submitData.birth_date.split('T')[0];
    }
    if (submitData.join_date) {
      submitData.join_date = submitData.join_date.split('T')[0];
    }
    
    onSubmit(submitData);
  };

  return (
    <Card className="shadow-lg border-2 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{player ? 'Editar Jugador' : 'Nuevo Jugador'}</span>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-5 h-5" />
          </Button>
        </CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Nombre Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birth_date">Fecha de Nacimiento</Label>
              <Input
                id="birth_date"
                type="date"
                value={formData.birth_date}
                onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="join_date">Fecha de Ingreso</Label>
              <Input
                id="join_date"
                type="date"
                value={formData.join_date}
                onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoría</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Sub 5A">Sub 5A</SelectItem>
                  <SelectItem value="Sub 5B">Sub 5B</SelectItem>
                  <SelectItem value="Sub 5C">Sub 5C</SelectItem>
                  <SelectItem value="Sub 5D">Sub 5D</SelectItem>
                  <SelectItem value="Sub 7A">Sub 7A</SelectItem>
                  <SelectItem value="Sub 7B">Sub 7B</SelectItem>
                  <SelectItem value="Sub 7C">Sub 7C</SelectItem>
                  <SelectItem value="Sub 7D">Sub 7D</SelectItem>
                  <SelectItem value="Sub 9A">Sub 9A</SelectItem>
                  <SelectItem value="Sub 9B">Sub 9B</SelectItem>
                  <SelectItem value="Sub 9C">Sub 9C</SelectItem>
                  <SelectItem value="Sub 9D">Sub 9D</SelectItem>
                  <SelectItem value="Sub 11A">Sub 11A</SelectItem>
                  <SelectItem value="Sub 11B">Sub 11B</SelectItem>
                  <SelectItem value="Sub 11C">Sub 11C</SelectItem>
                  <SelectItem value="Sub 11D">Sub 11D</SelectItem>
                  <SelectItem value="Sub 13A">Sub 13A</SelectItem>
                  <SelectItem value="Sub 13B">Sub 13B</SelectItem>
                  <SelectItem value="Sub 13C">Sub 13C</SelectItem>
                  <SelectItem value="Sub 13D">Sub 13D</SelectItem>
                  <SelectItem value="Sub 15A">Sub 15A</SelectItem>
                  <SelectItem value="Sub 15B">Sub 15B</SelectItem>
                  <SelectItem value="Sub 15C">Sub 15C</SelectItem>
                  <SelectItem value="Sub 15D">Sub 15D</SelectItem>
                  <SelectItem value="Sub 17A">Sub 17A</SelectItem>
                  <SelectItem value="Sub 17B">Sub 17B</SelectItem>
                  <SelectItem value="Sub 17C">Sub 17C</SelectItem>
                  <SelectItem value="Sub 17D">Sub 17D</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scholarship">Beca</Label>
              <Select
                value={formData.scholarship || 'ninguna'}
                onValueChange={(value) => {
                  const updates = { scholarship: value };
                  const currentFee = parseFloat(formData.monthly_fee) || 0;
                  if (value === '100%') {
                    updates.monthly_fee = '0';
                  } else if (value === '50%' && currentFee > 0) {
                    updates.monthly_fee = String(currentFee / 2);
                  }
                  setFormData({ ...formData, ...updates });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin beca" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguna">Sin beca</SelectItem>
                  <SelectItem value="50%">Beca 50%</SelectItem>
                  <SelectItem value="100%">Beca 100%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="monthly_fee">Cuota Mensual *</Label>
              <Select
                value={formData.monthly_fee?.toString()}
                onValueChange={(value) => setFormData({ ...formData, monthly_fee: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuota" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2000">$2,000</SelectItem>
                  <SelectItem value="1700">$1,700</SelectItem>
                  <SelectItem value="1300">$1,300</SelectItem>
                  <SelectItem value="1200">$1,200</SelectItem>
                  <SelectItem value="1080">$1,080</SelectItem>
                  <SelectItem value="960">$960</SelectItem>
                  <SelectItem value="900">$900</SelectItem>
                  <SelectItem value="800">$800</SelectItem>
                  <SelectItem value="600">$600</SelectItem>
                  <SelectItem value="400">$400</SelectItem>
                  <SelectItem value="0">$0</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_name">Nombre del Padre/Madre *</Label>
              <Input
                id="parent_name"
                value={formData.parent_name}
                onChange={(e) => setFormData({ ...formData, parent_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_phone">Teléfono *</Label>
              <Input
                id="parent_phone"
                value={formData.parent_phone}
                onChange={(e) => setFormData({ ...formData, parent_phone: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="parent_email">Email</Label>
              <Input
                id="parent_email"
                type="email"
                value={formData.parent_email}
                onChange={(e) => setFormData({ ...formData, parent_email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="activo">Activo</SelectItem>
                  <SelectItem value="inactivo">Inactivo</SelectItem>
                  <SelectItem value="baja">Baja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            <Save className="w-4 h-4 mr-2" />
            {player ? 'Actualizar' : 'Guardar'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}