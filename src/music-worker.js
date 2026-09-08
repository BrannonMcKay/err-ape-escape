import {parseMidi,renderPiano} from './midi.js';
self.onmessage=({data})=>{
  try{const rendered=renderPiano(parseMidi(data));self.postMessage(rendered,rendered.channels.map(channel=>channel.buffer));}
  catch(error){self.postMessage({error:error.message});}
};
