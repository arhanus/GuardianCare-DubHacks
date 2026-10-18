import test from 'node:test';
import assert from 'node:assert/strict';
import { rememberSOS } from '../src/sos-policy.ts';
test('rejects duplicate and invalid signals and bounds memory', () => {
 const seen = new Set();
 assert.equal(rememberSOS(seen, ''), false);
 assert.equal(rememberSOS(seen, 'x'.repeat(129)), false);
 assert.equal(rememberSOS(seen, 'one'), true);
 assert.equal(rememberSOS(seen, 'one'), false);
 for (let i=0;i<150;i++) rememberSOS(seen, `event-${i}`);
 assert.equal(seen.size, 100);
 assert.equal(rememberSOS(seen, 'event-149'), false);
});
