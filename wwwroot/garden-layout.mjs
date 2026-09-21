// Unbounded outward search with spatial hashing. Positions are never reused or discarded.
export class GardenLayout {
    constructor(){this.clear();}
    clear(){this.cells=new Map();this.items=[];this.cursor=0;this.maxRadius=0;this.extent=2.5;}
    key(x,z){return `${x},${z}`;}
    place(radius){
        const step=4,clearance=.65;this.maxRadius=Math.max(this.maxRadius,radius);
        for(;;){const i=this.cursor++,angle=i*2.3999632297,r=Math.sqrt(i)*.5,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
            const cx=Math.floor(x/step),cz=Math.floor(z/step),reach=Math.ceil((radius+this.maxRadius+clearance)/step);let free=true;
            for(let dx=-reach;dx<=reach&&free;dx++)for(let dz=-reach;dz<=reach&&free;dz++){
                for(const other of this.cells.get(this.key(cx+dx,cz+dz))||[]){if(Math.hypot(x-other.x,z-other.z)<radius+other.radius+clearance){free=false;break;}}
            }
            if(!free)continue;
            const item={x,z,radius};this.items.push(item);const key=this.key(cx,cz);if(!this.cells.has(key))this.cells.set(key,[]);this.cells.get(key).push(item);this.extent=Math.max(this.extent,r+radius);return item;
        }
    }
}
export class LeafVariety {
    constructor(random=Math.random){this.random=random;this.bag=[];}
    next(){if(!this.bag.length){this.bag=[true,true,false,false,false];for(let i=4;i>0;i--){const j=Math.floor(this.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}return this.bag.pop();}
    clear(){this.bag=[];}
}
