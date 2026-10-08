import { BaseApi } from "@link-loom/react-sdk";

import { pageOf, recordOf, resultOf } from "@utils/response.utils";

const ENDPOINT = "/reports/snapshot";

/** Snapshots on the app's backend, by the Link Loom contract. Every method answers the data or throws. */
export default class ReportsSnapshotService extends BaseApi {
  constructor(args) {
    super(args);

    this.serviceEndpoints = {
      baseUrl: import.meta.env.VITE_APP_BACKEND_URL,
      get: `${ENDPOINT}/`,
      create: ENDPOINT,
      update: ENDPOINT,
      delete: ENDPOINT,
    };
  }

  async list({ search = "", page = 1, pageSize = 25 } = {}) {
    const response = await this.getByParameters({ queryselector: search ? "search" : "all", search, page, pageSize });
    return pageOf(resultOf(response));
  }

  async read(id) {
    return { record: recordOf(resultOf(await this.getByParameters({ queryselector: "id", search: id }))) };
  }
}
