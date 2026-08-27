import { App as AntApp, ConfigProvider } from "antd";
import type { ReactNode } from "react";

import { storyPilotTheme } from "./theme";

export interface AppProvidersProps {
  readonly children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ConfigProvider theme={storyPilotTheme}>
      <AntApp>{children}</AntApp>
    </ConfigProvider>
  );
}
