import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../domain/providers/auth_provider.dart';

class ShellScreen extends ConsumerWidget {
  final Widget child;

  const ShellScreen({
    super.key,
    required this.child,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profileConfig = ref.watch(profileConfigProvider);
    final features = ref.watch(featuresProvider) ?? {};
    final hasStock = features['stock'] ?? false;
    final hasEway = features['eway'] ?? false;
    final hasNotes = features['notes'] ?? false;
    final partyLabel = profileConfig?.partyLabel ?? 'Parties';

    // List of bottom navigation routes
    final bottomRoutes = [
      '/dashboard',
      '/invoices',
      '/parties',
      '/items',
      if (hasStock) '/godowns',
      '/account',
    ];

    final String location = GoRouterState.of(context).matchedLocation;
    int selectedIndex = bottomRoutes.indexWhere((route) => location.startsWith(route));
    if (selectedIndex == -1) selectedIndex = 0;

    return Scaffold(
      appBar: AppBar(
        leading: Builder(
          builder: (context) => IconButton(
            icon: const Icon(Icons.menu),
            onPressed: () => Scaffold.of(context).openDrawer(),
            tooltip: 'Open menu drawer',
          ),
        ),
        title: const Text('Billing System'),
      ),
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.primary,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Container(
                    height: 44,
                    width: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      image: const DecorationImage(
                        image: AssetImage('assets/logo.jpeg'),
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    ref.watch(authProvider).tenant?.name ?? 'My Shop',
                    style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  Text(
                    'User: ${ref.watch(authProvider).user?.fullName ?? ""}',
                    style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 13),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.dashboard_outlined),
              title: const Text('Dashboard'),
              onTap: () {
                context.pop();
                context.go('/dashboard');
              },
            ),
            ListTile(
              leading: const Icon(Icons.receipt_long_outlined),
              title: const Text('Invoices Registry'),
              onTap: () {
                context.pop();
                context.go('/invoices');
              },
            ),
            ListTile(
              leading: const Icon(Icons.people_alt_outlined),
              title: Text('$partyLabel Registry'),
              onTap: () {
                context.pop();
                context.go('/parties');
              },
            ),
            ListTile(
              leading: const Icon(Icons.inventory_2_outlined),
              title: const Text('Items Catalog'),
              onTap: () {
                context.pop();
                context.go('/items');
              },
            ),
            if (hasStock)
              ListTile(
                leading: const Icon(Icons.warehouse_outlined),
                title: const Text('Godowns & Transfers'),
                onTap: () {
                  context.pop();
                  context.go('/godowns');
                },
              ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.shopping_cart_checkout_outlined),
              title: const Text('Purchases Register'),
              onTap: () {
                context.pop();
                context.go('/purchases');
              },
            ),
            if (hasEway)
              ListTile(
                leading: const Icon(Icons.local_shipping_outlined),
                title: const Text('E-way Billing'),
                onTap: () {
                  context.pop();
                  context.go('/eway');
                },
              ),
            if (hasNotes)
              ListTile(
                leading: const Icon(Icons.sticky_note_2_outlined),
                title: const Text('Sticky Notes'),
                onTap: () {
                  context.pop();
                  context.go('/notes');
                },
              ),
            ListTile(
              leading: const Icon(Icons.analytics_outlined),
              title: const Text('Reports Center'),
              onTap: () {
                context.pop();
                context.go('/reports-center');
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline_outlined),
              title: const Text('Recycle Bin'),
              onTap: () {
                context.pop();
                context.go('/recycle-bin');
              },
            ),
            const Divider(),
            ListTile(
              leading: const Icon(Icons.settings_outlined),
              title: const Text('My Account'),
              onTap: () {
                context.pop();
                context.go('/account');
              },
            ),
          ],
        ),
      ),
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: selectedIndex,
        type: BottomNavigationBarType.fixed,
        selectedFontSize: 11,
        unselectedFontSize: 10,
        onTap: (index) {
          context.go(bottomRoutes[index]);
        },
        items: [
          const BottomNavigationBarItem(
            icon: Icon(Icons.dashboard_outlined),
            activeIcon: Icon(Icons.dashboard),
            label: 'Home',
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.receipt_long_outlined),
            activeIcon: Icon(Icons.receipt_long),
            label: 'Invoices',
          ),
          BottomNavigationBarItem(
            icon: const Icon(Icons.people_outline),
            activeIcon: const Icon(Icons.people),
            label: _shortNavLabel(partyLabel),
          ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.inventory_2_outlined),
            activeIcon: Icon(Icons.inventory_2),
            label: 'Items',
          ),
          if (hasStock)
            const BottomNavigationBarItem(
              icon: Icon(Icons.warehouse_outlined),
              activeIcon: Icon(Icons.warehouse),
              label: 'Stock',
            ),
          const BottomNavigationBarItem(
            icon: Icon(Icons.person_outline),
            activeIcon: Icon(Icons.person),
            label: 'Account',
          ),
        ],
      ),
    );
  }

  static String _shortNavLabel(String label) {
    final trimmed = label.trim();
    if (trimmed.length <= 10) return trimmed;
    return '${trimmed.substring(0, 9)}…';
  }
}
