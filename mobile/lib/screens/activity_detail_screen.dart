// lib/screens/activity_detail_screen.dart
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/activities.dart';
import '../api/http.dart';
import '../api/services_scope.dart';
import '../auth/auth_scope.dart';
import 'activity_form_screen.dart';

const _privileged = {'BACKOFFICE', 'SYSADMIN'};

/// M2-1/M2-3 — Activity detail with join/withdraw and owner actions.
class ActivityDetailScreen extends StatefulWidget {
  const ActivityDetailScreen({super.key, required this.activityId});
  final String activityId;

  @override
  State<ActivityDetailScreen> createState() => _ActivityDetailScreenState();
}

class _ActivityDetailScreenState extends State<ActivityDetailScreen> {
  Activity? _activity;
  Roster? _roster;
  ReviewList? _reviews;
  int _rating = 5;
  final _comment = TextEditingController();
  bool _reviewBusy = false;
  bool _loading = true;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  ActivitiesApi get _api => ServicesScope.of(context).activities;

  bool _isOwner(Activity a) {
    final user = AuthScope.of(context).user;
    if (user == null) return false;
    return user.userId == a.ownerId || _privileged.contains(user.role);
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final a = await _api.get(widget.activityId);
      Roster? roster;
      if (_isOwner(a)) roster = await _api.roster(widget.activityId);
      final reviews = await _api.getReviews(widget.activityId);
      setState(() {
        _activity = a;
        _roster = roster;
        _reviews = reviews;
        _error = null;
      });
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Failed to load activity.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _act(Future<void> Function() fn, String ok) async {
    setState(() => _busy = true);
    try {
      await fn();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(ok)));
      if (_activity != null && _isOwner(_activity!)) {
        _roster = await _api.roster(widget.activityId);
      }
    } on ApiError catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Action failed.')));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Cancel activity?'),
        content: const Text('Participants will no longer be able to join.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('No')),
          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes, cancel')),
        ],
      ),
    );
    if (ok != true) return;
    await _act(() async {
      final updated = await _api.cancel(widget.activityId);
      setState(() => _activity = updated);
    }, 'Activity cancelled.');
  }

  Future<void> _edit() async {
    await Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ActivityFormScreen(activityId: widget.activityId)),
    );
    if (mounted) _load();
  }

  Future<void> _submitReview() async {
    setState(() => _reviewBusy = true);
    try {
      await _api.submitReview(widget.activityId, rating: _rating, comment: _comment.text.trim());
      // Refresh the activity (updated aggregate) + the reviews list.
      final a = await _api.get(widget.activityId);
      final reviews = await _api.getReviews(widget.activityId);
      if (!mounted) return;
      setState(() {
        _activity = a;
        _reviews = reviews;
        _rating = 5;
        _comment.clear();
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Review submitted!')));
    } on ApiError catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Failed to submit review.')));
      }
    } finally {
      if (mounted) setState(() => _reviewBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _activity;
    return Scaffold(
      appBar: AppBar(title: Text(a?.title ?? 'Activity')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : a == null
              ? Center(child: Text(_error ?? 'Not found.'))
              : _buildDetail(a),
    );
  }

  Widget _buildDetail(Activity a) {
    final past = a.startsAt.isBefore(DateTime.now());
    final joinable = a.status == 'PUBLISHED' && !past;
    final owner = _isOwner(a);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(a.title, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 8),
        Text('Status: ${a.status}${past && a.status == 'PUBLISHED' ? ' (already started)' : ''}'),
        const Divider(height: 24),
        _row('When', '${a.startsAt.toLocal()}\n→ ${a.endsAt.toLocal()}'),
        _row('Where', a.location.isEmpty ? '—' : a.location),
        _row('Category', a.category.isEmpty ? '—' : a.category),
        _row('Capacity', '${a.capacity}'),
        _row('Description', a.description.isEmpty ? '—' : a.description),
        if (a.hasLocation) ...[
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: SizedBox(
              height: 200,
              child: GoogleMap(
                initialCameraPosition: CameraPosition(
                  target: LatLng(a.latitude!, a.longitude!),
                  zoom: 14,
                ),
                markers: {
                  Marker(markerId: MarkerId(a.id), position: LatLng(a.latitude!, a.longitude!)),
                },
                liteModeEnabled: true, // static thumbnail (Android) — light + tap to interact
                zoomControlsEnabled: false,
                myLocationButtonEnabled: false,
              ),
            ),
          ),
        ],
        const SizedBox(height: 16),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton(
              onPressed: (_busy || !joinable) ? null : () => _act(() => _api.join(a.id), "You're registered."),
              child: const Text('Join'),
            ),
            OutlinedButton(
              onPressed: _busy ? null : () => _act(() => _api.withdraw(a.id), 'You withdrew.'),
              child: const Text('Withdraw'),
            ),
            if (owner) ...[
              OutlinedButton(onPressed: _busy ? null : _edit, child: const Text('Edit')),
              if (a.status != 'CANCELLED')
                OutlinedButton(
                  onPressed: _busy ? null : _cancel,
                  style: OutlinedButton.styleFrom(foregroundColor: Colors.red),
                  child: const Text('Cancel'),
                ),
            ],
          ],
        ),
        if (owner && _roster != null) ...[
          const Divider(height: 32),
          Text('Participants (${_roster!.count})', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (_roster!.participants.isEmpty)
            const Text('No one has joined yet.')
          else
            ..._roster!.participants.map((p) => ListTile(
                  dense: true,
                  title: Text(p.userId, style: const TextStyle(fontFamily: 'monospace', fontSize: 12)),
                  subtitle: Text('${p.joinedAt.toLocal()}'),
                )),
        ],
        ..._reviewsSection(a),
      ],
    );
  }

  List<Widget> _reviewsSection(Activity a) {
    final reviews = _reviews;
    final myId = AuthScope.of(context).user?.userId;
    final ended = a.endsAt.isBefore(DateTime.now());
    final participated = a.userRole != null;
    final alreadyReviewed = reviews?.reviews.any((r) => r.userId == myId) ?? false;
    final canReview = ended && participated && !alreadyReviewed;

    return [
      const Divider(height: 32),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text('Reviews', style: Theme.of(context).textTheme.titleMedium),
          Text(
            a.reviewCount > 0
                ? '★ ${a.averageRating.toStringAsFixed(1)} · ${a.reviewCount}'
                : 'No reviews yet',
            style: const TextStyle(color: Colors.grey),
          ),
        ],
      ),
      const SizedBox(height: 8),
      if (reviews == null || reviews.reviews.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 8),
          child: Text('No reviews yet.', style: TextStyle(color: Colors.grey)),
        )
      else
        ...reviews.reviews.map(_reviewTile),

      if (canReview) ...[
        const SizedBox(height: 16),
        Text('Leave a review', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Row(
          children: [
            const Text('Rating:  '),
            DropdownButton<int>(
              value: _rating,
              onChanged: _reviewBusy ? null : (v) => setState(() => _rating = v ?? 5),
              items: [
                for (final r in [5, 4, 3, 2, 1])
                  DropdownMenuItem(value: r, child: Text('${'⭐' * r} ($r)')),
              ],
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _comment,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: 'Comment (optional)',
            hintText: 'Tell others how the activity was…',
            border: OutlineInputBorder(),
          ),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _reviewBusy ? null : _submitReview,
          child: Text(_reviewBusy ? 'Submitting…' : 'Submit review'),
        ),
      ] else if (ended && participated && alreadyReviewed) ...[
        const SizedBox(height: 8),
        const Text('You already reviewed this activity.', style: TextStyle(color: Colors.grey)),
      ],
    ];
  }

  Widget _reviewTile(Review r) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(r.userId,
                    style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                    overflow: TextOverflow.ellipsis),
              ),
              Text('⭐' * r.rating),
            ],
          ),
          if (r.comment.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(r.comment),
            ),
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text('${r.createdAt.toLocal()}'.split(' ').first,
                style: const TextStyle(color: Colors.grey, fontSize: 12)),
          ),
          const Divider(height: 16),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 100, child: Text(label, style: const TextStyle(color: Colors.grey))),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }
}
