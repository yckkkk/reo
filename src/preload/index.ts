import { contextBridge, ipcRenderer } from 'electron';
import { createWorkspaceBridge } from './workspaceBridge.js';

contextBridge.exposeInMainWorld(
  'reoWorkspace',
  createWorkspaceBridge({
    invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  })
);
