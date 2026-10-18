import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type Screen = 'home' | 'people' | 'detail' | 'alerts' | 'incident';
type Person = { id: number; name: string; initials: string; room: string; status: 'Connected' | 'Offline'; updated: string };
const people: Person[] = [
  { id: 1, name: 'Alex Morgan', initials: 'AM', room: 'Room 201', status: 'Connected', updated: '3 seconds ago' },
  { id: 2, name: 'Jordan Lee', initials: 'JL', room: 'Room 202', status: 'Connected', updated: '7 seconds ago' },
  { id: 3, name: 'Taylor Kim', initials: 'TK', room: 'Room 203', status: 'Offline', updated: '8 minutes ago' },
];
const C = { ink: '#15263C', muted: '#768398', blue: '#285BE8', line: '#E5EAF1', bg: '#F7F9FC', green: '#097A63', red: '#C9434B', navy: '#1B3768' };

export default function GuardianApp() {
  const [screen, setScreen] = useState<Screen>('home');
  const [personId, setPersonId] = useState(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const person = people.find(p => p.id === personId) ?? people[0];
  const pending = acknowledged ? 0 : 1;
  const goPerson = (id: number) => { setPersonId(id); setScreen('detail'); };
  const goIncident = () => { setPersonId(1); setScreen('incident'); };
  const Button = ({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) => (
    <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.button, disabled && s.disabled]}><Text style={s.buttonText}>{label}</Text></TouchableOpacity>
  );
  const Label = ({ children }: { children: React.ReactNode }) => <Text style={s.kicker}>{children}</Text>;
  const PersonCard = ({ p }: { p: Person }) => (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`View ${p.name}`} style={s.card} onPress={() => goPerson(p.id)}>
      <View style={s.between}><View style={s.personRow}><View style={s.initials}><Text style={s.initialText}>{p.initials}</Text></View><View><Text style={s.name}>{p.name}</Text><Text style={s.meta}>{p.room}</Text></View></View><Text style={[s.badge, p.status === 'Offline' ? s.offline : s.connected]}>{p.status}</Text></View>
      <View style={[s.between, { marginTop: 16 }]}><Text style={s.tiny}>Last update · {p.updated}</Text><Text style={s.chevron}>→</Text></View>
    </TouchableOpacity>
  );
  const AlertCard = () => (
    <TouchableOpacity accessibilityRole="button" style={[s.card, s.urgentCard]} onPress={goIncident}>
      <View style={s.between}><View style={[s.personRow, { flex: 1 }]}><View style={s.redBar}/><View style={{ flex: 1 }}><Text style={[s.name, { color: '#A9313C' }]}>SOS button pressed</Text><Text style={s.meta}>Alex Morgan · Room 201</Text></View></View><Text style={[s.badge, acknowledged ? s.connected : s.attention]}>{acknowledged ? 'Responding' : 'Action needed'}</Text></View>
      <View style={[s.between, { marginTop: 17 }]}><Text style={s.tiny}>10:42 AM · SIMULATED</Text><Text style={[s.chevron, { color: C.red }]}>→</Text></View>
    </TouchableOpacity>
  );
  const Back = ({ to, label }: { to: Screen; label: string }) => <TouchableOpacity accessibilityRole="button" onPress={() => setScreen(to)}><Text style={s.back}>← {label}</Text></TouchableOpacity>;
  const Stat = ({ value, label, color }: { value: string; label: string; color: string }) => <View style={s.stat}><Text style={[s.statValue, { color }]}>{value}</Text><Text style={s.statLabel}>{label}</Text></View>;
  return <SafeAreaView style={s.safe}>
    <StatusBar barStyle="dark-content" />
    <View style={s.header}><Text style={s.logo}>guardian<Text style={{ color: C.blue }}>care</Text><Text style={{ color: '#3BB8A1' }}>.</Text></Text><View style={s.avatar}><Text style={s.avatarText}>RN</Text></View></View>
    <ScrollView key={screen} style={{ flex: 1 }} contentContainerStyle={s.content}>
      {screen === 'home' && <>
        <Text style={s.title}>Good morning, Riley</Text><Text style={s.subtitle}>Saturday, October 17 · Care overview</Text>
        <View style={s.hero}><Text style={s.heroEyebrow}>YOUR CARE CIRCLE</Text><Text style={s.heroNumber}>03</Text><Text style={s.heroCaption}>People in your care</Text><Text style={s.heroDisclaimer}>DEMO MODE · NOT LIVE MONITORING</Text></View>
        <View style={s.stats}><Stat value="02" label="Connected" color={C.green}/><Stat value="01" label="Offline" color="#A46B22"/><Stat value={pending ? '01' : '00'} label="Needs response" color={C.red}/></View>
        <View style={s.sectionRow}><Label>PRIORITY ATTENTION</Label><TouchableOpacity onPress={() => setScreen('alerts')}><Text style={s.smallLink}>All alerts →</Text></TouchableOpacity></View><AlertCard/>
        <View style={s.sectionRow}><Label>PEOPLE IN CARE</Label><TouchableOpacity onPress={() => setScreen('people')}><Text style={s.smallLink}>See all →</Text></TouchableOpacity></View>
        {people.slice(0, 2).map(p => <PersonCard key={p.id} p={p}/>)}
      </>}
      {screen === 'people' && <>
        <Text style={s.title}>People in care</Text><Text style={s.subtitle}>An overview of connected safety wearables</Text>
        <View style={s.info}><Text style={s.infoText}>ⓘ  Device connectivity and events are sample data for this demonstration.</Text></View>
        <Label>ALL PEOPLE · 03</Label>{people.map(p => <PersonCard key={p.id} p={p}/>)}
      </>}
      {screen === 'detail' && <>
        <Back to="people" label="All people"/><View style={[s.personRow, { marginBottom: 26 }]}><View style={[s.initials, { width: 58, height: 58 }]}><Text style={[s.initialText, { fontSize: 18 }]}>{person.initials}</Text></View><View><Text style={[s.title, { fontSize: 24 }]}>{person.name}</Text><Text style={s.meta}>{person.room}</Text></View></View>
        <View style={s.card}><Label>WEARABLE STATUS</Label><View style={s.between}><Text style={[s.name, { color: person.status === 'Connected' ? C.green : '#A46B22' }]}>{person.status === 'Connected' ? '●  Connected' : '○  Offline'}</Text><Text style={s.demoTag}>DEMO DEVICE</Text></View><Text style={[s.meta, { marginTop: 10 }]}>Last update · {person.updated}</Text></View>
        <View style={s.card}><Label>MOTION SIGNAL</Label><Text style={s.name}>No confirmed event</Text><Text style={[s.notice, { marginBottom: 0 }]}>Experimental motion data cannot reliably diagnose falls, fainting, or medical conditions.</Text></View>
        <Button label="View safety alerts →" onPress={() => setScreen('alerts')}/>
      </>}
      {screen === 'alerts' && <>
        <Text style={s.title}>Safety alerts</Text><Text style={s.subtitle}>Incidents requiring review and response</Text>
        <View style={s.sectionRow}><Label>TODAY · 01 EVENT</Label><Text style={s.demoTag}>SIMULATED</Text></View><AlertCard/>
        <Label>ACTIVITY</Label><View style={s.card}><Text style={s.name}>{acknowledged ? 'Response acknowledged' : 'Awaiting response'}</Text><Text style={s.meta}>SOS · Alex Morgan</Text><View style={s.rule}/><Text style={s.tiny}>No emergency services are contacted in this demo.</Text></View>
      </>}
      {screen === 'incident' && <>
        <Back to="alerts" label="All alerts"/><View style={s.between}><Text style={[s.badge, acknowledged ? s.connected : s.attention]}>{acknowledged ? 'Responding' : 'Action needed'}</Text><Text style={s.demoTag}>SIMULATED</Text></View>
        <Text style={[s.title, { marginTop: 18 }]}>SOS button pressed</Text><Text style={s.subtitle}>Alex Morgan · Room 201</Text>
        <View style={s.card}><Label>INCIDENT TIMELINE</Label><View style={s.event}><View style={s.between}><Text style={s.name}>SOS received</Text><Text style={s.tiny}>10:42 AM</Text></View><Text style={s.meta}>Triggered by wearable button · demo event</Text></View><View style={s.event}><View style={s.between}><Text style={s.name}>{acknowledged ? 'Response acknowledged' : 'Awaiting response'}</Text><Text style={s.tiny}>{acknowledged ? 'Complete' : 'Pending'}</Text></View><Text style={s.meta}>{acknowledged ? 'A caregiver marked this incident as responding.' : 'No caregiver has acknowledged yet.'}</Text></View></View>
        <View style={s.info}><Text style={s.infoText}>ⓘ  This prototype does not contact emergency services. In an actual emergency, contact local emergency services immediately.</Text></View>
        <Button label={acknowledged ? 'Response acknowledged ✓' : "I'm responding"} disabled={acknowledged} onPress={() => setAcknowledged(true)}/>
        <Text style={[s.notice, { textAlign: 'center' }]}>Acknowledgment is saved in memory only.</Text>
      </>}
    </ScrollView>
    <View style={s.nav}>{([{ key: 'home', label: 'Overview', icon: '⌂' }, { key: 'people', label: 'People', icon: '♙' }, { key: 'alerts', label: 'Alerts', icon: '♧' }] as const).map(item => {
      const active = screen === item.key || (screen === 'detail' && item.key === 'people') || (screen === 'incident' && item.key === 'alerts');
      return <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: active }} key={item.key} onPress={() => setScreen(item.key)} style={s.navItem}><Text style={[s.navIcon, active && s.navActive]}>{item.icon}</Text><Text style={[s.navLabel, active && s.navActive]}>{item.label}{item.key === 'alerts' && pending ? ' (1)' : ''}</Text></TouchableOpacity>;
    })}</View>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg }, header: { height: 76, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#F0F2F6', paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { color: C.ink, fontSize: 24, fontWeight: '800', letterSpacing: -1.1 }, avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#E7EDFF', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#3153A0', fontSize: 12, fontWeight: '800' },
  content: { paddingHorizontal: 23, paddingTop: 26, paddingBottom: 40 }, title: { fontSize: 27, fontWeight: '800', color: C.ink, letterSpacing: -0.6 }, subtitle: { color: C.muted, fontSize: 13, marginTop: 9, marginBottom: 25 },
  hero: { backgroundColor: C.navy, borderRadius: 22, padding: 22 }, heroEyebrow: { fontSize: 11, letterSpacing: 1.2, fontWeight: '800', color: '#BFD3FF' }, heroNumber: { fontSize: 48, color: '#FFF', fontWeight: '800', marginTop: 12, letterSpacing: -2 }, heroCaption: { color: '#C9D7F0', fontSize: 12 }, heroDisclaimer: { color: '#B9CFF5', fontSize: 11, marginTop: 20 },
  stats: { flexDirection: 'row', gap: 9, marginTop: 14 }, stat: { flex: 1, padding: 13, borderRadius: 16, backgroundColor: '#FFF', borderWidth: 1, borderColor: C.line }, statValue: { fontSize: 23, fontWeight: '800' }, statLabel: { fontSize: 10, color: C.muted, marginTop: 3 },
  kicker: { fontSize: 11, color: '#7F8DA1', fontWeight: '800', letterSpacing: 1, marginBottom: 12 }, sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 10 }, smallLink: { color: C.blue, fontSize: 12, fontWeight: '800', marginBottom: 10 },
  card: { backgroundColor: '#FFF', borderColor: C.line, borderWidth: 1, borderRadius: 18, padding: 17, marginBottom: 12 }, urgentCard: { borderColor: '#F2C9CD', backgroundColor: '#FFF7F7' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, personRow: { flexDirection: 'row', alignItems: 'center', gap: 12 }, initials: { width: 41, height: 41, borderRadius: 13, backgroundColor: '#EBF1FA', alignItems: 'center', justifyContent: 'center' }, initialText: { color: '#5376AD', fontWeight: '800', fontSize: 14 }, name: { color: C.ink, fontWeight: '800', fontSize: 15 }, meta: { color: C.muted, fontSize: 12, marginTop: 6 }, tiny: { fontSize: 11, color: '#8794A5' }, chevron: { color: '#9AA9BA', fontSize: 19 },
  badge: { fontSize: 10, fontWeight: '800', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, overflow: 'hidden' }, connected: { color: '#08765D', backgroundColor: '#E5F7F0' }, offline: { color: '#A46B22', backgroundColor: '#FFF1DE' }, attention: { color: '#B53641', backgroundColor: '#FFF0EF' }, redBar: { backgroundColor: C.red, width: 4, height: 37, borderRadius: 3 },
  info: { borderRadius: 15, backgroundColor: '#F0F5FD', borderColor: '#DCE6F7', borderWidth: 1, padding: 14, marginBottom: 20 }, infoText: { fontSize: 12, lineHeight: 19, color: '#516A88' }, demoTag: { color: '#53749C', backgroundColor: '#EEF3FA', fontSize: 10, fontWeight: '800', overflow: 'hidden', borderRadius: 8, padding: 7 }, notice: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 14, marginBottom: 12 },
  back: { color: C.blue, fontSize: 13, fontWeight: '800', marginBottom: 24 }, button: { backgroundColor: C.blue, height: 52, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 18 }, disabled: { backgroundColor: '#9BAEDB' }, buttonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  rule: { borderBottomWidth: 1, borderBottomColor: C.line, marginVertical: 14 }, event: { borderBottomWidth: 1, borderBottomColor: C.line, paddingVertical: 16 },
  nav: { flexDirection: 'row', backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: C.line, height: 76, paddingTop: 12 }, navItem: { flex: 1, alignItems: 'center' }, navIcon: { color: '#96A2B2', fontSize: 23 }, navLabel: { color: '#96A2B2', fontSize: 11, fontWeight: '800', marginTop: 3 }, navActive: { color: C.blue },
});
