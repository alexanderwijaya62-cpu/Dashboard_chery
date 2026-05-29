import React from 'react';
import { getNavItems } from '../utils/navConfig';
import LogoutButton from './LogoutButton';

const BottomNavBar = ({ user, currentPage, onNavigate, onLogout }) => {
  // Hide when user is null (login/public pages)
  if (!user) return null;

  const navItems = getNavItems(user.role?.toLowerCase());

  const handleNavigate = (page) => {
    // Prevent navigation event when tapping the already-active route icon
    if (page === currentPage) return;
    onNavigate(page);
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-h-[64px] flex md:hidden items-center justify-around px-2 bg-white border-t border-zinc-200 z-50"
      aria-label="Mobile navigation"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = currentPage === item.page;

        return (
          <button
            key={item.id}
            onClick={() => handleNavigate(item.page)}
            aria-label={item.ariaLabel}
            aria-current={isActive ? 'page' : undefined}
            className={`flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg transition-colors duration-150 ${
              isActive
                ? 'bg-black text-white'
                : 'text-black hover:bg-zinc-200'
            }`}
          >
            <Icon size={22} />
          </button>
        );
      })}
      <LogoutButton onLogout={onLogout} variant="bottomnav" />
    </nav>
  );
};

export default BottomNavBar;
