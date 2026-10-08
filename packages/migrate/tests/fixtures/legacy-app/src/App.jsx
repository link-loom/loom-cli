import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LayoutAdmin } from './layouts';
import { InventoryItems } from '@pages';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin" element={<LayoutAdmin />}>
          <Route index element={<Navigate to="/admin/item" />} />
          <Route path="item">
            <Route index element={<InventoryItems />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
