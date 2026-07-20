// lib/api/token_store.dart

/// M-1 — Token storage for the mobile client.
///
/// STRATEGY (per api-contract §2, "Where clients store tokens"):
///   Both tokens live in `flutter_secure_storage`, which is backed by the
///   iOS Keychain and the Android Keystore-encrypted shared preferences.
///   Unlike the web client (access token in memory only), mobile keeps the
///   access token at rest too — the OS keystore is a safe place for it, and
///   it lets a cold app start restore a session without an immediate refresh.
///
/// This module is intentionally framework-agnostic — no widgets. The HTTP
/// wrapper (M-2) and the auth controller (M-3) read/write through this single
/// instance so token handling lives in exactly one place.
library;

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// The tokens returned by POST /auth/login (matches the backend response body:
/// flat `accessToken` / `refreshToken`, not the nested shape in the contract).
class SessionTokens {
  final String accessToken;
  final String refreshToken;
  final String userId;
  final String role;

  const SessionTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.userId,
    required this.role,
  });
}

class TokenStore {
  static const _accessKey = 'tribo.accessToken';
  static const _refreshKey = 'tribo.refreshToken';
  static const _themeKey = 'tribo.themePreference';

  // Android: force the encrypted-prefs backend so tokens survive across
  // process death and OS upgrades without throwing on some devices.
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  /// Read a key, swallowing backend faults. The Android keystore/encrypted-prefs
  /// backend can throw (e.g. a corrupt entry, or a device whose keystore is
  /// flaky) — when it does we treat the token as absent rather than letting a
  /// PlatformException escape into every API call as an opaque failure. A null
  /// here cleanly degrades to a 401 (→ refresh, or re-login) instead.
  Future<String?> _readSafe(String key) async {
    try {
      return await _storage.read(key: key);
    } catch (e) {
      debugPrint('TokenStore: secure-storage read failed for "$key": $e');
      return null;
    }
  }

  // --- access token ---------------------------------------------------------

  Future<String?> getAccessToken() => _readSafe(_accessKey);

  Future<void> _setAccessToken(String? token) async {
    if (token == null) {
      await _storage.delete(key: _accessKey);
    } else {
      await _storage.write(key: _accessKey, value: token);
    }
  }

  // --- refresh token --------------------------------------------------------

  Future<String?> getRefreshToken() => _readSafe(_refreshKey);

  Future<void> _setRefreshToken(String? token) async {
    if (token == null) {
      await _storage.delete(key: _refreshKey);
    } else {
      await _storage.write(key: _refreshKey, value: token);
    }
  }

  // --- theme preference -----------------------------------------------------

  Future<String?> getThemePreference() => _readSafe(_themeKey);

  Future<void> setThemePreference(String? theme) async {
    if (theme == null) {
      await _storage.delete(key: _themeKey);
    } else {
      await _storage.write(key: _themeKey, value: theme);
    }
  }

  // --- lifecycle ------------------------------------------------------------

  /// Call after a successful login: stash both tokens.
  Future<void> setSession(SessionTokens tokens) async {
    await _setAccessToken(tokens.accessToken);
    await _setRefreshToken(tokens.refreshToken);
  }

  /// Call after a successful /auth/refresh: only the access token changes.
  /// (Refresh-token rotation isn't enabled on the backend yet — B-8 follow-up.)
  Future<void> updateAccessToken(String token) => _setAccessToken(token);

  /// Call on logout (or when refresh fails): wipe everything.
  Future<void> clearSession() async {
    await _setAccessToken(null);
    await _setRefreshToken(null);
  }

  /// True if we have a refresh token to attempt a session bootstrap on launch.
  Future<bool> hasPersistedSession() async => (await getRefreshToken()) != null;
}
