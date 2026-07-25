import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../data/repositories/invoices_repository.dart';
import '../../../data/models/invoices_models.dart';
import '../../../core/utils/money_utils.dart';
import 'package:url_launcher/url_launcher.dart';

class InvoiceDetailScreen extends ConsumerStatefulWidget {
  final String id;

  const InvoiceDetailScreen({
    super.key,
    required this.id,
  });

  @override
  ConsumerState<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends ConsumerState<InvoiceDetailScreen> {
  final _formKey = GlobalKey<FormState>();
  Invoice? _invoice;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadInvoiceDetail();
  }

  Future<void> _loadInvoiceDetail() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final repo = ref.read(invoicesRepositoryProvider);
      final details = await repo.getInvoice(widget.id);
      setState(() {
        _invoice = details;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  bool _canAddPayment(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  bool _canVoid(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'ACCOUNTANT';
  }

  bool _canDelete(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR' || role == 'ACCOUNTANT';
  }

  void _showAddPaymentDialog() {
    if (_invoice == null) return;
    final maxDue = _invoice!.balanceDue;

    final amountController = TextEditingController(text: maxDue.toString());
    String mode = 'CASH';
    final upiRefController = TextEditingController();
    final cardLast4Controller = TextEditingController();
    final notesController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Record Payment'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Max Due: ${MoneyUtils.format(maxDue)}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: amountController,
                        decoration: const InputDecoration(
                          labelText: 'Payment Amount (₹) *',
                          prefixIcon: Icon(Icons.currency_rupee),
                        ),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Amount is required';
                          final parsed = double.tryParse(v.trim());
                          if (parsed == null || parsed <= 0) return 'Must be greater than 0';
                          if (parsed > maxDue) return 'Cannot exceed outstanding balance';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      DropdownButtonFormField<String>(
                        value: mode,
                        decoration: const InputDecoration(labelText: 'Payment Mode'),
                        items: const [
                          DropdownMenuItem(value: 'CASH', child: Text('Cash')),
                          DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                          DropdownMenuItem(value: 'CARD', child: Text('Card')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              mode = val;
                            });
                          }
                        },
                      ),
                      if (mode == 'UPI') ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: upiRefController,
                          decoration: const InputDecoration(
                            labelText: 'UPI Reference ID *',
                            prefixIcon: Icon(Icons.tag),
                          ),
                          validator: (v) =>
                              (v == null || v.trim().isEmpty) ? 'Reference ID is required for UPI' : null,
                        ),
                      ],
                      if (mode == 'CARD') ...[
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: cardLast4Controller,
                          decoration: const InputDecoration(
                            labelText: 'Card Last 4 Digits *',
                            prefixIcon: Icon(Icons.credit_card),
                          ),
                          maxLength: 4,
                          keyboardType: TextInputType.number,
                          validator: (v) {
                            if (v == null || v.trim().length != 4 || int.tryParse(v.trim()) == null) {
                              return 'Enter exactly 4 digits';
                            }
                            return null;
                          },
                        ),
                      ],
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: notesController,
                        decoration: const InputDecoration(
                          labelText: 'Payment Notes',
                          prefixIcon: Icon(Icons.notes),
                        ),
                      ),
                    ],
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
                    final amt = double.parse(amountController.text.trim());

                    final data = {
                      'mode': mode,
                      'amount': amt,
                      if (mode == 'UPI') 'upiRefId': upiRefController.text.trim().isEmpty ? null : upiRefController.text.trim(),
                      if (mode == 'CARD') 'cardLast4': cardLast4Controller.text.trim().isEmpty ? null : cardLast4Controller.text.trim(),
                      'notes': notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                    };

                    final success = await ref.read(invoicesNotifierProvider.notifier).addPayment(widget.id, data);

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Payment recorded successfully!' : 'Failed to record payment'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                      if (success) {
                        _loadInvoiceDetail();
                      }
                    }
                  },
                  child: const Text('Record'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showVoidDialog() {
    final reasonController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Void Invoice'),
          content: Form(
            key: _formKey,
            child: TextFormField(
              controller: reasonController,
              decoration: const InputDecoration(
                labelText: 'Reason for Voiding *',
                prefixIcon: Icon(Icons.question_answer_outlined),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Reason is required' : null,
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

                final success = await ref.read(invoicesNotifierProvider.notifier).voidInvoice(
                      widget.id,
                      reasonController.text.trim(),
                    );

                if (mounted) {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? 'Invoice voided successfully' : 'Failed to void invoice'),
                      backgroundColor: success ? Colors.green : Colors.red,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                  if (success) {
                    _loadInvoiceDetail();
                  }
                }
              },
              child: const Text('Void'),
            ),
          ],
        );
      },
    );
  }

  void _softDeleteConfirm() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Move to Recycle Bin'),
        content: const Text('Are you sure you want to delete this invoice? It can be restored later from recycle bin.'),
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
      final success = await ref.read(invoicesNotifierProvider.notifier).softDelete(widget.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Invoice moved to recycle bin' : 'Failed to delete invoice'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
        if (success) {
          context.pop();
        }
      }
    }
  }

  void _printInvoice() async {
    final res = await ref.read(invoicesNotifierProvider.notifier).printInvoice(widget.id);
    if (!mounted) return;

    if (res != null) {
      final url = res.signedUrl ?? '';
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Download / Print Invoice'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.check_circle_outline, color: Colors.green, size: 48),
              const SizedBox(height: 16),
              const Text(
                'PDF invoice generated successfully!',
                textAlign: TextAlign.center,
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 20),
              ElevatedButton.icon(
                onPressed: () async {
                  final uri = Uri.parse(url);
                  if (await canLaunchUrl(uri)) {
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                  } else {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Could not open download link')),
                      );
                    }
                  }
                },
                icon: const Icon(Icons.cloud_download_outlined),
                label: const Text('Download Invoice'),
              ),
              const SizedBox(height: 12),
              const Text(
                'Or view / copy raw URL:',
                style: TextStyle(fontSize: 11, color: Colors.grey),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.black.withOpacity(0.03),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.grey.withOpacity(0.2)),
                ),
                constraints: const BoxConstraints(maxHeight: 70),
                child: SingleChildScrollView(
                  child: SelectableText(
                    url,
                    style: const TextStyle(fontSize: 10, color: Colors.blue, decoration: TextDecoration.underline),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } else {
      final err = ref.read(invoicesNotifierProvider).error?.toString() ?? 'Failed to print invoice';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(err),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _shareEmail() {
    final emailController = TextEditingController();
    final messageController = TextEditingController(text: 'Please find attached invoice for your purchase.');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Share via Email'),
          content: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    labelText: 'Recipient Email *',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Email is required';
                    if (!RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(v.trim())) return 'Invalid email';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: messageController,
                  decoration: const InputDecoration(
                    labelText: 'Message Body',
                    prefixIcon: Icon(Icons.message_outlined),
                  ),
                  maxLines: 2,
                ),
              ],
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

                final success = await ref.read(invoicesNotifierProvider.notifier).shareEmail(
                      widget.id,
                      emailController.text.trim(),
                      messageController.text.trim(),
                    );

                if (mounted) {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? 'Invoice shared via email!' : 'Failed to send email'),
                      backgroundColor: success ? Colors.green : Colors.red,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              child: const Text('Send'),
            ),
          ],
        );
      },
    );
  }

  void _shareWhatsapp() {
    final phoneController = TextEditingController();
    final messageController = TextEditingController(text: 'Dear customer, here is your digital tax invoice.');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Text('Share via WhatsApp'),
          content: Form(
            key: _formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: phoneController,
                  decoration: const InputDecoration(
                    labelText: 'Recipient Mobile (e164 format) *',
                    prefixIcon: Icon(Icons.phone_outlined),
                    hintText: 'e.g. +919876543210',
                  ),
                  validator: (v) {
                    if (v == null || v.trim().isEmpty) return 'Mobile number is required';
                    if (!v.trim().startsWith('+')) return 'Must start with country code (+91)';
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: messageController,
                  decoration: const InputDecoration(
                    labelText: 'Message Body',
                    prefixIcon: Icon(Icons.message_outlined),
                  ),
                  maxLines: 2,
                ),
              ],
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

                final success = await ref.read(invoicesNotifierProvider.notifier).shareWhatsapp(
                      widget.id,
                      phoneController.text.trim(),
                      messageController.text.trim(),
                    );

                if (mounted) {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? 'Invoice shared via WhatsApp!' : 'Failed to share WhatsApp message'),
                      backgroundColor: success ? Colors.green : Colors.red,
                      behavior: SnackBarBehavior.floating,
                    ),
                  );
                }
              },
              child: const Text('Share'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final features = ref.watch(featuresProvider) ?? {};
    final hasWhatsapp = features['whatsapp'] ?? false;
    final profileConfig = ref.watch(profileConfigProvider);
    final partyLabel = profileConfig?.partyLabel ?? 'Party';

    if (_isLoading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    if (_error != null || _invoice == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice Detail')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, size: 64, color: Colors.redAccent),
              const SizedBox(height: 16),
              Text(_error ?? 'Invoice not found'),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadInvoiceDetail,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final invoice = _invoice!;
    final isVoid = invoice.status == 'VOID';
    final isDraft = invoice.status == 'DRAFT';
    final hasDues = invoice.balanceDue > 0 && !isVoid;

    // Check interstate CGST/SGST vs IGST
    final bool isInterstate = invoice.partyStateCode != null &&
        invoice.placeOfSupply != null &&
        invoice.partyStateCode != invoice.placeOfSupply;

    return Scaffold(
      appBar: AppBar(
        title: Text(invoice.invoiceNumber.isNotEmpty ? invoice.invoiceNumber : 'Draft Invoice'),
        actions: [
          if (_canDelete(user?.role))
            IconButton(
              icon: const Icon(Icons.delete_outline, color: Colors.red),
              onPressed: _softDeleteConfirm,
              tooltip: 'Move to Recycle Bin',
            ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // --- General info card ---
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              invoice.invoiceNumber.isNotEmpty ? invoice.invoiceNumber : 'DRAFT',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: 4),
                            Text('Date: ${invoice.invoiceDate}'),
                            if (invoice.dueDate != null) Text('Due Date: ${invoice.dueDate}'),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            _buildBadge(invoice.status, isStatus: true),
                            const SizedBox(height: 8),
                            _buildBadge(invoice.paymentStatus, isStatus: false),
                          ],
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // --- Customer Info Card ---
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '$partyLabel Information',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const Divider(height: 20),
                    _buildDetailRow('$partyLabel Name:', invoice.partyName),
                    if (invoice.partyPhone != null && invoice.partyPhone!.isNotEmpty)
                      _buildDetailRow('Phone:', invoice.partyPhone!),
                    if (invoice.partyGstin != null && invoice.partyGstin!.isNotEmpty)
                      _buildDetailRow('GSTIN:', invoice.partyGstin!),
                    if (invoice.partyAddress != null && invoice.partyAddress!.isNotEmpty)
                      _buildDetailRow('Billing Address:', invoice.partyAddress!),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // --- Invoice Lines Card ---
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Line Items Summary',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const Divider(height: 20),
                    ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: invoice.lines.length,
                      separatorBuilder: (context, index) => const Divider(),
                      itemBuilder: (context, index) {
                        final line = invoice.lines[index];
                        final subtotal = line.qty * line.rate * (1 - line.discount / 100);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(line.description),
                          subtitle: Text(
                            '${line.qty} ${line.unit ?? "NOS"} x ${MoneyUtils.format(line.rate)} '
                            '${line.discount > 0 ? "(-${line.discount}%)" : ""} '
                            '(GST ${line.gstRate}%)',
                          ),
                          trailing: Text(
                            MoneyUtils.format(subtotal),
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // --- Money Calculations Summary ---
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Financial Summary',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                    ),
                    const Divider(height: 20),
                    _buildFinancialRow('Taxable Subtotal:', MoneyUtils.format(invoice.totalAmount)),
                    
                    // CGST/SGST split representation
                    if (!isInterstate) ...[
                      _buildFinancialRow('CGST (Central Tax):', MoneyUtils.format(invoice.taxAmount / 2)),
                      _buildFinancialRow('SGST (State Tax):', MoneyUtils.format(invoice.taxAmount / 2)),
                    ] else ...[
                      _buildFinancialRow('IGST (Integrated Tax):', MoneyUtils.format(invoice.taxAmount)),
                    ],

                    _buildFinancialRow('Total Tax:', MoneyUtils.format(invoice.taxAmount)),
                    if (invoice.discountAmount > 0)
                      _buildFinancialRow('Discount (Overall):', '- ${MoneyUtils.format(invoice.discountAmount)}', color: Colors.green),
                    const Divider(height: 20),
                    _buildFinancialRow(
                      'Grand Total:',
                      MoneyUtils.format(invoice.grandTotal),
                      isBold: true,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    _buildFinancialRow('Amount Paid:', MoneyUtils.format(invoice.amountPaid), color: Colors.green),
                    _buildFinancialRow(
                      'Outstanding Balance Due:',
                      MoneyUtils.format(invoice.balanceDue),
                      isBold: true,
                      color: invoice.balanceDue > 0 ? Colors.redAccent : Colors.grey,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // --- Operations Actions Drawer/Tray ---
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ElevatedButton.icon(
                  onPressed: _printInvoice,
                  icon: const Icon(Icons.print),
                  label: const Text('Print Invoice PDF'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _shareEmail,
                        icon: const Icon(Icons.email_outlined),
                        label: const Text('Email PDF'),
                      ),
                    ),
                    if (hasWhatsapp) ...[
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _shareWhatsapp,
                          icon: const Icon(Icons.share_outlined),
                          label: const Text('WhatsApp'),
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 12),
                if (hasDues && _canAddPayment(user?.role))
                  ElevatedButton.icon(
                    onPressed: _showAddPaymentDialog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                    icon: const Icon(Icons.add_card),
                    label: const Text('Record Payment Payment'),
                  ),
                if (!isVoid && !isDraft && _canVoid(user?.role)) ...[
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _showVoidDialog,
                    style: OutlinedButton.styleFrom(
                      foregroundColor: Colors.redAccent,
                      side: const BorderSide(color: Colors.redAccent),
                    ),
                    icon: const Icon(Icons.cancel_presentation),
                    label: const Text('Void Invoice'),
                  ),
                ],
              ],
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
          SizedBox(
            width: 120,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600, color: Colors.grey),
            ),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontWeight: FontWeight.w500)),
          ),
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

  Widget _buildBadge(String status, {required bool isStatus}) {
    Color bg = Colors.grey.shade200;
    Color fg = Colors.grey.shade700;

    if (isStatus) {
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
    } else {
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
