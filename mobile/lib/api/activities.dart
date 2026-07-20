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
  final String eventKind; // RUN | VOLUNTEER
  final double distanceKm;
  final double averageRating;
  final int reviewCount;
  final String? userRole; // caller's participation: PARTICIPANT | STAFF | null
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
    this.eventKind = 'RUN',
    this.distanceKm = 0,
    this.averageRating = 0,
    this.reviewCount = 0,
    this.userRole,
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
        eventKind: (j['eventKind'] ?? 'RUN') as String,
        distanceKm: (j['distanceKm'] as num?)?.toDouble() ?? 0,
        averageRating: (j['averageRating'] as num?)?.toDouble() ?? 0,
        reviewCount: (j['reviewCount'] as num?)?.toInt() ?? 0,
        userRole: j['userRole'] as String?,
        latitude: (j['latitude'] as num?)?.toDouble(),
        longitude: (j['longitude'] as num?)?.toDouble(),
      );
}

/// A single review left on an activity (GET/POST /activities/{id}/reviews).
class Review {
  final String id;
  final String activityId;
  final String userId;
  final int rating; // 1–5
  final String comment;
  final DateTime createdAt;

  const Review({
    required this.id,
    required this.activityId,
    required this.userId,
    required this.rating,
    required this.comment,
    required this.createdAt,
  });

  factory Review.fromJson(Map<String, dynamic> j) => Review(
        id: (j['id'] ?? '') as String,
        activityId: (j['activityId'] ?? '') as String,
        userId: (j['userId'] ?? '') as String,
        rating: (j['rating'] as num?)?.toInt() ?? 0,
        comment: (j['comment'] ?? '') as String,
        createdAt: DateTime.parse(j['createdAt'] as String),
      );
}

/// The reviews list for an activity plus its aggregate rating.
class ReviewList {
  final double averageRating;
  final int reviewCount;
  final List<Review> reviews;
  const ReviewList(this.averageRating, this.reviewCount, this.reviews);
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

  /// GET /activities — catalog/discovery with optional status filter, free-text
  /// search, type/distance filters and paging.
  Future<ActivityPage> list({
    String status = 'PUBLISHED',
    String? cursor,
    int? limit,
    String? q,
    String? eventKind,
    double? minDistanceKm,
    double? maxDistanceKm,
    double? nearLat,
    double? nearLng,
    double? radiusKm,
  }) async {
    final params = <String, String>{'status': status};
    if (cursor != null && cursor.isNotEmpty) params['cursor'] = cursor;
    if (limit != null) params['limit'] = '$limit';
    if (q != null && q.trim().isNotEmpty) params['q'] = q.trim();
    if (eventKind != null && eventKind != 'ALL') params['eventKind'] = eventKind;
    if (minDistanceKm != null) params['minDistanceKm'] = '$minDistanceKm';
    if (maxDistanceKm != null) params['maxDistanceKm'] = '$maxDistanceKm';
    if (nearLat != null && nearLng != null) {
      params['nearLat'] = '$nearLat';
      params['nearLng'] = '$nearLng';
      if (radiusKm != null) params['radiusKm'] = '$radiusKm';
    }
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

  /// GET /activities/{id}/reviews — list of reviews + aggregate rating.
  Future<ReviewList> getReviews(String id) async {
    final data = await _client.get('/activities/$id/reviews') as Map<String, dynamic>?;
    if (data == null) return const ReviewList(0, 0, []);
    final reviews = ((data['reviews'] as List<dynamic>?) ?? const [])
        .map((e) => Review.fromJson(e as Map<String, dynamic>))
        .toList();
    return ReviewList(
      (data['averageRating'] as num?)?.toDouble() ?? 0,
      (data['reviewCount'] as num?)?.toInt() ?? 0,
      reviews,
    );
  }

  /// POST /activities/{id}/reviews — leave a review (participants only, after
  /// the activity has ended). Returns the created review.
  Future<Review> submitReview(String id, {required int rating, String comment = ''}) async {
    final data = await _client.post('/activities/$id/reviews',
        body: {'rating': rating, 'comment': comment}) as Map<String, dynamic>?;
    if (data == null) throw Exception('Review submission failed.');
    return Review.fromJson(data);
  }
}
