package victor.training.petclinic.rest;

import victor.training.petclinic.rest.error.VisitDateOutOfRangeException;

import java.time.LocalDate;

public final class VisitDateRangeHelper {
    public static void validate(LocalDate visitDate, LocalDate petBirthDate) {
        if (visitDate == null) {
            throw new VisitDateOutOfRangeException("Visit date is required");
        }
        if (petBirthDate != null && visitDate.isBefore(petBirthDate)) {
            throw new VisitDateOutOfRangeException("Visit date must not be before the pet birth date");
        }
        LocalDate maxAllowedDate = LocalDate.now().plusYears(1);
        if (visitDate.isAfter(maxAllowedDate)) {
            throw new VisitDateOutOfRangeException("Visit date must not be more than one year in the future");
        }
    }
}
