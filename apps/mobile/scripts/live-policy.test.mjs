import test from 'node:test';
import assert from 'node:assert/strict';
import { appendReading, MAX_READINGS, toCareEvent, ringingEvents, escalation, handover, handoverText, waitLabel, ESCALATE_AFTER_MS, series, pickHeartRate, readingAt, relativeTime, alertTitle } from '../src/live-policy.ts';

const reading = (n, extra = {}) => ({ id: `r${n}`, deviceId: 'd', patientId: 'p', heartRateBpm: 70, skinTemperatureC: 33.5, accelerationG: { x: 0, y: 0, z: 1 }, motionG: 1, signalQuality: 'good', receivedAt: new Date(1_000_000 + n * 1000).toISOString(), ...extra });
const alert = (extra = {}) => ({ id: 'a1', patientId: 'p', deviceId: 'd', eventId: null, type: 'MOTION_ALERT', detail: 'SUDDEN_MOTION', severity: 'urgent', status: 'open', source: 'device', createdAt: new Date(1_005_000).toISOString(), acknowledgedAt: null, acknowledgedBy: null, ...extra });

test('appendReading keeps order, drops duplicates and caps the buffer', () => {
  let buffer = [];
  for (let i = 0; i < MAX_READINGS + 10; i++) buffer = appendReading(buffer, reading(i));
  assert.equal(buffer.length, MAX_READINGS);
  assert.equal(buffer.at(-1).id, `r${MAX_READINGS + 9}`);
  assert.equal(appendReading(buffer, reading(MAX_READINGS + 9)), buffer);
  assert.deepEqual(appendReading([reading(2)], reading(1)).map(r => r.id), ['r1', 'r2']);
});

test('open alerts become urgent "received" events that ring; acknowledged ones do not', () => {
  const open = toCareEvent(alert(), 'p');
  assert.equal(open.status, 'received');
  assert.equal(open.remote, true);
  assert.equal(open.title, 'Sudden motion detected');
  assert.equal(ringingEvents([open], 0).length, 1);
  assert.equal(ringingEvents([open], Date.parse(open.recordedAt) + 1).length, 0); // opened before this session: silent
  const acked = toCareEvent(alert({ status: 'acknowledged' }), 'p');
  assert.equal(acked.status, 'accepted');
  assert.equal(ringingEvents([acked], 0).length, 0);
  assert.equal(ringingEvents([{ ...open, remote: false }], 0).length, 0); // local test alerts never use the doorbell path
  const warning = toCareEvent(alert({ severity: 'warning' }), 'p');
  assert.equal(warning.severity, 'warning');
  assert.equal(ringingEvents([warning], 0).length, 0); // warnings are yellow and never ring
  assert.equal(toCareEvent(alert({ detail: 'FALL' }), 'p').title, 'Possible fall');
});

test('titles cover every alert kind', () => {
  assert.equal(alertTitle(alert({ type: 'SOS', detail: null, source: 'app' })), 'SOS pressed in the app');
  assert.equal(alertTitle(alert({ type: 'SOS', detail: null })), 'SOS received');
  assert.equal(alertTitle(alert({ detail: 'HR_HIGH' })), 'Heart rate too high');
  assert.equal(alertTitle(alert({ detail: 'TEMP_LOW' })), 'Skin temperature too low');
});

test('series skips null readings instead of inventing values', () => {
  const out = series([reading(1), reading(2, { heartRateBpm: null }), reading(3, { heartRateBpm: 80 })], pickHeartRate);
  assert.deepEqual(out.values, [70, 80]);
  assert.equal(out.labels.length, 2);
  assert.deepEqual(series(undefined, pickHeartRate), { labels: [], values: [] });
});

test('readingAt picks what the wristband said when the alert fired', () => {
  const buffer = [reading(1, { heartRateBpm: 60 }), reading(4, { heartRateBpm: 90 }), reading(9, { heartRateBpm: 120 })];
  assert.equal(readingAt(buffer, new Date(1_005_000).toISOString()).heartRateBpm, 90);
  assert.equal(readingAt([], new Date().toISOString()), null);
});

test('relativeTime', () => {
  const now = 10_000_000;
  assert.equal(relativeTime(null, now), 'No readings yet');
  assert.equal(relativeTime(new Date(now - 2000).toISOString(), now), 'just now');
  assert.equal(relativeTime(new Date(now - 30000).toISOString(), now), '30 seconds ago');
  assert.equal(relativeTime(new Date(now - 180000).toISOString(), now), '3 min ago');
});

test('escalation: a critical event nobody accepted for 2 min is escalated; warnings and accepted ones never are', () => {
  const open = toCareEvent(alert(), 'p');
  const created = Date.parse(open.recordedAt);
  assert.equal(escalation(open, created + 30_000).escalated, false);
  assert.equal(escalation(open, created + ESCALATE_AFTER_MS).escalated, true);
  assert.equal(escalation(toCareEvent(alert({ status: 'acknowledged' }), 'p'), created + 999_999), null);
  assert.equal(escalation(toCareEvent(alert({ severity: 'warning' }), 'p'), created + 999_999), null);
  assert.equal(waitLabel(134_000), '2:14');
});

test('a resolved alert is a closed event with its note', () => {
  const closed = toCareEvent(alert({ status: 'resolved', resolutionNote: 'Helped up', resolvedAt: new Date(1_100_000).toISOString() }), 'p');
  assert.equal(closed.status, 'closed');
  assert.equal(closed.resolutionNote, 'Helped up');
  assert.equal(toCareEvent(alert({ type: 'DEVICE_ALERT', detail: 'NOT_WORN', severity: 'warning' }), 'p').title, 'Wristband not worn');
  assert.equal(toCareEvent(alert({ type: 'DEVICE_ALERT', detail: 'OFFLINE', severity: 'warning' }), 'p').type, 'Wristband');
});

test('handover lists the last 12 hours, open and closed, and shares as text', () => {
  const now = 1_005_000 + 3600_000;
  const events = [
    toCareEvent(alert({ id: 'a' }), 'p'),
    toCareEvent(alert({ id: 'b', status: 'resolved', resolutionNote: 'No injury' }), 'p'),
    toCareEvent(alert({ id: 'old', createdAt: new Date(1_005_000 - 13 * 3600_000).toISOString() }), 'p'),
  ];
  const h = handover(events, now);
  assert.equal(h.total, 2);
  assert.equal(h.open.length, 1);
  assert.equal(h.closed.length, 1);
  const text = handoverText(events, () => 'Alex', now);
  assert.match(text, /2 events, 1 still open/);
  assert.match(text, /No injury/);
});
