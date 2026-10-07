import type { OrderingErrorCode } from './errors';
import { Money } from './Money';
import { Order } from './Order';
import { OrderId } from './OrderId';
import { ProductId } from './ProductId';
import { Quantity } from './Quantity';

const refused = (code: OrderingErrorCode): unknown =>
  expect.objectContaining({ name: 'OrderingError', code });

const keyboard = ProductId.of('keyboard');
const mouse = ProductId.of('mouse');
const usd = (amount: number) => Money.of(amount, 'USD');
const draft = () => Order.create(OrderId.of('ord-1'));
const withKeyboard = () => draft().addLine(keyboard, Quantity.of(1), usd(4500));
const summary = (order: Order) =>
  order.lines.map((line) => [
    line.productId.value,
    line.quantity.value,
    line.unitPrice.amount,
    line.unitPrice.currency,
  ]);

describe('Order', () => {
  describe('create (rule 1)', () => {
    it('starts as a draft with no lines', () => {
      const order = draft();
      expect(order.id.value).toBe('ord-1');
      expect(order.status).toBe('Draft');
      expect(order.lines).toEqual([]);
    });
  });

  describe('addLine', () => {
    it('adds a line with the given price', () => {
      expect(summary(withKeyboard())).toEqual([['keyboard', 1, 4500, 'USD']]);
    });

    it('keeps lines in the order they were added', () => {
      const order = withKeyboard().addLine(mouse, Quantity.of(2), usd(2500));
      expect(summary(order)).toEqual([
        ['keyboard', 1, 4500, 'USD'],
        ['mouse', 2, 2500, 'USD'],
      ]);
    });

    it('does not change the order it was called on', () => {
      const before = withKeyboard();
      before.addLine(mouse, Quantity.of(2), usd(2500));
      expect(summary(before)).toEqual([['keyboard', 1, 4500, 'USD']]);
    });

    it('adds to the line of a product already in the order (rule 3)', () => {
      const order = withKeyboard().addLine(keyboard, Quantity.of(4), usd(4500));
      expect(summary(order)).toEqual([['keyboard', 5, 4500, 'USD']]);
    });

    it('keeps the frozen price when the product is added again (rule 5)', () => {
      const order = withKeyboard().addLine(keyboard, Quantity.of(1), usd(5000));
      expect(summary(order)).toEqual([['keyboard', 2, 4500, 'USD']]);
    });

    it('merges into the right line among several', () => {
      const order = withKeyboard()
        .addLine(mouse, Quantity.of(2), usd(2500))
        .addLine(mouse, Quantity.of(3), usd(2500));
      expect(summary(order)).toEqual([
        ['keyboard', 1, 4500, 'USD'],
        ['mouse', 5, 2500, 'USD'],
      ]);
    });

    it('refuses a merged sum above 99 (rule 3)', () => {
      const order = draft().addLine(keyboard, Quantity.of(60), usd(4500));
      expect(() => order.addLine(keyboard, Quantity.of(40), usd(4500))).toThrow(
        refused('QUANTITY_OUT_OF_RANGE'),
      );
      expect(summary(order)).toEqual([['keyboard', 60, 4500, 'USD']]);
    });

    it('refuses a line in another currency (rule 7)', () => {
      expect(() =>
        withKeyboard().addLine(mouse, Quantity.of(1), Money.of(900, 'EUR')),
      ).toThrow(refused('CURRENCY_MISMATCH'));
    });

    it('accepts a second line in the same currency (rule 7)', () => {
      const order = withKeyboard().addLine(mouse, Quantity.of(1), usd(2500));
      expect(order.lines).toHaveLength(2);
    });

    it('refuses a placed order (rule 4)', () => {
      expect(() =>
        withKeyboard().place().addLine(mouse, Quantity.of(1), usd(2500)),
      ).toThrow(refused('ORDER_NOT_EDITABLE'));
    });

    it('refuses a cancelled order (rule 4)', () => {
      expect(() =>
        draft().cancel().addLine(keyboard, Quantity.of(1), usd(4500)),
      ).toThrow(refused('ORDER_NOT_EDITABLE'));
    });

    it('checks the state before the sum (rule 11)', () => {
      const placed = draft()
        .addLine(keyboard, Quantity.of(1), usd(4500))
        .place();
      expect(() =>
        placed.addLine(keyboard, Quantity.of(99), usd(4500)),
      ).toThrow(refused('ORDER_NOT_EDITABLE'));
    });
  });

  describe('place', () => {
    it('places a draft with lines and keeps them (rule 6)', () => {
      const placed = withKeyboard().place();
      expect(placed.status).toBe('Placed');
      expect(summary(placed)).toEqual([['keyboard', 1, 4500, 'USD']]);
      expect(placed.id.value).toBe('ord-1');
    });

    it('does not change the order it was called on', () => {
      const before = withKeyboard();
      before.place();
      expect(before.status).toBe('Draft');
    });

    it('refuses an order without lines (rule 6)', () => {
      expect(() => draft().place()).toThrow(refused('ORDER_EMPTY'));
    });

    it('refuses a placed order (rule 10)', () => {
      expect(() => withKeyboard().place().place()).toThrow(
        refused('ORDER_NOT_EDITABLE'),
      );
    });

    it('refuses a cancelled order with the state refusal before the empty one (rules 10, 11)', () => {
      expect(() => draft().cancel().place()).toThrow(
        refused('ORDER_NOT_EDITABLE'),
      );
    });
  });

  describe('cancel (rule 8)', () => {
    it('cancels a draft', () => {
      expect(draft().cancel().status).toBe('Cancelled');
    });

    it('cancels a placed order and keeps its lines', () => {
      const cancelled = withKeyboard().place().cancel();
      expect(cancelled.status).toBe('Cancelled');
      expect(summary(cancelled)).toEqual([['keyboard', 1, 4500, 'USD']]);
      expect(cancelled.id.value).toBe('ord-1');
    });

    it('does not change the order it was called on', () => {
      const before = draft();
      before.cancel();
      expect(before.status).toBe('Draft');
    });

    it('refuses a cancelled order', () => {
      expect(() => draft().cancel().cancel()).toThrow(
        refused('ORDER_NOT_CANCELLABLE'),
      );
    });
  });
});
