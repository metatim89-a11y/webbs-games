(function(){
  const out = document.createElement('div'); out.id='bot-result'; document.body.appendChild(out);
  let steps=0, idle=0, lastSig='', maxStack=0, roulettes=0, swaps=0;
  const tick = () => {
    steps++;
    maxStack = Math.max(maxStack, drawStack);
    if (rouletteTarget) roulettes++;
    const sig = currentPlayer+'|'+myHand.length+'|'+JSON.stringify(discard)+'|'+drawStack+'|'+rouletteTarget+'|'+handHidden;
    idle = sig === lastSig ? idle+1 : 0; lastSig = sig;
    if (!active || steps > 6000 || idle > 60) {
      out.textContent = `RESULT active=${active} winner=${document.getElementById('winner-text').innerText.replace(/\n/g,' ')} steps=${steps} stuck=${idle>60} maxStack=${maxStack} rouletteTicks=${roulettes} turn=${currentPlayer} roulette=${rouletteTarget} hand=${myHand.length} info=${document.getElementById('turn-info').innerText} count=${document.getElementById('mercy-count').innerText}`;
      return;
    }
    const humanTurn = gameType === 'local' || currentPlayer === 'X';
    const picker = document.getElementById('color-picker-modal').style.display === 'grid';
    if (picker) selectWildColor(['red','blue','green','yellow'][Math.floor(Math.random()*4)]);
    else if (humanTurn) {
      if (handHidden) { handHidden = false; render(); }
      else {
        const i = myHand.findIndex(c => canPlay(c));
        if (i >= 0) handlePlayCard(i); else handleDraw();
      }
    }
    setTimeout(tick, 300);
  };
  setTimeout(tick, 500);
})();
