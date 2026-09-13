import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshRecord, mutate, exportHtml } from './domain';
import { VEHICLES } from './vehicles';
test('BMW inspection and export preserve selected vehicle identity without Subaru findings',()=>{
 const bmw=freshRecord('bmw-330i-2021'),subaru=freshRecord();
 const changed=mutate(bmw,{type:'status',checkId:'left-front-door',status:'pass'});
 assert.equal(changed.vehicleId,'bmw-330i-2021');
 assert.equal(subaru.checks['left-front-door'].status,'not-inspected');
 const html=exportHtml(changed);
 assert.match(html,/2021 BMW 330i M Sport 2.0 AT/);
 assert.match(html,/RWD · Source vehicle J4W6XW8V4O/);
 assert.doesNotMatch(html,/<h2>2022 Subaru/);
 assert.equal(VEHICLES[0].id,bmw.vehicleId);
 assert.throws(()=>freshRecord('unknown'));
});
