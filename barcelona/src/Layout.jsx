import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Users, CreditCard, Trophy, LayoutGrid, Menu, X, LogOut, FileText, BarChart2, ChevronDown, Stethoscope, LifeBuoy, Briefcase, Landmark, Settings2, Shield } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';
import { usePerms } from '@/lib/usePerms';

// ─── Navegación agrupada (estilo Odoo/Dynamics) ──────────────────────────────
// Con 18 módulos la barra plana ya no cabía en una línea. Los módulos se agrupan
// por dominio en menús desplegables; Panel, Dashboard y Ayuda quedan directos.
// El filtro por rol y las excepciones de Permisos (allowByPerm) se conservan:
// un grupo solo se muestra si el usuario puede ver al menos un módulo dentro.

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [openGroup, setOpenGroup] = React.useState(null); // key del grupo desplegado
  const navRef = React.useRef(null);
  // Nómina es confidencial (solo admin), pero una excepción otorgada en Permisos también muestra el menú
  const { canCreate: nominaCreate, canUpdate: nominaUpdate } = usePerms('nomina');

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  // Cerrar el desplegable al hacer clic fuera
  React.useEffect(() => {
    const onClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOpenGroup(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const canSee = (item) => !item.roles || item.roles.includes(currentUser?.role) || item.allowByPerm;

  // Estructura: entradas directas + grupos con hijos
  const navStructure = [
    { type: 'link', name: 'Panel', page: 'Home', icon: Home },
    { type: 'link', name: 'Dashboard', page: 'Dashboard', icon: LayoutGrid },
    {
      type: 'group', key: 'operacion', name: 'Operación', icon: Users,
      children: [
        { name: 'Pre-registros', page: 'PreRegistro', icon: Users },
        { name: 'Prospectos', page: 'AdminProspectos', icon: Users },
        { name: 'Jugadores', page: 'Players', icon: Users },
      ],
    },
    {
      type: 'group', key: 'finanzas', name: 'Finanzas', icon: Landmark,
      children: [
        { name: 'Pagos', page: 'Payments', icon: CreditCard },
        { name: 'Egresos', page: 'Expenses', icon: CreditCard },
        { name: 'Cuentas por Pagar', page: 'CuentasPorPagar', icon: CreditCard },
        { name: 'Tesorería', page: 'Fondos', icon: Briefcase },
        { name: 'Nómina', page: 'Nomina', icon: CreditCard, roles: ['admin'], allowByPerm: nominaCreate || nominaUpdate },
        { name: 'Reportes', page: 'FinancialReports', icon: BarChart2 },
      ],
    },
    {
      type: 'group', key: 'deportivo', name: 'Deportivo', icon: Trophy,
      children: [
        { name: 'Torneos', page: 'Tournaments', icon: Trophy },
        // Liga oculto del menú (módulo sin uso — decisión arquitectural 2026-07-13). La ruta /Liga sigue activa por si se necesita.
        { name: 'Summer Camp', page: 'SummerCamp', icon: Trophy },
      ],
    },
    {
      type: 'group', key: 'admin', name: 'Administración', icon: Settings2,
      children: [
        { name: 'Auditoría', page: 'AuditLogs', icon: FileText, roles: ['admin'] },
        { name: 'Diagnóstico', page: 'Diagnostico', icon: Stethoscope, roles: ['admin'] },
        { name: 'Permisos', page: 'Permissions', icon: Shield, roles: ['admin'] },
        { name: 'Configuración', page: 'Configuracion', icon: Settings2, roles: ['admin'] },
      ],
    },
    { type: 'link', name: 'Ayuda', page: 'Ayuda', icon: LifeBuoy },
  ];

  // Filtrado: links por permiso; grupos por hijos visibles (grupo vacío no se muestra)
  const visibleNav = navStructure
    .map(entry => {
      if (entry.type === 'link') return canSee(entry) ? entry : null;
      const children = entry.children.filter(canSee);
      return children.length ? { ...entry, children } : null;
    })
    .filter(Boolean);

  const groupIsActive = (group) => group.children.some(c => c.page === currentPageName);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a1a2e] via-[#a50044] to-[#004d98] text-white shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-3">
          <div className="flex items-center gap-2 py-2">
            {/* Logo */}
            <Link to={createPageUrl('Home')} className="flex-shrink-0">
              <img
                src="https://swtrrldixeeecsmfseah.supabase.co/storage/v1/object/public/assets/logo-bia-transparente.png"
                alt="BIA Logo"
                className="w-9 h-9 object-contain"
              />
            </Link>

            {/* Desktop Navigation — grupos desplegables */}
            <nav ref={navRef} className="hidden md:flex items-center gap-1 flex-1">
              {visibleNav.map((entry) => {
                const Icon = entry.icon;
                if (entry.type === 'link') {
                  const isActive = currentPageName === entry.page;
                  return (
                    <Link
                      key={entry.page}
                      to={createPageUrl(entry.page)}
                      onClick={() => setOpenGroup(null)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                        isActive
                          ? 'bg-white text-[#a50044] shadow-md'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{entry.name}</span>
                    </Link>
                  );
                }
                const active = groupIsActive(entry);
                const open = openGroup === entry.key;
                return (
                  <div key={entry.key} className="relative">
                    <button
                      onClick={() => setOpenGroup(open ? null : entry.key)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium whitespace-nowrap ${
                        active
                          ? 'bg-white text-[#a50044] shadow-md'
                          : open
                            ? 'bg-white/15 text-white'
                            : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{entry.name}</span>
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                      <div className="absolute left-0 top-full mt-1.5 min-w-[230px] bg-white rounded-xl shadow-xl border border-gray-100 py-1.5 z-50">
                        {entry.children.map((child) => {
                          const ChildIcon = child.icon;
                          const childActive = currentPageName === child.page;
                          return (
                            <Link
                              key={child.page}
                              to={createPageUrl(child.page)}
                              onClick={() => setOpenGroup(null)}
                              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                                childActive
                                  ? 'bg-[#a50044]/5 text-[#a50044] font-semibold'
                                  : 'text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              <ChildIcon className={`w-4 h-4 flex-shrink-0 ${childActive ? 'text-[#a50044]' : 'text-gray-400'}`} />
                              <span>{child.name}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </nav>

            {/* Logout desktop */}
            <div className="hidden md:flex items-center flex-shrink-0 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-white/80 hover:bg-white/10 h-8 w-8"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-blue-700 ml-auto"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>

          {/* Mobile Navigation — misma agrupación, con encabezados de sección */}
          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 space-y-1">
              {visibleNav.map((entry) => {
                if (entry.type === 'link') {
                  const Icon = entry.icon;
                  const isActive = currentPageName === entry.page;
                  return (
                    <Link
                      key={entry.page}
                      to={createPageUrl(entry.page)}
                      className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all ${
                        isActive
                          ? 'bg-white text-[#a50044]'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{entry.name}</span>
                    </Link>
                  );
                }
                return (
                  <div key={entry.key}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-white/50">{entry.name}</p>
                    {entry.children.map((child) => {
                      const ChildIcon = child.icon;
                      const childActive = currentPageName === child.page;
                      return (
                        <Link
                          key={child.page}
                          to={createPageUrl(child.page)}
                          className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all ${
                            childActive
                              ? 'bg-white text-[#a50044]'
                              : 'text-white/80 hover:bg-white/10'
                          }`}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <ChildIcon className="w-5 h-5" />
                          <span className="font-medium">{child.name}</span>
                        </Link>
                      );
                    })}
                  </div>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-3 rounded-lg transition-all text-white/80 hover:bg-white/10 w-full"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Cerrar Sesión</span>
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-400">© 2026 Barcelona Inter Academy. Todos los derechos reservados.</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-400">Powered by</span>
              <img
                src="https://media.base44.com/images/public/69829604916b5b78a01842a3/77c3c481c_LogoStructaSportsManagementPlatform2.png"
                alt="Structa — Sports Management Platform"
                className="h-5 object-contain"
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
