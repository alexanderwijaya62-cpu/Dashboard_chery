import React, { useState, useEffect, useRef } from 'react';
import { Home, Calendar, LogIn, LogOut, Menu, X, User } from 'lucide-react';
import { getNavItems } from '../utils/navConfig';

/**
 * PublicNavBar — Navigasi universal.
 * 
 * Desktop (user logged in):
 * - Left sidebar selalu tampil (220px), berisi:
 *   - User info di atas
 *   - Role-based sub-pages
 *   - Separator
 *   - Public pages (Home/Display, Booking, Tracking)
 *   - Login/Logout di bawah
 * - Tidak ada top bar
 * 
 * Desktop (belum login):
 * - Left sidebar selalu tampil, berisi:
 *   - Public pages (Home, Booking, Tracking)
 *   - Login di bawah
 * 
 * Mobile:
 * - Bottom bar: 4 menu (Home, Booking, Tracking, Dashboard/Login)
 * - Top bar + hamburger: hanya saat di dashboard, buka sidebar overlay berisi role sub-pages
 */
const PublicNavBar = ({ user, currentPage, onNavigate, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sidebarRef = useRef(null);

  const getDefaultDashboard = (role) => {
    const map = {
      admin: 'admin',
      manager: 'manager',
      cro: 'cro',
      sparepart: 'sparepart',
      owner: 'owner',
      mekanik: 'mechanic',
      customer: 'customer',
      display: 'display',
      warranty: 'warranty',
      foreman: 'foreman',
      security: 'security',
    };
    return map[role?.toLowerCase()] || 'login';
  };

  const handleNavigate = (page) => {
    const urlMap = {
      'display': '/display',
      'booking-public': '/booking',
      'tracking-public': '/tracking',
      'login': '/login',
    };
    const newPath = urlMap[page];
    if (newPath) {
      window.history.pushState({}, '', newPath);
    }
    onNavigate(page);
    setSidebarOpen(false);
  };

  // Close sidebar on outside click (mobile)
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setSidebarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [sidebarOpen]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, []);

  // Public pages for bottom nav + sidebar
  const publicNavItems = [
    { id: 'home', icon: Home, label: 'Home', page: 'display', ariaLabel: 'Home Display' },
    { id: 'booking', icon: Calendar, label: 'Booking', page: 'booking-public', ariaLabel: 'Booking Service' },
  ];

  // Bottom nav items (mobile) — includes Dashboard/Login as 4th item
  const bottomNavItems = [
    ...publicNavItems,
    user
      ? { id: 'dashboard', icon: Menu, label: 'Dashboard', page: getDefaultDashboard(user.role), ariaLabel: 'Dashboard' }
      : { id: 'login', icon: LogIn, label: 'Login', page: 'login', ariaLabel: 'Login' },
  ];

  // Role-based sidebar items
  const sidebarItems = user ? getNavItems(user.role?.toLowerCase()) : [];

  // Is current page a dashboard page (not public)?
  const publicPagesList = ['display', 'booking-public', 'tracking-public', 'login', 'register'];
  const isOnDashboard = user && !publicPagesList.includes(currentPage);

  // Show mobile top bar only when on dashboard and there are multiple pages to navigate
  const showMobileTopBar = isOnDashboard && sidebarItems.length > 1;

  // Sembunyikan bottom nav di halaman login/register
  const hideMobileNav = currentPage === 'login' || currentPage === 'register';

  return (
    <>
      {/* ===== DESKTOP: Left Sidebar (always visible) ===== */}
      <aside
        className="hidden md:flex fixed top-0 left-0 bottom-0 z-50 w-[220px] bg-zinc-900 flex-col shadow-2xl"
        role="navigation"
        aria-label="Desktop sidebar"
      >
        {/* User Info / Brand */}
        <div className="px-5 py-5 border-b border-zinc-800">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <User size={16} className="text-zinc-300" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{user.role}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <Home size={16} className="text-zinc-300" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Chery Oriental</p>
                <p className="text-[10px] text-zinc-400 uppercase tracking-wider">Medan</p>
              </div>
            </div>
          )}
        </div>

        {/* Scrollable Nav */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Role-based sub-pages (only when logged in) */}
          {user && sidebarItems.length > 0 && (
            <div>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Dashboard</p>
              <div className="space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.page;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.page)}
                      aria-label={item.ariaLabel}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-white text-zinc-900 shadow-md'
                          : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Public pages */}
          <div>
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Publik</p>
            <div className="space-y-1">
              {publicNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPage === item.page;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.page)}
                    aria-label={item.ariaLabel}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-white text-zinc-900 shadow-md'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer: Login/Logout */}
        <div className="px-3 py-4 border-t border-zinc-800">
          {user && onLogout ? (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-600/10 hover:text-red-300 transition-all duration-200"
              aria-label="Logout"
            >
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          ) : (
            <button
              onClick={() => handleNavigate('login')}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all duration-200"
              aria-label="Login"
            >
              <LogIn size={18} />
              <span>Login</span>
            </button>
          )}
        </div>
      </aside>

      {/* ===== MOBILE: Top Bar (only on dashboard pages) ===== */}
      {showMobileTopBar && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between bg-white border-b border-zinc-200 px-4 h-14 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
              className="flex items-center justify-center w-10 h-10 rounded-lg text-zinc-700 hover:bg-zinc-100 transition-colors"
            >
              <Menu size={22} />
            </button>
            <span className="text-sm font-black tracking-tight text-zinc-800">Chery Oriental Medan</span>
          </div>
        </div>
      )}

      {/* ===== MOBILE: Bottom Navigation ===== */}
      {!hideMobileNav && (
        <nav
          className="flex md:hidden fixed bottom-0 left-0 right-0 z-50 items-center justify-around bg-white border-t border-zinc-200 px-2 py-2 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
          role="navigation"
          aria-label="Mobile bottom navigation"
        >
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'dashboard'
              ? isOnDashboard
              : currentPage === item.page;

            return (
              <button
                key={item.id}
                onClick={() => handleNavigate(item.page)}
                aria-label={item.ariaLabel}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[48px] rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-900 text-white shadow-md scale-105'
                    : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] font-semibold leading-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      {/* ===== MOBILE: Sidebar Overlay ===== */}
      <div
        className={`md:hidden fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <aside
        ref={sidebarRef}
        className={`md:hidden fixed top-0 left-0 bottom-0 z-[201] w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        role="dialog"
        aria-label="Mobile sidebar"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-200 flex items-center justify-center">
              <User size={16} className="text-zinc-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-zinc-800">{user?.name || 'Guest'}</p>
              <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{user?.role || ''}</p>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
            className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-500 hover:bg-zinc-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Nav Items */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {/* Role sub-pages only — public pages are in bottom nav */}
          {sidebarItems.length > 0 && (
            <div>
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">Dashboard</p>
              <div className="space-y-1">
                {sidebarItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPage === item.page;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigate(item.page)}
                      aria-label={item.ariaLabel}
                      aria-current={isActive ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-zinc-900 text-white shadow-md'
                          : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Logout */}
        {user && onLogout && (
          <div className="px-3 py-4 border-t border-zinc-100">
            <button
              onClick={() => { setSidebarOpen(false); onLogout(); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-200"
              aria-label="Logout"
            >
              <LogOut size={18} />
              <span>Keluar</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
};

export default PublicNavBar;
