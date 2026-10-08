# Ordering glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.

**Order.** A customer's request to buy products, with its lines and a status. The aggregate root of the context.

**Order id.** The identity of an order. The repository hands it out when the order is created.

**Order line.** One product in an order, with its quantity and the unit price frozen when the line was added. An order has at most one line per product.

**Order status.** Where an order is in its lifecycle: Draft, Placed, Paid or Cancelled.

**Draft.** The status of a new order. A draft is the only order whose lines can change and the only one that can be placed.

**Placed.** The status of an order while it is being placed: its stock is reserved and its payment is being taken. Its lines no longer change. It lasts only as long as the placement, unless payments gave no answer.

**Paid.** The status of an order whose payment was captured and whose stock was committed. It cannot be cancelled.

**Cancelled.** The status of an order that was withdrawn from Draft. It is final.

**Place.** Reserve the stock of a draft order that has at least one line, charge it, commit the stock and move it to Paid. If the stock or the payment is refused, the order goes back to Draft.

**Cancel.** Move a Draft order to Cancelled. A Placed order is not cancelled.

**Payment method token.** An opaque text that stands for the customer's payment method. Ordering never sees card data and passes the token to payments untouched.

**Order total.** The sum of quantity times unit price over the lines, in the order's currency.

**Product id.** The identity of a product, as the catalog names it. Ordering only holds the id.

**Quantity.** How many units of a product a line holds: a whole number from 1 to 99.

**Money.** An amount in minor units (cents for dollars) and its currency. It has no decimals.

**Minor units.** The smallest unit of a currency, held as an integer so that amounts never round.

**Currency.** A three-letter uppercase code such as USD or EUR. All lines of an order share one.

**Unit price.** The price of one unit of a product. It is frozen into the line when the line is added and never follows the catalog afterwards.

**Frozen price.** A unit price copied into an order line. A later catalog change does not touch it.

**Order repository.** The driven port that stores orders and hands out order ids.

**Product prices.** The driven port that answers the current price of a product, or that the product is unknown. It will be answered by the catalog context.

**Stock reservation.** The driven port to inventory: reserve the stock of an order, release it or commit it.

**Charges.** The driven port to payments: charge an order's total with a payment method token, answered as captured or declined.

**Domain events.** The driven port that publishes what happened to an order: `OrderPaid` and `OrderCancelled`.

**Unknown outcome.** A charge that gave no answer: the money may have been taken, so the order stays Placed and is not compensated.

**Ordering error.** The refusal a rule raises. It carries one error code, for example `ORDER_EMPTY`.
