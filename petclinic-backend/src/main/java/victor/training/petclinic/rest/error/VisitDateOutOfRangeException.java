package victor.training.petclinic.rest.error;

public class VisitDateOutOfRangeException extends RuntimeException {
    public VisitDateOutOfRangeException(String message) {
        super(message);
    }
}
