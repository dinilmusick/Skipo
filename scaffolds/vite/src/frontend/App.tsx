import { AikoDirectChat } from './components/components.js';
import MainPage from './pages/main/page.js';
import { createAikoRuntime } from '../backend/AppBackend.js';

const routes:Record<string,typeof MainPage>={'/':MainPage,'/home':MainPage};

export function App(){const Page=routes[window.location.pathname]??MainPage;const workspaceId=typeof window==='undefined'?'default':localStorage.getItem('skipo-active-workspace')||'default'; const aikoRuntime=createAikoRuntime(workspaceId); const authToken=typeof window==='undefined'?'':localStorage.getItem('skipo-auth-token')||''; return <><Page/><AikoDirectChat runtime={aikoRuntime} workspaceId={workspaceId} authToken={authToken}/></>;}
export default App;
