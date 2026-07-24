/**
 * Supervisor queue - push-ranked, not a browsable dashboard.
 * See docs/ARCHITECTURE_BIBLE.md Part 8.6.
 *
 * Every item must show a one-line "why now" - never a bare score.
 */
import { useEffect, useState } from "react";
import type { SupervisorQueueItem } from "../types";

export default function SupervisorQueue() {
  const [items, setItems] = useState<SupervisorQueueItem[]>([]);

  useEffect(() => {
    // TODO: fetch(`/api/v1/scorecards/queue/${projectId}`)
  }, []);

  return (
    <div>
      <h1>Today's Review Queue</h1>
      {items.length === 0 && <p>Nothing needs your attention right now.</p>}
      <ul>
        {items.map((item) => (
          <li key={item.interview_id}>
            <strong>{item.enumerator_id}</strong> — {item.fraud_risk} risk ·{" "}
            {item.recommended_action.replace(/_/g, " ")}
            <p>{item.why_now}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
