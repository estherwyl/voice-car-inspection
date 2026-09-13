import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { realtimeMiddleware } from './server/realtime';
export default defineConfig(({mode})=>{
 const env={...loadEnv(mode,process.cwd(),''),...process.env} as Record<string,string>;
 return {plugins:[react(),{name:'jarvici-voice',configureServer(server){server.middlewares.use(realtimeMiddleware(env));},configurePreviewServer(server){server.middlewares.use(realtimeMiddleware(env));}}]};
});
