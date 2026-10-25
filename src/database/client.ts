import * as SQLite from 'expo-sqlite';
import { FinanceRepository, type Atomic, type Connection } from './repository';

let instance: Promise<FinanceRepository> | undefined;
export function getRepository(): Promise<FinanceRepository> {
  if (!instance)
    instance = (async () => {
      const db = await SQLite.openDatabaseAsync('monomoney.db', {
        useNewConnection: true,
      });
      try {
        await db.execAsync(
          'PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;',
        );
        // This connection is private. Every query runs through the repository's queue.
        // Keep FK configuration on this connection BEFORE BEGIN; setting it inside a
        // transaction (including an Expo exclusive transaction's new connection) is a no-op.
        const atomic: Atomic = async function <T>(
          job: (connection: Connection) => Promise<T>,
        ): Promise<T> {
          let value!: T;
          await db.withTransactionAsync(async () => {
            value = await job(db);
          });
          return value;
        };
        const repository = new FinanceRepository(atomic);
        await repository.initialize();
        return repository;
      } catch (error) {
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    })().catch((error) => {
      instance = undefined;
      throw error;
    });
  return instance;
}
