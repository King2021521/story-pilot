import { useContext } from "react";

import { StoryPilotApiContext } from "./StoryPilotApiContext";
import { StoryPilotApiClient } from "./story-pilot-api";

export function useStoryPilotApi(): StoryPilotApiClient {
  const apiClient = useContext(StoryPilotApiContext);
  if (!apiClient) {
    throw new Error("StoryPilotApiProvider is missing");
  }

  return apiClient;
}
