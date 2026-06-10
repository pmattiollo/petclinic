package victor.training.petclinic.rest.dto;

import jakarta.validation.constraints.*;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

@Data
public class SpecialtyDto {

    @Min(0)
    @Schema(accessMode = Schema.AccessMode.READ_ONLY, example = "1", description = "The ID of the specialty.", requiredMode = Schema.RequiredMode.REQUIRED)
    private Integer id;

    @NotNull
    @Size(min = 1, max = 80)
    @Schema(example = "radiology", description = "The name of the specialty.")
    private String name;

    @Size(max = 4000)
    @Schema(example = "limping, broken bone, swollen leg, can't bear weight",
        description = "Symptoms this specialty handles; matched against the patient's described symptom.")
    private String description;

    @Size(max = 4000)
    @Schema(example = "Keep the pet calm and restrict movement; avoid food in case sedation is needed.",
        description = "What the owner should do for the pet until the visit.")
    private String preConsultationRecommendations;
}
