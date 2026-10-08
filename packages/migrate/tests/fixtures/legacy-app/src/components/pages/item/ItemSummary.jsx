import { InventoryItemService } from '@services';
import { THEME_COLORS } from '@constants/theme';

export default function ItemSummary() {
  const service = new InventoryItemService();
  return (
    <section style={{ color: THEME_COLORS.brandPrimary, borderColor: '#838790' }}>
      <h2>Every item</h2>
      <img alt="Item photo" src="/assets/images/item.svg" />
      <span>{service ? 'ready' : ''}</span>
    </section>
  );
}
