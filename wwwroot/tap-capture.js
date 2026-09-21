// The AudioContext resamples microphone input to 16 kHz. Transfer mono PCM, not sound-level guesses.
class TapCapture extends AudioWorkletProcessor {
    constructor() { super(); this.block=new Int16Array(512);this.index=0;this.sequence=0;this.peak=0; }
    process(inputs, outputs) {
        for(const output of outputs)for(const channel of output)channel.fill(0);
        const input=inputs[0]?.[0];if(!input)return true;
        for(const value of input){const x=Math.max(-1,Math.min(1,value));this.block[this.index++]=Math.round(x*32767);this.peak=Math.max(this.peak,Math.abs(x));
            if(this.index===512){this.port.postMessage({samples:this.block,sequence:this.sequence,peak:this.peak},[this.block.buffer]);this.sequence+=512;this.block=new Int16Array(512);this.index=0;this.peak=0;}
        }
        return true;
    }
}
registerProcessor('tap-capture',TapCapture);
