import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../data/repositories/ops_repository.dart';
import '../../../data/models/ops_models.dart';
import '../../../core/utils/money_utils.dart';

class PurchaseDetailScreen extends ConsumerStatefulWidget {
  final String id;

  const PurchaseDetailScreen({
    super.key,
    required this.id,
  });

  @override
  ConsumerState<PurchaseDetailScreen> createState() => _PurchaseDetailScreenState();
}

class _PurchaseDetailScreenState extends ConsumerState<PurchaseDetailScreen> {
  Purchase? _purchase;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadPurchaseDetail();
  }

  Future<void> _loadPurchaseDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final repo = ref.read(opsRepositoryProvider);
      final details = await repo.getPurchase(widget.id);
      setState(() {
        _purchase = details;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  bool _canVoid(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'ACCOUNTANT';
  }

  void _voidPurchase() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Void Purchase Bill'),
        content: const Text('Are you sure you want to void this purchase? This will reverse any stock added.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Void', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ref.read(purchasesProvider.notifier).voidPurchase(widget.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Purchase voided successfully!' : 'Failed to void purchase'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
        if (success) {
          _loadPurchaseDetail();
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _purchase == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Purchase Detail')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.red),
              const SizedBox(height: 16),
              Text(_error ?? 'Purchase record not found'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadPurchaseDetail,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final purchase = _purchase!;
    final isVoid = purchase.status == 'VOID';

    return Scaffold(
      appBar: AppBar(
        title: Text('Purchase: ${purchase.billNo}'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // General Info Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(purchase.billNo, style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 4),
                        Text('Date: ${purchase.billDate}'),
                      ],
                    ),
                    _buildStatusBadge(purchase.status),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Vendor Info Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Vendor Information', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const Divider(height: 20),
                    _buildDetailRow('Vendor Name:', purchase.vendorName),
                    if (purchase.vendorPhone != null && purchase.vendorPhone!.isNotEmpty)
                      _buildDetailRow('Phone:', purchase.vendorPhone!),
                    if (purchase.vendorGstin != null && purchase.vendorGstin!.isNotEmpty)
                      _buildDetailRow('GSTIN:', purchase.vendorGstin!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Items lines summary
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Line Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const Divider(height: 20),
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: purchase.lines.length,
                      separatorBuilder: (context, index) => const Divider(),
                      itemBuilder: (context, index) {
                        final line = purchase.lines[index];
                        final subtotal = line.qty * line.rate;
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(line.description),
                          subtitle: Text('${line.qty} ${line.unit ?? "NOS"} x ${MoneyUtils.format(line.rate)} (GST ${line.gstRate}%)'),
                          trailing: Text(MoneyUtils.format(subtotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Financial breakdown
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Financial Summary', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    const Divider(height: 20),
                    _buildFinancialRow('Taxable Subtotal:', MoneyUtils.format(purchase.totalAmount)),
                    if (!purchase.interstate) ...[
                      _buildFinancialRow('CGST (Central Tax):', MoneyUtils.format(purchase.taxAmount / 2)),
                      _buildFinancialRow('SGST (State Tax):', MoneyUtils.format(purchase.taxAmount / 2)),
                    ] else ...[
                      _buildFinancialRow('IGST (Integrated Tax):', MoneyUtils.format(purchase.taxAmount)),
                    ],
                    _buildFinancialRow('Total GST Tax:', MoneyUtils.format(purchase.taxAmount)),
                    const Divider(height: 20),
                    _buildFinancialRow(
                      'Grand Total:',
                      MoneyUtils.format(purchase.grandTotal),
                      isBold: true,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            if (!isVoid && _canVoid(user?.role))
              ElevatedButton.icon(
                onPressed: _voidPurchase,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.cancel),
                label: const Text('Void Purchase Bill'),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 120, child: Text(label, style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.grey))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500))),
        ],
      ),
    );
  }

  Widget _buildFinancialRow(String label, String value, {bool isBold = false, Color? color}) {
    final style = TextStyle(
      fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
      fontSize: isBold ? 15 : 13,
      color: color,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: style),
          Text(value, style: style),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.teal.shade100;
    Color fg = Colors.teal.shade900;

    if (status == 'VOID') {
      bg = Colors.red.shade100;
      fg = Colors.red.shade900;
    } else if (status == 'DRAFT') {
      bg = Colors.amber.shade100;
      fg = Colors.amber.shade900;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        status,
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}
