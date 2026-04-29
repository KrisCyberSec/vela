/**
 * Top-level error boundary. Catches any throw during render — including
 * useState lazy initializers (which is where localStorage exceptions surface
 * during first paint). Without this, an exception white-screens the app.
 *
 * Strategy: show a calm, non-technical fallback that explains what to try
 * and links to support. Reports to Sentry once per session.
 */

import React from "react";
import { reportError } from "./errorReporting";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    try {
      reportError(error, { componentStack: info?.componentStack });
    } catch {
      // never let error reporting itself crash the boundary
    }
    // also log to console for local debugging
    console.error("[ErrorBoundary] App-level error:", error, info);
  }

  handleReload = () => {
    try { window.location.reload(); } catch { /* ignore */ }
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          color: "#2c1f17",
          background: "#fdfaf6",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🌿</div>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: "0 0 12px" }}>
          Something went wrong
        </h1>
        <p style={{ fontSize: 15, color: "#6b5d52", maxWidth: 320, lineHeight: 1.5, margin: "0 0 24px" }}>
          Vela hit an unexpected error. Reloading usually fixes it. If the problem keeps happening, you may need to clear your browser data for this site.
        </p>
        <button
          onClick={this.handleReload}
          style={{
            background: "#8c4e32",
            color: "#fdfaf6",
            border: "none",
            borderRadius: 12,
            padding: "12px 24px",
            fontSize: 15,
            fontWeight: 500,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Reload Vela
        </button>
        <p style={{ fontSize: 12, color: "#9d8d80", marginTop: 32 }}>
          Need help? <a href="mailto:support@velahealth.health" style={{ color: "#9d8d80" }}>support@velahealth.health</a>
        </p>
      </div>
    );
  }
}
