# Moni implementation plan

1. Foundation: retain Expo SDK 58, src/app routing; shared Minimal Soft UI.
2. Database: schema v1, foreign keys and constraints; serialized atomic services; full historical nonnegative-balance validation; tests against real SQLite using Node 24.
3. Onboarding and accounts: no sample finances, cash plus optional banks, explicit opening adjustments and zero-balance bank archiving.
4. Transactions: income, expense, itemized receipts, transfers, history/detail/edit/delete.
5. Dashboard and statistics: shared filters, actual ledger-derived balances, SVG charts.
6. Settings: preferences, optional biometric gate, versioned JSON backup/atomic restore, CSV, defaults and reset.
7. Verification: tests, tsc, lint, Android bundle; EAS preview APK and production AAB configuration; accurate README.

Policy: opening balances exist before the first transaction. Replay all transactions in UTC timestamp / creation timestamp / ID order; no account may become negative at any point. Editing/deleting earlier income must also pass this policy. Archived historical references stay valid; new or edited transactions must use active references. Amounts and aggregate totals must remain safe integers. Dates are stored as UTC ISO 8601; UI periods use the device's local timezone.

## Status

Source implementation for phases 1–6 is complete. Phase 7 local checks pass (44 tests, strict TypeScript, lint, Expo Doctor 20/20, Android bundle export). EAS APK and on-device workflows remain unverified because this environment has no Android device/emulator or linked EAS project. See docs/IMPLEMENTATION-REPORT.md and docs/ANDROID-QA.md for the handoff and exact follow-up work. No APK is claimed.
