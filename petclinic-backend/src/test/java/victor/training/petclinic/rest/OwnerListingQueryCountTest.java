package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.LocalDate;

import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.PersistenceContext;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.domain.Pet;
import victor.training.petclinic.domain.PetType;
import victor.training.petclinic.domain.Visit;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.repository.PetRepository;
import victor.training.petclinic.repository.PetTypeRepository;
import victor.training.petclinic.repository.VisitRepository;

/**
 * Serving one page of owners must cost a bounded number of queries — see design.md D6.
 * <p>
 * Without batch fetching, rendering a page of 10 owners costs one query for the owners plus one per owner for the
 * pets plus one per pet for the visits. That is invisible on the 28 seeded owners and ruinous on 10,000.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerListingQueryCountTest {

    private static final int PAGE_SIZE = 10;

    /** One page of owners, their pets and their visits: three round trips, plus a little slack for the count query. */
    private static final int MAX_STATEMENTS_PER_PAGE = 6;

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    @Autowired
    PetRepository petRepository;

    @Autowired
    PetTypeRepository petTypeRepository;

    @Autowired
    VisitRepository visitRepository;

    @Autowired
    EntityManagerFactory entityManagerFactory;

    @PersistenceContext
    EntityManager entityManager;

    @Test
    void servingOnePage_costsABoundedNumberOfQueries() throws Exception {
        createOwnersWithAPetAndAVisit("Qcounta", PAGE_SIZE);

        long statements = countStatementsListingOnePage("Qcounta");

        assertThat(statements)
                .describedAs("statements to serve one page of %d owners with pets and visits", PAGE_SIZE)
                .isLessThanOrEqualTo(MAX_STATEMENTS_PER_PAGE);
    }

    @Test
    void queryCount_doesNotGrowWithTheNumberOfOwnersInTheTable() throws Exception {
        createOwnersWithAPetAndAVisit("Qcountb", PAGE_SIZE);
        long onASmallTable = countStatementsListingOnePage("Qcountb");

        createOwnersWithAPetAndAVisit("Qcountc", PAGE_SIZE * 10);
        long onALargerTable = countStatementsListingOnePage("Qcountb");

        assertThat(onALargerTable).isEqualTo(onASmallTable);
    }

    private long countStatementsListingOnePage(String prefix) throws Exception {
        // Without this the owners just created are still managed, so the request needs no queries at all and the
        // measurement is meaningless — the test would pass even with a full N+1.
        entityManager.flush();
        entityManager.clear();

        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        mockMvc.perform(get("/api/owners?lastName=" + prefix + "&size=" + PAGE_SIZE))
                .andExpect(status().isOk());

        return statistics.getPrepareStatementCount();
    }

    private void createOwnersWithAPetAndAVisit(String lastNamePrefix, int howMany) {
        PetType petType = new PetType();
        petType.setName("dog" + lastNamePrefix);
        PetType savedType = petTypeRepository.save(petType);

        for (int i = 0; i < howMany; i++) {
            Owner owner = ownerRepository.save(TestData.anOwner()
                    .setFirstName("Owner" + i)
                    .setLastName(lastNamePrefix + i));

            Pet pet = new Pet();
            pet.setName("Pet" + i);
            pet.setBirthDate(LocalDate.now());
            pet.setOwner(owner);
            pet.setType(savedType);
            Pet savedPet = petRepository.save(pet);

            Visit visit = new Visit();
            visit.setPet(savedPet);
            visit.setDate(LocalDate.now());
            visit.setDescription("checkup");
            visitRepository.save(visit);
        }
    }
}
