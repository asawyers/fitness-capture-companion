import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVoice, voiceError } from '../lib/voice.ts';

test('microphone denial is actionable and a fresh session can retry', () => {
  const statuses: string[]=[]; const errors: string[]=[];
  let session: any;
  const factory = () => session = {lang:'',continuous:false,interimResults:false,onstart:null,onend:null,onerror:null,onresult:null,start(){ (this as any).onstart?.(); },stop(){(this as any).onend?.();},abort(){}};
  const callbacks = {onTranscript:(_s:string)=>{},onStatus:(s:string)=>statuses.push(s),onError:(s:string)=>errors.push(s)};
  startVoice(factory,callbacks);
  session.onerror({error:'not-allowed'}); session.onend();
  assert.match(errors[0],/microphone|permission/i);
  const retry = startVoice(factory,callbacks); retry.stop();
  assert.equal(statuses.at(-1),'idle'); assert.equal(statuses.filter(s=>s==='recording').length,2);
});
test('transcript snapshots replace interim results without duplication', () => {
  let session: any; const transcripts: string[]=[];
  startVoice(()=>session={lang:'',continuous:false,interimResults:false,onstart:null,onend:null,onerror:null,onresult:null,start(){},stop(){},abort(){}},{onTranscript:s=>transcripts.push(s),onStatus:()=>{},onError:()=>{}});
  session.onresult({results:[[{transcript:'two eggs'}]]});
  session.onresult({results:[[{transcript:'two eggs'}],[{transcript:'and rice'}]]});
  assert.deepEqual(transcripts,['two eggs','two eggs and rice']);
});
test('constructor/start failures and no speech leave typed capture available', () => {
  const errors: string[]=[]; const statuses: string[]=[];
  startVoice(()=>{throw new Error('device')},{onTranscript:()=>assert.fail('no transcript expected'),onStatus:s=>statuses.push(s),onError:s=>errors.push(s)});
  assert.equal(statuses.at(-1),'idle'); assert.equal(errors.length,1);
  assert.match(voiceError('no-speech'),/try again|type/i);
  assert.match(voiceError('network'),/network|connection/i);
});
