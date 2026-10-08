import { lazy } from "react";
import { Route } from "react-router-dom";

const AccountProfilePage = lazy(() => import("@pages/account/AccountProfile.page"));

export default function AccountRoutes() {
  return (
    <Route path="account">
      <Route path="profile" element={<AccountProfilePage />} />
    </Route>
  );
}
