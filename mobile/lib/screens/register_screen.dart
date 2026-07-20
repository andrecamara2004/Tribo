// lib/screens/register_screen.dart
import 'package:flutter/material.dart';

import 'package:flutter/services.dart';

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
  DateTime? _birthDate;
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
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    // Client-side checks mirror the backend; the server is still the source of truth.
    if (_password.text.length < _policy.minLength) {
      setState(() => _error = 'Password must be at least ${_policy.minLength} characters.');
      return;
    }
    if (_birthDate == null) {
      setState(() => _error = 'Your date of birth is required.');
      return;
    }
    final age = _ageFrom(_birthDate!);
    if (age < 13 || age > 120) {
      setState(() => _error = 'You must be between 13 and 120 years old.');
      return;
    }

    setState(() => _busy = true);
    try {
      final result = await AuthScope.of(context).register(RegisterInput(
        email: _email.text.trim(),
        password: _password.text,
        fullName: _fullName.text.trim(),
        phoneNumber: _phone.text.trim(),
        birthDate: _isoDate(_birthDate!),
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

  int _ageFrom(DateTime dob) {
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month || (now.month == dob.month && now.day < dob.day)) age--;
    return age;
  }

  // ISO for the API; day/month/year for display.
  String _isoDate(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  String _displayDate(DateTime d) =>
      '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _birthDate ?? DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(now.year - 120),
      lastDate: now,
      helpText: 'Select your date of birth',
    );
    if (picked != null && mounted) setState(() => _birthDate = picked);
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
                  inputFormatters: [PortuguesePhoneFormatter()],
                  decoration: const InputDecoration(
                    labelText: 'Phone (+351…)',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: _pickBirthDate,
                  icon: const Icon(Icons.cake_outlined),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                    alignment: Alignment.centerLeft,
                    foregroundColor: _birthDate == null ? Colors.grey.shade700 : null,
                  ),
                  label: Text(_birthDate == null
                      ? 'Date of birth'
                      : 'Born ${_displayDate(_birthDate!)}'),
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

class PortuguesePhoneFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(TextEditingValue oldValue, TextEditingValue newValue) {
    String raw = newValue.text.replaceAll(RegExp(r'[^\d+]'), '');

    if (raw.startsWith('+351')) {
      String rest = raw.substring(4);
      if (rest.length > 9) rest = rest.substring(0, 9);
      String formatted = '+351';
      for (int i = 0; i < rest.length; i++) {
        if (i % 3 == 0) formatted += ' ';
        formatted += rest[i];
      }
      return TextEditingValue(
        text: formatted,
        selection: TextSelection.collapsed(offset: formatted.length),
      );
    } else if (raw.startsWith('+')) {
      return TextEditingValue(
        text: raw,
        selection: TextSelection.collapsed(offset: raw.length),
      );
    }

    // Format as groups of 3 digits
    String digits = raw.replaceAll(RegExp(r'\D'), '');
    if (digits.length > 9) digits = digits.substring(0, 9);
    String formatted = '';
    for (int i = 0; i < digits.length; i++) {
      if (i > 0 && i % 3 == 0) formatted += ' ';
      formatted += digits[i];
    }
    
    return TextEditingValue(
      text: formatted,
      selection: TextSelection.collapsed(offset: formatted.length),
    );
  }
}
