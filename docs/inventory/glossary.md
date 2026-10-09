# Inventory glossary

Terms of this bounded context. One meaning per term; the same word in another context is a different term.

**Stock item.** The stock record of one product: how many units are on hand and how many of them are reserved. The aggregate root of the context.

**Product id.** The identity of a product, as the catalog names it. Inventory only holds the id.

**On hand.** The units of a product physically in stock, reserved or not.

**Reserved.** The units of a product set aside for orders that have not been committed or released.

**Available.** The units that can still be reserved: on hand minus reserved.

**Stock level.** The on-hand count that is set or read through the routes: a whole number of 0 or more.

**Reservation.** The units of one or more products set aside for one order. There is one per order, and it is all-or-nothing.

**Reserve.** Set aside the units of every line of an order, or refuse the whole order.

**Held.** The status of a reservation whose units are set aside. Only a held reservation can be released or committed.

**Release.** Return the units of a held reservation to available, because the order will not go ahead.

**Released.** The final status of a reservation that was released.

**Commit.** Consume the units of a held reservation: they leave both on hand and reserved, because the order was paid.

**Committed.** The final status of a reservation that was committed.

**Not stocked.** A product with no stock record. Inventory refuses it instead of guessing zero.

**Stock items.** The driven port that stores stock items.

**Reservations.** The driven port that stores reservations.

**Inventory error.** The refusal a rule raises. It carries one error code, for example `INSUFFICIENT_STOCK`.
