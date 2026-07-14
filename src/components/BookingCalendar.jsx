import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { generateSlots } from '../utils/bookingConfig';
import { isHolidayOrSunday } from '../utils/holidayHelpers';

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
const startDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

const isPastDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return d <= now;
};

const STATUS_ACTIVE = ['waiting confirm', 'waiting_approval', 'accepted', 'completed', 'synced'];

export default function BookingCalendar({
    bookings = [],
    slotConfig = { count: 4, gap: 30, startH: 8, startM: 30, capacity: 1 },
    selectedDate = '',
    selectedTime = '',
    holidays = [],
    onDateSelect,
    onTimeSelect,
    showTimeSlots = true,
}) {
    const [currentCalMonth, setCurrentCalMonth] = useState(new Date());

    const calendarGrid = useMemo(() => {
        const month = currentCalMonth.getMonth();
        const year = currentCalMonth.getFullYear();
        const days = [];
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        const startDay = startDayOfMonth(month, year);
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({ day: prevMonthLastDay - i, currentMonth: false });
        }
        for (let i = 1; i <= daysInMonth(month, year); i++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            days.push({ day: i, currentMonth: true, date: dateStr });
        }
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            days.push({ day: i, currentMonth: false });
        }
        return days;
    }, [currentCalMonth]);

    const dateFillMap = useMemo(() => {
        const map = {};
        const allSlots = generateSlots(slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM);
        const totalCapacity = allSlots.length * slotConfig.capacity;
        bookings.forEach(b => {
            if (!STATUS_ACTIVE.includes(b.status)) return;
            if (!b.tanggal) return;
            map[b.tanggal] = (map[b.tanggal] || 0) + 1;
        });
        Object.keys(map).forEach(d => {
            map[d] = {
                count: map[d],
                total: totalCapacity,
                full: map[d] >= totalCapacity,
                partial: map[d] > 0 && map[d] < totalCapacity,
            };
        });
        return map;
    }, [bookings, slotConfig]);

    const JAM_PILIHAN = useMemo(
        () => generateSlots(slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM),
        [slotConfig.count, slotConfig.gap, slotConfig.startH, slotConfig.startM]
    );

    const timeSlotCounts = useMemo(() => {
        const map = {};
        JAM_PILIHAN.forEach(slot => {
            map[slot] = bookings.filter(b =>
                b.tanggal === selectedDate &&
                STATUS_ACTIVE.includes(b.status) &&
                String(b.jam || '').replace(':', '.').trim() === slot
            ).length;
        });
        return map;
    }, [bookings, selectedDate, JAM_PILIHAN]);

    const changeCalMonth = (offset) => {
        const next = new Date(currentCalMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentCalMonth(next);
    };

    return (
        <div className="space-y-3">
            {/* Calendar Grid */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-3xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4 px-1">
                    <button type="button" onClick={() => changeCalMonth(-1)}
                        className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                        <ChevronLeft size={16} />
                    </button>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.15em] text-zinc-900">
                        {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </h4>
                    <button type="button" onClick={() => changeCalMonth(1)}
                        className="p-2 bg-white border border-zinc-100 rounded-xl hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                        <ChevronRight size={16} />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-1 text-center text-[8px] font-black uppercase text-zinc-400 mb-2">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-2">
                    {calendarGrid.map((item, idx) => {
                        if (!item.currentMonth) return <div key={idx} className="aspect-[4/5] opacity-5"><div className="w-full h-full border border-dashed border-zinc-200 rounded-xl"></div></div>;
                        const isActive = selectedDate === item.date;
                        const past = isPastDate(item.date);
                        const holiday = isHolidayOrSunday(item.date, holidays);
                        const disabled = past || holiday;
                        const fill = dateFillMap[item.date];
                        const fillBg = !disabled && fill?.full ? 'bg-red-500 border-red-600 text-white' :
                            !disabled && fill?.partial ? 'bg-yellow-300 border-yellow-400 text-yellow-900' :
                            !disabled && fill ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400' : '';
                        return (
                            <button key={idx} type="button" disabled={disabled}
                                onClick={() => onDateSelect?.(item.date)}
                                className={`relative aspect-[4/5] rounded-xl flex flex-col items-center justify-center transition-all border-2 ${disabled ? 'bg-zinc-100/30 border-transparent text-zinc-200 cursor-not-allowed opacity-20' :
                                    isActive ? 'bg-black border-black text-white shadow-lg z-10 scale-110' : fillBg || 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                }`}
                            >
                                <span className="text-[11px] font-black">{item.day}</span>
                                {!disabled && fill && (
                                    <span className="text-[6px] opacity-70 leading-none">{fill.count}/{fill.total}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Slots */}
            {showTimeSlots && selectedDate && (
                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest text-zinc-400 ml-1">Jam Kedatangan</h4>
                    <div className="grid grid-cols-3 gap-2">
                        {JAM_PILIHAN.map((slot) => {
                            const [h, m] = slot.split('.');
                            const isToday = selectedDate === new Date().toISOString().split('T')[0];
                            const isPastTime = isToday && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                            const count = timeSlotCounts[slot] || 0;
                            const isFull = count >= slotConfig.capacity;
                            return (
                                <button key={slot} type="button" disabled={isPastTime || isFull}
                                    onClick={() => onTimeSelect?.(slot)}
                                    className={`py-3 px-2 rounded-xl border-2 font-black text-[9px] uppercase tracking-widest transition-all ${selectedTime === slot ? 'bg-black border-black text-white shadow-lg' :
                                        isPastTime || isFull ? 'bg-zinc-50 border-transparent text-zinc-200 cursor-not-allowed' : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                    }`}
                                >
                                    {h}:{m} WIB
                                    <span className="text-[6px] opacity-70 block">{count}/{slotConfig.capacity}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
