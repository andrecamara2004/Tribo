// lib/screens/app_shell.dart
import 'package:flutter/material.dart';

import 'activities_screen.dart';
import 'clan_screen.dart';
import 'feed_screen.dart';
import 'find_activities_screen.dart';
import 'profile_screen.dart';

/// The authenticated app shell: a Material 3 bottom NavigationBar over an
/// IndexedStack so each tab keeps its state (scroll position, map camera,
/// loaded lists) when you switch away and back.
///
/// Mobile counterpart of the web's sidebar Shell. Leads with the Feed (the
/// social home), then Volunteer activities, the discovery map, Clan, and Profile.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int _index = 0;

  void _go(int index) => setState(() => _index = index);

  @override
  Widget build(BuildContext context) {
    const pages = [
      FeedScreen(),
      ActivitiesScreen(),
      FindActivitiesScreen(),
      ClanScreen(),
      ProfileScreen(),
    ];

    return Scaffold(
      body: IndexedStack(index: _index, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: _go,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.dynamic_feed_outlined),
            selectedIcon: Icon(Icons.dynamic_feed),
            label: 'Feed',
          ),
          NavigationDestination(
            icon: Icon(Icons.volunteer_activism_outlined),
            selectedIcon: Icon(Icons.volunteer_activism),
            label: 'Volunteer',
          ),
          NavigationDestination(
            icon: Icon(Icons.map_outlined),
            selectedIcon: Icon(Icons.map),
            label: 'Find',
          ),
          NavigationDestination(
            icon: Icon(Icons.groups_outlined),
            selectedIcon: Icon(Icons.groups),
            label: 'Clan',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
