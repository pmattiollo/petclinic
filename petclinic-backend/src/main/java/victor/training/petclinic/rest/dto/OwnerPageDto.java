package victor.training.petclinic.rest.dto;

import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * One page of owners.
 * <p>
 * Hand-written rather than returning Spring's {@code Page}, whose serialized form is unstable and leaks framework
 * internals into the published API and the generated frontend types.
 */
public record OwnerPageDto(

        @Schema(description = "The owners on this page.") List<OwnerDto> content,

        @Schema(example = "28", description = "Total owners matching the filter, across all pages.") long totalElements,

        @Schema(example = "3", description = "Total number of pages.") int totalPages,

        @Schema(example = "0", description = "Zero-based number of this page.") int number,

        @Schema(example = "10", description = "Rows per page.") int size) {
}
