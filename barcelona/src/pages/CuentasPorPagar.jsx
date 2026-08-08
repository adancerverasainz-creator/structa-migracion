import React, { useState, useEffect, useRef } from 'react';
import { confirmar } from '@/components/ui/confirmar';
import { usePerms } from '@/lib/usePerms';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44, supabase } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, AlertCircle, Clock, CheckCircle2, DollarSign } from 'lucide-react';
import { formatCurrency } from '@/components/lib/formatCurrency';
import AccountPayableCard from '@/components/cuentas/AccountPayableCard';
import AccountPayableForm from '@/components/cuentas/AccountPayableForm';
import AbonoForm from '@/components/cuentas/AbonoForm';

export default function CuentasPorPagar() {
  const { canDelete } = usePerms('cxp');
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [abonoAccount, setAbonoAccount] = useState(null);
  // Idempotencia: clave estable por apertura del modal de abono (N clics = 1 abono)
  const abonoOpKeyRef = useRef(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ['accountsPayable'],
    queryFn: () => base44.entities.AccountPayable.list('-created_date'),
  });

  const { data: allPayments = [], isLoading: loadingPayments } = useQuery({
    queryKey: ['accountPayablePayments'],
    queryFn: () => base44.entities.AccountPayablePayment.list('-payment_date'),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.AccountPayable.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountsPayable'] }); setShowForm(false); },
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
});

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AccountPayable.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['accountsPayable'] }); setEditingAccount(null); },
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
});

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.AccountPayable.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accountsPayable'] }),
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
});

  const abonoMutation = useMutation({
    // RPC atómico: abono + recálculo de estatus + egreso en UNA transacción.
    // Antes eran 3 escrituras desde el navegador y con rol de captura las últimas
    // dos fallaban por permisos (abono fantasma sin egreso — caso 07/ago/2026).
    mutationFn: async (data) => {
      const { data: paymentId, error } = await supabase.rpc('abonar_cxp', {
        p_account_id: data.account_payable_id,
        p_monto: data.amount,
        p_metodo: data.payment_method,
        p_banco: data.bank_name || null,
        p_referencia: data.reference_number || null,
        p_fecha: data.payment_date || null,
        p_notas: data.notes || null,
        p_caja: data.cash_register || null,
        p_op_key: abonoOpKeyRef.current,
      });
      if (error) throw new Error(error.message);
      return paymentId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accountPayablePayments'] });
      queryClient.invalidateQueries({ queryKey: ['accountsPayable'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['saldosPorCuenta'] });
      setAbonoAccount(null);
    },
onError: (err) => toast.error(`Operación fallida: ${err?.message || 'error desconocido'}`),
});

  const handleFormSubmit = (data) => {
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setShowForm(false);
    setAbonoAccount(null);
  };

  const handleAbono = (account) => {
    abonoOpKeyRef.current = globalThis.crypto?.randomUUID ? crypto.randomUUID() : null;
    setAbonoAccount(account);
    setEditingAccount(null);
    setShowForm(false);
  };

  const handleDelete = (account) => {
    confirmar(`¿Eliminar "${account.concept}"? Esta acción no se puede deshacer.`).then((ok) => { if (!ok) return;
      deleteMutation.mutate(account.id);
    });
  };

  const getPaymentsForAccount = (accountId) =>
    allPayments.filter(p => p.account_payable_id === accountId);

  const getPending = (account) => {
    const paid = getPaymentsForAccount(account.id).reduce((sum, p) => sum + (p.amount || 0), 0);
    return Math.max((account.total_amount || 0) - paid, 0);
  };

  // Filtros
  const filtered = accounts.filter(a => {
    const matchSearch = search === '' ||
      a.concept?.toLowerCase().includes(search.toLowerCase()) ||
      a.supplier?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Totales resumen
  const totalDeuda = accounts.reduce((sum, a) => sum + (a.total_amount || 0), 0);
  const totalPagado = accounts.reduce((sum, a) => {
    return sum + getPaymentsForAccount(a.id).reduce((s, p) => s + (p.amount || 0), 0);
  }, 0);
  const totalPendiente = totalDeuda - totalPagado;
  const countPendiente = accounts.filter(a => a.status === 'pendiente').length;
  const countParcial = accounts.filter(a => a.status === 'parcial').length;
  const countPagado = accounts.filter(a => a.status === 'pagado').length;

  const isLoading = loadingAccounts || loadingPayments;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-indigo-600" />
            Cuentas por Pagar
          </h1>
          <p className="text-gray-500 mt-1">Gestión de deudas y abonos</p>
        </div>
        <Button
          onClick={() => { setShowForm(true); setEditingAccount(null); setAbonoAccount(null); }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" /> Nueva Cuenta
        </Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-2 border-red-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg"><AlertCircle className="w-5 h-5 text-red-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Por Pagar</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(totalPendiente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-indigo-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg"><DollarSign className="w-5 h-5 text-indigo-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Total Deuda</p>
                <p className="text-xl font-bold text-indigo-600">{formatCurrency(totalDeuda)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-green-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle2 className="w-5 h-5 text-green-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Pagado</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalPagado)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-amber-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
              <div>
                <p className="text-xs text-gray-500">Cuentas</p>
                <div className="flex gap-2 text-xs font-medium mt-0.5">
                  <span className="text-red-600">{countPendiente} pend.</span>
                  <span className="text-amber-600">{countParcial} parc.</span>
                  <span className="text-green-600">{countPagado} pag.</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modales — se renderizan fuera del flujo de la página */}
      {(showForm || editingAccount) && (
        <AccountPayableForm
          account={editingAccount || undefined}
          onSubmit={handleFormSubmit}
          onCancel={() => { setShowForm(false); setEditingAccount(null); }}
          isLoading={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {abonoAccount && (
        <AbonoForm
          account={abonoAccount}
          pendingAmount={getPending(abonoAccount)}
          onSubmit={(data) => abonoMutation.mutate(data)}
          onCancel={() => setAbonoAccount(null)}
          isLoading={abonoMutation.isPending}
        />
      )}

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por concepto o proveedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pendiente">Pendientes</SelectItem>
            <SelectItem value="parcial">Parciales</SelectItem>
            <SelectItem value="pagado">Pagados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-600">Sin cuentas por pagar</h3>
            <p className="text-gray-400 text-sm mt-1">Registra tu primera cuenta con el botón "Nueva Cuenta"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(account => (
            <AccountPayableCard
              key={account.id}
              account={account}
              payments={getPaymentsForAccount(account.id)}
              onEdit={handleEdit}
              onDelete={canDelete ? handleDelete : null}
              onAbono={handleAbono}
              isAdmin={currentUser?.role === 'admin'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
