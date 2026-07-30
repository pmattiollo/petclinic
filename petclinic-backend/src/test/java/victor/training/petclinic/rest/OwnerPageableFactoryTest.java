package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

class OwnerPageableFactoryTest {

    private final OwnerPageableFactory factory = new OwnerPageableFactory();

    @Test
    void nameAsc() {
        Pageable pageable = factory.toPageable(0, 10, "name,asc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void nameDesc() {
        Pageable pageable = factory.toPageable(0, 10, "name,desc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.desc("lastName"), Sort.Order.desc("firstName"), Sort.Order.desc("id"));
    }

    @Test
    void cityAsc() {
        Pageable pageable = factory.toPageable(0, 10, "city,asc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.asc("city"), Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void cityDesc() {
        Pageable pageable = factory.toPageable(0, 10, "city,desc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.desc("city"), Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void unknownKey_fallsBackToNameAsc() {
        Pageable pageable = factory.toPageable(0, 10, "telephone,asc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void nestedPropertyPath_fallsBackToNameAsc() {
        // Must not let a client traverse the entity graph via the sort parameter.
        Pageable pageable = factory.toPageable(0, 10, "pets.visits.description,asc");

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void nullSort_fallsBackToNameAsc() {
        Pageable pageable = factory.toPageable(0, 10, null);

        assertThat(pageable.getSort()).containsExactly(
            Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    }

    @Test
    void allowedSizes_arePreserved() {
        assertThat(factory.toPageable(0, 5, null).getPageSize()).isEqualTo(5);
        assertThat(factory.toPageable(0, 10, null).getPageSize()).isEqualTo(10);
        assertThat(factory.toPageable(0, 20, null).getPageSize()).isEqualTo(20);
    }

    @Test
    void unsupportedSize_fallsBackToDefault() {
        assertThat(factory.toPageable(0, 7, null).getPageSize()).isEqualTo(10);
        assertThat(factory.toPageable(0, 0, null).getPageSize()).isEqualTo(10);
        assertThat(factory.toPageable(0, -1, null).getPageSize()).isEqualTo(10);
    }

    @Test
    void negativePage_clampsToZero() {
        assertThat(factory.toPageable(-5, 10, null).getPageNumber()).isEqualTo(0);
    }
}
