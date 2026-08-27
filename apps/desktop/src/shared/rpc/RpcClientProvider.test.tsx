import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StoryPilotApiProvider } from "./RpcClientProvider";
import { StoryPilotApiClient } from "./story-pilot-api";
import type { RpcClient } from "./rpc-client";
import { useStoryPilotApi } from "./useStoryPilotApi";

describe("StoryPilotApiProvider", () => {
  it("provides the story pilot API client to descendants", () => {
    const rpcClient: RpcClient = {
      async send() {
        return { data: null, id: "req_test", ok: true };
      },
    };

    render(
      <StoryPilotApiProvider apiClient={new StoryPilotApiClient(rpcClient)}>
        <Consumer />
      </StoryPilotApiProvider>,
    );

    expect(screen.getByText("api-ready")).toBeInTheDocument();
  });

  it("fails clearly when used outside the provider", () => {
    expect(() => render(<Consumer />)).toThrow("StoryPilotApiProvider is missing");
  });
});

function Consumer() {
  const api = useStoryPilotApi();

  return <span>{api instanceof StoryPilotApiClient ? "api-ready" : "api-missing"}</span>;
}
