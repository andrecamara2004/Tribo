// lib/screens/activities_screen.dart
import 'package:flutter/material.dart';

import '../api/activities.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../auth/auth_scope.dart';
import 'activity_detail_screen.dart';
import 'activity_form_screen.dart';

/// M2-1 — Activity catalog. Lives in the "Volunteer" tab of the AppShell.
class ActivitiesScreen extends StatefulWidget {
  const ActivitiesScreen({super.key});

  @override
  State<ActivitiesScreen> createState() => _ActivitiesScreenState();
}

class _ActivitiesScreenState extends State<ActivitiesScreen> {
  final List<Activity> _items = [];
  String? _cursor;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    // Defer to after the first frame: _load() reads ServicesScope via
    // dependOnInheritedWidgetOfExactType, which is illegal during initState.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(reset: true);
    });
  }

  Future<void> _load({required bool reset}) async {
    setState(() {
      _error = null;
      if (reset) _loading = true;
    });
    try {
      final api = ServicesScope.of(context).activities;
      final page = await api.list(status: 'PUBLISHED', cursor: reset ? null : _cursor);
      if (!mounted) return;
      setState(() {
        if (reset) _items.clear();
        _items.addAll(page.items);
        _cursor = page.nextCursor;
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      // Surface the real cause — a bare "Failed to load activities." hides
      // device-level faults (e.g. secure-storage / token read) that aren't
      // HTTP errors and make this impossible to diagnose from the screen.
      debugPrint('activities load failed: $e');
      if (mounted) setState(() => _error = 'Failed to load activities: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openDetail(String id) async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ActivityDetailScreen(activityId: id)),
    );
    if (mounted) _load(reset: true); // refresh on return (status may have changed)
  }

  Future<void> _create() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => const ActivityFormScreen()),
    );
    if (mounted) _load(reset: true);
  }

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);
    final user = auth.user;
    final canManage = user?.canManage ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Volunteer activities'),
      ),
      floatingActionButton: canManage
          ? FloatingActionButton.extended(
              onPressed: _create,
              icon: const Icon(Icons.add),
              label: const Text('Create'),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: () => _load(reset: true),
        child: _buildBody(canManage, user?.verified),
      ),
    );
  }

  Widget _buildBody(bool canManage, bool? verified) {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        if (canManage && verified == false)
          Card(
            color: const Color(0xFFFFF3CD),
            child: const Padding(
              padding: EdgeInsets.all(12),
              child: Text(
                'Your account is pending backoffice verification. You can browse, '
                'but creating activities will be rejected until you are verified.',
              ),
            ),
          ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(_error!, style: const TextStyle(color: Colors.red)),
          ),
        if (!_loading && _items.isEmpty && _error == null)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 32),
            child: Center(child: Text('No activities yet.')),
          ),
        ..._items.map(_activityTile),
        if (_cursor != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: OutlinedButton(
              onPressed: () => _load(reset: false),
              child: const Text('Load more'),
            ),
          ),
      ],
    );
  }

  Widget _activityTile(Activity a) {
    return Card(
      child: ListTile(
        title: Text(a.title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(
          '${a.startsAt.toLocal()}\n${a.location.isEmpty ? '—' : a.location} · cap ${a.capacity}',
        ),
        isThreeLine: true,
        onTap: () => _openDetail(a.id),
      ),
    );
  }
}
