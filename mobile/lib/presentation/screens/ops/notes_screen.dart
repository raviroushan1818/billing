import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../data/models/ops_models.dart';

class NotesScreen extends ConsumerStatefulWidget {
  const NotesScreen({super.key});

  @override
  ConsumerState<NotesScreen> createState() => _NotesScreenState();
}

class _NotesScreenState extends ConsumerState<NotesScreen> {
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(notesProvider.notifier).loadNotes();
    });
  }

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  bool _hasDeleteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR';
  }

  void _showAddEditNoteDialog([NoteItem? note]) {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final titleController = TextEditingController(text: note?.title ?? '');
    final bodyController = TextEditingController(text: note?.body ?? '');
    bool pinned = note?.pinned ?? false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(note == null ? 'Add Sticky Note' : 'Edit Sticky Note'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          controller: titleController,
                          decoration: const InputDecoration(
                            labelText: 'Title *',
                            prefixIcon: Icon(Icons.title),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Title is required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: bodyController,
                          decoration: const InputDecoration(
                            labelText: 'Body/Content (Optional)',
                            prefixIcon: Icon(Icons.sticky_note_2_outlined),
                          ),
                          maxLines: 4,
                        ),
                        const SizedBox(height: 12),
                        CheckboxListTile(
                          title: const Text('Pin to Top'),
                          value: pinned,
                          contentPadding: EdgeInsets.zero,
                          onChanged: (val) {
                            setState(() {
                              pinned = val ?? false;
                            });
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('Cancel'),
                ),
                TextButton(
                  onPressed: () async {
                    if (!_formKey.currentState!.validate()) return;

                    final data = {
                      'title': titleController.text.trim(),
                      'body': bodyController.text.trim().isEmpty ? null : bodyController.text.trim(),
                      'pinned': pinned,
                    };

                    bool success;
                    if (note == null) {
                      success = await ref.read(notesProvider.notifier).create(data);
                    } else {
                      success = await ref.read(notesProvider.notifier).updateNote(note.id, data);
                    }

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Sticky note saved' : 'Failed to save note'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _deleteNoteConfirm(NoteItem note) async {
    final user = ref.read(authProvider).user;
    if (!_hasDeleteAccess(user?.role)) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Note'),
        content: Text('Are you sure you want to delete "${note.title}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Delete', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ref.read(notesProvider.notifier).delete(note.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Note deleted' : 'Failed to delete note'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final features = ref.watch(featuresProvider) ?? {};
    final hasNotes = features['notes'] ?? false;

    if (!hasNotes) {
      return Scaffold(
        appBar: AppBar(title: const Text('Sticky Notes')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text('Sticky Notes are locked.', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Upgrade your subscription plan to create digital sticky notes.', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    final notesState = ref.watch(notesProvider);
    final user = ref.watch(authProvider).user;
    final hasWrite = _hasWriteAccess(user?.role);
    final hasDelete = _hasDeleteAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Sticky Notes Board'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(notesProvider.notifier).loadNotes(),
        child: notesState.when(
          data: (notes) {
            if (notes.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.note_alt_outlined, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    const Text('No notes recorded.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                  ],
                ),
              );
            }

            // Sort notes: pinned first
            final sortedNotes = List<NoteItem>.from(notes);
            sortedNotes.sort((a, b) {
              if (a.pinned && !b.pinned) return -1;
              if (!a.pinned && b.pinned) return 1;
              return b.createdAt.compareTo(a.createdAt);
            });

            return GridView.builder(
              padding: const EdgeInsets.all(16),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 200,
                childAspectRatio: 0.95,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
              ),
              itemCount: sortedNotes.length,
              itemBuilder: (context, index) {
                final note = sortedNotes[index];
                return Card(
                  color: note.pinned ? Colors.yellow.shade100 : Colors.yellow.shade50,
                  elevation: note.pinned ? 4 : 1,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                    side: BorderSide(
                      color: note.pinned ? Colors.yellow.shade700 : Colors.yellow.shade300,
                      width: 1,
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(12.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                note.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.brown),
                              ),
                            ),
                            if (note.pinned)
                              const Icon(Icons.push_pin, size: 14, color: Colors.orange),
                          ],
                        ),
                        const Divider(color: Colors.brown, height: 16),
                        Expanded(
                          child: Text(
                            note.body ?? '',
                            maxLines: 4,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 12, color: Colors.brown),
                          ),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            if (hasWrite)
                              IconButton(
                                icon: const Icon(Icons.edit_outlined, size: 16, color: Colors.teal),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => _showAddEditNoteDialog(note),
                              ),
                            if (hasDelete) ...[
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
                                padding: EdgeInsets.zero,
                                constraints: const BoxConstraints(),
                                onPressed: () => _deleteNoteConfirm(note),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('Error loading notes: $e')),
        ),
      ),
      floatingActionButton: hasWrite
          ? FloatingActionButton(
              onPressed: () => _showAddEditNoteDialog(),
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
