package victor.training.petclinic.rest;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import victor.training.petclinic.domain.User;
import victor.training.petclinic.repository.UserRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
@WithMockUser(roles = "ADMIN")
@Transactional
public class UserTest {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    ObjectMapper mapper = new ObjectMapper();

    // UserDto#password is @JsonProperty(access = WRITE_ONLY), so it can be deserialized from an
    // incoming request but Jackson will never serialize it back out of a UserDto instance - not even
    // when the *test* itself calls writeValueAsString(userDto) to build a request body. Build request
    // JSON from a plain Map instead so the password field is present in the outgoing request.
    private Map<String, Object> userJson(String username, String password, Boolean enabled, Object roles) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("username", username);
        json.put("password", password);
        json.put("enabled", enabled);
        json.put("roles", roles);
        return json;
    }

    private Map<String, Object> roleJson(String name) {
        Map<String, Object> json = new LinkedHashMap<>();
        json.put("name", name);
        return json;
    }

    @Test
    void create_ok() throws Exception {
        Map<String, Object> newUser = userJson("newuser", "password123", true, List.of(roleJson("OWNER_ADMIN")));

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());
    }

    @Test
    void create_doesNotLeakPasswordInResponse() throws Exception {
        Map<String, Object> newUser = userJson("noleakuser", "password123", true, List.of(roleJson("OWNER_ADMIN")));

        String responseJson = mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(responseJson).doesNotContain("password");
        assertThat(responseJson).doesNotContain("password123");
    }

    @Test
    void create_encodesPasswordWithBCrypt() throws Exception {
        Map<String, Object> newUser = userJson("bcryptuser", "password123", true, List.of(roleJson("OWNER_ADMIN")));

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isCreated());

        User persisted = userRepository.findByUsername("bcryptuser").orElseThrow();
        assertThat(persisted.getPassword()).isNotEqualTo("password123");
        assertThat(passwordEncoder.matches("password123", persisted.getPassword())).isTrue();
    }

    @Test
    void create_invalid() throws Exception {
        // Empty username - validation error
        Map<String, Object> newUser = userJson("", "password123", true, List.of());

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().isBadRequest());
    }

    @Test
    void create_noRoles_triggers_server_error() throws Exception {
        // Send roles as null so the service sees user.getRoles() == null and throws
        Map<String, Object> newUser = userJson("norolesuser", "password123", true, null);

        mockMvc.perform(post("/api/users")
                .content(mapper.writeValueAsString(newUser))
                .contentType(MediaType.APPLICATION_JSON_VALUE))
                .andExpect(status().is5xxServerError());
    }
}
