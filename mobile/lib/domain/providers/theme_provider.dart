import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/services/secure_storage_service.dart';

class ThemeSettingsState {
  final ThemeMode mode;
  final Color accentColor;
  final String accentName;

  ThemeSettingsState({
    required this.mode,
    required this.accentColor,
    required this.accentName,
  });

  ThemeSettingsState copyWith({
    ThemeMode? mode,
    Color? accentColor,
    String? accentName,
  }) {
    return ThemeSettingsState(
      mode: mode ?? this.mode,
      accentColor: accentColor ?? this.accentColor,
      accentName: accentName ?? this.accentName,
    );
  }
}

class ThemeSettingsNotifier extends StateNotifier<ThemeSettingsState> {
  final SecureStorageService _secureStorage;

  static const _themeModeKey = 'setting_theme_mode';
  static const _accentNameKey = 'setting_accent_name';

  static const Map<String, Color> accents = {
    'indigo': Color(0xFF6366F1),
    'maroon': Color(0xFF580C25), // Web brand crimson/maroon
    'emerald': Color(0xFF0F766E),
    'crimson': Color(0xFFBE123C),
    'orange': Color(0xFFC2410C),
  };

  ThemeSettingsNotifier(this._secureStorage)
      : super(ThemeSettingsState(
          mode: ThemeMode.system,
          accentColor: const Color(0xFF6366F1),
          accentName: 'indigo',
        )) {
    loadSettings();
  }

  Future<void> loadSettings() async {
    try {
      final modeStr = await _secureStorage.readSetting(_themeModeKey);
      final accentStr = await _secureStorage.readSetting(_accentNameKey);

      ThemeMode mode = ThemeMode.system;
      if (modeStr == 'light') mode = ThemeMode.light;
      if (modeStr == 'dark') mode = ThemeMode.dark;

      Color color = accents['indigo']!;
      String name = 'indigo';
      if (accentStr != null && accents.containsKey(accentStr)) {
        color = accents[accentStr]!;
        name = accentStr;
      }

      state = ThemeSettingsState(mode: mode, accentColor: color, accentName: name);
    } catch (_) {
      // Fallback to default
    }
  }

  Future<void> updateThemeMode(ThemeMode mode) async {
    state = state.copyWith(mode: mode);
    String modeStr = 'system';
    if (mode == ThemeMode.light) modeStr = 'light';
    if (mode == ThemeMode.dark) modeStr = 'dark';
    await _secureStorage.writeSetting(_themeModeKey, modeStr);
  }

  Future<void> updateAccentColor(String name) async {
    if (accents.containsKey(name)) {
      state = state.copyWith(accentColor: accents[name]!, accentName: name);
      await _secureStorage.writeSetting(_accentNameKey, name);
    }
  }
}

final themeSettingsProvider = StateNotifierProvider<ThemeSettingsNotifier, ThemeSettingsState>((ref) {
  return ThemeSettingsNotifier(ref.watch(secureStorageProvider));
});
