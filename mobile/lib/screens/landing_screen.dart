// lib/screens/landing_screen.dart
import 'package:flutter/material.dart';

import '../theme.dart';
import 'login_screen.dart';
import 'register_screen.dart';

/// Pre-login marketing screen — the mobile counterpart of the web landing page.
/// Hero + value prop + feature highlights, with CTAs into register / login.
class LandingScreen extends StatelessWidget {
  const LandingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 32),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Brand + hero ------------------------------------------------
              Row(
                children: [
                  Image.asset('assets/branding/logo.png', height: 34),
                  const SizedBox(width: 8),
                  Text('Tribo',
                      style: theme.textTheme.titleLarge?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: triboInk,
                      )),
                ],
              ),
              const SizedBox(height: 40),
              Text(
                'FOR RUNNERS WHO MOVE TOGETHER',
                style: theme.textTheme.labelSmall?.copyWith(
                  color: triboGreenDark,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.6,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Run together.\nCompete together.\nMake impact.',
                style: theme.textTheme.displaySmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                  color: triboInk,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Tribo turns your runs into a team sport. Form a clan, climb the '
                'rankings, and clean up your city while you’re at it.',
                style: theme.textTheme.bodyLarge?.copyWith(color: triboMuted, height: 1.5),
              ),
              const SizedBox(height: 28),

              // CTAs --------------------------------------------------------
              FilledButton(
                onPressed: () => _go(context, const RegisterScreen()),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 4),
                  child: Text('Get started'),
                ),
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: () => _go(context, const LoginScreen()),
                child: const Padding(
                  padding: EdgeInsets.symmetric(vertical: 4),
                  child: Text('I already have an account'),
                ),
              ),

              const SizedBox(height: 36),

              // Hero stats --------------------------------------------------
              Container(
                padding: const EdgeInsets.symmetric(vertical: 18),
                decoration: const BoxDecoration(
                  border: Border(top: BorderSide(color: triboLine)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: const [
                    _Stat(value: '5', label: 'active clans'),
                    _Stat(value: '11k', label: 'km this month'),
                    _Stat(value: '320', label: 'verified events'),
                  ],
                ),
              ),
              const SizedBox(height: 28),

              // Features ----------------------------------------------------
              Text('What makes Tribo different',
                  style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 12),
              const _Feature(
                icon: Icons.groups_outlined,
                title: 'Run as a clan',
                body: 'Every kilometer counts toward your team.',
              ),
              const _Feature(
                icon: Icons.emoji_events_outlined,
                title: 'Rankings that matter',
                body: 'Compete on average pace or total distance.',
              ),
              const _Feature(
                icon: Icons.volunteer_activism_outlined,
                title: 'Volunteer runs',
                body: 'Clean up streets and trails while you train.',
              ),
              const _Feature(
                icon: Icons.place_outlined,
                title: 'Local routes',
                body: 'Built around the places your clan actually runs.',
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _go(BuildContext context, Widget screen) {
    Navigator.of(context).push(MaterialPageRoute(builder: (_) => screen));
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.value, required this.label});
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value,
            style: theme.textTheme.headlineSmall
                ?.copyWith(fontWeight: FontWeight.w800, color: triboInk)),
        Text(label, style: theme.textTheme.bodySmall?.copyWith(color: triboMuted)),
      ],
    );
  }
}

class _Feature extends StatelessWidget {
  const _Feature({required this.icon, required this.title, required this.body});
  final IconData icon;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: triboGreenSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: triboGreenDark, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                Text(body, style: theme.textTheme.bodyMedium?.copyWith(color: triboMuted)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
