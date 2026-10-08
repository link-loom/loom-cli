import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bolt as BoltIcon } from "@mui/icons-material";
import { useOmniSearchRegisterCommand } from "@link-loom/react-sdk";
import {
  ChatBubble,
  CognitiveEntry,
  CognitiveInfrastructureLLMProviderService,
  ConversationExecutionService,
  getExecCommands,
  getReadCommands,
  SystemResponse,
  useCommandCenter,
} from "@sommatic/react-sdk";

import { useCopy } from "@i18n/index";
import { isCommandCenterEnabled, openCommandCenter, toChipMessage } from "./command-center.config";

const ICONS = { Bolt: <BoltIcon /> };

/**
 * Omnisearch's side of the Command Center: free text that matches nothing goes to it, and its slash commands are
 * listed and registered. Empty when the Command Center is off.
 */
export function useCommandCenterSearch({ closeSearch }) {
  const copy = useCopy();
  const navigate = useNavigate();
  const { registerCommands, getContext, registry } = useCommandCenter() || {};
  const isEnabled = isCommandCenterEnabled();

  const commands = useMemo(() => {
    if (!isEnabled) {
      return [];
    }

    return [
      {
        id: "cmd-center",
        label: "/command-center",
        description: copy.commandCenter.slashDescription,
        icon: <BoltIcon />,
        isPriority: true,
        action: (query) => {
          closeSearch();
          openCommandCenter({ initialMessage: toChipMessage(query) });
        },
      },
      ...(registry ? getReadCommands({ getContext, icons: ICONS, registry }) : []),
      ...(registry ? getExecCommands({ navigate, icons: ICONS, registry }) : []),
    ];
  }, [isEnabled, copy, closeSearch, getContext, navigate, registry]);

  // Picking a command in Omnisearch opens the Command Center with it; one that takes arguments is pre-filled instead.
  const searchCommands = useMemo(
    () =>
      commands.map((command) => ({
        ...command,
        action: (query) => {
          closeSearch();
          const message = toChipMessage(query);
          const takesArguments = Object.keys(command?.schema?.properties || {}).length > 0;
          const label = command.label?.startsWith("/") ? command.label : `/${command.label}`;
          const hasArguments = String(query || "").trim().length > label.length;
          openCommandCenter(takesArguments && !hasArguments ? { prefillEntry: message } : { initialMessage: message });
        },
      })),
    [commands, closeSearch]
  );

  useOmniSearchRegisterCommand(searchCommands);

  useEffect(() => {
    if (!registerCommands) {
      return undefined;
    }

    return registerCommands(commands);
  }, [commands, registerCommands]);

  const categories = isEnabled
    ? [
        {
          id: "command-center",
          label: copy.commandCenter.category,
          icon: <BoltIcon />,
          onCreate: (query) => {
            closeSearch();
            openCommandCenter({ initialMessage: query });
          },
          createLabel: copy.commandCenter.send,
        },
      ]
    : [];

  return { categories, commands: [] };
}

/** The assistant of the help centers: the Command Center's chat, when it is on. */
export function useSupportAssistant() {
  const executionService = useMemo(() => new ConversationExecutionService(), []);

  if (!isCommandCenterEnabled()) {
    return null;
  }

  return {
    executionService,
    llmProviderService: CognitiveInfrastructureLLMProviderService,
    components: { CognitiveEntry, ChatBubble, SystemResponse },
  };
}
