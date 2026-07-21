import React, { useState, useEffect } from 'react';
import { Calendar, MessageSquare, Settings, LayoutDashboard } from 'lucide-react';
import CroBookingPanel from './CroBookingPanel';
import FollowupPanel from './FollowupPanel';
import HolidaySettings from './HolidaySettings';

export default function BookingManager({ user, handleLogout, isNavbarVisible, initialTab = 'booking', setCurrentPage, breakSettings, setBreakSettings }) {
    const [activeTab, setActiveTab] = useState(initialTab);

    // Sync tab with localStorage if needed
    useEffect(() => {
        const savedTab = localStorage.getItem('chery_booking_manager_tab');
        if (savedTab) setActiveTab(savedTab);
    }, []);

    useEffect(() => {
        localStorage.setItem('chery_booking_manager_tab', activeTab);
    }, [activeTab]);

    return (
        <div className="flex flex-col h-full overflow-hidden bg-white">
            {/* Sub-Navbar / Tabs */}
            <div className={`bg-white border-b border-zinc-200 px-4 py-2 flex items-center justify-between shadow-sm z-30 transition-all duration-300 ${isNavbarVisible ? 'mt-0' : '-mt-0'}`}>
                <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('booking')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-150 flex items-center gap-2 ${activeTab === 'booking' ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200 hover:text-black'}`}
                    >
                        <Calendar size={14} /> Booking Management
                    </button>
                    <button 
                        onClick={() => setActiveTab('followup')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-150 flex items-center gap-2 ${activeTab === 'followup' ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200 hover:text-black'}`}
                    >
                        <MessageSquare size={14} /> CRO Follow Up
                    </button>
                    <button 
                        onClick={() => setActiveTab('holidays')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-150 flex items-center gap-2 ${activeTab === 'holidays' ? 'bg-black text-white shadow-md' : 'text-zinc-500 hover:bg-zinc-200 hover:text-black'}`}
                    >
                        <Settings size={14} /> Libur Dealer
                    </button>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black uppercase text-zinc-400 leading-none">Logged in as</p>
                        <p className="text-xs font-bold text-black">{user?.name || 'User'}</p>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
                {activeTab === 'booking' && (
                    <div className="h-full">
                        <CroBookingPanel user={user} setCurrentPage={setCurrentPage} />
                    </div>
                )}
                {activeTab === 'followup' && (
                    <div className="h-full pt-16 -mt-16"> 
                        <FollowupPanel user={user} handleLogout={handleLogout} isNavbarVisible={true} setCurrentPage={setCurrentPage} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
                    </div>
                )}
                {activeTab === 'holidays' && (
                    <div className="h-full overflow-hidden">
                        <HolidaySettings user={user} breakSettings={breakSettings} setBreakSettings={setBreakSettings} />
                    </div>
                )}
            </div>

            <style >{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E4E4E7;
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: #71717a;
                }
            `}</style>
        </div>
    );
}
