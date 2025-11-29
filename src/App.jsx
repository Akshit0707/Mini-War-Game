import React, { useState } from 'react'
import Game from './components/Game'
import useStore from './store'

export default function App(){
  const [running, setRunning] = useState(false)
  const [blueCount, setBlueCount] = useState(8)
  const [redCount, setRedCount] = useState(8)
  const [speed, setSpeed] = useState(1)
  const credits = useStore(s => s.credits)
  const buyCredits = useStore(s => s.addCredits)

  return (
    <div className='app-root'>
      <nav className='topbar'>
        <div className='brand'>SPAAK — Modern Battlefield</div>
        <div className='top-actions'>
          <button onClick={()=>buyCredits(5)}>+5 Credits</button>
          <button onClick={()=>setRunning(r=>!r)}>{running? 'Pause':'Start'}</button>
        </div>
      </nav>
      <div className='layout'>
        <aside className='panel left'>
          <h2>Deployment Console</h2>
          <div className='stat-row'><span>Credits</span><strong>{credits}</strong></div>
          <div className='control-group'>
            <label>Blue units: <input type='number' min='0' max='40' value={blueCount} onChange={e=>setBlueCount(Number(e.target.value))} /></label>
            <label>Red units: <input type='number' min='0' max='40' value={redCount} onChange={e=>setRedCount(Number(e.target.value))} /></label>
            <label>Speed: <input type='range' min='0.25' max='3' step='0.25' value={speed} onChange={e=>setSpeed(Number(e.target.value))} /></label>
          </div>
          <div className='upgrades'>
            <h3>Upgrades</h3>
            <UpgradeRow/>
          </div>
        </aside>
        <main className='stage'>
          <Game running={running} blueCount={blueCount} redCount={redCount} speed={speed} />
        </main>
        <aside className='panel right'>
          <h3>Tactics</h3>
          <p>Click canvas to command units. Hold <em>Shift</em> for formation move.</p>
          <div className='formation-list'>
            <button onClick={()=>window.dispatchEvent(new CustomEvent('setFormation',{detail:'line'}))}>Line</button>
            <button onClick={()=>window.dispatchEvent(new CustomEvent('setFormation',{detail:'wedge'}))}>Wedge</button>
            <button onClick={()=>window.dispatchEvent(new CustomEvent('setFormation',{detail:'column'}))}>Column</button>
          </div>
          <hr/>
          <h4>Demo Notes</h4>
          <p>Production-grade styling, responsive HUD, and modular systems for easy extension.</p>
        </aside>
      </div>
      <footer className='footer'>Polished demo — Modern Battlefield theme</footer>
    </div>
  )
}

function UpgradeRow(){ 
  const upgrades = useStore(s=>s.upgrades)
  const credits = useStore(s=>s.credits)
  const buy = useStore(s=>s.buyUpgrade)
  return (
    <div className='upgrade-grid'>
      {['atk','hp','spd'].map(k=>(
        <div key={k} className='upgrade-card'>
          <div className='u-title'>{k.toUpperCase()}</div>
          <div className='u-level'>Level {upgrades[k]}</div>
          <button disabled={credits < (2 + upgrades[k]*2)} onClick={()=>buy(k)}>Buy</button>
        </div>
      ))}
    </div>
  )
}
