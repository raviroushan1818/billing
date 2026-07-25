import '../../core/utils/money_utils.dart';

class InvoiceLine {
  final String? itemId;
  final String description;
  final String? hsnSac;
  final String? unit;
  final double qty;
  final double rate;
  final double discount;
  final double gstRate;
  final String? godownId;

  InvoiceLine({
    this.itemId,
    required this.description,
    this.hsnSac,
    this.unit,
    required this.qty,
    required this.rate,
    this.discount = 0,
    this.gstRate = 18,
    this.godownId,
  });

  factory InvoiceLine.fromJson(Map<String, dynamic> json) {
    return InvoiceLine(
      itemId: json['itemId'] as String?,
      description: json['description'] as String,
      hsnSac: json['hsnSac'] as String?,
      unit: json['unit'] as String?,
      qty: MoneyUtils.parse(json['qty']),
      rate: MoneyUtils.parse(json['rate']),
      discount: MoneyUtils.parse(json['discount'] ?? 0),
      gstRate: MoneyUtils.parse(json['gstRate'] ?? 18),
      godownId: json['godownId'] as String?,
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
      'discount': discount,
      'gstRate': gstRate,
      'godownId': godownId,
    };
  }
}

class InvoicePayment {
  final String id;
  final String mode; // CASH | UPI | CARD
  final double amount;
  final String? upiRefId;
  final String? cardLast4;
  final String? notes;
  final String createdAt;

  InvoicePayment({
    required this.id,
    required this.mode,
    required this.amount,
    this.upiRefId,
    this.cardLast4,
    this.notes,
    required this.createdAt,
  });

  factory InvoicePayment.fromJson(Map<String, dynamic> json) {
    return InvoicePayment(
      id: json['id'] as String? ?? '',
      mode: json['mode'] as String? ?? 'CASH',
      amount: MoneyUtils.parse(json['amount']),
      upiRefId: json['upiRefId'] as String?,
      cardLast4: json['cardLast4'] as String?,
      notes: json['notes'] as String?,
      createdAt: (json['paidAt'] ?? json['createdAt']) as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'mode': mode,
      'amount': amount,
      'upiRefId': upiRefId,
      'cardLast4': cardLast4,
      'notes': notes,
      'createdAt': createdAt,
    };
  }
}

class Invoice {
  final String id;
  final String invoiceNumber;
  final String? partyId;
  final String partyName;
  final String? partyPhone;
  final String? partyAddress;
  final String? partyGstin;
  final String? partyStateCode;
  final String? partyExternalId;
  final String? referredBy;
  final String? placeOfSupply;
  final String? supplyType; // B2B | B2C | B2CL
  final bool reverseCharge;
  final String invoiceDate;
  final String? dueDate;
  final String? notes;
  final double discountAmount;
  final double totalAmount;
  final double taxAmount;
  final double grandTotal;
  final double amountPaid;
  final double balanceDue;
  final String status; // DRAFT | FINALIZED | VOID
  final String paymentStatus; // UNPAID | PARTIAL | PAID
  final String documentType; // TAX_INVOICE | CREDIT_NOTE | DEBIT_NOTE
  final List<InvoiceLine> lines;
  final List<InvoicePayment> payments;
  final String createdAt;
  final String updatedAt;

  Invoice({
    required this.id,
    required this.invoiceNumber,
    this.partyId,
    required this.partyName,
    this.partyPhone,
    this.partyAddress,
    this.partyGstin,
    this.partyStateCode,
    this.partyExternalId,
    this.referredBy,
    this.placeOfSupply,
    this.supplyType,
    required this.reverseCharge,
    required this.invoiceDate,
    this.dueDate,
    this.notes,
    required this.discountAmount,
    required this.totalAmount,
    required this.taxAmount,
    required this.grandTotal,
    required this.amountPaid,
    required this.balanceDue,
    required this.status,
    required this.paymentStatus,
    required this.documentType,
    required this.lines,
    required this.payments,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Invoice.fromJson(Map<String, dynamic> json) {
    return Invoice(
      id: json['id'] as String? ?? '',
      invoiceNumber: json['invoiceNumber'] as String? ?? json['billNo'] as String? ?? '',
      partyId: json['partyId'] as String?,
      partyName: json['partyName'] as String? ?? 'Walk-in Customer',
      partyPhone: json['partyPhone'] as String?,
      partyAddress: json['partyAddress'] as String?,
      partyGstin: json['partyGstin'] as String?,
      partyStateCode: json['partyStateCode'] as String?,
      partyExternalId: json['partyExternalId'] as String?,
      referredBy: json['referredBy'] as String?,
      placeOfSupply: json['placeOfSupply'] as String?,
      supplyType: json['supplyType'] as String?,
      reverseCharge: json['reverseCharge'] as bool? ?? false,
      invoiceDate: json['invoiceDate'] as String? ?? '',
      dueDate: json['dueDate'] as String?,
      notes: json['notes'] as String?,
      discountAmount: MoneyUtils.parse(json['discountAmount'] ?? 0),
      totalAmount: MoneyUtils.parse(json['totalAmount']),
      taxAmount: MoneyUtils.parse(json['taxAmount']),
      grandTotal: MoneyUtils.parse(json['grandTotal']),
      amountPaid: MoneyUtils.parse(json['amountPaid']),
      balanceDue: MoneyUtils.parse(json['balanceDue']),
      status: json['status'] as String? ?? 'DRAFT',
      paymentStatus: json['paymentStatus'] as String? ?? 'UNPAID',
      documentType: json['documentType'] as String? ?? 'TAX_INVOICE',
      lines: (json['lines'] as List? ?? [])
          .map((e) => InvoiceLine.fromJson(e as Map<String, dynamic>))
          .toList(),
      payments: (json['payments'] as List? ?? [])
          .map((e) => InvoicePayment.fromJson(e as Map<String, dynamic>))
          .toList(),
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'invoiceNumber': invoiceNumber,
      'partyId': partyId,
      'partyName': partyName,
      'partyPhone': partyPhone,
      'partyAddress': partyAddress,
      'partyGstin': partyGstin,
      'partyStateCode': partyStateCode,
      'partyExternalId': partyExternalId,
      'referredBy': referredBy,
      'placeOfSupply': placeOfSupply,
      'supplyType': supplyType,
      'reverseCharge': reverseCharge,
      'invoiceDate': invoiceDate,
      'dueDate': dueDate,
      'notes': notes,
      'discountAmount': discountAmount,
      'totalAmount': totalAmount,
      'taxAmount': taxAmount,
      'grandTotal': grandTotal,
      'amountPaid': amountPaid,
      'balanceDue': balanceDue,
      'status': status,
      'paymentStatus': paymentStatus,
      'documentType': documentType,
      'lines': lines.map((e) => e.toJson()).toList(),
      'payments': payments.map((e) => e.toJson()).toList(),
      'createdAt': createdAt,
      'updatedAt': updatedAt,
    };
  }
}

class PrintResponse {
  final String? signedUrl;
  final String? html;

  PrintResponse({this.signedUrl, this.html});

  factory PrintResponse.fromJson(Map<String, dynamic> json) {
    return PrintResponse(
      signedUrl: json['signedUrl'] as String?,
      html: json['html'] as String?,
    );
  }
}
