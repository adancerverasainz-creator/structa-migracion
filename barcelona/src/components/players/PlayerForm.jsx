import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Save, GraduationCap } from 'lucide-react';
import { BECA_MOTIVOS, becaPct, cuotaNeta } from '@/lib/financeEngine';

export default function PlayerForm({ player, onSubmit, onCancel, isLoading }) {
  // Regla del club: solo un admin puede capturar/modificar fecha de ingreso retroactiva.
  // (También reforzada con un trigger en la base de datos.)
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin';
  const todayStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // Cuotas desde Configuración (club_settings → fees.mensualidad_montos); fallback local.
  // Si el jugador ya tiene una cuota fuera del catálogo (p.ej. beca 50%), se agrega para no perderla.
  const { data: clubSettings = [] } = useQuery({ queryKey: ['clubSettings'], queryFn: () => base44.entities.ClubSetting.list() });
  const CUOTAS_DEFAULT = [2000, 1700, 1450, 1320, 1300, 1200, 1190, 1160, 1100, 1080, 1060, 960, 900, 800, 660, 600, 400, 300, 0];
  const montosConfig = clubSettings.find(cs => cs.key === 'fees')?.value?.mensualidad_montos;
  const cuotasBase = (montosConfig && montosConfig.length) ? montosConfig : CUOTAS_DEFAULT;
  // Cuota completa del club (Configuración → Precios). La cuota del jugador = cuota completa × (1 − beca%).
  const feesCfg = clubSettings.find(cs => cs.key === 'fees')?.value || {};
  const cuotaCompleta = Number(feesCfg.cuota_completa) || 1320;
  const BECA_PCTS = [0, 10, 20, 25, 30, 40, 50, 60, 75, 100];

  const [formData, setFormData] = useState(() => {
    if (player) {
      return {
        ...player,
        scholarship_pct: becaPct(player),
        scholarship_reason: player.scholarship_reason || '',
        birth_date: player.birth_date ? player.birth_date.split('T')[0] : '',
        join_date: player.join_date ? player.join_date.split('T')[0] : '',
        baja_date: player.baja_date ? player.baja_date.split('T')[0] : '',
      };
    }
    return {
      full_name: '',
      birth_date: '',
      join_date: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10),
      category: '',
      parent_name: '',
      parent_phone: '',
      parent_email: '',
      monthly_fee: '',
      scholarship: 'ninguna',
      scholarship_pct: 0,
      scholarship_reason: '',
      photo_url: '',
      status: 'activo',
      baja_date: '',
    };
  });

  const [becaError, setBecaError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const pctBeca = Math.min(100, Math.max(0, parseFloat(formData.scholarship_pct) || 0));
    if (pctBeca > 0 && !formData.scholarship_reason) {
      setBecaError('Indica el motivo de la beca.');
      return;
    }
    setBecaError('');
    const submitData = {
      ...formData,
      monthly_fee: parseFloat(formData.monthly_fee) || 0,
      scholarship_pct: pctBeca,
      scholarship_reason: pctBeca > 0 ? formData.scholarship_reason : null,
      // Campo legado (solo etiqueta): se mantiene sincronizado con el porcentaje.
      scholarship: pctBeca > 0 ? `${Math.round(pctBeca)}%` : 'ninguna',
    };
    // No-admin: alta siempre con fecha del día; edición no puede alterar la fecha de ingreso
    if (!isAdmin) {
      if (!player) submitData.join_date = todayStr;
      else submitData.join_date = player.join_date;
    }
    
    // Ensure dates are in YYYY-MM-DD format only
    if (submitData.birth_date) {
      submitData.birth_date = submitData.birth_date.split('T')[0];
    }
    // Fecha de baja: obligatoria si el estatus no es activo (congela la deuda en ese mes);
    // si vuelve a activo, se limpia.
    if (submitData.status === 'activo') submitData.baja_date = null;
    else if (!submitData.baja_date) submitData.baja_date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (submitData.baja_date) submitData.baja_date = String(submitData.baja_date).split('T')[0];
    if (submitData.join_date) {
      submitData.join_date = submitData.join_date.split('T')[0];
    }
    
    onSubmit(submitData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start md:items-center justify-center p-4 overflow-y-auto" onClick={onCancel}>
    <Card className="shadow-2xl border-2 border-blue-200 w-full max-w-3xl my-8 md:my-auto bg-white" onClick={(e) => e.stopPropagation()}>
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
                min={isAdmin ? undefined : (player ? undefined : todayStr)}
                disabled={!isAdmin}
                onChange={(e) => setFormData({ ...formData, join_date: e.target.value })}
              />
              {!isAdmin && (
                <p className="text-xs text-gray-500">Las altas se registran con la fecha del día. Solo un administrador puede capturar ingresos retroactivos.</p>
              )}
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
              <Label htmlFor="scholarship_pct">Beca (% sobre cuota completa ${cuotaCompleta.toLocaleString('en-US')})</Label>
              <Select
                value={String(Math.round(parseFloat(formData.scholarship_pct) || 0))}
                onValueChange={(value) => {
                  const pct = parseFloat(value) || 0;
                  setFormData({
                    ...formData,
                    scholarship_pct: pct,
                    scholarship_reason: pct > 0 ? formData.scholarship_reason : '',
                    monthly_fee: String(cuotaNeta(cuotaCompleta, pct)),
                  });
                }}
              >
                <SelectTrigger id="scholarship_pct">
                  <SelectValue placeholder="Sin beca" />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const actual = Math.round(parseFloat(formData.scholarship_pct) || 0);
                    const lista = BECA_PCTS.includes(actual) ? BECA_PCTS : [...BECA_PCTS, actual].sort((a, b) => a - b);
                    return lista.map(v => (
                      <SelectItem key={v} value={String(v)}>{v === 0 ? 'Sin beca' : `Beca ${v}% → cuota $${cuotaNeta(cuotaCompleta, v).toLocaleString('en-US')}`}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
            </div>
            {(parseFloat(formData.scholarship_pct) || 0) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="scholarship_reason">Motivo de la beca *</Label>
                <Select
                  value={formData.scholarship_reason || ''}
                  onValueChange={(value) => { setBecaError(''); setFormData({ ...formData, scholarship_reason: value }); }}
                >
                  <SelectTrigger id="scholarship_reason" className={becaError ? 'border-red-400' : ''}>
                    <SelectValue placeholder="Seleccionar motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {BECA_MOTIVOS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {becaError && <p className="text-xs text-red-600">{becaError}</p>}
              </div>
            )}
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
                  {(() => {
                    const actual = parseFloat(formData.monthly_fee);
                    const lista = (!isNaN(actual) && !cuotasBase.some(c => parseFloat(c) === actual))
                      ? [...cuotasBase, actual].sort((a, b) => b - a)
                      : cuotasBase;
                    return lista.map(c => (
                      <SelectItem key={c} value={String(c)}>${Number(c).toLocaleString('en-US')}</SelectItem>
                    ));
                  })()}
                </SelectContent>
              </Select>
              {(() => {
                const pct = parseFloat(formData.scholarship_pct) || 0;
                const esperada = cuotaNeta(cuotaCompleta, pct);
                const actual = parseFloat(formData.monthly_fee);
                if (isNaN(actual) || actual === esperada) return null;
                return (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Cuota fuera de política: con beca {Math.round(pct)}% corresponde ${esperada.toLocaleString('en-US')}. Se guardará ${actual.toLocaleString('en-US')} y quedará marcada en el panel de becas.
                  </p>
                );
              })()}
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
            {formData.status !== 'activo' && (
              <div className="space-y-2">
                <Label htmlFor="baja_date">Fecha de baja / inactivación *</Label>
                <Input
                  id="baja_date"
                  type="date"
                  value={formData.baja_date || ''}
                  onChange={(e) => setFormData({ ...formData, baja_date: e.target.value })}
                />
                <p className="text-xs text-gray-500">La deuda se genera solo hasta el mes de esta fecha.</p>
              </div>
            )}
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
    </div>
  );
}
