import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useBootLoader } from "@link-loom/react-shell";

/** Pages outside the app frame: not found and maintenance. */
export default function LayoutMaintenance() {
  useBootLoader();

  return (
    <main className="my-5">
      <div className="container">
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </div>
    </main>
  );
}
