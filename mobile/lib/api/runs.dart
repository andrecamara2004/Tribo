// lib/api/runs.dart

/// Runs API (Sprint 3 Phase 2). Clients post a finished run summary + per-km
/// splits; the backend stores and aggregates, deriving stats server-side.
/// Mirrors the web client's api/runs.ts.
library;

import 'http.dart';

/// One per-kilometer split of a run.
class Split {
  final int km;
  final int durationSeconds;
  const Split(this.km, this.durationSeconds);

  factory Split.fromJson(Map<String, dynamic> j) => Split(
        (j['km'] as num?)?.toInt() ?? 0,
        (j['durationSeconds'] as num?)?.toInt() ?? 0,
      );
}

/// A finished run logged by a user.
class Run {
  final String id;
  final String userId;
  final String title;
  final String location;
  final int distanceMeters;
  final int durationSeconds;
  final int elevationMeters;
  final String routeType; // river|trail|park|coast|city (cosmetic)
  final DateTime startedAt;
  final DateTime createdAt;
  final List<Split> splits;

  const Run({
    required this.id,
    required this.userId,
    required this.title,
    required this.location,
    required this.distanceMeters,
    required this.durationSeconds,
    required this.elevationMeters,
    required this.routeType,
    required this.startedAt,
    required this.createdAt,
    required this.splits,
  });

  /// Distance in kilometers (e.g. 5230 m → 5.23).
  double get distanceKm => distanceMeters / 1000;

  /// Overall pace in seconds per km, or 0 for a zero-distance run.
  int get paceSecPerKm =>
      distanceMeters > 0 ? (durationSeconds / (distanceMeters / 1000)).round() : 0;

  factory Run.fromJson(Map<String, dynamic> j) => Run(
        id: (j['id'] ?? '') as String,
        userId: (j['userId'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        location: (j['location'] ?? '') as String,
        distanceMeters: (j['distanceMeters'] as num?)?.toInt() ?? 0,
        durationSeconds: (j['durationSeconds'] as num?)?.toInt() ?? 0,
        elevationMeters: (j['elevationMeters'] as num?)?.toInt() ?? 0,
        routeType: (j['routeType'] ?? 'river') as String,
        startedAt: DateTime.parse(j['startedAt'] as String),
        createdAt: DateTime.parse((j['createdAt'] ?? j['startedAt']) as String),
        splits: ((j['splits'] as List<dynamic>?) ?? const [])
            .map((e) => Split.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Derived running stats (GET /users/me/stats).
class RunStats {
  final List<double> weeklyKm; // 7 entries, Mon→Sun
  final double monthKm;
  final int monthRuns;
  final int? avgPaceSecPerKm;
  final int streak;

  const RunStats({
    required this.weeklyKm,
    required this.monthKm,
    required this.monthRuns,
    required this.avgPaceSecPerKm,
    required this.streak,
  });

  factory RunStats.fromJson(Map<String, dynamic> j) => RunStats(
        weeklyKm: ((j['weeklyKm'] as List<dynamic>?) ?? const [])
            .map((e) => (e as num).toDouble())
            .toList(),
        monthKm: (j['monthKm'] as num?)?.toDouble() ?? 0,
        monthRuns: (j['monthRuns'] as num?)?.toInt() ?? 0,
        avgPaceSecPerKm: (j['avgPaceSecPerKm'] as num?)?.toInt(),
        streak: (j['streak'] as num?)?.toInt() ?? 0,
      );
}

class RunsApi {
  RunsApi(this._client);
  final ApiClient _client;

  /// GET /runs?scope=me|clan — newest first.
  Future<List<Run>> list({String scope = 'me'}) async {
    final data = await _client.get('/runs?scope=$scope') as Map<String, dynamic>?;
    final items = (data?['items'] as List<dynamic>?) ?? const [];
    return items.map((e) => Run.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /runs — log a finished run.
  Future<Run> log({
    String? title,
    String? location,
    required int distanceMeters,
    required int durationSeconds,
    int elevationMeters = 0,
    String routeType = 'river',
    required DateTime startedAt,
  }) async {
    final body = <String, dynamic>{
      if (title != null && title.isNotEmpty) 'title': title,
      if (location != null && location.isNotEmpty) 'location': location,
      'distanceMeters': distanceMeters,
      'durationSeconds': durationSeconds,
      'elevationMeters': elevationMeters,
      'routeType': routeType,
      'startedAt': startedAt.toUtc().toIso8601String(),
    };
    final data = await _client.post('/runs', body: body) as Map<String, dynamic>?;
    if (data == null) throw Exception('Log run returned no body.');
    return Run.fromJson(data);
  }

  /// GET /users/me/stats — derived running stats, or null if unavailable.
  Future<RunStats?> myStats() async {
    final data = await _client.get('/users/me/stats') as Map<String, dynamic>?;
    return data == null ? null : RunStats.fromJson(data);
  }
}
