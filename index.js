/* eslint-disable camelcase */
/* eslint-disable no-throw-literal */
/* eslint-disable max-len */
import pg from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import jsSHA from 'jssha';
import schedule from 'node-schedule';
import multer from 'multer';
import moment from 'moment';

// set the name of the upload directory here
const multerUpload = multer({ dest: 'uploads/' });

const { Pool } = pg;
const pgConnectionConfigs = {
  user: 'gcskhor',
  host: 'localhost',
  database: 'project2',
  port: 5432, // Postgres server always runs on this port
};

const pool = new Pool(pgConnectionConfigs);
const PORT = 3005;
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

// abstract this into a getsData function that returns data based on the directory.
const getData = (req, res) => {
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  // add extra query in the chain to create an array of userIds. (filter expenses using userIds)
  const selectFamilyUsersQuery = `SELECT * FROM users WHERE family_id = ${familyId}`;
  const usernameIdArray = [];
  const budgetIdArray = [];
  // let budgetExists = true;
  let data;

  return pool.query(selectFamilyUsersQuery)
    .then((result) => {
      // get out familyuser data.

      result.rows.forEach((user) => {
        usernameIdArray.push(user.username);
      });
      const selectBudgetQuery = `
      SELECT budgets.id AS budget_id, budgets.name AS budget_name, budgets.budget_amount
      FROM budgets
      WHERE budgets.family_id=${familyId};
      `;

      // budgets.family_id=(SELECT users.family_id from users WHERE users.id = ${userId})

      return pool.query(selectBudgetQuery);
    })

    .then((result) => {
      data = result.rows;

      // check if no budgets exist yet
      if (data.length === 0) {
        return res.render('no-budgets');
      }

      // add budget ids into separate array
      data.forEach((budget, index) => {
        budgetIdArray[index] = budget.budget_id;
      });

      // create query with string literals to throw in budgetIdArray
      const selectExpenseByBudgetIdQuery = `
      SELECT expenses.name, expenses.budget_id, expenses.expense_amount, expenses.spend_date, expenses.user_id, users.username FROM expenses
      INNER JOIN users ON expenses.user_id = users.id
      WHERE expenses.budget_id IN (${budgetIdArray})
      ORDER BY expenses.spend_date ASC
      `;

      return pool.query(selectExpenseByBudgetIdQuery);
    })

    .then((results) => {
      const allExpenses = results.rows;
      data.forEach((budget, index) => {
        budget.users = usernameIdArray; // add users into each budget object

        // using the budgetIdArray, extract expense item objects based on budgetID in the array.
        const singleBudgetExpenses = allExpenses.filter((expense) => expense.budget_id === budget.budget_id);
        budget.expenses = singleBudgetExpenses;
        // console.log(budget);
        // run a forEach Loop to total the spend in each budget
        let budgetSpendTotal = 0;

        singleBudgetExpenses.forEach((expense) => {
          budgetSpendTotal += Number(expense.expense_amount);
        });

        budget.amountSpent = budgetSpendTotal;

        // ------------- end of total budget count --------------
        // using the usernameIdArray, extract expense item objects based on whether their username matches in the array.
        budget.expenseByUser = [];
        budget.userTotalSpendArray = [];
        usernameIdArray.forEach((username) => {
          const singleUserExpenses = singleBudgetExpenses.filter((expense) => expense.username === username);
          budget.expenseByUser.push(singleUserExpenses);

          // sum up total spend per user per budget
          let spendTotalPerUser = 0;
          singleUserExpenses.forEach((expense) => {
            spendTotalPerUser += Number(expense.expense_amount);
          });
          // console.log(spendTotalPerUser);
          budget.userTotalSpendArray.push(spendTotalPerUser);
        });

        // add remainingBudget key to budget
        budget.remainingBudget = Number(budget.budget_amount) - Number(budget.amountSpent);

        // add boolean exceeded_budget = true/false and set remaining budget to 0 if true
        if (budget.remainingBudget < 0) {
          budget.exceededBudget = true;
          budget.remainingBudget = 0;
        }
        else {
          budget.exceededBudget = false;
        }
      });

      // ##################################################
      // ---------------WRANGLE DATA IN HERE---------------

      // DONUT CHART
      // HEADER ARRAY
      const gDonutHeaderArray = ['User', 'Spend Per User'];
      const gDonutBodyArray = [];
      const perUserTotalSpendArray = []; // this array holds the sum of all expenses per user [0,0,0]

      usernameIdArray.forEach((user) => {
        // gDonutBodyArray.push(user); // add user names into an array
        perUserTotalSpendArray.push(0); // push value of 0 per user.
      });

      usernameIdArray.forEach((user, userIndex) => {
        data.forEach((budget) => {
          budget.expenseByUser[userIndex].forEach((expense) => {
            perUserTotalSpendArray[userIndex] += Number(expense.expense_amount);
          });
        });
      });

      usernameIdArray.forEach((user, index) => {
        gDonutBodyArray.push([user]);
        gDonutBodyArray[index].push(perUserTotalSpendArray[index]);
      });

      const gDonutArray = [gDonutHeaderArray, ...gDonutBodyArray];

      // BAR CHART
      // HEADER ARRAY
      const gBarHeaderArray = ['Budgets', ...data[0].users];
      // gBarHeaderArray.push(data[0].users);
      gBarHeaderArray.push('Remaining Budget');
      gBarHeaderArray.push({ role: 'links' });

      // BODY ARRAY
      const gBarBodyArray = [];
      data.forEach((budget, index) => {
        gBarBodyArray.push(budget.userTotalSpendArray);
        budget.userTotalSpendArray.push(budget.remainingBudget);
      });
      gBarBodyArray.forEach((bodyArray, index) => {
        // console.log(bodyArray);

        bodyArray.push(`/budget/${data[index].budget_id}`);
        bodyArray.unshift(data[index].budget_name);
      });

      // console.log(data);
      const gBarArray = [...[gBarHeaderArray], ...gBarBodyArray];
      // console.log(gBarArray);

      //   ###### DONUT CHART DATA SHOULD LOOK LIKE THIS #######
      // [
      //   ["User", "Spend per user"],
      //   ["Daddy", 6],
      //   ["Kid 1", 2],
      //   ["Kid 2", 2],
      // ];
      //   ###### BAR CHART DATA SHOULD LOOK LIKE THIS #######
      // [
      //   ['Budgets', 'Boss', 'kid1', 'kid2', 'Remaining Budget', { role: 'link'}],
      //   ['Household', 10, 20, 30, 140, '/budget/1'],
      //   ['Fun Stuff', 0, 12000, 20, 0, '/budget/2'],
      //   ['NFTs', 0, 20000, 0, 0, '/budget/5'],
      // ];

      // ---------------END WRANGLING DATA-----------------
      // ##################################################

      let budgetExists = true;

      if (data.length === 0) {
        budgetExists = false;
      }

      // console.log(data);
      const dataObj = {
        results: data,
        gBarData: gBarArray,
        gBarRowCount: gBarHeaderArray.length - 1,
        gDonutData: gDonutArray,
        doBudgetsExist: budgetExists,
      };
      console.log('this is at the end of getData()');
      console.log(budgetExists);
      // console.log(dataObj.doBudgetsExist);
      return dataObj;
    })
    .catch((error) => {
      console.log('Error executing query', error.stack);
    });
};

const getHash = (input) => {
  const shaObj = new jsSHA('SHA-512', 'TEXT', { encoding: 'UTF8' });
  const unhashedString = `${input}${SALT}`;
  shaObj.update(unhashedString);
  return shaObj.getHash('HEX');
};

const checkIfEmailExists = (emailInput) => {
  const emailQuery = `SELECT * FROM users WHERE email = '${emailInput}'`;

  return pool.query(emailQuery)
    .then((result) => result.rows.length > 0);
};

// const testjob = schedule.scheduleJob('*/5 * * * * *', () => {
//   console.log('job!!');
//   testjob.cancel();
// });

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

// ------------------------------------------------------------------------------- //
app.get('/', loginCheck, (req, res) => { // loginCheck middleware applied
  console.log('get /users request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  getData(req, res).then((resultData) => {
    // console.table(resultData);
    // console.log(resultData.doBudgetsExist);
    res.render('root', resultData); });
});

app.get('/users', loginCheck, (req, res) => {
  console.log('get /users request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  getData(req, res).then((resultData) => {
    console.log(resultData);
    res.render('users', resultData); });
});

app.get('/signup/new-family', (req, res) => {
  console.log('signup new family happening!');
  res.render('signup/new-family');
});

app.get('/signup/link-existing/:userId', (req, res) => {
  console.log('link to existing family happening!');
  const { userId } = req.params;
  console.log(userId);

  // get userId username on the page (link to ${username}'s family);
  pool.query(`SELECT username FROM users WHERE id=${userId}`)
    .then((result) => {
      const parentUserData = result.rows[0];
      parentUserData.userId = userId;

      console.log(parentUserData);

      return res.render('signup/link-existing', parentUserData);
    });
});

app.post('/signup/link-existing', (req, res) => {
  console.log(req.body);

  const results = req.body;
  const { email, username, parent_id } = results; // get out values to check

  const emailQuery = 'SELECT * FROM users WHERE email = $1';
  let emailDup = false; // set defaultValue

  // const mainEmailDup = true; // set defaultValue

  const promiseResults = Promise.all([
    pool.query(emailQuery, [email]),
    // pool.query(emailQuery, [main_user_email]),
  ]).then((allResults) => {
    // console.log('0');
    // console.log(allResults[0].rows.length);

    if (allResults[0].rows.length > 0) { // user email alr exists
      emailDup = true;
      return res.send('this email alr exists in our system, choose a new email.');
    }

    // if (allResults[1].rows.length === 0) { // email does not exist
    //   mainEmailDup = false;
    //   console.log('this parent email does not exist.');
    //   return res.send('parent email does not exist, choose a new email.');
    // }
  })
    .then((result) => {
      if (!emailDup) {
        const hashedPassword = getHash(req.body.password);
        console.log('no user dup!');

        // query insert user first
        const insertUserQuery = 'INSERT INTO users (email, username, password, family_id) VALUES ($1, $2, $3, $4) RETURNING id';
        const userValues = [req.body.email, username, hashedPassword, parent_id];
        console.log(userValues);

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
            if (result.rows.length === 0) {
              throw 'problem with inserting into families table';
            }
            console.log(result);
            const familyId = result.rows[0].id;

            const updateUserFamilyIdQuery = `UPDATE users SET family_id = ${familyId} WHERE id=${userId};`;

            return pool.query(updateUserFamilyIdQuery);
          })
          .then((result) => {
            res.render('created-family', { link: `http://localhost:${PORT}/signup/link-existing/${userId}` });
          })
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

    // res.send(`logged into ${values}!`);
    res.redirect('/');
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

app.post('/create-expense', [loginCheck, multerUpload.single('photo')], (req, res) => {
  // console.log(req.file);

  // console.log(req.body);
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  const results = req.body;

  // parse DATE
  const dateFormatted = moment(results.spend_date).format('YYMMDD');
  console.log(dateFormatted);

  console.log(results);
  const insertExpenseQuery = `INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('${results.name}', ${results.budget_id}, ${userId}, ${results.expense_amount}, ${dateFormatted})`;

  console.log(insertExpenseQuery);

  pool.query(insertExpenseQuery)
    .then((result) => res.send('Added expense!'))
    .catch((error) => { console.log(error.stack); });
});

app.get('/budget/:id', (req, res) => {
  console.log('get /budget-id request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { id } = req.params;

  getData(req, res).then((resultData) => {
    let positionInArray;
    resultData.results.forEach((budget, index) => {
      if (Number(budget.budget_id) === Number(id)) {
        positionInArray = index;
      }
    });

    console.log(positionInArray);
    const singleBudgetGBarData = [];
    singleBudgetGBarData.push(resultData.gBarData[0]);
    singleBudgetGBarData.push(resultData.gBarData[positionInArray + 1]); // make id into array position

    // const budgetTotals =
    const extractedResults = [];
    const budgetSelected = resultData.results.filter((budget) => budget.budget_id === Number(id));

    // console.log(budgetSelected[0].expenses);
    budgetSelected[0].expenses.forEach((expense) => { extractedResults.push(expense); });

    const budgetData = {
      budget_name: budgetSelected[0].budget_name,
      budget_amount: budgetSelected[0].budget_amount,
      amount_spent: budgetSelected[0].amountSpent,
      expenses: extractedResults,
      gBarData: singleBudgetGBarData,
    };

    res.render('budget-id', budgetData);
  });
});

app.get('/user/:id', (req, res) => {
  console.log('get /user-id request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { id } = req.params;
  const { familyId } = req.cookies;

  const query = `
    SELECT users.id, users.username, expenses.name AS expense_name, expenses.budget_id, expenses.expense_amount, expenses.spend_date 
    FROM users
    INNER JOIN expenses ON users.id = expenses.user_id
    WHERE users.family_id = ${familyId} AND users.id=${id}
    `;
  pool.query(query)
    .then((result) => {
      console.log(result.rows);
    });

  // getData(req, res).then((resultData) => {
  //   console.log(resultData.results[0].expenseByUser);

  //   let positionInArray;
  //   resultData.results.forEach((budget, index) => {
  //     if (Number(budget.budget_id) === Number(id)) {
  //       positionInArray = index;
  //     }
  //   });

  //   const singleBudgetGBarData = [];
  //   singleBudgetGBarData.push(resultData.gBarData[0]);
  //   singleBudgetGBarData.push(resultData.gBarData[positionInArray + 1]); // make id into array position

  //   // const budgetTotals =
  //   const extractedResults = [];
  //   const budgetSelected = resultData.results.filter((budget) => budget.budget_id === Number(id));

  //   // console.log(budgetSelected[0].expenses);
  //   budgetSelected[0].expenses.forEach((expense) => { extractedResults.push(expense); });

  //   const budgetData = {
  //     budget_name: budgetSelected[0].budget_name,
  //     budget_amount: budgetSelected[0].budget_amount,
  //     amount_spent: budgetSelected[0].amountSpent,
  //     expenses: extractedResults,
  //     gBarData: singleBudgetGBarData,
  //   };

  //   res.render('budget-id', budgetData);
  // });
});

app.listen(PORT);
