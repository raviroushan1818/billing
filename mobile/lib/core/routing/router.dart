import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../domain/providers/auth_provider.dart';
import '../../presentation/screens/auth/login_screen.dart';
import '../../presentation/screens/account/account_screen.dart';
import '../../presentation/screens/dashboard/dashboard_screen.dart';
import '../../presentation/screens/shell/shell_screen.dart';
import '../../presentation/screens/masters/parties_screen.dart';
import '../../presentation/screens/masters/items_screen.dart';
import '../../presentation/screens/masters/godowns_screen.dart';
import '../../presentation/screens/invoices/invoices_register_screen.dart';
import '../../presentation/screens/invoices/new_invoice_screen.dart';
import '../../presentation/screens/invoices/invoice_detail_screen.dart';
import '../../presentation/screens/pos/pos_screen.dart';
import '../../presentation/screens/reports/receivables_screen.dart';
import '../../presentation/screens/ops/purchases_screen.dart';
import '../../presentation/screens/ops/new_purchase_screen.dart';
import '../../presentation/screens/ops/purchase_detail_screen.dart';
import '../../presentation/screens/ops/eway_screen.dart';
import '../../presentation/screens/ops/notes_screen.dart';
import '../../presentation/screens/ops/recycle_bin_screen.dart';
import '../../presentation/screens/reports/reports_center_screen.dart';

class RouterRefreshNotifier extends ChangeNotifier {
  void refresh() {
    notifyListeners();
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final refreshNotifier = RouterRefreshNotifier();

  ref.listen(authProvider, (previous, next) {
    if (previous?.status != next.status) {
      refreshNotifier.refresh();
    }
  });

  return GoRouter(
    initialLocation: '/dashboard',
    refreshListenable: refreshNotifier,
    redirect: (BuildContext context, GoRouterState state) {
      final authState = ref.read(authProvider);
      
      if (authState.status == AuthStatus.initial) {
        return null;
      }

      final isLoggedIn = authState.status == AuthStatus.authenticated;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isLoggedIn) {
        return isLoggingIn ? null : '/login';
      }

      if (isLoggingIn) {
        return '/dashboard';
      }

      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      ShellRoute(
        builder: (context, state, child) {
          return ShellScreen(child: child);
        },
        routes: [
          GoRoute(
            path: '/dashboard',
            builder: (context, state) => const DashboardScreen(),
          ),
          GoRoute(
            path: '/parties',
            builder: (context, state) => const PartiesScreen(),
          ),
          GoRoute(
            path: '/items',
            builder: (context, state) => const ItemsScreen(),
          ),
          GoRoute(
            path: '/godowns',
            builder: (context, state) => const GodownsScreen(),
          ),
          GoRoute(
            path: '/invoices',
            builder: (context, state) => const InvoicesRegisterScreen(),
          ),
          GoRoute(
            path: '/invoices/new',
            builder: (context, state) => const NewInvoiceScreen(),
          ),
          GoRoute(
            path: '/invoices/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return InvoiceDetailScreen(id: id);
            },
          ),
          GoRoute(
            path: '/pos',
            builder: (context, state) => const PosScreen(),
          ),
          GoRoute(
            path: '/receivables',
            builder: (context, state) => const ReceivablesReportScreen(),
          ),
          GoRoute(
            path: '/purchases',
            builder: (context, state) => const PurchasesScreen(),
          ),
          GoRoute(
            path: '/purchases/new',
            builder: (context, state) => const NewPurchaseScreen(),
          ),
          GoRoute(
            path: '/purchases/:id',
            builder: (context, state) {
              final id = state.pathParameters['id']!;
              return PurchaseDetailScreen(id: id);
            },
          ),
          GoRoute(
            path: '/eway',
            builder: (context, state) => const EwayScreen(),
          ),
          GoRoute(
            path: '/notes',
            builder: (context, state) => const NotesScreen(),
          ),
          GoRoute(
            path: '/recycle-bin',
            builder: (context, state) => const RecycleBinScreen(),
          ),
          GoRoute(
            path: '/reports-center',
            builder: (context, state) => const ReportsCenterScreen(),
          ),
          GoRoute(
            path: '/account',
            builder: (context, state) => const AccountScreen(),
          ),
        ],
      ),
    ],
  );
});
