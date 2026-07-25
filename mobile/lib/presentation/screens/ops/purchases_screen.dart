import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../core/utils/money_utils.dart';

class PurchasesScreen extends ConsumerWidget {
  const PurchasesScreen({super.key});

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final purchasesState = ref.watch(purchasesProvider);
    final user = ref.watch(authProvider).user;
    final hasWrite = _hasWriteAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Purchases Register'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(purchasesProvider.notifier).loadPurchases(),
        child: purchasesState.when(
          data: (purchases) {
            if (purchases.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.shopping_cart_checkout_outlined, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    const Text('No purchase records found', style: TextStyle(color: Colors.grey, fontSize: 16)),
                  ],
                ),
              );
            }
            return ListView.builder(
              itemCount: purchases.length,
              itemBuilder: (context, index) {
                final purchase = purchases[index];
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: ListTile(
                    onTap: () => context.go('/purchases/${purchase.id}'),
                    title: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          purchase.billNo,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          MoneyUtils.format(purchase.grandTotal),
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 4.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Vendor: ${purchase.vendorName}'),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text('Date: ${purchase.billDate}'),
                              _buildStatusBadge(purchase.status),
                            ],
                          ),
                        ],
                      ),
                    ),
                    trailing: const Icon(Icons.arrow_forward_ios, size: 14),
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('Error loading purchases: $e')),
        ),
      ),
      floatingActionButton: hasWrite
          ? FloatingActionButton(
              onPressed: () => context.go('/purchases/new'),
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
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
