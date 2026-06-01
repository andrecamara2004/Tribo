// lib/screens/activity_form_screen.dart
import 'package:flutter/material.dart';

import '../api/activities.dart';
import '../api/http.dart';
import '../api/services_scope.dart';

/// M2-2 — Create / edit an activity. With an activityId it edits; without, it
/// creates. Reached only from manager/partner UI (the create FAB / Edit button).
class ActivityFormScreen extends StatefulWidget {
  const ActivityFormScreen({super.key, this.activityId});
  final String? activityId;

  bool get editing => activityId != null;

  @override
  State<ActivityFormScreen> createState() => _ActivityFormScreenState();
}

class _ActivityFormScreenState extends State<ActivityFormScreen> {
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _category = TextEditingController();
  final _location = TextEditingController();
  final _capacity = TextEditingController(text: '10');
  DateTime? _startsAt;
  DateTime? _endsAt;

  bool _loading = false;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    if (widget.editing) _loadExisting();
  }

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _category.dispose();
    _location.dispose();
    _capacity.dispose();
    super.dispose();
  }

  Future<void> _loadExisting() async {
    setState(() => _loading = true);
    try {
      final a = await ServicesScope.of(context).activities.get(widget.activityId!);
      _title.text = a.title;
      _description.text = a.description;
      _category.text = a.category;
      _location.text = a.location;
      _capacity.text = '${a.capacity}';
      setState(() {
        _startsAt = a.startsAt.toLocal();
        _endsAt = a.endsAt.toLocal();
      });
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pickDateTime(bool isStart) async {
    final now = DateTime.now();
    final initial = (isStart ? _startsAt : _endsAt) ?? now.add(const Duration(days: 1));
    final date = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365 * 3)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(initial),
    );
    if (time == null) return;
    final picked = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    setState(() {
      if (isStart) {
        _startsAt = picked;
      } else {
        _endsAt = picked;
      }
    });
  }

  Future<void> _submit() async {
    setState(() => _error = null);
    final title = _title.text.trim();
    final capacity = int.tryParse(_capacity.text.trim());
    if (title.isEmpty) {
      setState(() => _error = 'Title is required.');
      return;
    }
    if (_startsAt == null || _endsAt == null) {
      setState(() => _error = 'Start and end times are required.');
      return;
    }
    if (!_endsAt!.isAfter(_startsAt!)) {
      setState(() => _error = 'End must be after start.');
      return;
    }
    if (capacity == null || capacity < 1) {
      setState(() => _error = 'Capacity must be a whole number ≥ 1.');
      return;
    }

    final input = ActivityInput(
      title: title,
      description: _description.text.trim(),
      category: _category.text.trim(),
      location: _location.text.trim(),
      startsAt: _startsAt!,
      endsAt: _endsAt!,
      capacity: capacity,
    );

    setState(() => _busy = true);
    try {
      final api = ServicesScope.of(context).activities;
      widget.editing ? await api.update(widget.activityId!, input) : await api.create(input);
      if (mounted) Navigator.of(context).pop();
    } on ApiError catch (e) {
      setState(() => _error = e.message);
    } catch (_) {
      setState(() => _error = 'Save failed.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.editing ? 'Edit activity' : 'Create activity')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                _field(_title, 'Title'),
                _field(_description, 'Description', maxLines: 3),
                _field(_category, 'Category (e.g. sports)'),
                _field(_location, 'Location'),
                const SizedBox(height: 8),
                _dateTile('Starts', _startsAt, () => _pickDateTime(true)),
                _dateTile('Ends', _endsAt, () => _pickDateTime(false)),
                _field(_capacity, 'Capacity', keyboardType: TextInputType.number),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                ],
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: _busy ? null : _submit,
                  child: Text(_busy ? 'Saving…' : (widget.editing ? 'Save changes' : 'Create')),
                ),
              ],
            ),
    );
  }

  Widget _field(TextEditingController c, String label,
      {int maxLines = 1, TextInputType? keyboardType}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: TextField(
        controller: c,
        maxLines: maxLines,
        keyboardType: keyboardType,
        decoration: InputDecoration(labelText: label, border: const OutlineInputBorder()),
      ),
    );
  }

  Widget _dateTile(String label, DateTime? value, VoidCallback onTap) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      subtitle: Text(value == null ? 'Not set' : '${value.toLocal()}'),
      trailing: const Icon(Icons.event),
      onTap: onTap,
    );
  }
}
