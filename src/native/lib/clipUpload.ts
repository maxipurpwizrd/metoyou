import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, FileMode, Paths } from "expo-file-system";
import { Upload } from "tus-js-client";
import {
  nativeSupabase,
  nativeSupabaseAnonKey,
  nativeSupabaseUrl,
} from "./supabase";
import { MAX_CLIP_VIDEO_BYTES } from "./clipMediaPolicy";
import { createTusFileReader, type TusFileAccess } from "./tusFileReader";

export const MAX_CLIP_UPLOAD_BYTES = MAX_CLIP_VIDEO_BYTES;
const TUS_CHUNK_BYTES = 6 * 1024 * 1024;
const STAGING_DIRECTORY_NAME = "clip-uploads";
const URL_STORAGE_PREFIX = "metoyou:tus:";
const TUS_UPLOAD_URL_LIFETIME_MS = 24 * 60 * 60 * 1000;

type StoredTusUpload = {
  size: number | null;
  metadata: Record<string, string>;
  creationTime: string;
  uploadUrl: string | null;
  parallelUploadUrls: string[] | null;
  urlStorageKey: string;
};

type ClipUploadCallbacks = {
  signal?: AbortSignal;
  onProgress?: (bytesSent: number, bytesTotal: number) => void;
};

function openExpoFileAccess(uri: string, expectedSize: number): TusFileAccess {
  const file = new File(uri);
  const handle = file.open(FileMode.ReadOnly);
  const size = handle.size;
  if (size === null || size !== expectedSize) {
    handle.close();
    throw new Error("The staged Clip file is missing or has changed.");
  }
  return {
    size,
    async readAt(offset, length) {
      handle.offset = offset;
      return handle.readBytes(length);
    },
    close() {
      handle.close();
    },
  };
}

function createUrlStorage() {
  const isStoredUpload = (
    value: unknown,
  ): value is Pick<StoredTusUpload, "size" | "metadata" | "creationTime"> &
    Partial<Pick<StoredTusUpload, "uploadUrl" | "parallelUploadUrls">> => {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;
    return (
      (record.size === null || typeof record.size === "number") &&
      !!record.metadata &&
      typeof record.metadata === "object" &&
      typeof record.creationTime === "string" &&
      (record.uploadUrl === undefined || record.uploadUrl === null || typeof record.uploadUrl === "string") &&
      (record.parallelUploadUrls === undefined ||
        record.parallelUploadUrls === null ||
        (Array.isArray(record.parallelUploadUrls) &&
          record.parallelUploadUrls.every((url) => typeof url === "string")))
    );
  };
  const getEntries = async (keys: string[]) => {
    const values = await AsyncStorage.multiGet(keys);
    return values.flatMap(([key, raw]) => {
      if (raw === null) return [];
      const entry: unknown = JSON.parse(raw);
      if (!isStoredUpload(entry)) {
        throw new Error(`Invalid resumable-upload record at ${key}.`);
      }
      return [{
        ...entry,
        uploadUrl: entry.uploadUrl ?? null,
        parallelUploadUrls: entry.parallelUploadUrls ?? null,
        urlStorageKey: key,
      }];
    });
  };

  return {
    async findAllUploads() {
      const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith(URL_STORAGE_PREFIX),
      );
      return getEntries(keys);
    },
    async findUploadsByFingerprint(fingerprint: string) {
      const prefix = `${URL_STORAGE_PREFIX}${encodeURIComponent(fingerprint)}:`;
      const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
        key.startsWith(prefix),
      );
      const entries = await getEntries(keys);
      const validEntries: typeof entries = [];
      for (const entry of entries) {
        const createdAt = Date.parse(entry.creationTime);
        if (
          !Number.isFinite(createdAt) ||
          Date.now() - createdAt >= TUS_UPLOAD_URL_LIFETIME_MS
        ) {
          await AsyncStorage.removeItem(entry.urlStorageKey);
          continue;
        }
        validEntries.push(entry);
      }
      return validEntries;
    },
    async removeUpload(key: string) {
      await AsyncStorage.removeItem(key);
    },
    async addUpload(
      fingerprint: string,
      upload: Omit<StoredTusUpload, "urlStorageKey">,
    ) {
      const key = `${URL_STORAGE_PREFIX}${encodeURIComponent(fingerprint)}:${Date.now()}:${Math.random()
        .toString(36)
        .slice(2)}`;
      await AsyncStorage.setItem(
        key,
        JSON.stringify({
          ...upload,
          uploadUrl: upload.uploadUrl ?? null,
          parallelUploadUrls: upload.parallelUploadUrls ?? null,
          urlStorageKey: key,
        }),
      );
      return key;
    },
  };
}

function getTusEndpoint() {
  const url = new URL(nativeSupabaseUrl);
  if (url.hostname.endsWith(".supabase.co")) {
    const projectRef = url.hostname.slice(0, -".supabase.co".length);
    return `${url.protocol}//${projectRef}.storage.supabase.co/storage/v1/upload/resumable`;
  }
  return `${url.origin}/storage/v1/upload/resumable`;
}

async function stageRenderedClip(uri: string, jobId: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(jobId)) {
    throw new Error("The Clip upload identifier is invalid.");
  }
  const source = new File(uri);
  const sourceSize = source.size;
  if (!Number.isSafeInteger(sourceSize) || !sourceSize || sourceSize <= 0) {
    throw new Error("The rendered Clip size is unavailable.");
  }
  if (sourceSize > MAX_CLIP_UPLOAD_BYTES) {
    throw new Error("Rendered videos must be 100 MiB or smaller.");
  }

  const directory = new Directory(Paths.document, STAGING_DIRECTORY_NAME);
  directory.create({ intermediates: true, idempotent: true });
  for (const entry of directory.list()) {
    if (!(entry instanceof File) || !entry.name.endsWith(".mp4")) continue;
    const stagedJobId = entry.name.slice(0, -".mp4".length);
    if (
      /^[a-zA-Z0-9._-]+$/.test(stagedJobId) &&
      entry.lastModified !== null &&
      Date.now() - entry.lastModified >= TUS_UPLOAD_URL_LIFETIME_MS
    ) {
      await discardStagedClipUpload(stagedJobId);
    }
  }
  const stagedFile = new File(directory, `${jobId}.mp4`);
  if (stagedFile.exists && stagedFile.size !== sourceSize) stagedFile.delete();
  try {
    if (!stagedFile.exists) await source.copy(stagedFile);
  } catch (cause) {
    if (stagedFile.exists) stagedFile.delete();
    throw cause;
  }
  if (!stagedFile.exists || stagedFile.size !== sourceSize) {
    stagedFile.delete();
    throw new Error("Could not stage the rendered Clip for resumable upload.");
  }

  return {
    file: stagedFile,
    size: sourceSize,
    cleanup() {
      if (stagedFile.exists) stagedFile.delete();
    },
  };
}

export async function discardStagedClipUpload(jobId: string) {
  if (!/^[a-zA-Z0-9._-]+$/.test(jobId)) {
    throw new Error("The Clip upload identifier is invalid.");
  }
  const file = new File(
    new Directory(Paths.document, STAGING_DIRECTORY_NAME),
    `${jobId}.mp4`,
  );
  if (file.exists) file.delete();

  const uploadRecordFragment = encodeURIComponent(`clip-${jobId}.`);
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) =>
      key.startsWith(URL_STORAGE_PREFIX) &&
      key.includes(uploadRecordFragment),
  );
  if (keys.length > 0) await AsyncStorage.multiRemove(keys);
}

export async function uploadRenderedClip(input: {
  renderedUri: string;
  jobId: string;
  objectPath: string;
  contentType?: string;
} & ClipUploadCallbacks) {
  if (input.signal?.aborted) throw new Error("Clip upload was canceled.");
  const staged = await stageRenderedClip(input.renderedUri, input.jobId);
  const fingerprint = `${input.objectPath}:${staged.size}`;
  let activeFileAccess: TusFileAccess | null = null;
  const closeFileAccess = () => {
    const fileAccess = activeFileAccess;
    activeFileAccess = null;
    fileAccess?.close();
  };
  const fileReader = createTusFileReader(() => {
    const fileAccess = openExpoFileAccess(staged.file.uri, staged.size);
    activeFileAccess = fileAccess;
    return fileAccess;
  });
  const upload = new Upload(new Blob(), {
    endpoint: getTusEndpoint(),
    uploadSize: staged.size,
    chunkSize: TUS_CHUNK_BYTES,
    parallelUploads: 1,
    retryDelays: [0, 1_000, 3_000, 5_000, 10_000, 20_000, 30_000],
    storeFingerprintForResuming: true,
    removeFingerprintOnSuccess: true,
    fingerprint: async () => fingerprint,
    fileReader,
    urlStorage: createUrlStorage(),
    metadata: {
      bucketName: "posts-videos",
      objectName: input.objectPath,
      contentType: input.contentType ?? "video/mp4",
      cacheControl: "3600",
    },
    headers: {
      apikey: nativeSupabaseAnonKey,
      "x-upsert": "false",
    },
    onBeforeRequest: async (request) => {
      const { data, error } = await nativeSupabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("Sign in again before uploading a Clip.");
      request.setHeader("Authorization", `Bearer ${accessToken}`);
      request.setHeader("apikey", nativeSupabaseAnonKey);
    },
    onProgress: (bytesSent, bytesTotal) =>
      input.onProgress?.(bytesSent, bytesTotal),
  });

  try {
    const previousUploads = await upload.findPreviousUploads();
    if (input.signal?.aborted) throw new Error("Clip upload was canceled.");
    if (previousUploads.length > 0) {
      upload.resumeFromPreviousUpload(previousUploads[0]);
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        input.signal?.removeEventListener("abort", cancel);
        if (error !== undefined) reject(error);
        else resolve();
      };
      const cancel = () => {
        void upload.abort(false).then(
          () => {
            closeFileAccess();
            finish(new Error("Clip upload was canceled."));
          },
          (cause: unknown) => {
            closeFileAccess();
            finish(cause);
          },
        );
      };
      input.signal?.addEventListener("abort", cancel, { once: true });
      if (input.signal?.aborted) {
        cancel();
        return;
      }
      upload.options.onSuccess = () => {
        closeFileAccess();
        finish();
      };
      upload.options.onError = (error) => {
        closeFileAccess();
        finish(error);
      };
      upload.start();
    });
    return {
      sizeBytes: staged.size,
      cleanup: staged.cleanup,
    };
  } catch (cause) {
    closeFileAccess();
    if (input.signal?.aborted) {
      throw new Error("Clip upload was canceled.", { cause });
    }
    throw cause;
  }
}

export { TUS_CHUNK_BYTES };
