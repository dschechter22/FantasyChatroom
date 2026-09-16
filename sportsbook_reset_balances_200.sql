-- One-time reset: drops every existing sportsbook account's balance to the
-- new default of 200 GB (new accounts already start at 200 as of the app
-- code change that shipped alongside this file). Run once in the Supabase
-- SQL editor -- this does NOT touch bet history (sb_bets/sb_parlays), only
-- the current balance, so pending bets still settle against real accounts,
-- they just start from a different number.

update gb_accounts set balance = 200;
