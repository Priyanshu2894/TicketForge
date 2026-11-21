-- migrate:up

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    ticket_type_id UUID NOT NULL
        REFERENCES ticket_types(id)
        ON DELETE RESTRICT,

    quantity INTEGER NOT NULL
        CHECK (quantity BETWEEN 1 AND 4),

    unit_price_minor BIGINT NOT NULL
        CHECK (unit_price_minor >= 0),

    total_amount_minor BIGINT NOT NULL
        CHECK (total_amount_minor >= 0),

    status VARCHAR(20) NOT NULL DEFAULT 'HELD'
        CHECK (
            status IN (
                'HELD',
                'CONFIRMED',
                'CANCELLED',
                'EXPIRED'
            )
        ),

    expires_at TIMESTAMPTZ NOT NULL,

    confirmed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_reservation_expiry
        CHECK (expires_at > created_at),

    CONSTRAINT valid_reservation_amount
        CHECK (
            total_amount_minor = unit_price_minor * quantity
        ),

    CONSTRAINT valid_confirmation_timestamp
        CHECK (
            status <> 'CONFIRMED'
            OR confirmed_at IS NOT NULL
        )
);

CREATE INDEX idx_reservations_user_created
ON reservations(user_id, created_at DESC);

CREATE INDEX idx_reservations_status_expiry
ON reservations(status, expires_at);

-- migrate:down

DROP TABLE reservations;