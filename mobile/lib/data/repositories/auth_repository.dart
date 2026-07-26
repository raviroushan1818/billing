import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/network/network_client.dart';
import '../../core/network/api_exception.dart';
import '../models/auth_models.dart';

class AuthRepository {
  final Dio _client;

  AuthRepository(this._client);

  Future<LoginResponse> login({
    required String clientId,
    required String email,
    required String password,
  }) async {
    try {
      final response = await _client.post(
        '/auth/login',
        data: {
          'clientId': clientId.toUpperCase(), // Uppercased by server requirement
          'email': email,
          'password': password,
        },
      );
      return LoginResponse.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<User> getMe() async {
    try {
      final response = await _client.get('/auth/me');
      return User.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Tenant> getTenantMe() async {
    try {
      final response = await _client.get('/tenants/me');
      return Tenant.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<TenantProfileConfig?> getProfileConfig() async {
    try {
      final response = await _client.get('/tenants/profile-config');
      final data = response.data;
      if (data == null) return null;
      return TenantProfileConfig.fromJson(data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, bool>> getBillingFeatures() async {
    try {
      final response = await _client.get('/billing/features');
      final data = response.data as Map<String, dynamic>;
      return data.map((key, value) => MapEntry(key, value == true));
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<Map<String, dynamic>> getBillingSubscription() async {
    try {
      final response = await _client.get('/billing/subscription');
      return response.data as Map<String, dynamic>;
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    try {
      await _client.post(
        '/auth/change-password',
        data: {
          'currentPassword': currentPassword,
          'newPassword': newPassword,
        },
      );
    } on DioException catch (e) {
      throw ApiException.fromDioError(e);
    }
  }
}

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(ref.watch(dioProvider));
});
