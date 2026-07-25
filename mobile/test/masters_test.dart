import 'package:flutter_test/flutter_test.dart';
import 'package:billing_mobile/data/models/masters_models.dart';

void main() {
  group('Masters Model Parsing Tests', () {
    test('Party model JSON deserialization', () {
      final json = {
        'id': 'party-uuid-123',
        'name': 'Ravi Enterprises',
        'phone': '9876543210',
        'email': 'ravi@enterprises.com',
        'address': 'MG Road, 4th Block',
        'city': 'Bangalore',
        'state': 'Karnataka',
        'stateCode': '29',
        'pincode': '560001',
        'gstin': '29ABCDE1234F1Z5',
        'externalId': 'EXT-999',
        'referredBy': 'Self',
        'customFields': {'notes': 'Premium client'},
        'isActive': true,
      };

      final party = Party.fromJson(json);

      expect(party.id, 'party-uuid-123');
      expect(party.name, 'Ravi Enterprises');
      expect(party.phone, '9876543210');
      expect(party.gstin, '29ABCDE1234F1Z5');
      expect(party.customFields?['notes'], 'Premium client');
      expect(party.isActive, true);
    });

    test('Item model JSON deserialization', () {
      final json = {
        'id': 'item-uuid-456',
        'name': 'Laptop Dell XPS 13',
        'description': 'Core i7, 16GB RAM, 512GB SSD',
        'hsnSac': '84713010',
        'unit': 'NOS',
        'rate': '95000.00', // String Prisma decimal representation
        'gstRate': 18,      // Numeric value representation
        'barcode': 'DELLXPS13999',
        'trackStock': true,
        'stockQty': '24.5', // String Prisma decimal representation
        'isActive': true,
      };

      final item = Item.fromJson(json);

      expect(item.id, 'item-uuid-456');
      expect(item.name, 'Laptop Dell XPS 13');
      expect(item.rate, 95000.0);
      expect(item.gstRate, 18.0);
      expect(item.trackStock, true);
      expect(item.stockQty, 24.5);
    });

    test('Godown model JSON deserialization', () {
      final json = {
        'id': 'godown-uuid-789',
        'name': 'Main Warehouse Whitefield',
        'code': 'WH-WF',
        'address': 'Plot 42, Export Promotion Industrial Park',
        'isDefault': true,
        'isActive': true,
      };

      final godown = Godown.fromJson(json);

      expect(godown.id, 'godown-uuid-789');
      expect(godown.name, 'Main Warehouse Whitefield');
      expect(godown.code, 'WH-WF');
      expect(godown.isDefault, true);
      expect(godown.isActive, true);
    });

    test('StockLevel model JSON deserialization', () {
      final json = {
        'itemId': 'item-uuid-456',
        'godownId': 'godown-uuid-789',
        'qty': '15.00',
        'item': {
          'id': 'item-uuid-456',
          'name': 'Laptop Dell XPS 13',
          'rate': 95000,
          'gstRate': 18,
          'trackStock': true,
          'stockQty': 15,
          'isActive': true,
        },
        'godown': {
          'id': 'godown-uuid-789',
          'name': 'Main Warehouse Whitefield',
          'isDefault': true,
          'isActive': true,
        }
      };

      final stock = StockLevel.fromJson(json);

      expect(stock.itemId, 'item-uuid-456');
      expect(stock.godownId, 'godown-uuid-789');
      expect(stock.qty, 15.0);
      expect(stock.item?.name, 'Laptop Dell XPS 13');
      expect(stock.godown?.name, 'Main Warehouse Whitefield');
    });
  });
}
