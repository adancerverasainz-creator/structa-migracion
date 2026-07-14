import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { Home, Users, CreditCard, Trophy, Shield, LayoutGrid, Menu, X, LogOut, FileText, BarChart2, ChevronRight, Stethoscope } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { base44 } from '@/api/base44Client';

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await base44.auth.logout();
  };

  const [currentUser, setCurrentUser] = React.useState(null);

  React.useEffect(() => {
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, []);

  const allNavItems = [
    { name: 'Panel', page: 'Home', icon: Home },
    { name: 'Dashboard', page: 'Dashboard', icon: LayoutGrid },
    { name: 'Pre', page: 'PreRegistro', icon: Users },
    { name: 'Prospectos', page: 'AdminProspectos', icon: Users },
    { name: 'Jugadores', page: 'Players', icon: Users },
    { name: 'Pagos', page: 'Payments', icon: CreditCard },
    { name: 'Egresos', page: 'Expenses', icon: CreditCard },
    { name: 'CxP', page: 'CuentasPorPagar', icon: CreditCard },
    { name: 'Fondos', page: 'Fondos', icon: CreditCard },
    { name: 'Torneos', page: 'Tournaments', icon: Trophy },
    // Liga oculto del menú (módulo sin uso — decisión arquitectural 2026-07-13). La ruta /Liga sigue activa por si se necesita.
    { name: 'Summer', page: 'SummerCamp', icon: Trophy },
    { name: 'Reportes', page: 'FinancialReports', icon: BarChart2 },
    { name: 'Auditoría', page: 'AuditLogs', icon: FileText, roles: ['admin'] },
    { name: 'Diag', page: 'Diagnostico', icon: Stethoscope, roles: ['admin'] },
  ];

  const navItems = allNavItems.filter(item => !item.roles || item.roles.includes(currentUser?.role));

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
            
            {/* Desktop Navigation — ocupa el espacio restante */}
            <nav className="hidden md:flex items-center gap-0.5 flex-1 flex-wrap">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all text-xs font-medium whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-[#a50044] shadow-md'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
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

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <nav className="md:hidden pb-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.page;
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all ${
                      isActive
                        ? 'bg-white text-[#a50044]'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.name}</span>
                  </Link>
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