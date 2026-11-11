"use client";

import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import "./api-docs.css";
import { requestBodyLabel } from "./request-body-label";

// Swagger UI reaches for window when it loads, so it renders only in the
// browser.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

const plugins = [requestBodyLabel];

// The interactive docs for docs/api/openapi.yaml (#16). Try it out sends the
// request from this page, so the browser adds the session cookie itself.
export function ApiDocs({ spec }: { spec: string }) {
  return <SwaggerUI spec={spec} plugins={plugins} />;
}
