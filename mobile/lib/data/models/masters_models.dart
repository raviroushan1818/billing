import '../../core/utils/money_utils.dart';

class Party {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final String? city;
  final String? state;
  final String? stateCode;
  final String? pincode;
  final String? gstin;
  final String? externalId;
  final String? referredBy;
  final Map<String, dynamic>? customFields;
  final bool isActive;

  Party({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.address,
    this.city,
    this.state,
    this.stateCode,
    this.pincode,
    this.gstin,
    this.externalId,
    this.referredBy,
    this.customFields,
    required this.isActive,
  });

  factory Party.fromJson(Map<String, dynamic> json) {
    return Party(
      id: json['id'] as String,
      name: json['name'] as String,
      phone: json['phone'] as String?,
      email: json['email'] as String?,
      address: json['address'] as String?,
      city: json['city'] as String?,
      state: json['state'] as String?,
      stateCode: json['stateCode'] as String?,
      pincode: json['pincode'] as String?,
      gstin: json['gstin'] as String?,
      externalId: json['externalId'] as String?,
      referredBy: json['referredBy'] as String?,
      customFields: json['customFields'] as Map<String, dynamic>?,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'address': address,
      'city': city,
      'state': state,
      'stateCode': stateCode,
      'pincode': pincode,
      'gstin': gstin,
      'externalId': externalId,
      'referredBy': referredBy,
      'customFields': customFields,
      'isActive': isActive,
    };
  }
}

class Item {
  final String id;
  final String name;
  final String? description;
  final String? hsnSac;
  final String? unit;
  final double rate;
  final double gstRate;
  final String? barcode;
  final bool trackStock;
  final double stockQty;
  final bool isActive;

  Item({
    required this.id,
    required this.name,
    this.description,
    this.hsnSac,
    this.unit,
    required this.rate,
    required this.gstRate,
    this.barcode,
    required this.trackStock,
    required this.stockQty,
    required this.isActive,
  });

  factory Item.fromJson(Map<String, dynamic> json) {
    return Item(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      hsnSac: json['hsnSac'] as String?,
      unit: json['unit'] as String?,
      rate: MoneyUtils.parse(json['rate']),
      gstRate: MoneyUtils.parse(json['gstRate'] ?? 0),
      barcode: json['barcode'] as String?,
      trackStock: json['trackStock'] as bool? ?? false,
      stockQty: MoneyUtils.parse(json['stockQty'] ?? 0),
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'hsnSac': hsnSac,
      'unit': unit,
      'rate': rate,
      'gstRate': gstRate,
      'barcode': barcode,
      'trackStock': trackStock,
      'stockQty': stockQty,
      'isActive': isActive,
    };
  }
}

class Godown {
  final String id;
  final String name;
  final String? code;
  final String? address;
  final bool isDefault;
  final bool isActive;

  Godown({
    required this.id,
    required this.name,
    this.code,
    this.address,
    required this.isDefault,
    required this.isActive,
  });

  factory Godown.fromJson(Map<String, dynamic> json) {
    return Godown(
      id: json['id'] as String,
      name: json['name'] as String,
      code: json['code'] as String?,
      address: json['address'] as String?,
      isDefault: json['isDefault'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'code': code,
      'address': address,
      'isDefault': isDefault,
      'isActive': isActive,
    };
  }
}

class StockLevel {
  final String itemId;
  final String godownId;
  final double qty;
  final Item? item;
  final Godown? godown;

  StockLevel({
    required this.itemId,
    required this.godownId,
    required this.qty,
    this.item,
    this.godown,
  });

  factory StockLevel.fromJson(Map<String, dynamic> json) {
    return StockLevel(
      itemId: json['itemId'] as String,
      godownId: json['godownId'] as String,
      qty: MoneyUtils.parse(json['qty']),
      item: json['item'] != null ? Item.fromJson(json['item'] as Map<String, dynamic>) : null,
      godown: json['godown'] != null ? Godown.fromJson(json['godown'] as Map<String, dynamic>) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'itemId': itemId,
      'godownId': godownId,
      'qty': qty,
      'item': item?.toJson(),
      'godown': godown?.toJson(),
    };
  }
}

class StockMovement {
  final String id;
  final String itemId;
  final double qtyDelta;
  final String? note;
  final String createdAt;
  final String? userFullName;

  StockMovement({
    required this.id,
    required this.itemId,
    required this.qtyDelta,
    this.note,
    required this.createdAt,
    this.userFullName,
  });

  factory StockMovement.fromJson(Map<String, dynamic> json) {
    return StockMovement(
      id: json['id'] as String,
      itemId: json['itemId'] as String,
      qtyDelta: MoneyUtils.parse(json['qtyDelta']),
      note: json['note'] as String?,
      createdAt: json['createdAt'] as String,
      userFullName: json['user'] != null 
          ? '${json['user']['firstName'] ?? ''} ${json['user']['lastName'] ?? ''}'.trim()
          : null,
    );
  }
}
