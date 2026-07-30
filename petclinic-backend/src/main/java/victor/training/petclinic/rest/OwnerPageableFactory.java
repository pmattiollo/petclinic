package victor.training.petclinic.rest;

import java.util.Set;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/**
 * Turns the client-facing {@code page}, {@code size} and {@code sort} query parameters into a
 * {@link Pageable}, without ever binding {@code Pageable} from the request directly — that would
 * let a client name any property path in the entity graph (e.g. {@code pets.visits.description})
 * and steer arbitrary joins through a query parameter.
 *
 * <p>Only {@code name} and {@code city} are recognised as sort keys; anything else (unknown,
 * malformed, or a nested path) silently falls back to the default sort. Sorting by {@code city}
 * keeps the name ascending regardless of the requested city direction — see design.md.
 */
@Component
public class OwnerPageableFactory {

    private static final Set<Integer> ALLOWED_SIZES = Set.of(5, 10, 20);
    private static final int DEFAULT_SIZE = 10;

    private static final Sort NAME_ASC = Sort.by(
        Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    private static final Sort NAME_DESC = Sort.by(
        Sort.Order.desc("lastName"), Sort.Order.desc("firstName"), Sort.Order.desc("id"));
    private static final Sort CITY_ASC = Sort.by(
        Sort.Order.asc("city"), Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));
    private static final Sort CITY_DESC = Sort.by(
        Sort.Order.desc("city"), Sort.Order.asc("lastName"), Sort.Order.asc("firstName"), Sort.Order.asc("id"));

    public Pageable toPageable(int page, int size, String sort) {
        int clampedPage = Math.max(page, 0);
        int clampedSize = ALLOWED_SIZES.contains(size) ? size : DEFAULT_SIZE;
        return PageRequest.of(clampedPage, clampedSize, resolveSort(sort));
    }

    private Sort resolveSort(String sort) {
        if (sort == null) {
            return NAME_ASC;
        }
        String[] parts = sort.split(",", 2);
        String key = parts[0];
        boolean desc = parts.length > 1 && "desc".equalsIgnoreCase(parts[1]);
        if ("name".equals(key)) {
            return desc ? NAME_DESC : NAME_ASC;
        }
        if ("city".equals(key)) {
            return desc ? CITY_DESC : CITY_ASC;
        }
        return NAME_ASC;
    }
}
