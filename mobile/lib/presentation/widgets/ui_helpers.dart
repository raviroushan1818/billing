import 'package:flutter/material.dart';

/// Shared UI helpers to avoid common Flutter overflow issues.
class UiHelpers {
  UiHelpers._();

  /// Dropdown menu item text that ellipsizes instead of overflowing.
  static Widget dropdownLabel(String text) {
    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      softWrap: false,
    );
  }

  static DropdownMenuItem<T> menuItem<T>({
    required T? value,
    required String label,
  }) {
    return DropdownMenuItem<T>(
      value: value,
      child: dropdownLabel(label),
    );
  }

  /// Label/value row that won't overflow on narrow screens.
  static Widget keyValueRow(
    String label,
    String value, {
    TextStyle? labelStyle,
    TextStyle? valueStyle,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            flex: 2,
            child: Text(label, style: labelStyle),
          ),
          const SizedBox(width: 8),
          Expanded(
            flex: 3,
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: valueStyle,
            ),
          ),
        ],
      ),
    );
  }
}
