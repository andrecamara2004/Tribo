// lib/screens/feed_screen.dart
import 'package:flutter/material.dart';

import '../api/feed.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../auth/auth_scope.dart';
import '../theme.dart';

/// The social home: a newest-first timeline of runs + volunteer joins, from
/// everyone or just your clan, with kudos and comments. Ports the web FeedPage.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  List<FeedItem> _items = const [];
  String _scope = 'all';
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await ServicesScope.of(context).feed.list(scope: _scope);
      if (!mounted) return;
      setState(() => _items = items);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('feed load failed: $e');
      if (mounted) setState(() => _error = 'Failed to load feed: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _switchScope(String next) {
    if (next == _scope) return;
    setState(() => _scope = next);
    _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Feed')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
            child: Row(
              children: [
                _ScopeChip(label: 'All', selected: _scope == 'all', onTap: () => _switchScope('all')),
                const SizedBox(width: 8),
                _ScopeChip(label: 'My clan', selected: _scope == 'clan', onTap: () => _switchScope('clan')),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: _buildList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildList() {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    final theme = Theme.of(context);
    if (_items.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                _error ??
                    'Nothing here yet.\nLog a run or join a volunteer event to start the feed.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: triboMuted),
              ),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      itemCount: _items.length,
      itemBuilder: (_, i) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: _FeedCard(item: _items[i]),
      ),
    );
  }
}

class _ScopeChip extends StatelessWidget {
  const _ScopeChip({required this.label, required this.selected, required this.onTap});
  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ChoiceChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
    );
  }
}

class _FeedCard extends StatefulWidget {
  const _FeedCard({required this.item});
  final FeedItem item;

  @override
  State<_FeedCard> createState() => _FeedCardState();
}

class _FeedCardState extends State<_FeedCard> {
  bool _showComments = false;
  List<FeedComment>? _comments;
  late int _commentCount = widget.item.commentCount;
  final _commentCtrl = TextEditingController();
  bool _posting = false;

  FeedItem get item => widget.item;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _toggleKudos() async {
    final feed = ServicesScope.of(context).feed;
    final wasLiked = item.likedByMe;
    setState(() {
      item.likedByMe = !wasLiked;
      item.kudosCount += wasLiked ? -1 : 1;
    });
    try {
      if (wasLiked) {
        await feed.unlike(item.id);
      } else {
        final r = await feed.like(item.id);
        if (mounted) {
          setState(() {
            item.likedByMe = r.likedByMe;
            item.kudosCount = r.kudosCount;
          });
        }
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          item.likedByMe = wasLiked;
          item.kudosCount += wasLiked ? 1 : -1;
        });
      }
    }
  }

  Future<void> _toggleComments() async {
    final next = !_showComments;
    setState(() => _showComments = next);
    if (next && _comments == null) {
      try {
        final c = await ServicesScope.of(context).feed.comments(item.id);
        if (mounted) setState(() => _comments = c);
      } catch (_) {
        if (mounted) setState(() => _comments = const []);
      }
    }
  }

  Future<void> _post() async {
    final text = _commentCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _posting = true);
    try {
      final c = await ServicesScope.of(context).feed.addComment(item.id, text);
      if (mounted) {
        setState(() {
          _comments = [...?_comments, c];
          _commentCount += 1;
          _commentCtrl.clear();
        });
      }
    } catch (_) {
      // leave the text so the user can retry
    } finally {
      if (mounted) setState(() => _posting = false);
    }
  }

  Future<void> _delete(FeedComment c) async {
    try {
      await ServicesScope.of(context).feed.deleteComment(item.id, c.id);
      if (mounted) {
        setState(() {
          _comments = _comments?.where((x) => x.id != c.id).toList();
          _commentCount = (_commentCount - 1).clamp(0, 1 << 30);
        });
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isVol = item.isVolunteer;
    final meta = [
      item.author.clanName,
      _relative(item.when),
      item.location.isEmpty ? null : item.location,
    ].whereType<String>().join(' · ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                _Avatar(name: item.author.name, colorHex: item.author.color),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(item.author.name,
                          style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      if (meta.isNotEmpty)
                        Text(meta, style: theme.textTheme.bodySmall?.copyWith(color: triboMuted)),
                    ],
                  ),
                ),
                _Pill(
                  label: isVol ? '🌱 Volunteer' : 'Run',
                  tone: isVol ? _PillTone.green : _PillTone.gray,
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(item.title, style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),

            // Stats
            Row(
              children: isVol
                  ? [
                      _metric('Points', '+${item.pointsEarned ?? 0}', 'pts'),
                      _metric('Role', item.role == 'STAFF' ? 'Staff' : 'Runner', null),
                      _metric('Verified', item.verifiedBy == 'PARTNER' ? 'Partner' : 'Peer', null),
                    ]
                  : [
                      _metric('Distance', (item.distanceKm ?? 0).toStringAsFixed(1), 'km'),
                      _metric('Pace', _pace(item.paceSecPerKm), '/km'),
                      _metric('Time', _duration(item.durationSeconds ?? 0), null),
                    ],
            ),
            const SizedBox(height: 8),
            const Divider(),

            // Actions
            Row(
              children: [
                _ActionButton(
                  icon: item.likedByMe ? Icons.favorite : Icons.favorite_border,
                  label: '${item.kudosCount}',
                  active: item.likedByMe,
                  onTap: _toggleKudos,
                ),
                const SizedBox(width: 8),
                _ActionButton(
                  icon: Icons.mode_comment_outlined,
                  label: '$_commentCount',
                  active: _showComments,
                  onTap: _toggleComments,
                ),
              ],
            ),

            if (_showComments) ...[
              const SizedBox(height: 8),
              _commentsSection(theme),
            ],
          ],
        ),
      ),
    );
  }

  Widget _commentsSection(ThemeData theme) {
    final me = AuthScope.of(context).user?.userId;
    final comments = _comments;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (comments == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Center(child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))),
          )
        else if (comments.isEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('No comments yet — be the first.',
                style: theme.textTheme.bodySmall?.copyWith(color: triboMuted)),
          )
        else
          ...comments.map((c) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _Avatar(name: c.author.name, colorHex: c.author.color, size: 28),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.author.name,
                              style: theme.textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                          Text(c.text, style: theme.textTheme.bodyMedium),
                        ],
                      ),
                    ),
                    if (c.author.userId == me)
                      InkWell(
                        onTap: () => _delete(c),
                        child: Padding(
                          padding: const EdgeInsets.all(4),
                          child: Text('Delete',
                              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.error)),
                        ),
                      ),
                  ],
                ),
              )),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _commentCtrl,
                minLines: 1,
                maxLines: 3,
                maxLength: 500,
                decoration: const InputDecoration(
                  hintText: 'Add a comment…',
                  counterText: '',
                  isDense: true,
                ),
              ),
            ),
            const SizedBox(width: 8),
            FilledButton(
              onPressed: _posting ? null : _post,
              child: const Text('Post'),
            ),
          ],
        ),
      ],
    );
  }

  Widget _metric(String label, String value, String? unit) {
    final theme = Theme.of(context);
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: theme.textTheme.labelSmall?.copyWith(color: triboMuted, letterSpacing: 0.5)),
          const SizedBox(height: 2),
          RichText(
            text: TextSpan(
              text: value,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700, color: triboInk),
              children: unit == null
                  ? null
                  : [
                      TextSpan(
                        text: ' $unit',
                        style: theme.textTheme.bodySmall?.copyWith(color: triboMuted),
                      ),
                    ],
            ),
          ),
        ],
      ),
    );
  }
}

// --- small shared bits -------------------------------------------------------

String _pace(int? secPerKm) {
  if (secPerKm == null || secPerKm <= 0) return '—';
  final m = secPerKm ~/ 60;
  final s = secPerKm % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

String _duration(int seconds) {
  final h = seconds ~/ 3600;
  final m = (seconds % 3600) ~/ 60;
  final s = seconds % 60;
  if (h > 0) return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  return '$m:${s.toString().padLeft(2, '0')}';
}

String _relative(DateTime when) {
  final d = DateTime.now().difference(when);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes}m ago';
  if (d.inHours < 24) return '${d.inHours}h ago';
  if (d.inDays < 7) return '${d.inDays}d ago';
  final local = when.toLocal();
  return '${local.day}/${local.month}/${local.year}';
}

Color _hexColor(String hex) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? const Color(0xFF888888) : Color(v);
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.colorHex, this.size = 40});
  final String name;
  final String colorHex;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty
        ? '?'
        : name.trim().split(RegExp(r'\s+')).take(2).map((w) => w[0].toUpperCase()).join();
    return CircleAvatar(
      radius: size / 2,
      backgroundColor: _hexColor(colorHex),
      child: Text(initials,
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: size * 0.35)),
    );
  }
}

enum _PillTone { green, gray }

class _Pill extends StatelessWidget {
  const _Pill({required this.label, required this.tone});
  final String label;
  final _PillTone tone;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bg = tone == _PillTone.green ? triboGreenSoft : const Color(0xFFEFF1EE);
    final fg = tone == _PillTone.green ? triboGreenDeep : triboMuted;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: theme.textTheme.labelMedium?.copyWith(color: fg)),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.active,
    required this.onTap,
  });
  final IconData icon;
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = active ? triboGreenDark : triboMuted;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Row(
          children: [
            Icon(icon, size: 18, color: active ? Colors.red : color),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}
