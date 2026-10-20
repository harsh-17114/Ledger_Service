# Ledger Service Backend

A backend application for a secure digital ledger and payment system built with **Node.js**, **Express.js**, and **MongoDB**. The application provides user authentication, account management, user-to-user transactions, initial fund distribution through a system account, transaction idempotency, ledger tracking, and email notifications.

## Features

* User registration and login
* Secure password hashing using bcrypt
* JWT-based authentication
* Cookie-based authentication
* Token blacklist for logout and token invalidation
* User account creation and management
* Account status management (`ACTIVE`, `FROZEN`, `CLOSED`)
* Stored account balance management
* User-to-user money transfers
* System-based initial fund transactions
* Transaction idempotency using unique idempotency keys
* Atomic balance updates using MongoDB transactions
* Debit and credit ledger entries
* Transaction status management
* Protection against insufficient balance
* Immutable ledger records
* Email notifications for completed transactions
* MongoDB database integration using Mongoose
* RESTful API architecture
* Environment variable configuration using dotenv

## Tech Stack

* **Node.js** – JavaScript runtime
* **Express.js** – Backend framework
* **MongoDB** – Database
* **Mongoose** – MongoDB object modeling
* **JWT (jsonwebtoken)** – Authentication
* **bcryptjs** – Password hashing
* **Cookie-parser** – Cookie handling
* **Nodemailer** – Email notifications
* **dotenv** – Environment variable management

## Project Structure

```text
Ledger_Service/
│
├── src/
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── account.controller.js
│   │   └── transaction.controller.js
│   │
│   ├── config/
│   │   └── database.js
│   │
│   ├── middlewares/
│   │   └── auth.middleware.js
│   │
│   ├── models/
│   │   ├── user.model.js
│   │   ├── account.model.js
│   │   ├── transaction.model.js
│   │   ├── ledger.model.js
│   │   └── blackList.model.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── account.routes.js
│   │   └── transaction.routes.js
│   │
│   ├── services/
│   │   └── email.service.js
│   │
│   └── app.js
│
├── .env
├── .gitignore
├── package-lock.json
├── package.json
├── README.md
└── server.js
```

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/harsh-17114/Ledger_Service.git
```

### 2. Navigate to the project directory

```bash
cd Ledger_Service
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

Create a `.env` file in the root directory:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLIENT_ID=your_google_client_id
CLIENT_SECRET=your_google_client_secret
REFRESH_TOKEN=your_google_refresh_token
EMAIL_USER=your_email_address
```

Replace the values with your actual MongoDB, JWT, and Gmail OAuth2 credentials.

### 5. Start the server

```bash
node server.js
```

The backend server will start on port `3000`.

```text
Server Started Successfully
```

## API Endpoints

### Authentication APIs

Base URL: `/api/auth`

| Method | Endpoint    | Description         |
| ------ | ----------- | ------------------- |
| POST   | `/register` | Register a new user |
| POST   | `/login`    | Login user          |
| POST   | `/logout`   | Logout user         |

### Account APIs

Base URL: `/api/accounts`

| Method | Endpoint              | Description           |
| ------ | --------------------- | --------------------- |
| POST   | `/`                   | Create a user account |
| GET    | `/`                   | Get user's accounts   |
| GET    | `/balance/:accountId` | Get account balance   |

### Transaction APIs

Base URL: `/api/transactions`

| Method | Endpoint                | Description                          |
| ------ | ----------------------- | ------------------------------------ |
| POST   | `/`                     | Create a user-to-user transaction    |
| POST   | `/system/initial-funds` | Transfer initial funds to an account |

## Authentication & Authorization

The application uses JWT tokens stored in cookies for authentication.

### User Types

* **Normal User** – Can create an account and perform transactions.
* **System User** – Can perform system-level initial fund transactions.

### Authentication Flow

1. User registers or logs in.
2. Server generates a JWT token.
3. Token is stored in a cookie.
4. Authentication middleware verifies the token.
5. Blacklisted tokens are rejected.
6. Authorized users can access protected routes.

### System User Authorization

System-level transactions use a separate authentication middleware.
The middleware verifies:

```text
JWT → User → systemUser
```

Only users with `systemUser: true` can access the initial-funds endpoint.

## Database Models

### User Model

Stores user authentication and account ownership information.

* Name
* Email
* Password
* System user status
* Created and updated timestamps

### Account Model

Stores user account information and current balance.

* User reference
* Account status
* Currency
* Balance
* One account per user enforced with a unique constraint
* Created and updated timestamps

Account statuses include:

```text
ACTIVE
FROZEN
CLOSED
```

### Transaction Model

Stores information about money transfers.

* From account
* To account
* Amount
* Transaction status
* Idempotency key
* Created and updated timestamps

Transaction statuses include:

```text
PENDING
COMPLETED
FAILED
REVERSED
```

### Ledger Model

Stores individual debit and credit records for transactions.

* Account reference
* Transaction reference
* Amount
* Transaction type

Ledger types include:

```text
DEBIT
CREDIT
```

Ledger records are protected from modification and deletion after creation.

### Blacklist Model

Stores invalidated JWT tokens.

* Token
* Expiration information

Blacklisted tokens automatically expire after the configured TTL period.

## How It Works

The application follows a structured backend architecture.

* **Routes** handle incoming API requests.
* **Controllers** contain application logic.
* **Models** define MongoDB schemas.
* **Middlewares** handle authentication and authorization.
* **Services** handle external operations such as email notifications.
* **Database** manages persistent application data.

## User Transaction Flow

A normal transaction follows these steps:

1. Validate the request.
2. Validate the account IDs.
3. Validate the amount.
4. Validate the idempotency key.
5. Check for an existing transaction.
6. Verify sender and receiver accounts.
7. Verify account status.
8. Atomically debit the sender's balance.
9. Create a `PENDING` transaction.
10. Create a `DEBIT` ledger entry.
11. Atomically credit the receiver's balance.
12. Create a `CREDIT` ledger entry.
13. Mark the transaction as `COMPLETED`.
14. Commit the MongoDB transaction.
15. Send a transaction email notification.

MongoDB transactions ensure that the balance and ledger changes are committed together.

## Initial Funds Transaction Flow

The initial funds transaction is different from a normal user transaction.

```text
System Account
      │
      │ DEBIT
      ▼
System Transaction
      │
      │ CREDIT
      ▼
User Account
```

The flow is:

1. Authenticate the system user.
2. Validate the request.
3. Validate the idempotency key.
4. Verify the destination account.
5. Verify the system account.
6. Atomically debit the system account.
7. Create a `PENDING` transaction.
8. Create a `DEBIT` ledger entry.
9. Atomically credit the user's account.
10. Create a `CREDIT` ledger entry.
11. Mark the transaction as `COMPLETED`.
12. Commit the MongoDB transaction.

This endpoint is restricted to system users so that normal users cannot create initial funds.

## Transaction Idempotency

The application uses an `idempotencyKey` to prevent duplicate transactions.

For example:

```json
{
    "fromAccount": "ACCOUNT_ID",
    "toAccount": "ACCOUNT_ID",
    "amount": 100,
    "idempotencyKey": "unique-request-key"
}
```

If the same request is sent again using the same idempotency key, the existing transaction is returned instead of creating another transaction.
The idempotency key is stored with a unique constraint in MongoDB.

## Balance Management

Account balances are stored directly in the account document.
Balance changes are performed atomically using MongoDB operations such as:

```js
$inc: {
    balance: -amount
}
```

and:

```js
$inc: {
    balance: amount
}
```

The sender balance update also verifies that sufficient funds are available before performing the debit.
This prevents the account balance from becoming negative during normal transactions.

## Ledger System

Every completed transfer creates two ledger entries.
For a ₹100 transaction:

```text
Sender Account
    DEBIT  ₹100

Receiver Account
    CREDIT ₹100
```

Both entries are created inside the same MongoDB transaction.
Ledger records are designed to be immutable so that completed financial records cannot be modified or deleted.

## Email Notifications

After a successful user transaction, the application sends an email notification to the sender.
Email functionality is implemented using **Nodemailer** with Gmail OAuth2 authentication.
The email service is responsible for:

* Creating the mail transporter
* Verifying the transporter
* Sending transaction notifications

## Main Files

### server.js

Connects to MongoDB and starts the Express server.

### app.js

Configures Express middleware and registers API routes.

### auth.controller.js

Handles user registration, login, and logout.

### account.controller.js

Handles account creation, account retrieval, and balance retrieval.

### transaction.controller.js

Handles normal user transactions and system initial-funds transactions.

### auth.middleware.js

Verifies JWT tokens, checks blacklisted tokens, and handles system-user authorization.

### email.service.js

Handles transaction email notifications using Nodemailer.

### account.model.js

Defines the account schema and manages the stored account balance.

### transaction.model.js

Defines the transaction schema and maintains transaction status and idempotency information.

### ledger.model.js

Defines immutable debit and credit ledger records.

## Security

The application includes several security mechanisms:

* Password hashing using bcrypt
* JWT authentication
* HTTP cookie-based token storage
* Secure cookie configuration (`httpOnly`, `sameSite`, `secure`)
* Token blacklist after logout
* System-user authorization
* Account ownership verification
* Account status validation
* ObjectId validation
* Idempotency key validation
* Insufficient balance protection
* Atomic balance updates
* MongoDB transactions
* Immutable ledger records

## Conclusion

Ledger Service is a practical Node.js backend project designed to demonstrate secure financial transaction processing, REST API development, authentication, database transactions, account management, and ledger-based record keeping. The project provides a foundation for building a digital payment or banking backend with features such as user accounts, secure money transfers, system fund distribution, transaction idempotency, immutable financial records, and transaction notifications.