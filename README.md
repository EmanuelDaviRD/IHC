# IHC Store

E-commerce platform built with Express.js and vanilla JavaScript. Features product management, user authentication, order management, and admin dashboard.

## Features

- **Product Management**: View, create, edit, and delete products
- **User Authentication**: JWT-based login/registration with customer and admin roles
- **Shopping Cart**: Add products to cart and checkout
- **Order Management**: Create orders, track status, view order history
- **Admin Dashboard**: Manage products, users, orders, and site settings
- **Local JSON Storage**: No MongoDB required - data persists in JSON files
- **Image Uploads**: Upload and manage product images via Cloudinary
- **CEP Lookup**: Brazilian postal code lookup for addresses

## Tech Stack

- **Backend**: Node.js + Express.js
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Storage**: Local JSON files (no database required)
- **Authentication**: JWT (JSON Web Tokens)
- **File Uploads**: Multer + Cloudinary

## Project Structure

```
.
├── backend/
│   ├── config/
│   │   ├── cloudinary.js      # Cloudinary image upload config
│   │   ├── localStorage.js    # JSON file operations
│   │   └── localData.js       # Data access layer
│   ├── data/                  # JSON data files
│   │   ├── products.json
│   │   ├── users.json
│   │   ├── orders.json
│   │   └── settings.json
│   ├── frontend/              # Static HTML/CSS/JS
│   │   ├── index.html         # Shop page
│   │   ├── admin.html         # Admin dashboard
│   │   ├── landing.html       # Landing page
│   │   └── *.js, *.css
│   ├── server.js              # Express server
│   └── package.json
├── package.json
├── .env.example               # Environment variables template
└── README.md
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/edclaudia-store.git
   cd edclaudia-store
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd backend && npm install && cd ..
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your configuration (optional: Cloudinary credentials for image uploads)

4. **Run the server**
   ```bash
   npm start
   ```
   Server will be available at `http://localhost:3000`

## Usage

### Customer
- Visit `http://localhost:3000` to browse products
- Register/login to create an account
- Add products to cart and checkout
- Track order status in account dashboard

### Admin
- Login with admin credentials
- Visit `http://localhost:3000/admin` for admin dashboard
- Manage products: create, edit, delete
- Manage orders: view, update status, remove
- Manage users
- Configure site settings (colors, title, etc.)

### Default Admin Account
```
Email: admin@edclaudia.com
Password: admin123
```
⚠️ **Change this password immediately in production!**

## API Endpoints

### Authentication
- `POST /register` - Register new user
- `POST /login` - Login user

### Products
- `GET /produtos` - List all products
- `POST /produtos` - Create product (admin)
- `PUT /produtos/:id` - Update product (admin)
- `DELETE /produtos/:id` - Delete product (admin)

### Orders
- `POST /pedidos` - Create order
- `GET /pedidos/usuario` - Get user's orders
- `GET /pedidos` - Get all orders (admin)
- `PUT /pedidos/:id/status` - Update order status (admin)
- `DELETE /pedidos/bulk` - Delete multiple orders (admin)

### Admin
- `GET /admin-check` - Check if user is admin
- `PUT /admin/change-password` - Change admin password
- `GET /usuarios` - List users (admin)
- `GET /cep/:cep` - Lookup Brazilian CEP

### Settings
- `GET /settings` - Get site settings
- `POST /settings` - Update settings (admin)

### Uploads
- `POST /upload` - Upload image (admin)

## Data Persistence

All data is stored in JSON files in the `backend/data/` directory:
- `users.json` - User accounts and credentials
- `products.json` - Product catalog
- `orders.json` - Customer orders
- `settings.json` - Site configuration

## Development

### Available Scripts
```bash
npm start              # Start server (backend/server.js)
npm test              # Run tests (if configured)
```

### Adding Dependencies
```bash
npm install <package-name>
cd backend && npm install <package-name>
```

## Configuration

### Cloudinary (Optional - for image uploads)
1. Create account at [cloudinary.com](https://cloudinary.com)
2. Get your API credentials
3. Add to `.env`:
   ```
   CLOUDINARY_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   ```

## Common Issues

### Port already in use
- Change `PORT` in `.env` or `backend/server.js`

### Cloudinary upload fails
- Verify credentials in `.env`
- Ensure upload folder permissions

### JSON data not persisting
- Check `backend/data/` directory exists
- Verify write permissions on `backend/data/` folder

## Contributing

1. Create a feature branch
2. Commit your changes
3. Push to the branch
4. Open a pull request

## License

ISC

## Support

For issues and questions, please open an issue on GitHub.

---

**Made with ❤️ for Ed Claudia Store**
