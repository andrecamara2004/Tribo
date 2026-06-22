import 'package:flutter/material.dart';

import 'api/activities.dart';
import 'api/auth.dart';
import 'api/clans.dart';
import 'api/feed.dart';
import 'api/http.dart';
import 'api/runs.dart';
import 'api/services_scope.dart';
import 'api/token_store.dart';
import 'api/users.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_scope.dart';
import 'screens/app_shell.dart';
import 'screens/landing_screen.dart';
import 'theme.dart';

void main() {
  // flutter_secure_storage (and other plugins) reach for ServicesBinding.instance,
  // which only exists after the binding is initialized. bootstrap() below touches
  // secure storage before runApp() would init it, so do it explicitly first —
  // otherwise the very first token read throws "Binding has not yet been
  // initialized", gets swallowed, and a valid persisted session looks absent.
  WidgetsFlutterBinding.ensureInitialized();

  // Wire the dependency chain once: TokenStore → ApiClient → typed API clients.
  final tokens = TokenStore();
  final client = ApiClient(tokens);
  final authApi = AuthApi(client, tokens);
  final activitiesApi = ActivitiesApi(client);
  final usersApi = UsersApi(client);
  final clansApi = ClansApi(client);
  final feedApi = FeedApi(client);
  final runsApi = RunsApi(client);
  final controller = AuthController(authApi: authApi, tokens: tokens);

  // Kick off the session bootstrap; the AuthGate shows a spinner until it lands.
  controller.bootstrap();

  runApp(TriboApp(
    controller: controller,
    activities: activitiesApi,
    users: usersApi,
    clans: clansApi,
    feed: feedApi,
    runs: runsApi,
  ));
}

class TriboApp extends StatelessWidget {
  const TriboApp({
    super.key,
    required this.controller,
    required this.activities,
    required this.users,
    required this.clans,
    required this.feed,
    required this.runs,
  });

  final AuthController controller;
  final ActivitiesApi activities;
  final UsersApi users;
  final ClansApi clans;
  final FeedApi feed;
  final RunsApi runs;

  @override
  Widget build(BuildContext context) {
    return ServicesScope(
      activities: activities,
      users: users,
      clans: clans,
      feed: feed,
      runs: runs,
      child: AuthScope(
        controller: controller,
        child: MaterialApp(
          title: 'Tribo',
          theme: triboTheme(),
          home: const AuthGate(),
        ),
      ),
    );
  }
}

/// Routes between the login flow and the home screen based on auth state.
/// Rebuilds whenever the AuthController notifies (login / logout / bootstrap).
class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = AuthScope.of(context);

    if (auth.loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    return auth.isAuthenticated ? const AppShell() : const LandingScreen();
  }
}
