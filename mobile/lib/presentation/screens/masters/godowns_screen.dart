import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../widgets/ui_helpers.dart';

class GodownsScreen extends ConsumerStatefulWidget {
  const GodownsScreen({super.key});

  @override
  ConsumerState<GodownsScreen> createState() => _GodownsScreenState();
}

class _GodownsScreenState extends ConsumerState<GodownsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _formKey = GlobalKey<FormState>();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Fetch initial godowns & stocks
    Future.microtask(() {
      ref.read(godownsProvider.notifier).loadGodowns();
      ref.read(stockProvider.notifier).loadStock();
      ref.read(itemsProvider.notifier).loadItems();
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  bool _hasWriteAccess(String? role) {
    return role == 'CLIENT_ADMIN' || role == 'BILLING_OPERATOR';
  }

  void _showAddEditGodownDialog([Godown? godown]) {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final nameController = TextEditingController(text: godown?.name ?? '');
    final codeController = TextEditingController(text: godown?.code ?? '');
    final addressController = TextEditingController(text: godown?.address ?? '');
    bool isDefault = godown?.isDefault ?? false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: Text(godown == null ? 'Add New Godown' : 'Edit Godown'),
              content: SingleChildScrollView(
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      TextFormField(
                        controller: nameController,
                        decoration: const InputDecoration(
                          labelText: 'Godown Name *',
                          prefixIcon: Icon(Icons.warehouse_outlined),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Name is required' : null,
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: codeController,
                        decoration: const InputDecoration(
                          labelText: 'Godown Code (Optional)',
                          prefixIcon: Icon(Icons.tag),
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextFormField(
                        controller: addressController,
                        decoration: const InputDecoration(
                          labelText: 'Address',
                          prefixIcon: Icon(Icons.location_on_outlined),
                        ),
                        maxLines: 2,
                      ),
                      const SizedBox(height: 12),
                      CheckboxListTile(
                        title: const Text('Set as Default'),
                        value: isDefault,
                        contentPadding: EdgeInsets.zero,
                        onChanged: (val) {
                          setState(() {
                            isDefault = val ?? false;
                          });
                        },
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

                    final data = {
                      'name': nameController.text.trim(),
                      'code': codeController.text.trim().isEmpty ? null : codeController.text.trim(),
                      'address': addressController.text.trim().isEmpty ? null : addressController.text.trim(),
                      'isDefault': isDefault,
                    };

                    bool success;
                    if (godown == null) {
                      success = await ref.read(godownsProvider.notifier).create(data);
                    } else {
                      success = await ref.read(godownsProvider.notifier).update(godown.id, data);
                    }

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Saved godown successfully' : 'Failed to save godown'),
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

  void _showTransferStockDialog() {
    final user = ref.read(authProvider).user;
    if (!_hasWriteAccess(user?.role)) return;

    final godownsState = ref.read(godownsProvider);
    final itemsState = ref.read(itemsProvider);

    List<Godown> godowns = [];
    List<Item> items = [];

    godownsState.whenData((list) => godowns = list);
    itemsState.whenData((list) => items = list.where((i) => i.trackStock).toList());

    if (godowns.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('At least 2 godowns are required to perform a stock transfer.'),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (items.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('No stock-tracked items available to transfer.'),
          backgroundColor: Colors.orange,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    Item? selectedItem;
    Godown? fromGodown;
    Godown? toGodown;
    final qtyController = TextEditingController();
    final noteController = TextEditingController();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setState) {
            return AlertDialog(
              title: const Text('Stock Transfer'),
              content: SizedBox(
                width: MediaQuery.sizeOf(context).width * 0.9,
                child: SingleChildScrollView(
                  child: Form(
                    key: _formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Item selection
                        DropdownButtonFormField<Item>(
                          isExpanded: true,
                          value: selectedItem,
                          decoration: const InputDecoration(
                            labelText: 'Select Item *',
                            prefixIcon: Icon(Icons.shopping_bag_outlined),
                          ),
                          items: items.map((i) {
                            return UiHelpers.menuItem<Item>(
                              value: i,
                              label: '${i.name} (In stock: ${i.stockQty})',
                            );
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              selectedItem = val;
                            });
                          },
                          validator: (v) => v == null ? 'Item is required' : null,
                        ),
                        const SizedBox(height: 12),

                        // From Godown selection
                        DropdownButtonFormField<Godown>(
                          isExpanded: true,
                          value: fromGodown,
                          decoration: const InputDecoration(
                            labelText: 'Source Godown *',
                            prefixIcon: Icon(Icons.warehouse_outlined),
                          ),
                          items: godowns.map((g) {
                            return UiHelpers.menuItem<Godown>(value: g, label: g.name);
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              fromGodown = val;
                            });
                          },
                          validator: (v) {
                            if (v == null) return 'Source is required';
                            if (v == toGodown) return 'Source and target must be different';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        // To Godown selection
                        DropdownButtonFormField<Godown>(
                          isExpanded: true,
                          value: toGodown,
                          decoration: const InputDecoration(
                            labelText: 'Target Godown *',
                            prefixIcon: Icon(Icons.warehouse_outlined),
                          ),
                          items: godowns.map((g) {
                            return UiHelpers.menuItem<Godown>(value: g, label: g.name);
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              toGodown = val;
                            });
                          },
                          validator: (v) {
                            if (v == null) return 'Target is required';
                            if (v == fromGodown) return 'Source and target must be different';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        // Qty Input
                        TextFormField(
                          controller: qtyController,
                          decoration: const InputDecoration(
                            labelText: 'Quantity to Transfer *',
                            prefixIcon: Icon(Icons.swap_horiz),
                          ),
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          validator: (v) {
                            if (v == null || v.trim().isEmpty) return 'Qty is required';
                            final parsed = double.tryParse(v.trim());
                            if (parsed == null || parsed <= 0) return 'Enter a quantity greater than 0';
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        // Note Input
                        TextFormField(
                          controller: noteController,
                          decoration: const InputDecoration(
                            labelText: 'Note',
                            prefixIcon: Icon(Icons.notes),
                          ),
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

                    final qty = double.tryParse(qtyController.text.trim()) ?? 0.0;
                    final note = noteController.text.trim().isEmpty ? null : noteController.text.trim();

                    final success = await ref.read(stockProvider.notifier).transferStock(
                          itemId: selectedItem!.id,
                          fromGodownId: fromGodown!.id,
                          toGodownId: toGodown!.id,
                          qty: qty,
                          note: note,
                        );

                    if (success) {
                      // Reload stock level & item quantities
                      ref.read(itemsProvider.notifier).loadItems();
                    }

                    if (mounted) {
                      Navigator.of(context).pop();
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(success ? 'Stock transferred successfully!' : 'Failed to transfer stock'),
                          backgroundColor: success ? Colors.green : Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ),
                      );
                    }
                  },
                  child: const Text('Transfer'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final godownsState = ref.watch(godownsProvider);
    final stockState = ref.watch(stockProvider);

    final hasWrite = _hasWriteAccess(user?.role);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory & Godowns'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Godowns', icon: Icon(Icons.warehouse)),
            Tab(text: 'Stock Levels', icon: Icon(Icons.inventory_2)),
            Tab(text: 'Transfers', icon: Icon(Icons.swap_horiz)),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // --- Tab 1: Godowns List ---
          godownsState.when(
            data: (godowns) {
              if (godowns.isEmpty) {
                return Center(
                  child: Text('No godown locations registered.', style: TextStyle(color: Colors.grey.shade600)),
                );
              }
              return ListView.builder(
                itemCount: godowns.length,
                itemBuilder: (context, index) {
                  final godown = godowns[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: ListTile(
                      title: Text(godown.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (godown.code != null && godown.code!.isNotEmpty)
                            Text('Code: ${godown.code}'),
                          if (godown.address != null && godown.address!.isNotEmpty)
                            Text('Address: ${godown.address}'),
                          if (godown.isDefault)
                            const Text('Default Godown', style: TextStyle(color: Colors.teal, fontWeight: FontWeight.bold)),
                        ],
                      ),
                      trailing: hasWrite
                          ? IconButton(
                              icon: const Icon(Icons.edit_outlined, color: Colors.teal),
                              onPressed: () => _showAddEditGodownDialog(godown),
                            )
                          : null,
                    ),
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) => Center(child: Text('Error loading godowns: $e')),
          ),

          // --- Tab 2: Stock Levels ---
          stockState.when(
            data: (stocks) {
              if (stocks.isEmpty) {
                return Center(
                  child: Text('No stock levels recorded.', style: TextStyle(color: Colors.grey.shade600)),
                );
              }
              return ListView.builder(
                itemCount: stocks.length,
                itemBuilder: (context, index) {
                  final stock = stocks[index];
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    child: ListTile(
                      title: Text(stock.item?.name ?? 'Item ${stock.itemId}'),
                      subtitle: Text('Godown: ${stock.godown?.name ?? "Default"}'),
                      trailing: Text(
                        '${stock.qty} ${stock.item?.unit ?? "NOS"}',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: stock.qty > 0 ? Colors.green : Colors.red,
                        ),
                      ),
                    ),
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) => Center(child: Text('Error loading stock levels: $e')),
          ),

          // --- Tab 3: Transfer stock trigger UI ---
          Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.swap_horiz, size: 80, color: Theme.of(context).colorScheme.primary.withOpacity(0.5)),
                const SizedBox(height: 16),
                const Text(
                  'Move stock inventory items between Godowns',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: hasWrite ? _showTransferStockDialog : null,
                  icon: const Icon(Icons.compare_arrows),
                  label: const Text('Start Stock Transfer'),
                  style: ElevatedButton.styleFrom(
                    minimumSize: const Size(200, 54),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      floatingActionButton: hasWrite
          ? FloatingActionButton(
              onPressed: () {
                if (_tabController.index == 0) {
                  _showAddEditGodownDialog();
                } else {
                  _showTransferStockDialog();
                }
              },
              backgroundColor: Theme.of(context).colorScheme.primary,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
