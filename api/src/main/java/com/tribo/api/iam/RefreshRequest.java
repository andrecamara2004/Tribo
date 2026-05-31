package com.tribo.api.iam;

/**
 * Request body for POST /auth/refresh.
 * Carries the refresh token issued at login.
 */
public class RefreshRequest {
    public String refreshToken;
}