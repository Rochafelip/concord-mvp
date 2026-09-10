package com.concordmvp.users;

import com.concordmvp.common.exception.BadRequestException;
import com.concordmvp.common.exception.ResourceNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
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

    public User updateProfile(UUID userId, String username, String displayName) {
        User user = getCurrentUser(userId);
        user.setUsername(username);
        user.setDisplayName(displayName);
        return userRepository.save(user);
    }

    public User changePassword(UUID userId, String currentPassword, String newPassword) {
        User user = getCurrentUser(userId);
        if (!passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new BadRequestException("Senha atual incorreta");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        return userRepository.save(user);
    }
}
