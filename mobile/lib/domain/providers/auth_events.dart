import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authLogoutEventProvider = Provider<StreamController<void>>((ref) {
  final controller = StreamController<void>.broadcast();
  ref.onDispose(() {
    controller.close();
  });
  return controller;
});
