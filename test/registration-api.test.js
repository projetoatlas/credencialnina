import test from 'node:test';
import assert from 'node:assert/strict';
import { submitRegistration } from '../public/registration-api.js';
const payload={photo:'data:image/jpeg;base64,test',avatar:'disco'};
test('Pages requires Google confirmation and preserves cropped photo',async()=>{
 const result=await submitRegistration(payload,{mode:'pages'},async(url,options)=>{
  assert.match(url,/^https:\/\/script.google.com/);
  assert.equal(options.headers['Content-Type'],'text/plain;charset=utf-8');
  assert.equal(JSON.parse(options.body).action,'register');
  return {ok:true,json:async()=>({ok:true,storage:'google',credential:{serial:'4006381333931'}})};
 });
 assert.equal(result.credential.photo,payload.photo);assert.equal(result.credential.avatar,'photo');assert.equal(result.credential.demo,false);
});
test('network/Google failures never create demo credentials',async()=>{
 for(const fetcher of [async()=>{throw new TypeError('offline')}, async()=>({ok:true,json:async()=>({ok:false,code:'SAVE_FAILED'})}), async()=>({ok:true,json:async()=>({ok:true,credential:{serial:'4006381333931'}})})]) {
  await assert.rejects(submitRegistration(payload,{mode:'pages'},fetcher));
 }
});
