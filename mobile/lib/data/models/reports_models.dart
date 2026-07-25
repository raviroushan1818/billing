import '../../core/utils/money_utils.dart';

class ReceivableRow {
  final String id;
  final String billNo;
  final String partyName;
  final String? partyPhone;
  final String invoiceDate;
  final String dueDate;
  final double grandTotal;
  final double amountPaid;
  final double balanceDue;
  final String paymentStatus;
  final int daysPastDue;
  final String bucket; // current | 1-30 | 31-60 | 61-90 | 90+

  ReceivableRow({
    required this.id,
    required this.billNo,
    required this.partyName,
    this.partyPhone,
    required this.invoiceDate,
    required this.dueDate,
    required this.grandTotal,
    required this.amountPaid,
    required this.balanceDue,
    required this.paymentStatus,
    required this.daysPastDue,
    required this.bucket,
  });

  factory ReceivableRow.fromJson(Map<String, dynamic> json) {
    return ReceivableRow(
      id: json['id'] as String,
      billNo: json['billNo'] as String? ?? json['invoiceNumber'] as String? ?? '',
      partyName: json['partyName'] as String,
      partyPhone: json['partyPhone'] as String?,
      invoiceDate: json['invoiceDate'] as String,
      dueDate: json['dueDate'] as String,
      grandTotal: MoneyUtils.parse(json['grandTotal']),
      amountPaid: MoneyUtils.parse(json['amountPaid']),
      balanceDue: MoneyUtils.parse(json['balanceDue']),
      paymentStatus: json['paymentStatus'] as String,
      daysPastDue: json['daysPastDue'] as int? ?? 0,
      bucket: json['bucket'] as String? ?? 'current',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'billNo': billNo,
      'partyName': partyName,
      'partyPhone': partyPhone,
      'invoiceDate': invoiceDate,
      'dueDate': dueDate,
      'grandTotal': grandTotal,
      'amountPaid': amountPaid,
      'balanceDue': balanceDue,
      'paymentStatus': paymentStatus,
      'daysPastDue': daysPastDue,
      'bucket': bucket,
    };
  }
}

class ReceivablesSummary {
  final double totalDue;
  final int count;
  final Map<String, double> byBucket;

  ReceivablesSummary({
    required this.totalDue,
    required this.count,
    required this.byBucket,
  });

  factory ReceivablesSummary.fromJson(Map<String, dynamic> json) {
    final Map<String, dynamic> rawBucket = json['byBucket'] as Map<String, dynamic>? ?? {};
    final parsedBucket = rawBucket.map((key, value) => MapEntry(key, MoneyUtils.parse(value)));

    return ReceivablesSummary(
      totalDue: MoneyUtils.parse(json['totalDue']),
      count: json['count'] as int? ?? 0,
      byBucket: parsedBucket,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'totalDue': totalDue,
      'count': count,
      'byBucket': byBucket,
    };
  }
}

class ReceivablesResponse {
  final List<ReceivableRow> rows;
  final ReceivablesSummary summary;

  ReceivablesResponse({
    required this.rows,
    required this.summary,
  });

  factory ReceivablesResponse.fromJson(Map<String, dynamic> json) {
    final rowsList = (json['rows'] as List? ?? [])
        .map((e) => ReceivableRow.fromJson(e as Map<String, dynamic>))
        .toList();
    final summaryObj = ReceivablesSummary.fromJson(json['summary'] as Map<String, dynamic>? ?? {});

    return ReceivablesResponse(
      rows: rowsList,
      summary: summaryObj,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'rows': rows.map((e) => e.toJson()).toList(),
      'summary': summary.toJson(),
    };
  }
}
