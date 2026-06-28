# GymX — Server API

The backend architecture for the GymX Fitness & Gym Management platform. Built with Node.js and Express to provide a secure, scalable, and high-performance API for managing users, trainers, classes, and payments.

## 🚀 API Documentation & Tech
*   **Runtime:** Node.js, Express.js
*   **Database:** MongoDB (via Mongoose)
*   **Authentication:** Better Auth & JWT (HTTPOnly Cookies)
*   **Payment Gateway:** Stripe API Integration
*   **Security:** CORS, Helmet, and Environment Variable protection

---

## 🔑 Core API Features
*   **Role-Based Access Control (RBAC):** Middleware-protected routes for User, Trainer, and Admin roles.
*   **Advanced Data Queries:** MongoDB `$regex` for class searching and `$in` for category filtering.
*   **Pagination:** Server-side pagination implemented for Classes and Forum Posts to optimize performance.
*   **Secure Payment Flow:** Webhook handling and Stripe Checkout integration.
*   **State Management:** Status tracking for classes (Pending/Approved) and trainer applications.

---
