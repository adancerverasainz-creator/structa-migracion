import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Landmark, ShoppingBag, DollarSign, CalendarDays, Plus, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Configuración del club (solo admin) — P0b comercialización.
 * Todo lo que antes estaba hardcodeado en el código ahora se administra aquí:
 * cuentas bancarias, catálogo de uniformes, precios y calendario de temporada.
 * Cada cambio queda en Auditoría automáticamente (triggers de BD).
 */
export default function Configuracion() {
  const queryClient = useQueryClient();
  const [me, setMe] = useState(null);
  React.useEffect(() => { base44.auth.me().then(setMe).catch(() => {}); }, []);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ['bankAccounts'],
    queryFn: () => base44.entities.BankAccount.list('sort_order'),
  });
  const { data: catalogItems = [] } = useQuery({
    queryKey: ['catalogItems'],
    queryFn: () => base44.entities.CatalogItem.list('sort_order'),
  });
  const { data: clubSettings = [] } = useQuery({
    queryKey: ['clubSettings'],
    queryFn: () => base44.entities.ClubSetting.list(),
  });

  const fees = clubSettings.find(cs => cs.key === 'fees')?.value || {};
  const lateFee = clubSettings.find(cs => cs.key === 'late_fee')?.value || {};
  const seasonCal = clubSettings.find(cs => cs.key === 'season_calendar')?.value || {};

  const invalidate = (key) => queryClient.invalidateQueries({ queryKey: [key] });
  const onErr = (err) => toast.error(`No se pudo guardar: ${err?.message || 'error desconocido'}`);

  // ── Cuentas bancarias ──
  const [newBank, setNewBank] = useState('');
  const bankCreate = useMutation({
    mutationFn: (name) => base44.entities.BankAccount.create({ name, active: true, sort_order: (bankAccounts.length + 1) * 10 }),
    onSuccess: () => { invalidate('bankAccounts'); setNewBank(''); toast.success('Cuenta agregada'); },
    onError: onErr,
  });
  const bankToggle = useMutation({
    mutationFn: (b) => base44.entities.BankAccount.update(b.id, { active: !b.active }),
    onSuccess: () => invalidate('bankAccounts'),
    onError: onErr,
  });

  // ── Catálogo de uniformes ──
  const [newItem, setNewItem] = useState({ label: '', price: '' });
  const itemCreate = useMutation({
    mutationFn: ({ label, price }) => base44.entities.CatalogItem.create({
      code: label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40) + '_' + Date.now().toString(36),
      label, price: parseFloat(price) || 0, category: 'uniformes', active: true,
      sort_order: (catalogItems.length + 1) * 10,
    }),
    onSuccess: () => { invalidate('catalogItems'); setNewItem({ label: '', price: '' }); toast.success('Artículo agregado'); },
    onError: onErr,
  });
  const itemUpdate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CatalogItem.update(id, data),
    onSuccess: () => invalidate('catalogItems'),
    onError: onErr,
  });

  // ── Ajustes JSON (fees / late_fee / season_calendar) ──
  const settingSave = useMutation({
    mutationFn: async ({ key, value }) => {
      // club_settings usa `key` como PK — upsert directo
      const { error } = await supabase.from('club_settings')
        .upsert({ key, value, updated_by: me?.email || '', updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => { invalidate('clubSettings'); toast.success('Configuración guardada'); },
    onError: onErr,
  });

  // Editores locales
  const [feesDraft, setFeesDraft] = useState(null);
  const [lateDraft, setLateDraft] = useState(null);
  const [seasonDraft, setSeasonDraft] = useState(null);
  const [newSeason, setNewSeason] = useState({ month: '', factor: '0.5', label: '' });

  const f = feesDraft ?? fees;
  const lf = lateDraft ?? lateFee;
  const sc = seasonDraft ?? seasonCal;

  if (me && me.role !== 'admin') {
    return (
      <div className="p-8 text-center text-gray-600">
        <Settings className="w-12 h-12 mx-auto text-gray-300 mb-3" />
        Esta sección es exclusiva del administrador.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <ERPPageHeader
        icon={Settings}
        breadcrumb={['BIA', 'Configuración']}
        title="Configuración del Club"
        subtitle="Cuentas, catálogos, precios y temporadas — sin tocar código. Todo cambio queda en Auditoría."
      />

      <Tabs defaultValue="cuentas">
        <TabsList>
          <TabsTrigger value="cuentas"><Landmark className="w-4 h-4 mr-1" /> Cuentas</TabsTrigger>
          <TabsTrigger value="catalogo"><ShoppingBag className="w-4 h-4 mr-1" /> Uniformes</TabsTrigger>
          <TabsTrigger value="precios"><DollarSign className="w-4 h-4 mr-1" /> Precios</TabsTrigger>
          <TabsTrigger value="temporadas"><CalendarDays className="w-4 h-4 mr-1" /> Temporadas</TabsTrigger>
        </TabsList>

        {/* ── CUENTAS BANCARIAS ── */}
        <TabsContent value="cuentas">
          <Card>
            <CardHeader><CardTitle className="text-base">Cuentas bancarias del club</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {bankAccounts.map(b => (
                <div key={b.id} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className={b.active ? 'font-medium' : 'text-gray-400 line-through'}>{b.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge className={b.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}>
                      {b.active ? 'Activa' : 'Inactiva'}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => bankToggle.mutate(b)}>
                      {b.active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Nueva cuenta (ej. Santander)" value={newBank} onChange={e => setNewBank(e.target.value)} />
                <Button disabled={!newBank.trim() || bankCreate.isPending} onClick={() => bankCreate.mutate(newBank.trim())}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <p className="text-xs text-gray-500">Las cuentas inactivas dejan de aparecer en los formularios de cobro, pero su historial se conserva.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── CATÁLOGO UNIFORMES ── */}
        <TabsContent value="catalogo">
          <Card>
            <CardHeader><CardTitle className="text-base">Catálogo de uniformes y precios</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {catalogItems.map(it => (
                <div key={it.id} className="flex items-center justify-between border rounded-lg px-3 py-2 gap-2">
                  <span className={it.active ? 'font-medium flex-1' : 'text-gray-400 line-through flex-1'}>{it.label}</span>
                  <Input
                    type="number" className="w-28 text-right" defaultValue={it.price}
                    onBlur={e => {
                      const v = parseFloat(e.target.value);
                      if (!isNaN(v) && v !== Number(it.price)) itemUpdate.mutate({ id: it.id, data: { price: v } });
                    }}
                  />
                  <Button size="sm" variant="outline" onClick={() => itemUpdate.mutate({ id: it.id, data: { active: !it.active } })}>
                    {it.active ? 'Desactivar' : 'Activar'}
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="Nuevo artículo" value={newItem.label} onChange={e => setNewItem(s => ({ ...s, label: e.target.value }))} />
                <Input placeholder="Precio" type="number" className="w-28" value={newItem.price} onChange={e => setNewItem(s => ({ ...s, price: e.target.value }))} />
                <Button disabled={!newItem.label.trim() || !newItem.price || itemCreate.isPending} onClick={() => itemCreate.mutate(newItem)}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── PRECIOS ── */}
        <TabsContent value="precios">
          <Card>
            <CardHeader><CardTitle className="text-base">Precios base del club</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Inscripción (default para deuda)</span>
                  <Input type="number" value={f.inscripcion_default ?? ''} onChange={e => setFeesDraft({ ...f, inscripcion_default: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Semana de Summer Camp</span>
                  <Input type="number" value={f.summer_week ?? ''} onChange={e => setFeesDraft({ ...f, summer_week: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Montos rápidos — Inscripción (separados por coma)</span>
                  <Input value={(f.inscripcion_montos || []).join(', ')} onChange={e => setFeesDraft({ ...f, inscripcion_montos: e.target.value.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x)) })} />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Montos rápidos — Reinscripción</span>
                  <Input value={(f.reinscripcion_montos || []).join(', ')} onChange={e => setFeesDraft({ ...f, reinscripcion_montos: e.target.value.split(',').map(x => parseFloat(x.trim())).filter(x => !isNaN(x)) })} />
                </label>
              </div>
              <div className="border-t pt-4 grid md:grid-cols-3 gap-4">
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Día límite de pago</span>
                  <Input type="number" value={lf.cutoff_day ?? 15} onChange={e => setLateDraft({ ...lf, cutoff_day: parseInt(e.target.value) || 15 })} />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Recargo por morosidad ($)</span>
                  <Input type="number" value={lf.amount ?? 100} onChange={e => setLateDraft({ ...lf, amount: parseFloat(e.target.value) || 0 })} />
                </label>
                <label className="text-sm space-y-1 block">
                  <span className="text-gray-600">Vigente desde (AAAA-MM)</span>
                  <Input value={lf.start_month ?? ''} onChange={e => setLateDraft({ ...lf, start_month: e.target.value })} />
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  disabled={settingSave.isPending || (!feesDraft && !lateDraft)}
                  onClick={async () => {
                    if (feesDraft) await settingSave.mutateAsync({ key: 'fees', value: feesDraft });
                    if (lateDraft) await settingSave.mutateAsync({ key: 'late_fee', value: { enabled: true, ...lateFee, ...lateDraft } });
                    setFeesDraft(null); setLateDraft(null);
                  }}>
                  <Save className="w-4 h-4 mr-1" /> Guardar precios
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TEMPORADAS ── */}
        <TabsContent value="temporadas">
          <Card>
            <CardHeader><CardTitle className="text-base">Calendario de temporada (cuota por mes)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-gray-500">
                Factor 1 = mes normal · 0.5 = medio mes (cuota 50%) · 0 = sin actividad (nadie genera deuda ese mes).
              </p>
              {Object.entries(sc).sort(([a], [b]) => a.localeCompare(b)).map(([month, entry]) => (
                <div key={month} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <span className="font-mono text-sm">{month}</span>
                  <span className="text-sm text-gray-600">{entry.label || ''}</span>
                  <Badge className={Number(entry.factor ?? entry) === 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                    factor {entry.factor ?? entry}
                  </Badge>
                  <Button size="sm" variant="outline" className="text-red-600"
                    onClick={() => { const next = { ...sc }; delete next[month]; setSeasonDraft(next); }}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <Input placeholder="AAAA-MM" className="w-32" value={newSeason.month} onChange={e => setNewSeason(s => ({ ...s, month: e.target.value }))} />
                <Input placeholder="Factor (0, 0.5, 1)" type="number" step="0.1" className="w-36" value={newSeason.factor} onChange={e => setNewSeason(s => ({ ...s, factor: e.target.value }))} />
                <Input placeholder="Etiqueta (ej. Vacaciones)" value={newSeason.label} onChange={e => setNewSeason(s => ({ ...s, label: e.target.value }))} />
                <Button
                  disabled={!/^\d{4}-\d{2}$/.test(newSeason.month)}
                  onClick={() => {
                    setSeasonDraft({ ...sc, [newSeason.month]: { factor: parseFloat(newSeason.factor) || 0, label: newSeason.label } });
                    setNewSeason({ month: '', factor: '0.5', label: '' });
                  }}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              <Button
                disabled={settingSave.isPending || !seasonDraft}
                onClick={async () => { await settingSave.mutateAsync({ key: 'season_calendar', value: seasonDraft }); setSeasonDraft(null); }}>
                <Save className="w-4 h-4 mr-1" /> Guardar calendario
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
