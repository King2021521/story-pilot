import { createContext } from "react";

import { StoryPilotApiClient } from "./story-pilot-api";

export const StoryPilotApiContext = createContext<StoryPilotApiClient | undefined>(undefined);
