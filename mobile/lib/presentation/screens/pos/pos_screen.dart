import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../../core/utils/money_utils.dart';
import '../../widgets/ui_helpers.dart';

class PosScreen extends ConsumerStatefulWidget {
  const PosScreen({super.key});

  @override
  ConsumerState<PosScreen> createState() => _PosScreenState();
}

class _PosScreenState extends ConsumerState<PosScreen> {
  final _searchController = TextEditingController();
  final Map<String, int> _cart = {}; // itemId -> quantity
  String _paymentMode = 'CASH';

  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(itemsProvider.notifier).loadItems();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _onSearch(String val) {
    ref.read(itemsProvider.notifier).searchItems(val);
  }

  void _addToCart(Item item) {
    setState(() {
      _cart[item.id] = (_cart[item.id] ?? 0) + 1;
    });
  }

  void _removeFromCart(Item item) {
    if (!_cart.containsKey(item.id)) return;
    setState(() {
      if (_cart[item.id] == 1) {
        _cart.remove(item.id);
      } else {
        _cart[item.id] = _cart[item.id]! - 1;
      }
    });
  }

  // --- Calculations ---
  double get _cartTotal {
    final itemsState = ref.read(itemsProvider);
    double sum = 0.0;
    itemsState.whenData((list) {
      _cart.forEach((itemId, qty) {
        final item = list.firstWhere((i) => i.id == itemId);
        sum += qty * item.rate;
      });
    });
    return sum;
  }

  double get _cartTax {
    final itemsState = ref.read(itemsProvider);
    double tax = 0.0;
    itemsState.whenData((list) {
      _cart.forEach((itemId, qty) {
        final item = list.firstWhere((i) => i.id == itemId);
        tax += qty * item.rate * (item.gstRate / 100);
      });
    });
    return tax;
  }

  double get _cartGrandTotal => _cartTotal + _cartTax;

  void _submitPosSale() async {
    if (_cart.isEmpty) return;

    final itemsState = ref.read(itemsProvider);
    List<Item> catalog = [];
    itemsState.whenData((list) => catalog = list);

    final List<Map<String, dynamic>> lines = [];
    _cart.forEach((itemId, qty) {
      final item = catalog.firstWhere((i) => i.id == itemId);
      lines.add({
        'itemId': item.id,
        'description': item.name,
        'hsnSac': item.hsnSac,
        'unit': item.unit ?? 'NOS',
        'qty': qty,
        'rate': item.rate,
        'discount': 0,
        'gstRate': item.gstRate,
      });
    });

    final grandTotalVal = _cartGrandTotal;

    final data = {
      'partyName': 'POS Customer',
      'notes': 'POS sale',
      'lines': lines,
      'payments': [
        {
          'mode': _paymentMode,
          'amount': grandTotalVal,
        }
      ],
      'finalize': true,
    };

    final invoice = await ref.read(invoicesNotifierProvider.notifier).create(data);

    if (mounted) {
      if (invoice != null) {
        setState(() {
          _cart.clear();
          _searchController.clear();
        });
        _showSuccessDialog(invoice.id, invoice.invoiceNumber);
      } else {
        final err = ref.read(invoicesNotifierProvider).error?.toString() ?? 'POS checkout failed';
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

  void _showSuccessDialog(String invoiceId, String invoiceNumber) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return AlertDialog(
          title: const Row(
            children: [
              Icon(Icons.check_circle, color: Colors.green, size: 28),
              SizedBox(width: 8),
              Text('Bill Raised!'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Invoice: $invoiceNumber', style: const TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              Text('Total charged: ${MoneyUtils.format(_cartGrandTotal)}'),
              const Text('Stock levels updated successfully.'),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go('/invoices/$invoiceId');
              },
              child: const Text('View Bill'),
            ),
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                // Refresh list
                ref.read(itemsProvider.notifier).loadItems();
              },
              child: const Text('New Sale'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final features = ref.watch(featuresProvider) ?? {};
    final hasPos = features['pos'] ?? false;

    if (!hasPos) {
      return Scaffold(
        appBar: AppBar(title: const Text('POS Billing')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.lock_outline, size: 64, color: Colors.grey.shade400),
              const SizedBox(height: 16),
              const Text(
                'POS Register is locked.',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                'Upgrade your subscription plan to unlock POS Billing.',
                style: TextStyle(color: Colors.grey),
              ),
            ],
          ),
        ),
      );
    }

    final itemsState = ref.watch(itemsProvider);
    final cartCount = _cart.values.fold<int>(0, (sum, val) => sum + val);
    final screenWidth = MediaQuery.sizeOf(context).width;
    final isCompact = screenWidth < 720;

    return Scaffold(
      appBar: AppBar(
        title: const Text('POS Fast Register'),
      ),
      body: isCompact
          ? Column(
              children: [
                Expanded(flex: 3, child: _buildCatalogPane(itemsState)),
                const Divider(height: 1),
                Expanded(flex: 2, child: _buildCartPane(itemsState, cartCount)),
              ],
            )
          : Row(
              children: [
                Expanded(flex: 3, child: _buildCatalogPane(itemsState)),
                SizedBox(
                  width: 320,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      border: Border(left: BorderSide(color: Colors.grey.shade300)),
                      color: Theme.of(context).cardColor,
                    ),
                    child: _buildCartPane(itemsState, cartCount),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildCatalogPane(AsyncValue<List<Item>> itemsState) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: TextField(
            controller: _searchController,
            onChanged: _onSearch,
            decoration: InputDecoration(
              hintText: 'Search catalog / scan barcode...',
              prefixIcon: const Icon(Icons.qr_code_scanner),
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
                return const Center(child: Text('No catalog items found.'));
              }
              return LayoutBuilder(
                builder: (context, constraints) {
                  final crossAxisCount = (constraints.maxWidth / 140).floor().clamp(2, 4);
                  return GridView.builder(
                    padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
                    gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: crossAxisCount,
                      childAspectRatio: 1.05,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                    ),
                    itemCount: items.length,
                    itemBuilder: (context, index) {
                      final item = items[index];
                      final qtyInCart = _cart[item.id] ?? 0;
                      return _PosItemTile(
                        item: item,
                        qtyInCart: qtyInCart,
                        onTap: () => _addToCart(item),
                      );
                    },
                  );
                },
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, s) => Center(child: Text('Error: $e')),
          ),
        ),
      ],
    );
  }

  Widget _buildCartPane(AsyncValue<List<Item>> itemsState, int cartCount) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
          child: Row(
            children: [
              Expanded(
                child: Text(
                  'Cart Summary ($cartCount)',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              if (_cart.isNotEmpty)
                TextButton(
                  onPressed: () => setState(() => _cart.clear()),
                  child: const Text('Clear'),
                ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: _cart.isEmpty
              ? const Center(
                  child: Padding(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Cart is empty. Tap items to add.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey),
                    ),
                  ),
                )
              : ListView.builder(
                  itemCount: _cart.length,
                  itemBuilder: (context, index) {
                    final itemId = _cart.keys.elementAt(index);
                    final qty = _cart[itemId]!;

                    Item? item;
                    itemsState.whenData((list) {
                      for (final candidate in list) {
                        if (candidate.id == itemId) {
                          item = candidate;
                          break;
                        }
                      }
                    });

                    if (item == null) return const SizedBox.shrink();

                    return ListTile(
                      dense: true,
                      title: Text(item!.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text('${MoneyUtils.format(item!.rate)} x $qty'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, size: 20),
                            onPressed: () => _removeFromCart(item!),
                            visualDensity: VisualDensity.compact,
                          ),
                          Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline, size: 20),
                            onPressed: () => _addToCart(item!),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    );
                  },
                ),
        ),
        const Divider(height: 1),
        SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text('Grand Total:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                    Flexible(
                      child: Text(
                        MoneyUtils.format(_cartGrandTotal),
                        textAlign: TextAlign.end,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                          color: Theme.of(context).colorScheme.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _paymentMode,
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Payment Mode',
                    isDense: true,
                  ),
                  items: [
                    UiHelpers.menuItem(value: 'CASH', label: 'Cash'),
                    UiHelpers.menuItem(value: 'UPI', label: 'UPI'),
                    UiHelpers.menuItem(value: 'CARD', label: 'Card'),
                  ],
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _paymentMode = val);
                    }
                  },
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _cart.isEmpty ? null : _submitPosSale,
                  child: const Text('Charge & Print Bill'),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _PosItemTile extends StatelessWidget {
  final Item item;
  final int qtyInCart;
  final VoidCallback onTap;

  const _PosItemTile({
    required this.item,
    required this.qtyInCart,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    final selected = qtyInCart > 0;

    return Material(
      color: selected ? primary.withValues(alpha: 0.08) : Theme.of(context).cardColor,
      elevation: 1,
      shadowColor: Colors.black26,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Column(
            children: [
              Expanded(
                child: Center(
                  child: Text(
                    item.name,
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                ),
              ),
              Text(
                MoneyUtils.format(item.rate),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              if (selected) ...[
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: primary,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    'Qty: $qtyInCart',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ] else
                const SizedBox(height: 4),
            ],
          ),
        ),
      ),
    );
  }
}
