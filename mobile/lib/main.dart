import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

const String apiBaseUrl = 'https://tribo-497810.ew.r.appspot.com';

void main() {
  runApp(const TriboApp());
}

class TriboApp extends StatelessWidget {
  const TriboApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Tribo',
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.teal),
      home: const HealthCheckScreen(),
    );
  }
}

class HealthCheckScreen extends StatefulWidget {
  const HealthCheckScreen({super.key});

  @override
  State<HealthCheckScreen> createState() => _HealthCheckScreenState();
}

class _HealthCheckScreenState extends State<HealthCheckScreen> {
  String? _status;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchHealth();
  }

  Future<void> _fetchHealth() async {
    try {
      final res = await http.get(Uri.parse('$apiBaseUrl/rest/health'));
      if (res.statusCode != 200) {
        throw Exception('HTTP ${res.statusCode}');
      }
      final body = jsonDecode(res.body) as Map<String, dynamic>;
      setState(() {
        _status = body['status'] as String?;
        _error = null;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _status = null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Tribo Mobile')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('API base: $apiBaseUrl', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 24),
            if (_error != null)
              Text('Error: $_error', style: const TextStyle(color: Colors.red)),
            if (_status != null)
              Text('API status: $_status',
                  style: const TextStyle(color: Colors.green, fontSize: 18)),
            if (_status == null && _error == null)
              const Text('Loading…'),
            const Spacer(),
            ElevatedButton(onPressed: _fetchHealth, child: const Text('Re-check')),
          ],
        ),
      ),
    );
  }
}