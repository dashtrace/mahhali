# Mahhali (Shop Link): functional and non-functional requirements

What V1 must do, and how well. Pilot shops are in Lebanon and price in US dollars or Lebanese pounds.

## Functional requirements

**Accounts and roles**

- **FR-1** A business owner can sign up and gets their own shop workspace.
- **FR-2** The owner can invite staff and give each one a role: Manager, Staff or Delivery.
- **FR-3** Each role can only see and do what its role allows (see the roles table in the README).
- **FR-4** A platform admin (us) can see every shop, its orders and its users, and can suspend a shop. Admin access is read-only by default and every admin action is logged.

**Shop and catalogue**

- **FR-5** The owner chooses whether the shop prices in US dollars or Lebanese pounds and sets the exchange rate it uses. The owner can upload a shop logo and choose theme colours; the public catalogue uses them.
- **FR-6** Each shop has a public catalogue page at its own link, made for the Instagram bio.
- **FR-7** The owner can add products with photos and up to three named options (for example Size, Colour or SPF), and variants with a value for each option, each with its own price and stock. Renaming, adding, removing or reordering options keeps every variant's values in step.
- **FR-8** The catalogue only lets customers pick variants that are in stock.

**Ordering**

- **FR-9** A customer can place an order without creating an account, giving name, phone (+961), a Lebanese delivery address (governorate, district, area, street and building, landmark) and an optional email (used for order updates and the review invitation).
- **FR-10** Placing an order reserves the stock immediately; if the stock ran out, the customer is told and no order is created.
- **FR-11** Each order gets a number that is never reused within the shop.
- **FR-12** The customer sees their order number and a private tracking link right after ordering, and receives both by email if they gave one. They can also track an order later by entering its order number together with the phone number they ordered with.
- **FR-13** Staff can enter an order on a customer's behalf for orders that came in by Instagram DM or WhatsApp.

**Order board and delivery**

- **FR-14** Orders move through New, Confirmed, Packed, Out for delivery and Delivered, or are Cancelled or Returned; stock is released or restocked accordingly.
- **FR-15** The owner, a manager or staff assigns each order to a delivery company or an individual delivery person.
- **FR-16** A delivery user sees only the orders assigned to them and can mark each as delivered (with the cash collected, in dollars, pounds or both) or failed.
- **FR-17** Every order shows who delivered it, when, and who marked it, and owners, managers and staff can filter orders by courier.

**Cash on delivery**

- **FR-18** The owner records cash handed over by each courier and which orders it covers.
- **FR-19** A reconciliation view per courier shows expected cash, cash received in dollars and pounds (converted at each order's rate), unpaid delivered orders and any short or over amounts.

**Pilot metrics**

- **FR-20** The owner sees time from first message to confirmed order, orders handled per day and COD gaps found, for a chosen period.

**Billing (scored extra)**

- **FR-21** A pricing page lets an owner subscribe to a plan through Stripe in test mode.

**Verified reviews**

- **FR-22** When an order is marked Delivered, the customer receives an email with a single-use link to review the products in that order. The same review button appears on their private tracking page, so customers without an email can review too.
- **FR-23** Through that link, the customer gives each product they bought a rating of 1 to 5 stars and an optional comment, without an account. Each ordered item can be reviewed once.
- **FR-24** The catalogue shows each product's average rating and its reviews, labelled as from verified buyers.
- **FR-25** The owner or a manager can hide an abusive review but cannot edit what the customer wrote.

**Storefront**

- **FR-26** The owner can set a tagline, an About text, shipping information, links to the shop's Instagram and Facebook pages (only https links to those sites are accepted), how the logo is shown (image and name, image only or name only), and which highlight the home page shows (one of the shop's categories, best sellers, new arrivals, featured products or none). New shops show their first category.
- **FR-27** The owner can add up to 6 promotional banner slides, each with an image (PNG, JPEG or WebP up to 3 MB), a headline, an optional short label and an optional description, and can edit, reorder and remove them.
- **FR-28** The owner or a manager can create up to 30 named product categories, rename and reorder them, file each product under one category of the same shop, and delete a category without deleting its products.
- **FR-29** The owner or a manager can mark products as featured and give each product up to 12 specification lines (label and value).
- **FR-30** Customers can browse the catalogue by search text (name, description or category), category, collection (all, best sellers, new arrivals, featured) and price range, 8 products per page. A product matches a price range only if a variant that is in stock has a price inside it. Best sellers are ranked by units sold on orders that were not cancelled.
- **FR-31** The owner or a manager can let customers add a personal note to a product when ordering (for example an engraving), with a label, an example text, a maximum length of 1 to 500 characters and whether the note is required. The note is stored on the order line and shown on the order, the delivery screen and the customer's tracking page; an order missing a required note is refused.
- **FR-32** A customer can send feedback about the shop for public display without an account, giving a name, a message of 10 to 1000 characters and explicit consent to publication. Owners, managers and staff can read it; the owner or a manager approves or rejects it, and only approved feedback appears on the storefront (the latest 12), unless the owner turns testimonials off.
- **FR-33** Customers can keep a wishlist of products on their device without an account.

**AI assistants (MCP)**

- **FR-34** Any shop member can connect an AI assistant (Claude, ChatGPT or another MCP client) to one shop by signing in with their Mahhali account and approving the permissions it asks for. Members of several shops choose the shop; one connection works with one shop.
- **FR-35** A connected assistant can only do what the member's role allows and the permissions they approved (see orders, see the catalogue, add products, see finance). A delivery member's assistant sees only the orders assigned to them.
- **FR-36** Through an assistant, members can ask about orders, deliveries, products and stock, customer reviews, sales and cash on delivery, in English or Arabic, typed or spoken in the assistant's app.
- **FR-37** The owner or a manager can add up to 100 products at a time through an assistant, from a CSV file or a typed or spoken description. The assistant first shows a preview of every product with its variants, prices and stock, and any duplicates or problems; nothing is created until the user confirms that preview. The user can ask for changes and get a new preview. Confirmed products appear in the dashboard and the catalogue at once, and a confirmed import can be undone within 24 hours.
- **FR-38** Assistants see customer names, phone numbers and addresses only partly (first name and initial, country code and last digits, area), never emails, and contact details inside notes and reviews are hidden.
- **FR-39** Every member can see and disconnect the assistants they connected; the owner can see and disconnect every member's, or all at once. Removing a member from the shop disconnects their assistants.

## Non-functional requirements

- **NFR-1 Correctness under load.** Every operation that changes stock, order numbers or money runs in a single ACID database transaction, so it happens completely or not at all. When many customers order the last item at the same moment, exactly one order succeeds.
- **NFR-2 Tenant isolation.** No user of one shop can read or change another shop's data. Only platform admins can see across shops.
- **NFR-3 Security.** Passwords are hashed; new passwords have at least 8 characters, a letter and a digit or symbol, and are not a common password; every API route checks the session, the role and the input; the public order endpoint is rate limited; customer tracking and review links cannot be guessed; review links work once, expire after 30 days and are stored only as a hash; looking up an order by number and phone is rate limited, and so is sending shop feedback.
- **NFR-4 Mobile first.** Every screen works well on a 375 px wide phone, with large tap targets; owners and delivery users will mostly use phones.
- **NFR-5 Performance.** The public catalogue loads in under 2 seconds on a 4G phone; API responses take under 500 ms for typical shop sizes.
- **NFR-6 Reliability.** A double tap or a retry on a bad connection never creates a duplicate order; money is stored as whole cents or whole pounds in 64-bit integers, never as decimals, and each order keeps the exchange rate that applied when it was placed.
- **NFR-7 Auditability.** Every order status change, stock change and admin action is recorded with who did it and when.
- **NFR-8 Languages.** The interface supports English and Arabic, including right-to-left layout.
- **NFR-9 Accessibility.** Theme colours chosen by shops keep readable text contrast (WCAG AA); forms have labels and work with a screen reader.
- **NFR-10 Maintainability.** Next.js route handlers in TypeScript with Prisma on plain PostgreSQL; the repository layer is separate from the service layer; validation on every route; README, ERD and OpenAPI contract kept in the repo.
- **NFR-11 Testing and delivery.** Unit tests on business logic, integration tests on the main endpoints, all run by CI on every pull request; merges to main deploy automatically to a public URL.
- **NFR-12 Email delivery.** Emails are sent only after the order change is saved, through an email provider with retries; a failed email never blocks or undoes an order or a delivery.
- **NFR-13 AI assistant access.** Assistants authenticate with OAuth 2.1 (PKCE, dynamic client registration); access tokens are bound to one shop and one API, last 1 hour (refresh tokens 30 days) and are stored only as hashes. Every call checks the token, the member's current role and the shop's status again, so a disconnection, removal, role change or suspension applies to the next call. Assistant tool calls are rate limited and each one is logged without its content. A product import is created completely or not at all, and at most once.
