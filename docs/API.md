# Parley Protocol API

Protocol version: `parley-negotiation/0.1`

All responses include `protocolVersion`. Request and response bodies use Parley protocol objects directly, not UI-specific payloads.

## Start Negotiation

`POST /api/negotiate/start`

Request:

```json
{
  "request": {
    "id": "request_brand_kit_001",
    "buyerAgentId": "buyer-agent-demo",
    "service": "Launch landing page copy",
    "requestedItems": ["headline set", "feature bullets", "pricing FAQ"],
    "targetPrice": 46,
    "maxPrice": 58,
    "currency": "USDC",
    "desiredDeliveryDays": 3
  },
  "policy": {
    "sellerAgentId": "seller-agent-copywriter",
    "service": "Launch landing page copy",
    "currency": "USDC",
    "minimumPrice": 44,
    "preferredPrice": 64,
    "standardDeliveryDays": 5,
    "rushFee": 8,
    "bundleDiscount": 10,
    "maxRounds": 3
  }
}
```

Response:

```json
{
  "protocolVersion": "parley-negotiation/0.1",
  "result": {
    "session": {
      "negotiationId": "negotiation_abc123",
      "buyerAgentId": "buyer-agent-demo",
      "sellerAgentId": "seller-agent-copywriter",
      "currentRound": 3,
      "maxRounds": 3,
      "currentState": "agreement",
      "messageHistory": []
    },
    "agreement": {
      "messageType": "Agreement",
      "payload": {
        "agreementId": "agreement_abc123",
        "negotiationId": "negotiation_abc123",
        "finalOffer": {
          "price": 58,
          "currency": "USDC"
        }
      }
    }
  },
  "commerce": {
    "order": {
      "orderId": "order_abc123",
      "negotiationId": "negotiation_abc123",
      "status": "SETTLED",
      "createdAt": "2026-07-05T18:00:00.000Z",
      "updatedAt": "2026-07-05T18:01:00.000Z",
      "lifecycle": [
        { "status": "POSTED", "at": "2026-07-05T18:00:00.000Z", "note": "Order posted from buyer request." },
        { "status": "NEGOTIATING", "at": "2026-07-05T18:00:01.000Z", "note": "Negotiation in progress." },
        { "status": "LOCKED", "at": "2026-07-05T18:00:30.000Z", "note": "Negotiation produced immutable locked terms." },
        { "status": "DELIVERING", "at": "2026-07-05T18:00:31.000Z", "note": "Placeholder delivery proof attached." },
        { "status": "DELIVERED", "at": "2026-07-05T18:00:32.000Z", "note": "Delivery proof acknowledged." },
        { "status": "SETTLING", "at": "2026-07-05T18:00:33.000Z", "note": "Settlement adapter invoked." },
        { "status": "SETTLED", "at": "2026-07-05T18:01:00.000Z", "note": "Order settled via mock." }
      ],
      "lockedTerms": {
        "lockedTermsId": "locked_abc123",
        "orderId": "order_abc123",
        "negotiationId": "negotiation_abc123",
        "agreementId": "agreement_abc123",
        "buyerAgentId": "buyer-agent-demo",
        "sellerAgentId": "seller-agent-copywriter",
        "service": "Launch landing page copy",
        "currency": "USDC",
        "price": 58,
        "deliveryDays": 5,
        "bundleItems": ["headline set", "feature bullets", "pricing FAQ"],
        "paymentSchedule": "upfront",
        "lockedAt": "2026-07-05T18:00:30.000Z",
        "expiresAt": "2026-07-05T18:30:00.000Z"
      },
      "deliveryProof": {
        "proofId": "proof_abc123",
        "orderId": "order_abc123",
        "proofType": "placeholder",
        "submittedAt": "2026-07-05T18:00:31.000Z",
        "artifactHash": "placeholder-proof-hash",
        "note": "Placeholder proof attached before settlement. Replace with real CROO delivery proof when available."
      },
      "settlement": {
        "settlementId": "settlement_abc123",
        "adapter": "mock",
        "status": "SETTLED",
        "settledAt": "2026-07-05T18:01:00.000Z",
        "reference": "mock:order_abc123"
      }
    }
  },
  "market": {
    "service": "Launch landing page copy",
    "currency": "USDC",
    "marketAverage": 72,
    "marketRange": {
      "low": 52,
      "high": 96
    },
    "recommendedOffer": 58,
    "savingsAfterNegotiation": 14,
    "savingsPercent": 19,
    "dataSource": "demo"
  },
  "explanations": []
}
```

## Submit Protocol Message

`POST /api/negotiate/message`

Request:

```json
{
  "negotiationId": "negotiation_abc123",
  "message": {
    "id": "counter_123",
    "sender": "buyer-agent-demo",
    "receiver": "seller-agent-copywriter",
    "timestamp": "2026-07-05T18:00:00.000Z",
    "messageType": "CounterOffer",
    "payload": {
      "negotiationId": "negotiation_abc123",
      "price": 56,
      "currency": "USDC",
      "deliveryDays": 5,
      "bundleItems": ["headline set", "feature bullets"],
      "paymentSchedule": "upfront",
      "expiresAt": "2026-07-05T18:30:00.000Z",
      "round": 2
    }
  }
}
```

Response:

```json
{
  "protocolVersion": "parley-negotiation/0.1",
  "session": {
    "negotiationId": "negotiation_abc123",
    "currentState": "awaiting_seller_response",
    "messageHistory": []
  },
  "commerce": {
    "order": {
      "status": "NEGOTIATING"
    }
  }
}
```

## Get Session

`GET /api/negotiate/:id`

Response:

```json
{
  "protocolVersion": "parley-negotiation/0.1",
  "session": {
    "negotiationId": "negotiation_abc123",
    "currentRound": 3,
    "currentState": "agreement",
    "messageHistory": []
  },
  "commerce": {
    "order": {
      "status": "SETTLED"
    }
  }
}
```

## Get History

`GET /api/negotiate/:id/history`

Response:

```json
{
  "protocolVersion": "parley-negotiation/0.1",
  "negotiationId": "negotiation_abc123",
  "messageHistory": [
    {
      "id": "offer_123",
      "sender": "buyer-agent-demo",
      "receiver": "seller-agent-copywriter",
      "timestamp": "2026-07-05T18:00:00.000Z",
      "messageType": "Offer",
      "payload": {
        "negotiationId": "negotiation_abc123",
        "price": 46,
        "currency": "USDC",
        "round": 1
      }
    }
  ]
}
```

## Errors

Errors are versioned too:

```json
{
  "protocolVersion": "parley-negotiation/0.1",
  "error": "Negotiation not found"
}
```

## CROO Lifecycle Notes

Parley does not invent CAP settlement calls. The commerce order only models the lifecycle the official CROO materials describe: negotiate, lock, deliver, clear.
