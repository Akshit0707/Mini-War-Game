import create from 'zustand'

const useStore = create(set=>({ 
  credits: 8,
  addCredits: (n)=>set(s=>({credits: s.credits + n})),
  upgrades: { atk: 0, hp: 0, spd: 0 },
  buyUpgrade: (k)=> set(s=>{ const cost = 2 + s.upgrades[k]*2; if(s.credits < cost) return s; return { credits: s.credits - cost, upgrades: {...s.upgrades, [k]: s.upgrades[k]+1} } })
}))

export default useStore
