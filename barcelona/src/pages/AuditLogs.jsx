import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, Search, Plus, Edit, Trash2, AlertCircle, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatCurrency } from '../components/lib/formatCurrency';

export default function AuditLogsPage() {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('todos');
  const [filterModule, setFilterModule] = useState('todos');
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setUserLoading(false); }).catch(() => setUserLoading(false));
  }, []);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => base44.entities.AuditLog.list('-created_date', 500),
  });

  const actionConfig = {
    'CREACIÓN': { color: 'bg-green-100 text-green-800 border-green-300', icon: Plus, border: 'border-l-green-500' },
    'MODIFICACIÓN': { color: 'bg-blue-100 text-blue-800 border-blue-300', icon: Edit, border: 'border-l-blue-500' },
    'ELIMINACIÓN': { color: 'bg-red-100 text-red-800 border-red-300', icon: Trash2, border: 'border-l-red-500' },
    // Legacy support for old records
    'eliminar': { color: 'bg-red-100 text-red-800 border-red-300', icon: Trash2, border: 'border-l-red-500' },
  };

  const modules = [...new Set(['Torneos', ...logs.map(l => l.module).filter(Boolean)])].filter(m => m !== 'Liga Fut 7');

  const filteredLogs = logs.filter(log => {
    const matchAction = filterAction === 'todos' || log.action === filterAction;
    const matchModule = filterModule === 'todos' || log.module === filterModule;
    const matchSearch = search === '' ||
      log.entity_name?.toLowerCase().includes(search.toLowerCase()) ||
      log.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      log.details?.toLowerCase().includes(search.toLowerCase()) ||
      log.module?.toLowerCase().includes(search.toLowerCase());
    return matchAction && matchModule && matchSearch;
  });

  if (userLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Lock className="w-16 h-16 text-gray-300" />
        <h2 className="text-2xl font-bold text-gray-700">Acceso Restringido</h2>
        <p className="text-gray-500 text-center max-w-sm">Solo los administradores pueden ver el Registro de Auditoría.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50 flex-shrink-0">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <nav className="flex items-center gap-1 mb-0.5">
                <span className="text-xs font-medium text-gray-400">BIA</span>
                <span className="text-gray-300 text-xs">/</span>
                <span className="text-xs font-medium text-gray-500">Auditoría</span>
              </nav>
              <h1 className="text-xl font-bold text-gray-900">Registro de Auditoría</h1>
              <p className="text-sm text-gray-500 mt-0.5">Solo lectura — Trazabilidad completa de cambios</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-800 border border-green-300 px-3 py-1 text-sm">
              {logs.filter(l => l.action === 'CREACIÓN').length} Creaciones
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 border border-blue-300 px-3 py-1 text-sm">
              {logs.filter(l => l.action === 'MODIFICACIÓN').length} Modificaciones
            </Badge>
            <Badge className="bg-red-100 text-red-800 border border-red-300 px-3 py-1 text-sm">
              {logs.filter(l => l.action === 'ELIMINACIÓN' || l.action === 'eliminar').length} Eliminaciones
            </Badge>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Buscar por usuario, registro o módulo..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas las acciones</SelectItem>
                <SelectItem value="CREACIÓN">Creación</SelectItem>
                <SelectItem value="MODIFICACIÓN">Modificación</SelectItem>
                <SelectItem value="ELIMINACIÓN">Eliminación</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterModule} onValueChange={setFilterModule}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los módulos</SelectItem>
                {modules.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {filteredLogs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 text-center">No hay registros de auditoría</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const cfg = actionConfig[log.action] || actionConfig['eliminar'];
            const Icon = cfg.icon;
            let prevData = null, newData = null;
            try { prevData = log.previous_value ? JSON.parse(log.previous_value) : null; } catch {}
            try { newData = log.new_value ? JSON.parse(log.new_value) : null; } catch {}

            return (
              <Card key={log.id} className={`border-l-4 ${cfg.border} hover:shadow-md transition-shadow`}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${cfg.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge className={`text-xs ${cfg.color}`}>{log.action || 'ELIMINACIÓN'}</Badge>
                          {log.module && <Badge variant="outline" className="text-xs">{log.module}</Badge>}
                          <span className="font-semibold text-gray-900">{log.entity_name}</span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p><span className="font-medium">Usuario:</span> {log.user_email}</p>
                          {log.details && <p><span className="font-medium">Detalle:</span> {log.details}</p>}
                          {log.monetary_diff != null && log.monetary_diff !== 0 && (
                            <p>
                              <span className="font-medium">Diferencia monetaria:</span>{' '}
                              <span className={log.monetary_diff >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                                {log.monetary_diff >= 0 ? '+' : ''}{formatCurrency(log.monetary_diff)}
                              </span>
                            </p>
                          )}
                        </div>

                        {/* Previous / New values */}
                        {(prevData || newData) && (
                          <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {prevData && (
                              <div className="bg-red-50 border border-red-200 rounded p-2 text-xs">
                                <p className="font-semibold text-red-700 mb-1">Valor anterior:</p>
                                {Object.entries(prevData).filter(([k]) => !['id','created_date','updated_date','created_by'].includes(k)).map(([k,v]) => (
                                  <p key={k} className="text-gray-700"><span className="font-medium">{k}:</span> {String(v)}</p>
                                ))}
                              </div>
                            )}
                            {newData && (
                              <div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
                                <p className="font-semibold text-green-700 mb-1">Valor nuevo:</p>
                                {Object.entries(newData).filter(([k]) => !['id','created_date','updated_date','created_by'].includes(k)).map(([k,v]) => (
                                  <p key={k} className="text-gray-700"><span className="font-medium">{k}:</span> {String(v)}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 whitespace-nowrap">
                      <p>{format(new Date(log.created_date), "d 'de' MMMM, yyyy", { locale: es })}</p>
                      <p className="text-xs font-mono">{format(new Date(log.created_date), 'HH:mm:ss')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}