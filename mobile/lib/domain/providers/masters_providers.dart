import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/masters_models.dart';
import '../../data/repositories/masters_repository.dart';

// --- Parties State Notifier ---
class PartiesNotifier extends StateNotifier<AsyncValue<List<Party>>> {
  final MastersRepository _repository;

  PartiesNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadParties();
  }

  Future<void> loadParties({bool all = false}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getParties(all: all);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> searchParties(String query) async {
    if (query.trim().isEmpty) {
      await loadParties();
      return;
    }
    state = const AsyncValue.loading();
    try {
      final list = await _repository.searchParties(query);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createParty(data);
      await loadParties();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> data) async {
    try {
      await _repository.updateParty(id, data);
      await loadParties();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> delete(String id) async {
    try {
      await _repository.deleteParty(id);
      await loadParties();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final partiesProvider = StateNotifierProvider<PartiesNotifier, AsyncValue<List<Party>>>((ref) {
  return PartiesNotifier(ref.watch(mastersRepositoryProvider));
});

// --- Items State Notifier ---
class ItemsNotifier extends StateNotifier<AsyncValue<List<Item>>> {
  final MastersRepository _repository;

  ItemsNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadItems();
  }

  Future<void> loadItems({bool all = false}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getItems(all: all);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<void> searchItems(String query) async {
    if (query.trim().isEmpty) {
      await loadItems();
      return;
    }
    state = const AsyncValue.loading();
    try {
      final list = await _repository.searchItems(query);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createItem(data);
      await loadItems();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> data) async {
    try {
      await _repository.updateItem(id, data);
      await loadItems();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> delete(String id) async {
    try {
      await _repository.deleteItem(id);
      await loadItems();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> adjustStock(String itemId, double qtyDelta, String? note) async {
    try {
      await _repository.adjustGlobalStock(itemId, qtyDelta, note);
      await loadItems();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final itemsProvider = StateNotifierProvider<ItemsNotifier, AsyncValue<List<Item>>>((ref) {
  return ItemsNotifier(ref.watch(mastersRepositoryProvider));
});

// --- Godowns State Notifier ---
class GodownsNotifier extends StateNotifier<AsyncValue<List<Godown>>> {
  final MastersRepository _repository;

  GodownsNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadGodowns();
  }

  Future<void> loadGodowns() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getGodowns();
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createGodown(data);
      await loadGodowns();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> update(String id, Map<String, dynamic> data) async {
    try {
      await _repository.updateGodown(id, data);
      await loadGodowns();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final godownsProvider = StateNotifierProvider<GodownsNotifier, AsyncValue<List<Godown>>>((ref) {
  return GodownsNotifier(ref.watch(mastersRepositoryProvider));
});

// --- Inventory Stock State Notifier ---
class StockNotifier extends StateNotifier<AsyncValue<List<StockLevel>>> {
  final MastersRepository _repository;

  StockNotifier(this._repository) : super(const AsyncValue.loading());

  Future<void> loadStock({String? godownId}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getInventoryStock(godownId: godownId);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> adjustGodownStock({
    required String itemId,
    required String godownId,
    required double qtyDelta,
    String? note,
  }) async {
    try {
      await _repository.adjustGodownStock(
        itemId: itemId,
        godownId: godownId,
        qtyDelta: qtyDelta,
        note: note,
      );
      await loadStock(godownId: godownId);
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> transferStock({
    required String itemId,
    required String fromGodownId,
    required String toGodownId,
    required double qty,
    String? note,
  }) async {
    try {
      await _repository.transferStock(
        itemId: itemId,
        fromGodownId: fromGodownId,
        toGodownId: toGodownId,
        qty: qty,
        note: note,
      );
      await loadStock(godownId: fromGodownId);
      return true;
    } catch (e) {
      return false;
    }
  }
}

final stockProvider = StateNotifierProvider<StockNotifier, AsyncValue<List<StockLevel>>>((ref) {
  return StockNotifier(ref.watch(mastersRepositoryProvider));
});
