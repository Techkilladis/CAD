// AWS replacement: Amazon S3 (store the uploaded receipt, return the object key / presigned URL).
export interface ReceiptStorage {
  /** Stores a receipt and returns a reference string (future: S3 key). */
  store(name: string, content?: Buffer | string): Promise<string>;
  /** Resolves a stored reference to a URL (future: presigned S3 URL). */
  resolveUrl(reference: string): string;
}

/** Local reference implementation: nothing is persisted; only a reference string is returned. */
export class LocalReceiptStorage implements ReceiptStorage {
  async store(name: string): Promise<string> {
    return `local-receipt://${encodeURIComponent(name)}`;
  }
  resolveUrl(reference: string): string {
    return reference;
  }
}

export const receiptStorage: ReceiptStorage = new LocalReceiptStorage();
