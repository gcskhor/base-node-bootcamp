/* eslint-disable camelcase */
/* eslint-disable no-throw-literal */
/* eslint-disable max-len */
import pg from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import expressLayouts from 'express-ejs-layouts';
import jsSHA from 'jssha';
import multer from 'multer';
import moment from 'moment';
import methodOverride from 'method-override';

import later from '@breejs/later';
import schedule from 'node-schedule';

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
const PORT = 3007;
const app = express();

app.use(expressLayouts);
app.set('layout');
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(methodOverride('_method'));
app.use(express.static('public'));

const SALT = 'giv me!Ur money$$$';

// set time to local time.
later.date.localTime();

// ------------------------------------------------------------------------------- //
// HELPER FUNCTIONS

const checkIfMainUser = (userId, familyId) => {
  const checkMainUserQuery = `SELECT main_user_id FROM families WHERE id=${familyId}`;
  console.log('checkmainuser function started');

  return pool.query(checkMainUserQuery)
    .then((result) => {
      // console.log(result.rows[0].main_user_id);
      const mainUserId = result.rows[0].main_user_id;

      // if (mainUserId == userId) {
      //   return { isMainUser: true };
      // }
      // return { isMainUser: false };
      return mainUserId == userId;
    });
};

const checkIfUsersExpense = (userId, expenseId) => {
  const selectExpenseQuery = `SELECT * FROM expenses WHERE user_id = ${userId} AND id=${expenseId}`;
  return pool.query(selectExpenseQuery)
    .then((result) => result.rows.length > 0);
};

const getData = (req, res, pastBudgets) => {
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  // add extra query in the chain to create an array of userIds. (filter expenses using userIds)
  const selectFamilyUsersQuery = `SELECT * FROM users WHERE family_id = ${familyId}`;
  const usernameIdArray = [];
  const userIdArray = [];
  const budgetIdArray = [];
  // let budgetExists = true;
  let data;

  return pool.query(selectFamilyUsersQuery)
    .then((result) => {
      // get out familyuser data.

      result.rows.forEach((user) => {
        usernameIdArray.push(user.username);
        userIdArray.push(user.id);
      });

      // query for active budgets
      const selectActiveBudgetQuery = `
      SELECT budgets.id AS budget_id, budgets.name AS budget_name, budgets.budget_amount, budgets.start_date
      FROM budgets
      WHERE budgets.family_id=${familyId} AND budgets.active=true;
      `;

      // query for inactive budgets
      const selectInactiveBudgetQuery = `
      SELECT budgets.id AS budget_id, budgets.name AS budget_name, budgets.budget_amount, budgets.start_date
      FROM budgets
      WHERE budgets.family_id=${familyId} AND budgets.active=false
      ORDER BY start_date DESC;
      `;
      let selectBudgetQuery;
      if (!pastBudgets) {
        console.log('past budget true');
        selectBudgetQuery = selectActiveBudgetQuery; }
      if (pastBudgets) {
        console.log('past budget false');
        selectBudgetQuery = selectInactiveBudgetQuery; }

      return pool.query(selectBudgetQuery);
    })

    .then((result) => {
      data = result.rows;

      console.log(result.rows);

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
      SELECT expenses.id AS expense_id, expenses.name, expenses.budget_id, expenses.expense_amount, expenses.spend_date, expenses.user_id, users.username FROM expenses
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

      // console.log(data);
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

      // compare userIdArray values with cookie id to determine username with usernameIdArray

      // ---------------END WRANGLING DATA-----------------
      // ##################################################

      let budgetExists = true;

      if (data.length === 0) {
        budgetExists = false;
      }

      let activeUsername = '';
      userIdArray.forEach((id, index) => {
        if (id === Number(userId)) { activeUsername = usernameIdArray[index];
        }
      });

      const dataObj = {
        results: data,
        gBarData: gBarArray,
        gBarRowCount: gBarHeaderArray.length - 1,
        gDonutData: gDonutArray,
        doBudgetsExist: budgetExists,
        activeUser: activeUsername,
      };

      console.log('this is at the end of getData()');
      console.log(budgetExists);

      // console.log(dataObj);
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

const parseTagString = (string) => {
  const tagArray = string.split(' ');
  return tagArray;
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
  if (!req.cookies.userId) {
    res.render('error', { message: 'Please log in to continue.' });
  }

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
    //   res.render('error', { message: 'Please log in to continue.' });
    // }
    next();
  }
};

// ------------------------------------------------------------------------------- //

const checkBudgetsForRecurrence = () => {
  // query 1:  select active and recurring budgets and save ids

  // query 2:  select all (active budgets) and (active and recurring budgets) and update to inactive and not recurring

  // query 3: create new budgets whose parameters match saved IDs, set to active and recurring

  const selectRecurringBudgetsQuery = 'SELECT id FROM budgets WHERE active=true AND repeats_monthly=true';

  const budgetIdsToPropagateArray = [];

  console.log('checking budget for recurs_monthly and active');

  // query 1:  select active and recurring budgets and save ids
  return pool.query(selectRecurringBudgetsQuery)
    .then((result) => {
      const activeBudgetsIds = result.rows;
      const activeBudgetIdArray = [];

      // grab ids of budgets that recur
      activeBudgetsIds.forEach((idObj) => {
        activeBudgetIdArray.push(idObj.id);
        budgetIdsToPropagateArray.push(idObj.id);
      });

      const updateActiveStatusQuery = 'UPDATE budgets SET active=false, repeats_monthly=false WHERE active=true';

      // query 2:  select all (active budgets) and (active and recurring budgets) and update to inactive and not recurring
      return pool.query(updateActiveStatusQuery);
    })
    .then((result) => {
      const createNewRecurringBudgetsQuery = `SELECT * FROM budgets WHERE id IN (${budgetIdsToPropagateArray})`;
      // query 3A: select again budgets previously saved
      return pool.query(createNewRecurringBudgetsQuery);
    })
    .then((result) => {
      console.log(result.rows);
      result.rows.forEach((budget) => {
        const { name, budget_amount, family_id } = budget;

        const dateFormatted = moment(new Date()).format('YYMMDD');

        const createBudgetQuery = 'INSERT INTO budgets (name, budget_amount, family_id, active, repeats_monthly, start_date) VALUES ($1, $2, $3, $4, $5, $6)';
        const createBudgetValues = [name, budget_amount, family_id, true, true, dateFormatted];

        // query 3B: create new budgets whose parameters match saved IDs, set to active and recurring
        return pool.query(createBudgetQuery, createBudgetValues);
      });
    });
};

app.get('/', loginCheck, (req, res) => { // loginCheck middleware applied
  console.log('get /users request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  getData(req, res, false).then((resultData) => {
    res.render('root', resultData); })
    .catch((error) => { console.log(error.stack); });
});

app.get('/users', loginCheck, (req, res) => {
  console.log('get /users request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { familyId } = req.cookies;
  const { userId } = req.cookies;

  checkIfMainUser(userId, familyId)
    .then((isMainUser) => {
      switch (isMainUser) {
        case true:
          pool.query(`SELECT id, username FROM users WHERE family_id=${familyId}`)
            .then((result) => {
              res.render('users', { users: result.rows });
            })
            .catch((error) => { console.log(error.stack); });
          break;
        default:
          // res.send('no access');
          res.render('error', { message: 'Sorry, you have no access to this feature.' });
          break;
      }
    });

  // pool.query(`SELECT id, username FROM users WHERE family_id=${familyId}`)
  //   .then((result) => {
  //     res.render('users', { users: result.rows });
  //   })
  //   .catch((error) => { console.log(error.stack); });
});

app.get('/signup/new-family', (req, res) => {
  console.log('signup new family happening!');
  res.render('signup/new-family');
});

app.route('/signup')
  .get((req, res) => {
    res.render('signup');
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
    })
    .catch((error) => { console.log(error.stack); });
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
  ]).then((allResults) => {
    if (allResults[0].rows.length > 0) { // user email alr exists
      emailDup = true;
      return res.send('this email alr exists in our system, choose a new email.');
    }
  })
    .then((result) => {
      if (!emailDup) {
        const hashedPassword = getHash(req.body.password);
        console.log('no user dup!');

        const getFamilyIdQuery = `SELECT id FROM families WHERE main_user_id=${parent_id}`;
        return pool.query(getFamilyIdQuery)
          .then((result) => {
            const familyId = result.rows[0].id;

            const insertUserQuery = 'INSERT INTO users (email, username, password, family_id) VALUES ($1, $2, $3, $4) RETURNING id';
            const userValues = [req.body.email, username, hashedPassword, Number(familyId)];
            console.log(userValues);

            pool.query(insertUserQuery, userValues)
              .then((result) => {
                // res.send(`${req.body.username} account created!`);
                res.redirect('/login');
              });
          });

        // // query insert user first
        // const insertUserQuery = 'INSERT INTO users (email, username, password, family_id) VALUES ($1, $2, $3, $4) RETURNING id';
        // const userValues = [req.body.email, username, hashedPassword, parent_id];
        // console.log(userValues);

        // pool.query(insertUserQuery, userValues)
        //   .then((result) => {
        //     // res.send(`${req.body.username} account created!`);
        //     res.redirect('/login');
        //   });
      }
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
        let family_Id;

        pool.query(insertUserQuery, userValues)
          .then((result) => {
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
            // console.log(result);
            const familyId = result.rows[0].id;
            console.log('FAMILY ID');
            console.log(familyId);
            family_Id = familyId;

            const updateUserFamilyIdQuery = `UPDATE users SET family_id = ${familyId} WHERE id=${userId}`;

            return pool.query(updateUserFamilyIdQuery);
          })
          .then((resultNew) => {
            // add default tags to family
            console.log('family id');
            console.log(family_Id);

            const addDefaultTagsQuery = `
            INSERT INTO tags (name, family_id) VALUES ('games', ${family_Id});
            INSERT INTO tags (name, family_id) VALUES ('food', ${family_Id});
            INSERT INTO tags (name, family_id) VALUES ('impulsive buy', ${family_Id});
            INSERT INTO tags (name, family_id) VALUES ('transport', ${family_Id});
            INSERT INTO tags (name, family_id) VALUES ('software', ${family_Id});
            INSERT INTO tags (name, family_id) VALUES ('essential', ${family_Id});
            `;
            return pool.query(addDefaultTagsQuery);
          })
          .then((result) => {
            console.log(result);
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

app.get('/logout', (req, res) => {
  res.clearCookie('userId');
  res.clearCookie('userIdHash');
  res.clearCookie('familyId');
  res.clearCookie('familyIdHash');

  res.render('logout');
});

app.get('/create-budget', loginCheck, (req, res) => {
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  checkIfMainUser(userId, familyId)
    .then((isMainUser) => {
      switch (isMainUser) {
        case true:
          res.render('create-budget-copy');
          break;
        default:
          // res.send('no access');
          res.render('error', { message: 'Sorry, you have no access to this feature.' });
          break;
      }
    });
});

app.post('/create-budget', loginCheck, (req, res) => {
  // console.log(req.body);
  const { userId } = req.cookies;
  const { familyId } = req.cookies;
  const results = req.body;

  console.log(results);

  // parse checkbox 'on'response
  let repeats_monthly = false;
  if (results.repeats_monthly === 'on') { repeats_monthly = true; }

  // parse DATE
  const dateFormatted = moment(results.start_date).format('YYMMDD');

  const insertBudgetQuery = `INSERT INTO budgets (name, family_id, budget_amount, start_date, repeats_monthly, active) VALUES ('${results.name}', ${familyId}, ${results.budget_amount}, ${dateFormatted}, ${repeats_monthly}, true)`;

  pool.query(insertBudgetQuery)
    .then((result) => res.redirect('/'))
    .catch((error) => { console.log(error.stack); });
});

app.get('/create-expense', loginCheck, (req, res) => {
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  const getBudgetQuery = `SELECT * FROM budgets WHERE family_id=${familyId} AND active=true`;

  const getTagsQuery = `
    SELECT tags.id AS tag_id, tags.name AS tag_name FROM tags WHERE tags.family_id=${Number(familyId)}
    `;

  const results = Promise.all([
    pool.query(getBudgetQuery),
    pool.query(getTagsQuery),
  ]).then((allResults) => {
    console.log(allResults[0].rows);
    console.log(allResults[1].rows);

    const data = { budgets: allResults[0].rows, tags: allResults[1].rows };
    res.render('create-expense', data);
  })
    .catch((error) => { console.log(error.stack); });
});

app.post('/create-expense', [loginCheck, multerUpload.single('photo')], (req, res) => {
  // console.log(req.file);
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  // console.log(req.body);
  const { userId } = req.cookies;
  const { familyId } = req.cookies;

  const results = req.body;
  console.log(results);

  // parse DATE
  const dateFormatted = moment(results.spend_date).format('YYMMDD');
  // console.log(dateFormatted);

  const insertExpenseQuery = `INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date, note) VALUES ('${results.name}', ${results.budget_id}, ${userId}, ${results.expense_amount}, '${dateFormatted}', '${results.note}') RETURNING id`;

  pool.query(insertExpenseQuery)
    .then((result) => {
      const expense_id = result.rows[0].id;

      // console.log(`tag_id: ${results.tag_ids}`);
      // console.log(`expense_id: ${expense_id}`);

      const poolQueryArray = [];
      const insertExpensesTagsQuery = 'INSERT INTO expenses_tags (tag_id, expense_id) VALUES ($1, $2)';

      // ensure output of tag_ids is always an array
      if (!Array.isArray(results.tag_ids)) {
        results.tag_ids = [results.tag_ids];
      }

      results.tag_ids.forEach((tag_id) => {
        poolQueryArray.push(
          pool.query(insertExpensesTagsQuery, [tag_id, expense_id]),
        );
      });

      return Promise.all(poolQueryArray);
    })
    .then((result) => res.redirect('/'))
    .catch((error) => { console.log(error.stack); });
});

app.get('/budget/:id', loginCheck, (req, res) => {
  console.log('get /budget-id request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { id } = req.params;

  getData(req, res, false).then((resultData) => {
    let positionInArray;
    resultData.results.forEach((budget, index) => {
      if (Number(budget.budget_id) === Number(id)) {
        positionInArray = index;
      }
    });

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
  })
    .catch((error) => { console.log(error.stack); });
});

app.get('/user/:id', loginCheck, (req, res) => {
  console.log('get /user-id request came in');
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { id } = req.params;

  getData(req, res, false).then((resultData) => {
    const budgets = resultData.results;
    const userExpenseArray = [];

    budgets.forEach((budget) => {
      budget.expenseByUser.forEach((user) => {
        user.forEach((expense) => {
          if (Number(expense.user_id) === Number(id)) { userExpenseArray.push(expense); }
        });
      });
    });

    res.render('user-id', { user: userExpenseArray });
  })
    .catch((error) => { console.log(error.stack); });
});

app.get('/expense/:id', loginCheck, (req, res) => {
  console.log('get /expense-id request came in');
  if (req.isUserLoggedIn === false) {
    res.status(403).send('please log in again.');
  }

  const { id } = req.params;
  const { familyId } = req.cookies;
  const { userId } = req.cookies;

  const selectFamilyUsersQuery = `SELECT id FROM users WHERE family_id=${familyId}`;

  pool.query(selectFamilyUsersQuery)

    .then((result) => {
      const userIds = [];
      result.rows.forEach((user) => {
        userIds.push(user.id);
      });

      const selectExpenseQuery = `
        SELECT expenses.id, expenses.name AS expense_name, expenses.budget_id, budgets.name AS budget_name, expenses.user_id, users.username, expenses.expense_amount, expenses.spend_date, expenses.note FROM expenses
        INNER JOIN budgets ON expenses.budget_id = budgets.id
        INNER JOIN users ON expenses.user_id = users.id
        WHERE user_id IN (${userIds})
      `;

      const selectTagsQuery = `
        SELECT 
          tags.id AS tag_id, 
          tags.name AS tag_name
        FROM tags
          INNER JOIN expenses_tags ON tags.id = expenses_tags.tag_id
          INNER JOIN expenses ON expenses_tags.expense_id = expenses.id
          INNER JOIN budgets ON expenses.budget_id = budgets.id
          INNER JOIN families ON budgets.family_id = families.id
        WHERE expenses.id = ${id};
      `;

      return Promise.all([
        pool.query(selectExpenseQuery),
        pool.query(selectTagsQuery),
      ]);
    })

    .then((result) => {
      // EXPENSE PROMISE
      const matchingExpenseId = result[0].rows.filter((expense) => Number(expense.id) === Number(id))[0];

      if (matchingExpenseId.user_id === Number(userId)) {
        matchingExpenseId.userCreatedExpense = true;
      }
      else { matchingExpenseId.userCreatedExpense = false; }

      // TAGS PROMISE
      const expenseTags = { tagData: result[1].rows };

      // CONSOLIDATE DATA
      const matchingExpenseIdData = { ...matchingExpenseId, ...expenseTags };
      console.log(matchingExpenseIdData);

      res.render('expense-id', matchingExpenseIdData);
    })
    .catch((error) => { console.log(error.stack); });
});

app.post('/expense/:id/delete', loginCheck, (req, res) => {
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }

  const { userId } = req.cookies;
  const { id } = req.params;

  // pool query to delete expenses_tag

  checkIfUsersExpense(userId, id)
    .then((isUsersExpense) => {
      if (isUsersExpense) {
        // delete expenses_tags entity to avoid FK_CONSTRAINT issue
        const deleteExpensesTagQuery = `DELETE FROM expenses_tags WHERE expense_id = ${id}`;
        return pool.query(deleteExpensesTagQuery);
      }
      console.log('not your expense');
    })
    .then(() => {
      const deleteExpenseQuery = `DELETE FROM expenses WHERE id=${id}`;
      return pool.query(deleteExpenseQuery);
    })
    .then(() => {
      console.log('item deleted');
      res.redirect('/');
    })
    .catch((error) => { console.log(error.stack); });
});

app.get('/expense/:id/edit', loginCheck, (req, res) => {
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }
  const { userId } = req.cookies;
  const { familyId } = req.cookies;
  const { id } = req.params;

  const selectExpenseQuery = `
    SELECT expenses.id, expenses.name, expenses.budget_id, budgets.name AS budget_name, expenses.user_id, expenses.expense_amount, expenses.spend_date, expenses.note FROM expenses INNER JOIN budgets ON expenses.budget_id = budgets.id WHERE expenses.id=${id}`;

  const selectExpensesTagsQuery = `
    SELECT 
      tags.id AS tag_id, 
      tags.name AS tag_name
    FROM tags
      INNER JOIN expenses_tags ON tags.id = expenses_tags.tag_id
      INNER JOIN expenses ON expenses_tags.expense_id = expenses.id
      INNER JOIN budgets ON expenses.budget_id = budgets.id
      INNER JOIN families ON budgets.family_id = families.id
    WHERE expenses.id = ${id};
  `;

  const unselectedExpensesTagsQuery = `
      SELECT 
        tags.id AS tag_id,
        tags.name AS tag_name
      FROM tags
      WHERE tags.family_id=${familyId}
      EXCEPT
      (
        SELECT DISTINCT
          tags.id AS tag_id, 
          tags.name AS tag_name
        FROM tags
          INNER JOIN expenses_tags ON tags.id = expenses_tags.tag_id
          INNER JOIN expenses ON expenses_tags.expense_id = expenses.id
          INNER JOIN budgets ON expenses.budget_id = budgets.id
          INNER JOIN families ON budgets.family_id = families.id
        WHERE expenses.id = ${Number(id)}
		  )
  ;`;

  checkIfUsersExpense(userId, id)
    .then((isUsersExpense) => {
      if (isUsersExpense) {
        return Promise.all([
          pool.query(selectExpenseQuery),
          pool.query(`SELECT * FROM budgets WHERE family_id=${familyId}`),
          pool.query(selectExpensesTagsQuery),
          pool.query(unselectedExpensesTagsQuery),
        ]).then((allResults) => {
          console.log(allResults[3].rows);

          const data = {
            ...allResults[0].rows[0],
            budgets: allResults[1].rows,
            tagData: allResults[2].rows,
            unselectedTagData: allResults[3].rows,
          };
          console.log(data);
          res.render('expense-edit', data);
        });
      }
    });
});

app.put('/expense/:id/edit', [loginCheck, multerUpload.single('photo')], (req, res) => {
  if (req.isUserLoggedIn === false) { // test from loginCheck middleware
    res.status(403).send('please log in again.');
  }
  const { userId } = req.cookies;
  const { familyId } = req.cookies;
  const { id } = req.params;

  console.log(`a post /expense/${id}/edit request was received`);

  const results = req.body;
  // console.log(results);
  const dateFormatted = moment(results.spend_date).format('YYMMDD');

  const updateExpenseQuery = `
    UPDATE expenses 
    SET
      name='${results.name}',
      expense_amount=${results.expense_amount},
      budget_id=${results.budget_id},
      note='${results.note}',
      spend_date='${dateFormatted}'
    WHERE id=${Number(id)}
    `;

  const deleteExpensesTagsQuery = `DELETE FROM expenses_tags WHERE expense_id=${id}`;

  return Promise.all([
    pool.query(updateExpenseQuery),
    pool.query(deleteExpensesTagsQuery),
  ])
    .then((allResults) => {
      console.log(allResults);
      const poolQueryArray = [];
      const insertExpensesTagsQuery = 'INSERT INTO expenses_tags (tag_id, expense_id) VALUES ($1, $2)';

      // ensure output of tag_ids is always an array
      if (!Array.isArray(results.tag_ids)) {
        results.tag_ids = [results.tag_ids];
      }

      results.tag_ids.forEach((tag_id) => {
        poolQueryArray.push(
          pool.query(insertExpensesTagsQuery, [tag_id, id]),
        );
      });

      // console.log(poolQueryArray);

      // return Promise.all(poolQueryArray);
    })

    .then((result) => {
      console.log('successfully edited expense');
      res.redirect('/');
    })
    .catch((error) => { console.log(error.stack); });
});

app.route('/create-tag', loginCheck)
  .get((req, res) => {
    res.render('create-tag');
  })
  .post((req, res) => {
    const tagString = req.body['tag-string'];
    const tagArray = parseTagString(tagString);
    console.log(tagArray);

    const { familyId } = req.cookies;

    const createTagQuery = 'INSERT INTO tags (name, family_id) VALUES ($1, $2)';
    const poolQueryArray = tagArray.map((tag) => {
      pool.query(createTagQuery, [tag, familyId]);
    });

    return Promise.all(poolQueryArray)
      .then((result) => {
        // res.send(`added tags ${tagArray}`);
        res.redirect('/create-expense');
      });
  });

app.get('/past-budgets', loginCheck, (req, res) => {
  getData(req, res, true)
    .then((result) => {
      const data = result;
      console.log(data);

      res.render('past-budgets', data);
      // res.send('past-budgets here');
    });
});

// extra route to test/execute checkBudgetsForRecurrence()
app.get('/refresh-budgets', (req, res) => {
  checkBudgetsForRecurrence(req, res);
  res.redirect('/');
});

//  TIMER
const sched = later.parse.recur().every(1).month();
// const sched = later.parse.recur().every(5).minute(); // for testing purposes
const budgetScheduler = later.setInterval(checkBudgetsForRecurrence, sched);

// #################################################

app.listen(PORT);
