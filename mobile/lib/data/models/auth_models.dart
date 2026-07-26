class User {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String role;
  final String tenantId;
  final String clientId;
  final String tenantName;
  final String? profileType;

  User({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.role,
    required this.tenantId,
    required this.clientId,
    required this.tenantName,
    this.profileType,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      email: json['email'] as String,
      firstName: json['firstName'] as String,
      lastName: json['lastName'] as String,
      role: json['role'] as String,
      tenantId: json['tenantId'] as String,
      clientId: json['clientId'] as String,
      tenantName: json['tenantName'] as String,
      profileType: json['profileType'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'role': role,
      'tenantId': tenantId,
      'clientId': clientId,
      'tenantName': tenantName,
      'profileType': profileType,
    };
  }

  String get fullName => '$firstName $lastName'.trim();
}

class LoginResponse {
  final String accessToken;
  final User user;

  LoginResponse({
    required this.accessToken,
    required this.user,
  });

  factory LoginResponse.fromJson(Map<String, dynamic> json) {
    return LoginResponse(
      accessToken: json['accessToken'] as String,
      user: User.fromJson(json['user'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'accessToken': accessToken,
      'user': user.toJson(),
    };
  }
}

class TenantProfileConfig {
  final String? invoiceTitle;
  final String? partyLabel;
  final String? partyIdLabel;
  final Map<String, dynamic>? customFieldSchema;

  TenantProfileConfig({
    this.invoiceTitle,
    this.partyLabel,
    this.partyIdLabel,
    this.customFieldSchema,
  });

  factory TenantProfileConfig.fromJson(Map<String, dynamic> json) {
    return TenantProfileConfig(
      invoiceTitle: json['invoiceTitle'] as String?,
      partyLabel: json['partyLabel'] as String?,
      partyIdLabel: json['partyIdLabel'] as String?,
      customFieldSchema: json['customFieldSchema'] as Map<String, dynamic>?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'invoiceTitle': invoiceTitle,
      'partyLabel': partyLabel,
      'partyIdLabel': partyIdLabel,
      'customFieldSchema': customFieldSchema,
    };
  }
}

class Tenant {
  final String id;
  final String name;
  final String clientId;
  final String status;
  final String? planCode;
  final TenantProfileConfig? profileConfig;

  Tenant({
    required this.id,
    required this.name,
    required this.clientId,
    required this.status,
    this.planCode,
    this.profileConfig,
  });

  /// ACTIVE / TRIAL tenants are considered active; SUSPENDED (and unknown) are not.
  bool get isActive => status == 'ACTIVE' || status == 'TRIAL';

  factory Tenant.fromJson(Map<String, dynamic> json) {
    // Production API returns Prisma `status` (ACTIVE|TRIAL|SUSPENDED).
    // Accept legacy `isActive` bool for older fixtures/tests.
    final rawStatus = json['status'] as String?;
    final legacyActive = json['isActive'] as bool?;
    final status = rawStatus ??
        (legacyActive == null
            ? 'ACTIVE'
            : (legacyActive ? 'ACTIVE' : 'SUSPENDED'));

    return Tenant(
      id: json['id'] as String,
      name: json['name'] as String,
      clientId: json['clientId'] as String,
      status: status,
      planCode: json['planCode'] as String?,
      profileConfig: json['profileConfig'] != null
          ? TenantProfileConfig.fromJson(json['profileConfig'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'clientId': clientId,
      'status': status,
      'planCode': planCode,
      'profileConfig': profileConfig?.toJson(),
    };
  }
}
