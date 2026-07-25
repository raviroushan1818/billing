import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/invoices_models.dart';
import '../../data/repositories/invoices_repository.dart';

class InvoicesFilter {
  final String? from;
  final String? to;
  final String? status;
  final String? paymentStatus;
  final String? documentType;
  final String? q;
  final String? partyId;
  final String? fy;

  InvoicesFilter({
    this.from,
    this.to,
    this.status,
    this.paymentStatus,
    this.documentType,
    this.q,
    this.partyId,
    this.fy,
  });

  InvoicesFilter copyWith({
    String? from,
    String? to,
    String? status,
    String? paymentStatus,
    String? documentType,
    String? q,
    String? partyId,
    String? fy,
    bool clearFrom = false,
    bool clearTo = false,
    bool clearStatus = false,
    bool clearPaymentStatus = false,
    bool clearDocumentType = false,
    bool clearPartyId = false,
  }) {
    return InvoicesFilter(
      from: clearFrom ? null : (from ?? this.from),
      to: clearTo ? null : (to ?? this.to),
      status: clearStatus ? null : (status ?? this.status),
      paymentStatus: clearPaymentStatus ? null : (paymentStatus ?? this.paymentStatus),
      documentType: clearDocumentType ? null : (documentType ?? this.documentType),
      q: q ?? this.q,
      partyId: clearPartyId ? null : (partyId ?? this.partyId),
      fy: fy ?? this.fy,
    );
  }
}

final invoicesFilterProvider = StateProvider<InvoicesFilter>((ref) {
  return InvoicesFilter();
});

final invoicesListProvider = FutureProvider<List<Invoice>>((ref) async {
  final repository = ref.watch(invoicesRepositoryProvider);
  final filter = ref.watch(invoicesFilterProvider);

  return repository.getInvoices(
    from: filter.from,
    to: filter.to,
    status: filter.status,
    paymentStatus: filter.paymentStatus,
    documentType: filter.documentType,
    q: filter.q,
    partyId: filter.partyId,
    fy: filter.fy,
  );
});

class InvoicesNotifier extends StateNotifier<AsyncValue<void>> {
  final InvoicesRepository _repository;
  final Ref _ref;

  InvoicesNotifier(this._repository, this._ref) : super(const AsyncValue.data(null));

  Future<Invoice?> create(Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final invoice = await _repository.createInvoice(data);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return invoice;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }

  Future<Invoice?> updateDraft(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      final invoice = await _repository.updateDraftInvoice(id, data);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return invoice;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }

  Future<bool> finalize(String id) async {
    state = const AsyncValue.loading();
    try {
      await _repository.finalizeInvoice(id);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<bool> voidInvoice(String id, String reason) async {
    state = const AsyncValue.loading();
    try {
      await _repository.voidInvoice(id, reason);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<bool> addPayment(String id, Map<String, dynamic> data) async {
    state = const AsyncValue.loading();
    try {
      await _repository.addPayment(id, data);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<bool> softDelete(String id) async {
    state = const AsyncValue.loading();
    try {
      await _repository.softDeleteInvoice(id);
      state = const AsyncValue.data(null);
      _ref.invalidate(invoicesListProvider);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<PrintResponse?> printInvoice(String id) async {
    state = const BoxLoading(); // Temporary helper loading state or simple loading
    try {
      final res = await _repository.printInvoice(id);
      state = const AsyncValue.data(null);
      return res;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return null;
    }
  }

  Future<bool> shareEmail(String id, String toEmail, String? msg) async {
    state = const AsyncValue.loading();
    try {
      await _repository.shareInvoiceEmail(id, toEmail, msg);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }

  Future<bool> shareWhatsapp(String id, String toE164, String? msg) async {
    state = const AsyncValue.loading();
    try {
      await _repository.shareInvoiceWhatsapp(id, toE164, msg);
      state = const AsyncValue.data(null);
      return true;
    } catch (e, stack) {
      state = AsyncValue.error(e, stack);
      return false;
    }
  }
}

// Temporary subclass to signify non-blocking loading if we want, or simple loader
class BoxLoading extends AsyncLoading<void> {
  const BoxLoading();
}

final invoicesNotifierProvider = StateNotifierProvider<InvoicesNotifier, AsyncValue<void>>((ref) {
  return InvoicesNotifier(ref.watch(invoicesRepositoryProvider), ref);
});
