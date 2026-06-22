package com.tribo.api.iam;

/**
 * Request body for POST /auth/register.
 *
 * Mutable POJO (not a record) because Jackson deserializes JSON into it via
 * setters / field access, and a no-arg constructor is the least fragile shape
 * for that across Jersey + Jackson versions.
 *
 * `role` is self-selected (D-1) but CONSTRAINED server-side: only END_USER
 * (default), ACTIVITY_MANAGER, and PARTNER may be requested. Requesting a
 * privileged role (BACKOFFICE/SYSADMIN) is rejected — honoring it would be a
 * privilege-escalation hole. Self-selected ACTIVITY_MANAGER/PARTNER accounts
 * are created UNVERIFIED and can't act until a backoffice verifies them.
 *
 * `profileVisibility` remains server-controlled (always PUBLIC for now).
 */
public class RegisterRequest {
    public String email;
    public String password;
    public String fullName;
    public String phoneNumber;
    public Integer age;   // boxed so a missing value is null (→ 400) rather than silently 0
    public String role;   // optional; null/blank → END_USER. See class doc for constraints.
}