package com.concordmvp.auth.dto;

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
 * The register form shows the password rules live while the user types, so the server has to
 * enforce the same rules — otherwise other clients could create accounts the UI would reject.
 */
class RegisterRequestValidationTest {

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

    private static RegisterRequest withPassword(String password) {
        return new RegisterRequest("alice", "Alice", "alice@example.com", password);
    }

    @Test
    void accepts_passwordMeetingEveryRule() {
        assertThat(validator.validate(withPassword("Password123"))).isEmpty();
    }

    @ParameterizedTest(name = "rejects password {1}: {0}")
    @CsvSource({
            "Pass0rd,        'shorter than 8 characters'",
            "password123,    'without an uppercase letter'",
            "PASSWORD123,    'without a lowercase letter'",
            "PasswordOnly,   'without a number'"
    })
    void rejects_passwordMissingARule(String password, String reason) {
        assertThat(validator.validate(withPassword(password)))
                .as("expected a violation for a password %s", reason)
                .isNotEmpty();
    }

    @Test
    void rejects_passwordLongerThanTheMaximum() {
        String tooLong = "Aa1" + "x".repeat(98);

        assertThat(validator.validate(withPassword(tooLong))).isNotEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "not-an-email",
            "missing-at.example.com",
            "user@"
    })
    void rejects_invalidEmailFormat(String email) {
        RegisterRequest request = new RegisterRequest("alice", "Alice", email, "Password123");

        assertThat(validator.validate(request))
                .anyMatch(violation -> violation.getPropertyPath().toString().equals("email"));
    }

    @Test
    void accepts_validEmailFormat() {
        RegisterRequest request = new RegisterRequest("alice", "Alice", "alice@example.com", "Password123");

        assertThat(validator.validate(request))
                .noneMatch(violation -> violation.getPropertyPath().toString().equals("email"));
    }

    @Test
    void reportsViolationsInPortuguese() {
        var violations = validator.validate(withPassword("short"));

        assertThat(violations)
                .extracting(jakarta.validation.ConstraintViolation::getMessage)
                .contains("deve ter entre 8 e 100 caracteres");
    }
}
