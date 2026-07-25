import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';
import '../../../domain/providers/masters_providers.dart';
import '../../../domain/providers/invoices_providers.dart';
import '../../../data/models/masters_models.dart';
import '../../../core/utils/money_utils.dart';

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

    return Scaffold(
      appBar: AppBar(
        title: const Text('POS Fast Register'),
      ),
      body: Row(
        children: [
          // Left Side: Items Catalog list
          Expanded(
            flex: 3,
            child: Column(
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
                      return GridView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 180,
                          childAspectRatio: 1.2,
                          crossAxisSpacing: 10,
                          mainAxisSpacing: 10,
                        ),
                        itemCount: items.length,
                        itemBuilder: (context, index) {
                          final item = items[index];
                          final qtyInCart = _cart[item.id] ?? 0;

                          return GestureDetector(
                            onTap: () => _addToCart(item),
                            child: Card(
                              color: qtyInCart > 0
                                  ? Theme.of(context).colorScheme.primary.withOpacity(0.08)
                                  : null,
                              child: Padding(
                                padding: const EdgeInsets.all(8.0),
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      item.name,
                                      textAlign: TextAlign.center,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      MoneyUtils.format(item.rate),
                                      style: TextStyle(
                                        color: Theme.of(context).colorScheme.primary,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    if (qtyInCart > 0) ...[
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: Theme.of(context).colorScheme.primary,
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Text(
                                          'Qty: $qtyInCart',
                                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      );
                    },
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (e, s) => Center(child: Text('Error: $e')),
                  ),
                ),
              ],
            ),
          ),

          // Right Side: Cart Pane (visible on large screen/landscape, on mobile/portrait it can adapt)
          Container(
            width: 320,
            decoration: BoxDecoration(
              border: Border(left: BorderSide(color: Colors.grey.shade300)),
              color: Theme.of(context).cardColor,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Cart Summary ($cartCount)', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      if (_cart.isNotEmpty)
                        TextButton(
                          onPressed: () => setState(() => _cart.clear()),
                          child: const Text('Clear'),
                        ),
                    ],
                  ),
                ),
                const Divider(),
                Expanded(
                  child: _cart.isEmpty
                      ? const Center(child: Text('Cart is empty. Tap items to add.', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          itemCount: _cart.length,
                          itemBuilder: (context, index) {
                            final itemId = _cart.keys.elementAt(index);
                            final qty = _cart[itemId]!;
                            
                            // Find item in cache
                            Item? item;
                            itemsState.whenData((list) {
                              item = list.firstWhere((i) => i.id == itemId);
                            });

                            if (item == null) return const SizedBox();

                            return ListTile(
                              title: Text(item!.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                              subtitle: Text('${MoneyUtils.format(item!.rate)} x $qty'),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                                    onPressed: () => _removeFromCart(item!),
                                  ),
                                  Text('$qty', style: const TextStyle(fontWeight: FontWeight.bold)),
                                  IconButton(
                                    icon: const Icon(Icons.add_circle_outline, size: 20),
                                    onPressed: () => _addToCart(item!),
                                  ),
                                ],
                              ),
                            );
                          },
                        ),
                ),
                const Divider(),
                // Totals & Pay
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text('Grand Total:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text(
                            MoneyUtils.format(_cartGrandTotal),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 18,
                              color: Theme.of(context).colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      // Payment toggle
                      DropdownButtonFormField<String>(
                        value: _paymentMode,
                        decoration: const InputDecoration(labelText: 'Payment Mode'),
                        items: const [
                          DropdownMenuItem(value: 'CASH', child: Text('Cash')),
                          DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                          DropdownMenuItem(value: 'CARD', child: Text('Card')),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _paymentMode = val;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _cart.isEmpty ? null : _submitPosSale,
                        child: const Text('Charge & Print Bill'),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
