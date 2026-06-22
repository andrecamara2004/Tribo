// lib/screens/profile_screen.dart
import 'package:flutter/material.dart';

import '../api/http.dart';
import '../api/services_scope.dart';
import '../api/users.dart';
import '../auth/auth_scope.dart';

/// Sprint 3 profile, ported to mobile from the web ProfilePage. Reads the
/// DB-backed GET /users/me: identity header, role/verification, and the
/// volunteer-impact stats. Clan join/leave and running stats are left for a
/// follow-up — this is the read-only v1. Logout lives here (the web keeps it
/// in the nav shell; on mobile the account screen is the natural home).
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  Me? _me;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Defer: _load() reads ServicesScope, which can't be done in initState.
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
      final me = await ServicesScope.of(context).users.getMe();
      if (!mounted) return;
      setState(() => _me = me);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to load profile: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Log out',
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    if (_loading && _me == null) {
      return const Center(child: CircularProgressIndicator());
    }

    final theme = Theme.of(context);
    final me = _me;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        if (me != null) ...[
          // --- Identity header -------------------------------------------
          Row(
            children: [
              _Avatar(name: me.fullName, colorHex: me.avatarColor),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      me.fullName.isEmpty ? 'Tribo user' : me.fullName,
                      style: theme.textTheme.titleLarge,
                    ),
                    if (me.handle.isNotEmpty)
                      Text(
                        me.handle,
                        style: theme.textTheme.bodyMedium
                            ?.copyWith(color: theme.colorScheme.outline),
                      ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Chip(label: me.role.replaceAll('_', ' ')),
              if (me.clan != null)
                _Chip(label: '${me.clan!.name} · ${me.clan!.tag}', dotHex: me.clan!.color)
              else
                const _Chip(label: 'No clan yet', muted: true),
              if (!me.verified) const _Chip(label: 'Pending verification', warn: true),
            ],
          ),
          const SizedBox(height: 20),

          // --- Impact stats ----------------------------------------------
          Text('Impact', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: _StatCard(
                  icon: Icons.eco_outlined,
                  label: 'Volunteer',
                  value: '${me.volunteerPoints} pts',
                  sub: '${me.volunteerEvents} event${me.volunteerEvents == 1 ? '' : 's'}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _StatCard(
                  icon: Icons.badge_outlined,
                  label: 'Staff',
                  value: me.staffEligible ? 'Eligible' : 'Locked',
                  sub: me.staffEligible
                      ? 'You can staff events'
                      : '${(3 - me.volunteerEvents).clamp(0, 3)} more to unlock',
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // --- Achievements ----------------------------------------------
          Text('Achievements', style: theme.textTheme.titleSmall),
          const SizedBox(height: 8),
          if (me.achievements.isEmpty)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text(
                  'Run and volunteer to earn badges.',
                  style: theme.textTheme.bodyMedium
                      ?.copyWith(color: theme.colorScheme.outline),
                ),
              ),
            )
          else
            ...me.achievements.map(
              (a) => Card(
                margin: const EdgeInsets.only(bottom: 8),
                child: ListTile(
                  leading: Text(a.icon, style: const TextStyle(fontSize: 24)),
                  title: Text(a.title),
                  subtitle: Text(a.sub),
                ),
              ),
            ),

          const SizedBox(height: 8),
          Center(
            child: Text(
              me.email,
              style: theme.textTheme.bodySmall
                  ?.copyWith(color: theme.colorScheme.outline),
            ),
          ),
        ],
      ],
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.name, required this.colorHex});

  final String name;
  final String colorHex;

  @override
  Widget build(BuildContext context) {
    final initials = name.trim().isEmpty
        ? '?'
        : name
            .trim()
            .split(RegExp(r'\s+'))
            .take(2)
            .map((w) => w[0].toUpperCase())
            .join();
    return CircleAvatar(
      radius: 32,
      backgroundColor: _parseHex(colorHex),
      child: Text(
        initials,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
          fontSize: 22,
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    required this.sub,
  });

  final IconData icon;
  final String label;
  final String value;
  final String sub;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: theme.colorScheme.primary, size: 20),
            const SizedBox(height: 8),
            Text(label,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
            Text(value, style: theme.textTheme.titleMedium),
            Text(sub,
                style: theme.textTheme.bodySmall
                    ?.copyWith(color: theme.colorScheme.outline)),
          ],
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    this.dotHex,
    this.warn = false,
    this.muted = false,
  });

  final String label;
  final String? dotHex;
  final bool warn;
  final bool muted;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final bg = warn
        ? const Color(0xFFFFF3CD)
        : theme.colorScheme.surfaceContainerHighest;
    final fg = warn
        ? const Color(0xFF8A6D00)
        : (muted ? theme.colorScheme.outline : theme.colorScheme.onSurface);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (dotHex != null) ...[
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: _parseHex(dotHex!),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 6),
          ],
          Text(label, style: theme.textTheme.labelMedium?.copyWith(color: fg)),
        ],
      ),
    );
  }
}

/// "#1B8A5A" → Color. Falls back to grey on anything unparseable.
Color _parseHex(String hex) {
  var h = hex.replaceAll('#', '').trim();
  if (h.length == 6) h = 'FF$h';
  final v = int.tryParse(h, radix: 16);
  return v == null ? const Color(0xFF888888) : Color(v);
}
