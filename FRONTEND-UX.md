# Frontend UX revision

The existing GuardianCare palette, rounded cards, type hierarchy and reduced-motion behavior are retained.

- Events share a received/accepted/closed state machine. Acceptance silences the matching SOS from any screen. Closure requires acceptance. Counts and badges use the same state; personal owner and loved-one histories are scoped separately.
- SOS prioritizes the active person and actions. Pairing and technical setup are collapsed. The local test cannot replace an unfinished event.
- Personal includes role switching, last sample time, a daily summary and expandable charts/timeline. The trusted person view shows the loved one and event actions, not the owner's readings.
- Organization includes attention/offline filters, SOS-first ordering, session-only patient creation/editing, caregiver/recipient fields and empty readings for new profiles.
- Profile exposes shared devices/recipient setup and session reset behavior.
- Subscription includes personal comparison, explicit saved-versus-selected preferences and a fixed review area. Short screens and large system fonts put the review area into the scroll content.
- Shared actions have native/web pressed and disabled feedback, minimum touch heights and web ARIA state mappings. Shared screens accommodate the iOS keyboard. Expandable content respects reduced motion; charts handle missing values.

Validation: lint, TypeScript, event state/scoping and deduplication tests; Metro web/Android/iOS exports. Browser walkthrough at 375x812 and 320x640: patient creation, empty readings, SOS stop/accept/close, organization yearly preference, personal role switching, invalid/valid pairing code. Physical iOS/Android keyboard, screen reader, large-font and background behavior still require device testing. No live backend or hardware was introduced.

## Second audit fixes

- Personal readings now precede role/device setup. Pulse and temperature stay in two columns down to 320px; setup and demo details are collapsed.
- Assigned/connected, assigned/offline and unassigned device states are distinct. Offline counts and filters exclude unassigned patients.
- Received SOS has highest patient priority; accepted SOS remains highlighted as Help in progress until closed, including the attention filter.
- Patient recipientId refers to the shared session contact list. The patient profile and SOS resolve the same contact and pairing state. Pair/unpair updates all views; personal and organization accounts start with suitable demo contacts.
- Patient and account-name forms warn before route removal; web reload/close also registers a dirty-form warning. Keep editing preserves the draft; Discard resumes the original navigation; Save updates the clean baseline. Changes are still session-only.
- The bottom navigation exposes a tablist, one Tab stop, arrow-key wrapping and Home/End with focus following selection.
- Charts support tapping the nearest point and accessible Previous/Next controls. Period changes reset the selected sample. Web mouse coordinates and native touch coordinates are handled separately.
- Native animation driver is enabled only on native platforms, avoiding the web fallback warning.

Verification: seven policy tests pass; lint and TypeScript pass. Browser checks included 320x640 and 375x812, keep/discard/save paths, shared contact assignment and pairing, accepted SOS priority, keyboard navigation, chart tap/next/period switching and cold startup. Physical device gestures, hardware and background delivery remain unverified.
