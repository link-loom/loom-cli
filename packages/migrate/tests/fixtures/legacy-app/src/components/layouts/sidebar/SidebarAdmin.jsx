import { SidebarLinkRow } from '@link-loom/react-sdk';
import { CategoryOutlined as ItemsIcon } from '@mui/icons-material';

export default function SidebarAdmin() {
  return (
    <>
      <div className="menu-title mt-2">Management</div>
      <SidebarLinkRow title="Items" icon={<ItemsIcon fontSize="small" />} onClick={() => navigate('/admin/item')} />
    </>
  );
}
