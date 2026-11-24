export type TusFileAccess = {
  size: number;
  readAt(offset: number, length: number): Promise<Uint8Array<ArrayBuffer>>;
  close(): void;
};

type TusFileSource = {
  size: number;
  slice(start: number, end: number): Promise<{ value: Blob; done: boolean }>;
  close(): void;
};

type TusFileReader = {
  openFile(input: unknown, chunkSize: number): Promise<TusFileSource>;
};

export function createTusFileReader(
  openFile: () => Promise<TusFileAccess> | TusFileAccess,
): TusFileReader {
  return {
    async openFile() {
      const file = await openFile();
      return {
        size: file.size,
        async slice(start, end) {
          if (
            !Number.isSafeInteger(start) ||
            !Number.isSafeInteger(end) ||
            start < 0 ||
            end < start ||
            end > file.size
          ) {
            throw new RangeError("The TUS client requested an invalid file range.");
          }
          const bytes = await file.readAt(start, end - start);
          if (bytes.byteLength !== end - start) {
            throw new Error("Could not read the requested upload chunk from the staged file.");
          }
          return {
            value: new Blob([bytes], { type: "application/offset+octet-stream" }),
            done: end >= file.size,
          };
        },
        close() {
          file.close();
        },
      };
    },
  };
}
