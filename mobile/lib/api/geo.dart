// lib/api/geo.dart
// Thin wrapper over geolocator: check service + permission, then return the
// device's current position. Throws a user-friendly message on failure.
library;

import 'package:geolocator/geolocator.dart';

class GeoException implements Exception {
  final String message;
  const GeoException(this.message);
  @override
  String toString() => message;
}

/// Resolve the device's current coordinates, requesting permission if needed.
Future<Position> currentPosition() async {
  final serviceEnabled = await Geolocator.isLocationServiceEnabled();
  if (!serviceEnabled) {
    throw const GeoException('Location services are turned off.');
  }

  var permission = await Geolocator.checkPermission();
  if (permission == LocationPermission.denied) {
    permission = await Geolocator.requestPermission();
  }
  if (permission == LocationPermission.denied) {
    throw const GeoException('Location permission denied.');
  }
  if (permission == LocationPermission.deniedForever) {
    throw const GeoException(
        'Location permission is permanently denied. Enable it in Settings.');
  }

  return Geolocator.getCurrentPosition(
    locationSettings: const LocationSettings(accuracy: LocationAccuracy.medium),
  );
}
