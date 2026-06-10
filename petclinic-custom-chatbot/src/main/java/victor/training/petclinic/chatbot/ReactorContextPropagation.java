package victor.training.petclinic.chatbot;

import io.micrometer.context.ContextRegistry;
import jakarta.annotation.PostConstruct;
import org.springframework.context.annotation.Configuration;
import reactor.core.publisher.Hooks;

/**
 * Bridges the per-request user token across Reactor's worker threads. The chat pipeline hops between
 * {@code boundedElastic} threads, and the MCP client's {@code customizeRequest} runs on whichever
 * thread executes a tool call — so a plain ThreadLocal set once does NOT reach it. Here we register
 * {@link BearerTokenContext} as a {@code ThreadLocalAccessor} and turn on automatic context
 * propagation: the controller stashes the token in the Reactor {@code Context} (one
 * {@code contextWrite}), and Reactor restores it into the ThreadLocal on every thread it runs on.
 */
@Configuration
class ReactorContextPropagation {

  /** Reactor Context key under which the controller stashes the current user's Bearer token. */
  static final String OWNER_BEARER = "owner-bearer-token";

  @PostConstruct
  void enable() {
    Hooks.enableAutomaticContextPropagation();
    ContextRegistry.getInstance().registerThreadLocalAccessor(
        OWNER_BEARER, BearerTokenContext::get, BearerTokenContext::set, BearerTokenContext::clear);
  }
}
