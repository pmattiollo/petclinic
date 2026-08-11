package victor.training.petclinic.rest;

import java.util.List;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Min;

/**
 * The query parameters of the Owners listing. All are optional; {@link #toPageable()} applies the defaults.
 * <p>
 * {@code size} is an allowlist rather than a clamp: silently serving fewer rows than asked for is a lie the caller
 * cannot detect, and an unbounded size would let one request pull the whole table.
 */
public record OwnerListingCriteria(

        @Min(value = 0, message = "must be 0 or greater") @Schema(example = "0",
                description = "Zero-based page number.") Integer page,

        @Schema(example = "10", description = "Rows per page. One of 5, 10 or 20.") Integer size,

        @Schema(description = "Column to order by. Defaults to NAME.") OwnerSortField sort,

        @Schema(description = "Order direction. Defaults to ASC.") Sort.Direction direction,

        @Schema(example = "Fra", description = "Only owners whose last name starts with this.") String lastName) {

    private static final List<Integer> ALLOWED_SIZES = List.of(5, 10, 20);
    private static final int DEFAULT_SIZE = 10;

    @AssertTrue(message = "must be one of 5, 10 or 20")
    @Schema(hidden = true)
    public boolean isSize() {
        return size == null || ALLOWED_SIZES.contains(size);
    }

    public Pageable toPageable() {
        int pageNumber = page == null ? 0 : page;
        int pageSize = size == null ? DEFAULT_SIZE : size;
        return PageRequest.of(pageNumber, pageSize, sortOrDefault().toSort(directionOrDefault()));
    }

    public String lastNamePrefix() {
        return lastName == null ? "" : lastName;
    }

    private OwnerSortField sortOrDefault() {
        return sort == null ? OwnerSortField.NAME : sort;
    }

    private Sort.Direction directionOrDefault() {
        return direction == null ? Sort.Direction.ASC : direction;
    }
}
