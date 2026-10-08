import { Outlet } from 'react-router-dom';
import SidebarAdmin from '@components/layouts/sidebar/SidebarAdmin';

export default function LayoutAdmin() {
  return (
    <div id="wrapper">
      <SidebarAdmin />
      <Outlet context={{ setPageName: () => {}, isAdmin: true }} />
    </div>
  );
}
