package victor.training.petclinic.rest.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.Valid;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * Hand-written page envelope for {@code GET /api/owners}, kept independent of Spring Data's
 * {@code Page} serialization so the public contract stays stable across Spring versions.
 */
@Data
public class OwnerPageDto {

    @Valid
    @Schema(description = "The owners on the current page.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(example = "42", description = "The total number of owners matching the filter, across all pages.")
    private long totalElements;

    @Schema(example = "5", description = "The total number of pages.")
    private int totalPages;

    @Schema(example = "0", description = "The 0-based index of the current page.")
    private int number;

    @Schema(example = "10", description = "The number of owners per page.")
    private int size;
}
