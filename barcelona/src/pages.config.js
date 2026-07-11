/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AuditLogs from './pages/AuditLogs';
import PreRegistro from './pages/PreRegistro';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import FinancialReports from './pages/FinancialReports';
import Fondos from './pages/Fondos';
import Home from './pages/Home';
import Payments from './pages/Payments';
import Players from './pages/Players';
import Tournaments from './pages/Tournaments';
import CuentasPorPagar from './pages/CuentasPorPagar';
import Diagnostico from './pages/Diagnostico';
import SummerCamp from './pages/SummerCamp';
import Liga from './pages/Liga';
import AdminProspectos from './pages/AdminProspectos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AuditLogs": AuditLogs,
    "Dashboard": Dashboard,
    "Expenses": Expenses,
    "FinancialReports": FinancialReports,
    "Fondos": Fondos,
    "Home": Home,
    "Payments": Payments,
    "Players": Players,
    "Tournaments": Tournaments,
    "PreRegistro": PreRegistro,
    "CuentasPorPagar": CuentasPorPagar,
    "Diagnostico": Diagnostico,
    "SummerCamp": SummerCamp,
    "Liga": Liga,
    "AdminProspectos": AdminProspectos,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};