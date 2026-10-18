# SOS recipient preview

SOS is a local simulation. Personal has separate My bracelet and Helping a loved one views, with separate event histories. Organization previews a nurse alarm for a selected demo patient.

Test SOS adds a received event and loops bundled audio. Stop alarm silences sound without accepting the event. Accept event silences it from either SOS or event details. Only an accepted event can be closed. Closed events remain in All events. Existing fixtures never start audio automatically. Playback pauses when the app leaves the foreground.

Profile > Devices & trusted people and SOS > SOS setup & connection share the same session recipient. Enter fictional recipient details and demo pairing code 482731. This code is a local preview, not an authentication secret or real device link. Pairing, patient edits, names, role and subscription preferences reset on reload or sign-out.

No calls, Bluetooth receiver, bracelet vibration, actual pairing, internet delivery or background push receiver are implemented. Device volume/audio output affect sound. Browser autoplay can require a gesture.

Production needs bracelet hardware/protocol, an authenticated pairing and delivery service, recipient authorization, push/background integration and physical iOS/Android validation. Expo Go does not include arbitrary Bluetooth native modules.

Run npm run start:phone, open Expo Go, enter the demo, then SOS > Test SOS alarm. Stop alarm, Accept event, and Close event are separate actions. No microphone or accessibility permission is required for this foreground playback preview.
