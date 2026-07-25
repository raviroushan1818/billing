import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_client.dart';
import '../../core/network/api_exception.dart';
import '../models/ops_models.dart';
import '../models/invoices_models.dart';

class OpsRepository {
  final Dio _client;

  OpsRepository(this._client);

  // --- Purchases ---
  Future<List<Purchase>> getPurchases() async {
    try {
      final response = await _client.get('/purchases');
      final list = response.data as List;
      return list.map((e) => Purchase.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Purchase> getPurchase(String id) async {
    try {
      final response = await _client.get('/purchases/$id');
      return Purchase.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Purchase> createPurchase(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/purchases', data: data);
      return Purchase.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Purchase> voidPurchase(String id) async {
    try {
      final response = await _client.post('/purchases/$id/void');
      return Purchase.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // --- E-way Bills ---
  Future<List<EwayBill>> getEways() async {
    try {
      final response = await _client.get('/eway');
      final list = response.data as List;
      return list.map((e) => EwayBill.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<EwayBill> createEway(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/eway', data: data);
      return EwayBill.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> cancelEway(String id, String? reason) async {
    try {
      await _client.post('/eway/$id/cancel', data: {
        if (reason != null) 'reason': reason,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // --- Sticky Notes ---
  Future<List<NoteItem>> getNotes({String? partyId}) async {
    try {
      final response = await _client.get(
        '/notes',
        queryParameters: {if (partyId != null) 'partyId': partyId},
      );
      final list = response.data as List;
      return list.map((e) => NoteItem.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<NoteItem> createNote(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/notes', data: data);
      return NoteItem.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<NoteItem> updateNote(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch('/notes/$id', data: data);
      return NoteItem.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> deleteNote(String id) async {
    try {
      await _client.delete('/notes/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // --- Recycle Bin ---
  Future<List<Invoice>> getRecycleBin() async {
    try {
      final response = await _client.get('/invoices/recycle-bin');
      final list = response.data as List;
      return list.map((e) => Invoice.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> restoreInvoice(String id) async {
    try {
      await _client.post('/invoices/$id/restore');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> permanentDeleteInvoice(String id) async {
    try {
      await _client.delete('/invoices/$id/permanent');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> emptyRecycleBin() async {
    try {
      await _client.post('/invoices/recycle-bin/empty');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

final opsRepositoryProvider = Provider<OpsRepository>((ref) {
  return OpsRepository(ref.watch(dioProvider));
});
