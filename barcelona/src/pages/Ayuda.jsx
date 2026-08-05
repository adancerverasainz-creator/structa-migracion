import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, Bot, LifeBuoy, Search, Send, Plus } from 'lucide-react';
import { format } from 'date-fns';
import ERPPageHeader from '../components/layout/ERPPageHeader';
import { formatCurrency } from '../components/lib/formatCurrency';

const MODULOS = ['Pagos', 'Jugadores', 'Egresos', 'Fondos', 'CxP', 'Torneos', 'Summer', 'Reportes', 'Configuración', 'Otro'];
const STATUS_STYLES = {
  abierto: 'bg-red-100 text-red-700',
  en_proceso: 'bg-amber-100 text-amber-800',
  resuelto: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-200 text-gray-600',
};

export default function Ayuda() {
  const queryClient = useQueryClient();
  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me() });
  const isAdmin = currentUser?.role === 'admin';

  // ---------- Guías (fuente única: vera_context, misma memoria que usa VERA) ----------
  const [guideSearch, setGuideSearch] = useState('');
  const { data: guias = [] } = useQuery({
    queryKey: ['veraContext'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vera_context')
        .select('id,kind,title,content,tags').eq('active', true).order('kind');
      if (error) throw new Error(error.message);
      return data || [];
    },
  });
  const guiasFiltradas = guias.filter(g => {
    const q = guideSearch.toLowerCase();
    return !q || g.title.toLowerCase().includes(q) || g.content.toLowerCase().includes(q) || (g.tags || []).join(' ').includes(q);
  });

  // ---------- Asistente VERA ----------
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const chatEndRef = useRef(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat]);

  const enviarAVera = async () => {
    const msg = chatInput.trim();
    if (!msg || chatBusy) return;
    setChat(c => [...c, { role: 'user', text: msg }]);
    setChatInput('');
    setChatBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('vera-bia', {
        body: { message: msg, history: chat },
      });
      if (error) throw new Error(error.message);
      if (data?.error) {
        setChat(c => [...c, { role: 'vera', text: data.message || 'El asistente no está disponible por el momento.' }]);
      } else {
        setChat(c => [...c, { role: 'vera', text: data?.reply || 'Sin respuesta.' }]);
      }
    } catch (e) {
      setChat(c => [...c, { role: 'vera', text: `No pude responder (${e.message}). Puedes crear un ticket en la pestaña Soporte.` }]);
    } finally {
      setChatBusy(false);
    }
  };

  // ---------- Soporte (tickets) ----------
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticket, setTicket] = useState({ title: '', module: 'Pagos', description: '', priority: 'normal' });
  const { data: tickets = [] } = useQuery({
    queryKey: ['supportTickets'],
    queryFn: async () => {
      const { data, error } = await supabase.from('support_tickets')
        .select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const crearTicket = useMutation({
    mutationFn: async (t) => {
      const { error } = await supabase.from('support_tickets').insert({
        title: t.title, module: t.module, description: t.description,
        priority: t.priority, created_by: currentUser?.email || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Ticket creado — el administrador lo verá en este panel');
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
      setShowTicketForm(false);
      setTicket({ title: '', module: 'Pagos', description: '', priority: 'normal' });
    },
    onError: (e) => toast.error(`No se pudo crear el ticket: ${e.message}`),
  });

  const actualizarTicket = useMutation({
    mutationFn: async ({ id, patch }) => {
      const { error } = await supabase.from('support_tickets')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success('Ticket actualizado');
      queryClient.invalidateQueries({ queryKey: ['supportTickets'] });
    },
    onError: (e) => toast.error(`No se pudo actualizar: ${e.message}`),
  });

  // ---------- Resumen del día (solo admin, calculado al abrir) ----------
  const hoy = format(new Date(), 'yyyy-MM-dd');
  const { data: resumen } = useQuery({
    queryKey: ['resumenHoy', hoy],
    enabled: isAdmin,
    queryFn: async () => {
      const [{ data: pagosHoy }, { data: arqueosHoy }] = await Promise.all([
        supabase.from('payments').select('amount').eq('payment_date', hoy),
        supabase.from('caja_arqueos').select('id').gte('created_at', `${hoy}T00:00:00`),
      ]);
      const cobrado = (pagosHoy || []).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
      return { pagos: (pagosHoy || []).length, cobrado, arqueoHecho: (arqueosHoy || []).length > 0 };
    },
  });
  const ticketsAbiertos = tickets.filter(t => t.status === 'abierto' || t.status === 'en_proceso').length;

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-4 md:p-6">
      <ERPPageHeader
        icon={LifeBuoy}
        breadcrumb={['BIA', 'Ayuda y Soporte']}
        title="Ayuda y Soporte"
        subtitle="Guías del sistema, asistente VERA y tickets de soporte"
      />

      {isAdmin && resumen && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="pt-5 flex flex-wrap gap-6 text-sm">
            <div><span className="text-gray-500">Pagos capturados hoy:</span> <span className="font-bold">{resumen.pagos}</span> ({formatCurrency(resumen.cobrado)})</div>
            <div><span className="text-gray-500">Arqueo de caja de hoy:</span> <span className={`font-bold ${resumen.arqueoHecho ? 'text-green-700' : 'text-amber-700'}`}>{resumen.arqueoHecho ? 'Hecho ✓' : 'Pendiente'}</span></div>
            <div><span className="text-gray-500">Tickets abiertos:</span> <span className="font-bold">{ticketsAbiertos}</span></div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="guias">
        <TabsList>
          <TabsTrigger value="guias" className="flex items-center gap-2"><BookOpen className="w-4 h-4" />Guías</TabsTrigger>
          <TabsTrigger value="vera" className="flex items-center gap-2"><Bot className="w-4 h-4" />Asistente VERA</TabsTrigger>
          <TabsTrigger value="soporte" className="flex items-center gap-2"><LifeBuoy className="w-4 h-4" />Soporte</TabsTrigger>
        </TabsList>

        {/* ---------- GUÍAS ---------- */}
        <TabsContent value="guias" className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input placeholder="Buscar en las guías... (ej. recargo, condonar, pausa)" value={guideSearch}
              onChange={(e) => setGuideSearch(e.target.value)} className="pl-10" />
          </div>
          {guiasFiltradas.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin resultados. Prueba con otra palabra o pregúntale a VERA.</p>
          ) : (
            <div className="grid gap-3">
              {guiasFiltradas.map(g => (
                <Card key={g.id}>
                  <CardContent className="pt-5">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={g.kind === 'regla' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}>
                        {g.kind === 'regla' ? 'Regla del club' : 'Guía'}
                      </Badge>
                      <h3 className="font-bold text-gray-900">{g.title}</h3>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{g.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------- ASISTENTE VERA ---------- */}
        <TabsContent value="vera" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="w-5 h-5 text-purple-600" />
                VERA — Asistente del ERP
                <span className="text-xs font-normal text-gray-500">Responde dudas del sistema. Solo consulta: nunca modifica datos.</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-80 overflow-y-auto border rounded-lg p-4 bg-gray-50 space-y-3">
                {chat.length === 0 && (
                  <p className="text-sm text-gray-500">
                    Pregúntame lo que necesites del sistema. Ejemplos: "¿por qué no puedo editar un pago de ayer?",
                    "¿por qué Diego debe $600 en julio?", "¿cómo condono una deuda?"
                  </p>
                )}
                {chat.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-4 py-2 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border text-gray-800'}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {chatBusy && <p className="text-xs text-gray-400">VERA está pensando...</p>}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarAVera(); }}
                  placeholder="Escribe tu pregunta..." disabled={chatBusy} />
                <Button onClick={enviarAVera} disabled={chatBusy || !chatInput.trim()} className="bg-purple-600 hover:bg-purple-700">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- SOPORTE ---------- */}
        <TabsContent value="soporte" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowTicketForm(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />Reportar problema
            </Button>
          </div>

          {tickets.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Sin tickets. Cuando reportes un problema aparecerá aquí.</p>
          ) : (
            <div className="grid gap-3">
              {tickets.map(t => (
                <Card key={t.id}>
                  <CardContent className="pt-5 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={STATUS_STYLES[t.status] || 'bg-gray-100'}>{t.status.replace('_', ' ')}</Badge>
                          {t.module && <Badge className="bg-gray-100 text-gray-600">{t.module}</Badge>}
                          {t.priority !== 'normal' && <Badge className="bg-red-100 text-red-700">{t.priority}</Badge>}
                        </div>
                        <h3 className="font-bold text-gray-900 mt-1">{t.title}</h3>
                        {t.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>}
                        <p className="text-xs text-gray-400 mt-1">
                          {t.created_by} — {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}
                        </p>
                      </div>
                      {isAdmin && (
                        <select className="border rounded-md text-sm p-1" value={t.status}
                          onChange={(e) => actualizarTicket.mutate({ id: t.id, patch: { status: e.target.value, ...(e.target.value === 'resuelto' ? { resolved_by: currentUser?.email, resolved_at: new Date().toISOString() } : {}) } })}>
                          <option value="abierto">Abierto</option>
                          <option value="en_proceso">En proceso</option>
                          <option value="resuelto">Resuelto</option>
                          <option value="cerrado">Cerrado</option>
                        </select>
                      )}
                    </div>
                    {t.resolution && (
                      <div className="bg-green-50 border border-green-200 rounded p-2 text-sm text-green-900">
                        <span className="font-semibold">Respuesta:</span> {t.resolution}
                      </div>
                    )}
                    {isAdmin && t.status !== 'cerrado' && (
                      <ResolutionEditor ticket={t} onSave={(resolution) => actualizarTicket.mutate({ id: t.id, patch: { resolution } })} />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Modal nuevo ticket */}
      {showTicketForm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">Reportar problema</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">¿Qué pasó? (título corto) *</label>
                <Input value={ticket.title} onChange={(e) => setTicket({ ...ticket, title: e.target.value })}
                  placeholder="Ej. No me deja guardar un pago de torneo" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700">Módulo</label>
                  <select className="w-full border rounded-md p-2 text-sm" value={ticket.module}
                    onChange={(e) => setTicket({ ...ticket, module: e.target.value })}>
                    {MODULOS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Prioridad</label>
                  <select className="w-full border rounded-md p-2 text-sm" value={ticket.priority}
                    onChange={(e) => setTicket({ ...ticket, priority: e.target.value })}>
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Detalles</label>
                <textarea className="w-full border rounded-md p-2 text-sm" rows={4}
                  value={ticket.description} onChange={(e) => setTicket({ ...ticket, description: e.target.value })}
                  placeholder="Qué intentabas hacer, qué mensaje apareció, jugador o pago involucrado..." />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTicketForm(false)}>Cancelar</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" disabled={!ticket.title.trim() || crearTicket.isPending}
                onClick={() => crearTicket.mutate(ticket)}>
                Crear ticket
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ResolutionEditor({ ticket, onSave }) {
  const [text, setText] = useState(ticket.resolution || '');
  const [open, setOpen] = useState(false);
  if (!open) return (
    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
      {ticket.resolution ? 'Editar respuesta' : 'Responder'}
    </Button>
  );
  return (
    <div className="space-y-2">
      <textarea className="w-full border rounded-md p-2 text-sm" rows={3} value={text}
        onChange={(e) => setText(e.target.value)} placeholder="Respuesta o solución para quien reportó..." />
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancelar</Button>
        <Button size="sm" className="bg-green-600 hover:bg-green-700" disabled={!text.trim()}
          onClick={() => { onSave(text.trim()); setOpen(false); }}>Guardar respuesta</Button>
      </div>
    </div>
  );
}
