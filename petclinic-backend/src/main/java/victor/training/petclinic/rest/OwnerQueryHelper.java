package victor.training.petclinic.rest;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import victor.training.petclinic.rest.error.InvalidOwnerQueryException;

import java.util.Set;

/** Builds a validated {@link Pageable} for the owners listing (page/size/sort whitelist, D8/D13/D15). */
public class OwnerQueryHelper {
    private static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);

    public static Pageable toPageable(int page, int size, String sort) {
        if (page < 0) {
            throw new InvalidOwnerQueryException("page must be >= 0");
        }
        if (!ALLOWED_SIZES.contains(size)) {
            throw new InvalidOwnerQueryException("size must be one of " + ALLOWED_SIZES);
        }
        return PageRequest.of(page, size, toSort(sort));
    }

    private static Sort toSort(String sort) {
        String[] parts = sort.split(",", -1);
        if (parts.length != 2) {
            throw new InvalidOwnerQueryException("sort must be of the form '<col>,<dir>'");
        }
        Sort.Direction direction = toDirection(parts[1]);
        return switch (parts[0]) {
            case "name" -> Sort.by(direction, "lastName")
                    .and(Sort.by(Sort.Direction.ASC, "firstName", "id"));
            case "city" -> Sort.by(direction, "city")
                    .and(Sort.by(Sort.Direction.ASC, "lastName", "firstName", "id"));
            default -> throw new InvalidOwnerQueryException("sort column must be one of: name, city");
        };
    }

    private static Sort.Direction toDirection(String dir) {
        if ("asc".equals(dir)) {
            return Sort.Direction.ASC;
        }
        if ("desc".equals(dir)) {
            return Sort.Direction.DESC;
        }
        throw new InvalidOwnerQueryException("sort direction must be one of: asc, desc");
    }
}
