-- ============================================================
-- CampusShare v2 Migration — run once against your Postgres DB
-- ============================================================

-- 1. Add transaction_type to items
--    rent   = paid + expects return
--    sell   = paid + no return expected
--    donate = free + no return expected
--    lend   = free + expects return
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS transaction_type TEXT NOT NULL DEFAULT 'lend'
    CHECK (transaction_type IN ('rent','sell','donate','lend')),
  ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'borrow',
  ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Fix existing paid items → 'rent', free items → 'lend'
UPDATE items SET transaction_type = CASE WHEN is_paid THEN 'rent' ELSE 'lend' END
  WHERE transaction_type = 'lend';  -- only updates items that still have default

-- 2. Add extra columns to borrow_requests (add safely if missing)
ALTER TABLE borrow_requests
  ADD COLUMN IF NOT EXISTS rental_amount    NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_fee     NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payout_status    TEXT DEFAULT 'na',
  ADD COLUMN IF NOT EXISTS razorpay_order_id  TEXT,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS pickup_details   TEXT,
  ADD COLUMN IF NOT EXISTS pickup_message   TEXT,
  ADD COLUMN IF NOT EXISTS item_given       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS borrower_received BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS handed_over      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS returned_at      TIMESTAMPTZ;

-- 3. Add UPI to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS upi_id TEXT;

-- 4. Item Requests table — borrower posts "I need X"
CREATE TABLE IF NOT EXISTS item_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  college_id        UUID NOT NULL REFERENCES colleges(id),
  requester_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             TEXT NOT NULL,
  description       TEXT DEFAULT '',
  category          TEXT NOT NULL DEFAULT 'Any',
  urgency           TEXT NOT NULL DEFAULT 'medium'
                      CHECK (urgency IN ('low','medium','high')),
  status            TEXT NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','closed')),
  accepted_offer_id UUID,             -- set after an offer is accepted
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_requests_college    ON item_requests(college_id);
CREATE INDEX IF NOT EXISTS idx_item_requests_requester  ON item_requests(requester_id);

-- 5. Item Request Offers table — lenders respond to a request
CREATE TABLE IF NOT EXISTS item_request_offers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id       UUID NOT NULL REFERENCES item_requests(id) ON DELETE CASCADE,
  offerer_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('rent','sell','donate','lend')),
  note             TEXT DEFAULT '',
  price            NUMERIC(10,2) DEFAULT 0,  -- 0 for donate/lend
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','accepted','declined')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_request  ON item_request_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_offers_offerer  ON item_request_offers(offerer_id);
