const express = require('express');
const cors = require('cors');
const mysql = require('mysql');
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const SECRET_KEY = "pft5609"; 

const port = 5000;


app.use(cors());
app.use(express.json());

const db = mysql.createConnection({
    host: 'localhost',
    user: 'host',
    password: 'host',
    database: 'pft'
});

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MySQL database');
});


// Basic route
app.get('/', (req, res) => {
    res.send('Hello, World!');
});
app.post("/api/users", (req, res) => {
    const { name, email, profession,password } = req.body;
    const sql_insert = "INSERT INTO users (name, email, profession, password) VALUES (?, ?, ?, ?)";

   const sql_search ="SELECT * FROM users WHERE email = ?";

    
    if (!name || !email || !profession || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }


    db.query(sql_search, [email], async (err, result) => {
        if (err) {
            console.error("Database error while checking email:", err);
            return res.status(500).json({ error: "Database error", details: err });
        }

        if (result.length > 0) {
            return res.status(400).json({ message: "This email is already used." });
        }

        try{
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

    db.query(sql_insert, [name, email, profession, hashedPassword], (err, result) => {
        if (err) {
            console.error("Database error:", err);
            console.log(err);
            return res.status(500).json({ error: "Database error", details: err });
        }
        res.json({ message: "User added successfully", id: result.insertId });
    });
}catch{
    res.status(500).json({ error: "Internal server error." });
}

});
});
// Login endpoint
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;
    const sql_search = "SELECT * FROM users WHERE email = ?";

    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required." });
    }

    db.query(sql_search, [email], async (err, result) => {
        if (err) {
            console.error("Database error while checking email:", err);
            return res.status(500).json({ error: "Database error", details: err });
        }

        if (result.length === 0) {
            return res.status(400).json({ message: "Invalid email or password." });
        }

        const user = result[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ message: "Invalid email or password." });
        }

        const token = jwt.sign({ id: user.id,name:user.name, email: user.email }, SECRET_KEY, { expiresIn: "1h" });
        res.json({ token });
    });
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
    const token = req.headers["authorization"];
    if (!token) return res.status(401).json({ message: "Access denied" });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: "Invalid token" });
        req.user = user;
        next();
    });
};

//Enter data in the fionances table
app.post("/finances/setincome", (req, res) => {
    const { user_id, income, month } = req.body;
    
    // Generate a unique serial (assuming it's an auto-increment ID, it should be removed from the query)
    const sql = "INSERT INTO finances (`user id`, income, investment, saving, total_saving, month) VALUES (?, ?, 0, 0, 0, ?)";
    
    db.query(sql, [user_id, income, month], (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.status(201).json({ message: "Record added successfully", id: result.insertId });
    });
});

  // Read all finance records
  app.get("/finances", (req, res) => {
    const sql = "SELECT * FROM finances";
    db.query(sql, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    });
  });
  
  // Read a single finance record by user id
  app.get("/finances/user/:user_id", (req, res) => {
    const sql = "SELECT * FROM finances WHERE `user id` = ?";
    db.query(sql, [req.params.user_id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ message: "Record not found" });
      res.json(results[0]);
    });
  });
  
  // Update a finance record
  app.put("/finances/:serial", (req, res) => {
    const { income, investment, saving, total_saving } = req.body;
    const sql = "UPDATE finances SET income = ?, investment = ?, saving = ?, total_saving = ? WHERE serial = ?";
    db.query(sql, [income, investment, saving, total_saving, req.params.serial], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Record updated successfully" });
    });
  });

  // Set income and month
  app.put("/setIncomeAndMonth", (req,res) =>{
    const {user_id,income,month}=req.body;
    console.log(req.body);
    const sql ="UPDATE finances SET income = ?, month = ? WHERE `user id` = ?";
     db.query(sql, [income,month,user_id], (err, result) => {
      if (err) {
        console.log(err);
         
          return res.status(500).json({ error: err.message });
      }
      res.json({ message: "Transaction Added Successfully" });
    });
  });


  // Update 'expense' and 'savings' fields of a finance record by user ID
app.put("/finances/user/Exp_Sav", (req, res) => {
    const {userId, expense, savings } = req.body;
  
    // Validate at least one field is provided
    if (expense === undefined && savings === undefined) {
      return res.status(400).json({ error: "At least one of 'expense' or 'savings' must be provided" });
    }
  
    const fields = [];
    const values = [];
  
    if (expense !== undefined) {
      fields.push("expense = ?");
      values.push(expense);
    }
  
    if (savings !== undefined) {
      fields.push("savings = ?");
      values.push(savings);
    }
  
    const sql = `UPDATE finances SET ${fields.join(", ")} WHERE \`user id\` = ?`;
    values.push(userId);
  
    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Update error:", err.message);
        return res.status(500).json({ error: err.message });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Finance record not found" });
      }
  
      res.json({ message: "Finance record updated successfully" });
    });
  });
  // Delete a finance record
  app.delete("/finances/:serial", (req, res) => {
    const sql = "DELETE FROM finances WHERE serial = ?";
    db.query(sql, [req.params.serial], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Record deleted successfully" });
    });
  });

// Income,Saving and Expance fetching

app.get("/getIncomeSavingsAndExpanse",(req,res) => {
  const { id } = req.query;
  const sql = "SELECT * FROM `finances` WHERE `user id` = ?";
  db.query(sql, [id], (err, result) => {
      if (err) {
        
         
          return res.status(500).json({ error: err.message });
      }
      let savings = 0, income = 0, expense = 0;

      result.forEach((row) => {
        income += row.income || 0;
        savings += row.savings || 0;
        expense += row.expense || 0;
      });
      console.log("Income:", income);
      console.log("Savings:", savings);
      console.log("Expense:", expense);
      
      res.json({ income, savings, expense });
    });
});



  // Transaction handling

app.post("/addTransaction",(req,res) => {
    const { id,Date,Description,Category,Amount } = req.body;
    const sql = "INSERT INTO transactions (user_id, DateTime, description, type, amount) VALUES (?, ?, ?, ?, ?)";
    db.query(sql, [id,Date,Description,Category,Amount], (err, result) => {
        if (err) {
          console.error("Select error:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json({ message: "Transaction Added Successfully" });
      });

});

app.get("/getTransaction", (req, res) => {
    const { id } = req.query; // Get from query string
    const sql = "SELECT * FROM transactions WHERE user_id = ?";
    db.query(sql, [id], (err, result) => {
      if (err) {
        console.error("Select error:", err.message);
        return res.status(500).json({ error: err.message });
      }
      res.json(result);
    });
  });
app.get('/api/')
// Sample API route
app.get('/api/data', (req, res) => {
    res.json({ message: 'This is sample data' });
});

app.delete("/deleteTransaction", (req, res) => {
    const { id } = req.query; // Expect transaction ID in query string
  
    if (!id) {
      return res.status(400).json({ error: "Transaction ID is required" });
    }
  
    const sql = "DELETE FROM transactions WHERE serial = ?";
    db.query(sql, [id], (err, result) => {
      if (err) {
        console.error("Delete error:", err.message);
        return res.status(500).json({ error: err.message });
      }
  
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Transaction not found" });
      }
  
      res.json({ message: "Transaction deleted successfully" });
    });
  });

// Start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});