import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../data/models/auth_models.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/reports_providers.dart';
import '../../../core/utils/money_utils.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Dynamic watches
    final authState = ref.watch(authProvider);
    final user = authState.user;
    final tenant = authState.tenant;
    final features = authState.features ?? {};
    final subscription = authState.subscription;

    final hasPos = features['pos'] ?? false;
    final hasStock = features['stock'] ?? false;

    // Load today's financial metrics
    final dayBookState = ref.watch(dashboardDayBookProvider);
    final receivablesState = ref.watch(receivablesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Overview Dashboard'),
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await ref.read(authProvider.notifier).initialize();
          ref.invalidate(dashboardDayBookProvider);
          ref.invalidate(receivablesProvider);
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Header Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 30,
                        backgroundColor: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                        child: Text(
                          user?.firstName.substring(0, 1).toUpperCase() ?? 'U',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              tenant?.name ?? user?.tenantName ?? 'My Enterprise',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'User: ${user?.fullName} (${user?.role})',
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            Text(
                              'Client ID: ${user?.clientId}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // --- Quick Actions Bar ---
              Text('Quick Operations', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => context.push('/invoices/new'),
                      icon: const Icon(Icons.add),
                      label: const FittedBox(fit: BoxFit.scaleDown, child: Text('Raise Invoice')),
                      style: ElevatedButton.styleFrom(
                        minimumSize: const Size(0, 50),
                        backgroundColor: Theme.of(context).colorScheme.primary,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (hasPos) ...[
                    Expanded(
                      child: ElevatedButton.icon(
                        onPressed: () => context.go('/pos'),
                        icon: const Icon(Icons.point_of_sale),
                        label: const FittedBox(fit: BoxFit.scaleDown, child: Text('POS Register')),
                        style: ElevatedButton.styleFrom(
                          minimumSize: const Size(0, 50),
                          backgroundColor: Theme.of(context).colorScheme.secondary,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                  ] else ...[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => context.go('/receivables'),
                        icon: const Icon(Icons.analytics_outlined),
                        label: const FittedBox(fit: BoxFit.scaleDown, child: Text('Receivables')),
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size(0, 50),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              if (hasPos) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.go('/receivables'),
                    icon: const Icon(Icons.analytics_outlined),
                    label: const FittedBox(fit: BoxFit.scaleDown, child: Text('Receivables Summary')),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size(0, 50),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 24),

              // --- Today's Day-Book Summary widget ---
              Text('Today\'s Performance', style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              dayBookState.when(
                data: (data) {
                  final double sales = MoneyUtils.parse(data['salesTotal'] ?? 0.0);
                  final double collected = MoneyUtils.parse(data['collectionsTotal'] ?? 0.0);
                  final int count = data['invoicesCount'] as int? ?? 0;

                  return Row(
                    children: [
                      Expanded(
                        child: _buildMetricMiniCard(
                          context,
                          'Sales Raised',
                          MoneyUtils.format(sales),
                          '$count Bills',
                          Colors.blue,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: _buildMetricMiniCard(
                          context,
                          'Cash Collected',
                          MoneyUtils.format(collected),
                          'Collections',
                          Colors.green,
                        ),
                      ),
                    ],
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, s) => Text('Error loading today\'s summary: $e'),
              ),
              const SizedBox(height: 16),

              // --- Receivables card widget ---
              receivablesState.when(
                data: (data) {
                  final summary = data.summary;
                  if (summary.totalDue == 0) return const SizedBox();
                  return Card(
                    color: Colors.red.shade50.withOpacity(0.5),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.red.shade200),
                    ),
                    child: ListTile(
                      onTap: () => context.go('/receivables'),
                      leading: const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 28),
                      title: const Text('Outstanding Receivables Due', style: TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('${summary.count} invoices are waiting for collections.'),
                      trailing: Text(
                        MoneyUtils.format(summary.totalDue),
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.redAccent, fontSize: 16),
                      ),
                    ),
                  );
                },
                loading: () => const SizedBox(),
                error: (e, s) => const SizedBox(),
              ),
              const SizedBox(height: 24),

              // Subscription Limits Details
              Text(
                'Plan Usage & Limits',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _planDisplayName(subscription, tenant),
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                  color: Theme.of(context).colorScheme.primary,
                                  fontWeight: FontWeight.bold,
                                ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Theme.of(context).colorScheme.primary.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              _planStatus(subscription, tenant),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.primary,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Divider(),
                      const SizedBox(height: 8),
                      _buildSubscriptionMetric(
                        context,
                        'Invoices Raised This Month',
                        subscription?['usage']?['invoices']?.toString() ?? '0',
                        _invoiceLimitLabel(subscription),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Feature Flags Locks
              Text(
                'SaaS Feature Status',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                childAspectRatio: 2.2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                children: [
                  _buildFeatureCard(context, 'Stock & Godowns', features['stock'] ?? false, Icons.inventory),
                  _buildFeatureCard(context, 'Partial Payment', features['partialPay'] ?? false, Icons.payment),
                  _buildFeatureCard(context, 'E-way Billing', features['eway'] ?? false, Icons.local_shipping),
                  _buildFeatureCard(context, 'POS Register', features['pos'] ?? false, Icons.point_of_sale),
                  _buildFeatureCard(context, 'WhatsApp Shares', features['whatsapp'] ?? false, Icons.share),
                  _buildFeatureCard(context, 'Credit Notes', features['creditNotes'] ?? false, Icons.receipt),
                  _buildFeatureCard(context, 'SMTP Config', features['smtp'] ?? false, Icons.mail),
                  _buildFeatureCard(context, 'Extra Notes', features['notes'] ?? false, Icons.note),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildMetricMiniCard(BuildContext context, String label, String value, String subtitle, Color color) {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: color.withOpacity(0.2)),
      ),
      color: color.withOpacity(0.03),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 4),
            Text(subtitle, style: const TextStyle(color: Colors.grey, fontSize: 11)),
          ],
        ),
      ),
    );
  }

  /// Prefer nested plan name; fall back to tenant.planCode (matches web BillingPage).
  String _planDisplayName(Map<String, dynamic>? subscription, Tenant? tenant) {
    final planName = subscription?['subscription']?['plan']?['name']?.toString();
    if (planName != null && planName.isNotEmpty) return planName;
    final planCode = subscription?['tenant']?['planCode']?.toString() ?? tenant?.planCode;
    if (planCode != null && planCode.isNotEmpty) return planCode;
    return 'Default Tier';
  }

  String _planStatus(Map<String, dynamic>? subscription, Tenant? tenant) {
    final subStatus = subscription?['subscription']?['status']?.toString();
    if (subStatus != null && subStatus.isNotEmpty) return subStatus.toUpperCase();
    final tenantStatus =
        subscription?['tenant']?['status']?.toString() ?? tenant?.status;
    if (tenantStatus != null && tenantStatus.isNotEmpty) {
      return tenantStatus.toUpperCase();
    }
    return 'ACTIVE';
  }

  String _invoiceLimitLabel(Map<String, dynamic>? subscription) {
    final fromPlan = subscription?['subscription']?['plan']?['maxInvoices'];
    if (fromPlan != null) return fromPlan.toString();
    final fromTenant = subscription?['tenant']?['maxInvoices'];
    if (fromTenant != null) return fromTenant.toString();
    return 'Unlimited';
  }

  Widget _buildSubscriptionMetric(
    BuildContext context,
    String title,
    String current,
    String limit,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        Text(
          '$current / $limit',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                fontWeight: FontWeight.bold,
              ),
        ),
      ],
    );
  }

  Widget _buildFeatureCard(BuildContext context, String name, bool isEnabled, IconData icon) {
    final color = isEnabled ? Theme.of(context).colorScheme.primary : Colors.grey.shade400;

    return Card(
      color: isEnabled
          ? Theme.of(context).colorScheme.primary.withOpacity(0.05)
          : Theme.of(context).colorScheme.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(
          color: isEnabled ? Theme.of(context).colorScheme.primary.withOpacity(0.3) : Colors.grey.shade300,
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: isEnabled ? Theme.of(context).textTheme.bodyLarge?.color : Colors.grey.shade500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    isEnabled ? 'Enabled' : 'Locked',
                    style: TextStyle(
                      fontSize: 10,
                      color: isEnabled ? Theme.of(context).colorScheme.primary : Colors.grey,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            if (!isEnabled)
              const Icon(Icons.lock_outline, size: 14, color: Colors.grey),
          ],
        ),
      ),
    );
  }
}
