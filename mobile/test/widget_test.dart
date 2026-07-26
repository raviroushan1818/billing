import 'package:flutter_test/flutter_test.dart';
import 'package:billing_mobile/core/utils/money_utils.dart';
import 'package:billing_mobile/data/models/auth_models.dart';

void main() {
  group('MoneyUtils Tests', () {
    test('Should parse numeric values safely', () {
      expect(MoneyUtils.parse(10.5), 10.5);
      expect(MoneyUtils.parse(42), 42.0);
      expect(MoneyUtils.parse(null), 0.0);
    });

    test('Should parse string representation of decimals safely', () {
      expect(MoneyUtils.parse('100.99'), 100.99);
      expect(MoneyUtils.parse('invalid'), 0.0);
    });

    test('Should format currency to Indian standard (en_IN)', () {
      // Note: non-breaking spaces or simple spaces might depend on platform, 
      // but let's assert the primary format features.
      final formatted = MoneyUtils.format(123456.78);
      expect(formatted, contains('1,23,456.78'));
      expect(formatted, contains('₹'));
    });
  });

  group('Auth Model JSON Parsing Tests', () {
    test('User should parse correctly from map', () {
      final json = {
        'id': 'user-123',
        'email': 'operator@test.com',
        'firstName': 'John',
        'lastName': 'Doe',
        'role': 'BILLING_OPERATOR',
        'tenantId': 'tenant-789',
        'clientId': 'MYSHOP123',
        'tenantName': 'My Sweet Shop',
        'profileType': 'RETAIL',
      };

      final user = User.fromJson(json);

      expect(user.id, 'user-123');
      expect(user.fullName, 'John Doe');
      expect(user.role, 'BILLING_OPERATOR');
      expect(user.tenantName, 'My Sweet Shop');
    });

    test('Tenant and Config should parse correctly from map', () {
      final json = {
        'id': 'tenant-789',
        'name': 'My Sweet Shop',
        'clientId': 'MYSHOP123',
        'status': 'ACTIVE',
        'planCode': 'ENTERPRISE',
        'profileConfig': {
          'invoiceTitle': 'Tax Invoice',
          'partyLabel': 'Customer',
          'partyIdLabel': 'Mobile Number',
        }
      };

      final tenant = Tenant.fromJson(json);

      expect(tenant.id, 'tenant-789');
      expect(tenant.status, 'ACTIVE');
      expect(tenant.isActive, true);
      expect(tenant.planCode, 'ENTERPRISE');
      expect(tenant.profileConfig?.partyLabel, 'Customer');
    });

    test('Tenant should accept legacy isActive and production status', () {
      final legacy = Tenant.fromJson({
        'id': 't1',
        'name': 'Shop',
        'clientId': 'SHOP1',
        'isActive': false,
      });
      expect(legacy.status, 'SUSPENDED');
      expect(legacy.isActive, false);

      final suspended = Tenant.fromJson({
        'id': 't2',
        'name': 'Shop',
        'clientId': 'SHOP2',
        'status': 'SUSPENDED',
      });
      expect(suspended.isActive, false);
    });
  });
}
