import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../core/utils/money_utils.dart';

class InvoicesRegisterScreen extends ConsumerStatefulWidget {
  const InvoicesRegisterScreen({super.key});

  @override
  ConsumerState<InvoicesRegisterScreen> createState() => _InvoicesRegisterScreenState();
}

class _InvoicesRegisterScreenState extends ConsumerState<InvoicesRegisterScreen> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String val) {
    ref.read(invoicesFilterProvider.notifier).update((state) => state.copyWith(q: val));
  }

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR';
  }

  void _clearFilters() {
    _searchController.clear();
    ref.read(invoicesFilterProvider.notifier).state = InvoicesFilter();
  }

  @override
  Widget build(BuildContext context) {
    final invoicesState = ref.watch(invoicesListProvider);
    final filter = ref.watch(invoicesFilterProvider);
    final user = ref.watch(authProvider).user;
    final profileConfig = ref.watch(profileConfigProvider);
    final partyLabel = profileConfig?.partyLabel ?? 'Party';

    final hasWrite = _hasWriteAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Invoices Register'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.invalidate(invoicesListProvider),
            tooltip: 'Refresh list',
          ),
          IconButton(
            icon: const Icon(Icons.filter_alt_off),
            onPressed: _clearFilters,
            tooltip: 'Clear filters',
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter & Search bar
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
            child: Column(
              children: [
                TextField(
                  controller: _searchController,
                  onChanged: _onSearch,
                  decoration: InputDecoration(
                    hintText: 'Search by invoice # or $partyLabel...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              _onSearch('');
                            },
                          )
                        : null,
                  ),
                ),
                const SizedBox(height: 8),
                // Horizontal filter chips
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      // Status dropdown
                      _FilterDropdown(
                        label: 'Status',
                        currentValue: filter.status,
                        options: const ['DRAFT', 'FINALIZED', 'VOID'],
                        onSelected: (val) {
                          ref.read(invoicesFilterProvider.notifier).update(
                                (state) => val == null
                                    ? state.copyWith(clearStatus: true)
                                    : state.copyWith(status: val),
                              );
                        },
                      ),
                      const SizedBox(width: 8),
                      // Payment Status dropdown
                      _FilterDropdown(
                        label: 'Payment',
                        currentValue: filter.paymentStatus,
                        options: const ['UNPAID', 'PARTIAL', 'PAID'],
                        onSelected: (val) {
                          ref.read(invoicesFilterProvider.notifier).update(
                                (state) => val == null
                                    ? state.copyWith(clearPaymentStatus: true)
                                    : state.copyWith(paymentStatus: val),
                              );
                        },
                      ),
                      const SizedBox(width: 8),
                      // Document type dropdown
                      _FilterDropdown(
                        label: 'Doc Type',
                        currentValue: filter.documentType,
                        options: const ['TAX_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'],
                        onSelected: (val) {
                          ref.read(invoicesFilterProvider.notifier).update(
                                (state) => val == null
                                    ? state.copyWith(clearDocumentType: true)
                                    : state.copyWith(documentType: val),
                              );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Invoices List Area
          Expanded(
            child: invoicesState.when(
              data: (invoices) {
                if (invoices.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.receipt_long_outlined, size: 64, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(
                          'No invoices found matching criteria',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      ],
                    ),
                  );
                }

                // Calculate total outstanding receivables
                double totalOutstanding = 0.0;
                for (var inv in invoices) {
                  if (inv.status != 'VOID') {
                    totalOutstanding += inv.balanceDue;
                  }
                }

                return Column(
                  children: [
                    // Metrics summary header
                    if (totalOutstanding > 0)
                      Container(
                        width: double.infinity,
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50.withOpacity(0.8),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.orange.shade200),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              'Outstanding Receivables (Listed):',
                              style: TextStyle(fontWeight: FontWeight.w600, color: Colors.brown),
                            ),
                            Text(
                              MoneyUtils.format(totalOutstanding),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.brown),
                            ),
                          ],
                        ),
                      ),
                    Expanded(
                      child: ListView.builder(
                        itemCount: invoices.length,
                        itemBuilder: (context, index) {
                          final invoice = invoices[index];
                          return Card(
                            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                            child: ListTile(
                              onTap: () => context.go('/invoices/${invoice.id}'),
                              title: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    invoice.invoiceNumber.isNotEmpty ? invoice.invoiceNumber : 'Draft #${invoice.id.substring(0, 5)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                  Text(
                                    MoneyUtils.format(invoice.grandTotal),
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                              subtitle: Padding(
                                padding: const EdgeInsets.only(top: 6.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('Party: ${invoice.partyName}'),
                                    const SizedBox(height: 4),
                                    Row(
                                      children: [
                                        _buildStatusBadge(invoice.status),
                                        const SizedBox(width: 6),
                                        _buildPaymentStatusBadge(invoice.paymentStatus),
                                        if (invoice.balanceDue > 0 && invoice.status != 'VOID') ...[
                                          const SizedBox(width: 8),
                                          Text(
                                            'Due: ${MoneyUtils.format(invoice.balanceDue)}',
                                            style: const TextStyle(
                                              color: Colors.redAccent,
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                              trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Error: $err')),
            ),
          ),
        ],
      ),
      floatingActionButton: hasWrite
          ? FloatingActionButton(
              onPressed: () => context.go('/invoices/new'),
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey;
    Color fg = Colors.white;

    switch (status) {
      case 'DRAFT':
        bg = Colors.amber.shade100;
        fg = Colors.amber.shade900;
        break;
      case 'FINALIZED':
        bg = Colors.teal.shade100;
        fg = Colors.teal.shade900;
        break;
      case 'VOID':
        bg = Colors.red.shade100;
        fg = Colors.red.shade900;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }

  Widget _buildPaymentStatusBadge(String status) {
    Color bg = Colors.grey;
    Color fg = Colors.white;

    switch (status) {
      case 'UNPAID':
        bg = Colors.grey.shade200;
        fg = Colors.grey.shade700;
        break;
      case 'PARTIAL':
        bg = Colors.orange.shade100;
        fg = Colors.orange.shade900;
        break;
      case 'PAID':
        bg = Colors.green.shade100;
        fg = Colors.green.shade900;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        status,
        style: TextStyle(color: fg, fontSize: 10, fontWeight: FontWeight.bold),
      ),
    );
  }
}

class _FilterDropdown extends StatelessWidget {
  final String label;
  final String? currentValue;
  final List<String> options;
  final ValueChanged<String?> onSelected;

  const _FilterDropdown({
    required this.label,
    required this.currentValue,
    required this.options,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String?>(
      initialValue: currentValue,
      onSelected: onSelected,
      itemBuilder: (context) {
        return [
          PopupMenuItem<String?>(
            value: null,
            child: Text('All ${label}s', style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          ...options.map((opt) {
            return PopupMenuItem<String?>(
              value: opt,
              child: Text(opt),
            );
          }),
        ];
      },
      child: Chip(
        label: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(currentValue ?? label),
            const SizedBox(width: 4),
            const Icon(Icons.arrow_drop_down, size: 18),
          ],
        ),
        backgroundColor: currentValue != null ? Theme.of(context).colorScheme.primary.withOpacity(0.08) : null,
      ),
    );
  }
}
