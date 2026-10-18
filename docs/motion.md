# Motion behavior

Shared motion settings live in src/motion.tsx: 180 ms for value changes and interaction feedback, 260 ms for screen/card/price transitions, cubic ease-out. A single provider observes the system reduced-motion preference for the application.

- Home, patient details, Alerts, Profile, settings, welcome and subscription screens use a short opacity/translate entrance on focus. Animations stop on blur or unmount.
- Bottom navigation has three fixed-width, permanently labelled targets. A native-driver transform moves the active indicator with a damped, clamped spring. Neither button width nor label mounting changes during navigation.
- Dashboard cards use a short 55 ms stagger with cleanup.
- Historical chart period changes and simulated live values fade gently. Live sampling runs only while the personal home screen is focused and the app is active.
- Monthly/yearly prices retain their directional roll, using the shared duration/easing and reduced-motion preference.
- Web buttons, tabs, switches and inputs transition background, border, text color, opacity and shadow over 180 ms. CSS avoids transition: all, animated dimensions and scroll offsets. Keyboard focus remains visible.
- Reduced motion removes the sliding/fading animations and CSS transitions.

Browser validation covered Personal sign-in, Home/Profile navigation, graph period switching, fast billing toggles and a 375px viewport. Tab hit-target bounds were unchanged before and after navigation; CSS interaction duration was verified as 0.18s. Browser error log was empty. TypeScript/ESLint and web/native exports are used for build validation. This is not a measured frame-rate guarantee on every device.
