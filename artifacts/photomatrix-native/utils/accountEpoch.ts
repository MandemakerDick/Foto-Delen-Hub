// User IDs alone cannot identify a session: A -> B -> A must invalidate work
// started by the first A, even though the final user ID is the same.
export class AccountEpoch {
  private owner: string | null | undefined;
  private revision = 0;

  constructor(owner: string | null | undefined) { this.owner = owner; }

  observe(owner: string | null | undefined) {
    if (owner !== this.owner) {
      this.owner = owner;
      this.revision += 1;
    }
    return this.revision;
  }

  isCurrent(epoch: number) { return epoch === this.revision; }
}