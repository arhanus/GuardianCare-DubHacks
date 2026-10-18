import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionEvent, eventStatus, eventDate, visibleEvents } from '../src/event-policy.ts';
const event = {id:'sos',personId:'self',title:'SOS',type:'SOS',time:'09:42',description:'Test',responding:false,status:'received'};
test('requires acceptance before closing and never reopens closed events', () => {
 assert.equal(transitionEvent(event, 'close'), event);
 const accepted = transitionEvent(event, 'accept');
 assert.equal(accepted.responding, true);
 assert.equal(accepted.status, 'accepted');
 const closed = transitionEvent(accepted, 'close');
 assert.equal(closed.status, 'closed');
 assert.equal(transitionEvent(closed, 'accept'), closed);
 assert.equal(event.status, 'received');
});
test('status does not depend on personal versus organization identity', () => {
 assert.equal(eventStatus(event), 'Needs response');
 assert.equal(eventStatus({...event,personId:'alex'}), 'Needs response');
 assert.match(eventDate(event), /Sample event/);
 assert.doesNotMatch(eventDate({...event,recordedAt:'2026-10-17T12:00:00Z'}), /Sample event/);
});

test('personal roles never mix owner and loved-one events', () => {
 const events = [event, {...event,id:'loved',personId:'loved-one'}, {...event,id:'patient',personId:'alex'}];
 assert.deepEqual(visibleEvents(events, 'personal', 'owner').map(item => item.id), ['sos']);
 assert.deepEqual(visibleEvents(events, 'personal', 'trusted').map(item => item.id), ['loved']);
 assert.equal(visibleEvents(events, 'organization', 'owner').length, 3);
 assert.equal(visibleEvents(events, undefined, 'owner').length, 0);
});
