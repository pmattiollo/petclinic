package victor.training.petclinic.rest;

import java.util.List;

import org.springframework.data.domain.Sort;

/**
 * The columns the Owners grid can be ordered by.
 * <p>
 * Deliberately a closed set rather than free-form property names: an unknown value can never reach Spring Data as a
 * property reference, and "Name" is a composite ordering that no single entity field expresses.
 * <p>
 * Address, telephone and pets are absent on purpose — see design.md D2. Every ordering ends in {@code id} because the
 * listing pages with LIMIT/OFFSET, where rows tied on the leading column have no guaranteed relative order.
 */
public enum OwnerSortField {

    NAME(List.of("lastName", "firstName", "id")),

    CITY(List.of("city", "lastName", "id"));

    private final List<String> properties;

    OwnerSortField(List<String> properties) {
        this.properties = properties;
    }

    public Sort toSort(Sort.Direction direction) {
        return Sort.by(direction, properties.toArray(String[]::new));
    }
}
