import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';
import { GardenLayout, LeafVariety } from './garden-layout.mjs';
import { createNoteWisps } from './garden-wisps.js?v=2';

export function createGarden(canvas) {
    const scene=new THREE.Scene(),renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});
    renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xf5f2e9,0);
    const camera=new THREE.PerspectiveCamera(42,1,.1,180),controls=new OrbitControls(camera,canvas);
    controls.enableDamping=true;controls.autoRotateSpeed=.45;controls.minDistance=4;controls.maxPolarAngle=Math.PI*.47;
    const layout=new GardenLayout(),variety=new LeafVariety(),plants=[],growing=[],bursts=[];
    const wisps=createNoteWisps(scene);
    let taps=0,trees=0,leafy=0,disposed=false,lastTime=0,pauseUntil=0,autoRotate=true,zoomTarget=0;
    const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
    const stemMaterial=new THREE.LineBasicMaterial({color:0x77826f,transparent:true,opacity:.9});
    const leafMaterial=new THREE.LineBasicMaterial({color:0x8caa7d,transparent:true,opacity:.85});
    const budSource=new THREE.IcosahedronGeometry(.064,0),budEdges=new THREE.EdgesGeometry(budSource);budSource.dispose();
    const budVertices=budEdges.attributes.position.array;
    const crystalSource=new THREE.IcosahedronGeometry(.145,0),crystalEdges=new THREE.EdgesGeometry(crystalSource);crystalSource.dispose();
    const crystalVertices=crystalEdges.attributes.position.array;
    function texture(leaf=false){const c=document.createElement('canvas');c.width=c.height=32;const p=c.getContext('2d');p.fillStyle='white';p.beginPath();
        if(leaf){p.moveTo(5,27);p.quadraticCurveTo(0,4,27,5);p.quadraticCurveTo(29,27,5,27);}else for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?3:15,x=16+Math.cos(a)*r,y=16+Math.sin(a)*r;i?p.lineTo(x,y):p.moveTo(x,y);}p.closePath();p.fill();return new THREE.CanvasTexture(c);}
    const starTexture=texture(),leafTexture=texture(true);
    function distance(){return Math.max(9,(layout.extent+1.2)/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))/Math.min(1,camera.aspect));}
    function updateBounds(){controls.maxDistance=Math.max(90,distance()*3);camera.far=Math.max(180,controls.maxDistance*2);camera.updateProjectionMatrix();ground.scale.setScalar(Math.max(1,layout.extent/6));}
    function resetView(){controls.target.set(0,.8,0);camera.position.copy(v(.48,.53,.75).normalize().multiplyScalar(distance()).add(controls.target));zoomTarget=distance();controls.update();}
    controls.addEventListener('start',()=>{pauseUntil=Infinity;zoomTarget=0;});controls.addEventListener('end',()=>{pauseUntil=performance.now()+2500;zoomTarget=0;});
    const groundGeometry=new THREE.BufferGeometry().setFromPoints(Array.from({length:361},(_,i)=>v((i%19-9)*.8,0,(Math.floor(i/19)-9)*.8)));
    const groundMaterial=new THREE.PointsMaterial({color:0xa7a893,size:.022,transparent:true,opacity:.3}),ground=new THREE.Points(groundGeometry,groundMaterial);scene.add(ground);
    // Merge every outline into three line batches per plant; no per-petal draw calls.
    function wire(plant,points,color='stem',closed=false){const target=plant.lines[color];for(let i=1;i<points.length;i++)target.push(...points[i-1].toArray(),...points[i].toArray());if(closed)target.push(...points.at(-1).toArray(),...points[0].toArray());}
    function bud(plant,at,geometric=false){const vertices=geometric?crystalVertices:budVertices;for(let i=0;i<vertices.length;i+=3)plant.lines.color.push(vertices[i]+at.x,vertices[i+1]+at.y,vertices[i+2]+at.z);plant.tips.push(at.clone());}
    function leaf(plant,origin,angle,length=.22){const direction=v(Math.cos(angle)*length,length*.7,Math.sin(angle)*length),side=v(-Math.sin(angle)*length*.35,0,Math.cos(angle)*length*.35),end=origin.clone().add(direction),mid=origin.clone().addScaledVector(direction,.52);wire(plant,[origin,mid.clone().add(side),end,mid.clone().sub(side)],'leaf',true);wire(plant,[origin,end],'leaf');}
    function flower(plant,at,type){
        if(type==='crystal'){bud(plant,at,true);return;}
        plant.tips.push(at.clone());
        if(type==='bell'){
            for(let j=0;j<5;j++){const a=j*Math.PI*2/5;wire(plant,[at.clone().add(v(0,.13)),at.clone().add(v(Math.cos(a)*.1,0,Math.sin(a)*.1)),at.clone().add(v(Math.cos(a)*.13,-.12,Math.sin(a)*.13))],'color');}
            wire(plant,Array.from({length:20},(_,j)=>at.clone().add(v(Math.cos(j*Math.PI/10)*.13,-.12,Math.sin(j*Math.PI/10)*.13))),'color',true);
        }else if(type==='star'){
            wire(plant,Array.from({length:10},(_,i)=>{const a=i*Math.PI/5+Math.PI/2,r=i%2?.075:.21;return at.clone().add(v(Math.cos(a)*r,Math.sin(a)*r,0));}),'color',true);bud(plant,at);
        }else{
            for(let j=0;j<7;j++){const a=j*Math.PI*2/7,points=[];for(let k=0;k<16;k++){const t=k*Math.PI*2/16,r=.105*(1-Math.cos(t)),width=Math.sin(t)*.045;points.push(at.clone().add(v(Math.cos(a)*r-Math.sin(a)*width,Math.sin(a)*r+Math.cos(a)*width,Math.sin(t)*.025)));}wire(plant,points,'color',true);}bud(plant,at);
        }
    }
    function makePlant(kind,size,color,position,radius,brightness,attack){
        const plant={kind,size,radius,position,group:new THREE.Group(),geometries:[],tips:[],born:performance.now(),duration:1800-attack*800,nextSpark:0,colorMaterial:new THREE.LineBasicMaterial({color,transparent:true,opacity:.97}),color,leaves:variety.next(),lines:{stem:[],color:[],leaf:[]}};
        plant.group.position.copy(position);plant.group.scale.setScalar(0);scene.add(plant.group);
        if(kind==='tree'){
            wire(plant,[v(),v(.025,.5),v(-.025,1),v(.02,1.6)]);bud(plant,v(.02,1.6));
            for(let i=0;i<7;i++){
                const y=.4+i*.145,a=i*2.4,width=.48*(1-i*.07)*(.75+brightness*.6),origin=v(0,y),fork=v(Math.cos(a)*width*.65,y+.24,Math.sin(a)*width*.65),tip=v(Math.cos(a)*width,y+.52,Math.sin(a)*width);
                wire(plant,[origin,fork,tip]);bud(plant,tip);const other=fork.clone().add(v(Math.cos(a+.8)*.18,.22,Math.sin(a+.8)*.18));wire(plant,[fork,other]);bud(plant,other);
                if(plant.leaves&&i%2===0)leaf(plant,fork,a+.8,.18);
            }
        }else{
            wire(plant,[v(),v(-.035,.45),v(.025,.95)]);flower(plant,v(.025,.95),kind);
            const left=v(-.23,.64,.08);wire(plant,[v(0,.35),left]);flower(plant,left,kind);
            if(kind==='bell'||kind==='crystal'){const right=v(.22,.78,-.08);wire(plant,[v(0,.5),right]);flower(plant,right,kind);}
            if(plant.leaves){leaf(plant,v(0,.3),.2);leaf(plant,v(0,.5),3.4,.17);}
        }
        if(plant.leaves)for(let i=0;i<3;i++)leaf(plant,v(0,.02),i*2.1,.3);
        for(const key of ['stem','color','leaf'])if(plant.lines[key].length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(plant.lines[key],3));plant.geometries.push(g);plant.group.add(new THREE.LineSegments(g,key==='color'?plant.colorMaterial:key==='leaf'?leafMaterial:stemMaterial));}
        delete plant.lines;return plant;
    }
    function removePlant(plant){scene.remove(plant.group);plant.geometries.forEach(g=>g.dispose());plant.colorMaterial.dispose();}
    function particles(plant,leaves=false){
        const count=leaves?6:18,positions=new Float32Array(count*3),velocities=[],origins=[];
        for(let i=0;i<count;i++){const origin=plant.tips[(i+Math.floor(Math.random()*plant.tips.length))%plant.tips.length].clone().multiplyScalar(plant.group.scale.x).add(plant.position);origins.push(origin);origin.toArray(positions,i*3);velocities.push(v((Math.random()-.5)*.6,-.08-Math.random()*.18,(Math.random()-.5)*.6));}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
        const material=new THREE.PointsMaterial({map:leaves?leafTexture:starTexture,color:leaves?0x97ae73:plant.color,size:leaves?.14:.1,transparent:true,opacity:1,depthWrite:false});
        const mesh=new THREE.Points(geometry,material);mesh.frustumCulled=false;scene.add(mesh);bursts.push({mesh,origins,velocities,born:performance.now(),leaves});
        // Only transient particles are recycled. No plant is ever deleted by new audio.
        if(bursts.length>40)disposeBurst(bursts.shift());
    }
    function disposeBurst(b){scene.remove(b.mesh);b.mesh.geometry.dispose();b.mesh.material.dispose();}
    function publish(last){canvas.dataset.taps=String(taps);canvas.dataset.trees=String(trees);canvas.dataset.plants=String(plants.length);canvas.dataset.leafy=String(leafy);canvas.dataset.extent=String(layout.extent);if(last)canvas.dataset.lastPlant=JSON.stringify({kind:last.kind,size:last.size,leaves:last.leaves});}
    function addTap(color,strength,kind='tree',size=.6+Math.max(0,Math.min(1,strength))*1.8,brightness=.3,attack=.5){
        if(disposed)return;if(!['tree','daisy','bell','star','crystal'].includes(kind))kind='daisy';
        size=Math.max(.6,Math.min(2.4,size));brightness=Math.max(0,Math.min(1,brightness));taps++;
        const radius=(kind==='tree'?.85:.58)*size,before=distance(),spot=layout.place(radius),position=v(spot.x,0,spot.z),plant=makePlant(kind,size,color,position,radius,brightness,Math.max(0,Math.min(1,attack)));
        plants.push(plant);growing.push(plant);if(kind==='tree')trees++;if(plant.leaves)leafy++;
        wisps.emit(position.clone().add(v(0,kind==='tree'?size*1.1:size*.7,0)),color,strength,layout.extent);
        updateBounds();if(distance()>before)zoomTarget=(zoomTarget||camera.position.distanceTo(controls.target))*distance()/before;
        publish(plant);
    }
    function clear(){plants.forEach(removePlant);plants.length=0;growing.length=0;bursts.forEach(disposeBurst);bursts.length=0;wisps.clear();layout.clear();variety.clear();taps=trees=leafy=0;canvas.dataset.lastPlant='';publish();updateBounds();resetView();}
    function resize(){const r=canvas.getBoundingClientRect();camera.aspect=Math.max(r.width,1)/Math.max(r.height,1);camera.fov=camera.aspect<1?54:42;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false);}
    const observer=new ResizeObserver(resize);observer.observe(canvas);resize();clear();
    renderer.setAnimationLoop(now=>{
        const dt=lastTime?Math.min(.05,(now-lastTime)/1000):0;lastTime=now;if(document.hidden)return;
        controls.autoRotate=autoRotate&&now>pauseUntil;controls.update(dt);
        if(zoomTarget>0&&pauseUntil!==Infinity){const current=camera.position.distanceTo(controls.target),next=THREE.MathUtils.lerp(current,zoomTarget,1-Math.exp(-dt*2));camera.position.sub(controls.target).multiplyScalar(next/current).add(controls.target);if(Math.abs(next-zoomTarget)<.01)zoomTarget=0;}
        for(let i=growing.length-1;i>=0;i--){const plant=growing[i],t=Math.min(1,(now-plant.born)/plant.duration);plant.group.scale.setScalar(plant.size*(1-(1-t)**3));if(t>.25&&now>plant.nextSpark){particles(plant);if(plant.leaves&&t>.6)particles(plant,true);plant.nextSpark=now+350;}if(t===1)growing.splice(i,1);}
        for(let i=bursts.length-1;i>=0;i--){const b=bursts[i],age=(now-b.born)/1000,lifetime=b.leaves?4.5:3;if(age>lifetime){disposeBurst(b);bursts.splice(i,1);continue;}const a=b.mesh.geometry.attributes.position;
            for(let j=0;j<b.origins.length;j++){const p=b.origins[j],vel=b.velocities[j];a.setXYZ(j,p.x+vel.x*age+Math.sin(age*(b.leaves?3:5)+j)*(b.leaves?.09:.025),Math.max(.012,p.y+vel.y*age-(b.leaves?.12:.22)*age*age),p.z+vel.z*age+Math.cos(age*3+j)*(b.leaves?.06:0));}a.needsUpdate=true;b.mesh.material.opacity=Math.max(0,1-age/lifetime)*(b.leaves?.9:.8+Math.sin(now*.014+i)*.2);
        }
        wisps.update(dt,layout.extent);const flight=wisps.inspect();canvas.dataset.noteLights=String(flight.lights);canvas.dataset.followers=String(flight.followers);canvas.dataset.trailDots=String(flight.trailDots);
        canvas.dataset.glitter=String(bursts.filter(b=>!b.leaves).length);canvas.dataset.fallingLeaves=String(bursts.filter(b=>b.leaves).length);renderer.render(scene,camera);
    });
    return {addTap,clear,resetView,setAutoRotate(value){autoRotate=value;},inspect(){return {plants:plants.length,placements:layout.items.map(p=>({...p})),leafy,flight:wisps.inspect(),drawCalls:renderer.info.render.calls};},dispose(){disposed=true;clear();wisps.dispose();observer.disconnect();controls.dispose();renderer.setAnimationLoop(null);stemMaterial.dispose();leafMaterial.dispose();budEdges.dispose();crystalEdges.dispose();starTexture.dispose();leafTexture.dispose();groundGeometry.dispose();groundMaterial.dispose();renderer.dispose();}};
}
