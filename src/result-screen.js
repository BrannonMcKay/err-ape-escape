const victoryPortrait=new URL('../assets/victory-christel-cat.png',import.meta.url).href;
const padVictoryPortrait=new URL('../assets/victory-leaky-pad.png',import.meta.url).href;
const outcomes={
  escape:{eyebrow:'EXIT FOUND · BEAUTIFULLY DONE',title:'You made it out.',points:'+5',note:'No churros eaten. A happy kitty. Five points for you.'},
  survived:{eyebrow:'TIME’S UP · YOU’RE STILL HERE',title:'Still standing. Still smug.',points:'+2',note:'You outlasted the clock. Stickman would like a rematch.'},
  caught:{eyebrow:'TAGGED · ROUND OVER',title:'A stick-y situation.',points:'+5',note:'One ridiculous tackle. One completely unnecessary grin. Stickman scores this round.'},
};
export function resultScreen(result,round,scores){
  const text={...outcomes[result]},victory=result==='escape';
  const portrait=round.leakyPad?padVictoryPortrait:victoryPortrait;
  const portraitAlt=round.leakyPad?'Christel holding Stubby in the Leaky Pad maze, surrounded by glowing pink hair and butterflies':'Illustration of Christel smiling cheek-to-cheek with her fluffy tabby cat in the woods';
  if(result==='caught'&&round.capture?.gloat){text.title=round.capture.gloat.headline;text.note=round.capture.gloat.line;}
  return `<div class="result-layout ${victory?'with-portrait':''}">${victory?`<figure class="victory-portrait"><img src="${portrait}" alt="${portraitAlt}"><figcaption>A PURR-FECT ESCAPE</figcaption></figure>`:''}<section class="result-copy"><span class="modal-eyebrow">${text.eyebrow}</span><h2 class="modal-title">${text.title}</h2><div class="score-result" style="${result==='caught'?'color:#e6aaa9':''}">${text.points}</div><p class="modal-lede">${text.note}</p><p class="result-note">${Math.round(round.elapsed)} seconds in the maze · ${round.settings.name} chase</p><div class="session-score"><span>YOUR SCORE <b>${scores.player}</b></span><span>STICKMAN <b>${scores.stickman}</b></span></div><div class="modal-buttons"><button id="again" class="primary">Run it back <b>↗</b></button><button id="result-home" class="secondary">Back to mazes</button></div>${scores.player>=5?'<p class="fineprint">Your screening-room unlocks are ready in the top menu.</p>':''}</section></div>`;
}
