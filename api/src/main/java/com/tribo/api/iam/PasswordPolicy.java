package com.tribo.api.iam;

import java.util.ArrayList;
import java.util.List;

/**
 * Configurable password rules. Persisted in Datastore (see
 * {@link PasswordPolicyRepository}) rather than hardcoded, so a SYSADMIN can
 * tighten/loosen them without a redeploy.
 */
public record PasswordPolicy(
        int minLength,
        boolean requireUppercase,
        boolean requireLowercase,
        boolean requireDigit,
        boolean requireSpecial) {

    /** Sensible defaults applied when no policy has been saved yet. */
    public static PasswordPolicy defaults() {
        return new PasswordPolicy(8, false, true, true, false);
    }

    /**
     * @return null if {@code password} satisfies the policy, otherwise a
     *         human-readable message explaining the first unmet requirement.
     */
    public String validate(String password) {
        if (password == null || password.length() < minLength) {
            return "Password must be at least " + minLength + " characters.";
        }
        if (requireUppercase && !password.chars().anyMatch(Character::isUpperCase)) {
            return "Password must contain an uppercase letter.";
        }
        if (requireLowercase && !password.chars().anyMatch(Character::isLowerCase)) {
            return "Password must contain a lowercase letter.";
        }
        if (requireDigit && !password.chars().anyMatch(Character::isDigit)) {
            return "Password must contain a digit.";
        }
        if (requireSpecial && password.chars().allMatch(Character::isLetterOrDigit)) {
            return "Password must contain a special character.";
        }
        return null;
    }

    /** Short human-readable list of the active rules (for UI hints). */
    public List<String> describe() {
        List<String> rules = new ArrayList<>();
        rules.add("At least " + minLength + " characters");
        if (requireUppercase)
            rules.add("An uppercase letter");
        if (requireLowercase)
            rules.add("A lowercase letter");
        if (requireDigit)
            rules.add("A digit");
        if (requireSpecial)
            rules.add("A special character");
        return rules;
    }
}
