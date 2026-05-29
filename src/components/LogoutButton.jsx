import React from 'react';
import { LogOut } from 'lucide-react';

const LogoutButton = ({ onLogout, variant }) => {
  if (variant === 'bottomnav') {
    return (
      <button
        onClick={onLogout}
        aria-label="Logout"
        className="flex items-center justify-center min-w-[44px] min-h-[44px] rounded-lg text-black hover:bg-zinc-200 transition-colors duration-150"
      >
        <LogOut size={22} color="black" />
      </button>
    );
  }

  // variant === 'navbar'
  return (
    <button
      onClick={onLogout}
      className="flex items-center gap-2 min-w-[44px] min-h-[44px] px-3 rounded-lg text-black hover:bg-zinc-200 transition-colors duration-150"
    >
      <LogOut size={22} color="black" />
      <span className="text-sm font-medium">Logout</span>
    </button>
  );
};

export default LogoutButton;
