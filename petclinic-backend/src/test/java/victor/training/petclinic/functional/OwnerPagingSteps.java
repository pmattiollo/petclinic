package victor.training.petclinic.functional;

import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class OwnerPagingSteps {

    @Autowired
    private HttpContext http;

    private final List<Integer> idsSeenWhileWalking = new ArrayList<>();

    @Then("the page reports number {int}, size {int} and totalElements {int}")
    public void thePageReports(int number, int size, int totalElements) {
        var page = http.getLastResponse().jsonPath();
        assertThat(page.getInt("number")).isEqualTo(number);
        assertThat(page.getInt("size")).isEqualTo(size);
        assertThat(page.getInt("totalElements")).isEqualTo(totalElements);
    }

    @Then("the owners in the response are, in order:")
    public void theOwnersInTheResponseAreInOrder(DataTable table) {
        assertThat(namesInResponse()).containsExactlyElementsOf(expectedNames(table));
    }

    @Then("the owners in the response appear in this relative order:")
    public void theOwnersAppearInThisRelativeOrder(DataTable table) {
        List<String> expectedLastNames = table.asList();
        List<String> actualLastNames = http.getLastResponse().jsonPath().getList("content.lastName", String.class);
        assertThat(actualLastNames).containsSubsequence(expectedLastNames);
    }

    @When("I read every page of size {int} from {string}")
    public void iReadEveryPageOfSize(int size, String path) {
        idsSeenWhileWalking.clear();
        String separator = path.contains("?") ? "&" : "?";
        int totalPages;
        int page = 0;
        do {
            var response = RestAssured.given()
                .baseUri(http.baseUri())
                .get(path + separator + "page=" + page + "&size=" + size);
            assertThat(response.statusCode()).isEqualTo(200);
            idsSeenWhileWalking.addAll(response.jsonPath().getList("content.id", Integer.class));
            totalPages = response.jsonPath().getInt("totalPages");
            http.setLastResponse(response);
            page++;
        } while (page < totalPages);
    }

    @Then("each owner appears exactly once, {int} in total")
    public void eachOwnerAppearsExactlyOnce(int expectedCount) {
        assertThat(idsSeenWhileWalking).hasSize(expectedCount);
        assertThat(idsSeenWhileWalking).doesNotHaveDuplicates();
    }

    private List<String> namesInResponse() {
        var page = http.getLastResponse().jsonPath();
        List<String> lastNames = page.getList("content.lastName", String.class);
        List<String> firstNames = page.getList("content.firstName", String.class);
        List<String> names = new ArrayList<>();
        for (int i = 0; i < lastNames.size(); i++) {
            names.add(lastNames.get(i) + ", " + firstNames.get(i));
        }
        return names;
    }

    private List<String> expectedNames(DataTable table) {
        List<String> names = new ArrayList<>();
        for (Map<String, String> row : table.asMaps()) {
            names.add(row.get("lastName") + ", " + row.get("firstName"));
        }
        return names;
    }
}
