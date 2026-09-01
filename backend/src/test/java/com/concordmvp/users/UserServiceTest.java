package com.concordmvp.users;

import com.concordmvp.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Test
    void getCurrentUser_returnsUser_whenFound() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setUsername("alice");

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        UserService userService = new UserService(userRepository);
        User result = userService.getCurrentUser(userId);

        assertThat(result).isSameAs(user);
    }

    @Test
    void getCurrentUser_throwsResourceNotFound_whenMissing() {
        UUID userId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        UserService userService = new UserService(userRepository);

        assertThatThrownBy(() -> userService.getCurrentUser(userId))
                .isInstanceOf(ResourceNotFoundException.class);
    }
}
