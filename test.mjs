// Run with: npm test
import assert from 'node:assert';
import { cleanLead, resolvePath } from './server.mjs';

// Lead validation
const ok = { name: 'Sam', phone: '0412 345 678', email: 'sam@example.com', suburb: 'Parramatta', pests: ['termites', 'wasps', 'bogus'] };
assert.deepEqual(cleanLead(ok).lead.pests, ['termites', 'wasps']);
assert.ok(cleanLead({ ...ok, phone: '+61 412 345 678' }).lead);
assert.ok(cleanLead({ ...ok, phone: '02 9876 5432' }).lead);
assert.match(cleanLead({ ...ok, phone: '12345' }).error, /phone/);
assert.match(cleanLead({ ...ok, email: 'nope' }).error, /email/);
assert.match(cleanLead({ ...ok, name: '' }).error, /name/);
assert.match(cleanLead({ ...ok, suburb: '' }).error, /suburb/);

// Static file paths: bad escapes and folder escapes are refused, not crashed on
assert.equal(resolvePath('/%E0%A4%A'), null);
assert.equal(resolvePath('/..%2F..%2Fserver.mjs'), null);
assert.match(resolvePath('/'), /public\/index\.html$/);
assert.match(resolvePath('/handover'), /public\/handover\.html$/);

console.log('ok');
