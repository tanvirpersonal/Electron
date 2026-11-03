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
let objects=[],selected=null,selectedObjects=[],multiSelect=false,uniform=false,mirror=false,nextId=1;
let touchDrag=null,longPressTimer=null,contextTarget=null;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
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
  case 'tetrahedron':geometry=new THREE.TetrahedronGeometry(.7,0);name='Tetrahedron';offset=.7;break;
  case 'torus-knot':geometry=new THREE.TorusKnotGeometry(.48,.16,96,12);name='Torus Knot';offset=.7;break;
  case 'prism':geometry=new THREE.CylinderGeometry(.65,.65,1,3,1);name='Triangular Prism';offset=.5;break;
  case 'tube':geometry=new THREE.CylinderGeometry(.5,.5,1,32,1,true);name='Tube';offset=.5;break;
  default:geometry=new THREE.BoxGeometry(1,1,1);name='Cube';offset=.5;
 }
 const mesh=new THREE.Mesh(geometry,material);mesh.position.y=offset;addObject(mesh,name);toast(name+' added');
}
function addCube(){addPrimitive('cube')}
function select(o){selected=o;selectedObjects=[o];transform.attach(o);$('#empty-state').hidden=true;$('#properties').hidden=false;$('#selected-name').textContent=o.name;renderList();refreshFields();syncMaterialEditor()}
function toggleMultiSelection(o){if(!multiSelect){select(o);return}const i=selectedObjects.indexOf(o);if(i>=0){selectedObjects.splice(i,1);if(selected===o)selected=selectedObjects.at(-1)||null}else{selectedObjects.push(o);selected=o}if(selected){transform.attach(selected);$('#empty-state').hidden=true;$('#properties').hidden=false;$('#selected-name').textContent=selected.name;refreshFields()}else{transform.detach();$('#properties').hidden=true;$('#empty-state').hidden=false}renderList()}
$('#multi-select-btn').onclick=()=>{multiSelect=!multiSelect;$('#multi-select-btn').classList.toggle('active',multiSelect);if(!multiSelect&&selectedObjects.length>1)selectedObjects=[selected].filter(Boolean);renderList();syncMaterialEditor();toast(multiSelect?'Multi-select on: tap objects to add':'Multi-select off')};
function renderList(){const list=$('#object-list');list.innerHTML='';objects.forEach(o=>{const b=document.createElement('button');b.className='object-item'+(selectedObjects.includes(o)?' selected':'');const icon=document.createElement('span');icon.className='cube-icon';icon.textContent='⬡';const label=document.createElement('span');label.textContent=o.name;b.append(icon,label);b.onclick=()=>toggleMultiSelection(o);list.append(b)});$('#object-count').textContent=objects.length+' OBJECT'+(objects.length===1?'':'S')}
function makeFields(id,axes,values,type){const host=$(id);host.innerHTML='';axes.forEach((axis,i)=>{const label=document.createElement('label');label.className='axis-field';const b=document.createElement('b');b.textContent=axis;b.style.color=['#e28d8d','#8fcf9c','#8da9ed'][i];const input=document.createElement('input');input.type='number';input.step=type==='rotation'?1:.1;input.value=Number(values[i].toFixed(3));input.addEventListener('change',()=>{if(!selected)return;let v=Number(input.value)||0;const target=type==='position'?selected.position:type==='rotation'?selected.rotation:selected.scale;if(type==='rotation')target[axis.toLowerCase()]=THREE.MathUtils.degToRad(v);else if(type==='scale'&&uniform){if(!mirror)v=Math.max(.001,v);selected.scale.setScalar(v)}else{if(type==='scale'&&!mirror)v=Math.max(.001,v);target[axis.toLowerCase()]=v}refreshFields()});label.append(b,input);host.append(label)})}

function getSelectedMeshes(){
 const roots=selectedObjects.length?selectedObjects:(selected?[selected]:[]);
 const meshes=[];
 roots.forEach(root=>root.traverse(node=>{if(node.isMesh)meshes.push(node)}));
 return meshes;
}
function eachSelectedMaterial(callback){
 const meshes=getSelectedMeshes();
 if(!meshes.length)return false;
 meshes.forEach(mesh=>{
  const list=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  const updated=list.map(material=>{const copy=material.clone();callback(copy);return copy});
  mesh.material=Array.isArray(mesh.material)?updated:updated[0];
 });
 return true;
}
function syncMaterialEditor(){
 const meshes=getSelectedMeshes();
 const mats=meshes.flatMap(mesh=>Array.isArray(mesh.material)?mesh.material:[mesh.material]).filter(Boolean);
 const mat=mats[0];
 const color=mat?.color?.getHexString?.()||'9b83e6';
 $('#material-color').value='#'+color;
 $('#roughness-value').textContent=mat?.roughness==null?'—':mat.roughness.toFixed(2);
 $('#metalness-value').textContent=mat?.metalness==null?'—':mat.metalness.toFixed(2);
 $('#opacity-value').textContent=mat?.opacity==null?'—':mat.opacity.toFixed(2);
 $('#roughness-input').value=mat?.roughness??.55;
 $('#metalness-input').value=mat?.metalness??.12;
 $('#opacity-input').value=mat?.opacity??1;
}
function applyMaterialProperty(property,value){
 if(!eachSelectedMaterial(mat=>{
  if(property==='color'&&mat.color)mat.color.set(value);
  else if(property==='roughness'&&'roughness' in mat)mat.roughness=value;
  else if(property==='metalness'&&'metalness' in mat)mat.metalness=value;
  else if(property==='opacity'){mat.opacity=value;mat.transparent=value<.999;mat.depthWrite=value>=.999}
  mat.needsUpdate=true;
 }))return;
 syncMaterialEditor();
}
$('#material-color').addEventListener('input',e=>applyMaterialProperty('color',e.target.value));
[['roughness','roughness-input'],['metalness','metalness-input'],['opacity','opacity-input']].forEach(([property,id])=>{
 $('#'+id).addEventListener('input',e=>applyMaterialProperty(property,Number(e.target.value)));
});

function refreshFields(){if(!selected)return;makeFields('#position-fields',['X','Y','Z'],[selected.position.x,selected.position.y,selected.position.z],'position');makeFields('#rotation-fields',['X','Y','Z'],[THREE.MathUtils.radToDeg(selected.rotation.x),THREE.MathUtils.radToDeg(selected.rotation.y),THREE.MathUtils.radToDeg(selected.rotation.z)],'rotation');makeFields('#scale-fields',['X','Y','Z'],[selected.scale.x,selected.scale.y,selected.scale.z],'scale');$('#scale-state').textContent=uniform?'UNIFORM':'FREE';$('#scale-hint').textContent=uniform?'Uniform mode: changing one axis updates all three axes.':'Scale each axis independently. Enable uniform scaling to resize proportionally.'}
function setMode(m){transform.setMode(m);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m))}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
$('#uniform-toggle').onclick=()=>{uniform=!uniform;$('#uniform-toggle').setAttribute('aria-pressed',String(uniform));refreshFields()};
$('#mirror-toggle').onclick=()=>{mirror=!mirror;$('#mirror-toggle').setAttribute('aria-pressed',String(mirror));toast(mirror?'Mirror scaling enabled':'Mirror scaling disabled')};
const legacyAddButton=$('#add-cube');if(legacyAddButton)legacyAddButton.onclick=()=>addPrimitive($('#shape-select')?.value||'cube');
document.querySelectorAll('[data-shape]').forEach(button=>button.addEventListener('click',()=>addPrimitive(button.dataset.shape)));

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
function showHome(){if(document.fullscreenElement)document.exitFullscreen();$('#app').classList.remove('immersive');document.body.classList.add('home-view')}
function resumeScene(){document.body.classList.remove('home-view');requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false))}
$('#home-btn').onclick=showHome;
$('#resume-scene').onclick=resumeScene;
$('#home-new-scene').onclick=()=>{$('#new-scene').click();resumeScene()};


$('#duplicate-btn').onclick=()=>{if(!selectedObjects.length)return;const copies=selectedObjects.map(o=>{const c=o.clone(true);c.position.x+=1;return addObject(c,o.name+' copy')});selected=copies.at(-1);selectedObjects=copies;transform.attach(selected);renderList();toast(copies.length+' object(s) duplicated')};
$('#delete-btn').onclick=()=>{if(!selectedObjects.length)return;const removed=[...selectedObjects];removed.forEach(o=>scene.remove(o));objects=objects.filter(o=>!removed.includes(o));selectedObjects=[];selected=null;transform.detach();$('#properties').hidden=true;$('#empty-state').hidden=false;renderList();toast(removed.length+' object(s) deleted')};
$('#focus-btn').onclick=()=>{if(!selected)return;const box=new THREE.Box3().setFromObject(selected),center=box.getCenter(new THREE.Vector3());orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(4,3,5))};
$('#grid-btn').onclick=()=>{grid.visible=!grid.visible;$('#grid-btn').classList.toggle('active',grid.visible)};
$('#new-scene').onclick=()=>{transform.detach();objects.forEach(o=>scene.remove(o));objects=[];selected=null;selectedObjects=[];$('#properties').hidden=true;$('#empty-state').hidden=false;renderList();toast('New empty scene')};
$('#import-btn').onclick=()=>$('#file-input').click();
$('#file-input').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);try{let obj;if(f.name.toLowerCase().endsWith('.obj'))obj=new OBJLoader().parse(await f.text());else obj=(await new GLTFLoader().loadAsync(url)).scene;addObject(obj,f.name.replace(/\.[^.]+$/,''));toast('Imported '+f.name)}catch(err){console.error(err);toast('Could not import file')}finally{URL.revokeObjectURL(url);e.target.value=''}};
$('#export-btn').onclick=()=>{const out=new THREE.Scene();objects.forEach(o=>out.add(o.clone(true)));new GLTFExporter().parse(out,async result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const data=await blob.arrayBuffer();if(window.electronAPI?.saveFile){const saved=await window.electronAPI.saveFile({data:Array.from(new Uint8Array(data)),defaultName:'electron-scene.glb'});if(!saved.canceled)toast('GLB exported successfully')}else if(navigator.canShare?.({files:[new File([blob],'electron-scene.glb',{type:'model/gltf-binary'})]})){const file=new File([blob],'electron-scene.glb',{type:'model/gltf-binary'});await navigator.share({files:[file],title:'Export 3D model'});toast('GLB shared successfully')}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='electron-scene.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('GLB downloaded')}},err=>{console.error(err);toast('Export failed')},{binary:true})};
function hitObject(clientX,clientY){const r=renderer.domElement.getBoundingClientRect();pointerNdc.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointerNdc,camera);const hits=raycaster.intersectObjects(objects,true);if(!hits.length)return null;let root=hits[0].object;while(root.parent&&!objects.includes(root))root=root.parent;return root}
function planePoint(clientX,clientY,y){const r=renderer.domElement.getBoundingClientRect();pointerNdc.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointerNdc,camera);const plane=new THREE.Plane(new THREE.Vector3(0,1,0),-y),point=new THREE.Vector3();return raycaster.ray.intersectPlane(plane,point)?point:null}
function showContextMenu(o,x,y){contextTarget=o;const menu=$('#touch-context');menu.hidden=false;menu.style.left=Math.max(8,Math.min(x,innerWidth-150))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-130))+'px'}
function hideContextMenu(){$('#touch-context').hidden=true;contextTarget=null}
$('#ctx-close').onclick=hideContextMenu;
$('#ctx-duplicate').onclick=()=>{if(!contextTarget)return;const c=contextTarget.clone(true);c.position.x+=1;addObject(c,contextTarget.name+' copy');hideContextMenu();toast('Object duplicated')};
$('#ctx-delete').onclick=()=>{if(!contextTarget)return;const target=contextTarget;hideContextMenu();selectedObjects=[target];selected=target;$('#delete-btn').click()};
renderer.domElement.addEventListener('pointerdown',e=>{
 if(e.pointerType!=='touch'){const o=hitObject(e.clientX,e.clientY);if(o)toggleMultiSelection(o);return}
 if(e.isPrimary===false)return;
 if(transform.axis)return;
 if(touchDrag){touchDrag=null;clearTimeout(longPressTimer);orbit.enabled=true;return}
 const o=hitObject(e.clientX,e.clientY);if(!o)return;
 toggleMultiSelection(o);
 const start={x:e.clientX,y:e.clientY,obj:o,origin:o.position.clone(),planeY:o.position.y,moved:false};
 touchDrag=start;orbit.enabled=false;
 longPressTimer=setTimeout(()=>{if(touchDrag===start&&!start.moved){touchDrag=null;orbit.enabled=true;showContextMenu(o,e.clientX,e.clientY)}},560);
});
window.addEventListener('pointermove',e=>{
 if(!touchDrag||e.pointerType!=='touch')return;
 const dx=e.clientX-touchDrag.x,dy=e.clientY-touchDrag.y;
 if(Math.hypot(dx,dy)>7){touchDrag.moved=true;clearTimeout(longPressTimer)}
 if(!touchDrag.moved)return;
 const p=planePoint(e.clientX,e.clientY,touchDrag.planeY);if(!p)return;
 const offset=touchDrag.origin.clone().sub(planePoint(touchDrag.x,touchDrag.y,touchDrag.planeY)||touchDrag.origin);
 touchDrag.obj.position.copy(p.add(offset));if(touchDrag.obj===selected)refreshFields();
});
window.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&touchDrag){clearTimeout(longPressTimer);touchDrag=null;orbit.enabled=true}});
window.addEventListener('pointercancel',()=>{clearTimeout(longPressTimer);touchDrag=null;orbit.enabled=true});

window.addEventListener('keydown',e=>{if(['INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;const k=e.key.toLowerCase();if(k==='w')setMode('translate');if(k==='e')setMode('rotate');if(k==='r')setMode('scale');if(e.key==='Delete')$('#delete-btn').click();if(e.key==='f')toggleFullscreen();if(e.key==='1')$('#toggle-left').click();if(e.key==='2')$('#toggle-right').click()});
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}).observe(viewport);
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)}animate();addCube();