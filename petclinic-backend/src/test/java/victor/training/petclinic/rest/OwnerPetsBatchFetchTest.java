package victor.training.petclinic.rest;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Verifies D14: {@code @BatchSize(50)} turns N per-owner pets queries into ~ceil(N/50) batched ones. */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
class OwnerPetsBatchFetchTest {

    private static final int OWNER_COUNT = 15;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void seedOwnersWithPets() {
        PetType dog = petTypeRepository.save(new PetType().setName("dog"));
        for (int i = 0; i < OWNER_COUNT; i++) {
            Owner owner = ownerRepository.save(TestData.anOwner().setLastName("Batch" + i));
            Pet pet = new Pet().setName("Pet" + i).setBirthDate(LocalDate.now()).setType(dog);
            pet.setOwner(owner);
            petRepository.save(pet);
        }
    }

    @Test
    void onePageOfOwners_batchesPetsFetchInsteadOfOnePerOwner() throws Exception {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?size=20&sort=name,asc"))
                .andExpect(status().isOk());

        long petsCollectionFetchCount = statistics
                .getCollectionStatistics("victor.training.petclinic.domain.Owner.pets")
                .getFetchCount();
        assertThat(petsCollectionFetchCount)
                .as("pets collection should be loaded in ~ceil(N/50) batched queries, not one per owner")
                .isLessThanOrEqualTo(3);
    }
}
