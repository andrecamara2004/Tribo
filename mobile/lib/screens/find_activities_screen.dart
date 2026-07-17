// lib/screens/find_activities_screen.dart
//
// "Find activities" — all published activities that have a location pin, shown
// on a Google Map. Mirrors the web /discover screen. Tap a pin's info window to
// open the activity detail.
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/activities.dart';
import '../api/geo.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import 'activity_detail_screen.dart';

const _lisbon = CameraPosition(target: LatLng(38.7223, -9.1393), zoom: 11);

class FindActivitiesScreen extends StatefulWidget {
  const FindActivitiesScreen({super.key});

  @override
  State<FindActivitiesScreen> createState() => _FindActivitiesScreenState();
}

class _FindActivitiesScreenState extends State<FindActivitiesScreen> {
  final List<Activity> _located = [];
  GoogleMapController? _controller;
  bool _loading = true;
  String? _error;

  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  String _kind = 'ALL'; // ALL | RUN | VOLUNTEER
  Position? _near;
  double _radiusKm = 25;
  bool _geoBusy = false;

  static const _radii = [5.0, 10.0, 25.0, 50.0];

  static const _kinds = [
    ('ALL', 'All'),
    ('VOLUNTEER', 'Volunteer'),
    ('RUN', 'Runs'),
  ];

  @override
  void initState() {
    super.initState();
    // Defer: _load() reads ServicesScope, which can't be done in initState.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _controller?.dispose();
    super.dispose();
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      final q = value.trim();
      if (q == _query) return;
      setState(() => _query = q);
      _load();
    });
  }

  void _setKind(String kind) {
    if (kind == _kind) return;
    setState(() => _kind = kind);
    _load();
  }

  Future<void> _toggleNear() async {
    if (_near != null) {
      setState(() => _near = null);
      _load();
      return;
    }
    setState(() => _geoBusy = true);
    try {
      final pos = await currentPosition();
      if (!mounted) return;
      setState(() => _near = pos);
      _load();
    } on GeoException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _geoBusy = false);
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ServicesScope.of(context).activities;
      final page = await api.list(
        status: 'PUBLISHED',
        limit: 100,
        q: _query,
        eventKind: _kind,
        nearLat: _near?.latitude,
        nearLng: _near?.longitude,
        radiusKm: _near != null ? _radiusKm : null,
      );
      if (!mounted) return;
      setState(() {
        _located
          ..clear()
          ..addAll(page.items.where((a) => a.hasLocation));
        _error = null;
      });
      _fitToMarkers();
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('find activities load failed: $e');
      if (mounted) setState(() => _error = 'Failed to load activities: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openDetail(String id) {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ActivityDetailScreen(activityId: id)),
    );
  }

  Set<Marker> get _markers => _located
      .map((a) => Marker(
            markerId: MarkerId(a.id),
            position: LatLng(a.latitude!, a.longitude!),
            // Colour the pin by type so runs and volunteer events stand apart.
            icon: BitmapDescriptor.defaultMarkerWithHue(
              a.eventKind == 'VOLUNTEER'
                  ? BitmapDescriptor.hueGreen
                  : BitmapDescriptor.hueAzure,
            ),
            infoWindow: InfoWindow(
              title: a.title,
              snippet: a.location.isEmpty ? 'Tap to view' : a.location,
              onTap: () => _openDetail(a.id),
            ),
          ))
      .toSet();

  void _fitToMarkers() {
    final c = _controller;
    if (c == null || _located.isEmpty) return;
    if (_located.length == 1) {
      c.animateCamera(CameraUpdate.newLatLngZoom(
          LatLng(_located.first.latitude!, _located.first.longitude!), 14));
      return;
    }
    var minLat = 90.0, maxLat = -90.0, minLng = 180.0, maxLng = -180.0;
    for (final a in _located) {
      minLat = a.latitude! < minLat ? a.latitude! : minLat;
      maxLat = a.latitude! > maxLat ? a.latitude! : maxLat;
      minLng = a.longitude! < minLng ? a.longitude! : minLng;
      maxLng = a.longitude! > maxLng ? a.longitude! : maxLng;
    }
    c.animateCamera(CameraUpdate.newLatLngBounds(
      LatLngBounds(
        southwest: LatLng(minLat, minLng),
        northeast: LatLng(maxLat, maxLng),
      ),
      48,
    ));
  }

  Widget _filterOverlay() {
    return Card(
      elevation: 3,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: _searchController,
              onChanged: _onSearchChanged,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                hintText: 'Search activities…',
                prefixIcon: const Icon(Icons.search),
                isDense: true,
                border: InputBorder.none,
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
                      _load();
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
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Find activities'),
        actions: [
          IconButton(icon: const Icon(Icons.refresh), onPressed: _loading ? null : _load),
        ],
      ),
      body: Stack(
        children: [
          GoogleMap(
            initialCameraPosition: _lisbon,
            markers: _markers,
            onMapCreated: (c) {
              _controller = c;
              _fitToMarkers();
            },
            zoomControlsEnabled: false,
            myLocationEnabled: _near != null,
            myLocationButtonEnabled: false,
            padding: const EdgeInsets.only(top: 132),
          ),
          Positioned(
            top: 8,
            left: 8,
            right: 8,
            child: _filterOverlay(),
          ),
          if (_loading)
            const Positioned(top: 0, left: 0, right: 0, child: LinearProgressIndicator()),
          if (!_loading && _located.isEmpty)
            Center(
              child: Card(
                margin: const EdgeInsets.all(24),
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    _error ?? 'No activities have a location pin yet.',
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
