import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../data/models/ops_models.dart';
import '../../../data/models/invoices_models.dart';
import '../../../core/utils/money_utils.dart';

class EwayScreen extends ConsumerStatefulWidget {
  const EwayScreen({super.key});

  @override
  ConsumerState<EwayScreen> createState() => _EwayScreenState();
}

class _EwayScreenState extends ConsumerState<EwayScreen> {
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(ewaysProvider.notifier).loadEways();
      // Fetch finalized invoices to attach to E-way
      ref.read(invoicesFilterProvider.notifier).update((state) => state.copyWith(status: 'FINALIZED'));
    });
  }

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  bool _hasCancelAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'ACCOUNTANT';
  }

  void _showGenerateEwayDialog() {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final invoicesState = ref.read(invoicesListProvider);
    List<Invoice> invoices = [];
    invoicesState.whenData((list) => invoices = list);

    if (invoices.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No finalized invoices available to link with E-way.'),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    Invoice? selectedInvoice;
    final fromController = TextEditingController();
    final toController = TextEditingController();
    final transporterNameController = TextEditingController();
    final transporterIdController = TextEditingController();
    final vehicleNoController = TextEditingController();
    final distanceController = TextEditingController();
    final docValueController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Generate E-way Bill'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        DropdownButtonFormField<Invoice>(
                          decoration: const InputDecoration(labelText: 'Finalized Invoice *'),
                          items: invoices.map((inv) {
                            return DropdownMenuItem(
                              value: inv,
                              child: Text('${inv.invoiceNumber} (${inv.partyName})'),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                selectedInvoice = val;
                                toController.text = val.partyAddress ?? '';
                                docValueController.text = val.grandTotal.toString();
                              });
                            }
                          },
                          validator: (v) => v == null ? 'Invoice is required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: fromController,
                          decoration: const InputDecoration(labelText: 'Dispatch From Place'),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: toController,
                          decoration: const InputDecoration(labelText: 'Ship To Place'),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: transporterNameController,
                                decoration: const InputDecoration(labelText: 'Transporter Name'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: transporterIdController,
                                decoration: const InputDecoration(labelText: 'Transporter ID'),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: vehicleNoController,
                                decoration: const InputDecoration(labelText: 'Vehicle Number'),
                                textCapitalization: TextCapitalization.characters,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: distanceController,
                                decoration: const InputDecoration(labelText: 'Distance (KM)'),
                                keyboardType: TextInputType.number,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: docValueController,
                          decoration: const InputDecoration(labelText: 'Document Value (₹)'),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
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
                      'invoiceId': selectedInvoice!.id,
                      'fromPlace': fromController.text.trim().isEmpty ? null : fromController.text.trim(),
                      'toPlace': toController.text.trim().isEmpty ? null : toController.text.trim(),
                      'transporterName': transporterNameController.text.trim().isEmpty ? null : transporterNameController.text.trim(),
                      'transporterId': transporterIdController.text.trim().isEmpty ? null : transporterIdController.text.trim(),
                      'vehicleNo': vehicleNoController.text.trim().isEmpty ? null : vehicleNoController.text.trim().toUpperCase(),
                      'distanceKm': distanceController.text.trim().isEmpty ? null : int.tryParse(distanceController.text.trim()),
                      'documentValue': docValueController.text.trim().isEmpty ? null : double.tryParse(docValueController.text.trim()),
                    };

                    final success = await ref.read(ewaysProvider.notifier).create(data);

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'E-way bill generated successfully!' : 'Failed to generate E-way bill'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                  child: const Text('Generate'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _cancelEwayConfirm(EwayBill eway) async {
    final user = ref.read(authProvider).user;
    if (!_hasCancelAccess(user?.role)) return;

    final reasonController = TextEditingController();

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cancel E-way Bill'),
        content: Form(
          key: _formKey,
          child: TextFormField(
            controller: reasonController,
            decoration: const InputDecoration(labelText: 'Cancellation Reason *'),
            validator: (v) => (v == null || v.trim().isEmpty) ? 'Reason is required' : null,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Close'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text('Cancel Bill', style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      if (!_formKey.currentState!.validate()) return;
      final success = await ref.read(ewaysProvider.notifier).cancel(eway.id, reasonController.text.trim());
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'E-way bill cancelled!' : 'Failed to cancel E-way bill'),
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
    final hasEway = features['eway'] ?? false;

    if (!hasEway) {
      return Scaffold(
        appBar: AppBar(title: const Text('E-way Billing')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text('E-way Billing is locked.', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              const Text('Upgrade your subscription plan to generate E-way documents.', style: TextStyle(color: Colors.grey)),
            ],
          ),
        ),
      );
    }

    final ewaysState = ref.watch(ewaysProvider);
    final user = ref.watch(authProvider).user;
    final hasWrite = _hasWriteAccess(user?.role);
    final hasCancel = _hasCancelAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('E-way Bills Register'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(ewaysProvider.notifier).loadEways(),
        child: ewaysState.when(
          data: (eways) {
            if (eways.isEmpty) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.local_shipping_outlined, size: 64, color: Colors.grey.shade400),
                    const SizedBox(height: 16),
                    const Text('No E-way bills generated.', style: TextStyle(color: Colors.grey, fontSize: 16)),
                  ],
                ),
              );
            }
            return ListView.builder(
              itemCount: eways.length,
              itemBuilder: (context, index) {
                final eway = eways[index];
                final isCancelled = eway.status == 'CANCELLED';
                return Card(
                  margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: ListTile(
                    title: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          eway.ewayBillNo ?? 'Pending Draft #${eway.id.substring(0, 5)}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        _buildStatusBadge(eway.status),
                      ],
                    ),
                    subtitle: Padding(
                      padding: const EdgeInsets.only(top: 6.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Invoice Number: ${eway.invoiceNo ?? "Attached"}'),
                          if (eway.vehicleNo != null) Text('Vehicle Number: ${eway.vehicleNo}'),
                          if (eway.fromPlace != null && eway.toPlace != null)
                            Text('Route: ${eway.fromPlace} ➔ ${eway.toPlace}'),
                          if (isCancelled && eway.cancelReason != null)
                            Text('Cancel Reason: ${eway.cancelReason}', style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
                        ],
                      ),
                    ),
                    trailing: (!isCancelled && hasCancel)
                        ? IconButton(
                            icon: const Icon(Icons.cancel_outlined, color: Colors.redAccent),
                            onPressed: () => _cancelEwayConfirm(eway),
                            tooltip: 'Cancel E-way',
                          )
                        : null,
                  ),
                );
              },
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, s) => Center(child: Text('Error loading Eways: $e')),
        ),
      ),
      floatingActionButton: hasWrite
          ? FloatingActionButton(
              onPressed: _showGenerateEwayDialog,
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.green.shade100;
    Color fg = Colors.green.shade900;

    if (status == 'CANCELLED') {
      bg = Colors.red.shade100;
      fg = Colors.red.shade900;
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
