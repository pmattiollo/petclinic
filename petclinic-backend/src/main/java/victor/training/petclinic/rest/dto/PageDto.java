package victor.training.petclinic.rest.dto;

import java.util.List;

public record PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size) {
}
