package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/**
 * Behavioural tests for {@code GET /api/owners} pagination and sorting, per
 * openspec/changes/add-owners-grid-pagination/specs/owner-listing/spec.md.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
class OwnerPagingSortingTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    private OwnerPageDto callList(String query) throws Exception {
        String responseJson = mockMvc.perform(get("/api/owners" + query))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
        return mapper.readValue(responseJson, OwnerPageDto.class);
    }

    private Owner owner(String firstName, String lastName, String city) {
        return ownerRepository.save(TestData.anOwner()
            .setFirstName(firstName)
            .setLastName(lastName)
            .setCity(city));
    }

    @Test
    void cityDesc_keepsNameAscending() throws Exception {
        // Shared "Boston_" prefix isolates these three from the pre-existing seed data via
        // lastName filtering, regardless of how many other owners already exist in the DB.
        owner("Zack", "Boston_Zamfir", "Boston");
        owner("Amy", "Boston_Adams", "Boston");
        owner("Amy", "Boston_Zack", "Boston");

        for (String direction : List.of("asc", "desc")) {
            OwnerPageDto page = callList("?lastName=Boston_&size=20&sort=city," + direction);
            List<String> lastNames = page.getContent().stream().map(OwnerDto::getLastName).toList();

            assertThat(lastNames).containsExactly("Boston_Adams", "Boston_Zack", "Boston_Zamfir");
        }
    }

    @Test
    void pagination_defaultPageAndSize() throws Exception {
        for (int i = 0; i < 15; i++) {
            owner("First" + i, "Last" + i, "City");
        }

        OwnerPageDto page = callList("");

        assertThat(page.getNumber()).isEqualTo(0);
        assertThat(page.getSize()).isEqualTo(10);
        assertThat(page.getContent()).hasSize(10);
    }

    @Test
    void pagination_explicitPageAndSize() throws Exception {
        for (int i = 0; i < 15; i++) {
            owner("First" + i, "Last" + i, "City");
        }

        OwnerPageDto page = callList("?page=1&size=5");

        assertThat(page.getNumber()).isEqualTo(1);
        assertThat(page.getSize()).isEqualTo(5);
        assertThat(page.getContent()).hasSize(5);
    }

    @Test
    void pagination_pastTheEnd_returnsEmptyContentWithCorrectTotal() throws Exception {
        long before = ownerRepository.count();
        owner("First", "Last", "City");

        OwnerPageDto page = callList("?page=999&size=10");

        assertThat(page.getContent()).isEmpty();
        assertThat(page.getTotalElements()).isEqualTo(before + 1);
    }

    @Test
    void pagination_unsupportedSize_fallsBackToTen() throws Exception {
        OwnerPageDto page = callList("?size=7");

        assertThat(page.getSize()).isEqualTo(10);
    }

    @Test
    void everyPage_endsWithIdTiebreaker_andWalkingAllPagesYieldsEachOwnerOnce() throws Exception {
        // Same last name and city for every seeded owner so lastName/firstName/city alone cannot
        // fully order them - only the trailing `id` tiebreaker can guarantee a stable, complete walk.
        Set<Integer> seededIds = new LinkedHashSet<>();
        for (int i = 0; i < 12; i++) {
            seededIds.add(owner("Same", "Same", "Same").getId());
        }

        Set<Integer> seenIds = new LinkedHashSet<>();
        int page = 0;
        while (true) {
            OwnerPageDto pageDto = callList("?lastName=Same&size=5&page=" + page);
            if (pageDto.getContent().isEmpty()) {
                break;
            }
            for (OwnerDto dto : pageDto.getContent()) {
                assertThat(seenIds.add(dto.getId())).as("owner %s must appear exactly once", dto.getId()).isTrue();
            }
            page++;
        }

        assertThat(seenIds).containsAll(seededIds);
    }

    @Test
    void icuOrdering_ordersAccentedNamesLikeAPhoneBook() throws Exception {
        List<String> names = List.of("Zamfir", "Ångström", "Adams", "van Gogh", "Öztürk", "de Vries", "Émile");
        for (String name : names) {
            owner("First", name, "City");
        }

        // Walk every page (size is capped to 5/10/20) rather than assuming everything fits in one
        // page, since the seed data coexists with these owners under the shared `name,asc` sort.
        List<String> ordered = new java.util.ArrayList<>();
        for (int page = 0; ordered.size() < names.size(); page++) {
            OwnerPageDto pageDto = callList("?lastName=&size=20&sort=name,asc&page=" + page);
            if (pageDto.getContent().isEmpty()) {
                break;
            }
            pageDto.getContent().stream()
                .map(OwnerDto::getLastName)
                .filter(names::contains)
                .forEach(ordered::add);
        }

        assertThat(ordered).containsExactly("Adams", "Ångström", "de Vries", "Émile", "Öztürk", "van Gogh", "Zamfir");
    }

    @Test
    void nameSearch_combinesWithPagination() throws Exception {
        owner("A", "Matching1", "City");
        owner("B", "Matching2", "City");
        owner("C", "NotMatching", "City");

        OwnerPageDto page = callList("?lastName=Matching&size=10");

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent()).extracting(OwnerDto::getLastName)
            .containsExactlyInAnyOrder("Matching1", "Matching2");
    }
}
