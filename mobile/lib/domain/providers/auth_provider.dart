import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/auth_models.dart';
import '../../data/repositories/auth_repository.dart';
import '../../data/services/secure_storage_service.dart';
import 'auth_events.dart';

enum AuthStatus { initial, authenticated, unauthenticated }

class AuthState {
  final AuthStatus status;
  final User? user;
  final Tenant? tenant;
  final Map<String, bool>? features;
  final TenantProfileConfig? profileConfig;
  final Map<String, dynamic>? subscription;
  final bool isLoading;
  final String? error;

  AuthState({
    this.status = AuthStatus.initial,
    this.user,
    this.tenant,
    this.features,
    this.profileConfig,
    this.subscription,
    this.isLoading = false,
    this.error,
  });

  AuthState copyWith({
    AuthStatus? status,
    User? user,
    Tenant? tenant,
    Map<String, bool>? features,
    TenantProfileConfig? profileConfig,
    Map<String, dynamic>? subscription,
    bool? isLoading,
    String? error,
  }) {
    return AuthState(
      status: status ?? this.status,
      user: user ?? this.user,
      tenant: tenant ?? this.tenant,
      features: features ?? this.features,
      profileConfig: profileConfig ?? this.profileConfig,
      subscription: subscription ?? this.subscription,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class AuthNotifier extends StateNotifier<AuthState> {
  final AuthRepository _repository;
  final SecureStorageService _secureStorage;

  AuthNotifier(this._repository, this._secureStorage, Ref ref) : super(AuthState()) {
    initialize();
    
    // Listen to 401 unauthenticated logout broadcast stream events
    ref.read(authLogoutEventProvider).stream.listen((_) {
      clearAuth();
    });
  }

  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);
    try {
      final token = await _secureStorage.getToken();
      final userJson = await _secureStorage.getUserJson();

      if (token != null && userJson != null) {
        final cachedUser = User.fromJson(jsonDecode(userJson) as Map<String, dynamic>);
        state = state.copyWith(
          status: AuthStatus.authenticated,
          user: cachedUser,
        );
        // Refresh session & configurations in parallel
        await _fetchAppConfigs();
      } else {
        state = state.copyWith(status: AuthStatus.unauthenticated, isLoading: false);
      }
    } catch (e) {
      // In case of error (e.g. token expired, network offline), fallback or logout
      state = state.copyWith(status: AuthStatus.unauthenticated, isLoading: false);
    }
  }

  Future<void> _fetchAppConfigs() async {
    try {
      final results = await Future.wait([
        _repository.getMe(),
        _repository.getTenantMe(),
        _repository.getBillingFeatures(),
        _repository.getProfileConfig(),
        _repository.getBillingSubscription(),
      ]);

      final user = results[0] as User;
      final tenant = results[1] as Tenant;
      final features = results[2] as Map<String, bool>;
      final profileConfig = results[3] as TenantProfileConfig;
      final subscription = results[4] as Map<String, dynamic>;

      await _secureStorage.saveUserJson(jsonEncode(user.toJson()));

      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: user,
        tenant: tenant,
        features: features,
        profileConfig: profileConfig,
        subscription: subscription,
        isLoading: false,
        error: null,
      );
    } catch (e) {
      // If server returns error, we keep cached user data but stop loading
      state = state.copyWith(isLoading: false);
    }
  }

  Future<bool> login({
    required String clientId,
    required String email,
    required String password,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final response = await _repository.login(
        clientId: clientId,
        email: email,
        password: password,
      );

      await _secureStorage.saveToken(response.accessToken);
      await _secureStorage.saveUserJson(jsonEncode(response.user.toJson()));

      state = state.copyWith(
        status: AuthStatus.authenticated,
        user: response.user,
      );

      // Fetch all required data in parallel
      await _fetchAppConfigs();
      return true;
    } catch (e) {
      state = state.copyWith(
        status: AuthStatus.unauthenticated,
        isLoading: false,
        error: e.toString(),
      );
      return false;
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await _secureStorage.clearAll();
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  void clearAuth() {
    state = AuthState(status: AuthStatus.unauthenticated);
  }

  Future<bool> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      await _repository.changePassword(
        currentPassword: currentPassword,
        newPassword: newPassword,
      );
      state = state.copyWith(isLoading: false);
      return true;
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
      return false;
    }
  }
}

final authProvider = StateNotifierProvider<AuthNotifier, AuthState>((Ref ref) {
  final repository = ref.watch(authRepositoryProvider);
  final secureStorage = ref.watch(secureStorageProvider);
  return AuthNotifier(repository, secureStorage, ref);
});

// Selector for features to easily inject or watch
final featuresProvider = Provider<Map<String, bool>?>((Ref ref) {
  return ref.watch(authProvider.select((state) => state.features));
});

// Selector for labels / profile settings
final profileConfigProvider = Provider<TenantProfileConfig?>((Ref ref) {
  return ref.watch(authProvider.select((state) => state.profileConfig));
});
