package victor.training.petclinic.chatbot;

import io.modelcontextprotocol.client.McpClient;
import io.modelcontextprotocol.client.McpSyncClient;
import io.modelcontextprotocol.client.transport.HttpClientSseClientTransport;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Wires the MCP <b>client</b> that calls the remote petclinic MCP server (the backend) for its tools.
 * One shared connection, authenticated service-to-service by a static API key; the per-USER identity
 * (the browser JWT) is propagated per request (see {@link BearerTokenContext}).
 */
@Configuration
class RemoteToolsConfig {

  @Bean
  McpSyncClient petclinicMcpClient(
      @Value("${petclinic.chatbot.mcp.url}") String url,
      @Value("${petclinic.chatbot.mcp.api-key}") String apiKey) {
    var transport = HttpClientSseClientTransport.builder(url)
        .sseEndpoint("/mcp")
        .customizeRequest(rb -> {
          // Static SERVICE credential: authenticates THIS chatbot to the MCP server (on every request,
          // including the startup handshake — which is why fail-fast still works).
          rb.header("X-API-Key", apiKey);
          // Per-request USER identity: the browser's JWT for the in-flight chat, propagated so the
          // backend resolves the right owner from its sub. Absent on the startup handshake.
          String userToken = BearerTokenContext.get();
          if (userToken != null) {
            rb.header("Authorization", "Bearer " + userToken);
          }
        })
        .build();
    var client = McpClient.sync(transport).build();
    // Fail fast: the chatbot is useless without its tools, so refuse to start if the backend is down.
    try {
      client.initialize();
    } catch (Exception e) {
      throw new RuntimeException(
          "The petclinic MCP server at " + url + " is unreachable — start the backend first.", e);
    }
    return client;
  }
}
