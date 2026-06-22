// lib/screens/runs_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/http.dart';
import '../api/runs.dart';
import '../api/services_scope.dart';
import '../theme.dart';

/// The "Runs" tab: the caller's run history (newest first) plus a manual
/// log-run form. Mobile counterpart of the web TrackerPage — live GPS tracking
/// isn't built yet, so runs are logged as finished summaries (distance + time).
class RunsScreen extends StatefulWidget {
  const RunsScreen({super.key});

  @override
  State<RunsScreen> createState() => _RunsScreenState();
}

class _RunsScreenState extends State<RunsScreen> {
  List<Run> _runs = const [];
  RunStats? _stats;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final runs = await ServicesScope.of(context).runs.list(scope: 'me');
      if (!mounted) return;
      setState(() => _runs = runs);
      // Stats are a nice-to-have header — never let them block the list.
      try {
        final stats = await ServicesScope.of(context).runs.myStats();
        if (mounted) setState(() => _stats = stats);
      } catch (_) {/* ignore */}
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      debugPrint('runs load failed: $e');
      if (mounted) setState(() => _error = 'Failed to load runs: $e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openLogSheet() async {
    final logged = await showModalBottomSheet<Run>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => const _LogRunSheet(),
    );
    if (logged != null) _load();
  }

  @override
  Widget build(BuildContext context) {
    final streak = _stats?.streak ?? 0;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Runs'),
        actions: [
          if (streak > 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Center(child: _Pill(label: '🔥 $streak-day streak')),
            ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openLogSheet,
        backgroundColor: triboGreen,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Log a run'),
      ),
      body: RefreshIndicator(onRefresh: _load, child: _buildBody()),
    );
  }

  Widget _buildBody() {
    if (_loading && _runs.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    final theme = Theme.of(context);
    if (_runs.isEmpty) {
      return ListView(
        children: [
          const SizedBox(height: 80),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                _error ??
                    'No runs yet.\nTap “Log a run” to record one and start your history.',
                textAlign: TextAlign.center,
                style: theme.textTheme.bodyMedium?.copyWith(color: triboMuted),
              ),
            ),
          ),
        ],
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
      itemCount: _runs.length,
      itemBuilder: (_, i) => Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: _RunCard(run: _runs[i], featured: i == 0),
      ),
    );
  }
}

// --- run card ----------------------------------------------------------------

class _RunCard extends StatelessWidget {
  const _RunCard({required this.run, this.featured = false});
  final Run run;
  final bool featured;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final meta = [
      _relative(run.startedAt),
      run.location.isEmpty ? null : run.location,
    ].whereType<String>().join(' · ');

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(run.title.isEmpty ? 'Run' : run.title,
                          style: theme.textTheme.titleMedium
                              ?.copyWith(fontWeight: FontWeight.w700)),
                      if (meta.isNotEmpty)
                        Text(meta,
                            style: theme.textTheme.bodySmall
                                ?.copyWith(color: triboMuted)),
                    ],
                  ),
                ),
                if (featured) _Pill(label: 'Last run'),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                _metric(theme, 'Distance', run.distanceKm.toStringAsFixed(1), 'km'),
                _metric(theme, 'Pace', _pace(run.paceSecPerKm), '/km'),
                _metric(theme, 'Time', _duration(run.durationSeconds), null),
              ],
            ),
            if (run.elevationMeters > 0 || run.routeType.isNotEmpty) ...[
              const SizedBox(height: 8),
              const Divider(),
              Text(
                [
                  if (run.routeType.isNotEmpty) run.routeType,
                  if (run.elevationMeters > 0) '${run.elevationMeters} m elev',
                ].join(' · '),
                style: theme.textTheme.bodySmall?.copyWith(color: triboMuted),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _metric(ThemeData theme, String label, String value, String? unit) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label.toUpperCase(),
              style: theme.textTheme.labelSmall
                  ?.copyWith(color: triboMuted, letterSpacing: 0.5)),
          const SizedBox(height: 2),
          RichText(
            text: TextSpan(
              text: value,
              style: theme.textTheme.titleMedium
                  ?.copyWith(fontWeight: FontWeight.w700, color: triboInk),
              children: unit == null
                  ? null
                  : [
                      TextSpan(
                        text: ' $unit',
                        style: theme.textTheme.bodySmall
                            ?.copyWith(color: triboMuted),
                      ),
                    ],
            ),
          ),
        ],
      ),
    );
  }
}

// --- log-run bottom sheet ----------------------------------------------------

const _routeTypes = ['river', 'trail', 'park', 'coast', 'city'];

class _LogRunSheet extends StatefulWidget {
  const _LogRunSheet();

  @override
  State<_LogRunSheet> createState() => _LogRunSheetState();
}

class _LogRunSheetState extends State<_LogRunSheet> {
  final _title = TextEditingController();
  final _location = TextEditingController();
  final _distanceKm = TextEditingController();
  final _durationMin = TextEditingController();
  final _durationSec = TextEditingController();
  final _elevation = TextEditingController(text: '0');
  String _routeType = 'river';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _title.dispose();
    _location.dispose();
    _distanceKm.dispose();
    _durationMin.dispose();
    _durationSec.dispose();
    _elevation.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final distanceMeters = ((double.tryParse(_distanceKm.text) ?? 0) * 1000).round();
    final durationSeconds = (int.tryParse(_durationMin.text) ?? 0) * 60 +
        (int.tryParse(_durationSec.text) ?? 0);
    if (distanceMeters <= 0) {
      setState(() => _error = 'Distance must be greater than 0.');
      return;
    }
    if (durationSeconds <= 0) {
      setState(() => _error = 'Duration must be greater than 0.');
      return;
    }

    setState(() => _busy = true);
    try {
      final run = await ServicesScope.of(context).runs.log(
            title: _title.text.trim(),
            location: _location.text.trim(),
            distanceMeters: distanceMeters,
            durationSeconds: durationSeconds,
            elevationMeters: (int.tryParse(_elevation.text) ?? 0).clamp(0, 100000),
            routeType: _routeType,
            startedAt: DateTime.now(),
          );
      if (mounted) Navigator.of(context).pop(run);
    } on ApiError catch (e) {
      if (mounted) setState(() => _error = e.message);
    } catch (e) {
      if (mounted) setState(() => _error = 'Failed to log run.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    // Pad for the keyboard so fields stay visible while typing.
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, 20 + bottomInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: triboLine,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            Text('Log a finished run',
                style: theme.textTheme.titleLarge
                    ?.copyWith(fontWeight: FontWeight.w700)),
            const SizedBox(height: 16),
            if (_error != null) ...[
              Text(_error!,
                  style: theme.textTheme.bodySmall
                      ?.copyWith(color: theme.colorScheme.error)),
              const SizedBox(height: 12),
            ],
            _field('Title', _title, hint: 'Morning run'),
            _field('Location', _location, hint: 'Belém, Lisboa'),
            _field('Distance (km)', _distanceKm,
                hint: '5.0',
                keyboard: const TextInputType.numberWithOptions(decimal: true),
                formatters: [FilteringTextInputFormatter.allow(RegExp(r'[0-9.]'))]),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: _field('Duration (min)', _durationMin,
                      hint: 'min',
                      keyboard: TextInputType.number,
                      formatters: [FilteringTextInputFormatter.digitsOnly]),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: _field('Sec', _durationSec,
                      hint: 'sec',
                      keyboard: TextInputType.number,
                      formatters: [FilteringTextInputFormatter.digitsOnly]),
                ),
              ],
            ),
            _field('Elevation (m)', _elevation,
                keyboard: TextInputType.number,
                formatters: [FilteringTextInputFormatter.digitsOnly]),
            Text('Route type',
                style: theme.textTheme.labelMedium
                    ?.copyWith(color: triboMuted, fontWeight: FontWeight.w600)),
            const SizedBox(height: 6),
            DropdownButtonFormField<String>(
              initialValue: _routeType,
              items: _routeTypes
                  .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                  .toList(),
              onChanged: (v) => setState(() => _routeType = v ?? 'river'),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: Text(_busy ? 'Saving…' : 'Save run'),
                  ),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: _busy ? null : () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? hint,
    TextInputType? keyboard,
    List<TextInputFormatter>? formatters,
  }) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: theme.textTheme.labelMedium
                  ?.copyWith(color: triboMuted, fontWeight: FontWeight.w600)),
          const SizedBox(height: 6),
          TextField(
            controller: controller,
            keyboardType: keyboard,
            inputFormatters: formatters,
            decoration: InputDecoration(hintText: hint, isDense: true),
          ),
        ],
      ),
    );
  }
}

// --- small shared bits -------------------------------------------------------

String _pace(int secPerKm) {
  if (secPerKm <= 0) return '—';
  final m = secPerKm ~/ 60;
  final s = secPerKm % 60;
  return '$m:${s.toString().padLeft(2, '0')}';
}

String _duration(int seconds) {
  final h = seconds ~/ 3600;
  final m = (seconds % 3600) ~/ 60;
  final s = seconds % 60;
  if (h > 0) return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  return '$m:${s.toString().padLeft(2, '0')}';
}

String _relative(DateTime when) {
  final d = DateTime.now().difference(when);
  if (d.inMinutes < 1) return 'just now';
  if (d.inMinutes < 60) return '${d.inMinutes}m ago';
  if (d.inHours < 24) return '${d.inHours}h ago';
  if (d.inDays < 7) return '${d.inDays}d ago';
  final local = when.toLocal();
  return '${local.day}/${local.month}/${local.year}';
}

class _Pill extends StatelessWidget {
  const _Pill({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: triboGreenSoft,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(label,
          style: theme.textTheme.labelMedium?.copyWith(color: triboGreenDeep)),
    );
  }
}
