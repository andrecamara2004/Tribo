// lib/screens/settings_screen.dart
// Account settings: change password (requires the current one) and account
// privacy. Mirrors the web SettingsPage.
import 'package:flutter/material.dart';

import '../api/auth.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../api/users.dart';
import '../auth/auth_scope.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();

  PasswordPolicy _policy = PasswordPolicy.fallback;
  Me? _me;
  bool _loading = true;
  bool _savingPwd = false;
  bool _savingVis = false;
  String? _pwdError;
  String? _pwdOk;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _current.dispose();
    _next.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    // Read inherited scopes before any await (no BuildContext across async gaps).
    final users = ServicesScope.of(context).users;
    final auth = AuthScope.of(context);
    try {
      final me = await users.getMe();
      final policy = await auth.passwordPolicy();
      if (mounted) setState(() { _me = me; _policy = policy; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _changePassword() async {
    setState(() { _pwdError = null; _pwdOk = null; });
    if (_next.text != _confirm.text) {
      setState(() => _pwdError = "New passwords don't match.");
      return;
    }
    if (_next.text.length < _policy.minLength) {
      setState(() => _pwdError = 'Password must be at least ${_policy.minLength} characters.');
      return;
    }
    setState(() => _savingPwd = true);
    try {
      final msg = await ServicesScope.of(context).users.changePassword(_current.text, _next.text);
      if (!mounted) return;
      setState(() {
        _pwdOk = msg;
        _current.clear();
        _next.clear();
        _confirm.clear();
      });
    } on ApiError catch (e) {
      if (mounted) setState(() => _pwdError = e.message);
    } catch (_) {
      if (mounted) setState(() => _pwdError = "Couldn't change your password.");
    } finally {
      if (mounted) setState(() => _savingPwd = false);
    }
  }

  Future<void> _toggleVisibility() async {
    final isPrivate = _me?.profileVisibility == 'PRIVATE';
    setState(() => _savingVis = true);
    try {
      final me = await ServicesScope.of(context).users.setVisibility(isPrivate ? 'PUBLIC' : 'PRIVATE');
      if (mounted) setState(() => _me = me);
    } on ApiError catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } finally {
      if (mounted) setState(() => _savingVis = false);
    }
  }

  Future<void> _toggleTheme(bool isDark) async {
    final mode = isDark ? ThemeMode.dark : ThemeMode.light;
    AuthScope.of(context).updateTheme(mode);

    try {
      final me = await ServicesScope.of(context).users.setTheme(isDark ? 'DARK' : 'LIGHT');
      if (mounted) setState(() => _me = me);
    } catch (_) {
      // Background sync failed, ignore
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPrivate = _me?.profileVisibility == 'PRIVATE';
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                // --- change password ---
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text('Change password',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _current,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Current password', border: OutlineInputBorder()),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _next,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: 'New password',
                            border: const OutlineInputBorder(),
                            helperMaxLines: 3,
                            helperText: _policy.rules.isEmpty
                                ? null
                                : 'Must contain: ${_policy.rules.join(" · ")}',
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _confirm,
                          obscureText: true,
                          decoration: const InputDecoration(
                            labelText: 'Confirm new password', border: OutlineInputBorder()),
                        ),
                        if (_pwdError != null) ...[
                          const SizedBox(height: 10),
                          Text(_pwdError!, style: const TextStyle(color: Colors.red)),
                        ],
                        if (_pwdOk != null) ...[
                          const SizedBox(height: 10),
                          Text(_pwdOk!, style: const TextStyle(color: Color(0xFF00875A))),
                        ],
                        const SizedBox(height: 14),
                        FilledButton(
                          onPressed: _savingPwd ? null : _changePassword,
                          child: Text(_savingPwd ? 'Saving…' : 'Update password'),
                        ),
                      ],
                    ),
                  ),
                ),
                // --- appearance ---
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Appearance',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(AuthScope.of(context).themeMode == ThemeMode.dark ? 'Dark mode' : 'Light mode'),
                          value: AuthScope.of(context).themeMode == ThemeMode.dark,
                          onChanged: _toggleTheme,
                        ),
                      ],
                    ),
                  ),
                ),

                // --- account privacy ---
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Account privacy',
                            style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                        const SizedBox(height: 6),
                        Text(
                          'When private, other members see “Private user” instead of your '
                          'name and photo in clan rosters and the feed.',
                          style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.outline),
                        ),
                        const SizedBox(height: 6),
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(isPrivate ? 'Private account' : 'Public account'),
                          subtitle: Text(isPrivate
                              ? 'Your identity is hidden from other members.'
                              : 'Your name and photo are visible.'),
                          value: isPrivate,
                          onChanged: _savingVis ? null : (_) => _toggleVisibility(),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
