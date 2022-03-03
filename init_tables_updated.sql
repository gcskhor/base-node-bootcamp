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
  start_date DATE,
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
  spend_date INTEGER,
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE expenses_tags (
  id SERIAL PRIMARY KEY,
  tag_id SERIAL,
  expense_id SERIAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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

INSERT INTO budgets (name, family_id, budget_amount) VALUES ('household', 1, 200);
INSERT INTO budgets (name, family_id, budget_amount) VALUES ('fun stuff', 1, 500);
INSERT INTO budgets (name, family_id, budget_amount) VALUES ('food', 2, 800);
INSERT INTO budgets (name, family_id, budget_amount) VALUES ('games', 2, 1000);

-- fam 1
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('soap', 1, 1, 10, 220301);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('hairspray', 1, 2, 20, 220301);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('cheese', 1, 3, 30, 220302);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('botw2', 2, 2, 60, 220303);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('baba is you', 2, 3, 20, 220302);

--fam 2
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('eggs', 3, 4, 3, 220303);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('more eggs', 3, 4, 3, 220302);
INSERT INTO expenses (name, budget_id, user_id, expense_amount, spend_date) VALUES ('even more eggs', 3, 4, 3, 220301);



INSERT INTO tags (name) VALUES ('games');
INSERT INTO tags (name) VALUES ('food');
INSERT INTO tags (name) VALUES ('shower');

INSERT INTO expenses_tags (tag_id, expense_id) VALUES (1, 4);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (1, 4);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (2, 3);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (3, 1);
INSERT INTO expenses_tags (tag_id, expense_id) VALUES (3, 2);

