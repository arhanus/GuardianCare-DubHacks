import test from 'node:test';
import assert from 'node:assert/strict';
import { appendReading, MAX_READINGS, toCareEvent, ringingEvents, series, pickHeartRate, readingAt, relativeTime, alertTitle } from '../src/live-policy.ts';

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
