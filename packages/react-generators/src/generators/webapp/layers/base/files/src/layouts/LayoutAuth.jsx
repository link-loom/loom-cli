import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { PageMetaProvider } from "@link-loom/react-sdk";
import { AuthShell, useCopy } from "@link-loom/react-shell";

/** Sign-in, sign-up and recovery: no navigation, the form centred. */
export default function LayoutAuth() {
  const copy = useCopy();

  return (
    <PageMetaProvider appName={copy.app.name}>
      <AuthShell>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </AuthShell>
    </PageMetaProvider>
  );
}
