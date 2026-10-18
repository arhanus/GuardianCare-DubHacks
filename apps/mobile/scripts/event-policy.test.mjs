import test from 'node:test';
import assert from 'node:assert/strict';
import { transitionEvent, eventStatus, eventDate, visibleEvents, needsResponse } from '../src/event-policy.ts';
const event = {id:'sos',personId:'p-c',title:'SOS',type:'SOS',time:'09:42',description:'Test',responding:false,status:'received'};
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
test('status text and date label', () => {
 assert.equal(eventStatus(event), 'Needs response');
 assert.equal(eventStatus({...event,status:'accepted'}), 'In progress');
 assert.match(eventDate(event), /Test event/);
 assert.doesNotMatch(eventDate({...event,recordedAt:'2026-10-17T12:00:00Z'}), /Test event/);
});

test('a patient only sees events about their own wristband', () => {
 const events = [{...event,id:'mine',personId:'p-c'}, {...event,id:'other',personId:'p-a'}];
 assert.deepEqual(visibleEvents(events, 'patient', 'p-c').map(item => item.id), ['mine']);
 assert.equal(visibleEvents(events, 'nurse', 'p-c').length, 2);
 assert.equal(visibleEvents(events, undefined, 'p-c').length, 0);
});

test('needsResponse keeps only unanswered events', () => {
 const events = [event, {...event,id:'b',status:'accepted'}, {...event,id:'c',status:'closed'}];
 assert.deepEqual(needsResponse(events).map(item => item.id), ['sos']);
});
