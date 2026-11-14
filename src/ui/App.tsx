import { useEffect, useState } from 'react';
import type { BarRepo, SyncStatus } from '../data/repo';
import { emptyState, type BarState } from '../domain/bar';
import { menuOf } from '../domain/menu';
import { Overview } from './screens/Overview';
import { TableDetail } from './screens/TableDetail';
import { NoteEditor } from './screens/NoteEditor';
import { Picker } from './screens/Picker';
import { History } from './screens/History';
import { MenuAdmin } from './screens/MenuAdmin';
import { Denied, UrlSettings } from './screens/UrlSettings';
import { accessOf, newAccessKey } from '../domain/access';
import { SyncBadge } from './screens/SyncBadge';
import { DayBanner, EndDayDialog } from './screens/EndDay';

type View =
  | { name: 'overview' }
  | { name: 'history' }
  | { name: 'menu' }
  | { name: 'url' }
  | { name: 'table'; tableId: string }
  | { name: 'picker'; tableId: string }
  | { name: 'notes'; tableId: string; lineId: string };

const currentKey = () => new URLSearchParams(window.location.search).get('k');
const currentBase = () => window.location.origin + window.location.pathname;
const replaceKey = (k: string) => window.history.replaceState(null, '', `${currentBase()}?k=${k}`);

export function App(props: {
  repo: BarRepo;
  clock?: () => number;
  urlKey?: string | null;
  baseUrl?: string;
  onKeyChange?: (key: string) => void;
  genKey?: () => string;
}) {
  const { repo, clock = Date.now, baseUrl = currentBase(), onKeyChange = replaceKey, genKey = newAccessKey } = props;
  const [state, setState] = useState<BarState>(emptyState);
  const [loaded, setLoaded] = useState(false);
  const [urlKey, setUrlKey] = useState(props.urlKey === undefined ? currentKey() : props.urlKey);
  useEffect(() => {
    if (props.urlKey !== undefined) setUrlKey(props.urlKey);
  }, [props.urlKey]);
  const [view, setView] = useState<View>({ name: 'overview' });
  const [endingDay, setEndingDay] = useState(false);
  const [, tick] = useState(0);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  useEffect(() => repo.onSync?.(setSync), [repo]);
  useEffect(
    () =>
      repo.subscribe((s) => {
        setState(s);
        setLoaded(true);
      }),
    [repo],
  );
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000); // 讓「可復原」「18 小時提醒」隨時間更新
    return () => clearInterval(t);
  }, []);
  const now = clock();
  useEffect(() => {
    if (!navigator.userAgent.includes('jsdom')) window.scrollTo?.(0, 0);
  }, [view]);
  const home = () => setView({ name: 'overview' });

  if (!loaded) return null;
  if (accessOf(state, urlKey) === 'denied') return <Denied />;
  return (
    <>
      <SyncBadge sync={sync} />
      {renderView()}
    </>
  );

  function renderView() {

  switch (view.name) {
    case 'overview':
      return (
        <>
          <Overview
            sessions={state.tables}
            onOpen={(tableId) => setView({ name: 'table', tableId })}
            banner={<DayBanner state={state} now={now} onUndo={() => repo.undoEndBusinessDay()} />}
            nav={
              <>
                <button className="ghost small" onClick={() => setView({ name: 'history' })}>歷史</button>
                <button className="ghost small" onClick={() => setView({ name: 'menu' })}>酒單</button>
                <button className="ghost small" onClick={() => setView({ name: 'url' })}>網址</button>
                {state.day && (
                  <button className="ghost small" onClick={() => setEndingDay(true)}>結束營業</button>
                )}
              </>
            }
          />
          {endingDay && (
            <EndDayDialog
              state={state}
              onCancel={() => setEndingDay(false)}
              onConfirm={() => {
                setEndingDay(false);
                void repo.endBusinessDay();
              }}
            />
          )}
        </>
      );
    case 'url': {
      const key = state.settings.accessKey;
      return (
        <UrlSettings
          url={key ? `${baseUrl}?k=${key}` : null}
          onBack={home}
          onRotate={() => {
            const k = genKey();
            setUrlKey(k);
            void repo.rotateAccessKey(k).then(() => onKeyChange(k));
          }}
        />
      );
    }
    case 'menu':
      return <MenuAdmin menu={menuOf(state.menu)} repo={repo} onBack={home} />;
    case 'history':
      return <History state={state} onBack={home} onRestore={(id) => repo.restoreSession(id)} />;
    case 'table': {
      const t = view.tableId;
      return (
        <TableDetail
          tableId={t}
          session={state.tables[t]}
          onBack={home}
          onAdd={() => setView({ name: 'picker', tableId: t })}
          onQty={(lineId, d) => repo.changeQty(t, lineId, d)}
          onEditNotes={(lineId) => setView({ name: 'notes', tableId: t, lineId })}
          onSaveTableNote={(note) => repo.setTableNote(t, note)}
          onClear={() => repo.clearTable(t).then(home)}
        />
      );
    }
    case 'notes': {
      const t = view.tableId;
      const line = state.tables[t]?.lines.find((l) => l.lineId === view.lineId);
      const back = () => setView({ name: 'table', tableId: t });
      if (!line) return <Redirect to={back} />; // 這杯被別支手機刪掉或拆走了
      return (
        <NoteEditor
          line={line}
          onCancel={back}
          onSave={(notes, qty) => repo.setLineNotes(t, line.lineId, notes, qty).then(back)}
        />
      );
    }
    case 'picker':
      return (
        <Picker
          tableId={view.tableId}
          menu={menuOf(state.menu)}
          session={state.tables[view.tableId]}
          onPick={(item) => repo.addItem(view.tableId, item)}
          onDone={() => setView({ name: 'table', tableId: view.tableId })}
        />
      );
    }
  }
}

function Redirect({ to }: { to: () => void }) {
  useEffect(to, [to]);
  return null;
}
