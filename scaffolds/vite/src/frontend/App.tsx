import { AikoDirectChat } from './components/components.js';
import MainPage from './pages/main/page.js';
import { createAikoRuntime } from '../backend/AppBackend.js';

const routes:Record<string,typeof MainPage>={'/':MainPage,'/home':MainPage};

export function App(){const Page=routes[window.location.pathname]??MainPage;const workspaceId=typeof window==='undefined'?'default':localStorage.getItem('skipo-active-workspace')||'default'; const aikoRuntime=createAikoRuntime(workspaceId); return <><Page/><AikoDirectChat runtime={aikoRuntime} workspaceId={workspaceId}/></>;}
export default App;
