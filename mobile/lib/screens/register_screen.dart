// lib/screens/register_screen.dart
import 'package:flutter/material.dart';

import '../api/auth.dart';
import '../api/http.dart';
import '../auth/auth_scope.dart';

/// M-3 — Registration screen. Mirrors the web RegisterPage.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _fullName = TextEditingController();
  final _phone = TextEditingController();
  final _age = TextEditingController();
  String _role = 'END_USER';
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _fullName.dispose();
    _phone.dispose();
    _age.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    // Client-side checks mirror the backend; the server is still the source of truth.
    if (_password.text.length < 8) {
      setState(() => _error = 'Password must be at least 8 characters.');
      return;
    }
    final age = int.tryParse(_age.text.trim());
    if (age == null || age < 13 || age > 120) {
      setState(() => _error = 'Age must be a whole number between 13 and 120.');
      return;
    }

    setState(() => _busy = true);
    try {
      await AuthScope.of(context).register(RegisterInput(
        email: _email.text.trim(),
        password: _password.text,
        fullName: _fullName.text.trim(),
        phoneNumber: _phone.text.trim(),
        age: age,
        role: _role,
      ));
      // On success AuthGate (the first route) rebuilds to AppShell underneath.
      // Pop ALL pushed routes back to it — not just one — so a Landing→Login→
      // Register path doesn't leave the login screen on top, and a back press
      // can't return to the now-stale register form.
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Registration failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Register')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: _email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Password (min 8)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _fullName,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(
                    labelText: 'Full name',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _phone,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone (+351…)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _age,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Age',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: _role,
                  decoration: const InputDecoration(
                    labelText: 'Account type',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'END_USER', child: Text('Participant (browse & join)')),
                    DropdownMenuItem(value: 'ACTIVITY_MANAGER', child: Text('Activity manager')),
                    DropdownMenuItem(value: 'PARTNER', child: Text('Partner (organisation)')),
                  ],
                  onChanged: _busy ? null : (v) => setState(() => _role = v ?? 'END_USER'),
                ),
                if (_role != 'END_USER')
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Text(
                      'Manager/partner accounts need backoffice verification before they can create activities.',
                      style: TextStyle(fontSize: 13, color: Color(0xFF8A6D00)),
                    ),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text(_busy ? 'Creating…' : 'Create account'),
                  ),
                ),
                const SizedBox(height: 8),
                TextButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child: const Text('Have an account? Log in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
