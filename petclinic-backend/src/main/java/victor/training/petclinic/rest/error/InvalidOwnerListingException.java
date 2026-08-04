package victor.training.petclinic.rest.error;

/**
 * Thrown when the owners-listing query params (sort, size, page) fail the whitelist/range checks.
 * Handled by {@link ExceptionControllerAdvice} as a 400 Bad Request.
 */
public class InvalidOwnerListingException extends RuntimeException {

    public InvalidOwnerListingException(String message) {
        super(message);
    }
}
