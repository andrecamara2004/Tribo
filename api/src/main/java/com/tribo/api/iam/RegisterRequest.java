package com.tribo.api.iam;

/**
 * Request body for POST /auth/register.
 *
 * Mutable POJO (not a record) because Jackson deserializes JSON into it via
 * setters / field access, and a no-arg constructor is the least fragile shape
 * for that across Jersey + Jackson versions.
 *
 * Deliberately omits `role` and `profileVisibility`: both are server-controlled.
 * A public endpoint that honored a client-supplied role would be a
 * privilege-escalation hole, so role is hardcoded to END_USER in the resource.
 */
public class RegisterRequest {
    public String email;
    public String password;
    public String fullName;
    public String phoneNumber;
    public Integer age;   // boxed so a missing value is null (→ 400) rather than silently 0
}