import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceState, patientPriority, activeSOS } from '../src/patient-policy.ts';
import { sampleIndex } from '../src/chart-policy.ts';
const event = {id:'sos',personId:'alex',title:'SOS',type:'SOS',time:'09:42',description:'Test',responding:false,status:'received'};
test('unassigned hardware is distinct from offline', () => {
 assert.equal(deviceState({device:'Unassigned',connected:false}), 'unassigned');
 assert.equal(deviceState({device:'GC-1',connected:false}), 'offline');
 assert.equal(deviceState({device:'GC-1',connected:true}), 'connected');
});
test('accepted SOS stays ahead of device requests until closed', () => {
 const events = [{...event,status:'accepted',responding:true},{...event,id:'device',personId:'sam',type:'Device'}];
 assert.ok(patientPriority(events, 'alex') > patientPriority(events, 'sam'));
 assert.equal(activeSOS(events,'alex')?.status, 'accepted');
 assert.equal(patientPriority([{...event,status:'closed'}], 'alex'), 0);
 assert.ok(patientPriority([event], 'alex') > patientPriority(events, 'alex'));
});
test('chart taps select the nearest sample and clamp outside bounds', () => {
 assert.equal(sampleIndex(-10, 300, 12), 0);
 assert.equal(sampleIndex(12, 300, 12), 0);
 assert.equal(sampleIndex(288, 300, 12), 11);
 assert.equal(sampleIndex(500, 300, 12), 11);
 assert.equal(sampleIndex(150, 300, 7), 3);
 assert.equal(sampleIndex(10, 0, 7), 0);
 assert.equal(sampleIndex(NaN, 300, 7), 0);
 assert.equal(sampleIndex(150, 300, 1), 0);
});
