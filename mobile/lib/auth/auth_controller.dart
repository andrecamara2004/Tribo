// lib/auth/auth_controller.dart

/// M-3 — App-wide auth state. Mirrors the web AuthContext: holds the current
/// user, exposes login/register/logout, and bootstraps a session on launch.
library;

import 'package:flutter/material.dart';

import '../api/auth.dart';
import '../api/token_store.dart';

class AuthController extends ChangeNotifier {
  AuthController({
    required AuthApi authApi,
    required TokenStore tokens,
  })  : _authApi = authApi,
        _tokens = tokens;

  final AuthApi _authApi;
  final TokenStore _tokens;

  CurrentUser? _user;
  bool _loading = true; // true during the initial session bootstrap
  ThemeMode _themeMode = ThemeMode.light;

  CurrentUser? get user => _user;
  bool get loading => _loading;
  bool get isAuthenticated => _user != null;
  ThemeMode get themeMode => isAuthenticated ? _themeMode : ThemeMode.light;

  /// On launch: if a refresh token persisted, try to re-establish the session.
  /// whoami() will refresh-on-401 if the stored access token is stale, so this
  /// transparently restores a logged-in session across cold starts.
  Future<void> bootstrap() async {
    final themePref = await _tokens.getThemePreference();
    if (themePref == 'DARK') {
      _themeMode = ThemeMode.dark;
    } else {
      _themeMode = ThemeMode.light;
    }

    try {
      if (!await _tokens.hasPersistedSession()) {
        _user = null;
        return;
      }
      _user = await _authApi.whoami();
    } catch (_) {
      _user = null; // refresh failed → not logged in
      await _tokens.clearSession();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> login(String email, String password) async {
    _user = await _authApi.login(email, password);
    notifyListeners();
  }

  /// Register does NOT log in — the account must confirm its email first. The
  /// result (with the message) is surfaced so the screen can prompt the user.
  Future<RegisterResult> register(RegisterInput input) async {
    return _authApi.register(input);
  }

  Future<void> logout() async {
    await _authApi.logout();
    _user = null;
    notifyListeners();
  }

  Future<void> updateTheme(ThemeMode mode) async {
    _themeMode = mode;
    final prefStr = mode == ThemeMode.dark ? 'DARK' : 'LIGHT';
    await _tokens.setThemePreference(prefStr);
    notifyListeners();
  }

  // --- email verification / policy helpers (no session state change) --------

  Future<PasswordPolicy> passwordPolicy() => _authApi.getPasswordPolicy();

  Future<String> resendVerification(String email) => _authApi.resendVerification(email);

  Future<String> verifyEmail(String token) => _authApi.verifyEmail(token);

  Future<String> requestPasswordReset(String email) => _authApi.requestPasswordReset(email);
}
