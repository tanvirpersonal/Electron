import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const $=s=>document.querySelector(s), viewport=$('#viewport');
const scene=new THREE.Scene();scene.background=new THREE.Color('#0b0c11');
const camera=new THREE.PerspectiveCamera(45,1,.1,1000);camera.position.set(7,6,8);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
const devicePixelRatioCap=()=>Math.min(window.devicePixelRatio||1,window.innerWidth<700?1.5:2);
renderer.setPixelRatio(devicePixelRatioCap());renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
renderer.domElement.style.touchAction='none';viewport.appendChild(renderer.domElement);
let viewportShading='solid',flatShading=false,studioPreset='studio',environmentTarget=null;
const originalWireframe=new WeakMap();
function setWireframe(enabled){
 objects.forEach(root=>root.traverse(node=>{if(!node.isMesh)return;const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(!material||!('wireframe'in material))return;if(enabled){if(!originalWireframe.has(material))originalWireframe.set(material,material.wireframe);material.wireframe=true;}else if(originalWireframe.has(material)){material.wireframe=originalWireframe.get(material);originalWireframe.delete(material);}material.needsUpdate=true;});}));
}
function setFlatShading(enabled){
 flatShading=enabled;
 objects.forEach(root=>root.traverse(node=>{if(!node.isMesh)return;const materials=Array.isArray(node.material)?node.material:[node.material];materials.forEach(material=>{if(material&&'flatShading'in material){material.flatShading=enabled;material.needsUpdate=true;}});}));
 $('#flat-shading-btn')?.classList.toggle('active',enabled);
}
function ensureStudioEnvironment(){
 if(environmentTarget)return;
 const generator=new THREE.PMREMGenerator(renderer);generator.compileEquirectangularShader();
 const room=new RoomEnvironment();environmentTarget=generator.fromScene(room,.04);scene.environment=environmentTarget.texture;
 generator.dispose();
}
function setStudioPreset(preset){
 studioPreset=preset;
 const presets={
  studio:{background:0x0b0c11,hemi:2.0,key:3.0,fill:1.2,exposure:1.08,shadow:1024},
  warm:{background:0x17110d,hemi:1.7,key:3.2,fill:.8,exposure:1.12,shadow:1024},
  cool:{background:0x0a111b,hemi:2.1,key:2.6,fill:1.6,exposure:1.05,shadow:1024},
  dramatic:{background:0x08080c,hemi:1.0,key:4.0,fill:.35,exposure:1.18,shadow:2048}
 };
 const p=presets[preset]||presets.studio;scene.background.setHex(p.background);
 scene.children.forEach(light=>{if(light.isHemisphereLight)light.intensity=p.hemi;else if(light.isDirectionalLight){if(light===key)light.intensity=p.key;else if(light===fill)light.intensity=p.fill;}});
 renderer.toneMappingExposure=p.exposure;key.shadow.mapSize.set(p.shadow,p.shadow);key.shadow.needsUpdate=true;
 document.querySelectorAll('[data-studio]').forEach(button=>button.classList.toggle('active',button.dataset.studio===preset));
}
function setViewportShading(mode){
 if(!['solid','material','wireframe','rendered'].includes(mode))return;
 viewportShading=mode;
 setWireframe(mode==='wireframe');
 const preview=mode==='material'||mode==='rendered';
 if(preview)ensureStudioEnvironment();
 scene.environment=preview&&environmentTarget?environmentTarget.texture:null;
 renderer.toneMapping=mode==='solid'||mode==='wireframe'?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=mode==='rendered'?1.18:1.08;
 key.castShadow=mode!=='wireframe';renderer.shadowMap.enabled=mode!=='wireframe';
 document.querySelectorAll('[data-shading]').forEach(button=>{button.classList.toggle('active',button.dataset.shading===mode);button.setAttribute('aria-pressed',String(button.dataset.shading===mode));});
 const status=$('#shading-status');if(status)status.textContent=({solid:'SOLID',material:'MATERIAL',wireframe:'WIREFRAME',rendered:'RENDERED'})[mode];
}
const orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.target.set(0,.8,0);
scene.add(new THREE.HemisphereLight(0xbac8ff,0x28202e,2));
const key=new THREE.DirectionalLight(0xffffff,3);key.position.set(5,9,6);key.castShadow=true;scene.add(key);
const fill=new THREE.DirectionalLight(0x8a72ff,1.2);fill.position.set(-6,3,-4);scene.add(fill);
const grid=new THREE.GridHelper(20,40,0x49415e,0x242630);scene.add(grid);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.18}));floor.rotation.x=-Math.PI/2;floor.position.y=-.012;floor.receiveShadow=true;scene.add(floor);
const transform=new TransformControls(camera,renderer.domElement);scene.add(transform.getHelper());let snapSettings={translation:false,rotation:false,scale:false,grid:.25,angle:15,step:.1};
function applySnapSettings(){
 transform.setTranslationSnap(snapSettings.translation?snapSettings.grid:null);
 transform.setRotationSnap(snapSettings.rotation?THREE.MathUtils.degToRad(snapSettings.angle):null);
 transform.setScaleSnap(snapSettings.scale?snapSettings.step:null);
 ['translation','rotation','scale'].forEach(key=>{const button=$('#snap-'+key);if(button)button.setAttribute('aria-pressed',String(snapSettings[key]))});
}
transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;if(e.value)recordHistory()});
transform.addEventListener('objectChange',handleTransformObjectChange);
let objects=[],selected=null,selectedObjects=[],multiSelect=false,uniform=false,mirror=false,nextId=1;
let touchDrag=null,longPressTimer=null,contextTarget=null;
const raycaster=new THREE.Raycaster(),pointerNdc=new THREE.Vector2();
const HISTORY_LIMIT=35;
let undoStack=[],redoStack=[],historyLocked=false,materialHistoryPending=false;
function cloneForHistory(source){
 const copy=source.clone(true);
 copy.traverse(node=>{
  if(!node.isMesh)return;
  const materials=Array.isArray(node.material)?node.material:[node.material];
  const cloned=materials.map(material=>material?.clone?.()||material);
  node.material=Array.isArray(node.material)?cloned:cloned[0];
 });
 return copy;
}
function objectPath(object){const path=[];let node=object;while(node&&node!==scene){const parent=node.parent;if(!parent)return null;path.unshift(parent.children.indexOf(node));node=parent}return path.length?path:null}
function resolveObjectPath(roots,path){if(!path?.length)return null;let node=roots[path[0]];for(let i=1;node&&i<path.length;i++)node=node.children[path[i]];return node||null}
function captureHistorySnapshot(){return {objects:objects.map(cloneForHistory),selection:selectedObjects.map(objectPath).filter(Boolean),activePath:objectPath(selected),nextId};}
function syncHistoryButtons(){
 const undoButton=$('#undo-btn'),redoButton=$('#redo-btn');
 if(undoButton){undoButton.disabled=undoStack.length===0;undoButton.setAttribute('aria-disabled',String(undoButton.disabled))}
 if(redoButton){redoButton.disabled=redoStack.length===0;redoButton.setAttribute('aria-disabled',String(redoButton.disabled))}
}
function recordHistory(){
 if(historyLocked)return;
 undoStack.push(captureHistorySnapshot());
 if(undoStack.length>HISTORY_LIMIT)undoStack.shift();
 redoStack.length=0;
 syncHistoryButtons();
}
function restoreHistorySnapshot(snapshot){
 historyLocked=true;
 try{
  objects.forEach(object=>scene.remove(object));
  objects=snapshot.objects;
  objects.forEach(object=>scene.add(object));
  nextId=snapshot.nextId;
  selectedObjects=snapshot.selection.map(path=>resolveObjectPath(objects,path)).filter(Boolean);
  selected=resolveObjectPath(objects,snapshot.activePath)||(selectedObjects.at(-1)||null);
  if(selected){
   if(!selectedObjects.includes(selected))selectedObjects.push(selected);
   attachCurrentSelection();
   $('#empty-state').hidden=true;
   $('#properties').hidden=false;
   $('#selected-name').textContent=selected.name;
   $('#selbar').hidden=false;
   $('#selbar-label').textContent=selected.name;
   document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=false);
   document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=true);
   refreshFields();syncMaterialEditor();
  }else{
   transform.detach();pivotHandle.visible=false;
   $('#properties').hidden=true;$('#empty-state').hidden=false;$('#selbar').hidden=true;
   document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=true);
   document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=false);
  }
  renderList();
 }finally{historyLocked=false}
 syncHistoryButtons();
}
function undo(){
 if(!undoStack.length)return;
 redoStack.push(captureHistorySnapshot());
 restoreHistorySnapshot(undoStack.pop());
 toast('Undo');
}
function redo(){
 if(!redoStack.length)return;
 undoStack.push(captureHistorySnapshot());
 if(undoStack.length>HISTORY_LIMIT)undoStack.shift();
 restoreHistorySnapshot(redoStack.pop());
 toast('Redo');
}
function clearHistory(){undoStack.length=0;redoStack.length=0;syncHistoryButtons()}
$('#undo-btn')?.addEventListener('click',undo);
$('#redo-btn')?.addEventListener('click',redo);
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2200)}
function addObject(obj,name,withHistory=true){if(withHistory)recordHistory();obj.name=name+' '+nextId++;obj.traverse?.(m=>{if(m.isMesh){m.castShadow=true;m.receiveShadow=true}});scene.add(obj);objects.push(obj);select(obj);renderList();return obj}
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
function select(o){selected=o;selectedObjects=[o];attachCurrentSelection();$('#empty-state').hidden=true;$('#properties').hidden=false;$('#selected-name').textContent=o.name;$('#selbar').hidden=false;$('#selbar-label').textContent=o.name;document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=false);document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=true);renderList();refreshFields();syncMaterialEditor();}
function toggleMultiSelection(o){if(!multiSelect){select(o);return}const i=selectedObjects.indexOf(o);if(i>=0){selectedObjects.splice(i,1);if(selected===o)selected=selectedObjects.at(-1)||null}else{selectedObjects.push(o);selected=o}if(selected){attachCurrentSelection();$('#empty-state').hidden=true;$('#properties').hidden=false;$('#selected-name').textContent=selected.name;$('#selbar').hidden=false;$('#selbar-label').textContent=selected.name;document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=false);document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=true);refreshFields();syncMaterialEditor()}else{transform.detach();pivotHandle.visible=false;$('#properties').hidden=true;$('#empty-state').hidden=false;$('#selbar').hidden=true;document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=true);document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=false)}renderList()}
$('#multi-select-btn').onclick=()=>{multiSelect=!multiSelect;$('#multi-select-btn').classList.toggle('active',multiSelect);if(!multiSelect&&selectedObjects.length>1)selectedObjects=[selected].filter(Boolean);renderList();syncMaterialEditor();toast(multiSelect?'Multi-select on: tap objects to add':'Multi-select off')};
function renderList(){
 const list=$('#object-list');list.innerHTML='';
 const makeRow=(o,depth=0)=>{
  const row=document.createElement('div');row.className='object-item'+(selectedObjects.includes(o)?' selected':'')+(!o.visible?' is-hidden':'')+(o.userData.editorLocked?' is-locked':'');row.style.paddingLeft=(7+depth*16)+'px';
  const selectButton=document.createElement('button');selectButton.type='button';selectButton.className='object-select';selectButton.title='Select '+o.name;
  const icon=document.createElement('span');icon.className='cube-icon';icon.textContent=o.isGroup?'▰':'⬡';
  const label=document.createElement('span');label.className='object-label';label.textContent=o.name;selectButton.append(icon,label);
  if(o.userData.editorLocked){const badge=document.createElement('span');badge.className='object-state';badge.textContent='LOCKED';selectButton.append(badge)}
  selectButton.addEventListener('click',()=>toggleMultiSelection(o));
  const actions=document.createElement('div');actions.className='object-actions';
  const action=(symbol,title,onClick)=>{const button=document.createElement('button');button.type='button';button.className='object-action';button.textContent=symbol;button.title=title;button.setAttribute('aria-label',title);button.addEventListener('click',e=>{e.stopPropagation();onClick()});actions.append(button)};
  action('✎','Rename '+o.name,()=>{const entered=window.prompt('Rename object',o.name);if(entered===null)return;const name=entered.trim().replace(/\s+/g,' ').slice(0,48);if(!name||name===o.name)return;recordHistory();o.name=name;if(selected===o){$('#selected-name').textContent=name;$('#selbar-label').textContent=name}renderList();toast('Object renamed')});
  action(o.visible?'◉':'⊘',o.visible?'Hide object':'Show object',()=>{recordHistory();o.visible=!o.visible;if(selected===o)attachCurrentSelection();renderList();toast(o.visible?'Object shown':'Object hidden')});
  action(o.userData.editorLocked?'▣':'⌑',o.userData.editorLocked?'Unlock object':'Lock object',()=>{recordHistory();o.userData.editorLocked=!o.userData.editorLocked;if(selected===o)attachCurrentSelection();renderList();toast(o.userData.editorLocked?'Object locked':'Object unlocked')});
  row.append(selectButton,actions);list.append(row);
  o.children.filter(child=>child.userData?.editorHierarchyNode).forEach(child=>makeRow(child,depth+1));
 };
 objects.forEach(o=>makeRow(o));$('#object-count').textContent=objects.length+' ROOT OBJECT'+(objects.length===1?'':'S');updateAlignControls();
}
function makeFields(id,axes,values,type){const host=$(id);host.innerHTML='';axes.forEach((axis,i)=>{const label=document.createElement('label');label.className='axis-field';const b=document.createElement('b');b.textContent=axis;b.style.color=['#e28d8d','#8fcf9c','#8da9ed'][i];const input=document.createElement('input');input.type='number';input.step=type==='rotation'?1:.1;input.value=Number(values[i].toFixed(3));input.addEventListener('change',()=>{if(!selected||selected.userData.editorLocked)return;recordHistory();let v=Number(input.value)||0;const target=type==='position'?selected.position:type==='rotation'?selected.rotation:selected.scale;if(type==='rotation')target[axis.toLowerCase()]=THREE.MathUtils.degToRad(v);else if(type==='scale'&&uniform){if(!mirror)v=Math.max(.001,v);selected.scale.setScalar(v)}else{if(type==='scale'&&!mirror)v=Math.max(.001,v);target[axis.toLowerCase()]=v}refreshFields()});label.append(b,input);host.append(label)})}

function getRootObject(object){let node=object;while(node.parent&&node.parent!==scene)node=node.parent;return node}
function groupSelected(){const chosen=[...new Set(selectedObjects.map(getRootObject))].filter(o=>objects.includes(o));if(chosen.length<2){toast('Select at least 2 root objects');return}recordHistory();const group=new THREE.Group();group.name='Group '+nextId++;group.userData.editorHierarchyNode=true;scene.add(group);chosen.forEach(object=>{object.userData.editorHierarchyNode=true;group.attach(object)});objects=objects.filter(object=>!chosen.includes(object));objects.push(group);select(group);toast('Grouped '+chosen.length+' objects')}
function ungroupSelected(){const groups=selectedObjects.filter(o=>o.isGroup&&o.children.some(child=>child.userData?.editorHierarchyNode));if(!groups.length){toast('Select a group to ungroup');return}recordHistory();const released=[];groups.forEach(group=>{const parent=group.parent;[...group.children].filter(child=>child.userData?.editorHierarchyNode).forEach(child=>{parent.attach(child);released.push(child)});if(parent===scene)objects=objects.filter(o=>o!==group);group.parent?.remove(group)});if(released.length){selectedObjects=released;selected=released.at(-1);attachCurrentSelection();$('#selected-name').textContent=selected.name;$('#selbar-label').textContent=selected.name;renderList();refreshFields();syncMaterialEditor();toast('Group separated')}}
function parentSelected(){const parent=selected;if(!parent||selectedObjects.length<2){toast('Select children first, then the parent last');return}const children=selectedObjects.filter(o=>o!==parent);if(children.some(child=>child===parent||child.getObjectById(parent.id))){toast('Cannot create a parenting cycle');return}const valid=children.filter(child=>objects.includes(getRootObject(child))&&!parent.getObjectById(child.id));if(!valid.length){toast('No valid child objects selected');return}recordHistory();valid.forEach(child=>{const root=getRootObject(child);parent.attach(child);if(root===child)objects=objects.filter(o=>o!==root);child.userData.editorHierarchyNode=true});selectedObjects=[parent];selected=parent;attachCurrentSelection();renderList();toast(valid.length+' child object(s) parented')}
$('#group-btn')?.addEventListener('click',groupSelected);$('#ungroup-btn')?.addEventListener('click',ungroupSelected);$('#parent-btn')?.addEventListener('click',parentSelected);
function selectedEditableObjects(){return selectedObjects.filter(object=>{let root=object;while(root.parent&&root.parent!==scene)root=root.parent;return objects.includes(root)&&!object.userData.editorLocked&&object.visible})}
function updateAlignControls(){
 const count=selectedEditableObjects().length;
 document.querySelectorAll('[data-align], [data-distribute]').forEach(button=>{button.disabled=count<(button.hasAttribute('data-distribute')?3:2);button.setAttribute('aria-disabled',String(button.disabled))});
 const label=$('#align-selection-count');if(label)label.textContent=count+' editable selected';
}
function alignSelection(axis,edge){
 const targets=selectedEditableObjects();if(targets.length<2){toast('Select at least 2 unlocked objects');return}
 const reference=selected&&targets.includes(selected)?selected:targets[0];
 reference.updateWorldMatrix(true,false);
 const refBox=new THREE.Box3().setFromObject(reference);
 const refValue=edge==='min'?refBox.min[axis]:edge==='max'?refBox.max[axis]:refBox.getCenter(new THREE.Vector3())[axis];
 const snapshot={objects:objects.map(cloneForHistory),selection:selectedObjects.map(objectPath).filter(Boolean),activePath:objectPath(selected),nextId};
 let changed=0;
 targets.forEach(object=>{
  if(object===reference)return;
  object.updateWorldMatrix(true,false);
  const box=new THREE.Box3().setFromObject(object);
  const current=edge==='min'?box.min[axis]:edge==='max'?box.max[axis]:box.getCenter(new THREE.Vector3())[axis];
  const delta=refValue-current;
  if(Math.abs(delta)>1e-7){object.position[axis]+=delta;changed++}
 });
 if(changed){undoStack.push(snapshot);if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack.length=0;syncHistoryButtons();}
 refreshFields();renderList();toast('Aligned '+targets.length+' objects to '+reference.name);
}
function distributeSelection(axis){
 const targets=selectedEditableObjects();if(targets.length<3){toast('Select at least 3 unlocked objects');return}
 const entries=targets.map(object=>{object.updateWorldMatrix(true,false);const box=new THREE.Box3().setFromObject(object);return {object,min:box.min[axis],max:box.max[axis],size:box.max[axis]-box.min[axis]}}).sort((a,b)=>a.min-b.min);
 const totalSpan=entries.at(-1).max-entries[0].min;
 const totalSize=entries.reduce((sum,item)=>sum+item.size,0);
 const gap=(totalSpan-totalSize)/(entries.length-1);
 if(gap< -1e-6){toast('Objects overlap too much to distribute');return}
 const snapshot={objects:objects.map(cloneForHistory),selection:selectedObjects.map(object=>objects.indexOf(object)).filter(index=>index>=0),activeIndex:selected?objects.indexOf(selected):-1,nextId};
 let cursor=entries[0].min,changed=0;
 entries.forEach((entry,index)=>{const delta=cursor-entry.min;if(Math.abs(delta)>1e-7){entry.object.position[axis]+=delta;changed++}cursor+=entry.size+gap});
 if(changed){undoStack.push(snapshot);if(undoStack.length>HISTORY_LIMIT)undoStack.shift();redoStack.length=0;syncHistoryButtons()}
 refreshFields();renderList();toast('Distributed '+targets.length+' objects evenly');
}
['x','y','z'].forEach(axis=>{
 document.querySelectorAll('[data-align="'+axis+'"]').forEach(button=>button.addEventListener('click',()=>alignSelection(axis,button.dataset.edge)));
 const distribute=$('[data-distribute="'+axis+'"]');distribute?.addEventListener('click',()=>distributeSelection(axis));
});
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
function beginMaterialHistory(){if(!materialHistoryPending){recordHistory();materialHistoryPending=true}}
function endMaterialHistory(){materialHistoryPending=false}
['material-color','roughness-input','metalness-input','opacity-input'].forEach(id=>{
 const input=$('#'+id);
 input.addEventListener('pointerdown',beginMaterialHistory);
 input.addEventListener('keydown',beginMaterialHistory);
 input.addEventListener('input',beginMaterialHistory);
 input.addEventListener('change',endMaterialHistory);
 input.addEventListener('blur',endMaterialHistory);
});
window.addEventListener('pointercancel',endMaterialHistory);
$('#material-color').addEventListener('input',e=>applyMaterialProperty('color',e.target.value));
[['roughness','roughness-input'],['metalness','metalness-input'],['opacity','opacity-input']].forEach(([property,id])=>{
 $('#'+id).addEventListener('input',e=>applyMaterialProperty(property,Number(e.target.value)));
});


// Pivot/origin editing uses a wrapper so mesh geometry is never modified.
let pivotEditMode=false,transformMode='translate',savedTransformSpace='world';
const pivotHandle=new THREE.Group();
const pivotMarker=new THREE.Mesh(new THREE.SphereGeometry(.065,16,12),new THREE.MeshBasicMaterial({color:0xffc96b,depthTest:false,depthWrite:false}));
pivotMarker.renderOrder=20;pivotHandle.add(pivotMarker);scene.add(pivotHandle);pivotHandle.visible=false;
function updatePivotHandle(){
 if(!selected)return;
 selected.updateWorldMatrix(true,false);
 pivotHandle.position.copy(selected.getWorldPosition(new THREE.Vector3()));
 pivotHandle.quaternion.identity();pivotHandle.scale.set(1,1,1);pivotHandle.updateMatrixWorld(true);
}
function attachCurrentSelection(){
 if(pivotEditMode){
  if(!selected||selectedObjects.length!==1||selected.userData.editorLocked||!selected.visible){setPivotEditMode(false,false);return}
  updatePivotHandle();pivotHandle.visible=true;transform.setMode('translate');transform.setSpace('world');transform.attach(pivotHandle);return;
 }
 pivotHandle.visible=false;
 if(selected&&selected.visible&&!selected.userData.editorLocked)transform.attach(selected);else transform.detach();
 transform.setMode(transformMode);
}
function ensurePivotWrapper(object){
 if(object?.userData?.editorPivotWrapper)return object;
 if(!object?.parent)return null;
 const parent=object.parent;
 parent.updateWorldMatrix(true,false);
 const wrapper=new THREE.Group();
 wrapper.name=object.name;
 wrapper.position.copy(object.position);wrapper.quaternion.copy(object.quaternion);wrapper.scale.copy(object.scale);
 wrapper.visible=object.visible;wrapper.userData={...object.userData,editorPivotWrapper:true,editorPivotOffset:[0,0,0]};
 delete object.userData.editorHierarchyNode;
 object.visible=true;
 parent.add(wrapper);wrapper.updateMatrixWorld(true);wrapper.attach(object);
 const rootIndex=objects.indexOf(object);if(rootIndex>=0)objects[rootIndex]=wrapper;
 selectedObjects=selectedObjects.map(item=>item===object?wrapper:item);
 if(selected===object)selected=wrapper;
 $('#selected-name').textContent=wrapper.name;$('#selbar-label').textContent=wrapper.name;
 renderList();
 return wrapper;
}
function applyPivotLocalOffset(wrapper,delta){
 if(!wrapper||delta.lengthSq()<1e-12)return;
 wrapper.children.forEach(child=>child.position.sub(delta));
 const parentSpaceOffset=delta.clone().multiply(wrapper.scale).applyQuaternion(wrapper.quaternion);
 wrapper.position.add(parentSpaceOffset);
 const current=Array.isArray(wrapper.userData.editorPivotOffset)?wrapper.userData.editorPivotOffset:[0,0,0];
 wrapper.userData.editorPivotOffset=[current[0]+delta.x,current[1]+delta.y,current[2]+delta.z];
 wrapper.updateMatrixWorld(true);
}
function setPivotAtWorldPoint(point,label){
 if(!selected||selectedObjects.length!==1){toast('Select exactly one object to edit its pivot');return}
 if(selected.userData.editorLocked||!selected.visible){toast('Unlock and show the object first');return}
 recordHistory();
 const wrapper=ensurePivotWrapper(selected);if(!wrapper)return;
 wrapper.updateWorldMatrix(true,false);
 const localDelta=wrapper.worldToLocal(point.clone());
 applyPivotLocalOffset(wrapper,localDelta);
 selected=wrapper;selectedObjects=[wrapper];
 attachCurrentSelection();refreshFields();renderList();toast(label);
}
function setPivotPreset(preset){
 if(!selected||selectedObjects.length!==1){toast('Select exactly one object to edit its pivot');return}
 if(preset==='original'){
  if(!selected.userData.editorPivotWrapper){toast('Pivot is already at its original position');return}
  const offset=selected.userData.editorPivotOffset||[0,0,0];
  const delta=new THREE.Vector3(-offset[0],-offset[1],-offset[2]);
  if(delta.lengthSq()<1e-12){toast('Pivot is already at its original position');return}
  recordHistory();applyPivotLocalOffset(selected,delta);attachCurrentSelection();refreshFields();renderList();toast('Original pivot restored');return;
 }
 if(selected.userData.editorLocked||!selected.visible){toast('Unlock and show the object first');return}
 selected.updateWorldMatrix(true,false);
 const bounds=new THREE.Box3().setFromObject(selected);
 let point;
 if(preset==='center')point=bounds.getCenter(new THREE.Vector3());
 else if(preset==='bottom')point=new THREE.Vector3((bounds.min.x+bounds.max.x)/2,bounds.min.y,(bounds.min.z+bounds.max.z)/2);
 else if(preset==='world')point=new THREE.Vector3(0,0,0);
 if(point)setPivotAtWorldPoint(point,preset==='center'?'Pivot set to geometry center':preset==='bottom'?'Pivot set to bottom center':'Pivot set to world origin');
}
function setPivotEditMode(active,showMessage=true){
 if(active){
  if(!selected||selectedObjects.length!==1){toast('Select exactly one object first');return}
  if(selected.userData.editorLocked||!selected.visible){toast('Unlock and show the object first');return}
  if(!pivotEditMode)savedTransformSpace=transform.space||'world';
  pivotEditMode=true;const pivotButton=$('#pivot-edit-btn');if(pivotButton){pivotButton.classList.add('active');pivotButton.setAttribute('aria-pressed','true');pivotButton.textContent='Finish Pivot Editing';}
  attachCurrentSelection();refreshFields();if(showMessage)toast('Move the pivot gizmo, not the object');
 }else{
  pivotEditMode=false;const pivotButton=$('#pivot-edit-btn');if(pivotButton){pivotButton.classList.remove('active');pivotButton.setAttribute('aria-pressed','false');pivotButton.textContent='Place Pivot';}
  pivotHandle.visible=false;transform.detach();transform.setSpace(savedTransformSpace||'world');transform.setMode(transformMode);
  if(selected&&selected.visible&&!selected.userData.editorLocked)transform.attach(selected);
  refreshFields();if(showMessage)toast('Pivot edit mode off');
 }
}
function handleTransformObjectChange(){
 if(pivotEditMode&&transform.object===pivotHandle&&selected){
  const worldTarget=pivotHandle.getWorldPosition(new THREE.Vector3());
  const wrapper=ensurePivotWrapper(selected);if(!wrapper)return;
  wrapper.updateWorldMatrix(true,false);
  const localDelta=wrapper.worldToLocal(worldTarget.clone());
  if(localDelta.lengthSq()>1e-12)applyPivotLocalOffset(wrapper,localDelta);
  pivotHandle.position.copy(wrapper.getWorldPosition(new THREE.Vector3()));
  pivotHandle.updateMatrixWorld(true);refreshFields();return;
 }
 refreshFields();
}
document.querySelectorAll('[data-pivot-action]').forEach(button=>button.addEventListener('click',()=>setPivotPreset(button.dataset.pivotAction)));
$('#pivot-edit-btn')?.addEventListener('click',()=>setPivotEditMode(!pivotEditMode));

function refreshFields(){if(!selected)return;makeFields('#position-fields',['X','Y','Z'],[selected.position.x,selected.position.y,selected.position.z],'position');makeFields('#rotation-fields',['X','Y','Z'],[THREE.MathUtils.radToDeg(selected.rotation.x),THREE.MathUtils.radToDeg(selected.rotation.y),THREE.MathUtils.radToDeg(selected.rotation.z)],'rotation');makeFields('#scale-fields',['X','Y','Z'],[selected.scale.x,selected.scale.y,selected.scale.z],'scale');document.querySelectorAll('#position-fields input,#rotation-fields input,#scale-fields input').forEach(input=>input.disabled=pivotEditMode);if(pivotEditMode&&transform.object===pivotHandle)updatePivotHandle();$('#scale-state').textContent=uniform?'UNIFORM':'FREE';$('#scale-hint').textContent=uniform?'Uniform mode: changing one axis updates all three axes.':'Scale each axis independently. Enable uniform scaling to resize proportionally.'}
function setMode(m){if(pivotEditMode)setPivotEditMode(false,false);transformMode=m;transform.setMode(m);document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===m))}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
[['translation','grid-step','grid'],['rotation','angle-step','angle'],['scale','scale-step','step']].forEach(([kind,inputId,setting])=>{
 const button=$('#snap-'+kind),input=$('#'+inputId);
 button?.addEventListener('click',()=>{snapSettings[kind]=!snapSettings[kind];applySnapSettings();toast(kind+' snap '+(snapSettings[kind]?'on':'off'))});
 input?.addEventListener('change',()=>{const value=Number(input.value);if(!Number.isFinite(value)||value<=0){input.value=String(snapSettings[setting]);return}snapSettings[setting]=value;applySnapSettings()});
});
applySnapSettings();
$('#uniform-toggle').onclick=()=>{uniform=!uniform;$('#uniform-toggle').setAttribute('aria-pressed',String(uniform));refreshFields()};
$('#mirror-toggle').onclick=()=>{mirror=!mirror;$('#mirror-toggle').setAttribute('aria-pressed',String(mirror));toast(mirror?'Mirror scaling enabled':'Mirror scaling disabled')};
const legacyAddButton=$('#add-cube');if(legacyAddButton)legacyAddButton.onclick=()=>addPrimitive($('#shape-select')?.value||'cube');
document.querySelectorAll('[data-shape]').forEach(button=>button.addEventListener('click',()=>{addPrimitive(button.dataset.shape);if(activeTab!=='add')openPanel('add')}));

/* Dock navigation and responsive panel controller */
let activeTab=null;
const tabTitles={add:'Add objects',scene:'Scene',transform:'Transform',material:'Material',world:'World',roadmap:'Roadmap'};
function openPanel(tab){
 const sheet=$('#sheet');if(!sheet)return;
 activeTab=tab;
 document.querySelectorAll('[data-panel]').forEach(panel=>{panel.hidden=panel.dataset.panel!==tab});
 document.querySelectorAll('#dock [data-tab]').forEach(button=>button.classList.toggle('active',button.dataset.tab===tab));
 $('#sheet-title').textContent=tabTitles[tab]||tab;
 sheet.classList.add('open');sheet.dataset.activeTab=tab;
 if(tab==='transform'&&selected)refreshFields();
 if(tab==='material'&&selected)syncMaterialEditor();
 requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false));
}
function closePanel(){
 const sheet=$('#sheet');if(!sheet)return;
 sheet.classList.remove('open');sheet.dataset.activeTab='';
 document.querySelectorAll('#dock [data-tab]').forEach(button=>button.classList.remove('active'));
 activeTab=null;
 requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false));
}
document.querySelectorAll('#dock [data-tab]').forEach(button=>button.addEventListener('click',()=>{const tab=button.dataset.tab;if(activeTab===tab)closePanel();else openPanel(tab)}));
$('#sheet-close')?.addEventListener('click',closePanel);
$('#selbar-name')?.addEventListener('click',()=>openPanel('transform'));
$('#selbar-dup')?.addEventListener('click',()=>$('#duplicate-btn')?.click());
$('#selbar-del')?.addEventListener('click',()=>$('#delete-btn')?.click());
$('#import-btn-2')?.addEventListener('click',()=>$('#import-btn')?.click());
document.querySelectorAll('[data-soon]').forEach(button=>button.addEventListener('click',()=>toast(button.dataset.soon+' is planned for a future update')));



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
let isoViewActive=false,gridVisibilityBeforeIso=true,preIsoCameraState=null;
function saveCameraState(){
 return {position:camera.position.clone(),up:camera.up.clone(),target:orbit.target.clone(),zoom:camera.zoom};
}
function restoreCameraState(state){
 if(!state)return;
 camera.position.copy(state.position);camera.up.copy(state.up);camera.zoom=state.zoom;
 camera.updateProjectionMatrix();orbit.target.copy(state.target);
 camera.lookAt(orbit.target);camera.updateMatrixWorld(true);orbit.update();
 // Re-apply the exact saved orientation after OrbitControls synchronizes.
 camera.position.copy(state.position);camera.up.copy(state.up);camera.lookAt(state.target);camera.updateMatrixWorld(true);
}
function setCameraView(direction,label='Camera view'){
 const distance=Math.max(camera.position.distanceTo(orbit.target),6);
 camera.position.copy(orbit.target).add(direction.clone().normalize().multiplyScalar(distance));
 camera.up.copy(Math.abs(direction.y)>.99?new THREE.Vector3(0,0,-1):new THREE.Vector3(0,1,0));
 camera.lookAt(orbit.target);camera.updateMatrixWorld(true);orbit.update();toast(label);
}
function setIsoView(active){
 if(active===isoViewActive)return;
 const isoButton=document.querySelector('[data-camera-view="iso"]');
 if(active){
  preIsoCameraState=saveCameraState();
  gridVisibilityBeforeIso=grid.visible;
  grid.visible=false;isoViewActive=true;
 }else{
  isoViewActive=false;
  grid.visible=gridVisibilityBeforeIso;
  restoreCameraState(preIsoCameraState);
  preIsoCameraState=null;
 }
 if(isoButton)isoButton.classList.toggle('active',active);
 $('#grid-btn').classList.toggle('active',grid.visible);
}
function frameAll(){
 if(isoViewActive)setIsoView(false);
 if(!objects.length){orbit.target.set(0,.8,0);camera.position.set(7,6,8);orbit.update();return}
 const bounds=new THREE.Box3();objects.forEach(object=>bounds.expandByObject(object));
 const center=bounds.getCenter(new THREE.Vector3()),sphere=bounds.getBoundingSphere(new THREE.Sphere());
 const radius=Math.max(sphere.radius,.5),distance=radius/Math.sin(THREE.MathUtils.degToRad(camera.fov/2))*1.2;
 orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(1,0.8,1).normalize().multiplyScalar(distance));camera.near=Math.max(.01,distance/1000);camera.far=Math.max(1000,distance*20);camera.updateProjectionMatrix();orbit.update();toast('Framed all objects');
}
document.querySelectorAll('[data-camera-view]').forEach(button=>button.addEventListener('click',()=>{
 const view=button.dataset.cameraView;
 if(view==='iso'&&isoViewActive){setIsoView(false);toast('Isometric view off');return;}
 if(view!=='iso'&&isoViewActive)setIsoView(false);
 const views={top:new THREE.Vector3(0,1,0),front:new THREE.Vector3(0,0,1),back:new THREE.Vector3(0,0,-1),left:new THREE.Vector3(-1,0,0),right:new THREE.Vector3(1,0,0),iso:new THREE.Vector3(1,1,1)};
 const direction=views[view];if(direction){setCameraView(direction,button.title||'Camera view');if(view==='iso')setIsoView(true);}
}));
$('#frame-all')?.addEventListener('click',frameAll);
$('#camera-reset').onclick=()=>{if(isoViewActive)setIsoView(false);camera.up.set(0,1,0);camera.position.set(7,6,8);orbit.target.set(0,.8,0);camera.lookAt(orbit.target);camera.updateMatrixWorld(true);orbit.update();toast('Camera reset')};
function showHome(){if(document.fullscreenElement)document.exitFullscreen();$('#app').classList.remove('immersive');document.body.classList.add('home-view')}
function resumeScene(){document.body.classList.remove('home-view');requestAnimationFrame(()=>renderer.setSize(viewport.clientWidth,viewport.clientHeight,false))}
$('#home-btn').onclick=showHome;
$('#resume-scene').onclick=resumeScene;
$('#home-new-scene').onclick=()=>{$('#new-scene').click();resumeScene()};
$('#exit-immersive')?.addEventListener('click',toggleFullscreen);


$('#duplicate-btn').onclick=()=>{if(!selectedObjects.length)return;if(pivotEditMode)setPivotEditMode(false,false);recordHistory();const copies=selectedObjects.map(o=>{const c=o.clone(true);c.position.x+=1;return addObject(c,o.name+' copy',false)});selected=copies.at(-1);selectedObjects=copies;attachCurrentSelection();renderList();toast(copies.length+' object(s) duplicated')};
$('#delete-btn').onclick=()=>{if(!selectedObjects.length)return;if(pivotEditMode)setPivotEditMode(false,false);recordHistory();const removed=[...selectedObjects];removed.forEach(o=>scene.remove(o));objects=objects.filter(o=>!removed.includes(o));selectedObjects=[];selected=null;transform.detach();pivotHandle.visible=false;$('#properties').hidden=true;$('#empty-state').hidden=false;$('#selbar').hidden=true;document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=true);document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=false);renderList();toast(removed.length+' object(s) deleted')};
$('#focus-btn').onclick=()=>{if(!selected)return;const box=new THREE.Box3().setFromObject(selected),center=box.getCenter(new THREE.Vector3());orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(4,3,5))};
$('#grid-btn').onclick=()=>{if(isoViewActive){gridVisibilityBeforeIso=!gridVisibilityBeforeIso;grid.visible=false;toast(gridVisibilityBeforeIso?'Grid will show when Isometric is off':'Grid will stay hidden when Isometric is off');}else{grid.visible=!grid.visible;$('#grid-btn').classList.toggle('active',grid.visible)}};
document.querySelectorAll('[data-shading]').forEach(button=>button.addEventListener('click',()=>setViewportShading(button.dataset.shading)));
$('#flat-shading-btn')?.addEventListener('click',()=>setFlatShading(!flatShading));
document.querySelectorAll('[data-studio]').forEach(button=>button.addEventListener('click',()=>setStudioPreset(button.dataset.studio)));
$('#new-scene').onclick=()=>{if(pivotEditMode)setPivotEditMode(false,false);recordHistory();transform.detach();pivotHandle.visible=false;objects.forEach(o=>scene.remove(o));objects=[];selected=null;selectedObjects=[];$('#properties').hidden=true;$('#empty-state').hidden=false;$('#selbar').hidden=true;document.querySelectorAll('.needs-sel').forEach(el=>el.hidden=true);document.querySelectorAll('.empty-sel').forEach(el=>el.hidden=false);renderList();toast('New empty scene')};
$('#import-btn').onclick=()=>$('#file-input').click();
$('#file-input').onchange=async e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);try{let obj;if(f.name.toLowerCase().endsWith('.obj'))obj=new OBJLoader().parse(await f.text());else obj=(await new GLTFLoader().loadAsync(url)).scene;addObject(obj,f.name.replace(/\.[^.]+$/,''));toast('Imported '+f.name)}catch(err){console.error(err);toast('Could not import file')}finally{URL.revokeObjectURL(url);e.target.value=''}};
$('#export-btn').onclick=()=>{const out=new THREE.Scene();objects.forEach(o=>out.add(o.clone(true)));new GLTFExporter().parse(out,async result=>{const blob=new Blob([result],{type:'model/gltf-binary'});const data=await blob.arrayBuffer();if(window.electronAPI?.saveFile){const saved=await window.electronAPI.saveFile({data:Array.from(new Uint8Array(data)),defaultName:'electron-scene.glb'});if(!saved.canceled)toast('GLB exported successfully')}else if(navigator.canShare?.({files:[new File([blob],'electron-scene.glb',{type:'model/gltf-binary'})]})){const file=new File([blob],'electron-scene.glb',{type:'model/gltf-binary'});await navigator.share({files:[file],title:'Export 3D model'});toast('GLB shared successfully')}else{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='electron-scene.glb';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast('GLB downloaded')}},err=>{console.error(err);toast('Export failed')},{binary:true})};
function hitObject(clientX,clientY){const r=renderer.domElement.getBoundingClientRect();pointerNdc.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1);raycaster.setFromCamera(pointerNdc,camera);const hits=raycaster.intersectObjects(objects,true);if(!hits.length)return null;let node=hits[0].object,root=node;while(root.parent&&root.parent!==scene)root=root.parent;return node.userData?.editorHierarchyNode?node:root}
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
 if(!o.visible||o.userData.editorLocked)return;
 const start={x:e.clientX,y:e.clientY,obj:o,origin:o.position.clone(),planeY:o.position.y,moved:false,historyRecorded:false};
 touchDrag=start;orbit.enabled=false;
 longPressTimer=setTimeout(()=>{if(touchDrag===start&&!start.moved){touchDrag=null;orbit.enabled=true;showContextMenu(o,e.clientX,e.clientY)}},560);
});
window.addEventListener('pointermove',e=>{
 if(!touchDrag||e.pointerType!=='touch')return;
 const dx=e.clientX-touchDrag.x,dy=e.clientY-touchDrag.y;
 if(Math.hypot(dx,dy)>7){touchDrag.moved=true;clearTimeout(longPressTimer);if(!touchDrag.historyRecorded){recordHistory();touchDrag.historyRecorded=true}}
 if(!touchDrag.moved)return;
 const p=planePoint(e.clientX,e.clientY,touchDrag.planeY);if(!p)return;
 const offset=touchDrag.origin.clone().sub(planePoint(touchDrag.x,touchDrag.y,touchDrag.planeY)||touchDrag.origin);
 touchDrag.obj.position.copy(p.add(offset));if(touchDrag.obj===selected)refreshFields();
});
window.addEventListener('pointerup',e=>{if(e.pointerType==='touch'&&touchDrag){clearTimeout(longPressTimer);touchDrag=null;orbit.enabled=true}});
window.addEventListener('pointercancel',()=>{clearTimeout(longPressTimer);touchDrag=null;orbit.enabled=true});

window.addEventListener('keydown',e=>{
 const editing=['INPUT','TEXTAREA'].includes(document.activeElement?.tagName);
 if((e.ctrlKey||e.metaKey)&&!editing){
  const key=e.key.toLowerCase();
  if(key==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return}
  if(key==='y'){e.preventDefault();redo();return}
 }
 if(editing)return;
 const k=e.key.toLowerCase();
 if(k==='w')setMode('translate');
 if(k==='e')setMode('rotate');
 if(k==='r')setMode('scale');
 if(e.key==='Delete')$('#selbar-del')?.click();
 if(k==='f')toggleFullscreen();
 if(e.key==='Escape')closePanel();
});
new ResizeObserver(()=>{const w=viewport.clientWidth,h=viewport.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)}).observe(viewport);
function animate(){requestAnimationFrame(animate);orbit.update();renderer.render(scene,camera)}animate();addCube();clearHistory();setViewportShading('solid');setStudioPreset('studio');