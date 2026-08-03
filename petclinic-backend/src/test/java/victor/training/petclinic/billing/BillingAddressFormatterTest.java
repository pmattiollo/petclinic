package victor.training.petclinic.billing;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class BillingAddressFormatterTest {

    @Test
    void joins_address_and_city_with_the_city_upper_cased() {
        assertThat(BillingAddressFormatter.format("110 W. Liberty St.", "Madison"))
                .isEqualTo("110 W. Liberty St., MADISON");
    }

    @Test
    void leaves_an_already_upper_cased_city_untouched() {
        assertThat(BillingAddressFormatter.format("638 Cardinal Ave.", "SUN PRAIRIE"))
                .isEqualTo("638 Cardinal Ave., SUN PRAIRIE");
    }
}
