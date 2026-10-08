import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import CommandCenterExtension, { CommandCenterPanel } from "@components/layouts/extensions/command-center.extension";

jest.mock("@sommatic/react-sdk", () => ({
  ...jest.requireActual("@tests/support/sdk-stubs").stubs(["CommandCenterProvider", "CommandCenterSidebar"]),
  ConversationExecutionService: class ConversationExecutionService {},
  WorkManagementTaskService: class WorkManagementTaskService {},
}));
jest.mock("@veripass/react-sdk", () => ({ useAuth: () => ({ user: null }) }));
jest.mock("@link-loom/react-sdk", () => ({ useOmniSearchRegistry: () => ({ commands: [] }) }));

describe("Command Center extension", () => {
  it("leaves the frame as it is while the Command Center is off", () => {
    render(
      <MemoryRouter>
        <CommandCenterExtension>
          <p>Frame</p>
        </CommandCenterExtension>
      </MemoryRouter>
    );

    expect(screen.getByText("Frame")).toBeInTheDocument();
    expect(screen.queryByTestId("CommandCenterProvider")).toBeNull();
  });

  it("shows no panel while the Command Center is off", () => {
    const { container } = render(
      <MemoryRouter>
        <CommandCenterPanel />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
  });
});
