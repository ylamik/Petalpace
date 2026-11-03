import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
const bootstrap=readFileSync(new URL('../public/theme-init.js',import.meta.url),'utf8')
test('appearance initializes from saved choice or system without account data',()=>{
  for(const [saved,system,expected] of [['dark',false,'dark'],['light',true,'light'],['system',true,'dark'],[null,false,'light'],['invalid',true,'dark']]){
    const document={documentElement:{dataset:{}}}
    runInNewContext(bootstrap,{document,localStorage:{getItem:()=>saved},matchMedia:()=>({matches:system})})
    assert.equal(document.documentElement.dataset.theme,expected)
  }
  const document={documentElement:{dataset:{}}}
  runInNewContext(bootstrap,{document,localStorage:{getItem:()=>{throw Error('blocked')}},matchMedia:()=>({matches:true})})
  assert.equal(document.documentElement.dataset.theme,'dark')
})
const css=readFileSync(new URL('../src/styles/index.css',import.meta.url),'utf8')
const vars=block=>Object.fromEntries([...block.matchAll(/--color-([\w-]+):\s*(#[a-f0-9]{6})/gi)].map(m=>[m[1],m[2]]))
const light=vars(css.match(/@theme \{([\s\S]*?)\}/)[1])
const dark={...light,...vars(css.match(/:root\[data-theme="dark"\] \{([\s\S]*?)\}/)[1])}
function luminance(hex){const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
for(const [name,palette] of [['light',light],['dark',dark]])test(`${name} theme primary text and status pairs meet 4.5:1 contrast`,()=>{
  for(const [ink,surface] of [['dark-blue','surface'],['dark-blue','canvas'],['gray','surface'],['gray','beige'],['link','surface'],['red','light-red'],['orange','light-orange'],['done-ink','done-badge'],['done-ink','done-card']])assert.ok(contrast(palette[ink],palette[surface])>=4.5,`${name} ${ink}/${surface}: ${contrast(palette[ink],palette[surface])}`)
  assert.ok(contrast('#ffffff',palette.blue)>=4.5)
  assert.ok(contrast('#ffffff',palette.danger)>=4.5)
})
