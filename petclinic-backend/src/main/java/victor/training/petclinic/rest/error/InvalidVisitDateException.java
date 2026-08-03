package victor.training.petclinic.rest.error;

/**
 * Thrown when a visit date falls outside the allowed range (before the pet was born, or too far ahead).
 * Handled by {@link ExceptionControllerAdvice} as a 400 Bad Request.
 */
public class InvalidVisitDateException extends RuntimeException {

    public InvalidVisitDateException(String message) {
        super(message);
    }
}
