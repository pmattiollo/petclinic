package victor.training.petclinic.billing;

/**
 * Formats an owner's address block the way the nightly billing export expects it.
 */
public class BillingAddressFormatter {

    private BillingAddressFormatter() {
    }

    public static String format(String address, String city) {
        return address + ", " + city.toUpperCase();
    }
}
