import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/reports_models.dart';
import '../../data/repositories/reports_repository.dart';
import '../../core/utils/money_utils.dart';

final receivablesProvider = FutureProvider<ReceivablesResponse>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  return repository.getReceivables();
});

final dashboardDayBookProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final repository = ref.watch(reportsRepositoryProvider);
  final todayStr = DateTime.now().toIso8601String().substring(0, 10);

  try {
    final results = await Future.wait([
      repository.getDayBook(todayStr, todayStr),
      repository.getCollections(todayStr, todayStr),
    ]);

    final dayBook = results[0] as Map<String, dynamic>;
    final collections = results[1] as Map<String, dynamic>;

    final colTotals = collections['totals'] as Map<String, dynamic>? ?? {};
    final collectionsTotal = MoneyUtils.parse(colTotals['total'] ?? 0.0);

    final totals = dayBook['totals'] as Map<String, dynamic>? ?? {};

    return {
      'salesTotal': MoneyUtils.parse(totals['grand'] ?? 0.0),
      'invoicesCount': totals['invoiceCount'] as int? ?? 0,
      'collectionsTotal': collectionsTotal,
    };
  } catch (e) {
    // Fallback to zero values on error/offline
    return {
      'salesTotal': 0.0,
      'invoicesCount': 0,
      'collectionsTotal': 0.0,
    };
  }
});
