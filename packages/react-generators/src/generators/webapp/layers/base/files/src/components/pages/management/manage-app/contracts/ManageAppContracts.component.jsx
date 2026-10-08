import { useCallback, useEffect, useState } from "react";
import {
  ContractManagementService,
  createEntityRecord,
  fetchEntityCollection,
  IdentityContractService,
  VeripassContractAcceptance,
  VeripassOrganizationContractsList,
} from "@veripass/react-sdk";

import { useCopy } from "@i18n/index";
import useCurrentUser from "@hooks/useCurrentUser.hook";
import { THEME_COLORS } from "@constants/theme";

const ENVIRONMENT = import.meta.env.VITE_APP_BLACKWOOD_APPS_ENVIRONMENT;
const API_KEY = import.meta.env.VITE_APP_VERIPASS_API_KEY;
const VERIPASS = { environment: ENVIRONMENT, apiKey: API_KEY };
const ACCEPT_ALL = "veripass-contract-acceptance::accept-all";
const SIGNED_STATUSES = new Set(["signed", "active"]);
const SIGNED = { id: 4, name: "signed", title: "Signed", color: THEME_COLORS.success };

const itemsOf = (response) => {
  const items = response?.result?.items || response?.result || [];
  return Array.isArray(items) ? items : [];
};

/** The agreements the app asks its people to accept, the ones still pending and the ones already signed. */
export default function ManageAppContractsComponent() {
  const copy = useCopy();
  const { appId, identity, organizationId } = useCurrentUser();
  const [contracts, setContracts] = useState([]);
  const [signedContracts, setSignedContracts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const words = copy.manageApp.contracts;

  const fetchContracts = useCallback(async () => {
    if (!appId || !identity) {
      setIsLoading(false);
      return;
    }

    const [contractsResponse, signedResponse] = await Promise.all([
      fetchEntityCollection({
        service: ContractManagementService,
        payload: { queryselector: "mandatory", query: { search: appId } },
        apiKey: API_KEY,
        settings: { environment: ENVIRONMENT },
      }),
      fetchEntityCollection({
        service: IdentityContractService,
        payload: { queryselector: "user-id", query: { search: identity } },
        apiKey: API_KEY,
        settings: { environment: ENVIRONMENT },
      }),
    ]);

    setContracts(itemsOf(contractsResponse));
    setSignedContracts(itemsOf(signedResponse));
    setIsLoading(false);
  }, [appId, identity]);

  const acceptAll = async (contractIds) => {
    setIsAccepting(true);
    await Promise.all(
      contractIds.map((contractId) =>
        createEntityRecord({
          service: IdentityContractService,
          payload: {
            principal_party_id: organizationId,
            counterparty_id: identity,
            contract_id: contractId,
            organization_id: organizationId,
            status: SIGNED,
          },
          apiKey: API_KEY,
          settings: { environment: ENVIRONMENT },
        })
      )
    );
    setIsAccepting(false);
    await fetchContracts();
  };

  const handleItemOnAction = ({ action, payload }) => {
    if (action !== ACCEPT_ALL) {
      return;
    }

    acceptAll(payload?.contractIds || []);
  };

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  if (isLoading) {
    return (
      <section className="container-fluid my-4 px-4">
        <section className="d-flex justify-content-center align-items-center py-5">
          <span className="text-muted">{words.loading}</span>
        </section>
      </section>
    );
  }

  const acceptedContractIds = signedContracts
    .filter((record) => SIGNED_STATUSES.has(record?.status?.name))
    .map((record) => record.contract_id);
  const pendingContracts = contracts.filter((contract) => !acceptedContractIds.includes(contract.id));

  return (
    <section className="container-fluid my-4 px-4">
      <section className="col-12 col-xl-9 mx-auto d-block">
        {pendingContracts.length ? (
          <article className="card shadow mb-3">
            <section className="card-body">
              <VeripassContractAcceptance
                pendingContracts={pendingContracts}
                itemOnAction={handleItemOnAction}
                isAccepting={isAccepting}
                {...VERIPASS}
              />
            </section>
          </article>
        ) : null}

        <article className="card shadow mb-3">
          <section className="card-body">
            <h5 className="fw-bold mb-1">{words.listTitle}</h5>
            <p className="text-muted small mb-3">{words.listSubtitle}</p>
            <VeripassOrganizationContractsList
              contracts={contracts}
              acceptedContractIds={acceptedContractIds}
              itemOnAction={handleItemOnAction}
              {...VERIPASS}
            />
          </section>
        </article>
      </section>
    </section>
  );
}
