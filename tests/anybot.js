(function(){
  const out = document.createElement('div'); out.id='bot-result'; document.body.appendChild(out);
  const g = location.pathname.split('/games/')[1].split('/')[0];
  let steps=0, errs=[];
  window.addEventListener('error', e => errs.push(e.message));
  const rnd = a => a[Math.floor(Math.random()*a.length)];
  const tick = () => {
    steps++;
    if (!active || steps > 3000) {
      const extra = g==='mancala' ? board.join(',') : g==='357' ? piles.join(',') : g==='chutes-and-ladders' ? p1Pos+'/'+p2Pos : '';
      out.textContent = `RESULT ${g} ${gameType}: active=${active} winner=${document.getElementById('winner-text').innerText.replace(/\n/g,' ')} steps=${steps} errors=${errs.join(';')||'none'} ${extra}`;
      return;
    }
    const human = gameType !== 'cpu' || (g==='mancala' ? currentPlayer===0 : currentPlayer==='X');
    try {
      if (human) {
        if (g==='tic-tac-toe') { const e=board.map((v,i)=>v===''?i:-1).filter(i=>i>=0); if (e.length) handleCellClick(rnd(e)); }
        if (g==='357') { const r=piles.map((p,i)=>p>0?i:-1).filter(i=>i>=0); if (r.length){ const row=rnd(r); selectPiece(row, Math.floor(Math.random()*piles[row])); endTurn(); } }
        if (g==='mancala') { const pits=(currentPlayer===0?[0,1,2,3,4,5]:[7,8,9,10,11,12]).filter(p=>board[p]>0); if (pits.length && !isSowing) handlePitClick(rnd(pits)); }
        if (g==='black-hole') { const e=board.map((v,i)=>v===null?i:-1).filter(i=>i>=0); const nums=currentPlayer==='X'?p1Nums:p2Nums; if (e.length&&nums.length){ currentNum=rnd(nums); handleNodeClick(rnd(e)); } }
        if (g==='chutes-and-ladders') handleRoll();
      }
    } catch(e) { errs.push(e.message); }
    setTimeout(tick, 400);
  };
  setTimeout(tick, 1200);
})();
