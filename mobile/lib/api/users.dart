// lib/api/users.dart

/// User profile API (Sprint 3). GET /users/me is the DB-backed profile read,
/// distinct from the cheap /ping-auth/whoami identity probe used to bootstrap a
/// session. Mirrors the web client's api/users.ts.
library;

import 'http.dart';

/// The signed-in user's clan, when they belong to one.
class ClanRef {
  final String id;
  final String name;
  final String tag;
  final String color;
  final String? pictureUrl;

  const ClanRef({
    required this.id,
    required this.name,
    required this.tag,
    required this.color,
    this.pictureUrl,
  });

  factory ClanRef.fromJson(Map<String, dynamic> j) => ClanRef(
        id: j['id'] as String,
        name: j['name'] as String,
        tag: j['tag'] as String,
        color: (j['color'] ?? '#888888') as String,
        pictureUrl: j['pictureUrl'] as String?,
      );
}

/// A badge earned by running / volunteering.
class Achievement {
  final String icon;
  final String title;
  final String sub;

  const Achievement({required this.icon, required this.title, required this.sub});

  factory Achievement.fromJson(Map<String, dynamic> j) => Achievement(
        icon: (j['icon'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        sub: (j['sub'] ?? '') as String,
      );
}

/// Full profile of the signed-in user (GET /users/me).
class Me {
  final String userId;
  final String email;
  final String fullName;
  final int age;
  final String birthDate; // ISO "YYYY-MM-DD"
  final String role;
  final bool verified;
  final String profileVisibility; // PUBLIC | PRIVATE
  final String handle; // derived, e.g. "@ana"
  final String avatarColor; // derived hex
  final String? pictureUrl;
  final ClanRef? clan;
  final int volunteerEvents; // VOLUNTEER activities joined
  final bool staffEligible; // true once volunteerEvents >= 3
  final int volunteerPoints; // credited total (derived)
  final double weeklyGoalKm; // per-user weekly distance goal; 0 = none
  final List<Achievement> achievements;

  const Me({
    required this.userId,
    required this.email,
    required this.fullName,
    required this.age,
    this.birthDate = '',
    required this.role,
    required this.verified,
    this.profileVisibility = 'PUBLIC',
    required this.handle,
    required this.avatarColor,
    this.pictureUrl,
    required this.clan,
    required this.volunteerEvents,
    required this.staffEligible,
    required this.volunteerPoints,
    required this.weeklyGoalKm,
    required this.achievements,
  });

  factory Me.fromJson(Map<String, dynamic> j) => Me(
        userId: j['userId'] as String,
        email: (j['email'] ?? '') as String,
        fullName: (j['fullName'] ?? '') as String,
        age: (j['age'] as num?)?.toInt() ?? 0,
        birthDate: (j['birthDate'] ?? '') as String,
        role: (j['role'] ?? '') as String,
        verified: (j['verified'] ?? false) as bool,
        profileVisibility: (j['profileVisibility'] ?? 'PUBLIC') as String,
        handle: (j['handle'] ?? '') as String,
        avatarColor: (j['avatarColor'] ?? '#1B8A5A') as String,
        pictureUrl: j['pictureUrl'] as String?,
        clan: j['clan'] == null
            ? null
            : ClanRef.fromJson(j['clan'] as Map<String, dynamic>),
        volunteerEvents: (j['volunteerEvents'] as num?)?.toInt() ?? 0,
        staffEligible: (j['staffEligible'] ?? false) as bool,
        volunteerPoints: (j['volunteerPoints'] as num?)?.toInt() ?? 0,
        weeklyGoalKm: (j['weeklyGoalKm'] as num?)?.toDouble() ?? 0,
        achievements: ((j['achievements'] as List<dynamic>?) ?? const [])
            .map((e) => Achievement.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class UsersApi {
  UsersApi(this._client);
  final ApiClient _client;

  /// GET /users/me — full profile of the signed-in user.
  Future<Me> getMe() async {
    final data = await _client.get('/users/me') as Map<String, dynamic>?;
    if (data == null) throw Exception('Profile read returned no body.');
    return Me.fromJson(data);
  }

  /// POST /users/me/picture
  Future<void> uploadProfilePicture(List<int> fileBytes, String filename, String mimeType) async {
    await _client.postMultipart(
      '/users/me/picture',
      fileField: 'file',
      fileBytes: fileBytes,
      filename: filename,
      mimeType: mimeType,
    );
  }

  /// POST /users/me/password — change password (requires the current one).
  Future<String> changePassword(String currentPassword, String newPassword) async {
    final data = await _client.post('/users/me/password', body: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    }) as Map<String, dynamic>?;
    return (data?['message'] as String?) ?? 'Password updated.';
  }

  /// PUT /users/me/visibility — set profile visibility (PUBLIC / PRIVATE).
  Future<Me> setVisibility(String visibility) async {
    final data = await _client.request('PUT', '/users/me/visibility', body: {'visibility': visibility})
        as Map<String, dynamic>?;
    if (data == null) throw Exception('Set visibility returned no body.');
    return Me.fromJson(data);
  }
}
