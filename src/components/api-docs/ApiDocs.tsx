"use client";

import { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "swagger-ui-react/swagger-ui.css";
import "./api-docs.css";
import { requestBodyLabel } from "./request-body-label";

const plugins = [requestBodyLabel];

// The interactive docs for docs/api/openapi.yaml (#16). Try it out sends the
// request from this page, so the browser adds the session cookie itself.
//
// Swagger UI renders in a React root of its own, outside the app's Strict
// Mode: its components use UNSAFE_componentWillReceiveProps, which Strict
// Mode reports as a console error, and Next's dev overlay shows as an Issue.
// The app's own components stay under Strict Mode. Swagger UI also reaches
// for window when it loads, so it is imported only in the browser.
export function ApiDocs({ spec }: { spec: string }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = container.current;
    if (!node) {
      return;
    }
    // A fresh element each time: Strict Mode runs this effect twice in
    // development, and a container can hold only one root.
    const host = document.createElement("div");
    node.appendChild(host);
    const root = createRoot(host);
    let cancelled = false;
    void import("swagger-ui-react").then(({ default: SwaggerUI }) => {
      if (!cancelled) {
        root.render(<SwaggerUI spec={spec} plugins={plugins} />);
      }
    });
    return () => {
      cancelled = true;
      // React can't unmount a root while it is rendering this component.
      setTimeout(() => {
        root.unmount();
        host.remove();
      });
    };
  }, [spec]);

  return <div ref={container} />;
}
