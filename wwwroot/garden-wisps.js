import * as THREE from 'three';

// Transient note lights are independent of the permanent plants. All lights,
// trails and followers share five draw calls, even during a long performance.
export function createNoteWisps(scene) {
    const MAX_LIGHTS = 72, MAX_MOTES = 900, TRAIL = 28, STEP = .16;
    const lights = [], motes = [], batches = [], textures = [];
    const paper = new THREE.Color(0xf5f2e9);
    const position = new THREE.Vector3(), direction = new THREE.Vector3();
    const target = new THREE.Vector3(), tint = new THREE.Color();
    let elapsed = 0, trailClock = 0, released = 0;
    const random = (min, max) => min + Math.random() * (max - min);

    function texture(kind) {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'white';
        if (kind === 'glow') {
            const gradient = ctx.createRadialGradient(16,16,0,16,16,16);
            gradient.addColorStop(0,'#ffffff');
            gradient.addColorStop(.2,'#ffffffaa');
            gradient.addColorStop(1,'#ffffff00');
            ctx.fillStyle = gradient;
            ctx.fillRect(0,0,32,32);
        } else {
            ctx.beginPath();
            if (kind === 'fleck') {
                ctx.moveTo(25,5); ctx.lineTo(21,26); ctx.lineTo(15,19); ctx.lineTo(6,18);
            } else ctx.arc(16,16,12,0,Math.PI*2);
            ctx.closePath(); ctx.fill();
        }
        const result = new THREE.CanvasTexture(canvas);
        textures.push(result);
        return result;
    }
    const dotTexture = texture('dot'), glowTexture = texture('glow'), fleckTexture = texture('fleck');

    function batch(capacity, size, opacity, map) {
        const geometry = new THREE.BufferGeometry();
        const positions = new THREE.BufferAttribute(new Float32Array(capacity * 3),3);
        const colors = new THREE.BufferAttribute(new Float32Array(capacity * 3),3);
        positions.setUsage(THREE.DynamicDrawUsage); colors.setUsage(THREE.DynamicDrawUsage);
        geometry.setAttribute('position',positions); geometry.setAttribute('color',colors);
        geometry.setDrawRange(0,0);
        const material = new THREE.PointsMaterial({size,opacity,map,vertexColors:true,
            sizeAttenuation:false,transparent:true,depthWrite:false});
        const mesh = new THREE.Points(geometry,material);
        mesh.frustumCulled = false;
        scene.add(mesh);
        const result = {mesh,positions,colors,count:0};
        batches.push(result);
        return result;
    }
    const glows = batch(MAX_LIGHTS,24,.24,glowTexture);
    const heads = batch(MAX_LIGHTS,6,.96,dotTexture);
    const trails = batch(MAX_LIGHTS * TRAIL,1.8,.72,dotTexture);
    const dust = batch(MAX_MOTES,1.8,.58,dotTexture);
    const flecks = batch(MAX_MOTES,3.5,.44,fleckTexture);

    function point(batch, at, color) {
        const index = batch.count++;
        batch.positions.setXYZ(index,at.x,at.y,at.z);
        batch.colors.setXYZ(index,color.r,color.g,color.b);
    }
    function flush() {
        for (const batch of batches) {
            batch.mesh.geometry.setDrawRange(0,batch.count);
            batch.positions.needsUpdate = batch.colors.needsUpdate = true;
        }
    }
    function chooseTarget(light, extent) {
        const angle = random(0,Math.PI*2), radius = Math.sqrt(Math.random()) * Math.max(2.6,extent);
        light.target.set(Math.cos(angle)*radius,random(.3,3.8),Math.sin(angle)*radius);
        light.nextTurn = elapsed + random(2.5,5.5);
    }
    function emit(origin, color, strength, extent) {
        const noteColor = new THREE.Color(color);
        const count = 3 + Math.round(Math.max(0,Math.min(1,strength))*2);
        const newLights = [];
        for (let i=0; i<count; i++) {
            const phase = random(0,Math.PI*2);
            const light = {position:origin.clone(),velocity:new THREE.Vector3(Math.cos(phase),.3,Math.sin(phase)).multiplyScalar(.4),
                target:new THREE.Vector3(),color:noteColor.clone().offsetHSL((i-1)*.025,.12,-.06),
                phase,born:elapsed,lifetime:random(48,70),speed:random(.6,.9)+strength*.35,
                history:new Float32Array(TRAIL*3),cursor:0,length:1,nextTurn:0};
            origin.toArray(light.history,0);
            chooseTarget(light,extent);
            lights.push(light); newLights.push(light); released++;
        }
        // Recycling these temporary lights never removes flowers or trees.
        if (lights.length>MAX_LIGHTS) lights.splice(0,lights.length-MAX_LIGHTS);
        const countMotes = motes.length ? 35 : 100;
        for (let i=0; i<countMotes; i++) {
            const leader = newLights[i%newLights.length], angle = random(0,Math.PI*2);
            const radius = Math.sqrt(Math.random())*Math.max(2.8,extent);
            motes.push({leader,position:new THREE.Vector3(Math.cos(angle)*radius,random(.1,3.5),Math.sin(angle)*radius),
                offset:new THREE.Vector3(random(-1.8,1.8),random(-.8,1),random(-1.8,1.8)),
                phase:random(0,Math.PI*2),lag:Math.floor(random(6,TRAIL)),born:elapsed,
                lifetime:random(50,75),fleck:Math.random()<.35,
                color:noteColor.clone().lerp(new THREE.Color(0x8a9182),.58)});
        }
        if (motes.length>MAX_MOTES) motes.splice(0,motes.length-MAX_MOTES);
    }
    function update(dt, extent) {
        elapsed += dt;
        trailClock += dt;
        const sampleTrail = trailClock>=STEP;
        if (sampleTrail) trailClock %= STEP;
        for (const batch of batches) batch.count=0;

        for (let i=lights.length-1; i>=0; i--) {
            const light = lights[i], age=elapsed-light.born;
            if (age>light.lifetime) {lights.splice(i,1);continue;}
            if (elapsed>light.nextTurn || light.position.distanceToSquared(light.target)<.3) chooseTarget(light,extent);
            direction.subVectors(light.target,light.position).normalize();
            direction.x += Math.sin(elapsed*.9+light.phase)*.6;
            direction.y += Math.cos(elapsed*.7+light.phase)*.35;
            direction.z += Math.cos(elapsed*.8+light.phase)*.6;
            direction.normalize().multiplyScalar(light.speed);
            light.velocity.lerp(direction,1-Math.exp(-dt*1.3));
            light.position.addScaledVector(light.velocity,dt);
            light.position.y = Math.max(.15,light.position.y);
            if (sampleTrail) {
                light.cursor=(light.cursor+1)%TRAIL;
                light.position.toArray(light.history,light.cursor*3);
                light.length=Math.min(TRAIL,light.length+1);
            }
            const fade = Math.min(1,age*2,(light.lifetime-age)/6);
            tint.copy(paper).lerp(light.color,Math.max(0,fade));
            point(glows,light.position,tint); point(heads,light.position,tint);
            for (let j=1; j<light.length; j++) {
                position.fromArray(light.history,((light.cursor-j+TRAIL)%TRAIL)*3);
                tint.copy(paper).lerp(light.color,fade*(1-j/TRAIL)**.65);
                point(trails,position,tint);
            }
        }
        const liveLights = new Set(lights);
        for (let i=motes.length-1; i>=0; i--) {
            const mote = motes[i], age=elapsed-mote.born;
            if (age>mote.lifetime) {motes.splice(i,1);continue;}
            if (!liveLights.has(mote.leader) && lights.length) mote.leader=lights[i%lights.length];
            const light=mote.leader, lag=Math.min(mote.lag,light.length-1);
            target.fromArray(light.history,((light.cursor-lag+TRAIL)%TRAIL)*3).add(mote.offset);
            target.x += Math.sin(elapsed*.8+mote.phase)*.35;
            target.y = Math.max(.1,target.y+Math.cos(elapsed*.65+mote.phase)*.25);
            target.z += Math.cos(elapsed*.7+mote.phase)*.35;
            // Loose pursuit keeps the small followers scattered through the volume.
            mote.position.lerp(target,1-Math.exp(-dt*.22));
            const fade=Math.max(0,Math.min(1,age/1.5,(mote.lifetime-age)/7));
            tint.copy(paper).lerp(mote.color,fade);
            point(mote.fleck?flecks:dust,mote.position,tint);
        }
        flush();
    }
    function clear() {
        lights.length=motes.length=0; elapsed=trailClock=released=0;
        batches.forEach(batch=>batch.count=0); flush();
    }
    function inspect() {
        return {lights:lights.length,followers:motes.length,trailDots:trails.count,released};
    }
    function dispose() {
        clear();
        for (const batch of batches) {scene.remove(batch.mesh);batch.mesh.geometry.dispose();batch.mesh.material.dispose();}
        textures.forEach(texture=>texture.dispose());
    }
    return {emit,update,clear,inspect,dispose};
}
