class EnvConfig {
  static const String apiBase = String.fromEnvironment(
    'API_BASE',
    defaultValue: 'https://billing.indiansoftwareservices.com/api',
  );

  static const String appName = 'Indian Softwares Services';
}
