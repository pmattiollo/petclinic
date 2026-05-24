package petclinic.mcp;

import java.util.List;
import java.util.stream.Collectors;

import org.springaicommunity.mcp.annotation.McpResource;
import org.springframework.stereotype.Component;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.repository.OwnerRepository;

@Component
public class OwnerMcpResource {

    private final OwnerRepository ownerRepository;

    public OwnerMcpResource(OwnerRepository ownerRepository) {
        this.ownerRepository = ownerRepository;
    }

    @McpResource(
        uri = "me://profile",
        name = "me_profile",
        description = "The authenticated owner's profile: name, address, phone, and pets."
    )
    public String me() {
        int ownerId = McpSecurity.currentOwnerId();
        Owner owner = ownerRepository.findByIdFetchingPets(ownerId)
            .orElseThrow(() -> new IllegalStateException("No owner with id=" + ownerId));

        List<Pet> pets = owner.getPets();
        String petLines = pets.stream().map(this::formatPet).collect(Collectors.joining("\n"));

        return """
            # %s %s
            - Address: %s, %s
            - Phone: %s

            ## Pets (%d)
            %s
            """.formatted(
                owner.getFirstName(), owner.getLastName(),
                owner.getAddress(), owner.getCity(),
                owner.getTelephone(),
                pets.size(),
                petLines);
    }

    private String formatPet(Pet pet) {
        String type = pet.getType() == null ? "?" : pet.getType().getName();
        return "- id=%d — %s (%s), born %s".formatted(pet.getId(), pet.getName(), type, pet.getBirthDate());
    }
}
