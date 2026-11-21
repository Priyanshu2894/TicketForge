-- migrate:up

CREATE TABLE ticket_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    event_id UUID NOT NULL
        REFERENCES events(id)
        ON DELETE RESTRICT,

    name VARCHAR(80) NOT NULL,

    price_minor BIGINT NOT NULL
        CHECK (price_minor >= 0),

    total_quantity INTEGER NOT NULL,

    held_quantity INTEGER NOT NULL DEFAULT 0,

    sold_quantity INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_ticket_name
        CHECK (LENGTH(TRIM(name)) > 0),

    CONSTRAINT valid_inventory
        CHECK (
            total_quantity >= 0
            AND held_quantity >= 0
            AND sold_quantity >= 0
            AND held_quantity + sold_quantity <= total_quantity
        ),

    CONSTRAINT unique_ticket_name_per_event
        UNIQUE (event_id, name)
);

-- migrate:down

DROP TABLE ticket_types;