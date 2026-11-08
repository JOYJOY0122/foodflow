import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "./app/theme.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";

import { Providers } from "./app/providers";
import { router } from "./app/router";

const container = document.getElementById("root");
if (!container) {
  throw new Error("找不到 #root 元素");
}

createRoot(container).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
