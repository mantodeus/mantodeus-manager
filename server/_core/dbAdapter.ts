import { ENV } from "./env";
import * as realDb from "../db";
import { mockDb } from "../dev/mockDb";

export type DbAdapter = typeof realDb;

export const db: DbAdapter = ENV.isUiDevMode ? mockDb : realDb;
