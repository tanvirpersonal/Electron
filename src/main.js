import './style.css';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
const $=s=>document.querySelector(s), viewport=$('#viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0c11');
const camera=new THREE.PerspectiveCamera(45,1,.1,1000);camera.position.set(7,6,8);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.outputColorSpace=THREE.SRGBColorSpace;viewport.appendChild(renderer.domElement);
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.set(0,.8,0);
scene.add(new THREE.HemisphereLight(0xbac8ff,0x28202e,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,9,6);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0x8a72ff,1.2);fill.position.set(-6,3,-4);scene.add(fill);
const grid=new THREE.GridHelper(20,40,0x49415e,0x242630);scene.add(grid);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());transform.addEventListener('dragging-changed',e=>orbit.enabled=!e.value);transform.addEventListener('objectChange',refreshFields);
let objects=[],selected=null,uniform=false,mirror=false,nextId=1;
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
function addObject(obj,name){obj.name=name+' '+nextId++;obj.traverse?.(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});scene.add(obj);objects.push(obj);select(obj);renderList();return obj}
function makeMaterial(){return new THREE.MeshStandardMaterial({color:0x9b83e6,roughness:.55,metalness:.12})}
function addPrimitive(type){
 const material=makeMaterial();let geometry,name,offset=0;
 switch(type){
  case 'cube':geometry=new THREE.BoxGeometry(1,1,1);name='Cube';offset=.5;break;
  case 'sphere':geometry=new THREE.SphereGeometry(.65,32,24);name='Sphere';offset=.65;break;
  case 'cylinder':geometry=new THREE.CylinderGeometry(.55,.55,1.2,32);name='Cylinder';offset=.6;break;
  case 'cone':geometry=new THREE.ConeGeometry(.65,1.3,32);name='Cone';offset=.65;break;
  case 'torus':geometry=new THREE.TorusGeometry(.55,.18,16,48);name='Torus';offset=.75;break;
  case 'plane':geometry=new THREE.PlaneGeometry(1.5,1.5);name='Plane';offset=.01;break;
  case 'capsule':geometry=new THREE.CapsuleGeometry(.35,.7,8,16);name='Capsule';offset=.7;break;
  case 'circle':geometry=new THREE.CircleGeometry(.7,48);name='Circle';offset=.01;break;
  case 'ring':geometry=new THREE.RingGeometry(.35,.7,48);name='Ring';offset=.01;break;
  case 'icosahedron':geometry=new THREE.IcosahedronGeometry(.7,1);name='Icosphere';offset=.7;break;
  case 'dodecahedron':geometry=new THREE.DodecahedronGeometry(.7,0);name='Dodecahedron';offset=.7;break;
  case 'octahedron':geometry=new THREE.OctahedronGeometry(.7,0);name='Octahedron';offset=.7;break;
  default:geometry=new THREE.BoxGeometry(1,1,1);name='Cube';offset=.5;
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.position.y=offset;addObject(mesh,name);toast(name+' added');
}
function addCube(){addPrimitive('cube')}
function select(o){selected=o;transform.attach(o);$('#empty-state').hidden=true;$('#properties').hidden=false;$('#selected-name').textContent=o.name;renderList();refreshFields()}
function renderList(){const list=$('#object-list');list.innerHTML='';objects.forEach(o=>{const b=document.createElement('button');b.className='object-item'+(o===selected?' selected':'');const icon=document.createElement('span');icon.className='cube-icon';icon.textContent='⬡';const label=document.createElement('span');label.textContent=o.name;b.append(icon,label);b.onclick=()=>select(o);list.append(b)});$('#object-count').textContent=objects.length+' OBJECT'+(objects.length===1?'':'S')}
function makeFields(id,axes,values,type){const host=$(id);host.innerHTML='';axes.forEach((axis,i)=>{const label=document.createElement('label');label.className='axis-field';const b=document.createElement('b');b.textContent=axis;b.style.color=['#e28d8d','#8fcf9c','#8da9ed'][i];const input=document.createElement('input');input.type='number';input.step=type==='rotation'?1:.1;input.value=Number(values[i].toFixed(3));input.addEventListener('change',()=>{if(!selected)return;let v=Number(input.value)||0;const target=type==='position'?selected.position:type==='rotation'?selected.rotation:selected.scale;if(type==='rotation')target[axis.toLowerCase()]=THREE.MathUtils.degToRad(v);else if(type==='scale'&&uniform){if(!mirror)v=Math.max(.001,v);selected.scale.setScalar(v)}else{if(type==='scale'&&!mirror)v=Math.max(.001,v);target[axis.toLowerCase()]=v}refreshFields()});label.append(b,input);host.append(label)})}
function refreshFields(){if(!selected)return;makeFields('#position-fields',['X','Y','Z'],[selected.position.x,selected.position.y,selected.position.z],'position');makeFields('#rotation-fields',['X','Y','Z'],[THREE.MathUtils.radToDeg(selected.rotation.x),THREE.MathUtils.radToDeg(selected.rotation.y),THREE.MathUtils.radToDeg(selected.rotation.z)],'rotation');makeFields('#scale-fields',['X','Y','Z'],[selected.scale.x,selected.scale.y,selected.scale.z],'scale');$('#scale-state').textContent=uniform?'UNIFORM':'FREE';$('#scale-hint').textContent=uniform?'Uniform mode: changing one axis updates all three axes.':'Scale each axis independently. Enable uniform scaling to resize proportionally.'}
function setMode(m){transform.setMode(m);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m))}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#uniform-toggle').onclick=()=>{uniform=!uniform;$('#uniform-toggle').setAttribute('aria-pressed',String(uniform));refreshFields()};
$('#mirror-toggle').onclick=()=>{mirror=!mirror;$('#mirror-toggle').setAttribute('aria-pressed',String(mirror));toast(mirror?'Mirror scaling enabled':'Mirror scaling disabled')};
$('#add-cube').onclick=()=>addCube();

$('#toggle-left').onclick=()=>{document.querySelector('.workspace').classList.toggle('hide-left');$('#toggle-left').classList.toggle('active',!document.querySelector('.workspace').classList.contains('hide-left'));requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false))};
$('#toggle-right').onclick=()=>{document.querySelector('.workspace').classList.toggle('hide-right');$('#toggle-right').classList.toggle('active',!document.querySelector('.workspace').classList.contains('hide-right'));requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false))};
async function toggleFullscreen(){
 const app=$('#app');
 try{
  if(!document.fullscreenElement){await app.requestFullscreen?.();app.classList.add('immersive');}
  else{await document.exitFullscreen();app.classList.remove('immersive');}
 }catch(e){app.classList.toggle('immersive');toast('Fullscreen mode toggled');}
 requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false));
}
$('#fullscreen-btn').onclick=toggleFullscreen;
document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;$('#app').classList.toggle('immersive',active);$('#fullscreen-btn').classList.toggle('active',active);requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false))});
$('#camera-reset').onclick=()=>{camera.position.set(7,6,8);orbit.target.set(0,.8,0);orbit.update();toast('Camera reset')};


$('#duplicate-btn').onclick=()=>{if(!selected)return;const c=selected.clone(true);c.position.x+=1;addObject(c,selected.name+' copy');toast('Object duplicated')};
$('#delete-btn').onclick=()=>{if(!selected)return;scene.remove(selected);objects=objects.filter(o=>o!==selected);transform.detach();selected=null;$('#properties').hidden=true;$('#empty-state').hidden=false;renderList();toast('Object deleted')};
$('#focus-btn').onclick=()=>{if(!selected)return;const box=new THREE.Box3().setFromObject(selected),center=box.getCenter(new THREE.Vector3());orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(4,3,5))};
$('#grid-btn').onclick=()=>{grid.visible=!grid.visible;$('#grid-btn').classList.toggle('active',grid.visible)};
$('#new-scene').onclick=()=>{transform.detach();objects.forEach(o=>scene.remove(o));objects=[];selected=null;$('#properties').hidden=true;$('#empty-state').hidden=false;renderList();toast('New empty scene')};
$('#import-btn').onclick=()=>$('#file-input').click();
$('#file-input').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);try{let obj;if(f.name.toLowerCase().endsWith('.obj'))obj=new OBJLoader().parse(await f.text());else obj=(await new GLTFLoader().loadAsync(url)).scene;addObject(obj,f.name.replace(/\.[^.]+$/,''));toast('Imported '+f.name)}catch(err){console.error(err);toast('Could not import file')}finally{URL.revokeObjectURL(url);e.target.value=''}};
$('#export-btn').onclick=()=>{const out=new THREE.Scene();objects.forEach(o=>out.add(o.clone(true)));new GLTFExporter().parse(out,async result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const data=await blob.arrayBuffer();if(window.electronAPI?.saveFile){const saved=await window.electronAPI.saveFile({data:Array.from(new Uint8Array(data)),defaultName:'electron-scene.glb'});if(!saved.canceled)toast('GLB exported successfully')}else if(navigator.canShare?.({files:[new File([blob],'electron-scene.glb',{type:'model/gltf-binary'})]})){const file=new File([blob],'electron-scene.glb',{type:'model/gltf-binary'});await navigator.share({files:[file],title:'Export 3D model'});toast('GLB shared successfully')}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='electron-scene.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('GLB downloaded')}},err=>{console.error(err);toast('Export failed')},{binary:true})};
renderer.domElement.addEventListener('pointerdown',e=>{if(transform.axis)return;const r=renderer.domElement.getBoundingClientRect(),p=new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1),ray=new THREE.Raycaster();ray.setFromCamera(p,camera);const hits=ray.intersectObjects(objects,true);if(hits.length){let root=hits[0].object;while(root.parent&&!objects.includes(root))root=root.parent;select(root)}});
window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k==='w')setMode('translate');if(k==='e')setMode('rotate');if(k==='r')setMode('scale');if(e.key==='Delete')$('#delete-btn').click();if(e.key==='f')toggleFullscreen();if(e.key==='1')$('#toggle-left').click();if(e.key==='2')$('#toggle-right').click()});
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}).observe(viewport);
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)}animate();addCube();