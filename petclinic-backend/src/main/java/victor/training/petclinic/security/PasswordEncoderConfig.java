package victor.training.petclinic.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

/**
 * Provides the {@link PasswordEncoder} bean unconditionally, regardless of whether
 * {@code petclinic.security.enable} is set. User passwords must always be encoded before
 * persisting, even when HTTP request authentication is disabled.
 */
@Configuration
public class PasswordEncoderConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
