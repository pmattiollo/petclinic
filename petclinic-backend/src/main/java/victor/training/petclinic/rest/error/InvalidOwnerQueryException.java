package victor.training.petclinic.rest.error;

public class InvalidOwnerQueryException extends RuntimeException {
    public InvalidOwnerQueryException(String message) {
        super(message);
    }
}
