package victor.training.petclinic.repository;

import org.springframework.data.repository.Repository;
import victor.training.petclinic.domain.User;

import java.util.Optional;

public interface UserRepository extends Repository<User, Integer> {
    User save(User user);

    Optional<User> findByUsername(String username);
}
