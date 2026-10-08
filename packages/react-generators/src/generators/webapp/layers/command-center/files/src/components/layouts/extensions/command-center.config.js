/** The Command Center runs only when the deployment turns it on (VITE_SOMMATIC_ENABLED="true"). */
export const isCommandCenterEnabled = () => import.meta.env.VITE_SOMMATIC_ENABLED === "true";

export const OPEN_COMMAND_CENTER_EVENT = "sommatic:open-command-center";

export const openCommandCenter = (detail) => window.dispatchEvent(new CustomEvent(OPEN_COMMAND_CENTER_EVENT, { detail }));

/** "/navigate take me there" becomes "[/navigate] take me there", the chip the Command Center shows a command as. */
export const toChipMessage = (query) => {
  const trimmed = String(query || "").trim();
  if (!trimmed.startsWith("/")) {
    return trimmed || null;
  }

  const [command, ...rest] = trimmed.slice(1).split(" ");
  return `[/${command}] ${rest.join(" ")}`.trim();
};
