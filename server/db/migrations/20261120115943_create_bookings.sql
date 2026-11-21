-- migrate:up

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    reservation_id UUID NOT NULL UNIQUE
        REFERENCES reservations(id)
        ON DELETE RESTRICT,

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    booking_reference VARCHAR(40) NOT NULL UNIQUE,

    total_amount_minor BIGINT NOT NULL
        CHECK (total_amount_minor >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED'
        CHECK (
            status IN ('CONFIRMED', 'CANCELLED')
        ),

    confirmed_at TIMESTAMPTZ NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bookings_user_confirmed
ON bookings(user_id, confirmed_at DESC);

-- migrate:down

DROP TABLE bookings;