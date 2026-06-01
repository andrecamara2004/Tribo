// lib/auth/auth_scope.dart

/// Exposes the AuthController to the widget tree via InheritedNotifier, so any
/// screen can read it with `AuthScope.of(context)` and rebuild when it changes.
/// This is the Flutter-idiomatic stand-in for React's useAuth() context hook —
/// no third-party state-management package needed for Sprint 1.
library;

import 'package:flutter/widgets.dart';

import 'auth_controller.dart';

class AuthScope extends InheritedNotifier<AuthController> {
  const AuthScope({
    super.key,
    required AuthController controller,
    required super.child,
  }) : super(notifier: controller);

  static AuthController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AuthScope>();
    assert(scope != null, 'No AuthScope found in context');
    return scope!.notifier!;
  }
}
