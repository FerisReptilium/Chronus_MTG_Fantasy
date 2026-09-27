import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const state = {
  user: null,
  profile: null,
  campaigns: [],
  campaign: null,
  character: null,
  saveTimer: null,
  saving: false,
  channel: null,
  localKey: null
};

const ATTRS = ['forca','vigor','destreza','razao','astucia','perseveranca','manipulacao','presenca','vontade'];
const MANA = [
  ['Branco','W'],['Azul','U'],['Preto','B'],['Vermelho','R'],['Verde','G'],['Incolor','C']
];
const DEFAULT_SHEET = {
  inputs: { name:'', player:'', concept:'', race:'', manacolor:'', pers1:'', pers2:'', hab1:'', hab2:'', hab3:'', skillsList:'',
    shield:'0', xpCurrent:0, xpSpent:0, manaCurrent:0, manaMax:0, reserveCurrent:0,
    equipment:'', loreBackground:'', loreAllies:'', loreJournal:'',
    wpn1Name:'',wpn1Dmg:'',wpn2Name:'',wpn2Dmg:'',wpn3Name:'',wpn3Dmg:'',
    spl1Name:'',spl1Cost:'',spl2Name:'',spl2Cost:'',spl3Name:'',spl3Cost:'' },
  attrs: Object.fromEntries(ATTRS.map(a=>[a,'-'])),
  determination: 0,
  illumination: 'd4',
  conditions: {condFerido:false,condGrave:false,condIncap:false},
  mana: Object.fromEntries(MANA.map(([name])=>[name,[false,false,false,false,false]])),
  wounds: 0,
  theme: 'black',
  portrait: ''
};

function $(id){ return document.getElementById(id); }
function esc(v){ return String(v ?? '').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }

function mergeSheet(raw){
  const s = structuredClone(DEFAULT_SHEET);
  if (!raw) return s;
  if (raw.inputs) Object.assign(s.inputs, raw.inputs);
  if (raw.attrs) Object.assign(s.attrs, raw.attrs);
  if (raw.conditions) Object.assign(s.conditions, raw.conditions);
  if (raw.mana) {
    for (const k of Object.keys(s.mana)) if (Array.isArray(raw.mana[k])) s.mana[k] = raw.mana[k].slice(0,5).concat([false,false,false,false,false]).slice(0,5);
  }
  for (const k of ['determination','illumination','wounds','theme','portrait']) if (raw[k] !== undefined) s[k]=raw[k];
  return s;
}

function setSaveStatus(text, kind=''){
  const el=$('saveStatus'); if(!el)return;
  el.textContent = text;
  el.className = 'save-status ' + kind;
}

function localCacheKey(){
  return state.campaign ? 'chronus_mtg_campaign_' + state.campaign.id : 'chronus_mtg_guest';
}

function saveLocal(){
  try {
    localStorage.setItem(localCacheKey(), JSON.stringify(state.character || DEFAULT_SHEET));
    localStorage.setItem('chronus_mtg_last_campaign', state.campaign?.id || '');
  } catch(e){ console.warn('Cache local indisponível',e); }
}

function loadLocal(){
  try {
    const raw=localStorage.getItem(localCacheKey());
    return raw ? mergeSheet(JSON.parse(raw)) : mergeSheet(null);
  } catch(e){ return mergeSheet(null); }
}

function collectSheet(){
  const inputs={};
  document.querySelectorAll('[data-id]').forEach(el=>{
    if (el.matches('input[type="checkbox"]')) inputs[el.dataset.id]=el.checked;
    else inputs[el.dataset.id]=el.value;
  });
  const attrs={};
  document.querySelectorAll('[data-attr]').forEach(el=>attrs[el.dataset.attr]=el.value);
  const mana={};
  MANA.forEach(([name])=>{
    mana[name]=[1,2,3,4,5].map(n=>!!document.querySelector(`[data-mana="${name}-${n}"]`)?.checked);
  });
  return {
    inputs, attrs,
    determination:[...document.querySelectorAll('[data-rhombus]')].filter(x=>x.classList.contains('active')).length,
    illumination: document.querySelector('input[name="ilum"]:checked')?.value || 'd4',
    conditions:{
      condFerido:!!$('uiCondFerido')?.querySelector('input')?.checked,
      condGrave:!!$('uiCondGrave')?.querySelector('input')?.checked,
      condIncap:!!$('uiCondIncap')?.querySelector('input')?.checked
    },
    mana,
    wounds:[...document.querySelectorAll('.wound-box')].filter(x=>x.textContent==='X').length,
    theme: $('card')?.className.match(/theme-([a-z]+)/)?.[1] || 'black',
    portrait: $('portraitBox')?.style.backgroundImage || ''
  };
}

function renderSheet(raw){
  const s=mergeSheet(raw);
  document.querySelectorAll('[data-id]').forEach(el=>{
    const v=s.inputs[el.dataset.id];
    if(v===undefined)return;
    if(el.matches('input[type="checkbox"]')) el.checked=!!v; else el.value=v;
  });
  document.querySelectorAll('[data-attr]').forEach(el=>el.value=s.attrs[el.dataset.attr] || '-');
  document.querySelectorAll('[data-rhombus]').forEach((el,i)=>el.classList.toggle('active',i<s.determination));
  document.querySelectorAll('input[name="ilum"]').forEach(el=>el.checked=el.value===s.illumination);
  for(const [id,v] of Object.entries(s.conditions)){
    const el=document.querySelector(`[data-id="${id}"]`); if(el)el.checked=!!v;
  }
  renderMana(s.mana);
  renderWounds(s.wounds);
  setTheme(s.theme,false);
  if(s.portrait && s.portrait !== 'none') $('portraitBox').style.backgroundImage=s.portrait;
  processXP(false);
}

function renderMana(mana){
  const table=$('manaTable'); if(!table)return;
  table.innerHTML='<tr><th>Esfera</th><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>';
  MANA.forEach(([name,symbol])=>{
    const tr=document.createElement('tr');
    tr.innerHTML='<td class="mana-name"><span class="table-icon">'+symbol+'</span>'+name+'</td>'+[1,2,3,4,5].map(n=>`<td><input type="checkbox" data-mana="${name}-${n}"></td>`).join('');
    table.appendChild(tr);
    (mana?.[name]||[]).forEach((v,i)=>{const x=tr.querySelectorAll('input')[i];if(x)x.checked=!!v;});
  });
}

function renderWounds(count){
  const max=Math.max(1,parseInt($('maxHpDisplay')?.textContent||10,10));
  const c=$('woundContainer'); if(!c)return;
  c.innerHTML='';
  for(let i=0;i<max;i++){
    const b=document.createElement('div'); b.className='wound-box'; b.textContent=i<count?'X':''; b.dataset.wound=i;
    b.onclick=()=>{ b.textContent=b.textContent==='X'?'':'X'; scheduleSave(); };
    c.appendChild(b);
  }
}

function processXP(schedule=true){
  const xp=parseInt($('xpCurrent')?.value||0,10)||0;
  const level=Math.max(1,Math.floor(xp/1000)+1);
  if($('displayLevel'))$('displayLevel').textContent=level;
  if($('maxHpDisplay'))$('maxHpDisplay').textContent=10;
  renderWounds(Math.min(parseInt($('woundContainer')?.querySelectorAll('.wound-box')?.length||10), collectSheet().wounds));
  if(schedule)scheduleSave();
  return level;
}

function setTheme(theme,save=true){
  const card=$('card'); if(!card)return;
  card.className='mtg-card theme-'+theme;
  if(save)scheduleSave();
}

function switchTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
  $(id)?.classList.add('active'); btn?.classList.add('active');
}

function toggleRhombus(el){
  const n=parseInt(el.dataset.rhombus,10);
  document.querySelectorAll('[data-rhombus]').forEach((x,i)=>x.classList.toggle('active',i<=n && !el.classList.contains('active') || i<n && el.classList.contains('active')));
  scheduleSave();
}

function adjResource(id,delta){
  const el=$(id); if(!el)return;
  const max=id==='manaCurrent'?parseInt($('manaMax')?.value||999,10):999;
  el.value=Math.max(0,Math.min(max,parseInt(el.value||0,10)+delta)); scheduleSave();
}

function rollDie(sides){return Math.floor(Math.random()*sides)+1;}
function dieSides(v){return parseInt(String(v).replace('d',''),10)||0;}

function showRoll(title,result,breakdown){
  const t=$('rollToast'); if(!t)return;
  t.innerHTML=`<div class="toast-title">${esc(title)}</div><div class="toast-result">${result}</div><div class="toast-breakdown">${esc(breakdown)}</div>`;
  t.classList.add('show'); clearTimeout(showRoll.timer); showRoll.timer=setTimeout(()=>t.classList.remove('show'),4200);
}

async function logRoll(action,dice,result,breakdown){
  if(!state.campaign||!state.user)return;
  await supabase.from('dice_logs').insert({
    campaign_id:state.campaign.id,user_id:state.user.id,action_title:action,
    dice_pool:dice,roll_result:String(result),breakdown,is_gm_roll:state.profile?.role==='mestre',is_secret:false
  });
}

async function executePoolRoll(type='Teste',slot=''){
  if(document.querySelector('[data-id="condIncap"]')?.checked && type==='Teste'){showRoll('TESTE','—','Personagem incapacitado.');return;}
  const attr=document.querySelector('[data-attr="'+$('rollAttrSel').value+'"]')?.value||'d4';
  const normal=[dieSides(attr)];
  if($('chkPers')?.checked)normal.push(6);
  if($('chkHab')?.checked)normal.push(6);
  const penalty=($('condFerido')?.checked?1:0)+($('condGrave')?.checked?2:0);
  const usable=normal.slice(0,Math.max(1,normal.length-penalty));
  const rolls=usable.map(rollDie);
  let result=Math.max(...rolls);
  const det=$('chkDet')?.checked;
  let detRoll=null;
  if(det){detRoll=rollDie(12); result=Math.max(result,detRoll);}
  const detail=rolls.map((r,i)=>`${usable[i]}:${r}`).join(' | ')+(det?` | d12:${detRoll}`:'');
  showRoll(type,result,detail+(penalty?' | penalidade aplicada':''));
  await logRoll(type,usable.concat(det?['d12']:[]),result,detail);
}

function rollIllumination(){
  const d=document.querySelector('input[name="ilum"]:checked')?.value||'d4'; const r=rollDie(dieSides(d));
  showRoll('ILUMINAÇÃO',r,d);
  logRoll('Iluminação',[d],r,d);
}

async function manualSave(){ await saveCharacter(true); }

async function saveCharacter(manual=false){
  if(!state.user || !state.campaign || !supabase)return;
  state.character=collectSheet(); saveLocal();
  setSaveStatus(manual?'Salvando…':'Salvando…','saving');
  state.saving=true;
  const payload={
    campaign_id:state.campaign.id,user_id:state.user.id,
    character_name:state.character.inputs.name || 'Personagem sem nome',
    sheet_data:state.character
  };
  const {error}=await supabase.from('characters').upsert(payload,{onConflict:'campaign_id,user_id'});
  state.saving=false;
  if(error){console.error(error);setSaveStatus('● Erro ao salvar','error');return false;}
  setSaveStatus('● Salvo '+new Date().toLocaleTimeString('pt-BR'),'saved'); return true;
}

function scheduleSave(){
  state.character=collectSheet(); saveLocal();
  if(!state.user||!state.campaign)return;
  clearTimeout(state.saveTimer);
  setSaveStatus('● Alterações pendentes','saving');
  state.saveTimer=setTimeout(()=>saveCharacter(false),700);
}

async function loadCharacter(){
  if(!state.campaign||!state.user)return;
  const {data,error}=await supabase.from('characters').select('*').eq('campaign_id',state.campaign.id).eq('user_id',state.user.id).maybeSingle();
  if(error)console.warn(error);
  state.character=data?.sheet_data ? mergeSheet(data.sheet_data) : loadLocal();
  renderSheet(state.character);
  saveLocal();
}

async function loadCampaigns(){
  const {data,error}=await supabase.from('campaign_members').select('campaign_id,role,campaigns(id,name,invite_code,owner_id)').eq('user_id',state.user.id);
  if(error)throw error;
  state.campaigns=(data||[]).map(x=>({...x.campaigns,role:x.role}));
  const saved=localStorage.getItem('chronus_mtg_last_campaign');
  state.campaign=state.campaigns.find(x=>x.id===saved)||state.campaigns[0]||null;
  renderCampaigns();
}

function renderCampaigns(){
  const sel=$('campaignSelect'); if(!sel)return;
  sel.innerHTML=state.campaigns.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  if(state.campaign)sel.value=state.campaign.id;
  $('campaignInfo').innerHTML=state.campaign?`Campanha: <strong>${esc(state.campaign.name)}</strong> • Código: <strong>${esc(state.campaign.invite_code)}</strong> • ${state.campaign.role==='mestre'?'Mestre':'Jogador'}`:'Nenhuma campanha. Crie uma ou entre com código.';
  document.querySelectorAll('.portal-master-only').forEach(x=>x.style.display=state.campaign?.role==='mestre'?'':'none');
}

async function selectCampaign(id){
  state.campaign=state.campaigns.find(c=>c.id===id)||null;
  localStorage.setItem('chronus_mtg_last_campaign',state.campaign?.id||'');
  renderCampaigns();
  await loadCharacter();
  subscribeRealtime();
}

async function createCampaign(){
  const name=prompt('Nome da campanha:','CHRONUS MTG');
  if(!name?.trim())return;
  const {data,error}=await supabase.rpc('create_campaign',{p_name:name.trim()});
  if(error){alert(error.message);return;}
  await loadCampaigns(); await selectCampaign(data.id);
}

async function joinCampaign(){
  const code=prompt('Código de convite da campanha:');
  if(!code?.trim())return;
  const {error}=await supabase.rpc('join_campaign',{p_invite_code:code.trim()});
  if(error){alert(error.message);return;}
  await loadCampaigns();
  if(state.campaign)await selectCampaign(state.campaign.id);
}

async function showMasterPanel(){
  if(!state.campaign||state.campaign.role!=='mestre')return;
  const {data,error}=await supabase.from('campaign_members').select('user_id,role,created_at,profiles:user_id(email)').eq('campaign_id',state.campaign.id);
  const list=$('playersList'); if(error){list.textContent=error.message;return;}
  const ids=(data||[]).map(x=>x.user_id);
  const {data:chars}=await supabase.from('characters').select('user_id,character_name,updated_at').eq('campaign_id',state.campaign.id).in('user_id',ids);
  list.innerHTML=(data||[]).map(m=>{
    const c=(chars||[]).find(x=>x.user_id===m.user_id);
    return `<div class="player-row"><strong>${esc(m.role)}</strong><span>${esc(c?.character_name||'Sem ficha')}</span><small>${c?new Date(c.updated_at).toLocaleString('pt-BR'):'—'}</small></div>`;
  }).join('');
  $('masterPanel').classList.remove('portal-hidden');
}

async function uploadPortrait(file){
  if(!file||!state.user||!state.campaign)return;
  if(file.size>5*1024*1024){alert('A arte deve ter no máximo 5 MB.');return;}
  const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
  const path=`${state.user.id}/${state.campaign.id}/portrait.${ext}`;
  const {error}=await supabase.storage.from('character-art').upload(path,file,{upsert:true,contentType:file.type||'image/jpeg'});
  if(error){alert('Erro ao enviar arte: '+error.message);return;}
  const {data}=await supabase.storage.from('character-art').createSignedUrl(path,60*60*24*365);
  if(data?.signedUrl){$('portraitBox').style.backgroundImage=`url("${data.signedUrl}")`;scheduleSave();}
}

function exportSheet(){
  const data=JSON.stringify(collectSheet(),null,2);
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  a.download='chronus-mtg-ficha.json';a.click();URL.revokeObjectURL(a.href);
}

function importSheet(file){
  const r=new FileReader();r.onload=()=>{try{renderSheet(JSON.parse(r.result));scheduleSave();}catch{alert('JSON inválido.');}};r.readAsText(file);
}

function resetSheet(){
  if(!confirm('Limpar esta ficha? Isso substitui os dados atuais e será salvo na campanha.'))return;
  renderSheet(DEFAULT_SHEET);scheduleSave();
}

function subscribeRealtime(){
  if(state.channel) supabase.removeChannel(state.channel);
  if(!state.campaign)return;
  state.channel=supabase.channel('chronus-'+state.campaign.id)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'characters',filter:`campaign_id=eq.${state.campaign.id}`},payload=>{
      if(payload.new.user_id===state.user?.id && !state.saving){state.character=mergeSheet(payload.new.sheet_data);renderSheet(state.character);}
    }).subscribe();
}

function bind(){
  document.querySelectorAll('[data-id],[data-attr],input[name="ilum"],[data-mana]').forEach(el=>{
    el.addEventListener('change',()=>scheduleSave());
    el.addEventListener('input',()=>scheduleSave());
  });
  $('campaignSelect').onchange=e=>selectCampaign(e.target.value);
  $('newCampaignBtn').onclick=createCampaign;
  $('joinCampaignBtn').onclick=joinCampaign;
  $('masterPanelBtn').onclick=showMasterPanel;
  $('closeMasterPanel').onclick=()=>$('masterPanel').classList.add('portal-hidden');
  $('manualSaveBtn').onclick=manualSave;
  $('exportBtn').onclick=exportSheet;
  $('logoutBtn').onclick=async()=>{await supabase.auth.signOut();location.reload();};
  $('importBtn').onclick=()=>$('loadInput').click();
  $('loadInput').onchange=e=>e.target.files[0]&&importSheet(e.target.files[0]);
  $('portraitInput').onchange=e=>uploadPortrait(e.target.files[0]);
  $('loginBtn').onclick=login;
  $('signupBtn').onclick=signup;
  $('magicBtn').onclick=magicLink;
  document.querySelectorAll('.tab-btn').forEach((b,i)=>b.onclick=()=>switchTab(i?'tab-lore':'tab-main',b));
}

async function login(){
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error){$('authMessage').textContent=error.message;return;}
  await bootUser(data.user);
}

async function signup(){
  const email=$('authEmail').value.trim(),password=$('authPassword').value;
  if(password.length<6){$('authMessage').textContent='A senha precisa ter pelo menos 6 caracteres.';return;}
  const {data,error}=await supabase.auth.signUp({email,password});
  if(error){$('authMessage').textContent=error.message;return;}
  if(data.user&&!data.session){$('authMessage').textContent='Conta criada. Confirme o e-mail e depois entre.';return;}
  if(data.user)await bootUser(data.user);
}

async function magicLink(){
  const email=$('authEmail').value.trim(); if(!email)return;
  const {error}=await supabase.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin}});
  $('authMessage').textContent=error?error.message:'Link enviado. Confira seu e-mail.';
}

async function bootUser(user){
  state.user=user;
  const {data:profile}=await supabase.from('profiles').select('*').eq('id',user.id).maybeSingle();
  state.profile=profile||{role:'jogador'};
  $('portalGate').classList.add('portal-hidden');$('appShell').classList.remove('portal-hidden');
  $('userEmailLabel').textContent=user.email||'';
  setSaveStatus('● Conectado','saved');
  await loadCampaigns();
  if(state.campaign)await selectCampaign(state.campaign.id);
  else renderSheet(loadLocal());
}

async function init(){
  bind();
  if(!supabase){
    $('authMessage').textContent='Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
    return;
  }
  const {data}=await supabase.auth.getSession();
  if(data.session)await bootUser(data.session.user);
  supabase.auth.onAuthStateChange((_event,session)=>{if(session&&!state.user)bootUser(session.user);});
  renderMana(DEFAULT_SHEET.mana);renderWounds(0);
}

Object.assign(window,{switchTab,toggleRhombus,setTheme,adjResource,processXP,executePoolRoll,rollIllumination,resetSheet});
init();
