package victor.training.petclinic.chatbot;

/**
 * Blocking-thread bridge for the current user's raw Bearer JWT. The chatbot talks to the backend MCP
 * server over ONE shared connection authenticated by a static service API key; the per-USER identity
 * rides on each tool-call POST. {@link Assistant} publishes the owner's token here for the duration of
 * the blocking chat pipeline, and the MCP client's {@code customizeRequest} reads it to set this
 * request's {@code Authorization} header — so the backend resolves the right owner from the JWT sub.
 */
final class BearerTokenContext {
  private static final ThreadLocal<String> TOKEN = new ThreadLocal<>();

  static void set(String token) {
    TOKEN.set(token);
  }

  static String get() {
    return TOKEN.get();
  }

  static void clear() {
    TOKEN.remove();
  }

  private BearerTokenContext() {
  }
}
