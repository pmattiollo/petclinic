package petclinic.mcp;

import java.util.List;

import org.springaicommunity.mcp.annotation.McpResource;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import victor.training.petclinic.model.Owner;
import victor.training.petclinic.model.Pet;
import victor.training.petclinic.repository.OwnerRepository;

@Component
public class MeResource {

    private final OwnerRepository ownerRepository;

    public MeResource(OwnerRepository ownerRepository) {
        this.ownerRepository = ownerRepository;
    }

    @McpResource(
        uri = "me://profile",
        name = "me_profile",
        description = "The authenticated owner's profile: name, address, phone, and pets."
    )
    @Transactional(readOnly = true)
    public String me() {
        String lastName = SecurityContextHolder.getContext().getAuthentication().getName();
        return profileFor(lastName);
    }

    @Transactional(readOnly = true)
    String profileFor(String lastName) {
        Owner owner = ownerRepository.findByLastNameStartingWith(lastName).stream().findFirst()
            .orElseThrow(() -> new IllegalStateException("No owner with lastName starting with '" + lastName + "'"));

        StringBuilder out = new StringBuilder();
        out.append("# ").append(owner.getFirstName()).append(' ').append(owner.getLastName()).append('\n');
        out.append("- Address: ").append(owner.getAddress()).append(", ").append(owner.getCity()).append('\n');
        out.append("- Phone: ").append(owner.getTelephone()).append('\n');

        List<Pet> pets = owner.getPets();
        out.append("\n## Pets (").append(pets.size()).append(")\n");
        for (Pet pet : pets) {
            out.append("- id=").append(pet.getId())
               .append(" — ").append(pet.getName())
               .append(" (").append(pet.getType() == null ? "?" : pet.getType().getName()).append(")")
               .append(", born ").append(pet.getBirthDate())
               .append('\n');
        }
        return out.toString();
    }
}
