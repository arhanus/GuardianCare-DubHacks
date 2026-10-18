# GuardianCare design system — preserve and refine

## Direction

The user explicitly likes the existing design. Preserve the monochrome canvas, bold system sans headings, rounded white cards, subtle borders/shadows, dark primary actions, green accents and the floating three-tab bottom navigation. The dark welcome screen remains part of the same identity. Do not replace this with a new palette, typeface, gradient treatment or navigation paradigm.

## Reference workflow

Applied dekitproject/ux-ui-promax-skill, local reference commit 229a1b6. Read .claude/skills/ui-ux-pro-max/SKILL.md and ran its design-system and React Native searches. Apply its accessibility, hierarchy, feedback, touch-target and motion guidance. Generic generator color/font suggestions are subordinate to the user's explicit existing-design preference.

## Tokens

| Role | Value |
| --- | --- |
| Canvas | #FAFAFA |
| Surface | #FFFFFF |
| Primary text | #171717 |
| Secondary text | #626262 |
| Accent | #177658 |
| Soft accent | #EAF1ED |
| Border | #E5E5E5 |
| Error/offline | #BD3F48 + explicit text |

Shared body metadata is 14/21, secondary descriptions 15/23, input text 16, labels and footnotes at least 12. Existing 29px screen headings and price typography remain. Cards use a 20px radius and 20px inset; page sections use a consistent 20px gap. Keep layouts flexible for text scaling and narrow screens.

## Behavior and hierarchy

- Personal: greeting, own bracelet, simulated live metrics, statistics, timeline. Movement may use a compact full-width row on phones.
- Organization: care overview and patient profiles precede commercial information. Search supports name/room, result counts, clearing and actionable empty state.
- Patient rows expose identity/location, connection status, bracelet/battery and last update. Status uses explicit words plus color/dot.
- Profile is the stable place for account settings, sign out and Manage subscription.
- Personal has Plus and Pro; organization has Pro only. Preserve agreed pricing and subscription-only management screen.
- Desktop pricing cards reserve description height so prices line up.
- Use existing 180–260ms motion, fixed-width bottom tab targets and system reduced-motion handling. Never animate layout dimensions.

## Verification

Check 320px/375px phones and a wider viewport. Verify no clipped content, visible keyboard focus, labels on controls, touch targets around 48px and readable contrast. Test search by room, no results, clear action, offline patient profile, billing toggle, profile editing and existing account-mode separation. Real payments, authentication and physical sensor integration are outside this UI refinement.
