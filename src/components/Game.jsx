import React, { useRef, useEffect, useState } from 'react'
import useStore from '../store'

// Simple A* grid pathfinder
class Grid {
  constructor(cols, rows, cellW, cellH, obstacles=[]){
    this.cols=cols; this.rows=rows; this.cellW=cellW; this.cellH=cellH;
    this.obstacles = new Set(obstacles.map(o=>o[0]+','+o[1]))
  }
  inBounds(x,y){return x>=0&&y>=0&&x<this.cols&&y<this.rows}
  passable(x,y){return !this.obstacles.has(x+','+y)}
  neighbors(x,y){
    const dirs=[[1,0],[-1,0],[0,1],[0,-1]]
    const res=[]
    for(const d of dirs){ const nx=x+d[0], ny=y+d[1]; if(this.inBounds(nx,ny) && this.passable(nx,ny)) res.push([nx,ny]) }
    return res
  }
  toCell(p){ return [Math.floor(p.x/this.cellW), Math.floor(p.y/this.cellH)] }
  toCenter(c){ return { x: c[0]*this.cellW + this.cellW/2, y: c[1]*this.cellH + this.cellH/2 } }
  heuristic(a,b){ return Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]) }
  findPath(startPt, endPt){
    const start=this.toCell(startPt), goal=this.toCell(endPt)
    const key=a=>a[0]+','+a[1]
    const frontier=[start]
    const cameFrom={}; cameFrom[key(start)] = null
    const costSoFar={}; costSoFar[key(start)] = 0
    while(frontier.length){
      frontier.sort((A,B)=> (costSoFar[key(A)] + this.heuristic(A,goal)) - (costSoFar[key(B)] + this.heuristic(B,goal)))
      const current = frontier.shift()
      if(current[0]===goal[0] && current[1]===goal[1]) break
      for(const n of this.neighbors(current[0], current[1])){
        const nKey = key(n)
        const newCost = costSoFar[key(current)] + 1
        if(!(nKey in costSoFar) || newCost < costSoFar[nKey]){
          costSoFar[nKey] = newCost
          cameFrom[nKey] = current
          frontier.push(n)
        }
      }
    }
    // reconstruct
    const path=[]; let cur = goal; while(cur){ path.push(cur); cur = cameFrom[key(cur)] }
    path.reverse(); return path.map(c=>this.toCenter(c))
  }
}

// helpers
const dist = (a,b)=> Math.hypot(a.x-b.x, a.y-b.y)
const norm = (dx,dy)=> { const m = Math.hypot(dx,dy)||1; return {x:dx/m, y:dy/m} }

export default function Game({ running, blueCount, redCount, speed }){
  const canvasRef = useRef(null), miniRef = useRef(null)
  const stateRef = useRef({units:[],grid:null,last:0,particles:[]})
  const [formation, setFormation] = useState('line')
  const buyUpgrade = useStore(s=>s.buyUpgrade)
  const addCredits = useStore(s=>s.addCredits)

  // formation events
  useEffect(()=>{
    function onSet(e){ setFormation(e.detail) }
    window.addEventListener('setFormation', onSet)
    return ()=> window.removeEventListener('setFormation', onSet)
  },[])

  useEffect(()=>{
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    const DPR = window.devicePixelRatio || 1
    function resize(){ const w = canvas.clientWidth, h = canvas.clientHeight; canvas.width = Math.floor(w*DPR); canvas.height = Math.floor(h*DPR); ctx.setTransform(DPR,0,0,DPR,0,0) }
    resize(); window.addEventListener('resize', resize)
    return ()=> window.removeEventListener('resize', resize)
  },[])

  // init grid + units
  useEffect(()=>{
    const st = stateRef.current; const W=900, H=600; const cellW=20, cellH=20
    const cols = Math.floor(W/cellW), rows = Math.floor(H/cellH)
    // obstacles (strategically placed)
    const obs = []
    for(let x=8;x<cols-8;x+=10){
      obs.push([x, Math.floor(rows/2 - 3)])
      obs.push([x, Math.floor(rows/2 + 3)])
    }
    st.grid = new Grid(cols, rows, cellW, cellH, obs)
    // spawn units
    st.units = []
    let id=1
    for(let i=0;i<blueCount;i++){
      const x = 80 + (i%6)*28 + (i%3)*4
      const y = 120 + Math.floor(i/6)*34 + (i%4)*3
      st.units.push(makeUnit('blue', x, y, 'b'+id++))
    }
    for(let i=0;i<redCount;i++){
      const x = 820 - (i%6)*28 - (i%3)*4
      const y = 120 + Math.floor(i/6)*34 + (i%4)*3
      st.units.push(makeUnit('red', x, y, 'r'+id++))
    }
    st.last = performance.now()
  }, [blueCount, redCount])

  // make unit
  function makeUnit(team,x,y,id){
    const upgrades = {atk:0,hp:0,spd:0} // for demo only; can wire to store
    return {
      id, team, x,y, hp: 120 + upgrades.hp*12, maxHp:120 + upgrades.hp*12,
      atk: 14 + (team==='blue'? upgrades.atk*4:0), range:24,
      speed: 0.9 + (team==='blue'? upgrades.spd*0.08:0),
      path: [], target:null, selected:false
    }
  }

  // particles utility
  function spawnParticle(x,y,color){
    const st = stateRef.current; st.particles.push({x,y,life:0.6,age:0,dx:(Math.random()-0.5)*40,dy:(Math.random()-0.6)*40,color})
  }

  // click to command (formation if shift held)
  useEffect(()=>{
    const canvas = canvasRef.current
    function onClick(e){
      const rect = canvas.getBoundingClientRect(); const x = (e.clientX - rect.left); const y = (e.clientY - rect.top)
      const st = stateRef.current
      // find nearest selected/blue units; if none selected, select nearest blue
      const blues = st.units.filter(u=>u.team==='blue' && u.hp>0)
      // if shift - formation move all blue units
      if(e.shiftKey){
        const targets = computeFormationTargets(blues, {x,y}, formation)
        for(let i=0;i<blues.length;i++){
          const u = blues[i]; u.path = st.grid.findPath(u, targets[i % targets.length] || {x,y}); u.target = null
        }
      } else {
        // single-unit command: send nearest blue to point
        let best=1e9, pick=null
        for(const u of blues){ const d = Math.hypot(u.x-x,u.y-y); if(d<best){best=d;pick=u} }
        if(pick){ pick.path = st.grid.findPath(pick, {x,y}); pick.target = null }
      }
    }
    canvas.addEventListener('click', onClick)
    return ()=> canvas.removeEventListener('click', onClick)
  }, [formation])

  // compute formation targets (line / wedge / column)
  function computeFormationTargets(units, center, form){
    const n = Math.max(1, units.length)
    const targets = []
    if(form === 'line'){
      const spacing = 28; const startX = center.x - (n-1)/2*spacing
      for(let i=0;i<n;i++) targets.push({x: startX + i*spacing, y: center.y})
    } else if(form === 'wedge'){
      const layers = Math.ceil(n/2); let idx=0
      for(let r=0;r<layers;r++){
        for(let i=0;i<2 && idx<n;i++){ targets.push({x: center.x + (i?-1:1)*(r*22 + (i?6:0)), y: center.y + r*20}); idx++ }
      }
    } else { // column
      for(let i=0;i<n;i++) targets.push({x:center.x, y: center.y + i*26})
    }
    return targets
  }

  // game loop & rendering
  useEffect(()=>{
    let raf = null; const canvas = canvasRef.current; const ctx = canvas.getContext('2d')
    const mini = miniRef.current; const mctx = mini.getContext('2d')

    function step(now){
      const st = stateRef.current; const dt = Math.min(40, now - st.last)/1000 * speed; st.last = now
      // update when running
      if(running){
        // units AI movement + combat
        for(const u of st.units){
          if(u.hp <= 0) continue
          // acquire target if none
          if(!u.target || u.target.hp<=0){
            let nearest=null, bd=1e9
            for(const v of st.units){ if(v.team===u.team || v.hp<=0) continue; const d=dist(u,v); if(d<bd){bd=d;nearest=v} }
            if(nearest){ u.target = nearest; u.path = st.grid.findPath(u, nearest) }
          }
          // follow path
          if(u.path && u.path.length>0){
            const next = u.path[0]; const d = Math.hypot(u.x-next.x, u.y-next.y)
            if(d < 6) u.path.shift()
            else { const dir = norm(next.x-u.x, next.y-u.y); u.x += dir.x * u.speed * 60 * dt; u.y += dir.y * u.speed * 60 * dt }
          } else if(u.target){
            const d = dist(u, u.target)
            if(d > u.range){ const dir = norm(u.target.x - u.x, u.target.y - u.y); u.x += dir.x * u.speed * 60 * dt; u.y += dir.y * u.speed * 60 * dt }
            else { // attack
              u.target.hp -= u.atk * dt * (u.team==='blue'?1:0.9)
              spawnParticle(u.target.x + (Math.random()-0.5)*12, u.target.y + (Math.random()-0.5)*12, '#ffdd57')
            }
          }
        }
        // remove dead occasionally & reward credits
        for(const u of st.units){ if(u.hp>0 && u.hp<0) u.hp=0 }
        const before = st.units.length
        // small chance to cleanup corpses
        st.units = st.units.filter(u=> !(u.hp<=0 && Math.random()<0.02))
        if(st.units.length < before){ addCredits(1) }
      }

      // update particles
      for(const p of st.particles){ p.age += dt; p.x += p.dx * dt; p.y += p.dy * dt }
      st.particles = st.particles.filter(p=>p.age < p.life)

      // render
      const W = canvas.clientWidth, H = canvas.clientHeight
      ctx.clearRect(0,0,W,H)
      // background terrain styling
      const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#2e4b57'); g.addColorStop(1,'#1b2830'); ctx.fillStyle = g; ctx.fillRect(0,0,W,H)
      // draw obstacles as concrete blocks
      drawObstacles(ctx, st.grid)
      // draw paths (subtle)
      for(const u of st.units){ if(u.path && u.path.length>0){ ctx.beginPath(); ctx.moveTo(u.x,u.y); for(const p of u.path){ ctx.lineTo(p.x,p.y) }; ctx.strokeStyle='rgba(255,255,255,0.03)'; ctx.stroke() } }
      // units
      for(const u of st.units){
        drawUnit(ctx, u)
      }
      // particles
      for(const p of st.particles){ ctx.globalAlpha = 1 - (p.age/p.life); ctx.beginPath(); ctx.fillStyle = p.color; ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1 }
      // HUD overlay
      drawHUD(ctx, st.units)

      // mini-map
      drawMini(mini, st)

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return ()=> cancelAnimationFrame(raf)
  }, [running, speed])

  // small helper draw functions
  function drawObstacles(ctx, grid){
    if(!grid) return
    ctx.save()
    for(const key of grid.obstacles){
      const [cx,cy] = key.split(',').map(Number)
      const rectX = cx * grid.cellW, rectY = cy * grid.cellH
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(rectX, rectY, grid.cellW, grid.cellH)
      ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.strokeRect(rectX, rectY, grid.cellW, grid.cellH)
    }
    ctx.restore()
  }

  function drawUnit(ctx, u){
    // tank-like base for soldiers/tanks
    ctx.save()
    ctx.translate(u.x, u.y)
    // shadow
    ctx.beginPath(); ctx.ellipse(0,6,12,6,0,0,Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill()
    // body
    ctx.beginPath(); ctx.rect(-10,-8,20,14); ctx.fillStyle = u.team==='blue' ? '#2ab7ff' : '#ff6b6b'; ctx.fill()
    // turret
    ctx.beginPath(); ctx.rect(4,-6,10,4); ctx.fillStyle = '#1b1f23'; ctx.fill()
    // HP bar
    const hpRatio = Math.max(0, u.hp)/u.maxHp
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(-12, -14, 24, 5)
    ctx.fillStyle = '#00ff99'; ctx.fillRect(-12, -14, 24 * hpRatio, 5)
    ctx.restore()
  }

  function drawHUD(ctx, units){
    const aliveB = units.filter(u=>u.team==='blue' && u.hp>0).length
    const aliveR = units.filter(u=>u.team==='red' && u.hp>0).length
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(12,12,220,50)
    ctx.fillStyle = '#dff7ff'; ctx.font='14px sans-serif'; ctx.fillText('Blue: '+aliveB + '   Red: ' + aliveR, 24, 34)
    ctx.restore()
  }

  function drawMini(mini, st){
    const ctx = mini.getContext('2d'); const W = mini.width, H = mini.height
    ctx.clearRect(0,0,W,H); ctx.fillStyle = '#0b1114'; ctx.fillRect(0,0,W,H)
    // draw obstacles tiny
    const grid = st.grid
    if(grid){
      const sx = W / (grid.cols * grid.cellW), sy = H / (grid.rows * grid.cellH)
      for(const key of grid.obstacles){
        const [cx,cy] = key.split(',').map(Number)
        ctx.fillStyle = '#555'; ctx.fillRect(cx*grid.cellW*sx, cy*grid.cellH*sy, grid.cellW*sx, grid.cellH*sy)
      }
      for(const u of st.units){
        ctx.fillStyle = u.team==='blue' ? '#3ecbff' : '#ff9b9b'; ctx.fillRect(u.x * sx, u.y * sy, 3, 3)
      }
    }
  }

  // expose mini canvas ref and main canvas in render
  return (
    <div className='game-canvas-wrap'>
      <canvas ref={canvasRef} className='game-canvas' />
      <div className='hud-overlay pulse'>Modern Battlefield — MNC Demo</div>
      <canvas ref={miniRef} className='minimap' width={160} height={110} />
    </div>
  )
}
