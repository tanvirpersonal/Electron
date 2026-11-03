const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('electronAPI',{saveFile:p=>ipcRenderer.invoke('save-file',p)});