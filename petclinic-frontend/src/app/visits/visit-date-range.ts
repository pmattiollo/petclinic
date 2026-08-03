import {Pet} from '../pets/pet';

/** Mirrors the backend's VisitDateRange: a visit can't predate the pet, nor be booked further ahead than this. */
export const MAX_MONTHS_AHEAD = 12;

/** Lower bound for the visit datepicker: the pet's birth date, or null while the pet is still loading. */
export function minVisitDate(pet: Pet): Date | null {
  if (!pet || !pet.birthDate) {
    return null;
  }
  // Built from the parts rather than new Date(iso): the ISO form is parsed as UTC
  // and would shift a day back in negative-offset timezones.
  const [year, month, day] = pet.birthDate.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Upper bound for the visit datepicker: one year from today. */
export function maxVisitDate(): Date {
  const max = new Date();
  max.setMonth(max.getMonth() + MAX_MONTHS_AHEAD);
  return max;
}
