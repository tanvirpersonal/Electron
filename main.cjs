const {app,BrowserWindow,dialog,ipcMain}=require('electron');
const path=require('node:path'),fs=require('node:fs/promises');
const dev=!app.isPackaged;
function createWindow(){
 const win=new BrowserWindow({width:1500,height:940,minWidth:1050,minHeight:680,backgroundColor:'#090a0d',title:'Electron — 3D Asset Builder',webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false}});
 dev?win.loadURL('http://127.0.0.1:5173'):win.loadFile(path.join(__dirname,'dist/index.html'));
}
app.whenReady().then(()=>{
 ipcMain.handle('save-file',async(_,p)=>{const r=await dialog.showSaveDialog({defaultPath:p.defaultName||'model.glb',filters:[{name:'3D Model',extensions:['glb']}]});if(r.canceled)return {canceled:true};await fs.writeFile(r.filePath,Buffer.from(p.data));return {canceled:false,filePath:r.filePath};});
 createWindow();app.on('activate',()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});