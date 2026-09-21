import assert from 'node:assert/strict';
import test from 'node:test';
import {GardenLayout,LeafVariety} from '../wwwroot/garden-layout.mjs';
test('1000 plants stay present and have clear footprints',()=>{
 const layout=new GardenLayout();for(let i=0;i<1000;i++)layout.place(.45+(i%7)*.24);
 assert.equal(layout.items.length,1000);assert.ok(layout.extent>20);
 for(let i=0;i<layout.items.length;i++)for(let j=i+1;j<layout.items.length;j++){const a=layout.items[i],b=layout.items[j];assert.ok(Math.hypot(a.x-b.x,a.z-b.z)>=a.radius+b.radius+.6499);}
 const first=layout.items[0];layout.place(2);assert.equal(layout.items[0],first);
});
test('exactly two of each five plants have leaves',()=>{
 const variety=new LeafVariety();for(let i=0;i<100;i++)assert.equal(Array.from({length:5},()=>variety.next()).filter(Boolean).length,2);
});
test('only explicit clear removes plants and resets placement',()=>{
 const layout=new GardenLayout();layout.place(1);layout.place(2);layout.clear();assert.equal(layout.items.length,0);assert.deepEqual(layout.place(1),{x:0,z:0,radius:1});
});
