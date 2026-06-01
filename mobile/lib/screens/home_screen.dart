// lib/screens/home_screen.dart
import 'package:flutter/material.dart';

import '../auth/auth_scope.dart';

/// M-3 — Home screen for a logged-in user. Mirrors the web HomePage.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  bool _loggingOut = false;

  Future<void> _logout() async {
    setState(() => _loggingOut = true);
    try {
      await AuthScope.of(context).logout();
      // The AuthGate swaps back to LoginScreen once the user is cleared.
    } finally {
      if (mounted) setState(() => _loggingOut = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = AuthScope.of(context).user;

    return Scaffold(
      appBar: AppBar(title: const Text('Tribo')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Welcome', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 8),
                const Text('You are logged in.'),
                const SizedBox(height: 16),
                Text('User ID: ${user?.userId ?? '—'}'),
                const SizedBox(height: 4),
                Text('Role: ${user?.role ?? '—'}'),
                const SizedBox(height: 24),
                FilledButton.tonal(
                  onPressed: _loggingOut ? null : _logout,
                  child: Text(_loggingOut ? 'Logging out…' : 'Log out'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
