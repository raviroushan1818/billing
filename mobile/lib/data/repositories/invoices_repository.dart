import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_client.dart';
import '../../core/network/api_exception.dart';
import '../models/invoices_models.dart';

class InvoicesRepository {
  final Dio _client;

  InvoicesRepository(this._client);

  Future<List<Invoice>> getInvoices({
    String? from,
    String? to,
    String? status,
    String? paymentStatus,
    String? documentType,
    String? q,
    String? partyId,
    String? fy,
  }) async {
    try {
      final queryParams = {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
        if (status != null) 'status': status,
        if (paymentStatus != null) 'paymentStatus': paymentStatus,
        if (documentType != null) 'documentType': documentType,
        if (q != null) 'q': q,
        if (partyId != null) 'partyId': partyId,
        if (fy != null) 'fy': fy,
      };

      final response = await _client.get('/invoices', queryParameters: queryParams);
      final list = response.data as List;
      return list.map((e) => Invoice.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> getInvoice(String id) async {
    try {
      final response = await _client.get('/invoices/$id');
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> createInvoice(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/invoices', data: data);
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> updateDraftInvoice(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch('/invoices/$id', data: data);
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> finalizeInvoice(String id) async {
    try {
      final response = await _client.post('/invoices/$id/finalize');
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> voidInvoice(String id, String reason) async {
    try {
      final response = await _client.post('/invoices/$id/void', data: {'reason': reason});
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Invoice> addPayment(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/invoices/$id/payments', data: data);
      return Invoice.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> softDeleteInvoice(String id) async {
    try {
      await _client.delete('/invoices/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<PrintResponse> printInvoice(String id) async {
    try {
      final response = await _client.post('/invoices/$id/print');
      return PrintResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> shareInvoiceEmail(String id, String toEmail, String? message) async {
    try {
      await _client.post('/invoices/$id/share/email', data: {
        'to': toEmail,
        if (message != null) 'message': message,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> shareInvoiceWhatsapp(String id, String toE164, String? message) async {
    try {
      await _client.post('/invoices/$id/share/whatsapp', data: {
        'toE164': toE164,
        if (message != null) 'message': message,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

final invoicesRepositoryProvider = Provider<InvoicesRepository>((ref) {
  return InvoicesRepository(ref.watch(dioProvider));
});
