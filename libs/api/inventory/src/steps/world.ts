import { After, QuickPickleWorld, setWorldConstructor } from 'quickpickle';
import { makeCommitStock } from '../application/CommitStock';
import {
  makeGetStockLevel,
  type GetStockLevelResult,
} from '../application/GetStockLevel';
import { makeReleaseStock } from '../application/ReleaseStock';
import {
  makeReserveStock,
  type ReserveStockResult,
} from '../application/ReserveStock';
import { makeSetStockLevel } from '../application/SetStockLevel';
import { InventoryError } from '../domain/errors';
import { MemoryReservations } from '../infrastructure/MemoryReservations';
import { MemoryStockItems } from '../infrastructure/MemoryStockItems';

export class InventoryWorld extends QuickPickleWorld {
  private readonly stockItems = new MemoryStockItems();
  private readonly reservations = new MemoryReservations();
  readonly reserveStock = makeReserveStock(this.stockItems, this.reservations);
  readonly releaseStock = makeReleaseStock(this.stockItems, this.reservations);
  readonly commitStock = makeCommitStock(this.stockItems, this.reservations);
  readonly setStockLevel = makeSetStockLevel(this.stockItems);
  readonly getStockLevel = makeGetStockLevel(this.stockItems);

  /** Refusals no step has claimed yet; the After hook fails the scenario if any is left. */
  readonly refusals: InventoryError[] = [];
  reservation: ReserveStockResult | undefined;
  shown: GetStockLevelResult | undefined;

  /** Runs a command; a business refusal is kept for "it is refused with", anything else fails the step. */
  async attempt<T>(run: () => Promise<T>): Promise<T | undefined> {
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof InventoryError)) throw error;
      this.refusals.push(error);
      return undefined;
    }
  }
}

setWorldConstructor(InventoryWorld);

After((world: InventoryWorld) =>
  world.refusals.length === 0
    ? Promise.resolve()
    : Promise.reject(
        new Error(
          `unclaimed refusals: ${world.refusals.map((r) => r.code).join(', ')}`,
        ),
      ),
);
