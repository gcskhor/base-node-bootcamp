-- SELECT * from users;
-- SELECT * from families;
-- SELECT * from budgets;
-- SELECT * from expenses;
-- SELECT * from expenses_tags;
-- SELECT * from tags;


-- -- SELECT EXPENSES FROM SPECIFIC FAMILY AND CATEGORY
-- SELECT families.id, families.name AS family_name, budgets.name AS budget_name, budgets.budget_amount, expenses.name AS expense_name, expenses.expense_amount  
-- FROM families
-- INNER JOIN budgets ON families.id = budgets.family_id
-- INNER JOIN expenses ON expenses.budget_id = budgets.id
-- WHERE families.id=1 AND budgets.name = 'fun stuff';

-- SELECT EXPENSES FROM SPECIFIC FAMILY BASED ON THE USER LOGGED IN
-- SELECT users.family_id from users WHERE users.id = 1;

-- -- SELECT EXPENSES FROM SPECIFIC FAMILY AND CATEGORY
-- SELECT families.name AS family_name, budgets.name AS budget_name, budgets.budget_amount, expenses.name AS expense_name, expenses.expense_amount  
-- FROM families
-- INNER JOIN budgets ON families.id = budgets.family_id
-- INNER JOIN expenses ON expenses.budget_id = budgets.id
-- WHERE families.id=(SELECT users.family_id from users WHERE users.id = 2);

-- -- SELECT BUDGETS FROM FAMILY BASED ON USER
-- SELECT budgets.id AS budget_id, budgets.name AS budget_name, budgets.family_id, budgets.budget_amount
-- FROM budgets 
-- WHERE budgets.family_id=(SELECT users.family_id from users WHERE users.id = 2);


-- -- SELECT EXPENSES FROM BUDGETS
-- SELECT expenses.name, expenses.expense_amount, users.username FROM expenses
-- INNER JOIN users ON expenses.user_id = users.id
-- WHERE expenses.budget_id = 3;

-- SELECT * FROM expenses WHERE budget_id IN (1,3)

-- select tags from single expense / 
-- / select expense from single tag
SELECT 
  -- DISTINCT
    tags.id AS tag_id, 
    tags.name AS tag_name,
  -- expenses_tags.tag_id AS et_tagid,
  -- expenses_tags.expense_id AS et_exid,
  -- expenses.id AS expense_id,
  -- expenses.name AS expense_name,
  -- budgets.name AS budget_name,
  families.id AS family_id
FROM tags
INNER JOIN expenses_tags ON tags.id = expenses_tags.tag_id
INNER JOIN expenses ON expenses_tags.expense_id = expenses.id
INNER JOIN budgets ON expenses.budget_id = budgets.id
INNER JOIN families ON budgets.family_id = families.id

WHERE expenses.id = 12;
-- WHERE families.id = 1;q
