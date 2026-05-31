package com.tribo.api.iam;

/**
 * Request body for POST /auth/login.
 * Mutable POJO for Jackson deserialization (same pattern as RegisterRequest).
 */
public class LoginRequest {
    public String email;
    public String password;
}