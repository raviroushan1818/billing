import 'package:intl/intl.dart';

class MoneyUtils {
  /// Safely parses a dynamic value (from Prisma decimal strings or numeric JSON) into a double.
  static double parse(dynamic value) {
    if (value == null) return 0.0;
    if (value is num) return value.toDouble();
    if (value is String) {
      return double.tryParse(value) ?? 0.0;
    }
    return 0.0;
  }

  /// Formats double or string amounts into standard Indian currency representation (e.g. ₹ 1,23,456.78).
  static String format(dynamic value) {
    final double amount = parse(value);
    final format = NumberFormat.currency(
      locale: 'en_IN',
      symbol: '₹ ',
      decimalDigits: 2,
    );
    return format.format(amount);
  }
}
