// lib/screens/activities_screen.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../api/activities.dart';
import '../api/geo.dart';
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

  // Filters — the server does the filtering so paging stays correct.
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  String _kind = 'ALL'; // ALL | RUN | VOLUNTEER
  Position? _near;
  double _radiusKm = 25;
  bool _geoBusy = false;

  static const _kinds = [
    ('ALL', 'All'),
    ('VOLUNTEER', 'Volunteer'),
    ('RUN', 'Runs'),
  ];

  static const _radii = [5.0, 10.0, 25.0, 50.0];

  @override
  void initState() {
    super.initState();
    // Defer to after the first frame: _load() reads ServicesScope via
    // dependOnInheritedWidgetOfExactType, which is illegal during initState.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load(reset: true);
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      final q = value.trim();
      if (q == _query) return;
      setState(() => _query = q);
      _load(reset: true);
    });
  }

  void _setKind(String kind) {
    if (kind == _kind) return;
    setState(() => _kind = kind);
    _load(reset: true);
  }

  Future<void> _toggleNear() async {
    if (_near != null) {
      setState(() => _near = null);
      _load(reset: true);
      return;
    }
    setState(() => _geoBusy = true);
    try {
      final pos = await currentPosition();
      if (!mounted) return;
      setState(() => _near = pos);
      _load(reset: true);
    } on GeoException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _geoBusy = false);
    }
  }

  Future<void> _load({required bool reset}) async {
    setState(() {
      _error = null;
      if (reset) _loading = true;
    });
    try {
      final api = ServicesScope.of(context).activities;
      final page = await api.list(
        status: 'PUBLISHED',
        cursor: reset ? null : _cursor,
        q: _query,
        eventKind: _kind,
        nearLat: _near?.latitude,
        nearLng: _near?.longitude,
        radiusKm: _near != null ? _radiusKm : null,
      );
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
      body: Column(
        children: [
          _filterBar(),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(reset: true),
              child: _buildBody(canManage, user?.verified),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterBar() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          TextField(
            controller: _searchController,
            onChanged: _onSearchChanged,
            textInputAction: TextInputAction.search,
            decoration: InputDecoration(
              hintText: 'Search by title, place, host or tag…',
              prefixIcon: const Icon(Icons.search),
              isDense: true,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(999),
              ),
              suffixIcon: _query.isEmpty
                  ? null
                  : IconButton(
                      icon: const Icon(Icons.clear),
                      onPressed: () {
                        _searchController.clear();
                        _onSearchChanged('');
                      },
                    ),
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 4,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              for (final k in _kinds)
                ChoiceChip(
                  label: Text(k.$2),
                  selected: _kind == k.$1,
                  onSelected: (_) => _setKind(k.$1),
                ),
              FilterChip(
                avatar: _geoBusy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location, size: 18),
                label: const Text('Near me'),
                selected: _near != null,
                onSelected: _geoBusy ? null : (_) => _toggleNear(),
              ),
              if (_near != null)
                DropdownButton<double>(
                  value: _radiusKm,
                  isDense: true,
                  underline: const SizedBox.shrink(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() => _radiusKm = v);
                    _load(reset: true);
                  },
                  items: [
                    for (final r in _radii)
                      DropdownMenuItem(
                        value: r,
                        child: Text('within ${r.toStringAsFixed(0)} km'),
                      ),
                  ],
                ),
            ],
          ),
        ],
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
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 32),
            child: Center(
              child: Text(
                _query.isNotEmpty || _kind != 'ALL'
                    ? 'No activities match your filters.'
                    : 'No activities yet.',
              ),
            ),
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
    final ended = a.status != 'CANCELLED' && a.endsAt.isBefore(DateTime.now());
    final meta = <String>[
      a.location.isEmpty ? '—' : a.location,
      if (a.eventKind == 'VOLUNTEER' && a.distanceKm > 0)
        '${a.distanceKm.toStringAsFixed(a.distanceKm % 1 == 0 ? 0 : 1)} km',
      'cap ${a.capacity}',
      if (a.reviewCount > 0)
        '★ ${a.averageRating.toStringAsFixed(1)} (${a.reviewCount})',
    ].join(' · ');
    return Opacity(
      opacity: ended ? 0.55 : 1,
      child: Card(
      child: ListTile(
        leading: CircleAvatar(
          backgroundColor: a.eventKind == 'VOLUNTEER'
              ? const Color(0xFF2E9E46)
              : const Color(0xFF3B7DDD),
          child: Icon(
            a.eventKind == 'VOLUNTEER' ? Icons.volunteer_activism : Icons.directions_run,
            color: Colors.white,
            size: 20,
          ),
        ),
        title: Text(a.title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text('${a.startsAt.toLocal()}\n$meta'),
        isThreeLine: true,
        trailing: ended
            ? const Text('Ended',
                style: TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w600))
            : null,
        onTap: () => _openDetail(a.id),
      ),
      ),
    );
  }
}
