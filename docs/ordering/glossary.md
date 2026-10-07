# Ordering glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.

**Order.** A customer's request to buy products, with its lines and a status. The aggregate root of the context.

**Order id.** The identity of an order. The repository hands it out when the order is created.

**Order line.** One product in an order, with its quantity and the unit price frozen when the line was added. An order has at most one line per product.

**Order status.** Where an order is in its lifecycle: Draft, Placed or Cancelled.

**Draft.** The status of a new order. A draft is the only order whose lines can change and the only one that can be placed.

**Placed.** The status of an order the customer committed to. Its lines no longer change.

**Cancelled.** The status of an order that was withdrawn from Draft or Placed. It is final.

**Place.** Move a draft order that has at least one line to Placed.

**Cancel.** Move a Draft or Placed order to Cancelled.

**Product id.** The identity of a product, as the catalog names it. Ordering only holds the id.

**Quantity.** How many units of a product a line holds: a whole number from 1 to 99.

**Money.** An amount in minor units (cents for dollars) and its currency. It has no decimals.

**Minor units.** The smallest unit of a currency, held as an integer so that amounts never round.

**Currency.** A three-letter uppercase code such as USD or EUR. All lines of an order share one.

**Unit price.** The price of one unit of a product. It is frozen into the line when the line is added and never follows the catalog afterwards.

**Frozen price.** A unit price copied into an order line. A later catalog change does not touch it.

**Order repository.** The driven port that stores orders and hands out order ids.

**Product prices.** The driven port that answers the current price of a product, or that the product is unknown. It will be answered by the catalog context.

**Ordering error.** The refusal a rule raises. It carries one error code, for example `ORDER_EMPTY`.
