import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ThemeProvider } from "./theme/ThemeContext";
import { HistoryProvider } from "./history/HistoryContext";
import { VocabProvider } from "./vocab/VocabContext";
import { SubscriptionProvider } from "./billing/SubscriptionContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <HistoryProvider>
          <VocabProvider>
            <SubscriptionProvider>
              <App />
            </SubscriptionProvider>
          </VocabProvider>
        </HistoryProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
