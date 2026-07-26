import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../../data/models/invoices_models.dart';
import '../../../core/utils/money_utils.dart';
import '../../widgets/ui_helpers.dart';

class NewInvoiceScreen extends ConsumerStatefulWidget {
  const NewInvoiceScreen({super.key});

  @override
  ConsumerState<NewInvoiceScreen> createState() => _NewInvoiceScreenState();
}

class _NewInvoiceScreenState extends ConsumerState<NewInvoiceScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Party state
  Party? _selectedParty;
  final _partyNameController = TextEditingController();
  final _partyPhoneController = TextEditingController();
  final _partyGstinController = TextEditingController();
  final _partyAddressController = TextEditingController();
  final _partyStateCodeController = TextEditingController();
  final _partyExternalIdController = TextEditingController();

  // Invoice parameters
  final _placeOfSupplyController = TextEditingController(text: '29'); // Karnataka default code
  String _supplyType = 'B2C';
  bool _reverseCharge = false;
  final _notesController = TextEditingController();
  final _discountAmountController = TextEditingController(text: '0');

  // Dates
  DateTime _invoiceDate = DateTime.now();
  DateTime? _dueDate;

  // Invoice Lines
  final List<InvoiceLine> _lines = [];

  // Initial Payment Parameters
  double _initialPayment = 0.0;
  String _paymentMode = 'CASH';
  final _upiRefController = TextEditingController();
  final _cardLast4Controller = TextEditingController();
  final _paymentNotesController = TextEditingController();
  bool _finalize = true;

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(partiesProvider.notifier).loadParties();
      ref.read(itemsProvider.notifier).loadItems();
      ref.read(godownsProvider.notifier).loadGodowns();
    });
  }

  @override
  void dispose() {
    _partyNameController.dispose();
    _partyPhoneController.dispose();
    _partyGstinController.dispose();
    _partyAddressController.dispose();
    _partyStateCodeController.dispose();
    _partyExternalIdController.dispose();
    _placeOfSupplyController.dispose();
    _notesController.dispose();
    _discountAmountController.dispose();
    _upiRefController.dispose();
    _cardLast4Controller.dispose();
    _paymentNotesController.dispose();
    super.dispose();
  }

  // --- Dynamic Math ---
  double get _totalAmount {
    double sum = 0.0;
    for (var line in _lines) {
      final lineSub = line.qty * line.rate;
      final lineDisc = lineSub * (line.discount / 100);
      sum += (lineSub - lineDisc);
    }
    return sum;
  }

  double get _taxAmount {
    double tax = 0.0;
    for (var line in _lines) {
      final lineSub = line.qty * line.rate;
      final lineDisc = lineSub * (line.discount / 100);
      final lineTotal = lineSub - lineDisc;
      tax += lineTotal * (line.gstRate / 100);
    }
    return tax;
  }

  double get _grandTotal {
    final overallDisc = double.tryParse(_discountAmountController.text.trim()) ?? 0.0;
    final total = _totalAmount + _taxAmount - overallDisc;
    return total < 0 ? 0.0 : total;
  }

  void _selectParty(Party party) {
    setState(() {
      _selectedParty = party;
      _partyNameController.text = party.name;
      _partyPhoneController.text = party.phone ?? '';
      _partyGstinController.text = party.gstin ?? '';
      _partyAddressController.text = party.address ?? '';
      _partyStateCodeController.text = party.stateCode ?? '';
      _partyExternalIdController.text = party.externalId ?? '';
      if (party.stateCode != null && party.stateCode!.isNotEmpty) {
        _placeOfSupplyController.text = party.stateCode!;
        _supplyType = party.gstin != null && party.gstin!.isNotEmpty ? 'B2B' : 'B2C';
      }
    });
  }

  void _showAddLineDialog() {
    final itemsState = ref.read(itemsProvider);
    final godownsState = ref.read(godownsProvider);
    final features = ref.read(featuresProvider) ?? {};
    final hasStock = features['stock'] ?? false;

    List<Item> items = [];
    List<Godown> godowns = [];
    itemsState.whenData((list) => items = list);
    godownsState.whenData((list) => godowns = list);

    Item? selectedItem;
    final descController = TextEditingController();
    final hsnController = TextEditingController();
    final unitController = TextEditingController(text: 'NOS');
    final qtyController = TextEditingController(text: '1');
    final rateController = TextEditingController();
    final discountController = TextEditingController(text: '0');
    final gstController = TextEditingController(text: '18');
    Godown? selectedGodown;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Add Line Item'),
              content: SizedBox(
                width: MediaQuery.sizeOf(context).width * 0.9,
                child: SingleChildScrollView(
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Item Suggestion Search
                        DropdownButtonFormField<Item>(
                          isExpanded: true,
                          decoration: const InputDecoration(
                            labelText: 'Select Catalog Item',
                            prefixIcon: Icon(Icons.shopping_bag_outlined),
                          ),
                          items: items.map((i) {
                            return UiHelpers.menuItem<Item>(
                              value: i,
                              label: '${i.name} (₹${i.rate})',
                            );
                          }).toList(),
                          onChanged: (item) {
                            if (item != null) {
                              setState(() {
                                selectedItem = item;
                                descController.text = item.name;
                                hsnController.text = item.hsnSac ?? '';
                                unitController.text = item.unit ?? 'NOS';
                                rateController.text = item.rate.toString();
                                gstController.text = item.gstRate.toString();
                              });
                            }
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: descController,
                          decoration: const InputDecoration(
                            labelText: 'Description/Name *',
                            prefixIcon: Icon(Icons.description_outlined),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Description is required' : null,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: qtyController,
                                decoration: const InputDecoration(labelText: 'Qty *'),
                                keyboardType: TextInputType.number,
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return 'Required';
                                  final parsed = int.tryParse(v.trim());
                                  if (parsed == null || parsed <= 0) return 'Must be >= 1';
                                  return null;
                                },
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: rateController,
                                decoration: const InputDecoration(labelText: 'Rate (₹) *'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                validator: (v) {
                                  if (v == null || v.trim().isEmpty) return 'Required';
                                  if (double.tryParse(v.trim()) == null) return 'Must be number';
                                  return null;
                                },
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: discountController,
                                decoration: const InputDecoration(labelText: 'Discount (%)'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: gstController,
                                decoration: const InputDecoration(labelText: 'GST (%)'),
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: unitController,
                                decoration: const InputDecoration(labelText: 'Unit'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: TextFormField(
                                controller: hsnController,
                                decoration: const InputDecoration(labelText: 'HSN/SAC'),
                              ),
                            ),
                          ],
                        ),
                        if (hasStock && godowns.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          DropdownButtonFormField<Godown>(
                            isExpanded: true,
                            value: selectedGodown,
                            decoration: const InputDecoration(
                              labelText: 'Stock Godown',
                              prefixIcon: Icon(Icons.warehouse_outlined),
                            ),
                            items: godowns.map((g) {
                              return UiHelpers.menuItem<Godown>(
                                value: g,
                                label: g.name,
                              );
                            }).toList(),
                            onChanged: (val) {
                              setState(() {
                                selectedGodown = val;
                              });
                            },
                          ),
                        ],
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
                  onPressed: () {
                    if (!_formKey.currentState!.validate()) return;

                    final line = InvoiceLine(
                      itemId: selectedItem?.id,
                      description: descController.text.trim(),
                      hsnSac: hsnController.text.trim().isEmpty ? null : hsnController.text.trim(),
                      unit: unitController.text.trim().isEmpty ? null : unitController.text.trim(),
                      qty: double.parse(qtyController.text.trim()),
                      rate: double.parse(rateController.text.trim()),
                      discount: double.tryParse(discountController.text.trim()) ?? 0.0,
                      gstRate: double.tryParse(gstController.text.trim()) ?? 18.0,
                      godownId: selectedGodown?.id,
                    );

                    this.setState(() {
                      _lines.add(line);
                    });

                    Navigator.of(context).pop();
                  },
                  child: const Text('Add'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _submitInvoice() async {
    if (!_formKey.currentState!.validate()) return;
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add at least one line item to the invoice.'),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final features = ref.read(featuresProvider) ?? {};
    final hasPartialPay = features['partialPay'] ?? false;
    final grandTotalVal = _grandTotal;

    // Validate Payments
    if (!hasPartialPay && _initialPayment > 0 && _initialPayment != grandTotalVal) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Partial payments are locked. You must pay full grand total: ${MoneyUtils.format(grandTotalVal)}'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_initialPayment > grandTotalVal) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Payment amount cannot exceed grand total: ${MoneyUtils.format(grandTotalVal)}'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Require due date if balance is outstanding
    if (grandTotalVal - _initialPayment > 0 && _dueDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Outstanding balance requires setting a Due Date.'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    // Build JSON payload
    final data = {
      if (_selectedParty != null) 'partyId': _selectedParty!.id,
      'partyName': _partyNameController.text.trim(),
      'partyPhone': _partyPhoneController.text.trim().isEmpty ? null : _partyPhoneController.text.trim(),
      'partyAddress': _partyAddressController.text.trim().isEmpty ? null : _partyAddressController.text.trim(),
      'partyGstin': _partyGstinController.text.trim().isEmpty ? null : _partyGstinController.text.trim().toUpperCase(),
      'partyStateCode': _partyStateCodeController.text.trim().isEmpty ? null : _partyStateCodeController.text.trim(),
      'partyExternalId': _partyExternalIdController.text.trim().isEmpty ? null : _partyExternalIdController.text.trim(),
      'placeOfSupply': _placeOfSupplyController.text.trim().isEmpty ? null : _placeOfSupplyController.text.trim(),
      'supplyType': _supplyType,
      'reverseCharge': _reverseCharge,
      'invoiceDate': _invoiceDate.toIso8601String().substring(0, 10),
      if (_dueDate != null) 'dueDate': _dueDate!.toIso8601String().substring(0, 10),
      'notes': _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      'discountAmount': double.tryParse(_discountAmountController.text.trim()) ?? 0.0,
      'lines': _lines.map((l) => l.toJson()).toList(),
      if (_initialPayment > 0)
        'payments': [
          {
            'mode': _paymentMode,
            'amount': _initialPayment,
            if (_paymentMode == 'UPI') 'upiRefId': _upiRefController.text.trim().isEmpty ? null : _upiRefController.text.trim(),
            if (_paymentMode == 'CARD') 'cardLast4': _cardLast4Controller.text.trim().isEmpty ? null : _cardLast4Controller.text.trim(),
            'notes': _paymentNotesController.text.trim().isEmpty ? null : _paymentNotesController.text.trim(),
          }
        ],
      'finalize': _finalize,
    };

    final invoice = await ref.read(invoicesNotifierProvider.notifier).create(data);

    if (mounted) {
      if (invoice != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Invoice raised successfully!'),
            backgroundColor: Colors.green,
            behavior: SnackBarBehavior.floating,
          ),
        );
        context.go('/invoices/${invoice.id}');
      } else {
        final err = ref.read(invoicesNotifierProvider).error?.toString() ?? 'Failed to raise invoice';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(err),
            backgroundColor: Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final partiesState = ref.watch(partiesProvider);
    final features = ref.watch(featuresProvider) ?? {};
    final hasPartialPay = features['partialPay'] ?? false;
    final profileConfig = ref.watch(profileConfigProvider);
    final partyLabel = profileConfig?.partyLabel ?? 'Party';

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Invoice / Bill'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // --- SECTION 1: Customer Details ---
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '$partyLabel Details',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      // Party Selection Dropdown / Search list
                      partiesState.when(
                        data: (parties) {
                          return DropdownButtonFormField<Party>(
                            isExpanded: true,
                            value: _selectedParty,
                            decoration: InputDecoration(
                              labelText: 'Choose Stored $partyLabel (Optional)',
                              prefixIcon: const Icon(Icons.people_outline),
                            ),
                            items: [
                              UiHelpers.menuItem<Party>(
                                value: null,
                                label: 'Create Custom / Free text customer',
                              ),
                              ...parties.map((p) {
                                return UiHelpers.menuItem<Party>(
                                  value: p,
                                  label: '${p.name} ${p.phone != null ? "(${p.phone})" : ""}',
                                );
                              })
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                _selectParty(val);
                              } else {
                                setState(() {
                                  _selectedParty = null;
                                  _partyNameController.clear();
                                  _partyPhoneController.clear();
                                  _partyGstinController.clear();
                                  _partyAddressController.clear();
                                  _partyStateCodeController.clear();
                                  _partyExternalIdController.clear();
                                });
                              }
                            },
                          );
                        },
                        loading: () => const CircularProgressIndicator(),
                        error: (e, s) => Text('Error loading $partyLabel: $e'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _partyNameController,
                        decoration: InputDecoration(
                          labelText: '$partyLabel Name *',
                          prefixIcon: const Icon(Icons.person_outline),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _partyPhoneController,
                              decoration: const InputDecoration(
                                labelText: 'Phone',
                                prefixIcon: Icon(Icons.phone_outlined),
                              ),
                              keyboardType: TextInputType.phone,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _partyGstinController,
                              decoration: const InputDecoration(
                                labelText: 'GSTIN',
                                prefixIcon: Icon(Icons.percent),
                              ),
                              textCapitalization: TextCapitalization.characters,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _partyAddressController,
                        decoration: const InputDecoration(
                          labelText: 'Billing Address',
                          prefixIcon: Icon(Icons.location_on_outlined),
                        ),
                        maxLines: 2,
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // --- SECTION 2: Line Items Editor ---
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
                            'Line Items',
                            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                          ),
                          TextButton.icon(
                            onPressed: _showAddLineDialog,
                            icon: const Icon(Icons.add),
                            label: const Text('Add Line'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_lines.isEmpty)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24.0),
                          child: Center(
                            child: Text(
                              'No line items added yet.',
                              style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
                            ),
                          ),
                        )
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _lines.length,
                          itemBuilder: (context, index) {
                            final line = _lines[index];
                            final subtotal = line.qty * line.rate * (1 - line.discount / 100);
                            return ListTile(
                              title: Text(line.description),
                              subtitle: Text(
                                '${line.qty} ${line.unit ?? "NOS"} x ${MoneyUtils.format(line.rate)} '
                                '${line.discount > 0 ? "(-${line.discount}%)" : ""} '
                                '(GST ${line.gstRate}%)',
                              ),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(MoneyUtils.format(subtotal), style: const TextStyle(fontWeight: FontWeight.bold)),
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                                    onPressed: () {
                                      setState(() {
                                        _lines.removeAt(index);
                                      });
                                    },
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // --- SECTION 3: Initial Payment Details ---
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Payment Details',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        decoration: InputDecoration(
                          labelText: 'Initial Payment Collected (₹)',
                          prefixIcon: const Icon(Icons.currency_rupee),
                          suffix: hasPartialPay
                              ? null
                              : Text(
                                  'Requires full amount',
                                  style: TextStyle(color: Colors.grey.shade500, fontSize: 11),
                                ),
                        ),
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        onChanged: (val) {
                          setState(() {
                            _initialPayment = double.tryParse(val.trim()) ?? 0.0;
                          });
                        },
                      ),
                      if (_initialPayment > 0) ...[
                        const SizedBox(height: 12),
                        DropdownButtonFormField<String>(
                          isExpanded: true,
                          value: _paymentMode,
                          decoration: const InputDecoration(labelText: 'Payment Mode'),
                          items: [
                            UiHelpers.menuItem(value: 'CASH', label: 'Cash'),
                            UiHelpers.menuItem(value: 'UPI', label: 'UPI (Google Pay / PhonePe)'),
                            UiHelpers.menuItem(value: 'CARD', label: 'Credit / Debit Card'),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _paymentMode = val;
                              });
                            }
                          },
                        ),
                        if (_paymentMode == 'UPI') ...[
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _upiRefController,
                            decoration: const InputDecoration(
                              labelText: 'UPI Reference ID *',
                              prefixIcon: Icon(Icons.tag),
                            ),
                            validator: (v) =>
                                (v == null || v.trim().isEmpty) ? 'Reference ID is required for UPI' : null,
                          ),
                        ],
                        if (_paymentMode == 'CARD') ...[
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: _cardLast4Controller,
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
                      ],
                      if (_grandTotal - _initialPayment > 0) ...[
                        const SizedBox(height: 16),
                        ListTile(
                          title: const Text('Invoice Due Date *'),
                          subtitle: Text(
                            _dueDate == null
                                ? 'Tap to select due date'
                                : _dueDate!.toIso8601String().substring(0, 10),
                          ),
                          leading: const Icon(Icons.calendar_month),
                          trailing: const Icon(Icons.edit_outlined),
                          onTap: () async {
                            final chosen = await showDatePicker(
                              context: context,
                              initialDate: DateTime.now().add(const Duration(days: 7)),
                              firstDate: DateTime.now(),
                              lastDate: DateTime.now().add(const Duration(days: 365)),
                            );
                            if (chosen != null) {
                              setState(() {
                                _dueDate = chosen;
                              });
                            }
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // --- SECTION 4: Review Totals & Submit ---
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Invoice Summary',
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 12),
                      _buildSummaryRow('Subtotal (Taxable Value):', MoneyUtils.format(_totalAmount)),
                      _buildSummaryRow('Tax Amount (GST):', MoneyUtils.format(_taxAmount)),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Discount Amount (₹):'),
                          SizedBox(
                            width: 100,
                            child: TextFormField(
                              controller: _discountAmountController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              textAlign: TextAlign.end,
                              decoration: const InputDecoration(
                                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              ),
                              onChanged: (val) {
                                setState(() {}); // Trigger rebuild to update grand total
                              },
                            ),
                          ),
                        ],
                      ),
                      const Divider(height: 24),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Grand Total:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            MoneyUtils.format(_grandTotal),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      if (_grandTotal - _initialPayment > 0) ...[
                        const SizedBox(height: 6),
                        _buildSummaryRow(
                          'Outstanding Balance Due:',
                          MoneyUtils.format(_grandTotal - _initialPayment),
                          color: Colors.redAccent,
                        ),
                      ],
                      const Divider(height: 24),
                      // Save option switch
                      SwitchListTile(
                        title: const Text('Finalize immediately'),
                        subtitle: const Text('Draft invoices do not deduct stock.'),
                        value: _finalize,
                        onChanged: (val) {
                          setState(() {
                            _finalize = val;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _submitInvoice,
                        child: Text(_finalize ? 'Finalize & Raise Bill' : 'Save Draft Invoice'),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummaryRow(String label, String value, {Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: color)),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(fontWeight: FontWeight.w600, color: color),
            ),
          ),
        ],
      ),
    );
  }
}
