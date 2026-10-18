# 21st.dev adaptations

The user supplied two blocks: `RuixenStats` and `Stats10` (file name `stats-4.tsx`). Their visual structure is adapted in `src/components/ui/`.

- **RuixenStats:** large central number over an area chart, secondary figures and CTA → People connection overview, deterministic demo connection trend, people/device/alert counts, internal Alerts navigation.
- **Stats10:** value, comparison and gradient sparkline cards → patient heart rate, skin temperature and movement. Comparison is the absolute change against the previous two-hour sample, with units. Up/down arrows describe direction only; colors identify metrics, not clinical risk.
- **Shared area chart:** `react-native-svg` replaces Recharts. SVG gradients have instance-specific identifiers. The existing detailed 24h/7d charts use the same area treatment while retaining axes and units.

These are native adaptations, not embedded websites. Expo Router replaces Next links; React Native views and StyleSheet replace DOM/shadcn/Tailwind. Existing Lucide Native and SVG dependencies are sufficient. No Next.js, Recharts, Radix or stock imagery is needed. Sensor values remain exact fixture values rather than counting through intermediate readings. Session and acknowledgement behavior is preserved.

All source measurements and connection history are fictional demo fixtures. Device connectivity and changes in measurements are not diagnoses or assessments of patient health.
