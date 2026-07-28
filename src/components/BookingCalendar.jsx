import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { generateSlots, getSlotsForDate, getCapacityForDate, isSaturday } from '../utils/bookingConfig';
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
    slotConfig = { slotCount: 4, gapMinutes: 30, startHour: 8, startMinute: 30, slotCapacity: 1, saturdayEnabled: true, satSlotCount: 4, satGapMinutes: 30, satStartHour: 8, satStartMinute: 0, satSlotCapacity: 1 },
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
        bookings.forEach(b => {
            if (!STATUS_ACTIVE.includes(b.status)) return;
            if (!b.tanggal) return;
            const capacity = getCapacityForDate(b.tanggal, slotConfig);
            const slots = getSlotsForDate(b.tanggal, slotConfig);
            const dayTotal = slots.length * capacity;
            map[b.tanggal] = (map[b.tanggal] || { count: 0, total: dayTotal });
            map[b.tanggal].count += 1;
            map[b.tanggal].total = dayTotal;
        });
        Object.keys(map).forEach(d => {
            map[d] = {
                count: map[d].count,
                total: map[d].total,
                full: map[d].count >= map[d].total,
                partial: map[d].count > 0 && map[d].count < map[d].total,
            };
        });
        return map;
    }, [bookings, slotConfig]);

    const JAM_PILIHAN = useMemo(
        () => getSlotsForDate(selectedDate, slotConfig),
        [selectedDate, slotConfig.slotCount, slotConfig.gapMinutes, slotConfig.startHour, slotConfig.startMinute, slotConfig.saturdayEnabled, slotConfig.satSlotCount, slotConfig.satGapMinutes, slotConfig.satStartHour, slotConfig.satStartMinute]
    );

    const selectedCapacity = useMemo(
        () => getCapacityForDate(selectedDate, slotConfig),
        [selectedDate, slotConfig.slotCapacity, slotConfig.saturdayEnabled, slotConfig.satSlotCapacity]
    );

    const timeSlotCounts = useMemo(() => {
        const map = {};
        const toMin = (j) => {
            if (!j) return -1;
            const parts = String(j).replace(':', '.').split('.');
            const h = parseInt(parts[0] || '0', 10);
            const m = parseInt(parts[1] || '0', 10);
            return h * 60 + m;
        };

        const cleanSelDate = String(selectedDate || '').split('T')[0].trim();

        JAM_PILIHAN.forEach((slot, idx) => {
            const slotMin = toMin(slot);
            const nextMin = idx < JAM_PILIHAN.length - 1 ? toMin(JAM_PILIHAN[idx + 1]) : slotMin + 30;

            map[slot] = bookings.filter(b => {
                const bDate = String(b.tanggal || '').split('T')[0].trim();
                if (bDate !== cleanSelDate || !STATUS_ACTIVE.includes(b.status)) return false;
                const bMin = toMin(b.jam);
                return bMin >= slotMin && bMin < nextMin;
            }).length;
        });
        return map;
    }, [bookings, selectedDate, JAM_PILIHAN]);

    const changeCalMonth = (offset) => {
        const next = new Date(currentCalMonth);
        next.setMonth(next.getMonth() + offset);
        setCurrentCalMonth(next);
    };

    const satHighlight = isSaturday(selectedDate) && slotConfig.saturdayEnabled;

    return (
        <div className="space-y-1">
            {/* Calendar Grid */}
            <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-2 shadow-sm">
                <div className="flex items-center justify-between mb-1 px-0.5">
                    <button type="button" onClick={() => changeCalMonth(-1)}
                        className="p-1.5 bg-white border border-zinc-100 rounded-lg hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                        <ChevronLeft size={14} />
                    </button>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-900">
                        {currentCalMonth.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                    </h4>
                    <button type="button" onClick={() => changeCalMonth(1)}
                        className="p-1.5 bg-white border border-zinc-100 rounded-lg hover:bg-zinc-900 hover:text-white transition-all shadow-sm">
                        <ChevronRight size={14} />
                    </button>
                </div>
                <div className="grid grid-cols-7 gap-0.5 text-center text-[8px] font-black uppercase text-zinc-400 mb-0.5">
                    {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sat'].map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                    {calendarGrid.map((item, idx) => {
                        if (!item.currentMonth) return <div key={idx} className="aspect-square opacity-5"><div className="w-full h-full border border-dashed border-zinc-200 rounded-md"></div></div>;
                        const isActive = selectedDate === item.date;
                        const past = isPastDate(item.date);
                        const holiday = isHolidayOrSunday(item.date, holidays);
                        const satDay = isSaturday(item.date);
                        const disabled = past || holiday;
                        const fill = dateFillMap[item.date];
                        const fillBg = !disabled && fill?.full ? 'bg-red-500 border-red-600 text-white' :
                            !disabled && fill?.partial ? 'bg-yellow-300 border-yellow-400 text-yellow-900' :
                            !disabled && fill ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:border-emerald-400' : '';
                        return (
                            <button key={idx} type="button" disabled={disabled}
                                onClick={() => onDateSelect?.(item.date)}
                                className={`relative aspect-square rounded-lg flex flex-col items-center justify-center transition-all border-2 ${disabled ? 'bg-zinc-100/30 border-transparent text-zinc-200 cursor-not-allowed opacity-20' :
                                    isActive ? 'bg-black border-black text-white shadow-lg z-10 scale-110' : fillBg || 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                } ${!disabled && satDay && !isActive ? 'border-amber-300 bg-amber-50' : ''}`}
                            >
                                <span className="text-[11px] font-black">{item.day}</span>
                                {!disabled && satDay && (
                                    <span className="text-[7px] font-black text-amber-500 leading-none uppercase">Sab</span>
                                )}
                                {!disabled && fill && (
                                    <span className="text-[8px] opacity-70 leading-none">{fill.count}/{fill.total}</span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Time Slots */}
            {showTimeSlots && selectedDate && (
                <div className="space-y-1">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                        Jam Kedatangan
                        {satHighlight && <span className="text-amber-500 normal-case tracking-normal">(Sabtu — jam terbatas)</span>}
                    </h4>
                    <div className="grid grid-cols-3 gap-1">
                        {JAM_PILIHAN.map((slot) => {
                            const [h, m] = slot.split('.');
                            const isToday = selectedDate === new Date().toISOString().split('T')[0];
                            const isPastTime = isToday && parseFloat(slot) < (new Date().getHours() + new Date().getMinutes() / 60);
                            const count = timeSlotCounts[slot] || 0;
                            const isFull = count >= selectedCapacity;
                            return (
                                <button key={slot} type="button" disabled={isPastTime || isFull}
                                    onClick={() => onTimeSelect?.(slot)}
                                    className={`py-2 px-1.5 rounded-lg border font-black text-[10px] uppercase tracking-wider transition-all ${selectedTime === slot ? 'bg-black border-black text-white shadow-lg' :
                                        isPastTime || isFull ? 'bg-zinc-50 border-transparent text-zinc-200 cursor-not-allowed' : satHighlight ? 'bg-white border-amber-200 text-amber-500 hover:border-amber-500 hover:text-amber-900' : 'bg-white border-zinc-100 text-zinc-400 hover:border-zinc-400 hover:text-black'
                                    }`}
                                >
                                    {h}:{m} WIB
                                    <span className="text-[8px] opacity-70 block">{count}/{selectedCapacity}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
