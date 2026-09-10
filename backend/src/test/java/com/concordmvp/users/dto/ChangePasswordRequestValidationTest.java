package com.concordmvp.users.dto;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Changing a password has to enforce exactly the rules registration enforces. When it doesn't,
 * the settings screen becomes a way around the policy: register with a compliant password, then
 * immediately change it to a weak one.
 */
class ChangePasswordRequestValidationTest {

    private static ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUpValidator() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDownValidator() {
        factory.close();
    }

    private static ChangePasswordRequest withNewPassword(String newPassword) {
        return new ChangePasswordRequest("CurrentPass1", newPassword);
    }

    @Test
    void accepts_newPasswordMeetingEveryRule() {
        assertThat(validator.validate(withNewPassword("Password123"))).isEmpty();
    }

    @ParameterizedTest(name = "rejects new password {1}: {0}")
    @CsvSource({
            "Pass0rd,        'shorter than 8 characters'",
            "password123,    'without an uppercase letter'",
            "PASSWORD123,    'without a lowercase letter'",
            "PasswordOnly,   'without a number'"
    })
    void rejects_newPasswordMissingARule(String newPassword, String reason) {
        assertThat(validator.validate(withNewPassword(newPassword)))
                .as("expected a violation for a new password %s", reason)
                .isNotEmpty();
    }

    @Test
    void rejects_newPasswordLongerThanTheMaximum() {
        assertThat(validator.validate(withNewPassword("Aa1" + "x".repeat(98)))).isNotEmpty();
    }

    @Test
    void rejects_blankCurrentPassword() {
        assertThat(validator.validate(new ChangePasswordRequest("", "Password123"))).isNotEmpty();
    }
}
