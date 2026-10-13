import React from "react";
import ReactDOM from "react-dom/client";
import "@radix-ui/themes/styles.css";
import { Theme } from "@radix-ui/themes";
import { Toaster } from "sonner";
import { App } from "./App";
import "./index.css";

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Theme appearance="dark" accentColor="indigo" grayColor="slate" radius="medium">
        <App />
        <Toaster richColors theme="dark" position="bottom-right" />
      </Theme>
    </React.StrictMode>,
  );
}

