package victor.training.petclinic.rest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import jakarta.transaction.Transactional;
import victor.training.petclinic.domain.Owner;
import victor.training.petclinic.repository.OwnerRepository;
import victor.training.petclinic.rest.dto.OwnerDto;
import victor.training.petclinic.rest.dto.OwnerPageDto;

/**
 * Behaviour of the paginated Owners listing — see openspec/changes/add-owners-pagination.
 * <p>
 * The seeded sample data is shared with every other test, so these tests create their own owners under a last-name
 * prefix nothing else uses and filter by it. Only the "no parameters" test looks at the unfiltered listing.
 */
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "OWNER_ADMIN")
@Transactional
public class OwnerListingTest {

    private static final String PREFIX = "Zsort";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    OwnerRepository ownerRepository;

    ObjectMapper mapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @BeforeEach
    final void createOwnersUnderADedicatedPrefix() {
        // Five share the city London, so a city ordering has a large tie to break.
        saveOwner("Ann", PREFIX + "a", "London");
        saveOwner("Bob", PREFIX + "b", "London");
        saveOwner("Cid", PREFIX + "c", "London");
        saveOwner("Dan", PREFIX + "d", "Athens");
        saveOwner("Eve", PREFIX + "e", "Berlin");
        saveOwner("Fay", PREFIX + "f", "London");
        saveOwner("Gil", PREFIX + "g", "London");
    }

    private void saveOwner(String firstName, String lastName, String city) {
        Owner owner = TestData.anOwner()
                .setFirstName(firstName)
                .setLastName(lastName)
                .setCity(city);
        ownerRepository.save(owner);
    }

    @Test
    void noParameters_returnsFirstPageOfTen() throws Exception {
        OwnerPageDto page = listOwners("/api/owners");

        assertThat(page.number()).isZero();
        assertThat(page.size()).isEqualTo(10);
        assertThat(page.content()).hasSizeLessThanOrEqualTo(10);
        assertThat(page.totalElements()).isEqualTo(ownerRepository.count());
    }

    @Test
    void secondPage_holdsTheNextSlice_andNoOwnerFromTheFirst() throws Exception {
        OwnerPageDto first = listOwners("/api/owners?lastName=" + PREFIX + "&size=5&page=0");
        OwnerPageDto second = listOwners("/api/owners?lastName=" + PREFIX + "&size=5&page=1");

        assertThat(first.content()).hasSize(5);
        assertThat(second.content()).hasSize(2);
        assertThat(second.number()).isEqualTo(1);
        assertThat(idsOf(second)).doesNotContainAnyElementsOf(idsOf(first));
    }

    @Test
    void pageBeyondTheLast_isEmptyButKeepsTheTotals() throws Exception {
        OwnerPageDto page = listOwners("/api/owners?lastName=" + PREFIX + "&size=5&page=99");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isEqualTo(7);
        assertThat(page.totalPages()).isEqualTo(2);
    }

    @Test
    void defaultOrder_isByLastNameThenFirstName() throws Exception {
        OwnerPageDto page = listOwners("/api/owners?lastName=" + PREFIX);

        assertThat(lastNamesOf(page)).isSorted();
        assertThat(lastNamesOf(page)).startsWith(PREFIX + "a", PREFIX + "b", PREFIX + "c");
    }

    @Test
    void orderByCityDescending_thenByLastName() throws Exception {
        OwnerPageDto page = listOwners("/api/owners?lastName=" + PREFIX + "&sort=CITY&direction=DESC");

        assertThat(page.content()).extracting(OwnerDto::getCity)
                .containsExactly("London", "London", "London", "London", "London", "Berlin", "Athens");
        // Reversing the order reverses the whole ordering, tiebreaker included — clicking a header twice must
        // present the exact reverse of the list, not the same city blocks with their contents still ascending.
        assertThat(page.content().subList(0, 5)).extracting(OwnerDto::getLastName)
                .containsExactly(PREFIX + "g", PREFIX + "f", PREFIX + "c", PREFIX + "b", PREFIX + "a");
    }

    @Test
    void pagingOwnersTiedOnCity_returnsEachExactlyOnce() throws Exception {
        OwnerPageDto first = listOwners("/api/owners?lastName=" + PREFIX + "&sort=CITY&size=5&page=0");
        OwnerPageDto second = listOwners("/api/owners?lastName=" + PREFIX + "&sort=CITY&size=5&page=1");

        List<Integer> seen = idsOf(first);
        seen.addAll(idsOf(second));
        assertThat(seen).hasSize(7).doesNotHaveDuplicates();
    }

    @Test
    void repeatingTheSameRequest_returnsTheSameOrder() throws Exception {
        String uri = "/api/owners?lastName=" + PREFIX + "&sort=CITY&size=5&page=0";

        assertThat(idsOf(listOwners(uri))).isEqualTo(idsOf(listOwners(uri)));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "/api/owners?size=7",
            "/api/owners?size=100000",
            "/api/owners?page=-1",
            "/api/owners?sort=TELEPHONE",
            "/api/owners?page=abc"
    })
    void invalidListingParameters_areRejected(String uri) throws Exception {
        mockMvc.perform(get(uri))
                .andExpect(status().isBadRequest());
    }

    @Test
    void filter_narrowsTheTotals() throws Exception {
        OwnerPageDto page = listOwners("/api/owners?lastName=" + PREFIX);

        assertThat(page.totalElements()).isEqualTo(7);
        assertThat(page.totalPages()).isEqualTo(1);
    }

    @Test
    void filterMatchingNothing_isEmptyWithZeroTotals() throws Exception {
        OwnerPageDto page = listOwners("/api/owners?lastName=NoSuchOwner");

        assertThat(page.content()).isEmpty();
        assertThat(page.totalElements()).isZero();
        assertThat(page.totalPages()).isZero();
    }

    private OwnerPageDto listOwners(String uriTemplate) throws Exception {
        String responseJson = mockMvc.perform(get(uriTemplate))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/json"))
                .andReturn()
                .getResponse()
                .getContentAsString();

        return mapper.readValue(responseJson, OwnerPageDto.class);
    }

    private List<Integer> idsOf(OwnerPageDto page) {
        return new ArrayList<>(page.content().stream().map(OwnerDto::getId).toList());
    }

    private List<String> lastNamesOf(OwnerPageDto page) {
        return page.content().stream().map(OwnerDto::getLastName).toList();
    }
}
