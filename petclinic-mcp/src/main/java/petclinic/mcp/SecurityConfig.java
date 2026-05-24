package petclinic.mcp;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.NoOpPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain mcpHttpBasicChain(HttpSecurity http) throws Exception {
        return http
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(auth -> auth.anyRequest().authenticated())
            .httpBasic(httpBasic -> {})
            .build();
    }

    @Bean
    UserDetailsService users(
        @Value("${petclinic.mcp.user:mcp}") String username,
        @Value("${petclinic.mcp.password:s3cret}") String password) {
        UserDetails user = User.withUsername(username)
            .password(password)
            .roles("MCP")
            .build();
        return new InMemoryUserDetailsManager(user);
    }

    @Bean
    @SuppressWarnings("deprecation")
    PasswordEncoder passwordEncoder() {
        // Didactic only — plaintext password matcher. Do NOT use in production.
        return NoOpPasswordEncoder.getInstance();
    }
}
