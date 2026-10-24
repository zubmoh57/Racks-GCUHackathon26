import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PlanningPanel } from '../features/planning/index.ts';
import { makeSample, sampleAction } from './sample.ts';

function Preview() {
  const [value, setValue] = useState(makeSample);
  const [withAction, setWithAction] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  return (
    <>
      <div className="preview-bar">
        <p>Standalone student financial planning preview. Fictional data only; PDF import, recommendations and dashboard are separate features.</p>
        <button type="button" onClick={() => {
          setValue(makeSample());
          setWithAction(false);
          setResetKey(v => v + 1);
        }}>Reset fictional example</button>
        <label>
          <input type="checkbox" checked={withAction} onChange={e => setWithAction(e.target.checked)} />
          Simulate a selected savings action (£20)
        </label>
      </div>
      <PlanningPanel
        value={value}
        onChange={setValue}
        acceptedActionImpacts={withAction ? [sampleAction] : []}
        resetKey={resetKey}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
