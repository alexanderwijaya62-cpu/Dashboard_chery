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
        <div className="flex flex-col h-screen overflow-hidden bg-[#F2F2F7]">
            {/* Sub-Navbar / Tabs */}
            <div className={`bg-white border-b border-zinc-200 px-4 py-2 flex items-center justify-between shadow-sm z-30 transition-all duration-300 ${isNavbarVisible ? 'mt-0' : '-mt-0'}`}>
                <div className="flex bg-zinc-100 p-1 rounded-2xl border border-zinc-200 shadow-inner">
                    <button 
                        onClick={() => setActiveTab('booking')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'booking' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                        <Calendar size={14} /> Booking Management
                    </button>
                    <button 
                        onClick={() => setActiveTab('followup')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'followup' ? 'bg-white text-zinc-900 shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                        <MessageSquare size={14} /> CRO Follow Up
                    </button>
                    <button 
                        onClick={() => setActiveTab('holidays')}
                        className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'holidays' ? 'bg-zinc-900 text-white shadow-md' : 'text-zinc-500 hover:text-zinc-800'}`}
                    >
                        <Settings size={14} /> Libur Dealer
                    </button>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black uppercase text-zinc-400 leading-none">Logged in as</p>
                        <p className="text-xs font-bold text-zinc-900">{user?.name || 'User'}</p>
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
                    background: #F87171;
                }
            `}</style>
        </div>
    );
}
