import { useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { OnPageLoaded } from '@link-loom/react-sdk';
import { ItemSummary } from '@components/pages';

export default function InventoryItems() {
  const { setPageName, isAdmin } = useOutletContext();

  useEffect(() => {
    setPageName('Items');
  }, []);

  return (
    <>
      {isAdmin && <ItemSummary />}
      <OnPageLoaded />
    </>
  );
}
