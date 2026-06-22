// lib/api/activities.dart

/// Activity Management API (Sprint 2). Thin wrappers over ApiClient — the auth
/// interceptor attaches the token and handles refresh-on-401. Mirrors the web
/// client's api/activities.ts.
library;

import 'http.dart';

class Activity {
  final String id;
  final String ownerId;
  final String title;
  final String description;
  final String category;
  final String location;
  final DateTime startsAt;
  final DateTime endsAt;
  final int capacity;
  final String status; // DRAFT | PUBLISHED | CANCELLED
  final double? latitude; // optional location pin for the map
  final double? longitude;

  const Activity({
    required this.id,
    required this.ownerId,
    required this.title,
    required this.description,
    required this.category,
    required this.location,
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
    required this.status,
    this.latitude,
    this.longitude,
  });

  bool get hasLocation => latitude != null && longitude != null;

  factory Activity.fromJson(Map<String, dynamic> j) => Activity(
        id: j['id'] as String,
        ownerId: j['ownerId'] as String,
        title: j['title'] as String,
        description: (j['description'] ?? '') as String,
        category: (j['category'] ?? '') as String,
        location: (j['location'] ?? '') as String,
        startsAt: DateTime.parse(j['startsAt'] as String),
        endsAt: DateTime.parse(j['endsAt'] as String),
        capacity: (j['capacity'] as num).toInt(),
        status: j['status'] as String,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
      );
}

/// Body for create + edit. Server ignores any id/owner/status sent.
class ActivityInput {
  final String title;
  final String description;
  final String category;
  final String location;
  final DateTime startsAt;
  final DateTime endsAt;
  final int capacity;

  const ActivityInput({
    required this.title,
    required this.description,
    required this.category,
    required this.location,
    required this.startsAt,
    required this.endsAt,
    required this.capacity,
  });

  Map<String, dynamic> toJson() => {
        'title': title,
        'description': description,
        'category': category,
        'location': location,
        'startsAt': startsAt.toUtc().toIso8601String(),
        'endsAt': endsAt.toUtc().toIso8601String(),
        'capacity': capacity,
      };
}

class ActivityPage {
  final List<Activity> items;
  final String? nextCursor;
  const ActivityPage(this.items, this.nextCursor);
}

class Participant {
  final String userId;
  final DateTime joinedAt;
  const Participant(this.userId, this.joinedAt);
}

class Roster {
  final int count;
  final List<Participant> participants;
  const Roster(this.count, this.participants);
}

class ActivitiesApi {
  ActivitiesApi(this._client);
  final ApiClient _client;

  /// GET /activities — catalog/discovery with optional status filter + paging.
  Future<ActivityPage> list({String status = 'PUBLISHED', String? cursor, int? limit}) async {
    final params = <String, String>{'status': status};
    if (cursor != null && cursor.isNotEmpty) params['cursor'] = cursor;
    if (limit != null) params['limit'] = '$limit';
    final qs = Uri(queryParameters: params).query;
    final data = await _client.get('/activities?$qs') as Map<String, dynamic>?;
    if (data == null) return const ActivityPage([], null);
    final items = (data['items'] as List<dynamic>)
        .map((e) => Activity.fromJson(e as Map<String, dynamic>))
        .toList();
    return ActivityPage(items, data['nextCursor'] as String?);
  }

  /// GET /activities/{id} — detail.
  Future<Activity> get(String id) async {
    final data = await _client.get('/activities/$id') as Map<String, dynamic>?;
    if (data == null) throw Exception('Activity not found.');
    return Activity.fromJson(data);
  }

  /// POST /activities — create (verified manager/partner/sysadmin).
  Future<Activity> create(ActivityInput input) async {
    final data = await _client.post('/activities', body: input.toJson()) as Map<String, dynamic>?;
    if (data == null) throw Exception('Create returned no body.');
    return Activity.fromJson(data);
  }

  /// PUT /activities/{id} — owner-only edit.
  Future<Activity> update(String id, ActivityInput input) async {
    final data = await _client.request('PUT', '/activities/$id', body: input.toJson())
        as Map<String, dynamic>?;
    if (data == null) throw Exception('Update returned no body.');
    return Activity.fromJson(data);
  }

  /// POST /activities/{id}/cancel — owner-only soft cancel.
  Future<Activity> cancel(String id) async {
    final data = await _client.post('/activities/$id/cancel') as Map<String, dynamic>?;
    if (data == null) throw Exception('Cancel returned no body.');
    return Activity.fromJson(data);
  }

  /// POST /activities/{id}/participants — the caller joins.
  Future<void> join(String id) => _client.post('/activities/$id/participants');

  /// DELETE /activities/{id}/participants/me — the caller withdraws (idempotent).
  Future<void> withdraw(String id) => _client.request('DELETE', '/activities/$id/participants/me');

  /// GET /activities/{id}/participants — owner/privileged roster.
  Future<Roster> roster(String id) async {
    final data = await _client.get('/activities/$id/participants') as Map<String, dynamic>?;
    if (data == null) return const Roster(0, []);
    final participants = (data['participants'] as List<dynamic>)
        .map((e) => Participant(
              (e as Map<String, dynamic>)['userId'] as String,
              DateTime.parse(e['joinedAt'] as String),
            ))
        .toList();
    return Roster((data['count'] as num).toInt(), participants);
  }
}
