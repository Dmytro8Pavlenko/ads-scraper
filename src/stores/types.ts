export type StoreStatus = "active" | "removed" | "not_found";

export type StoreOk = {
  bundleId: string;
  ok: true;
  status: StoreStatus;
  title: string | null;
  developerUrl: string | null;
  publisherName: string | null;
  storeDeveloperId: string | null;
  httpStatus: number;
};

export type StoreFail = {
  bundleId: string;
  ok: false;
  httpStatus: number | null;
  error: string;
  retry: boolean;
};

export type StoreResult = StoreOk | StoreFail;

export type StoreAdapter = {
  fetch(bundleIds: string[]): Promise<StoreResult[]>;
};

export function storeNotFound(bundleId: string, httpStatus = 200): StoreOk {
  return {
    bundleId,
    ok: true,
    status: "not_found",
    title: null,
    developerUrl: null,
    publisherName: null,
    storeDeveloperId: null,
    httpStatus,
  };
}

export function storeRetry(
  bundleId: string,
  httpStatus: number | null,
  error: string,
): StoreFail {
  return { bundleId, ok: false, httpStatus, error, retry: true };
}
