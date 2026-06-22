// lib/api/services_scope.dart

/// Exposes app-wide API services (currently the ActivitiesApi) to the widget
/// tree via a plain InheritedWidget, so any screen can read them with
/// `ServicesScope.of(context)`. Same idea as AuthScope, without the notifier —
/// these services are stateless singletons created once at startup.
library;

import 'package:flutter/widgets.dart';

import 'activities.dart';
import 'clans.dart';
import 'feed.dart';
import 'users.dart';

class ServicesScope extends InheritedWidget {
  const ServicesScope({
    super.key,
    required this.activities,
    required this.users,
    required this.clans,
    required this.feed,
    required super.child,
  });

  final ActivitiesApi activities;
  final UsersApi users;
  final ClansApi clans;
  final FeedApi feed;

  static ServicesScope of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<ServicesScope>();
    assert(scope != null, 'No ServicesScope found in context');
    return scope!;
  }

  @override
  bool updateShouldNotify(ServicesScope oldWidget) =>
      activities != oldWidget.activities ||
      users != oldWidget.users ||
      clans != oldWidget.clans ||
      feed != oldWidget.feed;
}
