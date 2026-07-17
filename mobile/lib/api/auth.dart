// lib/api/auth.dart

/// Auth API calls. Thin wrappers over ApiClient that also keep the TokenStore
/// in sync. Mirrors the web client's api/auth.ts.
library;

import 'http.dart';
import 'token_store.dart';

/// The fields POST /auth/register accepts.
class RegisterInput {
  final String email;
  final String password;
  final String fullName;
  final String phoneNumber;
  final int age;
  final String role; // self-selected (D-1); END_USER unless ACTIVITY_MANAGER/PARTNER

  const RegisterInput({
    required this.email,
    required this.password,
    required this.fullName,
    required this.phoneNumber,
    required this.age,
    this.role = 'END_USER',
  });

  Map<String, dynamic> toJson() => {
        'email': email,
        'password': password,
        'fullName': fullName,
        'phoneNumber': phoneNumber,
        'age': age,
        'role': role,
      };
}

/// Result of a registration — the account must confirm its email before login.
class RegisterResult {
  final String email;
  final bool emailVerified;
  final String message;
  const RegisterResult({
    required this.email,
    required this.emailVerified,
    required this.message,
  });
}

/// The (DB-backed) password rules, for showing hints in the UI.
class PasswordPolicy {
  final int minLength;
  final List<String> rules;
  const PasswordPolicy({required this.minLength, required this.rules});

  factory PasswordPolicy.fromJson(Map<String, dynamic> j) => PasswordPolicy(
        minLength: (j['minLength'] as num?)?.toInt() ?? 8,
        rules: ((j['rules'] as List<dynamic>?) ?? const [])
            .map((e) => e as String)
            .toList(),
      );

  static const fallback = PasswordPolicy(minLength: 8, rules: ['At least 8 characters']);
}

/// The authenticated identity the UI cares about.
class CurrentUser {
  final String userId;
  final String role;
  final bool? verified; // known after login/register; null after a whoami bootstrap

  const CurrentUser({required this.userId, required this.role, this.verified});

  bool get canManage =>
      role == 'ACTIVITY_MANAGER' || role == 'PARTNER' || role == 'SYSADMIN';
}

class AuthApi {
  AuthApi(this._client, this._tokens);

  final ApiClient _client;
  final TokenStore _tokens;

  /// POST /auth/login — stores the session and returns the user identity.
  Future<CurrentUser> login(String email, String password) async {
    final data = await _client.post(
      '/auth/login',
      skipAuth: true,
      body: {'email': email, 'password': password},
    ) as Map<String, dynamic>?;

    if (data == null) throw Exception('Login returned no body.');

    await _tokens.setSession(SessionTokens(
      accessToken: data['accessToken'] as String,
      refreshToken: data['refreshToken'] as String,
      userId: data['userId'] as String,
      role: data['role'] as String,
    ));

    return CurrentUser(
      userId: data['userId'] as String,
      role: data['role'] as String,
      verified: data['verified'] as bool?,
    );
  }

  /// POST /auth/register. Does NOT log in — the account must confirm its email
  /// first (login is gated on it), so we return the verification status.
  Future<RegisterResult> register(RegisterInput input) async {
    final data = await _client.post('/auth/register', skipAuth: true, body: input.toJson())
        as Map<String, dynamic>?;
    return RegisterResult(
      email: (data?['email'] as String?) ?? input.email,
      emailVerified: (data?['emailVerified'] as bool?) ?? false,
      message: (data?['message'] as String?) ??
          'Account created. Check your email to confirm it before logging in.',
    );
  }

  /// POST /auth/verify-email — confirm the email from the link's token.
  Future<String> verifyEmail(String token) async {
    final data = await _client.post('/auth/verify-email', skipAuth: true, body: {'token': token})
        as Map<String, dynamic>?;
    return (data?['message'] as String?) ?? 'Email confirmed. You can now log in.';
  }

  /// POST /auth/resend-verification — re-send the confirmation link.
  Future<String> resendVerification(String email) async {
    final data = await _client.post('/auth/resend-verification', skipAuth: true, body: {'email': email})
        as Map<String, dynamic>?;
    return (data?['message'] as String?) ??
        'If that account exists and is unverified, a new link has been sent.';
  }

  /// GET /auth/password-policy — the current DB-backed password rules.
  Future<PasswordPolicy> getPasswordPolicy() async {
    try {
      final data = await _client.get('/auth/password-policy') as Map<String, dynamic>?;
      return data == null ? PasswordPolicy.fallback : PasswordPolicy.fromJson(data);
    } catch (_) {
      return PasswordPolicy.fallback;
    }
  }

  /// POST /auth/logout — revokes the refresh token, then clears local session.
  Future<void> logout() async {
    final refreshToken = await _tokens.getRefreshToken();
    if (refreshToken != null) {
      try {
        await _client.post(
          '/auth/logout',
          skipAuth: true,
          body: {'refreshToken': refreshToken},
        );
      } catch (_) {
        // Even if the server call fails, clear locally — the user wants out.
      }
    }
    await _tokens.clearSession();
  }

  /// GET /ping-auth/whoami — used to bootstrap a session on app launch.
  Future<CurrentUser> whoami() async {
    final data = await _client.get('/ping-auth/whoami') as Map<String, dynamic>?;
    if (data == null) throw Exception('whoami returned no body.');
    return CurrentUser(
      userId: data['userId'] as String,
      role: data['role'] as String,
    );
  }
}
