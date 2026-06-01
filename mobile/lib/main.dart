import 'package:flutter/material.dart';

import 'api/auth.dart';
import 'api/http.dart';
import 'api/token_store.dart';
import 'auth/auth_controller.dart';
import 'auth/auth_scope.dart';
import 'screens/home_screen.dart';
import 'screens/login_screen.dart';

void main() {
  // Wire the dependency chain once: TokenStore → ApiClient → AuthApi → controller.
  final tokens = TokenStore();
  final client = ApiClient(tokens);
  final authApi = AuthApi(client, tokens);
  final controller = AuthController(authApi: authApi, tokens: tokens);

  // Kick off the session bootstrap; the AuthGate shows a spinner until it lands.
  controller.bootstrap();

  runApp(TriboApp(controller: controller));
}

class TriboApp extends StatelessWidget {
  const TriboApp({super.key, required this.controller});

  final AuthController controller;

  @override
  Widget build(BuildContext context) {
    return AuthScope(
      controller: controller,
      child: MaterialApp(
        title: 'Tribo',
        theme: ThemeData(useMaterial3: true, colorSchemeSeed: Colors.teal),
        home: const AuthGate(),
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

    return auth.isAuthenticated ? const HomeScreen() : const LoginScreen();
  }
}
