import 'package:flutter_test/flutter_test.dart';
import 'package:billing_mobile/data/models/ops_models.dart';

void main() {
  group('Operations Model JSON Mappings Tests', () {
    test('PurchaseLine model parsing', () {
      final json = {
        'itemId': 'item-uuid-222',
        'description': 'Office Stationary',
        'hsnSac': '998311',
        'unit': 'NOS',
        'qty': '10.0',
        'rate': '150.00',
        'gstRate': 18
      };

      final line = PurchaseLine.fromJson(json);

      expect(line.itemId, 'item-uuid-222');
      expect(line.qty, 10.0);
      expect(line.rate, 150.0);
      expect(line.gstRate, 18.0);
    });

    test('Purchase model full parsing', () {
      final json = {
        'id': 'purchase-uuid-333',
        'billNo': 'BILL-999-XYZ',
        'vendorId': 'party-uuid-888',
        'vendorName': 'Sharma Stationery Wholesalers',
        'vendorGstin': '29ABCDE1234F1Z5',
        'vendorPhone': '9876543210',
        'godownId': 'godown-uuid-777',
        'billDate': '2026-07-25',
        'notes': 'Recorded in main office',
        'interstate': false,
        'status': 'FINALIZED',
        'totalAmount': '1500.00',
        'taxAmount': '270.00',
        'grandTotal': '1770.00',
        'lines': [
          {
            'itemId': 'item-uuid-222',
            'description': 'Office Stationary',
            'qty': 10,
            'rate': 150,
            'gstRate': 18
          }
        ]
      };

      final purchase = Purchase.fromJson(json);

      expect(purchase.id, 'purchase-uuid-333');
      expect(purchase.billNo, 'BILL-999-XYZ');
      expect(purchase.vendorName, 'Sharma Stationery Wholesalers');
      expect(purchase.totalAmount, 1500.0);
      expect(purchase.grandTotal, 1770.0);
      expect(purchase.lines.length, 1);
      expect(purchase.lines[0].description, 'Office Stationary');
    });

    test('EwayBill model parsing', () {
      final json = {
        'id': 'eway-uuid-444',
        'ewayBillNo': '123456789012',
        'invoiceId': 'invoice-uuid-999',
        'fromPlace': 'Whitefield',
        'toPlace': 'Indiranagar',
        'transporterName': 'Blue Dart Express',
        'transporterId': 'LND-99',
        'vehicleNo': 'KA53M1234',
        'distanceKm': 15,
        'documentValue': '54000.00',
        'status': 'ACTIVE',
        'cancelReason': null,
        'createdAt': '2026-07-25T12:00:00Z',
        'invoice': {
          'invoiceNumber': 'INV-2026-001'
        }
      };

      final eway = EwayBill.fromJson(json);

      expect(eway.id, 'eway-uuid-444');
      expect(eway.ewayBillNo, '123456789012');
      expect(eway.transporterName, 'Blue Dart Express');
      expect(eway.vehicleNo, 'KA53M1234');
      expect(eway.distanceKm, 15);
      expect(eway.documentValue, 54000.0);
      expect(eway.status, 'ACTIVE');
      expect(eway.invoiceNo, 'INV-2026-001');
    });

    test('NoteItem model parsing', () {
      final json = {
        'id': 'note-uuid-555',
        'title': 'Call Ravi back',
        'body': 'Discuss pricing options for wholesale laptops',
        'partyId': 'party-uuid-777',
        'invoiceId': null,
        'pinned': true,
        'remindAt': '2026-07-26T10:00:00Z',
        'createdAt': '2026-07-25T12:00:00Z',
        'party': {
          'name': 'Ramesh Kumar'
        }
      };

      final note = NoteItem.fromJson(json);

      expect(note.id, 'note-uuid-555');
      expect(note.title, 'Call Ravi back');
      expect(note.pinned, true);
      expect(note.partyName, 'Ramesh Kumar');
      expect(note.invoiceNumber, null);
    });
  });
}
