import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import '../config/env_config.dart';
import '../../data/services/secure_storage_service.dart';
import '../../domain/providers/auth_events.dart';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: EnvConfig.apiBase,
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 15),
    sendTimeout: const Duration(seconds: 15),
    headers: {
      'Content-Type': 'application/json',
    },
  ));

  final secureStorage = ref.watch(secureStorageProvider);

  // Authenticating Interceptor Wrapper
  dio.interceptors.add(QueuedInterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await secureStorage.getToken();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
      return handler.next(options);
    },
    onError: (DioException e, handler) async {
      if (e.response?.statusCode == 401) {
        // Clear tokens from secure storage
        await secureStorage.clearAll();
        // Trigger auth logout stream event (breaks circular imports/type inference loops)
        ref.read(authLogoutEventProvider).add(null);
      }
      return handler.next(e);
    },
  ));

  // Hardening: Connection Retry Interceptor for GET operations
  dio.interceptors.add(InterceptorsWrapper(
    onError: (DioException err, handler) async {
      final isGet = err.requestOptions.method.toUpperCase() == 'GET';
      final isTimeoutOrConnection = err.type == DioExceptionType.connectionTimeout ||
          err.type == DioExceptionType.receiveTimeout ||
          err.type == DioExceptionType.connectionError;

      // Retry up to 2 times for transient GET requests
      final currentRetry = err.requestOptions.extra['retries'] as int? ?? 0;
      if (isGet && isTimeoutOrConnection && currentRetry < 2) {
        final options = err.requestOptions;
        options.extra['retries'] = currentRetry + 1;
        
        // Wait 1 second before retrying
        await Future.delayed(const Duration(seconds: 1));
        
        try {
          final response = await dio.fetch(options);
          return handler.resolve(response);
        } on DioException catch (retryErr) {
          return handler.next(retryErr);
        }
      }
      return handler.next(err);
    },
  ));

  if (kDebugMode) {
    dio.interceptors.add(LogInterceptor(
      requestBody: true,
      responseBody: true,
    ));
  }

  return dio;
});
