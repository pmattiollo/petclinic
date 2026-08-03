package victor.training.petclinic.rest;

import java.time.LocalDate;

import org.springframework.lang.Nullable;

import victor.training.petclinic.rest.error.InvalidVisitDateException;

/**
 * The window a vet visit may be booked in: not before the pet was born, and at most one year ahead.
 * <p>
 * Kept as a single place so every write path (POST /api/visits, POST /api/owners/../visits, PUT /api/visits/..)
 * enforces the same rule, and so the Angular form can mirror the exact same bounds.
 */
public final class VisitDateRange {

    public static final int MAX_MONTHS_AHEAD = 12;

    private VisitDateRange() {
    }

    public static LocalDate latestAllowed() {
        return LocalDate.now().plusMonths(MAX_MONTHS_AHEAD);
    }

    /**
     * @param visitDate the date to check; {@code null} is accepted (the date is optional in the API contract)
     * @param petBirthDate the lower bound; {@code null} skips the lower-bound check
     * @throws InvalidVisitDateException if the date falls outside the allowed window
     */
    public static void validate(@Nullable LocalDate visitDate, @Nullable LocalDate petBirthDate) {
        if (visitDate == null) {
            return;
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw new InvalidVisitDateException(
                    "Visit date " + visitDate + " is before the pet's birth date " + petBirthDate);
        }
        LocalDate latestAllowed = latestAllowed();
        if (visitDate.isAfter(latestAllowed)) {
            throw new InvalidVisitDateException("Visit date " + visitDate + " is more than " + MAX_MONTHS_AHEAD
                    + " months ahead; the latest allowed date is " + latestAllowed);
        }
    }
}
