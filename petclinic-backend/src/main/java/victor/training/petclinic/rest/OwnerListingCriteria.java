package victor.training.petclinic.rest;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;
import victor.training.petclinic.rest.error.InvalidOwnerListingException;

/**
 * Query params for {@code GET /api/owners}: the last-name filter plus paging/sorting. A single
 * {@code @ParameterObject} bean rather than discrete {@code @RequestParam}s so a future search-term param
 * (issue #24) doesn't push the controller method past Sonar's 5-parameter cap.
 */
@Data
public class OwnerListingCriteria {

    @Schema(description = "Only owners whose last name starts with this (case-sensitive).", example = "Dav")
    private String lastName = "";

    @Schema(description = "Zero-based page number.", example = "0")
    private int page = 0;

    @Schema(description = "Number of owners per page; must be positive.", example = "10")
    private int size = 10;

    @Schema(description = "Sort column and direction.", example = "name,asc",
            allowableValues = {"name,asc", "name,desc", "city,asc", "city,desc"})
    private String sort = "name,asc";

    public Pageable toPageable() {
        if (page < 0) {
            throw new InvalidOwnerListingException("page must not be negative, was " + page);
        }
        if (size <= 0) {
            throw new InvalidOwnerListingException("size must be a positive number, was " + size);
        }
        return PageRequest.of(page, size, SortOption.from(sort).toSort());
    }

    /**
     * The sort column/direction whitelist. Each option's field chain (e.g. lastName, firstName) follows the
     * requested direction; the trailing "id" tiebreaker is always ascending regardless, so paging never loses
     * or duplicates rows even when names collide.
     */
    private enum SortOption {
        NAME_ASC("name,asc", Sort.Direction.ASC, "lastName", "firstName"), NAME_DESC("name,desc", Sort.Direction.DESC,
                "lastName", "firstName"), CITY_ASC("city,asc", Sort.Direction.ASC, "city", "lastName",
                        "firstName"), CITY_DESC("city,desc", Sort.Direction.DESC, "city", "lastName", "firstName");

        private final String param;
        private final Sort.Direction direction;
        private final List<String> fields;

        SortOption(String param, Sort.Direction direction, String... fields) {
            this.param = param;
            this.direction = direction;
            this.fields = List.of(fields);
        }

        static SortOption from(String param) {
            return Arrays.stream(values())
                    .filter(option -> option.param.equals(param))
                    .findFirst()
                    .orElseThrow(() -> new InvalidOwnerListingException(
                            "Invalid sort '" + param + "'; allowed values: " + allowedParams()));
        }

        static String allowedParams() {
            return Arrays.stream(values()).map(option -> option.param).collect(Collectors.joining(", "));
        }

        Sort toSort() {
            List<Sort.Order> orders = fields.stream()
                    .map(field -> new Sort.Order(direction, field))
                    .collect(Collectors.toList());
            orders.add(Sort.Order.asc("id"));
            return Sort.by(orders);
        }
    }
}
