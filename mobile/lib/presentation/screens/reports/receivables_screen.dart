import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/reports_providers.dart';
import '../../../data/models/reports_models.dart';
import '../../../core/utils/money_utils.dart';

class ReceivablesReportScreen extends ConsumerWidget {
  const ReceivablesReportScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final receivablesState = ref.watch(receivablesProvider);
    final profileConfig = ref.watch(profileConfigProvider);
    final partyLabel = profileConfig?.partyLabel ?? 'Party';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Receivables Report'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(receivablesProvider.future),
        child: receivablesState.when(
          data: (data) {
            final summary = data.summary;
            final rows = data.rows;

            if (rows.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.assignment_turned_in_outlined, size: 64, color: Colors.green.shade300),
                    const SizedBox(height: 16),
                    const Text(
                      'All dues collected!',
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 8),
                    const Text('No outstanding receivables recorded.', style: TextStyle(color: Colors.grey)),
                  ],
                ),
              );
            }

            return SingleChildScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // --- Overall receivables summary ---
                  Card(
                    color: Theme.of(context).colorScheme.primary.withOpacity(0.05),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(color: Theme.of(context).colorScheme.primary.withOpacity(0.2)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(20.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Total Outstanding Receivables',
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: Colors.grey.shade600,
                                      fontWeight: FontWeight.w500,
                                    ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                MoneyUtils.format(summary.totalDue),
                                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                      fontSize: 26,
                                      fontWeight: FontWeight.bold,
                                      color: Theme.of(context).colorScheme.primary,
                                    ),
                              ),
                            ],
                          ),
                          CircleAvatar(
                            radius: 28,
                            backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                            child: Icon(Icons.receipt_long, color: Theme.of(context).colorScheme.primary, size: 28),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),

                  // --- Aging buckets horizontal scroll ---
                  Text('Aging Buckets Breakdown', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 10),
                  SizedBox(
                    height: 100,
                    child: ListView(
                      scrollDirection: Axis.horizontal,
                      children: [
                        _buildAgingBucketCard(context, 'Current', summary.byBucket['current'] ?? 0, Colors.green),
                        _buildAgingBucketCard(context, '1 - 30 Days', summary.byBucket['1-30'] ?? 0, Colors.amber),
                        _buildAgingBucketCard(context, '31 - 60 Days', summary.byBucket['31-60'] ?? 0, Colors.orange),
                        _buildAgingBucketCard(context, '61 - 90 Days', summary.byBucket['61-90'] ?? 0, Colors.deepOrange),
                        _buildAgingBucketCard(context, '90+ Days', summary.byBucket['90+'] ?? 0, Colors.red),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),

                  // --- Outstanding Debts list ---
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Overdue Invoices (${summary.count})', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
                      const Text('Deep-link to collect', style: TextStyle(color: Colors.grey, fontSize: 11)),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: rows.length,
                    itemBuilder: (context, index) {
                      final row = rows[index];
                      return Card(
                        margin: const EdgeInsets.symmetric(vertical: 6),
                        child: ListTile(
                          onTap: () {
                            // Deep-link navigation
                            context.go('/invoices/${row.id}');
                          },
                          leading: CircleAvatar(
                            backgroundColor: _getOverdueColor(row.daysPastDue).withOpacity(0.1),
                            child: Text(
                              '${row.daysPastDue}d',
                              style: TextStyle(
                                color: _getOverdueColor(row.daysPastDue),
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                          title: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  row.partyName,
                                  style: const TextStyle(fontWeight: FontWeight.bold),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                MoneyUtils.format(row.balanceDue),
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          subtitle: Padding(
                            padding: const EdgeInsets.only(top: 4.0),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    'Bill: ${row.billNo}',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text('Due: ${row.dueDate}', style: const TextStyle(fontSize: 12)),
                              ],
                            ),
                          ),
                          trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
                        ),
                      );
                    },
                  ),
                ],
              ),
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('Error loading receivables: $e')),
        ),
      ),
    );
  }

  Widget _buildAgingBucketCard(BuildContext context, String label, double amount, Color color) {
    return Card(
      margin: const EdgeInsets.only(right: 12),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.3)),
      ),
      child: Container(
        width: 130,
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 12),
            ),
            const SizedBox(height: 6),
            Text(
              MoneyUtils.format(amount),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }

  Color _getOverdueColor(int days) {
    if (days == 0) return Colors.green;
    if (days <= 30) return Colors.amber.shade700;
    if (days <= 60) return Colors.orange;
    if (days <= 90) return Colors.deepOrange;
    return Colors.red;
  }
}
