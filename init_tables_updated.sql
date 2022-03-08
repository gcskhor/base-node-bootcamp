DROP TABLE IF EXISTS account_approvals;

DROP TABLE IF EXISTS expenses_tags;
DROP TABLE IF EXISTS expenses;
DROP TABLE IF EXISTS tags;

DROP TABLE IF EXISTS budgets;

DROP TABLE IF EXISTS families;
DROP TABLE IF EXISTS users;



CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT,
  email TEXT,
  password TEXT,
  family_id INTEGER, -- not SERIAL so that it does not auto fill when not defined.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() --  don't need a family fk constraint because users will not have a family before approval.
);

CREATE TABLE families (
  id SERIAL PRIMARY KEY,
  name TEXT,
  main_user_id SERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_main_user_id
    FOREIGN KEY(main_user_id)
      REFERENCES users(id)
);

CREATE TABLE budgets (
  id SERIAL PRIMARY KEY,
  name TEXT,
  family_id SERIAL,
  budget_amount DECIMAL,
  start_date TEXT,
  active BOOLEAN,
  repeats_monthly BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_family
    FOREIGN KEY(family_id)
      REFERENCES families(id)
);

CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  name TEXT,
  budget_id SERIAL,
  user_id SERIAL,
  expense_amount DECIMAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  spend_date TEXT,
  note TEXT,
  -- CONSTRAINT fk_budget
  --   FOREIGN KEY(budget_id)
  --     REFERENCES budgets(id)
  -- -- beyond MVP, expenses do not need to be tied to a budget
  CONSTRAINT fk_user
    FOREIGN KEY(user_id)
      REFERENCES users(id)
);

CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name TEXT,
  family_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_family
    FOREIGN KEY(family_id)
      REFERENCES families(id)
);

CREATE TABLE expenses_tags (
  -- id SERIAL PRIMARY KEY,
  tag_id INTEGER,
  expense_id INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tag_id, expense_id),
  CONSTRAINT fk_expense
    FOREIGN KEY(expense_id)
      REFERENCES expenses(id),
  CONSTRAINT fk_tag
    FOREIGN KEY(tag_id)
      REFERENCES tags(id)
);

CREATE TABLE account_approvals (
  id SERIAL PRIMARY KEY,
  main_user_id SERIAL,
  user_id SERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_main_user_id
    FOREIGN KEY(main_user_id)
      REFERENCES users(id),
  CONSTRAINT fk_user_id
    FOREIGN KEY(user_id)
      REFERENCES users(id)
);

INSERT INTO users (username, email, password, family_id) VALUES ( 'big_daddy', 'big_daddy@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 1);
INSERT INTO users (username, email, password, family_id) VALUES ( 'small_kid', 'small_kid@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 1);
INSERT INTO users (username, email, password, family_id) VALUES ( 'small_kid2', 'small_kid2@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 1);
INSERT INTO users (username, email, password, family_id) VALUES ( 'large_papa', 'large_papa@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 2);
INSERT INTO users (username, email, password, family_id) VALUES ( 'kid1', 'kid1@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 2);
INSERT INTO users (username, email, password, family_id) VALUES ( 'kid2', 'kid2@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f', 2);

-- un-approved account to family 1 for approval
INSERT INTO users (username, email, password) VALUES ( 'small_orphan', 'small_orphan@gmail.com', '50d373a22011f7b7d63adcd584ffc8a2b19978dbaaa39498544f40eedad869cf058c390fc2e4a381dfba9f52e9889c427576e7cb09cd8f52f7a9b8cb17e1121f');


INSERT INTO families (name, main_user_id) VALUES ('big_daddy_fam', 1);
INSERT INTO families (name, main_user_id) VALUES ('large_papa_fam', 4);

INSERT INTO budgets (name, family_id, budget_amount, repeats_monthly, active, start_date) VALUES ('household', 1, 200, true, true, '220301');
INSERT INTO budgets (name, family_id, budget_amount, repeats_monthly, active, start_date) VALUES ('fun stuff', 1, 500, false, true, '220301');
INSERT INTO budgets (name, family_id, budget_amount, repeats_monthly, active, start_date) VALUES ('stonks', 1, 800, true, true, '220301');

INSERT INTO budgets (name, family_id, budget_amount, active, start_date) VALUES ('food', 2, 800, true, '220301');
INSERT INTO budgets (name, family_id, budget_amount, active, start_date) VALUES ('games', 2, 1000, true, '220301');

-- fam 1
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date, note) VALUES ('soap', 1, 1, 60, 220301, 'Was that rly smelly soap from adidas');
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('hairspray', 1, 2, 20, 220301);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date, note) VALUES ('cheese', 1, 1, 30, 220302, 'was a little mouldy but thats how you know its good right');

INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date, note) VALUES ('stuff from the supermarket', 1, 3, 40, 220301, 'looks like its goona expire realllly soon');


INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('elden ring', 2, 2, 80, 220303);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('gambling on the internet', 2, 3, 700, 220302);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('daddy toys', 2, 1, 50, 220303);


INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('GME', 3, 1, 200, 220302);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('AMC', 3, 2, 100, 220303);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('Shiba Inu', 3, 3, 69, 220304);



--fam 2
-- INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('eggs', 4, 4, 3, 220303);
-- INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('more eggs', 4, 4, 3, 220302);
-- INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('even more eggs', 4, 4, 3, 220301);



INSERT INTO tags (name, family_id) VALUES ('games', 1);
INSERT INTO tags (name, family_id) VALUES ('food', 1);
INSERT INTO tags (name, family_id) VALUES ('impulsive buy', 1);
INSERT INTO tags (name, family_id) VALUES ('transport',1);
INSERT INTO tags (name, family_id) VALUES ('software', 1);
INSERT INTO tags (name, family_id) VALUES ('essential', 1);


INSERT INTO expenses_tags (tag_id, expense_id) VALUES (1, 4);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (3, 4);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (2, 3);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (3, 1);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (3, 2);

