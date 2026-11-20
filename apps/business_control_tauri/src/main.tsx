import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { AppErrorBoundary } from "./components/templates/AppErrorBoundary";
import { getApiBaseUrl, getAuthUser } from "./services/api";
import { remoteLogger } from "./services/remoteLogger";
import "./index.css";

remoteLogger.configure({ apiUrl: getApiBaseUrl, user: getAuthUser });

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
);
