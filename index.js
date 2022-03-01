/* eslint-disable camelcase */
/* eslint-disable no-throw-literal */
/* eslint-disable max-len */
import pg from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import jsSHA from 'jssha';
import schedule from 'node-schedule';

const { Pool } = pg;
const pgConnectionConfigs = {
  user: 'gcskhor',
  host: 'localhost',
  database: 'project2',
  port: 5432, // Postgres server always runs on this port
};

const pool = new Pool(pgConnectionConfigs);
const PORT = 3004;
const app = express();

app.use(expressLayouts);
app.set('layout');
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(express.static('public'));

const SALT = 'giv me!Ur money$$$';

// ------------------------------------------------------------------------------- //
// HELPER FUNCTIONS

const getHash = (input) => {
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedString = `${input}${SALT}`;
  shaObj.update(unhashedString);
  return shaObj.getHash('HEX');
};

// CHECK IF EMAIL ADDRESS EXISTS IN USERS TABLE
const checkIfEmailExists = (emailInput) => {
  const emailQuery = `SELECT * FROM users WHERE email = '${emailInput}'`;

  console.log(emailQuery);

  pool.query(emailQuery)
    .then((result) => {
      if (result.rows.length > 0) {
        return true;
      }

      return false;
    });
};

// ------------------------------------------------------------------------------- //
//  CUSTOM MIDDLEWARE

app.use((request, response, next) => {
  if (request.path === '/some-path') {
    response.status(404).send('sorry');
    return;
  }
  next();
});

// HASH VERIFICATION MIDDLEWARE
// -> add preauthenticated routes (login/create account) to not need hashcheck
const loginCheck = (req, res, next) => {
  // res.locals.test = 'test string';
  req.isUserLoggedIn = false; // default value
  if (req.cookies.userId) {
    const userHash = getHash(req.cookies.userId);
    const familyHash = getHash(req.cookies.familyId);
    if (req.cookies.userIdHash === userHash && req.cookies.familyIdHash === familyHash) {
      req.isUserLoggedIn = true;
      console.log('hash for both family and user id match!');
      res.locals.userId = req.cookies.userId; // pass userId of the user into middleware.
    }
    // else {
    //   res.status(403).render('login');
    // }
    next();
  }
};

// // check if user exists during signups
// const checkUserExists = (req, res, next) => {
//   const results = req.body;
//   const { email, username, main_user_email } = results; // get out values to check
//   console.log('does the main user email entry exist?');
//   console.log(main_user_email);

//   const emailQuery = (input) => `SELECT * FROM users WHERE email = '${input}'`;

//   pool.query(emailQuery(email))
//     .then((result) => {
//       console.log(result.rows);

//       req.userAlrExists = false;
//       req.parentNonExistent = false;

//       if (result.rows.length > 0) {
//         // res.locals.userExists = 'That email already exists.';
//         req.userAlrExists = true;
//         console.log('user alr exists');

//         // res.send('That email already exists.');
//       }
//       else if (main_user_email) {
//         console.log(emailQuery(main_user_email));

//         pool.query(emailQuery(main_user_email))
//           .then((result2) => {
//             console.log('check .then of parent user');
//             console.log(result2.rows);

//             if (result2.rows.length === 0) {
//               // res.locals.userExists = 'That email already exists.';
//               req.parentNonExistent = true;
//               console.log('parent non existent');

//               // res.send('No such parent account exists');
//             }
//           });
//       }
//     });

//   next();
// };

// const testjob = schedule.scheduleJob('*/5 * * * * *', () => {
//   console.log('job!!');
//   testjob.cancel();
// });

// ------------------------------------------------------------------------------- //

app.get('/', loginCheck, (req, res) => { // loginCheck middleware applied
  // https://developers.google.com/chart/interactive/docs/gallery/barchart
  // STACKED BAR CHART - GOOGLE CHARTS
  console.log('get / request came in');
  console.log(req.isUserLoggedIn);
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }
  const { userId } = req.cookies;
  const { familyId } = req.cookies; // later add for finding family without querying.

  // get budget information
  const sqlQuery = `
    SELECT budgets.id AS budget_id, budgets.name AS budget_name, budgets.budget_amount
    FROM budgets 
    WHERE budgets.family_id=(SELECT users.family_id from users WHERE users.id = ${userId});
    `;

  const budgetIdArray = [];
  let data;

  pool.query(sqlQuery)
    .then((result) => {
      data = result.rows;
      console.log(data);

      // add budget ids into separate array
      data.forEach((budget, index) => {
        budgetIdArray[index] = budget.budget_id;
      });
      console.log(budgetIdArray);
      // create query with string literals to throw in budgetIdArray
      const selectExpenseByBudgetIdQuery = `
      SELECT expenses.name, expenses.budget_id, expenses.expense_amount, users.username FROM expenses
      INNER JOIN users ON expenses.user_id = users.id
      WHERE expenses.budget_id IN (${budgetIdArray})
      `;

      return pool.query(selectExpenseByBudgetIdQuery);
    })
    .then((results) => {
      const allExpenses = results.rows;

      console.table(allExpenses);
      data.forEach((budget, index) => {
        const singleBudgetExpenses = allExpenses.filter((expense) => expense.budget_id === budget.budget_id);
        budget.expenses = singleBudgetExpenses;
      });
      const dataObj = { results: data };
      return res.render('root', dataObj);
    })
    .catch((error) => {
      console.log('Error executing query', error.stack);
    });
});

app.get('/signup/new-family', (req, res) => {
  console.log('signup new family happening!');
  res.render('signup/new-family');
});

app.get('/signup/link-existing', (req, res) => {
  console.log('link to existing family happening!');
  res.render('signup/link-existing');
});

app.post('/signup/link-existing', (req, res) => {
  const results = req.body;
  const { email, username, main_user_email } = results; // get out values to check
  const emailQuery = 'SELECT * FROM users WHERE email = $1';
  let emailDup = false; // set defaultValue
  let mainEmailDup = true; // set defaultValue

  const promiseResults = Promise.all([
    pool.query(emailQuery, [email]),
    pool.query(emailQuery, [main_user_email]),
  ]).then((allResults) => {
    console.log('0');
    console.log(allResults[0].rows.length);

    if (allResults[0].rows.length > 0) { // user email alr exists
      emailDup = true;
      return res.send('this email alr exists in our system, choose a new email.');
    }

    if (allResults[1].rows.length === 0) { // email does not exist
      mainEmailDup = false;
      console.log('this parent email does not exist.');
      return res.send('parent email does not exist, choose a new email.');
    }
  })
    .then((result) => {
      if (!emailDup && mainEmailDup) {
        const hashedPassword = getHash(req.body.password);
        console.log('no user dup, parent email exists!');

        // query insert user first
        const insertUserQuery = 'INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING id';
        const userValues = [req.body.email, req.body.username, hashedPassword];
        // console.table(userValues);

        pool.query(insertUserQuery, userValues)
          .then((result) => res.send(`${req.body.username} account created!`));
      }
      // TO DO: ADD FUNCTIONALITY TO PROVIDE LINK FOR KIDS TO JOIN FAMILY.
    })
    .catch((error) => { console.log(error.stack); });
});

app.post('/signup/new-family', (req, res) => {
  const results = req.body;
  const { email, username, main_user_email } = results; // get out values to check

  // email checker
  const emailQuery = 'SELECT * FROM users WHERE email = $1';
  let emailDup = false; // set default Value
  pool.query(emailQuery, [email])
    .then((result) => {
      console.log(`resultrowlenght: ${result.rows.length}`);
      if (result.rows.length > 0) { // email alr exists
        emailDup = true;
        return res.send('email already exists, choose a new email.');
      }
    })
    .then((result) => {
      // if statement to make sure no duplicate users.

      if (!emailDup) {
        const hashedPassword = getHash(req.body.password);

        // query insert user first
        const insertUserQuery = 'INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING id';
        const userValues = [req.body.email, req.body.username, hashedPassword];

        let userId; // declare null first to reuse later between '.then's

        pool.query(insertUserQuery, userValues)
          .then((result) => {
            console.table(result.rows);
            if (result.rows.length === 0) {
              throw 'problem with inserting into users table #1';
            }
            // insert family second
            userId = result.rows[0].id;
            const insertFamilyQuery = `INSERT INTO families (name, main_user_id) VALUES ('${req.body.family_name}', ${userId}) RETURNING id`;

            console.log(`data check: ${req.body.family_name}`, userId);

            return pool.query(insertFamilyQuery);
          })
          .then((result) => {
            console.log(result); // UNABLE TO RETRIEVE RESULTS FOR SOME REASON
            if (result.rows.length === 0) {
              throw 'problem with inserting into families table';
            }
            console.log(result);
            const familyId = result.rows[0].id;

            const updateUserFamilyIdQuery = `UPDATE users SET family_id = ${familyId} WHERE id=${userId};`;

            return pool.query(updateUserFamilyIdQuery);
          })
          .then((result) =>
          // if (result.rows.length === 0) {
          //   throw 'problem with inserting into users table #2';
          // }
            res.status(200).send(`${req.body.username} user's family created`))
          .catch((error) => { console.log(error.stack); });
      }
    });
});

app.get('/login', (req, res) => {
  console.log('login request came in');
  res.render('login');
});

app.post('/login', (req, res) => {
  // retrieve the user entry using their email
  const values = [req.body.email];
  pool.query('SELECT * from users WHERE email=$1', values, (error, result) => {
    console.log(result.rows);
    if (error) {
      console.log('Error executing query', error.stack);
      res.status(503).send(result.rows);
      return;
    }
    if (result.rows.length === 0) { // we didnt find a user with that email
      res.status(403).send('login failed!');
      return;
    }

    const user = result.rows[0];

    const hashedPassword = getHash(req.body.password);
    // hash password to check with password in the db
    if (user.password !== hashedPassword) {
      res.status(403).send('login failed!');
      return;
    }

    const hashedUserId = getHash(user.id);
    const hashedFamilyId = getHash(user.family_id);

    res.cookie('userIdHash', hashedUserId);
    res.cookie('userId', user.id);

    res.cookie('familyIdHash', hashedFamilyId);
    res.cookie('familyId', user.family_id);

    res.send(`logged into ${values}!`);
  });
});

app.get('/create-budget', (req, res) => {
  res.render('create-budget-copy');
});

app.post('/create-budget', loginCheck, (req, res) => {
  // console.log(req.body);
  // const { userId } = req.cookies;
  const { familyId } = req.cookies;
  const results = req.body;

  const insertBudgetQuery = `INSERT INTO budgets (name, family_id, budget_amount) VALUES ('${results.name}', ${familyId}, ${results.budget_amount})`;

  pool.query(insertBudgetQuery)
    .then((result) => res.send('Added budget!'))
    .catch((error) => { console.log(error.stack); });
});

app.get('/create-expense', (req, res) => {
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  const getBudgetQuery = `SELECT * FROM budgets WHERE family_id=${familyId}`;

  pool.query(getBudgetQuery).then((result) => {
    console.table(result.rows);
    const data = { budgets: result.rows };
    res.render('create-expense', data);
  });
});

app.post('/create-expense', loginCheck, (req, res) => {
  // console.log(req.body);
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  const results = req.body;

  console.log(results);
  const insertExpenseQuery = `INSERT INTO expenses (name, budget_id, user_id, expense_amount) VALUES ('${results.name}', ${results.budget_id}, ${userId}, ${results.expense_amount})`;

  console.log(insertExpenseQuery);

  pool.query(insertExpenseQuery)
    .then((result) => res.send('Added expense!'))
    .catch((error) => { console.log(error.stack); });
});

app.listen(PORT);
