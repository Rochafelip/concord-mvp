package com.concordmvp.users;

import com.concordmvp.common.exception.ResourceNotFoundException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Looks up the currently authenticated user by id. Not expected to fail in practice since
     * the id comes from a validated JWT issued for a real user, but we defend against it anyway
     * (e.g. the user was deleted after the token was issued).
     */
    public User getCurrentUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }
}
