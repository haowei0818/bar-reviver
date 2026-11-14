import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { createRepo } from './data';
import './ui/styles.css';

createRepo().then(({ repo, mode }) => {
  if (mode === 'local') document.body.dataset.mode = 'local';
  createRoot(document.getElementById('root')!).render(<App repo={repo} />);
});
