# Account experiences and subscriptions

## Account modes

Personal sign-in opens a personal dashboard: own bracelet, simulated live stream (five-second updates, pause/resume), 24h/7d statistics and a demo day timeline. Personal readings use the dedicated self fixture, not a hospital patient. The stream is explicitly simulated; historical charts use fixed sample history. Personal Alerts contain only a self device event. Patient detail routes do not display organization patients in Personal mode.

Organization sign-in opens a patient directory. Every patient has a profile with patient ID, room/bed, assigned bracelet, connection/battery status, measurements, historical charts and patient-specific events. Acknowledging an event is reflected in that patient's profile. These records are fictional fixtures; no clinical backend is connected.

The bottom bar has Home, Alerts and Profile. Profile includes editable display name, Privacy & data, Security, Notifications, Help & support, About, Sign out and Manage subscription. Names, preference switches and subscription choices are stored only for the current demo session. Sign-out resets them. Privacy and security screens distinguish available demo controls from authentication, push delivery and server data management that are not implemented.

## Commercial offers

| Offer | Monthly USD | Yearly USD |
| --- | --- | --- |
| Plus | $10 | $100 |
| Personal Pro | $30 | $300 |
| Organization Pro | $100 | $1,000 |
| Bracelet (separate) | $10 per device, one time | |

Personal accounts see two personal commercial offers: Plus and Pro. Personal Pro has individual sensor trends, period comparisons and an activity timeline; it does not display hospital workspace features. Hospitals and organization accounts see only the Pro offer, with organization-specific benefits; the session save function also enforces Pro. Organization prices are per organization; no seat/device limits are implied. Yearly billing saves $20 for Plus, $60 for Personal Pro and $200 for Organization Pro (approximately 16.7%).

Manage subscription supports plan comparison, monthly/yearly billing, subscription-only cost review, and saving a preferred plan/period in the demo session. Profile reflects the saved preference. No payment method is charged and no paid entitlement is created; checkout, renewals, billing history and cancellation require a payment/backend integration. No active subscription is implied.

The pricing layout is a native adaptation of the supplied RuixenPricing_04 reference. No browser-only dependencies were introduced.

## Validation

TypeScript and ESLint passed. Browser checks at 375px covered personal sign-in, live sample changes and pause, 24h/7d charts, profile navigation, name save, analytics preference, organization sign-in, patient details, patient event acknowledgement, Plus disabled for organization and Pro yearly preference save. Android and iOS Hermes exports were also checked. Physical-device execution remains unverified.

Reference: https://21st.dev/@ruixen.ui/components/ruixen-pricing-04

Manage subscription no longer shows the bracelet purchase block or the Choose Plus or Pro banner. Price amounts and billing suffixes roll vertically when switching Monthly/Yearly (260 ms, native-driver transforms); reverse switching reverses direction. Reduced-motion settings disable the slide. Screen readers receive a single current-price label; outgoing animation layers are hidden. Card spacing reserves the annual savings line to avoid layout jumps.
