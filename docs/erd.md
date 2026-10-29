# Entity relationship diagram

Generated from `prisma/schema.prisma` by `npm run erd`. Do not edit by hand.

Every table except the Better Auth tables (`USER`, `SESSION`, `ACCOUNT`, `VERIFICATION`) and
`ADMIN_AUDIT_LOG` belongs to one shop through `shopId`. Money columns are `bigint`: US dollars in cents,
Lebanese pounds in whole pounds.

Rules the database enforces: unique `(shopId, number)` and `(shopId, idempotencyKey)` on orders,
unique `(productId, size, colour)` on variants, unique `orderId` on remittance lines and review invites,
unique `orderItemId` on reviews, and CHECK constraints keeping stock and prices at zero or above,
quantities above zero and ratings between 1 and 5.

```mermaid
erDiagram
  USER ||--o{ SESSION : "userId"
  USER ||--o{ ACCOUNT : "userId"
  SHOP ||--o{ MEMBERSHIP : "shopId"
  USER ||--o{ MEMBERSHIP : "userId"
  COURIER |o--o{ MEMBERSHIP : "courierId"
  SHOP ||--o{ INVITATION : "shopId"
  USER ||--o{ INVITATION : "inviterId"
  COURIER |o--o{ INVITATION : "courierId"
  SHOP ||--o{ PRODUCT : "shopId"
  CATEGORY |o--o{ PRODUCT : "categoryId"
  SHOP ||--o{ CATEGORY : "shopId"
  SHOP ||--o{ HERO_SLIDE : "shopId"
  SHOP ||--o{ TESTIMONIAL : "shopId"
  SHOP ||--o{ VARIANT : "shopId"
  PRODUCT ||--o{ VARIANT : "productId"
  SHOP ||--o{ PRODUCT_IMAGE : "shopId"
  PRODUCT ||--o{ PRODUCT_IMAGE : "productId"
  SHOP ||--o{ CUSTOMER : "shopId"
  SHOP ||--o{ ORDER : "shopId"
  CUSTOMER ||--o{ ORDER : "customerId"
  COURIER |o--o{ ORDER : "courierId"
  USER |o--o{ ORDER : "deliveredByUserId"
  SHOP ||--o{ ORDER_ITEM : "shopId"
  ORDER ||--o{ ORDER_ITEM : "orderId"
  VARIANT ||--o{ ORDER_ITEM : "variantId"
  SHOP ||--o{ ORDER_EVENT : "shopId"
  ORDER ||--o{ ORDER_EVENT : "orderId"
  SHOP ||--o{ STOCK_MOVEMENT : "shopId"
  VARIANT ||--o{ STOCK_MOVEMENT : "variantId"
  ORDER |o--o{ STOCK_MOVEMENT : "orderId"
  SHOP ||--o{ COURIER : "shopId"
  SHOP ||--o{ REMITTANCE : "shopId"
  COURIER ||--o{ REMITTANCE : "courierId"
  SHOP ||--o{ REMITTANCE_LINE : "shopId"
  REMITTANCE ||--o{ REMITTANCE_LINE : "remittanceId"
  ORDER ||--o| REMITTANCE_LINE : "orderId"
  SHOP ||--o{ REVIEW_INVITE : "shopId"
  ORDER ||--o| REVIEW_INVITE : "orderId"
  SHOP ||--o{ REVIEW : "shopId"
  PRODUCT ||--o{ REVIEW : "productId"
  ORDER_ITEM ||--o| REVIEW : "orderItemId"
  USER ||--o{ ADMIN_AUDIT_LOG : "adminUserId"
  USER {
    string id PK
    string name
    string email UK
    boolean emailVerified
    string image
    datetime createdAt
    datetime updatedAt
    string role
    boolean banned
    string banReason
    datetime banExpires
  }
  SESSION {
    string id PK
    datetime expiresAt
    string token UK
    datetime createdAt
    datetime updatedAt
    string ipAddress
    string userAgent
    string userId FK
    string activeShopId
    string impersonatedBy
  }
  ACCOUNT {
    string id PK
    string accountId
    string providerId
    string userId FK
    string accessToken
    string refreshToken
    string idToken
    datetime accessTokenExpiresAt
    datetime refreshTokenExpiresAt
    string scope
    string password
    datetime createdAt
    datetime updatedAt
  }
  VERIFICATION {
    string id PK
    string identifier
    string value
    datetime expiresAt
    datetime createdAt
    datetime updatedAt
  }
  SHOP {
    string id PK
    string name
    string slug UK
    string logo
    datetime createdAt
    string metadata
    enum currency
    decimal usdLbpRate
    int nextOrderSeq
    string plan
    json theme
    boolean suspended
    string language
    bigint deliveryFeeMinor
    bigint codToleranceMinor
    int autoCancelHours
    string whatsappPhone
    int baselineOrdersPerDay
    int baselineConfirmMinutes
    string stripeCustomerId
    string stripeSubscriptionId
    string tagline
    string about
    string shippingInfo
    string instagramUrl
    string facebookUrl
    string logoMode
    string homeSection
    boolean showTestimonials
  }
  MEMBERSHIP {
    string id PK
    string shopId FK
    string userId FK
    string role
    string courierId FK
    datetime createdAt
  }
  INVITATION {
    string id PK
    string shopId FK
    string email
    string role
    string status
    datetime expiresAt
    datetime createdAt
    string inviterId FK
    string courierId FK
  }
  PRODUCT {
    string id PK
    string shopId FK
    string name
    string description
    enum status
    decimal ratingAvg
    int ratingCount
    string categoryId FK
    boolean featured
    json specs
    string customLabel
    string customPlaceholder
    boolean customRequired
    int customMaxLength
    datetime createdAt
    datetime updatedAt
  }
  CATEGORY {
    string id PK
    string shopId FK
    string name
    int position
    datetime createdAt
  }
  HERO_SLIDE {
    string id PK
    string shopId FK
    string imageUrl
    string kicker
    string title
    string body
    int position
    datetime createdAt
  }
  TESTIMONIAL {
    string id PK
    string shopId FK
    string authorName
    string message
    enum status
    datetime createdAt
    datetime moderatedAt
    string moderatedById
  }
  VARIANT {
    string id PK
    string shopId FK
    string productId FK
    string size
    string colour
    string sku
    bigint priceMinor
    int available
    int reserved
    boolean archived
  }
  PRODUCT_IMAGE {
    string id PK
    string shopId FK
    string productId FK
    string url
    string colour
    int position
  }
  CUSTOMER {
    string id PK
    string shopId FK
    string name
    string phone
    string email
    datetime createdAt
  }
  ORDER {
    string id PK
    string shopId FK
    int number
    string publicToken UK
    string idempotencyKey
    enum status
    enum source
    string createdByUserId
    string customerId FK
    string customerName
    string customerPhone
    string customerEmail
    string governorate
    string district
    string area
    string addressLine
    string landmark
    string notes
    string courierId FK
    enum currency
    decimal usdLbpRate
    bigint subtotalMinor
    bigint deliveryFeeMinor
    bigint totalMinor
    bigint codMinor
    bigint reportedUsdCents
    bigint reportedLbp
    string failureReason
    string deliveredByUserId FK
    datetime firstContactAt
    datetime confirmedAt
    datetime deliveredAt
    datetime createdAt
    datetime updatedAt
  }
  ORDER_ITEM {
    string id PK
    string shopId FK
    string orderId FK
    string variantId FK
    string nameSnapshot
    bigint unitPriceMinor
    int qty
    string note
  }
  ORDER_EVENT {
    string id PK
    string shopId FK
    string orderId FK
    enum type
    string fromValue
    string toValue
    string note
    string actorUserId
    datetime at
  }
  STOCK_MOVEMENT {
    string id PK
    string shopId FK
    string variantId FK
    string orderId FK
    int delta
    enum reason
    string note
    string actorUserId
    datetime at
  }
  COURIER {
    string id PK
    string shopId FK
    enum type
    string name
    string phone
    boolean active
    datetime createdAt
  }
  REMITTANCE {
    string id PK
    string shopId FK
    string courierId FK
    bigint amountUsdCents
    bigint amountLbp
    datetime receivedAt
    string reference
    string recordedByUserId
    datetime createdAt
  }
  REMITTANCE_LINE {
    string id PK
    string shopId FK
    string remittanceId FK
    string orderId FK, UK
    bigint collectedUsdCents
    bigint collectedLbp
    bigint feeMinor
  }
  REVIEW_INVITE {
    string id PK
    string shopId FK
    string orderId FK, UK
    string tokenHash UK
    datetime expiresAt
    datetime emailSentAt
    datetime usedAt
    datetime createdAt
  }
  REVIEW {
    string id PK
    string shopId FK
    string productId FK
    string orderItemId FK, UK
    int rating
    string comment
    string authorName
    enum status
    string hiddenByUserId
    datetime hiddenAt
    datetime createdAt
  }
  ADMIN_AUDIT_LOG {
    string id PK
    string adminUserId FK
    string shopId
    string action
    datetime at
  }
```
