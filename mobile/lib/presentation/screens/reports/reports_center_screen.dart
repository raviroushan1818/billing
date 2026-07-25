import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/reports_providers.dart';
import '../../../data/repositories/reports_repository.dart';
import '../../../core/utils/money_utils.dart';

class ReportsCenterScreen extends ConsumerStatefulWidget {
  const ReportsCenterScreen({super.key});

  @override
  ConsumerState<ReportsCenterScreen> createState() => _ReportsCenterScreenState();
}

class _ReportsCenterScreenState extends ConsumerState<ReportsCenterScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  DateTime _fromDate = DateTime.now().subtract(const Duration(days: 7));
  DateTime _toDate = DateTime.now();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _selectDateRange(BuildContext context) async {
    final picked = await showDateRangePicker(
      context: context,
      initialDateRange: DateTimeRange(start: _fromDate, end: _toDate),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now(),
    );
    if (picked != null) {
      setState(() {
        _fromDate = picked.start;
        _toDate = picked.end;
      });
    }
  }

  bool _isTaxRole(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'ACCOUNTANT';
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final repo = ref.watch(reportsRepositoryProvider);
    final isTaxRoleUser = _isTaxRole(user?.role);

    final fromStr = _fromDate.toIso8601String().substring(0, 10);
    final toStr = _toDate.toIso8601String().substring(0, 10);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Reports Center'),
        actions: [
          IconButton(
            icon: const Icon(Icons.date_range),
            onPressed: () => _selectDateRange(context),
            tooltip: 'Select date range',
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabs: const [
            Tab(text: 'Day Book', icon: Icon(Icons.menu_book)),
            Tab(text: 'Collections', icon: Icon(Icons.payment)),
            Tab(text: 'GSTR-1 Summary', icon: Icon(Icons.percent)),
            Tab(text: 'ITC Summary', icon: Icon(Icons.warehouse_outlined)),
          ],
        ),
      ),
      body: Column(
        children: [
          // Current date filter description bar
          Container(
            padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
            color: Theme.of(context).colorScheme.primary.withOpacity(0.05),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Filtering date range:', style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13, color: Colors.grey)),
                Text(
                  '$fromStr ➔ $toStr',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Theme.of(context).colorScheme.primary),
                ),
              ],
            ),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                // --- Tab 1: Day Book ---
                FutureBuilder<Map<String, dynamic>>(
                  future: repo.getDayBook(fromStr, toStr),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return Center(child: Text('Error: ${snapshot.error}'));
                    }
                    final data = snapshot.data ?? {};
                    return ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildSectionHeader('Invoices / Sales'),
                        _buildReportItem(context, 'Total Invoices Raised', data['invoicesCount']?.toString() ?? '0'),
                        _buildReportItem(context, 'Total Sales Amount', MoneyUtils.format(data['salesTotal'])),
                        _buildReportItem(context, 'Credit Notes Amount', '- ${MoneyUtils.format(data['creditNotesTotal'])}', color: Colors.red),
                        const SizedBox(height: 16),
                        _buildSectionHeader('Collections'),
                        _buildReportItem(context, 'Total Cash Collected', MoneyUtils.format(data['collectionsTotal'])),
                        _buildReportItem(context, 'Outstanding Receivable', MoneyUtils.format(data['outstandingTotal']), color: Colors.orange),
                        const SizedBox(height: 16),
                        _buildSectionHeader('Activity Log'),
                        _buildReportItem(context, 'Voided Documents Count', data['voidedCount']?.toString() ?? '0'),
                      ],
                    );
                  },
                ),

                // --- Tab 2: Collections ---
                FutureBuilder<Map<String, dynamic>>(
                  future: repo.getCollections(fromStr, toStr),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return Center(child: Text('Error: ${snapshot.error}'));
                    }
                    final data = snapshot.data ?? {};
                    final byMode = data['byMode'] as Map<String, dynamic>? ?? {};

                    if (byMode.isEmpty) {
                      return const Center(child: Text('No collections recorded.'));
                    }
                    final modes = byMode.keys.toList();
                    return ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: modes.length,
                      itemBuilder: (context, index) {
                        final mode = modes[index];
                        final amount = byMode[mode];
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 6),
                          child: ListTile(
                            leading: Icon(
                              mode == 'CASH'
                                  ? Icons.money
                                  : mode == 'UPI'
                                      ? Icons.smartphone
                                      : Icons.credit_card,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                            title: Text(mode),
                            trailing: Text(
                              MoneyUtils.format(amount),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ),
                        );
                      },
                    );
                  },
                ),

                // --- Tab 3: GSTR-1 Summary ---
                !isTaxRoleUser
                    ? const Center(child: Text('GSTR-1 report is visible to Admins and Accountants only.'))
                    : FutureBuilder<Map<String, dynamic>>(
                        future: repo.getGstr1(fromStr, toStr),
                        builder: (context, snapshot) {
                          if (snapshot.connectionState == ConnectionState.waiting) {
                            return const Center(child: CircularProgressIndicator());
                          }
                          if (snapshot.hasError) {
                            return Center(child: Text('Error: ${snapshot.error}'));
                          }
                          final data = snapshot.data ?? {};
                          return ListView(
                            padding: const EdgeInsets.all(16),
                            children: [
                              _buildSectionHeader('GSTR-1 Sales Report Summary'),
                              _buildReportItem(context, 'Total Taxable Sales Value', MoneyUtils.format(data['totalTaxable'])),
                              _buildReportItem(context, 'Total GST Tax Collected', MoneyUtils.format(data['totalTax'])),
                              const SizedBox(height: 16),
                              _buildSectionHeader('Document Categorization'),
                              _buildReportItem(context, 'B2B Sales Value', MoneyUtils.format(data['b2bTotal'])),
                              _buildReportItem(context, 'B2C Sales Value', MoneyUtils.format(data['b2cTotal'])),
                            ],
                          );
                        },
                      ),

                // --- Tab 4: ITC Summary ---
                FutureBuilder<Map<String, dynamic>>(
                  future: repo.getItc(fromStr, toStr),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator());
                    }
                    if (snapshot.hasError) {
                      return Center(child: Text('Error: ${snapshot.error}'));
                    }
                    final data = snapshot.data ?? {};
                    return ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _buildSectionHeader('Input Tax Credit Summary'),
                        _buildReportItem(context, 'Total Purchases Value', MoneyUtils.format(data['totalPurchases'])),
                        _buildReportItem(context, 'Total ITC (Input GST) Claimable', MoneyUtils.format(data['totalItc'])),
                        const SizedBox(height: 16),
                        _buildSectionHeader('ITC Tax Split'),
                        _buildReportItem(context, 'CGST Claimable', MoneyUtils.format(data['cgstClaimable'])),
                        _buildReportItem(context, 'SGST Claimable', MoneyUtils.format(data['sgstClaimable'])),
                        _buildReportItem(context, 'IGST Claimable', MoneyUtils.format(data['igstClaimable'])),
                      ],
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Text(
        title,
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.blueGrey),
      ),
    );
  }

  Widget _buildReportItem(BuildContext context, String label, String value, {Color? color}) {
    return Card(
      margin: const EdgeInsets.symmetric(vertical: 4),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
            Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
          ],
        ),
      ),
    );
  }
}
