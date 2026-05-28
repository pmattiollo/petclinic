package victor.training.petclinic.mcp;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Covers the api-key filter wired by McpSecurity: /sse and /mcp/** require the X-API-Key header.
// Without these, Sonar new-code coverage tanks because the filter chain bean only runs against real HTTP.
@SpringBootTest
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@AutoConfigureMockMvc
class McpHttpSecurityTest {

    @Autowired MockMvc mockMvc;

    @Test
    void sse_withoutApiKey_isForbidden() throws Exception {
        mockMvc.perform(get("/sse"))
            .andExpect(status().isForbidden());
    }

    @Test
    void mcp_withBadApiKey_isForbidden() throws Exception {
        mockMvc.perform(post("/mcp").header(McpSecurity.API_KEY_HEADER, "not-a-real-key"))
            .andExpect(status().isForbidden());
    }

    @Test
    void mcp_withValidApiKey_passesFilter() throws Exception {
        // Any non-403 status proves the api-key filter authenticated the caller; the MCP endpoint's
        // own response shape (e.g., 400 for empty body) is not the point here.
        mockMvc.perform(post("/mcp").header(McpSecurity.API_KEY_HEADER, "demo-key-1"))
            .andExpect(result -> {
                int status = result.getResponse().getStatus();
                if (status == 403) {
                    throw new AssertionError("Expected api-key auth to pass, got 403");
                }
            });
    }
}
