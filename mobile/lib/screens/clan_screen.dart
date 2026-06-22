// lib/screens/clan_screen.dart
import 'package:flutter/material.dart';

import '../api/clans.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../api/users.dart';

/// The "Clan" tab: your clan (join / leave / create), the clan directory, and
/// the live leaderboard. Mirrors the web ClanPage — clan management is a
/// first-class destination here, not buried in Profile.
class ClanScreen extends StatefulWidget {
  const ClanScreen({super.key});

  @override
  State<ClanScreen> createState() => _ClanScreenState();
}

const _metrics = [
  ('avgPace', 'Avg pace'),
  ('distance', 'Distance'),
  ('consistency', 'Consistency'),
  ('impact', 'Impact'),
];
const _periods = [('all', 'All-time'), ('month', 'This month'), ('week', 'This week')];

class _ClanScreenState extends State<ClanScreen> {
  Me? _me;
  List<Clan> _clans = const [];
  ClanRanking? _ranking;
  String _metric = 'avgPace';
  String _period = 'all';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadAll();
    });
  }

  Future<void> _loadAll() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final svc = ServicesScope.of(context);
    try {
      final results = await Future.wait([
        svc.users.getMe(),
        svc.clans.list(),
        svc.clans.ranking(metric: _metric, period: _period),
      ]);
      if (!mounted) return;
      setState(() {
        _me = results[0] as Me;
        _clans = results[1] as List<Clan>;
        _ranking = results[2] as ClanRanking;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('clan load failed: $e');
      if (mounted) setState(() => _error = 'Failed to load clans: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _reloadRanking() async {
    try {
      final r = await ServicesScope.of(context)
          .clans
          .ranking(metric: _metric, period: _period);
      if (mounted) setState(() => _ranking = r);
    } catch (_) {
      /* leave the previous ranking on a transient error */
    }
  }

  /// Run a mutating action (join/leave/create), then refresh membership + lists.
  Future<void> _act(Future<void> Function() fn) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final svc = ServicesScope.of(context);
    try {
      await fn();
      final results = await Future.wait([svc.users.getMe(), svc.clans.list()]);
      if (!mounted) return;
      setState(() {
        _me = results[0] as Me;
        _clans = results[1] as List<Clan>;
      });
      await _reloadRanking();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Action failed: $e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createClan() async {
    final svc = ServicesScope.of(context);
    final input = await showDialog<ClanInput>(
      context: context,
      builder: (_) => const _CreateClanDialog(),
    );
    if (input == null) return;
    await _act(() => svc.clans.create(input).then((_) {}));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Clan')),
      body: RefreshIndicator(
        onRefresh: _loadAll,
        child: _loading && _me == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: const TextStyle(color: Colors.red)),
                    ),
                  _yourClanCard(),
                  const SizedBox(height: 20),
                  _allClansSection(),
                  const SizedBox(height: 24),
                  _leaderboardSection(),
                ],
              ),
      ),
    );
  }

  // --- Your clan -------------------------------------------------------------

  Widget _yourClanCard() {
    final theme = Theme.of(context);
    final clan = _me?.clan;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Your clan', style: theme.textTheme.titleMedium),
            const SizedBox(height: 12),
            if (clan != null)
              Row(
                children: [
                  _ClanTag(tag: clan.tag, colorHex: clan.color),
                  const SizedBox(width: 10),
                  Expanded(child: Text(clan.name, style: theme.textTheme.titleSmall)),
                  TextButton(
                    onPressed: _busy ? null : () => _act(() => ServicesScope.of(context).clans.leave()),
                    style: TextButton.styleFrom(foregroundColor: theme.colorScheme.error),
                    child: const Text('Leave'),
                  ),
                ],
              )
            else
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "You're not in a clan yet. Join one below or create your own.",
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: _busy ? null : _createClan,
                    icon: const Icon(Icons.add),
                    label: const Text('Create a clan'),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }

  // --- All clans -------------------------------------------------------------

  Widget _allClansSection() {
    final theme = Theme.of(context);
    final myId = _me?.clan?.id;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text('All clans', style: theme.textTheme.titleSmall),
            const Spacer(),
            Text('${_clans.length} active',
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ],
        ),
        const SizedBox(height: 8),
        if (_clans.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No clans yet — be the first to create one.',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
            ),
          )
        else
          ..._clans.map((c) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: _ClanTag(tag: c.tag, colorHex: c.color),
                  title: Text(c.name),
                  subtitle: Text('${c.memberCount} member${c.memberCount == 1 ? '' : 's'}'),
                  trailing: c.id == myId
                      ? const Chip(label: Text("You're in"))
                      : OutlinedButton(
                          onPressed: _busy ? null : () => _act(() => ServicesScope.of(context).clans.join(c.id)),
                          child: const Text('Join'),
                        ),
                ),
              )),
      ],
    );
  }

  // --- Leaderboard -----------------------------------------------------------

  Widget _leaderboardSection() {
    final theme = Theme.of(context);
    final rows = _ranking?.clans ?? const [];
    final myId = _me?.clan?.id;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Leaderboard', style: theme.textTheme.titleSmall),
        Text('Live · weekly reset Sun 23:59',
            style: theme.textTheme.bodySmall
                ?.copyWith(color: theme.colorScheme.outline)),
        const SizedBox(height: 10),
        Wrap(
          spacing: 8,
          children: [
            for (final m in _metrics)
              ChoiceChip(
                label: Text(m.$2),
                selected: _metric == m.$1,
                onSelected: (_) {
                  setState(() => _metric = m.$1);
                  _reloadRanking();
                },
              ),
          ],
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: [
            for (final p in _periods)
              ChoiceChip(
                label: Text(p.$2),
                selected: _period == p.$1,
                onSelected: (_) {
                  setState(() => _period = p.$1);
                  _reloadRanking();
                },
              ),
          ],
        ),
        const SizedBox(height: 12),
        if (rows.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text('No clans ranked yet.',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline)),
            ),
          )
        else
          ...rows.map((r) => _rankRow(r, r.id == myId)),
      ],
    );
  }

  Widget _rankRow(ClanRankRow r, bool mine) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: mine ? theme.colorScheme.primaryContainer : null,
      child: ListTile(
        leading: SizedBox(
          width: 28,
          child: Text('${r.rank}',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.bold,
                color: r.rank == 1 ? theme.colorScheme.primary : theme.colorScheme.outline,
              )),
        ),
        title: Row(
          children: [
            _ClanTag(tag: r.tag, colorHex: r.color, small: true),
            const SizedBox(width: 8),
            Flexible(child: Text(r.name, overflow: TextOverflow.ellipsis)),
            if (mine)
              const Padding(
                padding: EdgeInsets.only(left: 6),
                child: Text('You', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              ),
          ],
        ),
        subtitle: Text('${r.members} member${r.members == 1 ? '' : 's'} · ${r.consistencyPct}% active'),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_headline(r), style: theme.textTheme.titleSmall),
            const SizedBox(width: 4),
            Text(
              r.trend == 'up' ? '↑' : r.trend == 'down' ? '↓' : '→',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: r.trend == 'up'
                    ? Colors.green
                    : r.trend == 'down'
                        ? theme.colorScheme.error
                        : theme.colorScheme.outline,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _headline(ClanRankRow r) {
    switch (_metric) {
      case 'distance':
        return '${r.distanceFor(_period).toStringAsFixed(0)} km';
      case 'consistency':
        return '${r.consistencyPct}%';
      case 'impact':
        return '${r.volunteerPoints} pts';
      default:
        return '${_formatPace(r.avgPaceSecPerKm)}/km';
    }
  }
}

/// sec/km → "m:ss"; em dash when there's no pace yet.
String _formatPace(double? secPerKm) {
  if (secPerKm == null || secPerKm <= 0) return '—';
  final total = secPerKm.round();
  final m = total ~/ 60;
  final s = total % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

Color _hexColor(String hex) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? const Color(0xFF888888) : Color(v);
}

class _ClanTag extends StatelessWidget {
  const _ClanTag({required this.tag, required this.colorHex, this.small = false});

  final String tag;
  final String colorHex;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final size = small ? 26.0 : 36.0;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: _hexColor(colorHex),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        tag,
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w800,
          fontSize: small ? 10 : 12,
        ),
      ),
    );
  }
}

/// Minimal create-clan form returned as a [ClanInput], or null on cancel.
class _CreateClanDialog extends StatefulWidget {
  const _CreateClanDialog();

  @override
  State<_CreateClanDialog> createState() => _CreateClanDialogState();
}

class _CreateClanDialogState extends State<_CreateClanDialog> {
  final _name = TextEditingController();
  final _tag = TextEditingController();
  static const _palette = [
    '#00B86B', '#0EA5E9', '#F4B400', '#A855F7', '#EF4444', '#066B3F',
  ];
  String _color = _palette.first;

  @override
  void dispose() {
    _name.dispose();
    _tag.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Create a clan'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder()),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _tag,
            maxLength: 5,
            textCapitalization: TextCapitalization.characters,
            decoration: const InputDecoration(
              labelText: 'Tag (e.g. FOR)',
              border: OutlineInputBorder(),
            ),
          ),
          const SizedBox(height: 4),
          Align(
            alignment: Alignment.centerLeft,
            child: Text('Colour', style: Theme.of(context).textTheme.bodySmall),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 8,
            children: [
              for (final c in _palette)
                GestureDetector(
                  onTap: () => setState(() => _color = c),
                  child: Container(
                    width: 30,
                    height: 30,
                    decoration: BoxDecoration(
                      color: _hexColor(c),
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: _color == c ? Colors.black : Colors.transparent,
                        width: 2,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final name = _name.text.trim();
            final tag = _tag.text.trim().toUpperCase();
            if (name.isEmpty || tag.isEmpty) return;
            Navigator.pop(context, ClanInput(name: name, tag: tag, color: _color));
          },
          child: const Text('Create'),
        ),
      ],
    );
  }
}
