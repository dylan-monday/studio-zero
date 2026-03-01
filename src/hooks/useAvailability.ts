import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { DateAvailability, Booking } from '../types';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isBefore, startOfDay, parseISO } from 'date-fns';

interface UseAvailabilityOptions {
  startDate?: Date;
  endDate?: Date;
  months?: number;
}

export function useAvailability(options: UseAvailabilityOptions = {}) {
  const { months = 6 } = options;
  const [availability, setAvailability] = useState<DateAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAvailability = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const today = startOfDay(new Date());
      const startDate = options.startDate || startOfMonth(today);
      const endDate = options.endDate || endOfMonth(new Date(today.getFullYear(), today.getMonth() + months - 1));

      // Fetch blocked dates
      const { data: blockedDates, error: blockedError } = await supabase
        .from('blocked_dates')
        .select('date')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'));

      if (blockedError) throw blockedError;

      // Fetch booked dates via API (bypasses RLS on bookings table)
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');
      const bookingsRes = await fetch(`/api/booked-dates?start=${startStr}&end=${endStr}`);
      if (!bookingsRes.ok) throw new Error('Failed to fetch booked dates');
      const bookings: { check_in: string; check_out: string }[] = await bookingsRes.json();

      // Build set of unavailable dates
      const blockedSet = new Set(blockedDates?.map((d: { date: string }) => d.date) || []);
      const bookedSet = new Set<string>();

      bookings?.forEach((booking: Pick<Booking, 'check_in' | 'check_out'>) => {
        const checkIn = parseISO(booking.check_in);
        const checkOut = parseISO(booking.check_out);
        const nights = eachDayOfInterval({ start: checkIn, end: new Date(checkOut.getTime() - 86400000) });
        nights.forEach(night => bookedSet.add(format(night, 'yyyy-MM-dd')));
      });

      // Generate availability for each day
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const availabilityData: DateAvailability[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const isPast = isBefore(day, today);
        const isBlocked = blockedSet.has(dateStr);
        const isBooked = bookedSet.has(dateStr);

        let reason: DateAvailability['reason'] = undefined;
        if (isPast) reason = 'past';
        else if (isBooked) reason = 'booked';
        else if (isBlocked) reason = 'blocked';

        return {
          date: dateStr,
          available: !isPast && !isBlocked && !isBooked,
          reason,
        };
      });

      setAvailability(availabilityData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch availability'));
    } finally {
      setLoading(false);
    }
  }, [options.startDate, options.endDate, months]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  return {
    availability,
    loading,
    error,
    refresh: fetchAvailability,
    isDateAvailable: (date: string) => {
      const day = availability.find(d => d.date === date);
      return day?.available ?? false;
    },
  };
}
