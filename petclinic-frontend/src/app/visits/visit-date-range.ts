export const MAX_YEARS_IN_ADVANCE = 1;

/** A visit can't predate the pet; null until the pet (and its birth date) is loaded. */
export function earliestVisitDate(petBirthDate?: string): Date | null {
  return petBirthDate ? new Date(petBirthDate) : null;
}

export function latestVisitDate(): Date {
  const latest = new Date();
  latest.setFullYear(latest.getFullYear() + MAX_YEARS_IN_ADVANCE);
  return latest;
}
