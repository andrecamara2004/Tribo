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
  PasswordPolicy _policy = PasswordPolicy.fallback;
  RegisterResult? _sent; // set once registration succeeds (email on its way)
  String? _resendMsg;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final p = await AuthScope.of(context).passwordPolicy();
      if (mounted) setState(() => _policy = p);
    });
  }

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
    if (_password.text.length < _policy.minLength) {
      setState(() => _error = 'Password must be at least ${_policy.minLength} characters.');
      return;
    }
    final age = int.tryParse(_age.text.trim());
    if (age == null || age < 13 || age > 120) {
      setState(() => _error = 'Age must be a whole number between 13 and 120.');
      return;
    }

    setState(() => _busy = true);
    try {
      final result = await AuthScope.of(context).register(RegisterInput(
        email: _email.text.trim(),
        password: _password.text,
        fullName: _fullName.text.trim(),
        phoneNumber: _phone.text.trim(),
        age: age,
        role: _role,
      ));
      // Login is gated on email confirmation — show the "check your email" panel
      // instead of navigating into the app.
      if (mounted) setState(() => _sent = result);
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Registration failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _resendMsg = null);
    try {
      final msg = await AuthScope.of(context).resendVerification(_sent!.email);
      if (mounted) setState(() => _resendMsg = msg);
    } catch (_) {
      if (mounted) setState(() => _resendMsg = "Couldn't resend right now — try again in a minute.");
    }
  }

  Widget _buildCheckEmail() {
    return Scaffold(
      appBar: AppBar(title: const Text('Almost there')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Icon(Icons.mark_email_read_outlined, size: 56, color: Color(0xFF00B86B)),
                const SizedBox(height: 16),
                const Text('Check your email',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                const SizedBox(height: 8),
                Text(
                  'We sent a confirmation link to ${_sent!.email}. '
                  'Tap it to activate your account, then sign in.',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 20),
                OutlinedButton(
                  onPressed: _resend,
                  child: const Text('Resend confirmation email'),
                ),
                if (_resendMsg != null) ...[
                  const SizedBox(height: 8),
                  Text(_resendMsg!, textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 13)),
                ],
                const SizedBox(height: 8),
                TextButton(
                  onPressed: () => Navigator.of(context).popUntil((r) => r.isFirst),
                  child: const Text('Back to sign in'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_sent != null) return _buildCheckEmail();
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
                  decoration: InputDecoration(
                    labelText: 'Password (min ${_policy.minLength})',
                    border: const OutlineInputBorder(),
                    helperMaxLines: 3,
                    helperText: _policy.rules.isEmpty ? null : 'Must contain: ${_policy.rules.join(" · ")}',
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
