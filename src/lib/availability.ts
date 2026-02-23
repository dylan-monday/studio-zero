import { supabase } from './supabase';
import { eachDayOfInterval, format, parseISO, isBefore, startOfDay } from 'date-fns';

interface UnavailableDate {
  date: string;
  reason: 'booked' | 'blocked' | 'past';
}

/**
 * Fetches unavailable dates within a date range
 * Combines: blocked_dates + booked date ranges from bookings table
 */
export async function getUnavailableDates(
  startDate: Date,
  endDate: Date
): Promise<UnavailableDate[]> {
  const startStr = format(startDate, 'yyyy-MM-dd');
  const endStr = format(endDate, 'yyyy-MM-dd');

  // Fetch blocked dates and bookings in parallel
  const [blockedResponse, bookingsResponse] = await Promise.all([
    supabase
      .from('blocked_dates')
      .select('date, reason')
      .gte('date', startStr)
      .lte('date', endStr),
    supabase
      .from('bookings')
      .select('check_in, check_out')
      .in('status', ['pending', 'approved', 'confirmed'])
      .lte('check_in', endStr)
      .gte('check_out', startStr),
  ]);

  if (blockedResponse.error) throw blockedResponse.error;
  if (bookingsResponse.error) throw bookingsResponse.error;

  const unavailableDates: UnavailableDate[] = [];
  const dateSet = new Set<string>();
  const today = startOfDay(new Date());

  // Add blocked dates
  blockedResponse.data?.forEach((blocked: { date: string; reason: string }) => {
    if (!dateSet.has(blocked.date)) {
      dateSet.add(blocked.date);
      unavailableDates.push({
        date: blocked.date,
        reason: 'blocked',
      });
    }
  });

  // Add booked dates (expand date ranges)
  bookingsResponse.data?.forEach((booking: { check_in: string; check_out: string }) => {
    const checkIn = parseISO(booking.check_in);
    const checkOut = parseISO(booking.check_out);
    // Nights are from check_in to day before check_out
    const checkOutPrevDay = new Date(checkOut.getTime() - 86400000);

    if (checkIn <= checkOutPrevDay) {
      const nights = eachDayOfInterval({ start: checkIn, end: checkOutPrevDay });
      nights.forEach(night => {
        const dateStr = format(night, 'yyyy-MM-dd');
        if (!dateSet.has(dateStr)) {
          dateSet.add(dateStr);
          unavailableDates.push({
            date: dateStr,
            reason: 'booked',
          });
        }
      });
    }
  });

  // Add past dates
  const allDays = eachDayOfInterval({ start: startDate, end: endDate });
  allDays.forEach(day => {
    if (isBefore(day, today)) {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (!dateSet.has(dateStr)) {
        dateSet.add(dateStr);
        unavailableDates.push({
          date: dateStr,
          reason: 'past',
        });
      }
    }
  });

  return unavailableDates;
}

/**
 * Check if a specific date range is available for booking
 */
export async function isDateRangeAvailable(
  checkIn: Date,
  checkOut: Date
): Promise<{ available: boolean; conflictingDates?: string[] }> {
  const unavailable = await getUnavailableDates(checkIn, checkOut);

  // Check if any nights in the range are unavailable
  const checkOutPrevDay = new Date(checkOut.getTime() - 86400000);
  const requestedNights = eachDayOfInterval({ start: checkIn, end: checkOutPrevDay });

  const unavailableSet = new Set(unavailable.map(d => d.date));
  const conflicts: string[] = [];

  requestedNights.forEach(night => {
    const dateStr = format(night, 'yyyy-MM-dd');
    if (unavailableSet.has(dateStr)) {
      conflicts.push(dateStr);
    }
  });

  return {
    available: conflicts.length === 0,
    conflictingDates: conflicts.length > 0 ? conflicts : undefined,
  };
}

/**
 * Get minimum nights setting
 */
export async function getMinNights(): Promise<number> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'min_nights')
    .single();

  if (error || !data) return 2;
  return data.value as number;
}

/**
 * Get max guests setting
 */
export async function getMaxGuests(): Promise<number> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'max_guests')
    .single();

  if (error || !data) return 2;
  return data.value as number;
}
