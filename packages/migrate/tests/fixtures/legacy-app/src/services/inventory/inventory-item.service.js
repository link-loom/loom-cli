import BaseApi from '../base/api.service';

export default class InventoryItemService extends BaseApi {
  constructor(args) {
    super(args);
    this.serviceEndpoints = { baseUrl: import.meta.env.VITE_APP_BACKEND_URL, get: '/inventory/item' };
  }
}
