package victor.training.petclinic.functional;

import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import io.restassured.RestAssured;
import io.restassured.http.ContentType;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class OwnerSteps {

    @Autowired
    private HttpContext http;

    @Autowired
    private JdbcTemplate jdbc;

    @When("I register an owner with first name {string}, last name {string}, address {string}, city {string}, telephone {string}")
    public void iRegisterAnOwner(String firstName, String lastName, String address, String city, String telephone) {
        String body = """
                {"firstName":"%s","lastName":"%s","address":"%s","city":"%s","telephone":"%s"}
                """.formatted(firstName, lastName, address, city, telephone);

        http.setLastResponse(RestAssured.given()
                .baseUri(http.baseUri())
                .contentType(ContentType.JSON)
                .body(body)
                .post("/api/owners"));
    }

    @When("I POST to {string} the JSON:")
    public void iPostJson(String path, String body) {
        http.setLastResponse(RestAssured.given()
                .baseUri(http.baseUri())
                .contentType(ContentType.JSON)
                .body(body)
                .post(path));
    }

    @Then("the owner is searchable by last name {string}")
    public void theOwnerIsSearchableByLastName(String lastName) {
        var response = RestAssured.given()
                .baseUri(http.baseUri())
                .get("/api/owners?lastName=" + lastName);
        assertThat(response.statusCode()).isEqualTo(200);
        List<String> lastNames = response.jsonPath().getList("content.lastName", String.class);
        assertThat(lastNames).contains(lastName);
    }

    @Given("the following owners exist:")
    public void theFollowingOwnersExist(DataTable table) {
        for (Map<String, String> row : table.asMaps()) {
            jdbc.update(
                    "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?, ?, ?, ?, ?)",
                    row.get("firstName"), row.get("lastName"), "addr", row.getOrDefault("city", "city"), "0000000000");
        }
    }

    @Given("{int} owners exist with distinct last names")
    public void nOwnersExistWithDistinctLastNames(int count) {
        for (int i = 1; i <= count; i++) {
            jdbc.update(
                    "INSERT INTO owners (first_name, last_name, address, city, telephone) VALUES (?, ?, 'addr', ?, '0000000000')",
                    "First" + i, String.format("Zz%03d", i), "City" + (i % 3));
        }
    }

    @Then("the response content array has size {int}")
    public void theResponseContentArrayHasSize(int expected) {
        assertThat(http.getLastResponse().jsonPath().getList("content").size()).isEqualTo(expected);
    }

    @Then("the response has totalElements {int}")
    public void theResponseHasTotalElements(int expected) {
        assertThat(http.getLastResponse().jsonPath().getLong("totalElements")).isEqualTo((long) expected);
    }

    @Then("the response has totalPages {int}")
    public void theResponseHasTotalPages(int expected) {
        assertThat(http.getLastResponse().jsonPath().getInt("totalPages")).isEqualTo(expected);
    }

    @Then("the content is sorted by {string} ascending")
    public void theContentIsSortedByFieldAscending(String field) {
        assertThat(contentFieldValues(field)).isSorted();
    }

    @Then("the content is sorted by {string} descending")
    public void theContentIsSortedByFieldDescending(String field) {
        assertThat(contentFieldValues(field)).isSortedAccordingTo(Comparator.reverseOrder());
    }

    private List<String> contentFieldValues(String field) {
        List<String> values = http.getLastResponse().jsonPath().getList("content." + field, String.class);
        assertThat(values).as("content." + field).isNotEmpty().doesNotContainNull();
        return values;
    }

    @Then("the response body contains {string}")
    public void theResponseBodyContains(String text) {
        assertThat(http.getLastResponse().getBody().asString()).contains(text);
    }

    @Then("paging through all owners with size {int} sorted by {string} visits each owner exactly once")
    public void pagingThroughAllOwnersVisitsEachOwnerExactlyOnce(int size, String sort) {
        long totalOwners = jdbc.queryForObject("SELECT COUNT(*) FROM owners", Long.class);
        List<Integer> visitedIds = new ArrayList<>();
        int page = 0;
        int totalPages;
        do {
            var response = RestAssured.given()
                    .baseUri(http.baseUri())
                    .queryParam("sort", sort)
                    .queryParam("size", size)
                    .queryParam("page", page)
                    .get("/api/owners");
            assertThat(response.statusCode()).isEqualTo(200);
            visitedIds.addAll(response.jsonPath().getList("content.id", Integer.class));
            totalPages = response.jsonPath().getInt("totalPages");
            page++;
        } while (page < totalPages);

        assertThat(visitedIds).hasSize((int) totalOwners);
        assertThat(visitedIds).doesNotHaveDuplicates();
    }

    @Then("the response JSON array has size {int}")
    public void theResponseJsonArrayHasSize(int expected) {
        assertThat(http.getLastResponse().jsonPath().getList("content").size()).isEqualTo(expected);
    }

    @Then("every item in the response has {string} equal to {string}")
    public void everyItemInTheResponseHasFieldEqualTo(String field, String value) {
        List<String> values = http.getLastResponse().jsonPath().getList("content." + field, String.class);
        assertThat(values).isNotEmpty();
        assertThat(values).allMatch(v -> v.equals(value));
    }

    @Given("an owner {string} with a {string} pet named {string} born on {string}")
    public void anOwnerWithAPet(String fullName, String typeName, String petName, String birthDate) {
        String[] parts = fullName.split(" ", 2);
        Integer ownerId = jdbc.queryForObject(
                "INSERT INTO owners (first_name, last_name, address, city, telephone)" +
                        " VALUES (?, ?, 'addr', 'city', '0000000000') RETURNING id",
                Integer.class, parts[0], parts[1]);
        Integer typeId = jdbc.queryForObject(
                "SELECT id FROM types WHERE name = ?", Integer.class, typeName);
        jdbc.update(
                "INSERT INTO pets (name, birth_date, type_id, owner_id) VALUES (?, ?, ?, ?)",
                petName, LocalDate.parse(birthDate), typeId, ownerId);
        http.rememberId("owner:" + fullName, ownerId);
    }

    @When("I fetch the owner {string}")
    public void iFetchTheOwner(String fullName) {
        int id = http.idOf("owner:" + fullName);
        http.setLastResponse(RestAssured.given().baseUri(http.baseUri()).get("/api/owners/" + id));
    }

    @Then("the owner has {int} pet(s)")
    public void theOwnerHasNPets(int expected) {
        assertThat(http.getLastResponse().jsonPath().getList("pets").size()).isEqualTo(expected);
    }

    @Then("the pet at index {int} has name {string} and type {string}")
    public void thePetAtIndexHasNameAndType(int index, String name, String type) {
        var jp = http.getLastResponse().jsonPath();
        assertThat(jp.getString("pets[" + index + "].name")).isEqualTo(name);
        assertThat(jp.getString("pets[" + index + "].type.name")).isEqualTo(type);
    }
}
