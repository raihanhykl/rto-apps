import {
  ITransactionManager,
  TransactionalRepos,
} from '../../domain/interfaces/ITransactionManager';

export class InMemoryTransactionManager implements ITransactionManager {
  constructor(private repos: TransactionalRepos) {}

  async runInTransaction<T>(fn: (repos: TransactionalRepos) => Promise<T>): Promise<T> {
    // InMemory: no real transaction, just pass through existing repos
    return fn(this.repos);
  }
}
