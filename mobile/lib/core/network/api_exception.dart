import 'package:dio/dio.dart';

class ApiException implements Exception {
  final int? statusCode;
  final String message;
  final String? error;

  ApiException({
    this.statusCode,
    required this.message,
    this.error,
  });

  factory ApiException.fromDioError(DioException dioError) {
    int? statusCode = dioError.response?.statusCode;
    String message = 'Something went wrong';
    String? error;

    if (dioError.type == DioExceptionType.connectionTimeout ||
        dioError.type == DioExceptionType.receiveTimeout ||
        dioError.type == DioExceptionType.sendTimeout) {
      message = 'Connection timed out. Please check your internet connection.';
    } else if (dioError.type == DioExceptionType.connectionError) {
      message = 'Cannot connect to server. Please verify your network connection.';
    } else if (dioError.response?.data != null) {
      final data = dioError.response!.data;
      if (data is Map<String, dynamic>) {
        final rawMessage = data['message'];
        if (rawMessage is List) {
          message = rawMessage.join('\n');
        } else if (rawMessage is String) {
          message = rawMessage;
        } else {
          message = data['error']?.toString() ?? 'Server error';
        }
        error = data['error']?.toString();
      }
    } else {
      message = dioError.message ?? 'An unknown network error occurred';
    }

    return ApiException(
      statusCode: statusCode,
      message: message,
      error: error,
    );
  }

  @override
  String toString() => message;
}
