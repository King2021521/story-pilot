import { useMemo, type ReactNode } from "react";

import { TauriRpcClient } from "./rpc-client";
import { StoryPilotApiClient } from "./story-pilot-api";
import { StoryPilotApiContext } from "./StoryPilotApiContext";

export interface StoryPilotApiProviderProps {
  readonly apiClient?: StoryPilotApiClient;
  readonly children: ReactNode;
}

export function StoryPilotApiProvider({ apiClient, children }: StoryPilotApiProviderProps) {
  const defaultApiClient = useMemo(() => apiClient ?? new StoryPilotApiClient(new TauriRpcClient()), [apiClient]);

  return <StoryPilotApiContext.Provider value={defaultApiClient}>{children}</StoryPilotApiContext.Provider>;
}
