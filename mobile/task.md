# Tasks - Phase 0 & Phase 1 (Completed)

- `[x]` **Phase 0 — Project Foundation**
  - `[x]` Scaffold the Flutter app under `./mobile` using `flutter create`
  - `[x]` Configure dependencies in `pubspec.yaml`
  - `[x]` Create environment configuration (`env_config.dart`)
  - `[x]` Implement secure storage wrapper (`secure_storage_service.dart`)
  - `[x]` Implement Dio client and network helper with interceptors (`network_client.dart` & `api_exception.dart`)
  - `[x]` Setup design system, dark/light themes, and custom typography (`theme.dart`)
  - `[x]` Create routing configuration with auth guard redirect (`router.dart`)
  - `[x]` Add money parsing & INR formatting utilities (`money_utils.dart`)
  - `[x]` Implement health check screen / integration check
- `[x]` **Phase 1 — Auth & Shell**
  - `[x]` Define DTO models (`auth_models.dart`) with `fromJson`/`toJson`
  - `[x]` Implement auth repository (`auth_repository.dart`) for API communication
  - `[x]` Create Riverpod auth, features, and profile providers (`auth_provider.dart`)
  - `[x]` Implement Login screen UI (`login_screen.dart`)
  - `[x]` Implement Shell layout with dynamic bottom navigation (`shell_screen.dart`)
  - `[x]` Implement Account / Profile screen with password update (`account_screen.dart`)
  - `[x]` Add a basic Dashboard home placeholder screen (`dashboard_screen.dart`)

# Tasks - Phase 2 — Masters (Completed)

- `[x]` **Phase 2 — Masters**
  - `[x]` Define DTO models (`masters_models.dart`) with `fromJson`/`toJson`
  - `[x]` Implement repository methods (`masters_repository.dart`)
  - `[x]` Create Riverpod providers (`masters_providers.dart`)
  - `[x]` Build Parties Screen (`parties_screen.dart`) with dynamic labels and CRUD
  - `[x]` Build Items Screen (`items_screen.dart`) with search and CRUD
  - `[x]` Build Stock Adjust and Transfer dialogs/screens
  - `[x]` Build Godowns screen (`godowns_screen.dart`) gated by feature check
  - `[x]` Connect routes in `router.dart` and navigation in `shell_screen.dart`
  - `[x]` Verify with unit tests and manual execution

# Tasks - Phase 3 — Invoicing Core (MVP) (Completed)

- `[x]` **Phase 3 — Invoicing Core**
  - `[x]` Define DTO models (`invoices_models.dart`) with `fromJson`/`toJson`
  - `[x]` Implement repository methods (`invoices_repository.dart`)
  - `[x]` Create Riverpod providers (`invoices_providers.dart`)
  - `[x]` Build New Bill Screen (`new_invoice_screen.dart`) with full line editor, party search, payments, and finalize switch
  - `[x]` Build Invoices Register Screen (`invoices_register_screen.dart`) with query filters and search
  - `[x]` Build Invoice Detail Screen (`invoice_detail_screen.dart`) with print, share, add payment, void, and soft delete actions
  - `[x]` Connect routes in `router.dart` and navigation in `shell_screen.dart`
  - `[x]` Verify with unit tests and manual execution

# Tasks - Phase 4 — POS + Receivables UX (Completed)

- `[x]` **Phase 4 — POS + Receivables UX**
  - `[x]` Define DTO models (`reports_models.dart`) with `fromJson`/`toJson`
  - `[x]` Implement repository methods (`reports_repository.dart`)
  - `[x]` Create Riverpod providers (`reports_providers.dart`)
  - `[x]` Build POS Screen (`pos_screen.dart`) with cart system, payment selector, and quick checkout success dialog
  - `[x]` Build Receivables Aging report screen (`receivables_screen.dart`) with metric tiles and billing deep-links
  - `[x]` Integrate widgets inside Dashboard Screen (`dashboard_screen.dart`)
  - `[x]` Connect routes in `router.dart`
  - `[x]` Verify with unit tests and manual execution

# Tasks - Phase 5 — Purchases, E-way, Notes, Reports (Completed)

- `[x]` **Phase 5 — Purchases, E-way, Notes, Reports**
  - `[x]` Define DTO models (`ops_models.dart`) with `fromJson`/`toJson`
  - `[x]` Implement repository methods (`ops_repository.dart`)
  - `[x]` Create Riverpod providers (`ops_providers.dart`)
  - `[x]` Build Purchases list/create/void screens (`purchases_screen.dart`, `new_purchase_screen.dart`, `purchase_detail_screen.dart`)
  - `[x]` Build E-way list/create/cancel screen (`eway_screen.dart`) gated by feature check
  - `[x]` Build Sticky Notes screen (`notes_screen.dart`) gated by feature check
  - `[x]` Build Recycle Bin screen (`recycle_bin_screen.dart`)
  - `[x]` Build Reports Center screen (`reports_center_screen.dart`) with Day Book, Collections, GSTR-1, and ITC tabs
  - `[x]` Connect routes in `router.dart` and drawer/navigation links
  - `[x]` Verify with unit tests and manual execution

# Tasks - Phase 6 — Hardening (Completed)

- `[x]` **Phase 6 — Hardening**
  - `[x]` Refine error mappings in `api_exception.dart`
  - `[x]` Add retry interceptor inside `network_client.dart`
  - `[x]` Polish tablet layout configurations and sizes
  - `[x]` Execute final test verification checks
