// lib/api/feed.dart

/// Activity feed (Sprint 3 Phase 4) + kudos + comments. Items are a union of
/// runs and volunteer joins sharing a common head. Mirrors the web feed.ts.
/// itemId is opaque and URL-encoded (volunteer ids contain ':').
library;

import 'http.dart';

class FeedAuthor {
  final String userId;
  final String name;
  final String? clanName;
  final String color;
  const FeedAuthor(this.userId, this.name, this.clanName, this.color);

  factory FeedAuthor.fromJson(Map<String, dynamic> j) => FeedAuthor(
        (j['userId'] ?? '') as String,
        (j['name'] ?? 'Someone') as String,
        j['clanName'] as String?,
        (j['color'] ?? '#888888') as String,
      );
}

class FeedItem {
  final String id;
  final String type; // run | volunteer
  final DateTime when;
  final FeedAuthor author;
  final String title;
  final String location;
  int kudosCount;
  bool likedByMe;
  final int commentCount;

  // run
  final double? distanceKm;
  final int? durationSeconds;
  final int? paceSecPerKm;
  final int? elevationMeters;

  // volunteer
  final String? role; // PARTICIPANT | STAFF
  final int? pointsEarned;
  final String? verifiedBy; // PEER | PARTNER

  FeedItem({
    required this.id,
    required this.type,
    required this.when,
    required this.author,
    required this.title,
    required this.location,
    required this.kudosCount,
    required this.likedByMe,
    required this.commentCount,
    this.distanceKm,
    this.durationSeconds,
    this.paceSecPerKm,
    this.elevationMeters,
    this.role,
    this.pointsEarned,
    this.verifiedBy,
  });

  bool get isVolunteer => type == 'volunteer';

  factory FeedItem.fromJson(Map<String, dynamic> j) => FeedItem(
        id: j['id'] as String,
        type: (j['type'] ?? 'run') as String,
        when: DateTime.parse(j['when'] as String),
        author: FeedAuthor.fromJson((j['author'] ?? const {}) as Map<String, dynamic>),
        title: (j['title'] ?? '') as String,
        location: (j['location'] ?? '') as String,
        kudosCount: (j['kudosCount'] as num?)?.toInt() ?? 0,
        likedByMe: (j['likedByMe'] ?? false) as bool,
        commentCount: (j['commentCount'] as num?)?.toInt() ?? 0,
        distanceKm: (j['distanceKm'] as num?)?.toDouble(),
        durationSeconds: (j['durationSeconds'] as num?)?.toInt(),
        paceSecPerKm: (j['paceSecPerKm'] as num?)?.toInt(),
        elevationMeters: (j['elevationMeters'] as num?)?.toInt(),
        role: j['role'] as String?,
        pointsEarned: (j['pointsEarned'] as num?)?.toInt(),
        verifiedBy: j['verifiedBy'] as String?,
      );
}

class FeedComment {
  final String id;
  final String text;
  final DateTime createdAt;
  final FeedAuthor author;
  const FeedComment(this.id, this.text, this.createdAt, this.author);

  factory FeedComment.fromJson(Map<String, dynamic> j) => FeedComment(
        j['id'] as String,
        (j['text'] ?? '') as String,
        DateTime.parse(j['createdAt'] as String),
        FeedAuthor.fromJson((j['author'] ?? const {}) as Map<String, dynamic>),
      );
}

class FeedApi {
  FeedApi(this._client);
  final ApiClient _client;

  /// GET /feed?scope=all|clan — newest first.
  Future<List<FeedItem>> list({String scope = 'all'}) async {
    final data = await _client.get('/feed?scope=$scope') as Map<String, dynamic>?;
    final items = (data?['items'] as List<dynamic>?) ?? const [];
    return items.map((e) => FeedItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /feed/{itemId}/kudos — like. Returns the new (count, liked) pair.
  Future<({int kudosCount, bool likedByMe})> like(String itemId) async {
    final data = await _client.post('/feed/${Uri.encodeComponent(itemId)}/kudos')
        as Map<String, dynamic>?;
    return (
      kudosCount: (data?['kudosCount'] as num?)?.toInt() ?? 0,
      likedByMe: (data?['likedByMe'] ?? true) as bool,
    );
  }

  /// DELETE /feed/{itemId}/kudos — unlike.
  Future<void> unlike(String itemId) =>
      _client.request('DELETE', '/feed/${Uri.encodeComponent(itemId)}/kudos');

  /// GET /feed/{itemId}/comments — oldest first.
  Future<List<FeedComment>> comments(String itemId) async {
    final data = await _client.get('/feed/${Uri.encodeComponent(itemId)}/comments')
        as Map<String, dynamic>?;
    final items = (data?['items'] as List<dynamic>?) ?? const [];
    return items.map((e) => FeedComment.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /feed/{itemId}/comments.
  Future<FeedComment> addComment(String itemId, String text) async {
    final data = await _client.post(
      '/feed/${Uri.encodeComponent(itemId)}/comments',
      body: {'text': text},
    ) as Map<String, dynamic>?;
    if (data == null) throw Exception('Comment returned no body.');
    return FeedComment.fromJson(data);
  }

  /// DELETE /feed/{itemId}/comments/{commentId}.
  Future<void> deleteComment(String itemId, String commentId) => _client.request(
      'DELETE', '/feed/${Uri.encodeComponent(itemId)}/comments/$commentId');
}
