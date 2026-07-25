import 'package:flutter_test/flutter_test.dart';
import 'package:billing_mobile/data/models/invoices_models.dart';

void main() {
  group('Invoices Model JSON Mappings Tests', () {
    test('InvoiceLine model parsing', () {
      final json = {
        'itemId': 'item-uuid-123',
        'description': 'Laptop Dell XPS 15',
        'hsnSac': '84713010',
        'unit': 'NOS',
        'qty': 2,
        'rate': 120000.0,
        'discount': 5.0,
        'gstRate': 18,
        'godownId': 'godown-uuid-789'
      };

      final line = InvoiceLine.fromJson(json);

      expect(line.itemId, 'item-uuid-123');
      expect(line.qty, 2);
      expect(line.rate, 120000.0);
      expect(line.discount, 5.0);
      expect(line.gstRate, 18.0);
      expect(line.godownId, 'godown-uuid-789');
    });

    test('InvoicePayment model parsing', () {
      final json = {
        'id': 'payment-uuid-111',
        'mode': 'UPI',
        'amount': '25000.00',
        'upiRefId': 'UPI1234567890',
        'cardLast4': null,
        'notes': 'Advance payment',
        'createdAt': '2026-07-25T12:00:00Z'
      };

      final payment = InvoicePayment.fromJson(json);

      expect(payment.id, 'payment-uuid-111');
      expect(payment.mode, 'UPI');
      expect(payment.amount, 25000.0);
      expect(payment.upiRefId, 'UPI1234567890');
      expect(payment.notes, 'Advance payment');
    });

    test('Invoice model full parsing', () {
      final json = {
        'id': 'invoice-uuid-999',
        'invoiceNumber': 'INV-2026-001',
        'partyId': 'party-uuid-777',
        'partyName': 'Ramesh Kumar',
        'partyPhone': '9999988888',
        'partyAddress': '123 Main Street',
        'partyGstin': '29ABCDE1234F1Z5',
        'partyStateCode': '29',
        'partyExternalId': 'CUST-001',
        'referredBy': 'Self',
        'placeOfSupply': '29',
        'supplyType': 'B2C',
        'reverseCharge': false,
        'invoiceDate': '2026-07-25',
        'dueDate': '2026-08-01',
        'notes': 'Deliver before 5 PM',
        'discountAmount': 5000.0,
        'totalAmount': 240000.0,
        'taxAmount': 43200.0,
        'grandTotal': 278200.0,
        'amountPaid': 50000.0,
        'balanceDue': 228200.0,
        'status': 'FINALIZED',
        'paymentStatus': 'PARTIAL',
        'documentType': 'TAX_INVOICE',
        'lines': [
          {
            'itemId': 'item-uuid-123',
            'description': 'Laptop Dell XPS 15',
            'qty': 2,
            'rate': 120000,
            'discount': 0,
            'gstRate': 18
          }
        ],
        'payments': [
          {
            'id': 'pay-1',
            'mode': 'CASH',
            'amount': 50000,
            'createdAt': '2026-07-25T12:00:00Z'
          }
        ],
        'createdAt': '2026-07-25T10:00:00Z',
        'updatedAt': '2026-07-25T10:30:00Z'
      };

      final invoice = Invoice.fromJson(json);

      expect(invoice.id, 'invoice-uuid-999');
      expect(invoice.invoiceNumber, 'INV-2026-001');
      expect(invoice.partyName, 'Ramesh Kumar');
      expect(invoice.discountAmount, 5000.0);
      expect(invoice.grandTotal, 278200.0);
      expect(invoice.balanceDue, 228200.0);
      expect(invoice.status, 'FINALIZED');
      expect(invoice.lines.length, 1);
      expect(invoice.lines[0].description, 'Laptop Dell XPS 15');
      expect(invoice.payments.length, 1);
      expect(invoice.payments[0].amount, 50000.0);
    });
  });
}
