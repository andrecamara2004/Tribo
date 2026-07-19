// lib/screens/login_screen.dart
import 'package:flutter/material.dart';

import '../api/http.dart';
import '../auth/auth_scope.dart';
import 'register_screen.dart';
import 'forgot_password_screen.dart';

/// M-3 — Login screen. Mirrors the web LoginPage.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  String? _error;
  bool _busy = false;
  bool _needsVerify = false; // login blocked because email isn't confirmed
  String? _resendMsg;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _error = null;
      _resendMsg = null;
      _needsVerify = false;
      _busy = true;
    });
    try {
      await AuthScope.of(context).login(_email.text.trim(), _password.text);
      // On success AuthGate (the first route) rebuilds to AppShell underneath
      // this pushed screen. Pop back to it so the logged-in UI is actually
      // visible — otherwise this login route stays on top and the user sees no
      // change until a cold restart resets the navigator stack.
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on ApiError catch (e) {
      setState(() {
        _error = e.message;
        _needsVerify = e.code == 'EMAIL_NOT_VERIFIED';
      });
    } catch (_) {
      setState(() => _error = 'Login failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    setState(() => _resendMsg = null);
    try {
      final msg = await AuthScope.of(context).resendVerification(_email.text.trim());
      if (mounted) setState(() => _resendMsg = msg);
    } catch (_) {
      if (mounted) setState(() => _resendMsg = "Couldn't resend right now — try again in a minute.");
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 28),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Upper area: brand logo, sitting a little above centre.
                  const Spacer(flex: 4),
                  Image.asset(
                    'assets/branding/logo.png',
                    height: 140,
                    fit: BoxFit.contain,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Tribo',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: theme.colorScheme.primary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Run together. Make impact.',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium
                        ?.copyWith(color: theme.colorScheme.outline),
                  ),

                  // Lower area: the sign-in form.
                  const Spacer(flex: 3),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    textInputAction: TextInputAction.next,
                    decoration: const InputDecoration(
                      labelText: 'Email',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    onSubmitted: (_) => _busy ? null : _submit(),
                    decoration: const InputDecoration(
                      labelText: 'Password',
                      border: OutlineInputBorder(),
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 12),
                    Text(_error!, style: const TextStyle(color: Colors.red)),
                  ],
                  if (_needsVerify) ...[
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: _busy ? null : _resend,
                      child: const Text('Resend confirmation email'),
                    ),
                    if (_resendMsg != null) ...[
                      const SizedBox(height: 6),
                      Text(_resendMsg!, style: const TextStyle(fontSize: 13)),
                    ],
                  ],
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text(_busy ? 'Logging in…' : 'Log in'),
                    ),
                  ),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () {
                            Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const ForgotPasswordScreen(),
                              ),
                            );
                          },
                    child: const Text('Forgot your password?'),
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => Navigator.of(context).push(
                              MaterialPageRoute(
                                builder: (_) => const RegisterScreen(),
                              ),
                            ),
                    child: const Text('No account? Register'),
                  ),
                  const Spacer(flex: 2),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
