import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/ops_models.dart';
import '../../data/models/invoices_models.dart';
import '../../data/repositories/ops_repository.dart';

// --- Purchases State Notifier ---
class PurchasesNotifier extends StateNotifier<AsyncValue<List<Purchase>>> {
  final OpsRepository _repository;

  PurchasesNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadPurchases();
  }

  Future<void> loadPurchases() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getPurchases();
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createPurchase(data);
      await loadPurchases();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> voidPurchase(String id) async {
    try {
      await _repository.voidPurchase(id);
      await loadPurchases();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final purchasesProvider = StateNotifierProvider<PurchasesNotifier, AsyncValue<List<Purchase>>>((ref) {
  return PurchasesNotifier(ref.watch(opsRepositoryProvider));
});

// --- E-way Bills State Notifier ---
class EwaysNotifier extends StateNotifier<AsyncValue<List<EwayBill>>> {
  final OpsRepository _repository;

  EwaysNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadEways();
  }

  Future<void> loadEways() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getEways();
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createEway(data);
      await loadEways();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> cancel(String id, String? reason) async {
    try {
      await _repository.cancelEway(id, reason);
      await loadEways();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final ewaysProvider = StateNotifierProvider<EwaysNotifier, AsyncValue<List<EwayBill>>>((ref) {
  return EwaysNotifier(ref.watch(opsRepositoryProvider));
});

// --- Sticky Notes State Notifier ---
class NotesNotifier extends StateNotifier<AsyncValue<List<NoteItem>>> {
  final OpsRepository _repository;

  NotesNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadNotes();
  }

  Future<void> loadNotes({String? partyId}) async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getNotes(partyId: partyId);
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> create(Map<String, dynamic> data) async {
    try {
      await _repository.createNote(data);
      await loadNotes();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateNote(String id, Map<String, dynamic> data) async {
    try {
      await _repository.updateNote(id, data);
      await loadNotes();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> delete(String id) async {
    try {
      await _repository.deleteNote(id);
      await loadNotes();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final notesProvider = StateNotifierProvider<NotesNotifier, AsyncValue<List<NoteItem>>>((ref) {
  return NotesNotifier(ref.watch(opsRepositoryProvider));
});

// --- Recycle Bin State Notifier ---
class RecycleBinNotifier extends StateNotifier<AsyncValue<List<Invoice>>> {
  final OpsRepository _repository;

  RecycleBinNotifier(this._repository) : super(const AsyncValue.loading()) {
    loadRecycleBin();
  }

  Future<void> loadRecycleBin() async {
    state = const AsyncValue.loading();
    try {
      final list = await _repository.getRecycleBin();
      state = AsyncValue.data(list);
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
    }
  }

  Future<bool> restore(String id) async {
    try {
      await _repository.restoreInvoice(id);
      await loadRecycleBin();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> permanentDelete(String id) async {
    try {
      await _repository.permanentDeleteInvoice(id);
      await loadRecycleBin();
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> emptyBin() async {
    try {
      await _repository.emptyRecycleBin();
      await loadRecycleBin();
      return true;
    } catch (e) {
      return false;
    }
  }
}

final recycleBinProvider = StateNotifierProvider<RecycleBinNotifier, AsyncValue<List<Invoice>>>((ref) {
  return RecycleBinNotifier(ref.watch(opsRepositoryProvider));
});
