// lib/screens/find_activities_screen.dart
//
// "Find activities" — all published activities that have a location pin, shown
// on a Google Map. Mirrors the web /discover screen. Tap a pin's info window to
// open the activity detail.
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/activities.dart';
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
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final api = ServicesScope.of(context).activities;
      final page = await api.list(status: 'PUBLISHED', limit: 100);
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
          ),
          if (_loading) const LinearProgressIndicator(),
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
