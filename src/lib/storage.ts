import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { parseConnection } from "./connectionConfig";
import type { ConnectionConfig } from "./types";

const STORAGE_KEY = "herdr.connection.v1";

export async function loadConnection(): Promise<ConnectionConfig | null> {
  const value =
    Platform.OS === "web"
      ? globalThis.localStorage?.getItem(STORAGE_KEY) ?? null
      : await SecureStore.getItemAsync(STORAGE_KEY);
  if (!value) return null;
  return parseConnection(value);
}

export async function saveConnection(config: ConnectionConfig | null): Promise<void> {
  if (Platform.OS === "web") {
    if (config) globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(config));
    else globalThis.localStorage?.removeItem(STORAGE_KEY);
    return;
  }
  if (config) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(config));
  else await SecureStore.deleteItemAsync(STORAGE_KEY);
}
