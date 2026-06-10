package victor.training.petclinic.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "specialties")
@Getter
@Setter
public class Specialty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    protected Integer id;

    private String name;

    /** Symptoms this specialty handles. Matched (vectorized) against the patient's description. */
    private String description;

    /** What the owner should do until the visit. Shown as guidance, never vectorized. */
    private String preConsultationRecommendations;

}
