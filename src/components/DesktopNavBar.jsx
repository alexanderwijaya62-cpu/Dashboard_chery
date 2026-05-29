import React from 'react';
import { getNavItems } from '../utils/navConfig';
import LogoutButton from './LogoutButton';

const DesktopNavBar = ({ user, currentPage, onNavigate, onLogout }) => {
  if (!user) return null;

  const navItems = getNavItems(user.role);

  return (
    <nav
      className="hidden md:flex fixed top-0 left-0 right-0 z-50 items-center justify-between bg-white border-b border-zinc-200 px-6 h-14"
      role="navigation"
      aria-label="Desktop navigation"
    >
      <div className="flex items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.page;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.page)}
              aria-label={item.ariaLabel}
              aria-current={isActive ? 'page' : undefined}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 min-w-[44px] min-h-[44px] ${
                isActive
                  ? 'bg-black text-white'
                  : 'text-black hover:bg-zinc-200'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-500">{user.name}</span>
        <LogoutButton onLogout={onLogout} variant="navbar" />
      </div>
    </nav>
  );
};

export default DesktopNavBar;
