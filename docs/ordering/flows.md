# Ordering — flows

Sequence diagrams for [ordering](domain-model.md). Rule numbers refer to its Business rules. One Mermaid `sequenceDiagram` per use case whose request crosses more than one component: controller, use case, driven ports, and whatever happens after the response.

## CreateOrder

```mermaid
sequenceDiagram
  participant C as OrdersController
  participant U as CreateOrder
  participant R as OrderRepository
  C->>U: {}
  U->>R: nextId()
  R-->>U: OrderId
  Note over U: rule 1: a new Draft order without lines
  U->>R: save(order)
  U-->>C: { orderId }
  Note over C: 201
```

## AddOrderLine

```mermaid
sequenceDiagram
  participant C as OrdersController
  participant U as AddOrderLine
  participant R as OrderRepository
  participant P as ProductPrices
  C->>U: { orderId, productId, quantity }
  U->>R: byId(orderId)
  alt no such order
    U-->>C: ORDER_NOT_FOUND (rule 9, 404)
  end
  Note over U: rule 2: quantity from 1 to 99
  U->>P: priceOf(productId)
  alt unknown product
    U-->>C: PRODUCT_NOT_FOUND (rule 5, 422)
  end
  Note over U: Order.addLine: rule 4 state, rule 3 sum, rule 7 currency
  alt refused by the order
    U-->>C: ORDER_NOT_EDITABLE (409) or QUANTITY_OUT_OF_RANGE or CURRENCY_MISMATCH (422)
  end
  U->>R: save(order)
  U-->>C: { productId, quantity, unitPrice }
  Note over C: 200
```

## PlaceOrder

```mermaid
sequenceDiagram
  participant C as OrdersController
  participant U as PlaceOrder
  participant R as OrderRepository
  C->>U: { orderId }
  U->>R: byId(orderId)
  alt no such order
    U-->>C: ORDER_NOT_FOUND (rule 9, 404)
  end
  Note over U: Order.place: rule 10 Draft only, rule 6 at least one line
  alt refused by the order
    U-->>C: ORDER_NOT_EDITABLE (409) or ORDER_EMPTY (422)
  end
  U->>R: save(order)
  U-->>C: { orderId, status: Placed }
  Note over C: 200
```

## CancelOrder

```mermaid
sequenceDiagram
  participant C as OrdersController
  participant U as CancelOrder
  participant R as OrderRepository
  C->>U: { orderId }
  U->>R: byId(orderId)
  alt no such order
    U-->>C: ORDER_NOT_FOUND (rule 9, 404)
  end
  Note over U: Order.cancel: rule 8 Draft or Placed
  alt refused by the order
    U-->>C: ORDER_NOT_CANCELLABLE (409)
  end
  U->>R: save(order)
  U-->>C: { orderId, status: Cancelled }
  Note over C: 200
```

## GetOrder

```mermaid
sequenceDiagram
  participant C as OrdersController
  participant U as GetOrder
  participant R as OrderRepository
  C->>U: { orderId }
  U->>R: byId(orderId)
  alt no such order
    U-->>C: ORDER_NOT_FOUND (rule 9, 404)
  end
  U-->>C: { orderId, status, lines }
  Note over C: 200
```
