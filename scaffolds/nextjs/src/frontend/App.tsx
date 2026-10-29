import MainPage from './pages/main/page.js';

const routes:Record<string,typeof MainPage>={'/':MainPage,'/home':MainPage};

export function App(){const Page=routes[window.location.pathname]??MainPage;return <Page/>;}
export default App;
