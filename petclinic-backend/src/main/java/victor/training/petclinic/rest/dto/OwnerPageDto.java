package victor.training.petclinic.rest.dto;

import java.util.ArrayList;
import java.util.List;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OwnerPageDto {

    @Schema(description = "The owners on this page.")
    private List<OwnerDto> content = new ArrayList<>();

    @Schema(description = "Total number of owners matching the filter, across all pages.", example = "28")
    private long totalElements;

    @Schema(description = "Total number of pages.", example = "3")
    private int totalPages;

    @Schema(description = "The current page number, zero-based.", example = "0")
    private int number;

    @Schema(description = "The page size used to produce this page.", example = "10")
    private int size;
}
