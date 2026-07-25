import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_client.dart';
import '../../core/network/api_exception.dart';
import '../models/masters_models.dart';

class MastersRepository {
  final Dio _client;

  MastersRepository(this._client);

  // --- Parties ---
  Future<List<Party>> getParties({bool all = false}) async {
    try {
      final response = await _client.get('/parties', queryParameters: {'all': all.toString()});
      final list = response.data as List;
      return list.map((e) => Party.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<Party>> searchParties(String query) async {
    try {
      final response = await _client.get('/parties/search', queryParameters: {'q': query});
      final list = response.data as List;
      return list.map((e) => Party.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Party> getParty(String id) async {
    try {
      final response = await _client.get('/parties/$id');
      return Party.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Party> createParty(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/parties', data: data);
      return Party.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Party> updateParty(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch('/parties/$id', data: data);
      return Party.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> deleteParty(String id) async {
    try {
      await _client.delete('/parties/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // --- Items ---
  Future<List<Item>> getItems({bool all = false}) async {
    try {
      final response = await _client.get('/items', queryParameters: {'all': all.toString()});
      final list = response.data as List;
      return list.map((e) => Item.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<Item>> searchItems(String query) async {
    try {
      final response = await _client.get('/items/search', queryParameters: {'q': query});
      final list = response.data as List;
      return list.map((e) => Item.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Item> getItem(String id) async {
    try {
      final response = await _client.get('/items/$id');
      return Item.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Item> createItem(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/items', data: data);
      return Item.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Item> updateItem(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch('/items/$id', data: data);
      return Item.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> deleteItem(String id) async {
    try {
      await _client.delete('/items/$id');
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> adjustGlobalStock(String itemId, double qtyDelta, String? note) async {
    try {
      await _client.post('/items/$itemId/stock', data: {
        'qtyDelta': qtyDelta,
        if (note != null) 'note': note,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<StockMovement>> getItemMovements(String id) async {
    try {
      final response = await _client.get('/items/$id/movements');
      final list = response.data as List;
      return list.map((e) => StockMovement.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  // --- Godowns & Inventory ---
  Future<List<Godown>> getGodowns() async {
    try {
      final response = await _client.get('/godowns');
      final list = response.data as List;
      return list.map((e) => Godown.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Godown> createGodown(Map<String, dynamic> data) async {
    try {
      final response = await _client.post('/godowns', data: data);
      return Godown.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Godown> updateGodown(String id, Map<String, dynamic> data) async {
    try {
      final response = await _client.patch('/godowns/$id', data: data);
      return Godown.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<List<StockLevel>> getInventoryStock({String? godownId}) async {
    try {
      final response = await _client.get(
        '/inventory/stock',
        queryParameters: {if (godownId != null) 'godownId': godownId},
      );
      final list = response.data as List;
      return list.map((e) => StockLevel.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> transferStock({
    required String itemId,
    required String fromGodownId,
    required String toGodownId,
    required double qty,
    String? note,
  }) async {
    try {
      await _client.post('/inventory/transfer', data: {
        'itemId': itemId,
        'fromGodownId': fromGodownId,
        'toGodownId': toGodownId,
        'qty': qty,
        if (note != null) 'note': note,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> adjustGodownStock({
    required String itemId,
    required String godownId,
    required double qtyDelta,
    String? note,
  }) async {
    try {
      await _client.post('/inventory/items/$itemId/godowns/$godownId/adjust', data: {
        'qtyDelta': qtyDelta,
        if (note != null) 'note': note,
      });
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

final mastersRepositoryProvider = Provider<MastersRepository>((ref) {
  return MastersRepository(ref.watch(dioProvider));
});
