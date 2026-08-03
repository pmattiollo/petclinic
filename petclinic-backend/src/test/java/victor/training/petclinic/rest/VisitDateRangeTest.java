package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import victor.training.petclinic.rest.error.InvalidVisitDateException;

class VisitDateRangeTest {

    private static final LocalDate PET_BIRTH_DATE = LocalDate.of(2018, 12, 24);

    @Test
    void rejectsDateBeforeThePetWasBorn() {
        assertThatThrownBy(() -> VisitDateRange.validate(LocalDate.of(9, 7, 20), PET_BIRTH_DATE))
                .isInstanceOf(InvalidVisitDateException.class)
                .hasMessageContaining("before the pet's birth date");
    }

    @Test
    void rejectsDateMoreThanAYearAhead() {
        LocalDate tooFar = VisitDateRange.latestAllowed().plusDays(1);

        assertThatThrownBy(() -> VisitDateRange.validate(tooFar, PET_BIRTH_DATE))
                .isInstanceOf(InvalidVisitDateException.class)
                .hasMessageContaining("months ahead");
    }

    @Test
    void acceptsThePetsBirthDateItself() {
        assertThatCode(() -> VisitDateRange.validate(PET_BIRTH_DATE, PET_BIRTH_DATE)).doesNotThrowAnyException();
    }

    @Test
    void acceptsTheLastDayOfTheAllowedWindow() {
        assertThatCode(() -> VisitDateRange.validate(VisitDateRange.latestAllowed(), PET_BIRTH_DATE))
                .doesNotThrowAnyException();
    }

    @Test
    void acceptsNullDate() {
        assertThatCode(() -> VisitDateRange.validate(null, PET_BIRTH_DATE)).doesNotThrowAnyException();
    }

    @Test
    void skipsTheLowerBoundWhenThePetHasNoBirthDate() {
        assertThatCode(() -> VisitDateRange.validate(LocalDate.of(9, 7, 20), null)).doesNotThrowAnyException();
    }
}
