import { useMemo } from "react";
import { useAuth } from "@veripass/react-sdk";

/** The signed-in person as the frame shows them: name, email, identity and active organization. */
export default function useCurrentUser() {
  const { user } = useAuth();

  return useMemo(() => {
    const profile = user?.payload?.profile || {};
    const email = profile.primary_email_address || "";

    return {
      identity: user?.identity || "",
      name: profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || email,
      firstName: profile.first_name || profile.display_name?.split(" ")[0] || "",
      email,
      organizationId: user?.memberships?.active?.organization_id || user?.payload?.organization_id || "",
      appId: user?.payload?.app_id || "",
      roles: user?.payload?.roles || [],
    };
  }, [user]);
}
