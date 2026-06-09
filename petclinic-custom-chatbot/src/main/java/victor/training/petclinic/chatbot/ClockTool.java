package victor.training.petclinic.chatbot;

import java.time.LocalDateTime;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.stereotype.Component;

/**
 * Local tool that gives the assistant the REAL current date-time, so relative times like
 * "now", "in 1 hour" or "tomorrow" resolve reliably instead of being guessed by the model.
 */
@Component
class ClockTool {

  @Tool(description = "Returns the current local date and time (ISO-8601, e.g. 2026-06-09T23:33). "
      + "Call it to resolve relative times like 'now', 'in 1 hour' or 'tomorrow' — never guess the time.")
  String currentDateTime() {
    return LocalDateTime.now().withNano(0).toString();
  }
}
