-- migrate:up

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(80) NOT NULL,
    city VARCHAR(120) NOT NULL,
    venue VARCHAR(255) NOT NULL,

    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,

    booking_opens_at TIMESTAMPTZ NOT NULL,
    booking_closes_at TIMESTAMPTZ NOT NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'
        CHECK (
            status IN (
                'DRAFT',
                'PUBLISHED',
                'CANCELLED',
                'COMPLETED'
            )
        ),

    created_by UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_event_dates
        CHECK (ends_at > starts_at),

    CONSTRAINT valid_booking_window
        CHECK (
            booking_opens_at < booking_closes_at
            AND booking_closes_at <= starts_at
        )
);

-- migrate:down

DROP TABLE events;

