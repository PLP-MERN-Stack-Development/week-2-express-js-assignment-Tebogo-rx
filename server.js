require('dotenv').config();

// Import required modules
const express = require('express');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware setup
app.use(bodyParser.json());

// Custom logger middleware
const logger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.url}`);
  next();
};

app.use(logger);

// Authentication middleware
const authenticateAPIKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key']; // get the key from the header
  const validApiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(401).json({ error: 'API key missing' });
  }

  if (apiKey !== validApiKey) {
    return res.status(403).json({ error: 'Invalid API key' });
  }

  next(); // API key is valid, continue
};

// Protect all product routes
app.use('/api/products', authenticateAPIKey);

// Validation middleware
const validateProduct = (req, res, next) => {
  const { name, description, price, category, inStock } = req.body;

  // Check for missing fields
  if (
    !name || typeof name !== 'string' ||
    !description || typeof description !== 'string' ||
    price === undefined || typeof price !== 'number' ||
    !category || typeof category !== 'string' ||
    inStock === undefined || typeof inStock !== 'boolean'
  ) {
    return res.status(400).json({
      error: 'Invalid or missing fields. Make sure to provide: name (string), description (string), price (number), category (string), inStock (boolean).'
    });
  }

  next(); // Validation passed
};

// Custom error classes
class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = 'NotFoundError';
    this.status = 404;
  }
}

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.status = 400;
  }
}

// Root route
app.get('/', (req, res) => {
  res.send('Hello World');
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Products
let products = [
  {
    id: '1',
    name: 'Laptop',
    description: 'High-performance laptop with 16GB RAM',
    price: 1200,
    category: 'electronics',
    inStock: true
  },
  {
    id: '2',
    name: 'Smartphone',
    description: 'Latest model with 128GB storage',
    price: 800,
    category: 'electronics',
    inStock: true
  },
  {
    id: '3',
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with timer',
    price: 50,
    category: 'kitchen',
    inStock: false
  }
];

// Get product statistics
app.get('/api/products/stats', authenticateAPIKey, (req, res, next) => {
  try {
    const stats = {};

    products.forEach(product => {
      const category = product.category.toLowerCase();
      stats[category] = (stats[category] || 0) + 1;
    });

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// Get a specific product by ID
app.get('/api/products/:id', authenticateAPIKey, (req, res, next) => {
  try {
    const productId = req.params.id;
    const product = products.find(p => p.id === productId);

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    res.json(product);
  } catch (err) {
    next(err);
  }
});

// Create a new product
app.post('/api/products', authenticateAPIKey, validateProduct, (req, res, next) => {
  try {
    const { name, description, price, category, inStock } = req.body;
    const newProduct = {
      id: uuidv4(),
      name,
      description,
      price,
      category,
      inStock
    };

    products.push(newProduct);
    res.status(201).json(newProduct);
  } catch (err) {
    next(err);
  }
});

// Update an existing product
app.put('/api/products/:id', authenticateAPIKey, validateProduct, (req, res, next) => {
  try {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      throw new NotFoundError('Product not found');
    }

    const { name, description, price, category, inStock } = req.body;

    products[productIndex] = {
      id: productId,
      name,
      description,
      price,
      category,
      inStock
    };

    res.json(products[productIndex]);
  } catch (err) {
    next(err);
  }
});

// Delete a product
app.delete('/api/products/:id', authenticateAPIKey, (req, res, next) => {
  try {
    const productId = req.params.id;
    const productIndex = products.findIndex(p => p.id === productId);

    if (productIndex === -1) {
      throw new NotFoundError('Product not found');
    }

    products.splice(productIndex, 1);

    res.json({ message: `Product with id ${productId} deleted successfully.` });
  } catch (err) {
    next(err);
  }
});

// Get all products
app.get('/api/products', (req, res, next) => {
  try {
    let results = [...products];

    const { category, search, page = 1, limit = 5 } = req.query;

    // Filter by category
    if (category) {
      results = results.filter(p => 
        p.category.toLowerCase() === category.toLowerCase()
      );
    }

    // Search by name
    if (search) {
      results = results.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    // Pagination
    const start = (parseInt(page) - 1) * parseInt(limit);
    const end = start + parseInt(limit);
    const paginatedResults = results.slice(start, end);

    res.json({
      page: parseInt(page),
      limit: parseInt(limit),
      total: results.length,
      results: paginatedResults
    });
  } catch (err) {
    next(err);
  }
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error: ${err.name} - ${err.message}`);
  res.status(err.status || 500).json({
    error: err.name || 'ServerError',
    message: err.message || 'Something went wrong'
  });
});