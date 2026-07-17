// lib/screens/clan_screen.dart
import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:image_cropper/image_cropper.dart';

import '../api/clans.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../api/users.dart';

/// The "Clan" tab: your clan (join / leave / create), clan chat, the clan
/// directory with search, and the live leaderboard.
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
  ('quality', 'Quality'),
];
const _periods = [('all', 'All-time'), ('month', 'This month'), ('week', 'This week')];

class _ClanScreenState extends State<ClanScreen> with SingleTickerProviderStateMixin {
  Me? _me;
  List<Clan> _clans = const [];
  ClanRanking? _ranking;
  String _metric = 'avgPace';
  String _period = 'all';
  bool _loading = true;
  bool _busy = false;
  String? _error;

  // Search
  final _searchCtrl = TextEditingController();
  String _searchQuery = '';

  // Tab controller (Chat | Directory | Leaderboard)
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 3, vsync: this);
    _searchCtrl.addListener(() => setState(() => _searchQuery = _searchCtrl.text));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _loadAll();
    });
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _tabCtrl.dispose();
    super.dispose();
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
      if (mounted) setState(() => _error = 'Failed to load clans.');
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
    } catch (_) {}
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
      if (mounted) {
        setState(() => _error = e.message);
        // Auto-clear error after 5 s
        Future.delayed(const Duration(seconds: 5), () {
          if (mounted) setState(() => _error = null);
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Action failed.');
        Future.delayed(const Duration(seconds: 5), () {
          if (mounted) setState(() => _error = null);
        });
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _createClan() async {
    final input = await showDialog<ClanInput>(
      context: context,
      builder: (ctx) => const _CreateClanDialog(),
    );
    if (input == null) return;
    _act(() => ServicesScope.of(context).clans.create(input));
  }

  Future<void> _pickAndUploadClanImage() async {
    final myClanId = _me?.clan?.id;
    if (myClanId == null) return;

    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(source: ImageSource.gallery);
      if (picked == null || !mounted) return;

      final cropped = await ImageCropper().cropImage(
        sourcePath: picked.path,
        aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: 'Crop Clan Image',
            toolbarColor: Theme.of(context).primaryColor,
            toolbarWidgetColor: Colors.white,
            initAspectRatio: CropAspectRatioPreset.square,
            lockAspectRatio: true,
          ),
          IOSUiSettings(title: 'Crop Clan Image', aspectRatioLockEnabled: true),
        ],
      );

      if (cropped == null || !mounted) return;

      final clansApi = ServicesScope.of(context).clans;
      setState(() => _busy = true);
      final bytes = await File(cropped.path).readAsBytes();
      await clansApi.uploadClanPicture(myClanId, bytes, 'clan.jpg', 'image/jpeg');
      await _loadAll();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to pick or upload picture: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // --- UI building -----------------------------------------------------------

  /// Shows a confirmation dialog, then calls leave.
  Future<void> _confirmLeave() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Leave clan?'),
        content: const Text(
            'Are you sure you want to leave your clan? You will lose access to the clan chat.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: Theme.of(ctx).colorScheme.error,
              foregroundColor: Theme.of(ctx).colorScheme.onError,
            ),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Leave'),
          ),
        ],
      ),
    );
    if (confirmed == true && mounted) {
      await _act(() => ServicesScope.of(context).clans.leave());
      // After leaving, switch to directory tab
      _tabCtrl.animateTo(1);
    }
  }

  /// Join guard: block if already in a clan.
  Future<void> _tryJoin(String clanId) async {
    if (_me?.clan != null) {
      setState(() => _error = "You're already in a clan. Leave your current clan first.");
      Future.delayed(const Duration(seconds: 5), () {
        if (mounted) setState(() => _error = null);
      });
      return;
    }
    await _act(() => ServicesScope.of(context).clans.join(clanId));
  }

  void _openClanDetail(Clan clan) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ClanDetailSheet(clan: clan, clansApi: ServicesScope.of(context).clans),
    );
  }

  @override
  Widget build(BuildContext context) {
    final myClanId = _me?.clan?.id;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Clan'),
        bottom: TabBar(
          controller: _tabCtrl,
          tabs: [
            Tab(
              icon: const Icon(Icons.chat_bubble_outline),
              text: 'Chat',
            ),
            const Tab(icon: Icon(Icons.groups_outlined), text: 'Clans'),
            const Tab(icon: Icon(Icons.leaderboard_outlined), text: 'Ranking'),
          ],
        ),
      ),
      body: _loading && _me == null
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  _ErrorBanner(
                    message: _error!,
                    onDismiss: () => setState(() => _error = null),
                  ),
                Expanded(
                  child: TabBarView(
                    controller: _tabCtrl,
                    children: [
                      // ── Chat ──────────────────────────────────────────────
                      if (myClanId != null)
                        _ClanChatTab(
                          clanId: myClanId,
                          myUserId: _me!.userId,
                          clansApi: ServicesScope.of(context).clans,
                        )
                      else
                        Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                const Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey),
                                const SizedBox(height: 12),
                                Text(
                                  "You're not in a clan yet.",
                                  style: Theme.of(context).textTheme.titleMedium,
                                ),
                                const SizedBox(height: 8),
                                const Text('Join or create a clan to access the chat.'),
                                const SizedBox(height: 16),
                                FilledButton(
                                  onPressed: () => _tabCtrl.animateTo(1),
                                  child: const Text('Browse clans'),
                                ),
                              ],
                            ),
                          ),
                        ),

                      // ── Clan Directory ────────────────────────────────────
                      RefreshIndicator(
                        onRefresh: _loadAll,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            _yourClanCard(),
                            const SizedBox(height: 16),
                            _allClansSection(),
                          ],
                        ),
                      ),

                      // ── Leaderboard ───────────────────────────────────────
                      RefreshIndicator(
                        onRefresh: _loadAll,
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [_leaderboardSection()],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  // --- Your clan card --------------------------------------------------------

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
                  GestureDetector(
                    onTap: _busy ? null : _pickAndUploadClanImage,
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        ClanAvatar(tag: clan.tag, colorHex: clan.color, pictureUrl: clan.pictureUrl),
                        Container(
                          padding: const EdgeInsets.all(2),
                          decoration: BoxDecoration(
                            color: theme.primaryColor,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.camera_alt, size: 12, color: Colors.white),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(clan.name, style: theme.textTheme.titleSmall)),
                  TextButton(
                    onPressed: _busy ? null : _confirmLeave,
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

  // --- All clans section -----------------------------------------------------

  Widget _allClansSection() {
    final theme = Theme.of(context);
    final myId = _me?.clan?.id;

    final filtered = _searchQuery.isEmpty
        ? _clans
        : _clans.where((c) {
            final q = _searchQuery.toLowerCase();
            return c.name.toLowerCase().contains(q) || c.tag.toLowerCase().contains(q);
          }).toList();

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
        const SizedBox(height: 10),
        // Search bar
        TextField(
          controller: _searchCtrl,
          decoration: InputDecoration(
            hintText: 'Search by name or tag...',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _searchQuery.isNotEmpty
                ? IconButton(
                    icon: const Icon(Icons.clear),
                    onPressed: () => _searchCtrl.clear(),
                  )
                : null,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            isDense: true,
          ),
        ),
        const SizedBox(height: 12),
        if (filtered.isEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                _clans.isEmpty
                    ? 'No clans yet — be the first to create one.'
                    : 'No clans match your search.',
                style: theme.textTheme.bodyMedium
                    ?.copyWith(color: theme.colorScheme.outline),
              ),
            ),
          )
        else
          ...filtered.map((c) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  onTap: () => _openClanDetail(c),
                  leading: ClanAvatar(tag: c.tag, colorHex: c.color),
                  title: Text(c.name),
                  subtitle: Text('${c.memberCount} member${c.memberCount == 1 ? '' : 's'}'),
                  trailing: c.id == myId
                      ? const Chip(label: Text("You're in"))
                      : OutlinedButton(
                          onPressed: _busy ? null : () => _tryJoin(c.id),
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
            ClanAvatar(tag: r.tag, colorHex: r.color, small: true),
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
      case 'quality':
        return r.qualityRating != null
            ? '★ ${r.qualityRating!.toStringAsFixed(1)}'
            : '★ —';
      default:
        return '${_formatPace(r.avgPaceSecPerKm)}/km';
    }
  }
}

// =============================================================================
// Clan Detail Bottom Sheet (members list)
// =============================================================================

class _ClanDetailSheet extends StatefulWidget {
  const _ClanDetailSheet({required this.clan, required this.clansApi});
  final Clan clan;
  final ClansApi clansApi;

  @override
  State<_ClanDetailSheet> createState() => _ClanDetailSheetState();
}

class _ClanDetailSheetState extends State<_ClanDetailSheet> {
  List<ClanMember>? _members;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final m = await widget.clansApi.members(widget.clan.id);
      if (mounted) setState(() => _members = m);
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to load members.');
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final clan = widget.clan;
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      expand: false,
      builder: (_, scrollCtrl) => Column(
        children: [
          // Handle bar
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 8),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: theme.colorScheme.outlineVariant,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                ClanAvatar(tag: clan.tag, colorHex: clan.color),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(clan.name, style: theme.textTheme.titleMedium),
                    Text(
                      '${clan.memberCount} member${clan.memberCount == 1 ? '' : 's'}',
                      style: theme.textTheme.bodySmall
                          ?.copyWith(color: theme.colorScheme.outline),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(),
          // Members list
          Expanded(
            child: _members == null && _error == null
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? Center(child: Text(_error!, style: TextStyle(color: theme.colorScheme.error)))
                    : ListView.builder(
                        controller: scrollCtrl,
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        itemCount: _members!.length,
                        itemBuilder: (_, i) {
                          final m = _members![i];
                          final isOwner = m.role == 'owner';
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: _hexColor(clan.color).withValues(alpha: 0.2),
                              child: Text(
                                m.fullName.isNotEmpty ? m.fullName[0].toUpperCase() : '?',
                                style: TextStyle(
                                  color: _hexColor(clan.color),
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            title: Text(m.fullName),
                            trailing: isOwner
                                ? Chip(
                                    label: const Text('Owner'),
                                    backgroundColor:
                                        theme.colorScheme.primaryContainer,
                                    labelStyle: TextStyle(
                                      color: theme.colorScheme.onPrimaryContainer,
                                      fontSize: 12,
                                    ),
                                    padding: EdgeInsets.zero,
                                    materialTapTargetSize:
                                        MaterialTapTargetSize.shrinkWrap,
                                  )
                                : null,
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// Clan Chat Tab
// =============================================================================

class _ClanChatTab extends StatefulWidget {
  const _ClanChatTab({
    required this.clanId,
    required this.myUserId,
    required this.clansApi,
  });
  final String clanId;
  final String myUserId;
  final ClansApi clansApi;

  @override
  State<_ClanChatTab> createState() => _ClanChatTabState();
}

class _ClanChatTabState extends State<_ClanChatTab> {
  List<ClanMessage> _messages = [];
  final _textCtrl = TextEditingController();
  final _scrollCtrl = ScrollController();
  bool _sending = false;
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) => _loadMessages());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _textCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    try {
      final msgs = await widget.clansApi.getMessages(widget.clanId);
      if (!mounted) return;
      final wasAtBottom = !_scrollCtrl.hasClients ||
          _scrollCtrl.position.pixels >= _scrollCtrl.position.maxScrollExtent - 60;
      setState(() => _messages = msgs);
      if (wasAtBottom) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_scrollCtrl.hasClients) {
            _scrollCtrl.animateTo(
              _scrollCtrl.position.maxScrollExtent,
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
            );
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _send() async {
    final text = _textCtrl.text.trim();
    if (text.isEmpty || _sending) return;
    _textCtrl.clear();
    setState(() => _sending = true);
    try {
      await widget.clansApi.sendMessage(widget.clanId, text);
      await _loadMessages();
    } catch (_) {
      // Silently ignore send errors — message simply doesn't appear
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      children: [
        Expanded(
          child: _messages.isEmpty
              ? Center(
                  child: Text('No messages yet. Say hi! 👋',
                      style: theme.textTheme.bodyMedium
                          ?.copyWith(color: theme.colorScheme.outline)),
                )
              : ListView.builder(
                  controller: _scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: _messages.length,
                  itemBuilder: (_, i) {
                    final msg = _messages[i];
                    final isMe = msg.userId == widget.myUserId;
                    return _ChatBubble(message: msg, isMe: isMe);
                  },
                ),
        ),
        // Input bar
        SafeArea(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: theme.colorScheme.surface,
              border: Border(top: BorderSide(color: theme.colorScheme.outlineVariant)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _textCtrl,
                    minLines: 1,
                    maxLines: 4,
                    decoration: InputDecoration(
                      hintText: 'Message your clan...',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                      isDense: true,
                    ),
                    onSubmitted: (_) => _send(),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: _sending ? null : _send,
                  icon: _sending
                      ? const SizedBox(
                          width: 20, height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.message, required this.isMe});
  final ClanMessage message;
  final bool isMe;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          if (!isMe)
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 2),
              child: Text(
                message.fullName,
                style: theme.textTheme.labelSmall
                    ?.copyWith(color: theme.colorScheme.primary, fontWeight: FontWeight.bold),
              ),
            ),
          Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.72,
            ),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: isMe ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHigh,
              borderRadius: BorderRadius.only(
                topLeft: const Radius.circular(16),
                topRight: const Radius.circular(16),
                bottomLeft: Radius.circular(isMe ? 16 : 4),
                bottomRight: Radius.circular(isMe ? 4 : 16),
              ),
            ),
            child: Text(
              message.text,
              style: TextStyle(
                color: isMe ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// Error Banner
// =============================================================================

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message, required this.onDismiss});
  final String message;
  final VoidCallback onDismiss;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return MaterialBanner(
      backgroundColor: theme.colorScheme.errorContainer,
      content: Text(message,
          style: TextStyle(color: theme.colorScheme.onErrorContainer)),
      actions: [
        TextButton(
          onPressed: onDismiss,
          child: Text('Dismiss',
              style: TextStyle(color: theme.colorScheme.onErrorContainer)),
        ),
      ],
    );
  }
}

// =============================================================================
// Create Clan Dialog
// =============================================================================

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

// =============================================================================
// Shared helpers
// =============================================================================

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

class ClanAvatar extends StatelessWidget {
  const ClanAvatar({super.key, required this.tag, required this.colorHex, this.pictureUrl, this.small = false});

  final String tag;
  final String colorHex;
  final String? pictureUrl;
  final bool small;

  @override
  Widget build(BuildContext context) {
    final size = small ? 26.0 : 36.0;
    
    if (pictureUrl != null && pictureUrl!.isNotEmpty) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: _hexColor(colorHex),
          borderRadius: BorderRadius.circular(8),
          image: DecorationImage(
            image: NetworkImage(pictureUrl!),
            fit: BoxFit.cover,
          ),
        ),
      );
    }

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
