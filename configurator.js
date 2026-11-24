import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {RoomEnvironment} from './vendor/RoomEnvironment.js';
import {MeshoptDecoder} from './vendor/meshopt_decoder.module.js';

const $=s=>document.querySelector(s);
const paints={factory:['Исходный чёрный','#111216'],black:['Чёрный графит','#171b22'],green:['Глубокий зелёный','#164b35'],blue:['Синий металлик','#124d8c'],burgundy:['Бордовый','#662333'],sand:['Песочный','#ada18c']};
const tints={none:'Без дополнительной',light:'Лёгкая',dark:'Тёмная'};
const defaults={paint:'factory',finish:'gloss',tint:'none',polish:true};
const params=new URLSearchParams(location.search);
let comparing=false;let state={paint:Object.hasOwn(paints,params.get('paint'))?params.get('paint'):'factory',finish:params.get('finish')==='satin'?'satin':'gloss',tint:Object.hasOwn(tints,params.get('tint'))?params.get('tint'):'none',polish:params.get('polish')!=='0'};
let renderer,scene,camera,controls,model,bodyMaterial,beforeMaterial,glassMaterials=[],dirty=true,inView=true,autoRotate=false,loading=false,frameId,contextLost=false;
const stage=$('.car-stage'),canvas=$('#car-view'),target=new THREE.Vector3(0,.7,0);
function services(){const s=[];if(state.paint!=='factory'||state.finish==='satin')s.push(`Оклейка кузова: ${paints[state.paint][0].toLowerCase()}, ${state.finish==='satin'?'сатин':'глянец'}`);if(state.tint!=='none')s.push(`Тонировка: ${tints[state.tint].toLowerCase()}`);if(state.polish)s.push('Полировка кузова');return s;}
function selectionText(){return `FORMA · подбор услуг\nАвтомобиль для примерки: FORMA Sedan\nЦвет: ${paints[state.paint][0]}\nПоверхность: ${state.finish==='satin'?'Сатин':'Глянец'}\nТонировка: ${tints[state.tint]}\nПолировка: ${state.polish?'Да':'Нет'}\n\n${services().join('\n')||'Услуги пока не выбраны'}\n\nДемонстрационная визуализация. Стоимость после осмотра.\n${location.href}`;}
function update(){
  $('#paint-name').textContent=paints[state.paint][0];$('#tint-name').textContent=tints[state.tint];$('#polish').checked=state.polish;
  $('#polish-label').textContent=state.polish?'Чистый глубокий глянец':'Мутный лак и мелкие риски';
  for(const key of ['paint','finish','tint'])document.querySelectorAll(`[data-${key}]`).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===state[key])));
  $('#service-summary').replaceChildren(...(services().length?services():['Выберите услуги для обсуждения']).map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
  const url=new URL(location.href);for(const key of ['paint','finish','tint'])url.searchParams.set(key,state[key]);url.searchParams.set('polish',state.polish?'1':'0');history.replaceState(null,'',url);
  if(bodyMaterial){bodyMaterial.color.set(paints[state.paint][1]);const satin=state.finish==='satin';bodyMaterial.roughness=satin?.62:state.polish?.075:.58;bodyMaterial.metalness=satin?.28:.58;bodyMaterial.clearcoat=satin?.2:1;bodyMaterial.clearcoatRoughness=satin?.48:state.polish?.025:.55;bodyMaterial.bumpScale=!satin&&!state.polish?.045:0;}
  if(beforeMaterial){beforeMaterial.color.copy(bodyMaterial.color);beforeMaterial.bumpScale=.045;beforeMaterial.roughness=.58;beforeMaterial.clearcoatRoughness=.55;}
  glassMaterials.forEach(m=>{m.color.set(state.tint==='none'?'#8d9b9d':state.tint==='light'?'#3c464e':'#10161c');m.opacity=state.tint==='none'?.27:state.tint==='light'?.62:.91});
  dirty=true;
}
document.querySelectorAll('[data-paint],[data-finish],[data-tint]').forEach(b=>b.addEventListener('click',()=>{const key=['paint','finish','tint'].find(k=>b.dataset[k]);state[key]=b.dataset[key];if(key==='finish'&&state.finish==='satin'){comparing=false;$('#compare-polish').checked=false;$('.car-stage').classList.remove('is-comparing')}update()}));
$('#polish').addEventListener('change',e=>{state.polish=e.target.checked;comparing=false;$('#compare-polish').checked=false;$('.car-stage').classList.remove('is-comparing');update()});
$('#reset-config').addEventListener('click',()=>{comparing=false;$('#compare-polish').checked=false;$('.car-stage').classList.remove('is-comparing');state={...defaults};autoRotate=false;if(controls)controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false');update();setCamera('reset')});
$('#compare-polish').addEventListener('change',e=>{comparing=e.target.checked;$('.car-stage').classList.toggle('is-comparing',comparing);if(comparing){state.finish='gloss';state.polish=true;update()}dirty=true});
$('#save-config').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([selectionText()],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='FORMA — мой выбор.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#config-feedback').textContent='Подборка сохранена в файл'});
$('#discuss').addEventListener('click',e=>{try{sessionStorage.setItem('forma-config-selection',JSON.stringify({text:selectionText(),created:Date.now()}))}catch{e.preventDefault();$('#config-feedback').textContent='Не удалось перенести выбор. Скачайте подборку и приложите её при обращении.'}});

function scratchMap(){const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.fillStyle='#808080';ctx.fillRect(0,0,1024,1024);let seed=144;const rand=()=>((seed=(seed*16807)%2147483647)/2147483647);for(let i=0;i<600;i++){ctx.strokeStyle=`rgba(255,255,255,${.04+rand()*.18})`;ctx.lineWidth=.5;ctx.beginPath();const x=rand()*1024,y=rand()*1024;ctx.moveTo(x,y);ctx.bezierCurveTo(x+30,y+3,x+55,y-3,x+100+rand()*120,y+rand()*10);ctx.stroke()}const texture=new THREE.CanvasTexture(c);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,4);return texture;}
function softShadow(){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');const gradient=ctx.createRadialGradient(64,64,5,64,64,64);gradient.addColorStop(0,'rgba(0,0,0,.8)');gradient.addColorStop(.5,'rgba(0,0,0,.45)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);}
function init(){
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,matchMedia('(pointer:coarse)').matches?1.25:1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  scene=new THREE.Scene();scene.background=new THREE.Color('#151617');scene.fog=new THREE.Fog('#151617',14,35);
  camera=new THREE.PerspectiveCamera(33,1,.05,100);controls=new OrbitControls(camera,canvas);controls.target.copy(target);controls.enableDamping=true;controls.enablePan=false;controls.minPolarAngle=.5;controls.maxPolarAngle=Math.PI/2-.025;controls.autoRotateSpeed=.65;controls.addEventListener('change',()=>{dirty=true});controls.addEventListener('start',()=>{autoRotate=false;controls.autoRotate=false;$('#rotate').setAttribute('aria-pressed','false')});
  const room=new RoomEnvironment();const glow=new THREE.MeshBasicMaterial({color:0xffffff});for(const [x,y,z,w,h,rot] of [[-5,4,0,.35,6,Math.PI/2],[4,4,-2,.7,7,-Math.PI/2],[0,6,0,7,.5,0]]){const strip=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glow);strip.position.set(x,y,z);strip.rotation.y=rot;strip.lookAt(0,1,0);room.add(strip)}const pmrem=new THREE.PMREMGenerator(renderer);const env=pmrem.fromScene(room,.035);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xe4eaff,0x37332d,2.2));
  const key=new THREE.DirectionalLight(0xfff1d8,4);key.position.set(3,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.1,far:20});key.shadow.normalBias=.025;key.shadow.bias=-.00015;scene.add(key);
  const fill=new THREE.DirectionalLight(0xb7d0ff,2.5);fill.position.set(-4,3,-4);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xffffff,2);rim.position.set(-4,5,5);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#252628',roughness:.6,metalness:.25}));floor.rotation.x=-Math.PI/2;floor.position.y=-.025;floor.receiveShadow=true;scene.add(floor);
  const shadow=new THREE.Mesh(new THREE.PlaneGeometry(3.3,6.3),new THREE.MeshBasicMaterial({map:softShadow(),transparent:true,depthWrite:false,opacity:.7}));shadow.rotation.x=-Math.PI/2;shadow.position.y=-.012;scene.add(shadow);
  const resize=()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();setCamera('reset');dirty=true};new ResizeObserver(resize).observe(stage);
  $('#rotate').addEventListener('click',()=>{autoRotate=!autoRotate;controls.autoRotate=autoRotate;$('#rotate').setAttribute('aria-pressed',String(autoRotate));dirty=true});
  document.querySelectorAll('[data-camera]').forEach(b=>b.addEventListener('click',()=>setCamera(b.dataset.camera)));
  canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-'].includes(e.key))return;e.preventDefault();const offset=camera.position.clone().sub(target);const spherical=new THREE.Spherical().setFromVector3(offset);if(e.key==='ArrowLeft')spherical.theta-=.15;if(e.key==='ArrowRight')spherical.theta+=.15;if(e.key==='ArrowUp')spherical.phi=Math.max(.5,spherical.phi-.12);if(e.key==='ArrowDown')spherical.phi=Math.min(1.5,spherical.phi+.12);if(e.key==='+')spherical.radius=Math.max(controls.minDistance,spherical.radius*.9);if(e.key==='-')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.1);camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();dirty=true});
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();contextLost=true;$('#model-error').hidden=false;cancelAnimationFrame(frameId)});
  canvas.addEventListener('webglcontextrestored',()=>location.reload());
  new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(inView)dirty=true}).observe(stage);
  const clock=new THREE.Clock();function tick(){frameId=requestAnimationFrame(tick);const delta=Math.min(clock.getDelta(),.06);if(document.hidden||!inView||contextLost)return;controls.update(delta);if(dirty||autoRotate){
    if(comparing&&model&&beforeMaterial){const size=renderer.getSize(new THREE.Vector2());renderer.setScissorTest(true);model.traverse(o=>{if(o.isMesh&&o.material===bodyMaterial)o.material=beforeMaterial});renderer.setScissor(0,0,Math.floor(size.x/2),size.y);renderer.render(scene,camera);model.traverse(o=>{if(o.isMesh&&o.material===beforeMaterial)o.material=bodyMaterial});renderer.setScissor(Math.floor(size.x/2),0,Math.ceil(size.x/2),size.y);renderer.render(scene,camera);renderer.setScissorTest(false)}else renderer.render(scene,camera);dirty=false}}tick();
  loadModel();
}
function setCamera(view){if(!camera||!controls)return;const fit=Math.max(1,.95/camera.aspect);const positions={reset:[5.8,2.25,6.5],front:[0,1.5,9],side:[9,1.6,0],rear:[0,1.5,-9]};camera.position.copy(target).add(new THREE.Vector3(...(positions[view]||positions.reset)).multiplyScalar(fit));controls.minDistance=4.6*fit;controls.maxDistance=17*fit;controls.target.copy(target);controls.update();dirty=true;}
async function loadModel(){if(loading)return;loading=true;$('#model-error').hidden=true;$('#model-status').hidden=false;try{
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);const gltf=await loader.loadAsync('./assets/3d/sedan.glb',event=>{if(event.total)$('#model-progress').value=event.loaded/event.total*100});
  model=gltf.scene;model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model);const size=bounds.getSize(new THREE.Vector3());const scale=4.8/Math.max(size.x,size.z);model.scale.multiplyScalar(scale);model.updateMatrixWorld(true);const fitted=new THREE.Box3().setFromObject(model);const center=fitted.getCenter(new THREE.Vector3());model.position.x-=center.x;model.position.z-=center.z;model.position.y-=fitted.min.y;model.updateMatrixWorld(true);
  const normalized=new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());if(normalized.x>normalized.z){model.rotation.y+=Math.PI/2;model.updateMatrixWorld(true)}
  bodyMaterial=new THREE.MeshPhysicalMaterial({color:paints[state.paint][1],metalness:.58,roughness:.16,clearcoat:1,clearcoatRoughness:.045,envMapIntensity:1.1,bumpMap:scratchMap(),bumpScale:0});beforeMaterial=bodyMaterial.clone();beforeMaterial.roughness=.58;beforeMaterial.clearcoat=.28;beforeMaterial.clearcoatRoughness=.55;beforeMaterial.bumpScale=.045;
  let bodyCount=0;glassMaterials=[];
  model.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;const transform=m=>{
    const name=m.name.toLowerCase();if(name==='paint'||name==='paint_body'){bodyCount++;if(!o.geometry.attributes.uv){const p=o.geometry.attributes.position,uv=[];for(let i=0;i<p.count;i++)uv.push(p.getX(i)*.3,p.getZ(i)*.3);o.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2))}return bodyMaterial}
    if(name==='glass'){const g=new THREE.MeshPhysicalMaterial({color:'#8d9b9d',metalness:.1,roughness:.06,clearcoat:1,transparent:true,opacity:.27,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:1.3});glassMaterials.push(g);return g}
    m.envMapIntensity=.8;if(name.startsWith('rim_')){m.metalness=.86;m.roughness=.24;m.color.set('#939494')}
    if(name.includes('chrome')){m.color.set('#c2c3c4');m.metalness=.95;m.roughness=.16}
    if(name.includes('black')||name==='tire'||name.startsWith('trim_')){m.roughness=.45;m.color.set('#171819')}
    if(name.includes('caliper')){m.color.set('#af3728');m.metalness=.4;m.roughness=.35}
    if(name==='lens'){m.color.set('#788991');m.opacity=.4;m.roughness=.09;m.depthWrite=false}
    if(name==='light_front'){m.color.set('#d9e7ed');m.emissive?.set('#b3d5e4');m.emissiveIntensity=.45}
    return m;
  };o.material=Array.isArray(o.material)?o.material.map(transform):transform(o.material)});
  if(!bodyCount||!glassMaterials.length)throw new Error('Model material groups not found');
  scene.add(model);renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;update();setCamera('reset');$('#model-status').hidden=true;
}catch(error){console.error('FORMA model load:',error);$('#model-status').hidden=true;$('#model-error').hidden=false}finally{loading=false}}
$('#retry').addEventListener('click',()=>{if(!renderer||contextLost)location.reload();else loadModel()});
update();try{init()}catch(error){console.error('FORMA WebGL:',error);$('#model-status').hidden=true;$('#model-error').hidden=false}

if(params.get('embed')==='1'){document.body.classList.add('is-embedded');const report=()=>parent.postMessage({type:'forma-config-height',height:document.documentElement.scrollHeight},location.origin);new ResizeObserver(report).observe(document.body);window.addEventListener('load',report);$('#discuss').addEventListener('click',e=>{if(e.defaultPrevented)return;e.preventDefault();parent.postMessage({type:'forma-config-booking'},location.origin)});}
