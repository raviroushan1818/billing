import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../domain/providers/ops_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../../data/models/ops_models.dart';
import '../../../core/utils/money_utils.dart';

class NewPurchaseScreen extends ConsumerStatefulWidget {
  const NewPurchaseScreen({super.key});

  @override
  ConsumerState<NewPurchaseScreen> createState() => _NewPurchaseScreenState();
}

class _NewPurchaseScreenState extends ConsumerState<NewPurchaseScreen> {
  final _formKey = GlobalKey<FormState>();

  // Vendor parameters
  Party? _selectedVendor;
  final _vendorNameController = TextEditingController();
  final _vendorGstinController = TextEditingController();
  final _vendorPhoneController = TextEditingController();
  final _billNoController = TextEditingController();
  final _notesController = TextEditingController();

  // Settings
  Godown? _selectedGodown;
  DateTime _billDate = DateTime.now();
  bool _interstate = false;

  // Lines
  final List<PurchaseLine> _lines = [];

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
    _vendorNameController.dispose();
    _vendorGstinController.dispose();
    _vendorPhoneController.dispose();
    _billNoController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  double get _totalAmount {
    return _lines.fold(0.0, (sum, line) => sum + (line.qty * line.rate));
  }

  double get _taxAmount {
    return _lines.fold(0.0, (sum, line) => sum + (line.qty * line.rate * (line.gstRate / 100)));
  }

  double get _grandTotal => _totalAmount + _taxAmount;

  void _selectVendor(Party party) {
    setState(() {
      _selectedVendor = party;
      _vendorNameController.text = party.name;
      _vendorGstinController.text = party.gstin ?? '';
      _vendorPhoneController.text = party.phone ?? '';
      if (party.gstin != null && party.gstin!.isNotEmpty) {
        _interstate = !party.gstin!.startsWith('29'); // Karnataka prefix check
      }
    });
  }

  void _showAddLineDialog() {
    final itemsState = ref.read(itemsProvider);
    List<Item> items = [];
    itemsState.whenData((list) => items = list);

    Item? selectedItem;
    final descController = TextEditingController();
    final hsnController = TextEditingController();
    final unitController = TextEditingController(text: 'NOS');
    final qtyController = TextEditingController(text: '1');
    final rateController = TextEditingController();
    final gstController = TextEditingController(text: '18');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Add Purchase Line'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      DropdownButtonFormField<Item>(
                        decoration: const InputDecoration(labelText: 'Catalog Item'),
                        items: items.map((i) {
                          return DropdownMenuItem(value: i, child: Text(i.name));
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
                        decoration: const InputDecoration(labelText: 'Description *'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Description is required' : null,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: qtyController,
                              decoration: const InputDecoration(labelText: 'Quantity *'),
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              validator: (v) {
                                if (v == null || v.trim().isEmpty) return 'Required';
                                final parsed = double.tryParse(v.trim());
                                if (parsed == null || parsed <= 0) return 'Must be > 0';
                                return null;
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: rateController,
                              decoration: const InputDecoration(labelText: 'Purchase Rate *'),
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
                              controller: gstController,
                              decoration: const InputDecoration(labelText: 'GST (%)'),
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: unitController,
                              decoration: const InputDecoration(labelText: 'Unit'),
                            ),
                          ),
                        ],
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
                  onPressed: () {
                    if (!_formKey.currentState!.validate()) return;

                    final line = PurchaseLine(
                      itemId: selectedItem?.id,
                      description: descController.text.trim(),
                      hsnSac: hsnController.text.trim().isEmpty ? null : hsnController.text.trim(),
                      unit: unitController.text.trim().isEmpty ? null : unitController.text.trim(),
                      qty: double.parse(qtyController.text.trim()),
                      rate: double.parse(rateController.text.trim()),
                      gstRate: double.tryParse(gstController.text.trim()) ?? 18.0,
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

  void _submitPurchase() async {
    if (!_formKey.currentState!.validate()) return;
    if (_lines.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please add at least one line item.'),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    final data = {
      if (_selectedVendor != null) 'vendorId': _selectedVendor!.id,
      'vendorName': _vendorNameController.text.trim(),
      'vendorGstin': _vendorGstinController.text.trim().isEmpty ? null : _vendorGstinController.text.trim().toUpperCase(),
      'vendorPhone': _vendorPhoneController.text.trim().isEmpty ? null : _vendorPhoneController.text.trim(),
      'billNo': _billNoController.text.trim(),
      if (_selectedGodown != null) 'godownId': _selectedGodown!.id,
      'billDate': _billDate.toIso8601String().substring(0, 10),
      'notes': _notesController.text.trim().isEmpty ? null : _notesController.text.trim(),
      'interstate': _interstate,
      'lines': _lines.map((l) => l.toJson()).toList(),
    };

    final success = await ref.read(purchasesProvider.notifier).create(data);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? 'Purchase record created successfully!' : 'Failed to save purchase'),
          backgroundColor: success ? Colors.green : Colors.red,
          behavior: SnackBarBehavior.floating,
        ),
      );
      if (success) {
        context.pop();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final partiesState = ref.watch(partiesProvider);
    final godownsState = ref.watch(godownsProvider);
    final features = ref.watch(featuresProvider) ?? {};
    final hasStock = features['stock'] ?? false;

    return Scaffold(
      appBar: AppBar(
        title: const Text('New Purchase Bill'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            children: [
              // Vendor details card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Vendor Information', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      partiesState.when(
                        data: (parties) {
                          return DropdownButtonFormField<Party>(
                            value: _selectedVendor,
                            decoration: const InputDecoration(labelText: 'Select Vendor (Optional)'),
                            items: [
                              const DropdownMenuItem(value: null, child: Text('Custom/Free text vendor')),
                              ...parties.map((p) => DropdownMenuItem(value: p, child: Text(p.name))),
                            ],
                            onChanged: (val) {
                              if (val != null) {
                                _selectVendor(val);
                              } else {
                                setState(() {
                                  _selectedVendor = null;
                                  _vendorNameController.clear();
                                  _vendorGstinController.clear();
                                  _vendorPhoneController.clear();
                                });
                              }
                            },
                          );
                        },
                        loading: () => const CircularProgressIndicator(),
                        error: (e, s) => Text('Error: $e'),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _vendorNameController,
                        decoration: const InputDecoration(labelText: 'Vendor Name *'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Vendor name is required' : null,
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _vendorPhoneController,
                              decoration: const InputDecoration(labelText: 'Phone'),
                              keyboardType: TextInputType.phone,
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _vendorGstinController,
                              decoration: const InputDecoration(labelText: 'GSTIN'),
                              textCapitalization: TextCapitalization.characters,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Purchase metadata card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Bill Settings', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: _billNoController,
                        decoration: const InputDecoration(labelText: 'Vendor Bill Number *'),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Bill Number is required' : null,
                      ),
                      const SizedBox(height: 12),
                      ListTile(
                        title: const Text('Bill Date'),
                        subtitle: Text(_billDate.toIso8601String().substring(0, 10)),
                        trailing: const Icon(Icons.calendar_today),
                        onTap: () async {
                          final chosen = await showDatePicker(
                            context: context,
                            initialDate: _billDate,
                            firstDate: DateTime.now().subtract(const Duration(days: 365)),
                            lastDate: DateTime.now(),
                          );
                          if (chosen != null) {
                            setState(() {
                              _billDate = chosen;
                            });
                          }
                        },
                      ),
                      SwitchListTile(
                        title: const Text('Interstate Purchase'),
                        subtitle: const Text('Apply IGST instead of CGST/SGST'),
                        value: _interstate,
                        onChanged: (val) {
                          setState(() {
                            _interstate = val;
                          });
                        },
                      ),
                      if (hasStock) ...[
                        const SizedBox(height: 12),
                        godownsState.when(
                          data: (godowns) {
                            return DropdownButtonFormField<Godown>(
                              value: _selectedGodown,
                              decoration: const InputDecoration(labelText: 'Receipt Godown'),
                              items: godowns.map((g) => DropdownMenuItem(value: g, child: Text(g.name))).toList(),
                              onChanged: (val) {
                                setState(() {
                                  _selectedGodown = val;
                                });
                              },
                            );
                          },
                          loading: () => const CircularProgressIndicator(),
                          error: (e, s) => Text('Error: $e'),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 16),

              // Item lines card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Purchase Items', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          TextButton.icon(
                            onPressed: _showAddLineDialog,
                            icon: const Icon(Icons.add),
                            label: const Text('Add Item'),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      if (_lines.isEmpty)
                        const Center(child: Text('No purchase lines added.', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic)))
                      else
                        ListView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          itemCount: _lines.length,
                          itemBuilder: (context, index) {
                            final line = _lines[index];
                            final total = line.qty * line.rate * (1 + line.gstRate / 100);
                            return ListTile(
                              title: Text(line.description),
                              subtitle: Text('${line.qty} x ${MoneyUtils.format(line.rate)} (GST ${line.gstRate}%)'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Text(MoneyUtils.format(total), style: const TextStyle(fontWeight: FontWeight.bold)),
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

              // Financial summary card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('Total Calculations', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      const SizedBox(height: 12),
                      _buildSummaryRow('Taxable Amount:', MoneyUtils.format(_totalAmount)),
                      _buildSummaryRow('GST Tax Amount:', MoneyUtils.format(_taxAmount)),
                      const Divider(height: 24),
                      _buildSummaryRow('Grand Total:', MoneyUtils.format(_grandTotal), isBold: true, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _submitPurchase,
                        child: const Text('Record Purchase Bill'),
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

  Widget _buildSummaryRow(String label, String value, {bool isBold = false, Color? color}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontWeight: isBold ? FontWeight.bold : null, color: color)),
          Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: color)),
        ],
      ),
    );
  }
}
