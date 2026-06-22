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

  /// POST /auth/register, then auto-login with the same credentials.
  /// The backend's register returns no tokens by design — chain a login.
  Future<CurrentUser> register(RegisterInput input) async {
    await _client.post('/auth/register', skipAuth: true, body: input.toJson());
    return login(input.email, input.password);
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
