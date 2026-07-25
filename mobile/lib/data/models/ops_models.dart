import '../../core/utils/money_utils.dart';

class PurchaseLine {
  final String? itemId;
  final String description;
  final String? hsnSac;
  final String? unit;
  final double qty;
  final double rate;
  final double gstRate;

  PurchaseLine({
    this.itemId,
    required this.description,
    this.hsnSac,
    this.unit,
    required this.qty,
    required this.rate,
    this.gstRate = 18,
  });

  factory PurchaseLine.fromJson(Map<String, dynamic> json) {
    return PurchaseLine(
      itemId: json['itemId'] as String?,
      description: json['description'] as String,
      hsnSac: json['hsnSac'] as String?,
      unit: json['unit'] as String?,
      qty: MoneyUtils.parse(json['qty']),
      rate: MoneyUtils.parse(json['rate']),
      gstRate: MoneyUtils.parse(json['gstRate'] ?? 18),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'itemId': itemId,
      'description': description,
      'hsnSac': hsnSac,
      'unit': unit,
      'qty': qty,
      'rate': rate,
      'gstRate': gstRate,
    };
  }
}

class Purchase {
  final String id;
  final String billNo;
  final String? vendorId;
  final String vendorName;
  final String? vendorGstin;
  final String? vendorPhone;
  final String? godownId;
  final String billDate;
  final String? notes;
  final bool interstate;
  final String status; // DRAFT | FINALIZED | VOID
  final double totalAmount;
  final double taxAmount;
  final double grandTotal;
  final List<PurchaseLine> lines;

  Purchase({
    required this.id,
    required this.billNo,
    this.vendorId,
    required this.vendorName,
    this.vendorGstin,
    this.vendorPhone,
    this.godownId,
    required this.billDate,
    this.notes,
    required this.interstate,
    required this.status,
    required this.totalAmount,
    required this.taxAmount,
    required this.grandTotal,
    required this.lines,
  });

  factory Purchase.fromJson(Map<String, dynamic> json) {
    return Purchase(
      id: json['id'] as String,
      billNo: json['billNo'] as String? ?? json['billNumber'] as String? ?? '',
      vendorId: json['vendorId'] as String?,
      vendorName: json['vendorName'] as String,
      vendorGstin: json['vendorGstin'] as String?,
      vendorPhone: json['vendorPhone'] as String?,
      godownId: json['godownId'] as String?,
      billDate: json['billDate'] as String,
      notes: json['notes'] as String?,
      interstate: json['interstate'] as bool? ?? false,
      status: json['status'] as String? ?? 'FINALIZED',
      totalAmount: MoneyUtils.parse(json['totalAmount']),
      taxAmount: MoneyUtils.parse(json['taxAmount']),
      grandTotal: MoneyUtils.parse(json['grandTotal']),
      lines: (json['lines'] as List? ?? [])
          .map((e) => PurchaseLine.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'billNo': billNo,
      'vendorId': vendorId,
      'vendorName': vendorName,
      'vendorGstin': vendorGstin,
      'vendorPhone': vendorPhone,
      'godownId': godownId,
      'billDate': billDate,
      'notes': notes,
      'interstate': interstate,
      'status': status,
      'totalAmount': totalAmount,
      'taxAmount': taxAmount,
      'grandTotal': grandTotal,
      'lines': lines.map((e) => e.toJson()).toList(),
    };
  }
}

class EwayBill {
  final String id;
  final String? ewayBillNo;
  final String invoiceId;
  final String? invoiceNo;
  final String? fromPlace;
  final String? toPlace;
  final String? transporterName;
  final String? transporterId;
  final String? vehicleNo;
  final int? distanceKm;
  final double documentValue;
  final String status; // ACTIVE | CANCELLED
  final String? cancelReason;
  final String createdAt;

  EwayBill({
    required this.id,
    this.ewayBillNo,
    required this.invoiceId,
    this.invoiceNo,
    this.fromPlace,
    this.toPlace,
    this.transporterName,
    this.transporterId,
    this.vehicleNo,
    this.distanceKm,
    required this.documentValue,
    required this.status,
    this.cancelReason,
    required this.createdAt,
  });

  factory EwayBill.fromJson(Map<String, dynamic> json) {
    return EwayBill(
      id: json['id'] as String,
      ewayBillNo: json['ewayBillNo'] as String?,
      invoiceId: json['invoiceId'] as String,
      invoiceNo: json['invoice'] != null ? json['invoice']['invoiceNumber'] as String? : null,
      fromPlace: json['fromPlace'] as String?,
      toPlace: json['toPlace'] as String?,
      transporterName: json['transporterName'] as String?,
      transporterId: json['transporterId'] as String?,
      vehicleNo: json['vehicleNo'] as String?,
      distanceKm: json['distanceKm'] as int?,
      documentValue: MoneyUtils.parse(json['documentValue'] ?? 0),
      status: json['status'] as String? ?? 'ACTIVE',
      cancelReason: json['cancelReason'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'ewayBillNo': ewayBillNo,
      'invoiceId': invoiceId,
      'invoiceNo': invoiceNo,
      'fromPlace': fromPlace,
      'toPlace': toPlace,
      'transporterName': transporterName,
      'transporterId': transporterId,
      'vehicleNo': vehicleNo,
      'distanceKm': distanceKm,
      'documentValue': documentValue,
      'status': status,
      'cancelReason': cancelReason,
      'createdAt': createdAt,
    };
  }
}

class NoteItem {
  final String id;
  final String title;
  final String? body;
  final String? partyId;
  final String? partyName;
  final String? invoiceId;
  final String? invoiceNumber;
  final bool pinned;
  final String? remindAt;
  final String createdAt;

  NoteItem({
    required this.id,
    required this.title,
    this.body,
    this.partyId,
    this.partyName,
    this.invoiceId,
    this.invoiceNumber,
    required this.pinned,
    this.remindAt,
    required this.createdAt,
  });

  factory NoteItem.fromJson(Map<String, dynamic> json) {
    return NoteItem(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String?,
      partyId: json['partyId'] as String?,
      partyName: json['party'] != null ? json['party']['name'] as String? : null,
      invoiceId: json['invoiceId'] as String?,
      invoiceNumber: json['invoice'] != null ? json['invoice']['invoiceNumber'] as String? : null,
      pinned: json['pinned'] as bool? ?? false,
      remindAt: json['remindAt'] as String?,
      createdAt: json['createdAt'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'body': body,
      'partyId': partyId,
      'partyName': partyName,
      'invoiceId': invoiceId,
      'invoiceNumber': invoiceNumber,
      'pinned': pinned,
      'remindAt': remindAt,
      'createdAt': createdAt,
    };
  }
}
