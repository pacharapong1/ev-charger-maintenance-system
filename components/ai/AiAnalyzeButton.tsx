'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import AiAnalysisModal from './AiAnalysisModal';

/**
 * "วิเคราะห์สาเหตุด้วย AI" trigger for one alarm row.
 *
 * The modal is only mounted once it is opened, so the request is not fired for
 * every row in the table. Only the alarm id crosses the wire; the route reads
 * the record itself.
 */
export default function AiAnalyzeButton({
  alarmId,
  alarmCode,
}: {
  alarmId: string;
  alarmCode: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="btn btn-sm"
        onClick={() => setOpen(true)}
        // Names the alarm, so a screen reader user hearing a table of buttons
        // can tell which one they are about to run.
        aria-label={`วิเคราะห์สาเหตุด้วย AI สำหรับ Alarm ${alarmCode}`}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        วิเคราะห์ด้วย AI
      </button>

      {open ? (
        <AiAnalysisModal
          alarmId={alarmId}
          alarmCode={alarmCode}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
