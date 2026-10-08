# Inventory — flows

Sequence diagrams for [inventory](domain-model.md). Rule numbers refer to its Business rules. One Mermaid `sequenceDiagram` per use case whose request crosses more than one component: controller, use case, driven ports, and whatever happens after the response.

## ReserveStock

Called by ordering through the barrel; no route.

```mermaid
sequenceDiagram
  participant O as Ordering
  participant U as ReserveStock
  participant V as Reservations
  participant S as StockItems
  O->>U: { orderId, lines }
  U->>V: byOrderId(orderId)
  alt a held or committed reservation exists
    U-->>O: the existing reservation (rule 2)
  end
  U->>S: byId(productId) for every line
  alt a product has no stock record
    U-->>O: PRODUCT_NOT_STOCKED (rules 5, 10)
  end
  Note over U: StockItem.reserve: rule 1, available >= quantity
  alt a line falls short
    U-->>O: INSUFFICIENT_STOCK (rule 1)
  end
  U->>S: save(item) for every line
  U->>V: save(reservation)
  U-->>O: { orderId, lines }
```

## ReleaseStock

```mermaid
sequenceDiagram
  participant O as Ordering
  participant U as ReleaseStock
  participant V as Reservations
  participant S as StockItems
  O->>U: { orderId }
  U->>V: byOrderId(orderId)
  alt unknown or not held
    U-->>O: {} (rules 3, 9)
  end
  U->>S: byId(productId) for every line
  Note over U: StockItem.release: rule 3
  U->>S: save(item) for every line
  U->>V: save(reservation Released)
  U-->>O: {}
```

## CommitStock

```mermaid
sequenceDiagram
  participant O as Ordering
  participant U as CommitStock
  participant V as Reservations
  participant S as StockItems
  O->>U: { orderId }
  U->>V: byOrderId(orderId)
  alt unknown or not held
    U-->>O: {} (rule 9)
  end
  U->>S: byId(productId) for every line
  Note over U: StockItem.commit: rule 4
  U->>S: save(item) for every line
  U->>V: save(reservation Committed)
  U-->>O: {}
```

## SetStockLevel

```mermaid
sequenceDiagram
  participant C as StockController
  participant U as SetStockLevel
  participant S as StockItems
  C->>U: { productId, onHand }
  Note over U: StockLevel.of: rule 6
  alt not an integer of 0 or more
    U-->>C: STOCK_LEVEL_INVALID (rule 6, 422)
  end
  U->>S: byId(productId)
  Note over U: no record: a new item with nothing reserved (rule 7)
  U->>S: save(item)
  U-->>C: { productId, onHand, reserved }
  Note over C: 200
```

## GetStockLevel

```mermaid
sequenceDiagram
  participant C as StockController
  participant U as GetStockLevel
  participant S as StockItems
  C->>U: { productId }
  U->>S: byId(productId)
  alt no stock record
    U-->>C: PRODUCT_NOT_STOCKED (rule 5, 404)
  end
  U-->>C: { productId, onHand, reserved }
  Note over C: 200
```
