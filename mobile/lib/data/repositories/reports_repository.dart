import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_client.dart';
import '../../core/network/api_exception.dart';
import '../models/reports_models.dart';

class ReportsRepository {
  final Dio _client;

  ReportsRepository(this._client);

  Future<ReceivablesResponse> getReceivables() async {
    try {
      final response = await _client.get('/reports/receivables');
      return ReceivablesResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getDayBook(String from, String to) async {
    try {
      final response = await _client.get('/reports/day-book', queryParameters: {
        'from': from,
        'to': to,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getCollections(String from, String to) async {
    try {
      final response = await _client.get('/reports/collections-by-mode', queryParameters: {
        'from': from,
        'to': to,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getGstr1(String from, String to) async {
    try {
      final response = await _client.get('/reports/gstr1', queryParameters: {
        'from': from,
        'to': to,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getItc(String? from, String? to) async {
    try {
      final response = await _client.get('/reports/itc', queryParameters: {
        if (from != null) 'from': from,
        if (to != null) 'to': to,
      });
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

final reportsRepositoryProvider = Provider<ReportsRepository>((ref) {
  return ReportsRepository(ref.watch(dioProvider));
});
