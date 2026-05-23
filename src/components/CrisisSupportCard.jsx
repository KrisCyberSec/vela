// Crisis support card. Standalone JSX used inline in the Ask Vela
// sheet AND on Today when the daily-brief flow detects a sustained
// mood crash. Pulled out so both screens can import it without
// pulling in the rest of App.jsx.

import React from "react";
import { UIIcon } from "./icons";
import { CRISIS_RESOURCES } from "../lib/crisis";


// Standalone component - used inline in the Ask Vela sheet AND on Today
// when the daily-brief flow detects a sustained mood crash. Same surface
// either place so the user recognizes "this is the safety card" wherever
// it appears.
export function CrisisSupportCard({ context = "ask-vela" }) {
  return (
    <article className="crisis-card" role="alert">
      <div className="crisis-head">
        <span className="ico"><UIIcon name="Heart" size={18} weight="fill" /></span>
        <div>
          <strong>You don't have to do this alone.</strong>
          <p>
            What you're saying matters. A trained, free, confidential listener
            is one call or text away. They're trained for exactly this.
          </p>
        </div>
      </div>
      <ul className="crisis-list">
        {CRISIS_RESOURCES.map((r) => (
          <li key={r.region}>
            <span className="region">{r.region}</span>
            <span className="line">{r.line}</span>
            <span className="note">{r.note}</span>
          </li>
        ))}
      </ul>
      <p className="crisis-foot">
        If you're in immediate danger, please call your local emergency number.
        Vela is a journaling app. It's not a substitute for human support.
      </p>
    </article>
  );
}
