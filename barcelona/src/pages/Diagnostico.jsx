import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Stethoscope, ShieldCheck, AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Wand2, Loader2, ChevronRight, Wrench, ShieldAlert } from 'lucide-react';
import ERPPageHeader from '@/components/layout/ERPPageHeader';
import { toast } from 'sonner';

const severityConfig = {
  critico: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500' },
  advertencia: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-500' },
  info: { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500' },
};

function IssueCard({ issue }) {
  const config = severityConfig[issue.severidad] || severityConfig.info;
  const Icon = config.icon;

  return (
    <div className={`${config.bg} ${config.border} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} mt-0.5 shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge className={config.badge + ' text-white text-xs'}>{issue.severidad}</Badge>
            <Badge variant="outline" className="text-xs">{issue.modulo}</Badge>
            {issue.auto_resoluble && <Badge className="bg-green-100 text-green-700 border-green-300 text-xs">Auto-resoluble</Badge>}
          </div>
          <p className="font-semibold text-gray-900">{issue.mensaje}</p>
          {issue.detalles && issue.detalles.length > 0 && (
            <Accordion type="single" collapsible className="mt-2">
              <AccordionItem value="detalles" className="border-none">
                <AccordionTrigger className="text-xs text-gray-500 py-1 hover:no-underline">
                  Ver {issue.detalles.length} detalles
                </AccordionTrigger>
                <AccordionContent>
                  <div className="bg-white/50 rounded p-2 max-h-48 overflow-auto">
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">
                      {JSON.stringify(issue.detalles.slice(0, 20), null, 2)}
                      {issue.detalles.length > 20 && `\n... y ${issue.detalles.length - 20} más`}
                    </pre>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
        </div>
      </div>
    </div>
  );
}

function ResolveResultCard({ result }) {
  if (!result) return null;

  return (
    <Card className="border-2 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          Resultado de Resolución
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
            <p className="text-2xl font-bold text-green-600">{result.resueltos}</p>
            <p className="text-xs text-green-700">Corregidos</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
            <p className="text-2xl font-bold text-red-600">{result.fallidos}</p>
            <p className="text-xs text-red-700">Fallidos</p>
          </div>
        </div>

        {result.resolved.length > 0 && (
          <Accordion type="single" collapsible className="mb-2">
            <AccordionItem value="resueltos" className="border-none">
              <AccordionTrigger className="text-sm font-medium text-green-700 py-1 hover:no-underline">
                <CheckCircle2 className="w-4 h-4 mr-2" /> {result.resolved.length} corregidos
              </AccordionTrigger>
              <AccordionContent>
                <div className="max-h-40 overflow-auto space-y-1">
                  {result.resolved.slice(0, 30).map((r, i) => (
                    <div key={i} className="text-xs text-gray-600 bg-green-50 px-2 py-1 rounded flex items-center gap-2">
                      <Badge variant="outline" className="text-xs shrink-0">{r.modulo}</Badge>
                      <span className="truncate">{r.cambio || 'Vinculado'}</span>
                    </div>
                  ))}
                  {result.resolved.length > 30 && (
                    <p className="text-xs text-gray-400 px-2">... y {result.resolved.length - 30} más</p>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {result.failed.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="fallidos" className="border-none">
              <AccordionTrigger className="text-sm font-medium text-red-700 py-1 hover:no-underline">
                <AlertCircle className="w-4 h-4 mr-2" /> {result.failed.length} fallidos
              </AccordionTrigger>
              <AccordionContent>
                <div className="max-h-40 overflow-auto space-y-1">
                  {result.failed.map((r, i) => (
                    <div key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      ID: {r.id} — {r.error}
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
}

export default function DiagnosticoPage() {
  const queryClient = useQueryClient();
  const [resolveResult, setResolveResult] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  React.useEffect(() => {
    base44.auth.me().then(u => {
      setCurrentUser(u);
      setCheckingAuth(false);
    }).catch(() => setCheckingAuth(false));
  }, []);

  const { data: diagnosis, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['diagnosis'],
    queryFn: async () => {
      const res = await base44.functions.invoke('diagnoseSystem', {});
      return res.data;
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('resolveDiscrepancies', {});
      return res.data;
    },
    onSuccess: (data) => {
      setResolveResult(data);
      if (data.resueltos > 0) {
        toast.success(`${data.resueltos} discrepancias corregidas`);
      }
      if (data.fallidos > 0) {
        toast.warning(`${data.fallidos} fallaron (rate limit)`);
      }
      refetch();
    },
    onError: () => {
      toast.error('Error al ejecutar la resolución');
    },
  });

  const issues = diagnosis?.issues || [];
  const stats = diagnosis?.stats || { total: 0, criticos: 0, advertencias: 0, info: 0 };

  const criticos = issues.filter(i => i.severidad === 'critico');
  const advertencias = issues.filter(i => i.severidad === 'advertencia');
  const infos = issues.filter(i => i.severidad === 'info');

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <ShieldAlert className="w-16 h-16 text-red-400" />
        <h2 className="text-xl font-semibold text-gray-800">Acceso Restringido</h2>
        <p className="text-gray-500">Solo los administradores pueden acceder a este módulo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ERPPageHeader
        title="Diagnóstico del Sistema"
        description="Escaneo completo de todos los módulos para detectar errores y discrepancias"
        icon={Stethoscope}
        color="purple"
        breadcrumbs={[
          { label: 'Dashboard', href: '/Dashboard' },
          { label: 'Diagnóstico' }
        ]}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Re-escanear
            </Button>
            <Button
              onClick={() => resolveMutation.mutate()}
              disabled={resolveMutation.isPending || issues.length === 0 || !issues.some(i => i.auto_resoluble)}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Wand2 className="w-4 h-4" />
              )}
              Resolver Todo
            </Button>
          </div>
        }
      />

      {/* Resultado de resolución */}
      <ResolveResultCard result={resolveResult} />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Escaneando sistema...</span>
        </div>
      )}

      {/* Stats */}
      {!isLoading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                <p className="text-sm text-gray-500">Incidencias</p>
              </CardContent>
            </Card>
            <Card className="border-red-200">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-600">{stats.criticos}</p>
                <p className="text-sm text-red-600">Críticos</p>
              </CardContent>
            </Card>
            <Card className="border-orange-200">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-orange-600">{stats.advertencias}</p>
                <p className="text-sm text-orange-600">Advertencias</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200">
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-blue-600">{stats.info}</p>
                <p className="text-sm text-blue-600">Info</p>
              </CardContent>
            </Card>
          </div>

          {/* Sin incidencias */}
          {issues.length === 0 && (
            <Alert className="border-green-200 bg-green-50">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              <AlertDescription className="text-green-700 font-medium">
                No se encontraron incidencias. El sistema está en buen estado.
              </AlertDescription>
            </Alert>
          )}

          {/* Issues by tab */}
          {issues.length > 0 && (
            <Tabs defaultValue="todos">
              <TabsList>
                <TabsTrigger value="todos">
                  Todos ({stats.total})
                </TabsTrigger>
                <TabsTrigger value="criticos" className="text-red-600">
                  Críticos ({stats.criticos})
                </TabsTrigger>
                <TabsTrigger value="advertencias" className="text-orange-600">
                  Advertencias ({stats.advertencias})
                </TabsTrigger>
                <TabsTrigger value="info" className="text-blue-600">
                  Info ({stats.info})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="todos" className="space-y-3 mt-4">
                {issues.map((issue, i) => <IssueCard key={i} issue={issue} />)}
              </TabsContent>
              <TabsContent value="criticos" className="space-y-3 mt-4">
                {criticos.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                {criticos.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No hay incidencias críticas</p>
                )}
              </TabsContent>
              <TabsContent value="advertencias" className="space-y-3 mt-4">
                {advertencias.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                {advertencias.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No hay advertencias</p>
                )}
              </TabsContent>
              <TabsContent value="info" className="space-y-3 mt-4">
                {infos.map((issue, i) => <IssueCard key={i} issue={issue} />)}
                {infos.length === 0 && (
                  <p className="text-center text-gray-500 py-8">No hay información adicional</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
}