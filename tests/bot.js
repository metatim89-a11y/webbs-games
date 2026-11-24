// Plays Sorry automatically and reports into #bot-result
(function(){
  const out = document.createElement('div'); out.id='bot-result'; document.body.appendChild(out);
  const valid = (p, base) => p === -1 || (p >= 0 && p < 52) || (p >= base+1 && p <= base+6);
  let steps = 0, bad = [];
  const tick = () => {
    steps++;
    p1Pawns.forEach(p => { if (!valid(p,100)) bad.push('p1:'+p); });
    p2Pawns.forEach(p => { if (!valid(p,200)) bad.push('p2:'+p); });
    if (!active || steps > 20000 || bad.length) {
      out.textContent = `RESULT active=${active} winner=${document.getElementById('winner-text').innerText} steps=${steps} bad=${bad.slice(0,5)} p1=${p1Pawns} p2=${p2Pawns} turn=${document.getElementById('turn-info').innerText}`;
      return;
    }
    const cpuTurn = gameType === 'cpu' && currentPlayer === 'O';
    if (!isMoving && !cpuTurn) {
      if (!currentRoll) handleRoll();
      else { const sel = getSelectablePawns(); if (sel.length) handlePawnClick(currentPlayer === 'X' ? 'p1':'p2', sel[Math.floor(Math.random()*sel.length)]); }
    }
    setTimeout(tick, 100);
  };
  setTimeout(tick, 500);
})();
