# 🎓 CampusShare

CampusShare is a full-stack web application designed to help students **lend, borrow, and manage resources within a campus community**.
It creates a trusted ecosystem where users can share items, track transactions, and manage interactions efficiently.

---

## 🚀 Features

* 🔐 **User Authentication**

  * Secure signup/login system
  * Session-based authentication

* 📦 **Item Sharing**

  * List items for lending
  * Browse available items
  * Request/borrow items

* 💰 **Expense & Debt Management**

  * Track who owes whom
  * Manage shared expenses
  * Clear and update balances

* 🛠️ **Admin Panel**

  * View users and activity
  * Delete users/items
  * Manage platform data

* ⚡ **Real-time UI Experience**

  * Smooth frontend with React
  * Fast API responses via Express

---

## 🏗️ Tech Stack

### Frontend

* React.js
* Vite
* HTML, CSS, JavaScript

### Backend

* Node.js
* Express.js

### Database

* (Add your DB here: MongoDB / MySQL / etc.)

### Other Tools

* Axios (API calls)
* CORS
* Cookie-based authentication

---

## 📁 Project Structure

```
CampusShare/
│
├── backend/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── server.js
│
├── frontend/
│   ├── src/
│   ├── pages/
│   └── main.jsx
│
├── .gitignore
└── README.md
```

---

## ⚙️ Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-username/CampusShare_v2.git
cd CampusShare_v2
```

---

### 2. Setup Backend

```bash
cd backend
npm install
npm start
```

---

### 3. Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔑 Environment Variables

Create a `.env` file in the backend:

```
PORT=5000
DATABASE_URL=your_database_url
JWT_SECRET=your_secret_key
```

---

## 🌐 Deployment

* Frontend: Render / Vercel
* Backend: Render

Make sure to:

* Enable CORS properly
* Set `withCredentials: true` for cookies
* Configure environment variables in deployment dashboard

---

## ⚠️ Important Notes

* `node_modules/` is ignored for security and performance
* Never push `.env` files or API keys
* Install dependencies using `npm install`

---

## 📸 Screenshots (Optional)

*Add screenshots of your app UI here*

---

## 🧠 Future Improvements

* 🔔 Notifications system
* 📱 Mobile responsiveness
* 🤝 Chat between lender & borrower
* 📊 Advanced analytics dashboard

---

## 🤝 Contributing

Contributions are welcome!
Feel free to fork the repo and submit a pull request.

---

## 📄 License

This project is open-source and available under the MIT License.

---

## 👨‍💻 Author

**Shreyan Acharjee**

* Full Stack Developer
* Passionate about building real-world solutions

---

## ⭐ Support

If you like this project, give it a ⭐ on GitHub!

---
