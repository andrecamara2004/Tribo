// lib/api/clans.dart

/// Clan API (Sprint 3). One clan per user; membership lives on the user, so
/// join/leave change the caller's clan (reflected by GET /users/me). Mirrors
/// the web client's api/clans.ts.
library;

import 'http.dart';

class Clan {
  final String id;
  final String name;
  final String tag;
  final String color;
  final String ownerId;
  final String? pictureUrl;
  final int memberCount;

  const Clan({
    required this.id,
    required this.name,
    required this.tag,
    required this.color,
    required this.ownerId,
    this.pictureUrl,
    required this.memberCount,
  });

  factory Clan.fromJson(Map<String, dynamic> j) => Clan(
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        tag: (j['tag'] ?? '') as String,
        color: (j['color'] ?? '#888888') as String,
        ownerId: (j['ownerId'] ?? '') as String,
        pictureUrl: j['pictureUrl'] as String?,
        memberCount: (j['memberCount'] as num?)?.toInt() ?? 0,
      );
}

class ClanInput {
  final String name;
  final String tag;
  final String color;
  const ClanInput({required this.name, required this.tag, required this.color});

  Map<String, dynamic> toJson() => {'name': name, 'tag': tag, 'color': color};
}

/// A row in the clan leaderboard.
class ClanRankRow {
  final int rank;
  final String id;
  final String name;
  final String tag;
  final String color;
  final String? pictureUrl;
  final int members;
  final double totalKm;
  final double monthlyKm;
  final double weeklyKm;
  final double? avgPaceSecPerKm;
  final int consistencyPct;
  final int volunteerPoints;
  final int volunteerEvents;
  final String trend; // up | down | flat

  const ClanRankRow({
    required this.rank,
    required this.id,
    required this.name,
    required this.tag,
    required this.color,
    this.pictureUrl,
    required this.members,
    required this.totalKm,
    required this.monthlyKm,
    required this.weeklyKm,
    required this.avgPaceSecPerKm,
    required this.consistencyPct,
    required this.volunteerPoints,
    required this.volunteerEvents,
    required this.trend,
  });

  factory ClanRankRow.fromJson(Map<String, dynamic> j) => ClanRankRow(
        rank: (j['rank'] as num?)?.toInt() ?? 0,
        id: j['id'] as String,
        name: (j['name'] ?? '') as String,
        tag: (j['tag'] ?? '') as String,
        color: (j['color'] ?? '#888888') as String,
        pictureUrl: j['pictureUrl'] as String?,
        members: (j['members'] as num?)?.toInt() ?? 0,
        totalKm: (j['totalKm'] as num?)?.toDouble() ?? 0,
        monthlyKm: (j['monthlyKm'] as num?)?.toDouble() ?? 0,
        weeklyKm: (j['weeklyKm'] as num?)?.toDouble() ?? 0,
        avgPaceSecPerKm: (j['avgPaceSecPerKm'] as num?)?.toDouble(),
        consistencyPct: (j['consistencyPct'] as num?)?.toInt() ?? 0,
        volunteerPoints: (j['volunteerPoints'] as num?)?.toInt() ?? 0,
        volunteerEvents: (j['volunteerEvents'] as num?)?.toInt() ?? 0,
        trend: (j['trend'] ?? 'flat') as String,
      );

  double distanceFor(String period) =>
      period == 'week' ? weeklyKm : period == 'month' ? monthlyKm : totalKm;
}

class ClanRanking {
  final String metric;
  final String period;
  final List<ClanRankRow> clans;
  const ClanRanking(this.metric, this.period, this.clans);
}

class ClansApi {
  ClansApi(this._client);
  final ApiClient _client;

  /// GET /clans — all clans with member counts.
  Future<List<Clan>> list() async {
    final data = await _client.get('/clans') as Map<String, dynamic>?;
    final items = (data?['items'] as List<dynamic>?) ?? const [];
    return items.map((e) => Clan.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /clans — create a clan; the caller auto-joins as owner.
  Future<Clan> create(ClanInput input) async {
    final data = await _client.post('/clans', body: input.toJson()) as Map<String, dynamic>?;
    if (data == null) throw Exception('Create returned no body.');
    return Clan.fromJson(data);
  }

  /// POST /clans/{id}/join — the caller joins (switches clans if already in one).
  Future<void> join(String id) => _client.post('/clans/$id/join');

  /// POST /clans/leave — the caller leaves their clan (idempotent).
  Future<void> leave() => _client.post('/clans/leave');

  /// GET /clans/ranking — leaderboard for the given metric + period.
  Future<ClanRanking> ranking({String metric = 'avgPace', String period = 'all'}) async {
    final data = await _client.get('/clans/ranking?metric=$metric&period=$period')
        as Map<String, dynamic>?;
    final clans = ((data?['clans'] as List<dynamic>?) ?? const [])
        .map((e) => ClanRankRow.fromJson(e as Map<String, dynamic>))
        .toList();
    return ClanRanking(metric, period, clans);
  }

  /// GET /clans/{id}/members — all users in the clan with their roles.
  Future<List<ClanMember>> members(String id) async {
    final data = await _client.get('/clans/$id/members');
    final items = (data as List<dynamic>?) ?? const [];
    return items.map((e) => ClanMember.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// GET /clans/{id}/messages — last 50 chat messages.
  Future<List<ClanMessage>> getMessages(String id) async {
    final data = await _client.get('/clans/$id/messages') as Map<String, dynamic>?;
    final msgs = (data?['messages'] as List<dynamic>?) ?? const [];
    return msgs.map((e) => ClanMessage.fromJson(e as Map<String, dynamic>)).toList();
  }

  /// POST /clans/{id}/messages — send a chat message.
  Future<ClanMessage> sendMessage(String id, String text) async {
    final data = await _client.post('/clans/$id/messages', body: {'text': text})
        as Map<String, dynamic>?;
    if (data == null) throw Exception('Send returned no body.');
    return ClanMessage.fromJson(data);
  }

  /// POST /clans/{id}/picture
  Future<void> uploadClanPicture(String id, List<int> fileBytes, String filename, String mimeType) async {
    await _client.postMultipart(
      '/clans/$id/picture',
      fileField: 'file',
      fileBytes: fileBytes,
      filename: filename,
      mimeType: mimeType,
    );
  }
}

// ---------------------------------------------------------------------------
// Models for members and chat
// ---------------------------------------------------------------------------

class ClanMember {
  final String id;
  final String fullName;
  final String role;

  const ClanMember({required this.id, required this.fullName, required this.role});

  factory ClanMember.fromJson(Map<String, dynamic> j) => ClanMember(
        id: j['id'] as String,
        fullName: (j['fullName'] ?? '') as String,
        role: (j['role'] ?? 'member') as String,
      );
}

class ClanMessage {
  final String id;
  final String userId;
  final String fullName;
  final String text;
  final String sentAt;

  const ClanMessage({
    required this.id,
    required this.userId,
    required this.fullName,
    required this.text,
    required this.sentAt,
  });

  factory ClanMessage.fromJson(Map<String, dynamic> j) => ClanMessage(
        id: j['id'] as String,
        userId: (j['userId'] ?? '') as String,
        fullName: (j['fullName'] ?? '') as String,
        text: (j['text'] ?? '') as String,
        sentAt: (j['sentAt'] ?? '') as String,
      );
}
