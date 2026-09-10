package com.concordmvp.auth;

/**
 * The single definition of what makes a password acceptable, shared by every DTO that takes one
 * (registration, password change, and password reset).
 *
 * These constants exist because the rules were previously duplicated: registration enforced
 * complexity while the password-change endpoint enforced only a minimum length, so the settings
 * screen could be used to set a password registration would have rejected. Anything that accepts
 * a new password must reference these values, so the next rule added lands everywhere at once.
 *
 * The frontend mirrors these rules live as the user types (frontend/src/features/auth/passwordPolicy.ts).
 * Both sides must agree — this is the authoritative one.
 */
public final class PasswordPolicy {

    public static final int MIN_LENGTH = 8;
    public static final int MAX_LENGTH = 100;

    /** Requires at least one uppercase letter, one lowercase letter and one digit. */
    public static final String COMPLEXITY_REGEX = "^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9]).*$";

    public static final String COMPLEXITY_MESSAGE =
            "deve conter uma letra maiúscula, uma letra minúscula e um número";

    private PasswordPolicy() {
    }
}
