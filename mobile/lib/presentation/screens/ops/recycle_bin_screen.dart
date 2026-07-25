import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../core/utils/money_utils.dart';

class RecycleBinScreen extends ConsumerStatefulWidget {
  const RecycleBinScreen({super.key});

  @override
  ConsumerState<RecycleBinScreen> createState() => _RecycleBinScreenState();
}

class _RecycleBinScreenState extends ConsumerState<RecycleBinScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(recycleBinProvider.notifier).loadRecycleBin();
    });
  }

  bool _isAdmin(String? role) {
    return role == 'CLIENT_ADMIN';
  }

  bool _canRestore(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  void _restoreInvoice(String id, String invoiceNo) async {
    final success = await ref.read(recycleBinProvider.notifier).restore(id);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? 'Invoice $invoiceNo restored!' : 'Failed to restore invoice'),
          backgroundColor: success ? Colors.green : Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _permanentDeleteConfirm(String id, String invoiceNo) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Permanent Delete'),
        content: Text('Are you sure you want to permanently delete $invoiceNo? This action is irreversible.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Delete Permanently', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ref.read(recycleBinProvider.notifier).permanentDelete(id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Invoice permanently deleted' : 'Failed to delete invoice'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  void _emptyRecycleBinConfirm() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Empty Recycle Bin'),
        content: const Text('Are you sure you want to permanently delete all invoices in the recycle bin? This cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Empty Bin', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ref.read(recycleBinProvider.notifier).emptyBin();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Recycle bin emptied' : 'Failed to empty recycle bin'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final binState = ref.watch(recycleBinProvider);
    final user = ref.watch(authProvider).user;

    final isAdmin = _isAdmin(user?.role);
    final canRestore = _canRestore(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Recycle Bin'),
        actions: [
          if (isAdmin)
            IconButton(
              icon: const Icon(Icons.delete_sweep, color: Colors.redAccent),
              onPressed: _emptyRecycleBinConfirm,
              tooltip: 'Empty Recycle Bin',
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(recycleBinProvider.notifier).loadRecycleBin(),
        child: binState.when(
          data: (invoices) {
            if (invoices.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.delete_outline, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    const Text('Recycle Bin is empty.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                  ],
                ),
              );
            }
            return ListView.builder(
              itemCount: invoices.length,
              itemBuilder: (context, index) {
                final invoice = invoices[index];
                final invoiceNo = invoice.invoiceNumber.isNotEmpty ? invoice.invoiceNumber : 'Draft #${invoice.id.substring(0, 5)}';

                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: ListTile(
                    title: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(invoiceNo, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(MoneyUtils.format(invoice.grandTotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                      ],
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Party: ${invoice.partyName}'),
                          Text('Created: ${invoice.invoiceDate}'),
                        ],
                      ),
                    ),
                    trailing: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (canRestore)
                          IconButton(
                            icon: const Icon(Icons.restore, color: Colors.green),
                            onPressed: () => _restoreInvoice(invoice.id, invoiceNo),
                            tooltip: 'Restore',
                          ),
                        if (isAdmin)
                          IconButton(
                            icon: const Icon(Icons.delete_forever, color: Colors.red),
                            onPressed: () => _permanentDeleteConfirm(invoice.id, invoiceNo),
                            tooltip: 'Delete Permanently',
                          ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('Error: $e')),
        ),
      ),
    );
  }
}
