import { useState, useMemo } from 'react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay,
  isToday,
} from 'date-fns';
import { useAvailability } from '../../hooks/useAvailability';

interface AvailabilityCalendarProps {
  onDateSelect?: (date: Date) => void;
  selectedDates?: { checkIn?: Date; checkOut?: Date };
  showLegend?: boolean;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AvailabilityCalendar({
  onDateSelect,
  selectedDates,
  showLegend = true,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { availability, loading } = useAvailability({ months: 12 });

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const startingDayIndex = getDay(startOfMonth(currentMonth));

  const getDateStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayAvailability = availability.find((d) => d.date === dateStr);

    if (!dayAvailability) return 'unknown';
    if (!dayAvailability.available) return dayAvailability.reason || 'unavailable';
    return 'available';
  };

  const isSelected = (date: Date) => {
    if (!selectedDates) return false;
    if (selectedDates.checkIn && isSameDay(date, selectedDates.checkIn)) return true;
    if (selectedDates.checkOut && isSameDay(date, selectedDates.checkOut)) return true;
    return false;
  };

  const isInRange = (date: Date) => {
    if (!selectedDates?.checkIn || !selectedDates?.checkOut) return false;
    return date > selectedDates.checkIn && date < selectedDates.checkOut;
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const handleDateClick = (date: Date) => {
    const status = getDateStatus(date);
    if (status === 'available' && onDateSelect) {
      onDateSelect(date);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={handlePrevMonth}
          className="p-2 hover:bg-surface rounded-lg transition-colors"
          aria-label="Previous month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold text-text-primary">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <button
          onClick={handleNextMonth}
          className="p-2 hover:bg-surface rounded-lg transition-colors"
          aria-label="Next month"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-medium text-text-secondary py-2"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Empty cells for days before month starts */}
        {Array.from({ length: startingDayIndex }).map((_, index) => (
          <div key={`empty-${index}`} className="aspect-square" />
        ))}

        {/* Day cells */}
        {days.map((day) => {
          const status = getDateStatus(day);
          const selected = isSelected(day);
          const inRange = isInRange(day);
          const today = isToday(day);

          return (
            <button
              key={day.toISOString()}
              onClick={() => handleDateClick(day)}
              disabled={status !== 'available' || loading}
              className={`
                aspect-square flex items-center justify-center
                text-sm rounded-lg transition-all duration-150
                ${today ? 'font-bold' : 'font-normal'}
                ${selected
                  ? 'bg-accent text-white'
                  : inRange
                  ? 'bg-accent/10 text-accent'
                  : status === 'available'
                  ? 'hover:bg-surface text-text-primary cursor-pointer'
                  : status === 'past'
                  ? 'text-text-secondary/40 cursor-not-allowed'
                  : status === 'booked'
                  ? 'bg-surface text-text-secondary/60 cursor-not-allowed line-through'
                  : status === 'blocked'
                  ? 'bg-surface text-text-secondary/60 cursor-not-allowed'
                  : 'text-text-secondary/40 cursor-not-allowed'
                }
              `}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="mt-6 pt-4 border-t border-border flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-white border border-border" />
            <span className="text-text-secondary">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-surface" />
            <span className="text-text-secondary line-through">Booked</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent" />
            <span className="text-text-secondary">Selected</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-xl">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
