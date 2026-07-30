package victor.training.petclinic.domain;

import java.time.LocalDate;

/**
 * Dates a visit may legally fall on: never before the pet was born, and at most one year ahead,
 * so typos like year 0009 or appointments a decade out are rejected.
 */
public record VisitDateRange(LocalDate earliest, LocalDate latest) {

    public static final int MAX_YEARS_IN_ADVANCE = 1;

    public static VisitDateRange forPet(Pet pet) {
        LocalDate earliest = pet.getBirthDate() != null ? pet.getBirthDate() : LocalDate.MIN;
        return new VisitDateRange(earliest, LocalDate.now().plusYears(MAX_YEARS_IN_ADVANCE));
    }

    public boolean contains(LocalDate date) {
        return !date.isBefore(earliest) && !date.isAfter(latest);
    }

    public String rejectionMessage(LocalDate date) {
        return "Visit date " + date + " must be between " + earliest + " and " + latest;
    }
}
