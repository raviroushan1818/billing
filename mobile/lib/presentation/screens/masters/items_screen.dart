import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../../core/utils/money_utils.dart';

class ItemsScreen extends ConsumerStatefulWidget {
  const ItemsScreen({super.key});

  @override
  ConsumerState<ItemsScreen> createState() => _ItemsScreenState();
}

class _ItemsScreenState extends ConsumerState<ItemsScreen> {
  final _searchController = TextEditingController();
  final _formKey = GlobalKey<FormState>();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String value) {
    ref.read(itemsProvider.notifier).searchItems(value);
  }

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR';
  }

  void _showAddEditDialog([Item? item]) {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final nameController = TextEditingController(text: item?.name ?? '');
    final descriptionController = TextEditingController(text: item?.description ?? '');
    final hsnSacController = TextEditingController(text: item?.hsnSac ?? '');
    final unitController = TextEditingController(text: item?.unit ?? 'NOS');
    final rateController = TextEditingController(text: item != null ? item.rate.toString() : '');
    final gstController = TextEditingController(text: item != null ? item.gstRate.toString() : '18');
    final barcodeController = TextEditingController(text: item?.barcode ?? '');
    bool trackStock = item?.trackStock ?? false;
    final initialStockController = TextEditingController(text: '0');

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(item == null ? 'Add New Item' : 'Edit Item'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          controller: nameController,
                          decoration: const InputDecoration(
                            labelText: 'Name *',
                            prefixIcon: Icon(Icons.shopping_bag_outlined),
                          ),
                          validator: (v) => (v == null || v.trim().isEmpty) ? 'Item name is required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: rateController,
                          decoration: const InputDecoration(
                            labelText: 'Rate (₹) *',
                            prefixIcon: Icon(Icons.currency_rupee),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) return 'Rate is required';
                            if (double.tryParse(v.trim()) == null) return 'Enter a valid rate';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: gstController,
                          decoration: const InputDecoration(
                            labelText: 'GST Rate (%)',
                            prefixIcon: Icon(Icons.percent),
                          ),
                          keyboardType: TextInputType.number,
                          validator: (v) {
                            if (v != null && v.trim().isNotEmpty && double.tryParse(v.trim()) == null) {
                              return 'Enter a valid percentage';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: unitController,
                          decoration: const InputDecoration(
                            labelText: 'Unit (e.g., NOS, KGS)',
                            prefixIcon: Icon(Icons.scale_outlined),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: hsnSacController,
                          decoration: const InputDecoration(
                            labelText: 'HSN/SAC Code',
                            prefixIcon: Icon(Icons.tag),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: barcodeController,
                          decoration: const InputDecoration(
                            labelText: 'Barcode',
                            prefixIcon: Icon(Icons.qr_code_scanner),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: descriptionController,
                          decoration: const InputDecoration(
                            labelText: 'Description',
                            prefixIcon: Icon(Icons.description_outlined),
                          ),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 12),
                        // Track Stock switch
                        CheckboxListTile(
                          title: const Text('Track Stock'),
                          value: trackStock,
                          contentPadding: EdgeInsets.zero,
                          onChanged: (val) {
                            setState(() {
                              trackStock = val ?? false;
                            });
                          },
                        ),
                        if (trackStock && item == null) ...[
                          const SizedBox(height: 12),
                          TextFormField(
                            controller: initialStockController,
                            decoration: const InputDecoration(
                              labelText: 'Initial Stock Qty',
                              prefixIcon: Icon(Icons.warehouse),
                            ),
                            keyboardType: TextInputType.number,
                            validator: (v) {
                              if (v != null && v.trim().isNotEmpty && double.tryParse(v.trim()) == null) {
                                  return 'Enter a valid stock number';
                              }
                              return null;
                            },
                          ),
                        ]
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

                    final rateVal = double.tryParse(rateController.text.trim()) ?? 0.0;
                    final gstVal = double.tryParse(gstController.text.trim()) ?? 18.0;
                    final stockVal = double.tryParse(initialStockController.text.trim()) ?? 0.0;

                    final data = {
                      'name': nameController.text.trim(),
                      'description': descriptionController.text.trim().isEmpty ? null : descriptionController.text.trim(),
                      'hsnSac': hsnSacController.text.trim().isEmpty ? null : hsnSacController.text.trim(),
                      'unit': unitController.text.trim().isEmpty ? null : unitController.text.trim(),
                      'rate': rateVal,
                      'gstRate': gstVal,
                      'barcode': barcodeController.text.trim().isEmpty ? null : barcodeController.text.trim(),
                      'trackStock': trackStock,
                      if (item == null && trackStock) 'stockQty': stockVal,
                    };

                    bool success;
                    if (item == null) {
                      success = await ref.read(itemsProvider.notifier).create(data);
                    } else {
                      success = await ref.read(itemsProvider.notifier).update(item.id, data);
                    }

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success
                              ? '${item == null ? "Created" : "Updated"} item successfully!'
                              : 'Failed to save item'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showAdjustStockDialog(Item item) {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final features = ref.read(featuresProvider) ?? {};
    final hasStockFeature = features['stock'] ?? false;

    final qtyController = TextEditingController();
    final noteController = TextEditingController();

    if (hasStockFeature) {
      // Fetch godowns list in background
      ref.read(godownsProvider.notifier).loadGodowns();
    }

    Godown? selectedGodown;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            final godownsState = ref.watch(godownsProvider);

            return AlertDialog(
              title: Text('Adjust Stock: ${item.name}'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text('Current Stock: ${item.stockQty} ${item.unit ?? "NOS"}',
                          style: const TextStyle(fontWeight: FontWeight.bold)),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: qtyController,
                        decoration: const InputDecoration(
                          labelText: 'Qty Change (e.g. 5, -3)',
                          prefixIcon: Icon(Icons.swap_vert),
                          helperText: 'Positive to add, negative to subtract',
                        ),
                        keyboardType: const TextInputType.numberWithOptions(signed: true, decimal: true),
                        validator: (v) {
                          if (v == null || v.trim().isEmpty) return 'Qty is required';
                          if (double.tryParse(v.trim()) == null) return 'Enter a valid number';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: noteController,
                        decoration: const InputDecoration(
                          labelText: 'Reason/Note',
                          prefixIcon: Icon(Icons.notes),
                        ),
                      ),
                      if (hasStockFeature) ...[
                        const SizedBox(height: 16),
                        godownsState.when(
                          data: (godowns) {
                            if (godowns.isEmpty) {
                              return const Text('No godowns available. Will adjust globally.');
                            }
                            return DropdownButtonFormField<Godown>(
                              value: selectedGodown,
                              decoration: const InputDecoration(
                                labelText: 'Select Godown (Optional)',
                                prefixIcon: Icon(Icons.warehouse),
                              ),
                              items: godowns.map((g) {
                                return DropdownMenuItem(
                                  value: g,
                                  child: Text('${g.name} ${g.isDefault ? "(Default)" : ""}'),
                                );
                              }).toList(),
                              onChanged: (val) {
                                setState(() {
                                  selectedGodown = val;
                                });
                              },
                            );
                          },
                          loading: () => const CircularProgressIndicator(),
                          error: (e, s) => Text('Error loading godowns: $e'),
                        ),
                      ],
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
                    final qtyDelta = double.tryParse(qtyController.text.trim()) ?? 0.0;
                    final note = noteController.text.trim().isEmpty ? null : noteController.text.trim();

                    bool success;
                    if (hasStockFeature && selectedGodown != null) {
                      // Adjust at specific godown
                      success = await ref.read(stockProvider.notifier).adjustGodownStock(
                            itemId: item.id,
                            godownId: selectedGodown!.id,
                            qtyDelta: qtyDelta,
                            note: note,
                          );
                      // Reload items to get fresh stock
                      ref.read(itemsProvider.notifier).loadItems();
                    } else {
                      // Adjust globally
                      success = await ref.read(itemsProvider.notifier).adjustStock(item.id, qtyDelta, note);
                    }

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Stock adjusted successfully!' : 'Failed to adjust stock'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                  child: const Text('Adjust'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _deleteConfirm(Item item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Item'),
        content: Text('Are you sure you want to delete ${item.name}? This action cannot be undone.'),
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
      final success = await ref.read(itemsProvider.notifier).delete(item.id);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(success ? 'Item deleted successfully' : 'Failed to delete item'),
            backgroundColor: success ? Colors.green : Colors.red,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final itemsState = ref.watch(itemsProvider);
    final user = ref.watch(authProvider).user;
    final features = ref.watch(featuresProvider) ?? {};
    final hasStockFeature = features['stock'] ?? false;

    final hasWrite = _hasWriteAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Items Catalog'),
      ),
      body: Column(
        children: [
          // Search Box
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: TextField(
              controller: _searchController,
              onChanged: _onSearch,
              decoration: InputDecoration(
                hintText: 'Search items...',
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
          ),
          Expanded(
            child: itemsState.when(
              data: (items) {
                if (items.isEmpty) {
                  return Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_bag_outlined, size: 64, color: Colors.grey.shade400),
                        const SizedBox(height: 16),
                        Text(
                          'No items found',
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
                        ),
                      ],
                    ),
                  );
                }
                return RefreshIndicator(
                  onRefresh: () => ref.read(itemsProvider.notifier).loadItems(),
                  child: ListView.builder(
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      return Card(
                        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        child: ListTile(
                          title: Text(item.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Rate: ${MoneyUtils.format(item.rate)} / ${item.unit ?? "NOS"} (GST ${item.gstRate}%)'),
                              if (item.trackStock)
                                Text(
                                  'In Stock: ${item.stockQty} ${item.unit ?? "NOS"}',
                                  style: TextStyle(
                                    fontWeight: FontWeight.w600,
                                    color: item.stockQty > 0 ? Colors.green : Colors.red,
                                  ),
                                ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              if (hasWrite && item.trackStock)
                                IconButton(
                                  icon: const Icon(Icons.add_business_outlined, color: Colors.blueAccent),
                                  tooltip: 'Adjust Stock',
                                  onPressed: () => _showAdjustStockDialog(item),
                                ),
                              if (hasWrite) ...[
                                IconButton(
                                  icon: const Icon(Icons.edit_outlined, color: Colors.teal),
                                  onPressed: () => _showAddEditDialog(item),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
                                  onPressed: () => _deleteConfirm(item),
                                ),
                              ]
                            ],
                          ),
                        ),
                      );
                    },
                  ),
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
              onPressed: () => _showAddEditDialog(),
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
