// lib/api/http.dart

/// M-2 — HTTP client wrapper with auth interceptor.
///
/// Every call goes through ApiClient.request(), which:
///   1. attaches the stored access token as a Bearer header,
///   2. on a 401, transparently calls /auth/refresh once, then retries,
///   3. on refresh failure, clears the session (caller can route to login).
///
/// SINGLE-FLIGHT REFRESH: if several requests 401 at the same time (the access
/// token expired), only the FIRST triggers a refresh; the rest await the same
/// in-flight Future, then retry. This avoids a stampede of /auth/refresh calls
/// — and matters once refresh-token rotation lands (B-8 follow-up), where
/// concurrent refreshes would invalidate each other.
library;

import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';

import 'token_store.dart';

/// Base URL of the API. The backend serves under `/rest` (no `/v1` yet — the
/// contract's versioning is aspirational; this tracks the deployed routes).
const String apiBase =
    String.fromEnvironment('TRIBO_API_BASE', defaultValue: 'https://tribo-497810.ew.r.appspot.com/rest');

/// Thrown when a request fails; carries the HTTP status and the parsed error
/// envelope's `code` (clients switch on `code`, not the message — contract §1).
class ApiError implements Exception {
  final int status;
  final String? code;
  final String message;

  ApiError(this.status, this.code, this.message);

  @override
  String toString() => 'ApiError($status, $code): $message';
}

class ApiClient {
  ApiClient(this._tokens, {http.Client? client})
      : _http = client ?? http.Client();

  final TokenStore _tokens;
  final http.Client _http;

  // --- single-flight refresh state ------------------------------------------

  // Holds the in-flight refresh Future, or null when no refresh is happening.
  Future<String?>? _refreshInFlight;

  /// Calls /auth/refresh with the stored refresh token. Returns the new access
  /// token, or null if refresh failed (no/expired/revoked refresh token).
  /// De-duplicated: concurrent callers share one in-flight request.
  Future<String?> _refreshAccessToken() {
    final existing = _refreshInFlight;
    if (existing != null) return existing; // someone's already refreshing

    final future = () async {
      try {
        final refreshToken = await _tokens.getRefreshToken();
        if (refreshToken == null) return null;

        final res = await _http.post(
          Uri.parse('$apiBase/auth/refresh'),
          headers: const {'Content-Type': 'application/json'},
          body: jsonEncode({'refreshToken': refreshToken}),
        );

        if (res.statusCode != 200) {
          // Refresh token invalid/expired/revoked → session is dead.
          await _tokens.clearSession();
          return null;
        }

        final data = jsonDecode(res.body) as Map<String, dynamic>;
        final newToken = data['accessToken'] as String;
        await _tokens.updateAccessToken(newToken);
        return newToken;
      } catch (_) {
        await _tokens.clearSession();
        return null;
      }
    }();

    _refreshInFlight = future;
    // Clear the gate once done so future 401s can refresh again.
    future.whenComplete(() => _refreshInFlight = null);
    return future;
  }

  // --- main wrapper ---------------------------------------------------------

  /// Authenticated request. Use for all API calls.
  ///
  /// [path] is relative to [apiBase], e.g. "/ping-auth/whoami".
  /// Set [skipAuth] true for public endpoints (login/register/refresh) to skip
  /// the Authorization header and the refresh-on-401 dance.
  ///
  /// Returns the parsed JSON body, or null for 204 No Content.
  /// Throws [ApiError] on a non-2xx response (after a refresh attempt for 401s).
  Future<dynamic> request(
    String method,
    String path, {
    Object? body,
    bool skipAuth = false,
  }) async {
    Future<http.Response> doRequest() async {
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (!skipAuth) {
        final token = await _tokens.getAccessToken();
        if (token != null) headers['Authorization'] = 'Bearer $token';
      }
      final uri = Uri.parse('$apiBase$path');
      final encoded = body == null ? null : jsonEncode(body);
      switch (method) {
        case 'GET':
          return _http.get(uri, headers: headers);
        case 'POST':
          return _http.post(uri, headers: headers, body: encoded);
        case 'PUT':
          return _http.put(uri, headers: headers, body: encoded);
        case 'DELETE':
          return _http.delete(uri, headers: headers, body: encoded);
        default:
          throw ArgumentError('Unsupported method: $method');
      }
    }

    var res = await doRequest();

    // On 401 for an authenticated request, try one refresh + retry.
    if (res.statusCode == 401 && !skipAuth) {
      final newToken = await _refreshAccessToken();
      if (newToken != null) {
        res = await doRequest(); // retry once with the fresh token
      }
    }

    if (res.statusCode == 204 || res.body.isEmpty) {
      if (res.statusCode >= 200 && res.statusCode < 300) return null;
    }

    dynamic parsed;
    try {
      parsed = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      parsed = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final error = parsed is Map<String, dynamic>
          ? parsed['error'] as Map<String, dynamic>?
          : null;
      throw ApiError(
        res.statusCode,
        error?['code'] as String?,
        (error?['message'] as String?) ??
            'Request failed with status ${res.statusCode}',
      );
    }

    return parsed;
  }

  Future<dynamic> get(String path) => request('GET', path);

  Future<dynamic> post(String path, {Object? body, bool skipAuth = false}) =>
      request('POST', path, body: body, skipAuth: skipAuth);

  Future<dynamic> postMultipart(
    String path, {
    required String fileField,
    required List<int> fileBytes,
    required String filename,
    String? mimeType,
  }) async {
    Future<http.Response> doRequest() async {
      final uri = Uri.parse('$apiBase$path');
      final req = http.MultipartRequest('POST', uri);
      
      final token = await _tokens.getAccessToken();
      if (token != null) req.headers['Authorization'] = 'Bearer $token';

      final file = http.MultipartFile.fromBytes(
        fileField,
        fileBytes,
        filename: filename,
        contentType: mimeType != null ? MediaType.parse(mimeType) : null,
      );
      req.files.add(file);

      final streamedRes = await _http.send(req);
      return http.Response.fromStream(streamedRes);
    }

    var res = await doRequest();

    if (res.statusCode == 401) {
      final newToken = await _refreshAccessToken();
      if (newToken != null) {
        res = await doRequest();
      }
    }

    if (res.statusCode == 204 || res.body.isEmpty) {
      if (res.statusCode >= 200 && res.statusCode < 300) return null;
    }

    dynamic parsed;
    try {
      parsed = res.body.isEmpty ? null : jsonDecode(res.body);
    } catch (_) {
      parsed = null;
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      final error = parsed is Map<String, dynamic>
          ? parsed['error'] as Map<String, dynamic>?
          : null;
      throw ApiError(
        res.statusCode,
        error?['code'] as String?,
        (error?['message'] as String?) ??
            'Request failed with status ${res.statusCode}',
      );
    }

    return parsed;
  }
}
