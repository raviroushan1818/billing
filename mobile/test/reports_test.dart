import 'package:flutter_test/flutter_test.dart';
import 'package:billing_mobile/data/models/reports_models.dart';

void main() {
  group('Reports & Ageing Model Parsing Tests', () {
    test('ReceivableRow model parsing', () {
      final json = {
        'id': 'invoice-uuid-001',
        'billNo': 'INV-2026-101',
        'partyName': 'Swathi Chemicals',
        'partyPhone': '9845012345',
        'invoiceDate': '2026-07-01',
        'dueDate': '2026-07-15',
        'grandTotal': '45000.00',
        'amountPaid': '15000.00',
        'balanceDue': '30000.00',
        'paymentStatus': 'PARTIAL',
        'daysPastDue': 10,
        'bucket': '1-30'
      };

      final row = ReceivableRow.fromJson(json);

      expect(row.id, 'invoice-uuid-001');
      expect(row.billNo, 'INV-2026-101');
      expect(row.partyName, 'Swathi Chemicals');
      expect(row.grandTotal, 45000.0);
      expect(row.amountPaid, 15000.0);
      expect(row.balanceDue, 30000.0);
      expect(row.daysPastDue, 10);
      expect(row.bucket, '1-30');
    });

    test('ReceivablesSummary and full response parsing', () {
      final json = {
        'rows': [
          {
            'id': 'invoice-uuid-001',
            'billNo': 'INV-2026-101',
            'partyName': 'Swathi Chemicals',
            'invoiceDate': '2026-07-01',
            'dueDate': '2026-07-15',
            'grandTotal': 45000,
            'amountPaid': 15000,
            'balanceDue': 30000,
            'paymentStatus': 'PARTIAL',
            'daysPastDue': 10,
            'bucket': '1-30'
          }
        ],
        'summary': {
          'totalDue': '30000.00',
          'count': 1,
          'byBucket': {
            'current': 0,
            '1-30': '30000.00',
            '31-60': 0,
            '61-90': 0,
            '90+': 0
          }
        }
      };

      final response = ReceivablesResponse.fromJson(json);

      expect(response.rows.length, 1);
      expect(response.rows[0].partyName, 'Swathi Chemicals');
      expect(response.summary.totalDue, 30000.0);
      expect(response.summary.count, 1);
      expect(response.summary.byBucket['1-30'], 30000.0);
      expect(response.summary.byBucket['current'], 0.0);
    });
  });
}
